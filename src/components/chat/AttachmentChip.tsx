// Compact chip for one attached file; `invalid` repaints it red and surfaces `reason` so Composer can block send.

import clsx from "clsx";
import { Image } from "expo-image";
import React, { useEffect, useMemo } from "react";
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

// Decode-size hint: ~2x the 60px display so expo-image decodes the thumbnail at chip scale, not full resolution. 2x keeps it crisp on retina.
const THUMB_DECODE_PX = componentLayout.attachmentChipThumb * 2;

export interface AttachmentChipProps {
  filename: string;
  uri?: string;
  isImage?: boolean;
  invalid?: boolean;
  onRemove?: () => void;
}

export function AttachmentChip({
  filename,
  uri,
  isImage,
  invalid,
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
  // Stable source object so expo-image doesn't treat each re-render's inline {uri} as a new source and re-decode the thumbnail.
  // width/height are a decode-size hint so expo-image decodes the local file at thumbnail scale; the original photo stays the upload source.
  const imageSource = useMemo(
    () => ({ uri, width: THUMB_DECODE_PX, height: THUMB_DECODE_PX }),
    [uri],
  );
  // Wrapper sized to thumb + half-badge so both sit as absolute children; the explicit size keeps the badge fully
  // in-bounds (iOS drops taps on children outside the parent) and tappable. 20px must match the w-5.25 badge class.
  const removeBadgeSize = componentLayout.attachmentChipRemoveBadge; // mirrors the w-5.25/h-5.25 badge class
  const halfBadge = removeBadgeSize / 2;
  const thumbWrapperSize = componentLayout.attachmentChipThumb + halfBadge;
  const removeBadge =
    onRemove !== undefined ? (
      // Pressable forwards className to BOTH its outer and inner view, so position must ride inline style on the outer
      // only; size/shape come from the w-5.25 class. The badge straddles the thumb's top-right corner 50/50, in-bounds.
      <Pressable
        onPress={onRemove}
        hitSlop={componentLayout.attachmentChipRemoveBadgeHitSlop}
        scale={motion.scalePressXTight}
        accessibilityLabel="Remove attachment"
        className="w-5.25 h-5.25 rounded-full bg-secondary items-center justify-center"
        style={{ position: "absolute", top: 0, right: 0 }}
      >
        <X
          size={iconSize["2xs"]}
          color={colors.foreground}
          strokeWidth={strokeWidth.bold}
        />
      </Pressable>
    ) : null;
  return (
    <Animated.View className="relative" style={animatedStyle}>
      {showThumb ? (
        // Explicit-size wrapper = thumb + half-badge on top+right; thumb pinned bottom-left, badge top-right (below).
        <View
          className="relative"
          style={{ width: thumbWrapperSize, height: thumbWrapperSize }}
        >
          <View
            className={clsx(
              "rounded-2xl overflow-hidden border bg-muted",
              isInvalid ? "border-destructive" : "border-gray4",
            )}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: componentLayout.attachmentChipThumb,
              height: componentLayout.attachmentChipThumb,
            }}
          >
            <Image
              source={imageSource}
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
          {removeBadge}
        </View>
      ) : (
        // File pill: width is dynamic so the wrapper can't be pre-sized. Inline padding reserves the half-badge overhang and keeps it
        // in-bounds/tappable; Yoga padding doesn't inset abs children, so the badge's top:0/right:0 straddle the pill's top-right corner as on the thumb.
        <View
          className="relative"
          style={{ paddingTop: halfBadge, paddingRight: halfBadge }}
        >
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
          {removeBadge}
        </View>
      )}
    </Animated.View>
  );
}
