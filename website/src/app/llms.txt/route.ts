import { buildLlmsTxt } from "@/modules/llms/content";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
