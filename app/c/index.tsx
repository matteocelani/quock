// New chat entry — creates a chat row and replaces with `/c/[newChatId]` so `/c` never sits in the back stack.

import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { timingsNamed } from "@/lib/design/tokens";
import { useCreateChat } from "@/modules/chat/hooks/useCreateChat";

export default function NewChatRoute(): React.ReactElement {
  const router = useRouter();
  const { mutateAsync } = useCreateChat();
  const [shouldShowSpinner, setShouldShowSpinner] = React.useState(false);
  const [hasFailed, setHasFailed] = React.useState(false);
  // Guard against React 19 strict-mode double-invocation re-firing the mutation.
  const startedRef = React.useRef(false);
  const createChat = React.useCallback(async (): Promise<void> => {
    setHasFailed(false);
    try {
      // A new chat is created with a NULL model column, so it follows the user's global default until they pin one; no carry-over from the previous chat to clear.
      const newChatId = await mutateAsync();
      router.replace(`/c/${newChatId}`);
    } catch (err) {
      console.error("useCreateChat failed", err);
      // Don't navigate: `/c` is the creator route and `/` redirects back to it, so either would strand the user.
      // Surface a retry affordance instead; the toast layer still reports the error via TanStack onError.
      setHasFailed(true);
    }
  }, [mutateAsync, router]);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void createChat();
  }, [createChat]);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShouldShowSpinner(true);
    }, timingsNamed.routeSpinnerDefer);
    return () => clearTimeout(timer);
  }, []);
  if (hasFailed) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
        <Text className="text-center text-base text-foreground">
          Couldn&apos;t start a new chat.
        </Text>
        <Button variant="primary" onPress={() => void createChat()}>
          Try again
        </Button>
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center bg-background">
      {shouldShowSpinner ? <Spinner /> : null}
    </View>
  );
}
