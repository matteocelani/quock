import type { ReactNode } from "react";

interface StepBadgeProps {
  step: number;
}

// The same numbered square on the home page and the guide, so the four steps read as one sequence.
export function StepBadge({ step }: StepBadgeProps): ReactNode {
  return (
    <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-bold">
      {step}
    </span>
  );
}
