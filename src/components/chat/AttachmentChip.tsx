// Compact chip for one attached file; `invalid` repaints it red and surfaces `reason` so Composer can block send.

import clsx from "clsx";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { FileText, X } from "lucide-react-native";
import { Pressable } from "@/components/ui/Pressable";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, motion, strokeWidth } from "@/lib/design/tokens";
import { baseAnimationDurationMs, surfaceSpring } from "@/lib/design/motion";
import { ATTACHMENT_CHIP_SLIDE_DISTANCE } from "@/modules/chat/constants";

export interface AttachmentChipProps {
  filename: string;
  uri?: string;
  isImage?: boolean;
  invalid?: boolean;
  reason?: string;
  onRemove?: () => void;
}

export function AttachmentChip({
  filename,
  uri,
  isImage,
  invalid,
  reason,
  onRemove,
}: AttachmentChipProps): React.ReactElement {
  const colors = useThemeColors();
  const isImageChip = isImage ?? (uri !== undefined && uri.length > 0);
  const showThumb = isImageChip && uri !== undefined && uri.length > 0;
  // Only Composer chips slide on entrance — user-message chips live in a recycled FlashList row and would shimmer on every scroll-back.
  const hasEntrance = onRemove !== undefined;
  const translate = useSharedValue(
    hasEntrance ? ATTACHMENT_CHIP_SLIDE_DISTANCE : 0,
  );
  const opacity = useSharedValue(hasEntrance ? 0 : 1);
  useEffect(() => {
    if (!hasEntrance) return;
    translate.value = withSpring(0, surfaceSpring);
    opacity.value = withTiming(1, { duration: baseAnimationDurationMs });
  }, [hasEntrance, translate, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translate.value }],
  }));
  const isInvalid = invalid === true;
  return (
    <Animated.View className="relative" style={animatedStyle}>
      {showThumb ? (
        <View
          className={clsx(
            "rounded-2xl overflow-hidden border bg-muted",
            isInvalid ? "border-destructive" : "border-gray4",
          )}
          style={{
            width: componentLayout.attachmentChipThumb,
            height: componentLayout.attachmentChipThumb,
          }}
        >
          <Image
            source={{ uri }}
            // expo-image's `style` prop doesn't accept className.
            style={{
              width: componentLayout.attachmentChipThumb,
              height: componentLayout.attachmentChipThumb,
            }}
            contentFit="cover"
            transition={120}
          />
          {isInvalid ? (
            <View className="absolute inset-0 bg-destructive opacity-25" />
          ) : null}
        </View>
      ) : (
        <View
          className={clsx(
            "flex-row items-center border rounded-xl px-2.5 py-1.5",
            isInvalid
              ? "bg-destructive-soft border-destructive"
              : "bg-card border-gray4",
          )}
          style={{ maxWidth: componentLayout.attachmentChipMaxWidth }}
        >
          <View
            className="bg-muted rounded-lg items-center justify-center mr-2"
            style={{
              width: componentLayout.attachmentChipIconWrap,
              height: componentLayout.attachmentChipIconWrap,
            }}
          >
            <FileText size={iconSize.xs} color={colors.mutedForeground} />
          </View>
          <Text
            className={clsx(
              "font-sans flex-shrink text-xs",
              isInvalid ? "text-destructive" : "text-foreground",
            )}
            numberOfLines={1}
          >
            {filename}
          </Text>
        </View>
      )}
      {isInvalid && reason !== undefined ? (
        <Text
          className="font-sans text-destructive mt-1 text-xs max-w-50"
          numberOfLines={1}
        >
          {reason}
        </Text>
      ) : null}
      {onRemove !== undefined ? (
        // Remove button positioned just outside the chip's top-right corner via negative offsets.
        <View className="absolute -top-1.5 -right-1.5">
          <Pressable
            onPress={onRemove}
            scale={motion.scalePressXTight}
            className="w-4.5 h-4.5 rounded-full bg-secondary items-center justify-center"
          >
            <X
              size={iconSize["2xs"]}
              color={colors.foreground}
              strokeWidth={strokeWidth.bold}
            />
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}
