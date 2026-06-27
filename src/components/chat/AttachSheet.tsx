// Composer + hub: attachment tiles (Camera, Photo, File) plus the model's tool toggles (web search, thinking).

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback } from "react";
import { Text, View } from "react-native";
import type {
  UiAttachment,
  UiAttachmentInvalidReason,
} from "@/modules/chat/types";
import {
  Brain,
  FileText,
  Globe,
  Image as ImageIcon,
  X,
} from "lucide-react-native";
import { isImageMime, isTextDocument } from "@/modules/chat/lib/documentText";
import { readUriAsBytes } from "@/modules/chat/lib/imageUpload";
import { useToast } from "@/lib/hooks/useToast";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { AttachTile, ToolRow } from "@/components/chat/AttachSheetRows";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import {
  useHasThinkingCapability,
  useHasToolsCapability,
} from "@/modules/models/hooks/useModelCapabilities";
import { useChatComposerModes } from "@/modules/chat/hooks/useChatComposerModes";
import type { ChatId } from "@/lib/types/ids";
import {
  ATTACH_PICKER_PRESENT_DELAY_MS,
  ATTACH_SHEET_SNAP,
  ATTACH_SHEET_SNAP_WITH_TOOLS,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_SELECTION_LIMIT,
} from "@/modules/chat/constants";

export interface AttachSheetProps {
  visible: boolean;
  onClose: () => void;
  // Reopens the sheet when the user cancels the OS picker — handlers close + wait out the dismiss before presenting, so a cancel needs to bring the sheet back.
  onReopen?: () => void;
  onAttach: (file: UiAttachment) => void;
  // Attachments already on the composer draft — handlers cap new picks against this so the running total never exceeds ATTACHMENT_SELECTION_LIMIT (selectionLimit only bounds a single pick session).
  currentCount: number;
  chatId: ChatId;
}
// Promise-based sleep so a handler can wait out an animation (the sheet dismiss) before the next step.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveFilename(uri: string, fallback: string): string {
  const trimmed = uri.split("?")[0] ?? uri;
  const last = trimmed.split("/").pop();
  return last && last.length > 0 ? last : fallback;
}
// Runs at pick time so the chip carries the verdict and Composer can disable Send without a wire round-trip.
function validateAttachment(
  sizeBytes: number,
  mimeType: string | undefined,
  filename: string,
): UiAttachmentInvalidReason | null {
  if (sizeBytes > ATTACHMENT_MAX_BYTES) return "too_large";
  // Images ride the vision path; text/code docs are inlined on send. Everything else (pdf/docx/binary) is unsupported.
  if (isImageMime(mimeType) || isTextDocument(mimeType, filename)) return null;
  return "unsupported_type";
}
// Monotonic per-session counter for unique attachment ids — survives duplicate-file picks (same uri).
let attachmentSeq = 0;
// Lifts validateAttachment into the chip shape the UI consumes. `data` is OPTIONAL: optimistic images omit it and
// carry original dimensions for the deferred send-time downscale; text docs pass their bytes in at attach.
function buildAttachment(
  base: {
    filename: string;
    uri: string;
    data?: Uint8Array;
    mimeType?: string;
    originalWidth?: number;
    originalHeight?: number;
  },
  sizeBytes: number,
): UiAttachment {
  const invalidReason = validateAttachment(
    sizeBytes,
    base.mimeType,
    base.filename,
  );
  const payload: UiAttachment = {
    id: `att-${(attachmentSeq += 1)}`,
    filename: base.filename,
    uri: base.uri,
    sizeBytes,
    status: invalidReason !== null ? "invalid" : "ready",
  };
  if (base.data !== undefined) payload.data = base.data;
  if (base.mimeType !== undefined) payload.mimeType = base.mimeType;
  if (base.originalWidth !== undefined)
    payload.originalWidth = base.originalWidth;
  if (base.originalHeight !== undefined)
    payload.originalHeight = base.originalHeight;
  if (invalidReason !== null) payload.invalidReason = invalidReason;
  return payload;
}

