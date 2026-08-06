// Renders parsed markdown nodes — inline nodes nest in Text for wrapping, block nodes are Views. Each excerpt unit
// (see groupIntoUnits) gets one container, so its highlight is continuous and measurable for the long-press menu.

import clsx from "clsx";
import React from "react";
import {
  Linking,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { CodeBlock } from "@/components/ui/CodeBlock";
import type { AnchorRect } from "@/lib/types/geometry";
import {
  type BlockNode,
  type InlineNode,
  parseMarkdown,
} from "@/components/ui/markdown/parseMarkdown";
import { groupIntoUnits } from "@/components/ui/markdown/groupIntoUnits";

// Hands the unit's message-scoped key and its on-screen bounds; the text is resolved from the reply when acted on.
type OnLongPressExcerpt = (key: string, anchor: AnchorRect) => void;

export interface MarkdownProps {
  source: string;
  className?: string;
  testID?: string;
  onLongPressExcerpt?: OnLongPressExcerpt;
  // Namespace prepended to unit keys so highlights never collide across messages.
  highlightPrefix?: string;
  // Full key (prefix:unitKey) of the unit to tint while its menu is open.
  activeHighlightKey?: string;
}
// Opens a markdown link externally; a rejected promise (bad scheme / no handler) is logged, never thrown, so a malformed LLM link can't crash the row.
function openLink(href: string): void {
  Linking.openURL(href).catch((error: unknown) => {
    console.warn("Markdown: failed to open link", href, error);
  });
}
// Inline `code` stays inside the parent Text flow as a styled Text — using the View-based <Code/> would break wrapping.
function renderInline(node: InlineNode, key: number): React.ReactElement {
  switch (node.type) {
    case "text":
      return <Text key={key}>{node.value}</Text>;
    case "bold":
      return (
        <Text key={key} className="font-semibold">
          {node.value}
        </Text>
      );
    case "italic":
      return (
        <Text key={key} className="italic">
          {node.value}
        </Text>
      );
    case "code":
      return (
        // `text-body` matches the surrounding paragraph so the chip doesn't shrink mid-line.
        <Text
          key={key}
          className="font-mono text-body bg-muted text-foreground rounded-lg"
        >
          {node.value}
        </Text>
      );
    case "link":
      return (
        <Text
          key={key}
          className="text-primary underline"
          onPress={(): void => openLink(node.href)}
        >
          {node.value}
        </Text>
      );
    default:
      return <Text key={key} />;
  }
}

// Headings walk the iOS type ramp (title-2 bold per Apple's Emphasized pairing, then semibold tiers); h6 leans on colour so deep headings read as headings without dwarfing the text.
const HEADING_CLASS = {
  1: "font-sans text-title-2 font-bold text-foreground mb-3 mt-2",
  2: "font-sans text-title-3 font-semibold text-foreground mb-2 mt-2",
  3: "font-sans text-headline font-semibold text-foreground mb-2 mt-2",
  4: "font-sans text-callout font-semibold text-foreground mb-2 mt-2",
  5: "font-sans text-subhead font-semibold text-foreground mb-1 mt-2",
  6: "font-sans text-subhead font-semibold text-muted-foreground mb-1 mt-2",
} as const;

// A wide table gives each column a readable min width and scrolls sideways; one that already fits fills the width instead.
const TABLE_MIN_COLUMN_WIDTH = 112;

// A unit's measured box swallows its children's vertical margins, so it reads bottom-heavy when highlighted. These
// mirror the mb-*/mt-* classes below (NativeWind renders rem at 14px, hence the halves) so the box can be balanced.
const BLOCK_MARGIN_TOP: Partial<Record<BlockNode["type"], number>> = {
  heading: 7,
  rule: 14,
};
// Heading bottoms differ by level in HEADING_CLASS (h1 mb-3, h2-h4 mb-2, h5-h6 mb-1), so they cannot share one entry.
type HeadingLevel = Extract<BlockNode, { type: "heading" }>["level"];
const HEADING_MARGIN_BOTTOM: Record<HeadingLevel, number> = {
  1: 10.5,
  2: 7,
  3: 7,
  4: 7,
  5: 3.5,
  6: 3.5,
};
const BLOCK_MARGIN_BOTTOM: Partial<Record<BlockNode["type"], number>> = {
  paragraph: 10.5,
  list: 10.5,
  orderedList: 10.5,
  blockquote: 10.5,
  code: 10.5,
  table: 10.5,
  rule: 14,
};

function marginBottomOf(block: BlockNode): number {
  if (block.type === "heading") return HEADING_MARGIN_BOTTOM[block.level];
  return BLOCK_MARGIN_BOTTOM[block.type] ?? 0;
}

// Renders a block; onLongPress (a no-arg trigger for this block's unit) is attached to the Text where iOS long-press fires.
function renderBlock(
  node: BlockNode,
  key: number,
  onLongPress?: () => void,
): React.ReactElement {
  switch (node.type) {
    case "paragraph":
      return (
        <Text
          key={key}
          suppressHighlighting
          onLongPress={onLongPress}
          className="font-sans text-body text-foreground mb-3"
        >
          {node.children.map(renderInline)}
        </Text>
      );
    case "heading":
      return (
        <Text
          key={key}
          suppressHighlighting
          onLongPress={onLongPress}
          className={HEADING_CLASS[node.level]}
        >
          {node.children.map(renderInline)}
        </Text>
      );
    // Both list flavours share one branch: only the marker differs, and both need the same long-press wiring.
    case "list":
    case "orderedList":
      return (
        <View key={key} className="mb-3">
          {node.items.map((item, idx) => (
            <View key={idx} className="flex-row mb-1">
              <Text className="font-sans text-body text-muted-foreground mr-2">
                {node.type === "orderedList" ? `${node.start + idx}.` : "•"}
              </Text>
              <Text
                suppressHighlighting
                onLongPress={onLongPress}
                className="font-sans text-body text-foreground flex-1"
              >
                {item.map(renderInline)}
              </Text>
            </View>
          ))}
        </View>
      );
    case "blockquote":
      return (
        <View key={key} className="mb-3 border-l-4 border-border pl-3">
          {node.children.map((child, idx) =>
            renderBlock(child, idx, onLongPress),
          )}
        </View>
      );
    case "rule":
      return <View key={key} className="my-4 h-px bg-border" />;
    case "code":
      return (
        <View key={key} className="mb-3">
          <CodeBlock {...(node.lang !== undefined ? { lang: node.lang } : {})}>
            {node.value}
          </CodeBlock>
        </View>
      );
    case "table":
      return (
        <TableBlock
          key={key}
          headers={node.headers}
          rows={node.rows}
          onLongPress={onLongPress}
        />
      );
    default:
      return <View key={key} />;
  }
}

interface TableBlockProps {
  headers: InlineNode[][];
  rows: InlineNode[][][];
  onLongPress?: () => void;
}
// Measures the row width: columns fill it when the table fits, else fall back to a min width and the whole table scrolls sideways so cells never crush to one glyph per line.
function TableBlock({
  headers,
  rows,
  onLongPress,
}: TableBlockProps): React.ReactElement {
  const [available, setAvailable] = React.useState(0);
  const columnCount = headers.length;
  const columnWidth =
    available > 0
      ? Math.max(TABLE_MIN_COLUMN_WIDTH, available / columnCount)
      : TABLE_MIN_COLUMN_WIDTH;
  const onLayout = (event: LayoutChangeEvent): void => {
    setAvailable(event.nativeEvent.layout.width);
  };
  return (
    <View className="mb-3" onLayout={onLayout}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="rounded-xl border border-border overflow-hidden">
          {/* Header band uses the faint large-area fill (iOS quaternarySystemFill) so it reads as structure, not a control. An excerpt highlight sits on the unit behind it, so a tinted table shows the band slightly darker than its rows — the kit's structure wins over a uniform wash. */}
          <View className="flex-row bg-fill-quaternary">
            {headers.map((cell, ci) => (
              <View
                key={ci}
                style={{ width: columnWidth }}
                className={clsx(
                  "px-3 py-2",
                  ci > 0 && "border-l border-border",
                )}
              >
                <Text
                  suppressHighlighting
                  onLongPress={onLongPress}
                  className="font-sans text-subhead font-semibold text-foreground"
                >
                  {cell.map(renderInline)}
                </Text>
              </View>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} className="flex-row border-t border-border">
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  style={{ width: columnWidth }}
                  className={clsx(
                    "px-3 py-2",
                    ci > 0 && "border-l border-border",
                  )}
                >
                  <Text
                    suppressHighlighting
                    onLongPress={onLongPress}
                    className="font-sans text-subhead text-foreground"
                  >
                    {cell.map(renderInline)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function Markdown({
  source,
  className,
  testID,
  onLongPressExcerpt,
  highlightPrefix,
  activeHighlightKey,
}: MarkdownProps): React.ReactElement {
  const unitRefs = React.useRef(new Map<string, View>());
  const prefix = highlightPrefix ?? "";
  // Reparsing on every render would run the whole reply through the parser twice per menu open/close.
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  const units = React.useMemo(() => groupIntoUnits(blocks), [blocks]);
  // Measure the unit's container in-window and hand its top/bottom to the pill so it anchors above/below, not over the text.
  const open = (unitKey: string): void => {
    if (!onLongPressExcerpt) return;
    const full = `${prefix}:${unitKey}`;
    const node = unitRefs.current.get(full);
    if (node) {
      node.measureInWindow((x, y, w, h) => {
        // A recycled or detached FlashList node measures as zeros; anchoring to that would park the menu at the top edge.
        if (w === 0 && h === 0) return;
        onLongPressExcerpt(full, {
          top: y,
          bottom: y + h,
          left: x,
          width: w,
        });
      });
    }
  };
  const setRef =
    (unitKey: string) =>
    (v: View | null): void => {
      const full = `${prefix}:${unitKey}`;
      if (v) unitRefs.current.set(full, v);
      else unitRefs.current.delete(full);
    };
  // Faintest fill tier: the menu's dim already spares this unit, so a heavier wash would only grey the text it
  // features. A class, not an inline style — it is a static conditional background, neither animated nor measured.
  const highlightClass = (unitKey: string): string | false =>
    activeHighlightKey === `${prefix}:${unitKey}` && "bg-fill-quaternary";
  // One container per unit: consecutive same-key blocks (a section) share it; a standalone list gets one per item.
  const out: React.ReactElement[] = [];
  let i = 0;
  while (i < blocks.length) {
    const unit = units[i];
    if ("itemKeys" in unit) {
      const block = blocks[i];
      const items =
        block.type === "list" || block.type === "orderedList"
          ? block.items
          : [];
      out.push(
        <View key={i} className="mb-3">
          {items.map((item, idx) => {
            const iKey = unit.itemKeys[idx];
            const marker =
              block.type === "orderedList" && block.start !== undefined
                ? `${block.start + idx}.`
                : "•";
            return (
              <View
                key={idx}
                ref={setRef(iKey)}
                className={clsx(
                  "flex-row mb-1 -mx-2 px-2 rounded-xl",
                  highlightClass(iKey),
                )}
              >
                <Text className="font-sans text-body text-muted-foreground mr-2">
                  {marker}
                </Text>
                <Text
                  suppressHighlighting
                  onLongPress={(): void => open(iKey)}
                  className="font-sans text-body text-foreground flex-1"
                >
                  {item.map(renderInline)}
                </Text>
              </View>
            );
          })}
        </View>,
      );
      i += 1;
      continue;
    }
    const { key } = unit;
    const start = i;
    const grouped: React.ReactElement[] = [];
    while (i < blocks.length) {
      const u = units[i];
      if ("itemKeys" in u || u.key !== key) break;
      grouped.push(renderBlock(blocks[i], i, (): void => open(key)));
      i += 1;
    }
    // Pad the top by whatever the last block's bottom margin exceeds the first block's top margin, then pull the same
    // amount back out — the box ends up vertically even without moving a single line of text.
    const balance = Math.max(
      0,
      marginBottomOf(blocks[i - 1]) -
        (BLOCK_MARGIN_TOP[blocks[start].type] ?? 0),
    );
    out.push(
      <View
        key={`u${start}`}
        ref={setRef(key)}
        style={{ paddingTop: balance, marginTop: -balance }}
        className={clsx("-mx-2 px-2 rounded-xl", highlightClass(key))}
      >
        {grouped}
      </View>,
    );
  }
  return (
    <View className={clsx(className)} testID={testID}>
      {out}
    </View>
  );
}
