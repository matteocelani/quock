import { LATEST_RELEASE } from "@/modules/changelog/content";
import { FAQ } from "@/modules/faq/content";
import { GUIDE_STEPS, GUIDE_TITLE } from "@/modules/guide/content";
import { APP_FEATURES } from "@/modules/home/content";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

// llms.txt (llmstxt.org) is assembled from the same modules as the pages, so assistants quote what the site says.
// The legal line reaches it through the "Who makes Quock?" answer, so it is not repeated here.
export function buildLlmsTxt(): string {
  const pages = (Object.keys(PAGE_LABELS) as (keyof typeof PAGE_LABELS)[]).map(
    (key) => `- [${PAGE_LABELS[key]}](${absoluteUrl(PATHS[key])})`,
  );
  return [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `Version ${LATEST_RELEASE.version}, free on the App Store, iOS ${SITE.minimumIos} or later. Made by ${SITE.author}.`,
    "",
    "## Features",
    "",
    ...APP_FEATURES.map((feature) => `- ${feature}`),
    "",
    `## ${GUIDE_TITLE}`,
    "",
    ...GUIDE_STEPS.map((step, index) => `${index + 1}. ${step.title} ${step.body}`),
    "",
    "## Pages",
    "",
    `- [Home](${absoluteUrl(PATHS.home)})`,
    ...pages,
    `- [App Store](${SITE.appStoreUrl})`,
    `- [Source code](${SITE.githubUrl})`,
    "",
    "## FAQs",
    "",
    ...FAQ.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
  ].join("\n");
}
