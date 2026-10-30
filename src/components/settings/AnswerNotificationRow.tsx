// The "Answer notifications" row in Settings. Renders nothing where the native module is absent, so Android never
// shows a switch that does nothing.

import Bell from "lucide-react-native/icons/bell";
import React from "react";
import { ListRow } from "@/components/ui/ListRow";
import { Switch } from "@/components/ui/Switch";
import { isAnswerNotificationSupported } from "@/modules/chat/lib/answerNotification";
import { useAnswerNotificationSetting } from "@/modules/settings/hooks/useAnswerNotificationSetting";

function AnswerNotificationRowImpl(): React.ReactElement | null {
  const { isEnabled, onChange } = useAnswerNotificationSetting();
  if (!isAnswerNotificationSupported) return null;
  return (
    <ListRow
      icon={Bell}
      label="Answer notifications"
      trailing={<Switch value={isEnabled} onValueChange={onChange} />}
    />
  );
}

export const AnswerNotificationRow = React.memo(AnswerNotificationRowImpl);
