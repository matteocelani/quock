import Image from "next/image";
import type { ReactNode } from "react";
import { SCREEN_ALT, type ScreenName } from "@/lib/screens";
import { cn } from "@/lib/utils";

const SHOT_WIDTH = 840;
const SHOT_HEIGHT = 1714;

interface ScreenStackProps {
  screens: readonly ScreenName[];
  active: ScreenName;
  className?: string;
  sizes?: string;
  isPriority?: boolean;
}

// Every capture is mounted once and cross-faded, so switching never waits on the network.
export function ScreenStack({
  screens,
  active,
  className,
  sizes = "(min-width: 1024px) 340px, 260px",
  isPriority = false,
}: ScreenStackProps): ReactNode {
  return (
    <div className={cn("relative aspect-[840/1714]", className)}>
      {screens.map((screen, index) => {
        const isActive = screen === active;
        return (
          <Image
            key={screen}
            src={`/screens/${screen}-${SHOT_WIDTH}.webp`}
            alt={SCREEN_ALT[screen]}
            width={SHOT_WIDTH}
            height={SHOT_HEIGHT}
            sizes={sizes}
            preload={isPriority && index === 0}
            loading={isPriority ? "eager" : "lazy"}
            draggable={false}
            aria-hidden={!isActive}
            className={cn(
              "absolute inset-0 h-full w-full drop-shadow-2xl transition-[opacity,transform,filter] duration-500 ease-glide select-none",
              isActive ? "scale-100 opacity-100 blur-0" : "scale-[0.98] opacity-0 blur-sm",
            )}
          />
        );
      })}
    </div>
  );
}
