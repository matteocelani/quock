// Paints the answer at a steady pace instead of the network's: tokens arrive in clumps, and painting each clump the
// instant it lands is what makes a stream stutter. A small backlog spent evenly costs some lag and buys a legible flow.

import { useEffect, useRef, useState } from "react";
import {
  STREAM_REVEAL_CHARS_PER_SEC,
  STREAM_REVEAL_MAX_LAG_MS,
} from "@/modules/chat/constants";

const MS_PER_SECOND = 1000;

export function useRevealedContent(
  content: string,
  isStreaming: boolean,
): string {
  const [revealed, setRevealed] = useState<number>(content.length);
  const lastTick = useRef<number>(0);

  useEffect(() => {
    if (!isStreaming) {
      setRevealed(content.length);
      return;
    }
    // One loop for the whole stream, not one per frame: `revealed` is deliberately NOT a dependency, or every character
    // painted would tear the loop down and build a new one.
    let frame = 0;
    lastTick.current = Date.now();
    const step = (): void => {
      const now = Date.now();
      const elapsed = now - lastTick.current;
      lastTick.current = now;
      setRevealed((prev) => {
        const backlog = content.length - prev;
        // Caught up: returning the same value makes React bail out, so a silent model costs no renders at all.
        if (backlog <= 0) return prev;
        // Never let the backlog become a wait: a burst bigger than the steady rate can drain is spent faster, so the
        // screen is at most one lag-window behind what the model has actually said.
        const rate = Math.max(
          STREAM_REVEAL_CHARS_PER_SEC,
          (backlog * MS_PER_SECOND) / STREAM_REVEAL_MAX_LAG_MS,
        );
        return Math.min(
          content.length,
          prev + Math.ceil((rate * elapsed) / MS_PER_SECOND),
        );
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [content, isStreaming]);

  // A shorter content means this row is rendering a different turn; follow it rather than slice against a stale index.
  if (revealed > content.length) return content;
  return isStreaming ? content.slice(0, revealed) : content;
}
