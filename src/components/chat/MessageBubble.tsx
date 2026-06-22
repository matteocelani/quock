// Message container — user (right-aligned bubble), assistant (edge-to-edge), tool (pill). Memoized so streams don't repaint siblings.

import clsx from "clsx";
import React from "react";
import { View } from "react-native";

export interface MessageBubbleProps {
  role: "user" | "assistant" | "tool";
  children: React.ReactNode;
  isStreaming?: boolean;
}

// No entrance animation — FlashList recycles cells, so a mount-driven pop would shimmer on every scroll-back.
function MessageBubbleImpl({
  role,
  children,
}: MessageBubbleProps): React.ReactElement {
  if (role === "user") {
    return (
      <View className="px-4 py-2 items-end">
        <View
          className={clsx("bg-primary rounded-3xl px-4 py-2.5")}
          // Tailwind has no fractional max-width tokens; inline literal keeps the 80% cap rendering correctly on RN.
          style={{ maxWidth: "80%" }}
        >
          {children}
        </View>
      </View>
    );
  }
  if (role === "tool") {
    return (
      <View className="px-4 py-2">
        <View className="bg-muted rounded-lg px-3 py-2 border border-border">
          {children}
        </View>
      </View>
    );
  }
  return <View className="px-4 py-3">{children}</View>;
}

function areEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.children === next.children &&
    prev.isStreaming === next.isStreaming &&
    prev.role === next.role
  );
}

export const MessageBubble = React.memo(MessageBubbleImpl, areEqual);