export function AttachSheet({
  visible,
  onClose,
  onReopen,
  onAttach,
  currentCount,
  chatId,
}: AttachSheetProps): React.ReactElement {
  const toast = useToast();
  const { model } = useChatModel(chatId);
  const hasThinking = useHasThinkingCapability(model?.name);
  const hasWebSearch = useHasToolsCapability(model?.name);
  const hasTools = hasThinking || hasWebSearch;
  const { thinkEnabled, webSearchEnabled, setThinkEnabled, setWebSearchEnabled } =
    useChatComposerModes(chatId);
  // Close the sheet, wait out its native-modal dismiss, THEN present the OS picker — iOS silently drops a present that overlaps a dismiss, so the picker must open after the sheet is gone. A real pick then lands straight in the chat (no flap); a cancel reopens the sheet.
  const handleCamera = useCallback(async (): Promise<void> => {
    if (currentCount >= ATTACHMENT_SELECTION_LIMIT) {
      toast({
        title: `You can attach up to ${ATTACHMENT_SELECTION_LIMIT} images`,
        tone: "error",
      });
      return;
    }
    onClose();
    await delay(ATTACH_PICKER_PRESENT_DELAY_MS);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        console.warn("AttachSheet: camera permission denied");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled) {
        onReopen?.();
        return;
      }
      const asset = result.assets[0];
      if (!asset) return;
      // Optimistic attach: record the ORIGINAL captured uri + dimensions so the chip paints immediately; the
      // downscale + byte read defer to send so they never block a mid-attach remove. sizeBytes is the estimate (or 0).
      onAttach(
        buildAttachment(
          {
            filename: asset.fileName ?? deriveFilename(asset.uri, "camera.jpg"),
            uri: asset.uri,
            originalWidth: asset.width,
            originalHeight: asset.height,
            ...(asset.mimeType !== undefined ? { mimeType: asset.mimeType } : {}),
          },
          asset.fileSize ?? 0,
        ),
      );
    } catch (err) {
      console.error("AttachSheet: camera failed", err);
    }
  }, [currentCount, onAttach, onClose, onReopen, toast]);
  const handlePhoto = useCallback(async (): Promise<void> => {
    // Cap the picker to slots left on the running total — selectionLimit only bounds one pick session, so reopening the sheet would otherwise stack past the cap.
    const remaining = ATTACHMENT_SELECTION_LIMIT - currentCount;
    if (remaining <= 0) {
      toast({
        title: `You can attach up to ${ATTACHMENT_SELECTION_LIMIT} images`,
        tone: "error",
      });
      return;
    }
    onClose();
    await delay(ATTACH_PICKER_PRESENT_DELAY_MS);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        console.warn("AttachSheet: photo library permission denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // Pick several photos in one trip instead of reopening the sheet per image; the OS picker handles the multi-select + confirm UI.
        allowsMultipleSelection: true,
        // Remaining slots only — never 0 (guarded above); expo-image-picker treats selectionLimit 0 as UNLIMITED.
        selectionLimit: remaining,
        quality: 0.85,
        // iPhone photos are HEIC; the Ollama Cloud gateway sniffs the bytes and rejects HEIC as
        // "application/octet-stream". 'compatible' makes iOS transcode to JPEG so the gateway accepts it.
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) {
        onReopen?.();
        return;
      }
      // Optimistic attach: one chip per picked photo with its ORIGINAL uri + dimensions; defer the downscale +
      // byte read to send so a mid-attach remove still paints. sizeBytes is the picker's fileSize estimate (or 0).
      for (const asset of result.assets) {
        onAttach(
          buildAttachment(
            {
              filename: asset.fileName ?? deriveFilename(asset.uri, "photo.jpg"),
              uri: asset.uri,
              originalWidth: asset.width,
              originalHeight: asset.height,
              ...(asset.mimeType !== undefined
                ? { mimeType: asset.mimeType }
                : {}),
            },
            asset.fileSize ?? 0,
          ),
        );
      }
    } catch (err) {
      console.error("AttachSheet: photo library failed", err);
    }
  }, [currentCount, onAttach, onClose, onReopen, toast]);
  const handleFile = useCallback(async (): Promise<void> => {
    if (currentCount >= ATTACHMENT_SELECTION_LIMIT) {
      toast({
        title: `You can attach up to ${ATTACHMENT_SELECTION_LIMIT} images`,
        tone: "error",
      });
      return;
    }
    onClose();
    await delay(ATTACH_PICKER_PRESENT_DELAY_MS);
    try {
      // Accept any type; the chip itself flags unsupported mimes and Composer disables Send.
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        onReopen?.();
        return;
      }
      const asset = result.assets[0];
      if (!asset) return;
      const bytes = await readUriAsBytes(asset.uri);
      onAttach(
        buildAttachment(
          {
            filename: asset.name,
            uri: asset.uri,
            data: bytes,
            ...(asset.mimeType !== undefined ? { mimeType: asset.mimeType } : {}),
          },
          bytes.byteLength,
        ),
      );
    } catch (err) {
      console.error("AttachSheet: document picker failed", err);
    }
  }, [currentCount, onAttach, onClose, onReopen, toast]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoints={[hasTools ? ATTACH_SHEET_SNAP_WITH_TOOLS : ATTACH_SHEET_SNAP]}
      enableDynamicSizing={false}
    >
      <SheetHeader
        title=""
        right={
          <IconButton
            icon={X}
            onPress={onClose}
            accessibilityLabel="Close"
            tone="muted"
          />
        }
      />
      <View className="flex-row justify-around px-6 pt-1 pb-2">
        <AttachTile
          icon={ImageIcon}
          label="Camera"
          onPress={(): void => {
            handleCamera().catch((err: unknown) => {
              console.error("AttachSheet: camera handler crashed", err);
            });
          }}
        />
        <AttachTile
          icon={ImageIcon}
          label="Photo"
          onPress={(): void => {
            handlePhoto().catch((err: unknown) => {
              console.error("AttachSheet: photo handler crashed", err);
            });
          }}
        />
        <AttachTile
          icon={FileText}
          label="File"
          onPress={(): void => {
            handleFile().catch((err: unknown) => {
              console.error("AttachSheet: file handler crashed", err);
            });
          }}
        />
      </View>
      {hasTools ? (
        <View className="pt-1">
          <Text className="font-mono uppercase text-muted-foreground text-xs tracking-widest mb-1 px-6">
            Tools
          </Text>
          {hasWebSearch ? (
            <ToolRow
              icon={Globe}
              label="Web search"
              selected={webSearchEnabled}
              onToggle={(): void => setWebSearchEnabled(!webSearchEnabled)}
            />
          ) : null}
          {hasThinking ? (
            <ToolRow
              icon={Brain}
              label="Thinking"
              selected={thinkEnabled}
              onToggle={(): void => setThinkEnabled(!thinkEnabled)}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
