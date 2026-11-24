import type { ComponentProps, ReactNode } from "react";
import { headingVariants } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

// Native <details>: keyboard, find-in-page and no-JS support for free, and crawlers see every answer.
export function Accordion({ className, ...props }: ComponentProps<"div">): ReactNode {
  return <div className={cn("divide-y", className)} {...props} />;
}

interface AccordionItemProps extends Omit<ComponentProps<"details">, "title"> {
  title: ReactNode;
  aside?: ReactNode;
}

export function AccordionItem({ title, aside, children, className, ...props }: AccordionItemProps): ReactNode {
  return (
    <details className={cn("group", className)} {...props}>
      <summary className="hover:bg-panel -mx-3 flex cursor-pointer list-none items-center gap-4 rounded-xl px-3 py-4 text-left transition-colors [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-faint-foreground relative size-4 shrink-0">
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-current transition-transform duration-300 ease-spring group-open:scale-y-0" />
        </span>
        <span className={cn(headingVariants({ size: "item" }), "flex-1")}>{title}</span>
        {aside}
      </summary>
      <div className="text-muted-foreground pt-1 pb-6 pl-8 text-body leading-relaxed text-pretty">{children}</div>
    </details>
  );
}
