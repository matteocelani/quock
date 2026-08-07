// True when a stream is open but nothing has arrived for a moment. The exact reasoning flag says WHAT the model is
// doing; this says that it is doing none of it visibly — the tool round-trip, the pause before a decision, the dead air
// the user reads as a freeze. Together they cover every moment between "sent" and "answered".

import { useEffect, useRef, useState } from "react";
import { STREAM_SILENCE_MS } from "@/modules/chat/constants";

export function useIsStreamSilent(
  isStreaming: boolean,
  // Everything the turn has produced so far; its length changing is the only proof a token landed.
  produced: number,
): boolean {
  const [isSilent, setIsSilent] = useState<boolean>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (!isStreaming) {
      setIsSilent(false);
      return;
    }
    // Every landed token restarts the clock, so mid-answer typing never trips it.
    setIsSilent(false);
    timer.current = setTimeout(() => setIsSilent(true), STREAM_SILENCE_MS);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [isStreaming, produced]);
  return isSilent;
}
