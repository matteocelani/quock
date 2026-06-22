// Chat home route: reads the dynamic segment, brands it as a `ChatId`, and renders <ChatHome>.

import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { ChatHome } from "@/components/chat/ChatHome";
import { asChatId } from "@/lib/types/ids";

export default function ChatRoute(): React.ReactElement {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  if (chatId === undefined || chatId === "") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="font-sans text-muted-foreground">Invalid chat id</Text>
      </View>
    );
  }
  return <ChatHome chatId={asChatId(chatId)} />;
}
