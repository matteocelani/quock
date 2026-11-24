// Warms the chat's on-device model while the user is still typing: on an iPhone the first message otherwise waits
// seconds for the model to load and its GPU kernels to be built. Does nothing for cloud models or one not downloaded.

import { useEffect } from "react";
import { prepareOnDeviceModel } from "@/lib/onDevice/onDeviceLLM";

export function usePrepareOnDeviceModel(modelName: string | undefined): void {
  useEffect(() => {
    if (!modelName) return;
    prepareOnDeviceModel(modelName).catch((err: unknown) => {
      // Best effort: a failure here (low memory, say) surfaces again, with its message, when the user sends.
      console.warn("usePrepareOnDeviceModel: prepare failed", err);
    });
  }, [modelName]);
}
