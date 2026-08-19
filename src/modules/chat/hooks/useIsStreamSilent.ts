// True when a stream is open but nothing has arrived for a moment. The reasoning flag says WHAT the model is doing;
// this covers the dead air a user reads as a freeze — the tool round-trip, the pause before a decision.

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
