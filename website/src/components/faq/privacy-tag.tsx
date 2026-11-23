import type { ReactNode } from "react";
import { ShieldIcon } from "@/components/ui/icons";

// Marks the answers about data, so a privacy-minded reader can scan for them; screen readers hear it too.
export function PrivacyTag(): ReactNode {
  return (
    <span className="text-faint-foreground shrink-0">
      <ShieldIcon className="size-5" />
      <span className="sr-only">Privacy</span>
    </span>
  );
}
