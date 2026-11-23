import { GUIDE_PATH, GUIDE_STEPS, GUIDE_TITLE } from "@/modules/guide/content";
import { absoluteUrl } from "@/lib/utils";

export const HOW_TO_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: GUIDE_TITLE,
  description: "Chat with Ollama Cloud models on an iPhone using Quock.",
  totalTime: "PT3M",
  tool: [{ "@type": "HowToTool", name: "iPhone with iOS 15.1 or later" }],
  supply: [{ "@type": "HowToSupply", name: "An ollama.com account" }],
  step: GUIDE_STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.body,
    url: absoluteUrl(`${GUIDE_PATH}#step-${index + 1}`),
  })),
};
