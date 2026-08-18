// Empty state for the model picker when a search or a capability filter leaves nothing to pick.

import React from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";

export interface NoModelMatchesProps {
  query: string;
  // Human labels of the active capability filters, already resolved by the picker.
  activeLabels: readonly string[];
  onReset: () => void;
}

// Names the reason the list is empty. With a query and two filters in play, "no matches" leaves the user guessing which
// one to undo — and the likeliest culprit is Thinking, which only a single cloud model lacks.
export function describeNoModelMatches(
  query: string,
  activeLabels: readonly string[],
): string {
  const capability =
    activeLabels.length > 1
      ? `${activeLabels[0]} and ${activeLabels[1]}`
      : activeLabels[0];
  const needle = query.trim();
  if (needle && capability !== undefined) {
    return `No model named “${needle}” also does ${capability}.`;
  }
  if (needle) return `No model is named “${needle}”.`;
  if (capability !== undefined) return `No cloud model does ${capability}.`;
  return "Nothing to show.";
}

// Same register as the chat list's own search-empty state, deliberately two tiers below the 22pt iOS empty state: that
// one owns a whole screen, this one sits under a header, a search field and two filters.
export function NoModelMatches({
  query,
  activeLabels,
  onReset,
}: NoModelMatchesProps): React.ReactElement {
  return (
    <View className="items-center px-4 py-10">
      <Text className="font-sans font-semibold text-body text-foreground text-center mb-1">
        No models match
      </Text>
      <Text className="font-sans text-footnote text-muted-foreground text-center">
        {describeNoModelMatches(query, activeLabels)}
      </Text>
      <View className="pt-4">
        <Button variant="secondary" size="md" onPress={onReset}>
          Show all models
        </Button>
      </View>
    </View>
  );
}
