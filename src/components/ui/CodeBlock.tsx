// Fenced code block — header (lang + copy) over a horizontally-scrollable mono body.

import clsx from "clsx";
import * as Clipboard from "expo-clipboard";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ScrollView, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, timingsNamed } from "@/lib/design/tokens";
import { Check, Copy } from "lucide-react-native";
import { highlightCode } from "@/components/ui/markdown/highlight";
import { Pressable } from "@/components/ui/Pressable";

// Inner padding of the horizontally-scrollable code body — matches the visual rhythm of the surrounding mono text and the px-3 header above.
const CODE_BODY_PADDING_X = 12;
const CODE_BODY_PADDING_Y = 10;

export interface CodeBlockProps {
  lang?: string;
  children: string;
  className?: string;
  testID?: string;
}

export function CodeBlock({
  lang,
  children,
  className,
  testID,
}: CodeBlockProps): React.ReactElement {
  const colors = useThemeColors();
  const [didCopy, setDidCopy] = useState<boolean>(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);
  // Highlighter runs once per content/lang pair; renderer reuses the same segments while only Copy state changes.
  const segments = useMemo(
    () => highlightCode(children, lang ?? "plain"),
    [children, lang],
  );
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await Clipboard.setStringAsync(children);
      setDidCopy(true);
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setDidCopy(false);
        resetTimerRef.current = null;
      }, timingsNamed.copyFeedback);
    } catch (err: unknown) {
      console.error("CodeBlock: clipboard write failed", err);
    }
  }, [children]);
  return (
    <View
      testID={testID}
      className={clsx(
        "bg-muted border border-border rounded-xl overflow-hidden",
        className,
      )}
    >
      <View className="flex-row items-center justify-between px-3 py-2 border-b border-border">
        <Text className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          {lang ?? "text"}
        </Text>
        <Pressable
          onPress={() => {
            void handleCopy();
          }}
          className="px-1 py-0.5"
          // Copy actions feel best without a heavy haptic — the action is ambient.
          haptic={false}
        >
          {didCopy ? (
            <Check size={iconSize.xs + 1} color={colors.mutedForeground} />
          ) : (
            <Copy size={iconSize.xs + 1} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: CODE_BODY_PADDING_X, paddingVertical: CODE_BODY_PADDING_Y }}
      >
        <Text className="font-mono text-foreground text-xs">
          {segments.map((segment, index) => (
            <Text key={index} style={{ color: colors.syntax[segment.kind] }}>
              {segment.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}
