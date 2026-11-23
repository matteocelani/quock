import { FAQ } from "@/modules/faq/content";
import { GUIDE_PATH, GUIDE_STEPS } from "@/modules/guide/content";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-static";

// llms.txt (llmstxt.org): a plain summary AI assistants can read and cite, built from the same content as the pages.
export function GET(): Response {
  const body = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `Quock is a native iPhone app for chatting with the open models hosted on Ollama Cloud. Version ${SITE.version}, free on the App Store, iOS ${SITE.minimumIos} or later. Made by ${SITE.author}, MIT licensed. ${SITE.disclaimer}`,
    "",
    "## Key facts",
    "",
    "- Works with every model in the Ollama Cloud catalogue (Gemma, Qwen, Llama, GPT-OSS, DeepSeek, Kimi, GLM and more).",
    "- Streamed replies, thinking for reasoning models, live web search, PDFs with on-device OCR, images for vision models.",
    "- Memory, pinned chats, forks, answers that finish in the background, and resuming interrupted answers.",
    "- Chats are stored on the iPhone. There is no Quock server and no analytics.",
    "- Sign-in uses a per-device key pair approved once on ollama.com; no password is stored in the app.",
    "",
    "## How to use Ollama Cloud on iPhone",
    "",
    ...GUIDE_STEPS.map((step, index) => `${index + 1}. ${step.title} ${step.body}`),
    "",
    "## Pages",
    "",
    `- [Home](${absoluteUrl("/")}): what Quock does`,
    `- [Guide](${absoluteUrl(GUIDE_PATH)}): how to use Ollama Cloud on iPhone`,
    `- [FAQs](${absoluteUrl("/faq/")}): ${FAQ.length} answered questions`,
    `- [Changelog](${absoluteUrl("/changelog/")}): every release`,
    `- [Privacy](${absoluteUrl("/privacy/")}): where your data goes`,
    `- [App Store](${SITE.appStoreUrl}): download`,
    `- [Source code](${SITE.githubUrl}): GitHub`,
    "",
    "## FAQs",
    "",
    ...FAQ.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
