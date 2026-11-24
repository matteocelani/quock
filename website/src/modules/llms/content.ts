import { LATEST_RELEASE } from "@/modules/changelog/content";
import { FAQ } from "@/modules/faq/content";
import { GUIDE_STEPS, GUIDE_TITLE } from "@/modules/guide/content";
import { APP_FEATURES } from "@/modules/home/content";
import { LINK_LABELS, PAGE_LABELS, PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

// llmstxt.org shape: H1, summary, then prose and lists, with H2 sections reserved for link lists.
// Built from the same modules as the pages, so assistants quote what the site says.
export function buildLlmsTxt(): string {
  const pages = (Object.keys(PAGE_LABELS) as (keyof typeof PAGE_LABELS)[]).map(
    (key) => `- [${PAGE_LABELS[key]}](${absoluteUrl(PATHS[key])})`,
  );
  return [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `Version ${LATEST_RELEASE.version}, ${SITE.priceLabel.toLowerCase()} on the App Store, iOS ${SITE.minimumIos} or later. Made by ${SITE.author}.`,
    "",
    "Features:",
    "",
    ...APP_FEATURES.map((feature) => `- ${feature}`),
    "",
    `${GUIDE_TITLE}:`,
    "",
    ...GUIDE_STEPS.map((step, index) => `${index + 1}. ${step.title} ${step.body}`),
    "",
    "Questions and answers:",
    "",
    ...FAQ.flatMap((item) => [`- **${item.question}** ${item.answer}`]),
    "",
    "## Pages",
    "",
    ...pages,
    "",
    "## Links",
    "",
    `- [App Store](${SITE.appStoreUrl}): download Quock`,
    `- [${LINK_LABELS.source}](${SITE.githubUrl}): the full project on GitHub`,
    `- [${LINK_LABELS.policy}](${SITE.privacyUrl}): the controlling text`,
  ].join("\n");
}
