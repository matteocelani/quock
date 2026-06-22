// Renders parsed markdown nodes — inline nodes nest in Text for wrapping/selection, block nodes are Views.

import clsx from "clsx";
import React from "react";
import { Text, View } from "react-native";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  type BlockNode,
  type InlineNode,
  parseMarkdown,
} from "@/components/ui/markdown/parseMarkdown";

export interface MarkdownProps {
  source: string;
  className?: string;
  testID?: string;
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
        // `text-base` matches the surrounding paragraph so the chip doesn't shrink mid-line.
        <Text key={key} className="font-mono text-base bg-muted text-foreground rounded-lg">
          {node.value}
        </Text>
      );
    default:
      return <Text key={key} />;
  }
}

// Heading sizes step down per level; h4-h6 hold at body size and lean on weight/colour so deep headings read as headings without dwarfing the text.
const HEADING_CLASS = {
  1: "font-sans text-2xl font-semibold text-foreground mb-3 mt-2",
  2: "font-sans text-xl font-semibold text-foreground mb-2 mt-2",
  3: "font-sans text-lg font-semibold text-foreground mb-2 mt-2",
  4: "font-sans text-base font-semibold text-foreground mb-2 mt-2",
  5: "font-sans text-sm font-semibold text-foreground mb-1 mt-2",
  6: "font-sans text-sm font-semibold text-muted-foreground mb-1 mt-2",
} as const;

function renderBlock(node: BlockNode, key: number): React.ReactElement {
  switch (node.type) {
    case "paragraph":
      return (
        <Text key={key} className="font-sans text-base text-foreground leading-6 mb-3">
          {node.children.map(renderInline)}
        </Text>
      );
    case "heading":
      return (
        <Text key={key} className={HEADING_CLASS[node.level]}>
          {node.children.map(renderInline)}
        </Text>
      );
    case "list":
      return (
        <View key={key} className="mb-3">
          {node.items.map((item, idx) => (
            <View key={idx} className="flex-row mb-1">
              <Text className="font-sans text-base text-muted-foreground mr-2">•</Text>
              <Text className="font-sans text-base text-foreground flex-1 leading-6">
                {item.map(renderInline)}
              </Text>
            </View>
          ))}
        </View>
      );
    case "orderedList":
      return (
        <View key={key} className="mb-3">
          {node.items.map((item, idx) => (
            <View key={idx} className="flex-row mb-1">
              <Text className="font-sans text-base text-muted-foreground mr-2">
                {`${node.start + idx}.`}
              </Text>
              <Text className="font-sans text-base text-foreground flex-1 leading-6">
                {item.map(renderInline)}
              </Text>
            </View>
          ))}
        </View>
      );
    case "blockquote":
      return (
        <View key={key} className="mb-3 border-l-4 border-border pl-3">
          {node.children.map((child, idx) => renderBlock(child, idx))}
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
        <View
          key={key}
          className="mb-3 rounded-xl border border-border overflow-hidden"
        >
          <View className="flex-row bg-muted">
            {node.headers.map((cell, ci) => (
              <View
                key={ci}
                className={clsx(
                  "flex-1 px-3 py-2",
                  ci > 0 && "border-l border-border",
                )}
              >
                <Text className="font-sans text-base font-semibold text-foreground">
                  {cell.map(renderInline)}
                </Text>
              </View>
            ))}
          </View>
          {node.rows.map((row, ri) => (
            <View key={ri} className="flex-row border-t border-border">
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  className={clsx(
                    "flex-1 px-3 py-2",
                    ci > 0 && "border-l border-border",
                  )}
                >
                  <Text className="font-sans text-base text-foreground leading-6">
                    {cell.map(renderInline)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    default:
      return <View key={key} />;
  }
}

export function Markdown({
  source,
  className,
  testID,
}: MarkdownProps): React.ReactElement {
  const blocks = parseMarkdown(source);
  return (
    <View className={clsx(className)} testID={testID}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </View>
  );
}
