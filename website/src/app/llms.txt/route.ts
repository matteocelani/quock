import { FAQ } from "@/modules/faq/content";
import { GUIDE_STEPS, GUIDE_TITLE } from "@/modules/guide/content";
import { APP_FEATURES } from "@/modules/home/content";
import { PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

// llms.txt (llmstxt.org) is assembled from the same modules as the pages, so assistants quote what the site says.
export function GET(): Response {
  const body = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `Version ${SITE.version}, free on the App Store, iOS ${SITE.minimumIos} or later. Made by ${SITE.author}, MIT licensed. ${SITE.disclaimer}`,
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
    `- [Guide](${absoluteUrl(PATHS.guide)})`,
    `- [FAQs](${absoluteUrl(PATHS.faq)})`,
    `- [Changelog](${absoluteUrl(PATHS.changelog)})`,
    `- [Privacy](${absoluteUrl(PATHS.privacy)})`,
    `- [App Store](${SITE.appStoreUrl})`,
    `- [Source code](${SITE.githubUrl})`,
    "",
    "## FAQs",
    "",
    ...FAQ.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
