import type { ReactNode } from "react";

interface JsonLdProps {
  data: Record<string, unknown>;
}

// Escapes "<" so a string in the data can never close the script tag early.
export function JsonLd({ data }: JsonLdProps): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
