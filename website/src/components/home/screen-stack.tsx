import Image from "next/image";
import type { ReactNode } from "react";
import { SCREEN_ALT, SHOT_HEIGHT, SHOT_WIDTH, screenSrc, type ScreenName } from "@/modules/home/screens";
import { cn } from "@/lib/utils";

interface ScreenStackProps {
  id: string;
  labelledBy: string;
  screens: readonly ScreenName[];
  active: ScreenName;
  sizes: string;
  className?: string;
  isPriority?: boolean;
}

// Every capture is mounted once and cross-faded, so switching never waits on the network.
// It is the tab panel of the tabs that drive it; only the first capture is fetched eagerly.
export function ScreenStack({
  id,
  labelledBy,
  screens,
  active,
  sizes,
  className,
  isPriority = false,
}: ScreenStackProps): ReactNode {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={cn("relative rounded-3xl", className)}
      style={{ aspectRatio: `${SHOT_WIDTH} / ${SHOT_HEIGHT}` }}
    >
      {screens.map((screen, index) => {
        const isActive = screen === active;
        const isEager = isPriority && index === 0;
        return (
          <Image
            key={screen}
            src={screenSrc(screen)}
            alt={isActive ? SCREEN_ALT[screen] : ""}
            width={SHOT_WIDTH}
            height={SHOT_HEIGHT}
            sizes={sizes}
            preload={isEager}
            loading={isEager ? "eager" : "lazy"}
            draggable={false}
            aria-hidden={!isActive}
            className={cn(
              "absolute inset-0 h-full w-full drop-shadow-2xl transition-[opacity,scale,translate,filter] duration-500 ease-glide select-none",
              isActive ? "scale-100 opacity-100 blur-none" : "scale-98 opacity-0 blur-sm",
            )}
          />
        );
      })}
    </div>
  );
}
