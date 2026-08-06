// Chat module constants — values used only within the chat feature (list, composer, streaming, attachments).

// Message list: bottom inset clears the absolute composer.
export const DEFAULT_BOTTOM_INSET = 96;
export const LIST_DRAW_DISTANCE = 400;
// Streaming auto-follow: re-engage is decided once per gesture at its end. Within CLAMP px of the end the offset is clamped and can't lie, so engagement is unconditional; otherwise the gesture must have a net downward displacement (beyond the dead zone) and finish within the REENGAGE band, sized generously because the bottom keeps running away during a fling over a fast stream.
export const AT_BOTTOM_CLAMP_PX = 16;
export const AT_BOTTOM_REENGAGE_PX = 200;
export const DRAG_NET_DEAD_ZONE_PX = 8;

// Streaming cursor blink: fades to MIN_OPACITY at the trough for a soft pulse, not a hard on/off.
export const STREAMING_CURSOR_DURATION_MS = 540;
export const STREAMING_CURSOR_MIN_OPACITY = 0.25;

// EmptyState fade-in; longer than the standard 180ms so it reads as a hero, not a flash.
export const EMPTY_STATE_FADE_MS = 260;

// Attachments: chip entrance slide + pick-time size cap (20 MB matches the lowest cap among Claude/ChatGPT/Gemini).
export const ATTACHMENT_CHIP_SLIDE_DISTANCE = 14;
export const ATTACHMENT_MAX_BYTES = 20_000_000;
// Per-message total across all attachments: a pile of in-budget files still overflows the request (the cloud stalls on it, the device strains to hold it) even when no single file trips the per-file cap.
export const ATTACHMENT_MAX_TOTAL_BYTES = 20_000_000;
export const BYTES_PER_MB = 1_000_000;
// Photos pickable in one library trip — a handful is plenty, capped so reading many large images into memory at once can't OOM the picker.
export const ATTACHMENT_SELECTION_LIMIT = 8;
// Downscale captured/picked photos before upload: full-resolution images stall the cloud vision model regardless of byte size. 2048px long edge + JPEG recompress keeps detail while staying within model limits.
export const IMAGE_MAX_UPLOAD_DIMENSION = 2048;
export const IMAGE_UPLOAD_COMPRESS = 0.8;
// Wait out the attach sheet's native Modal dismiss before presenting the OS picker; must exceed sheetCloseTail (350)
// or presenting over the still-dismissing Fabric Modal throws "already presenting" and deadlocks the main thread.
export const ATTACH_PICKER_PRESENT_DELAY_MS = 450;
// Text documents (txt/md/csv/json/code) are folded into the message as plain text — cap per-file and
// per-turn characters so a large file can't blow the model context or stall the request.
export const DOCUMENT_TEXT_MAX_CHARS = 100_000;
export const DOCUMENT_TEXT_TOTAL_MAX_CHARS = 200_000;
// Binary sniff: a decoded doc with more than this ratio of U+FFFD chars in its first N chars is rejected as binary.
export const DOCUMENT_BINARY_SNIFF_CHARS = 1000;
export const DOCUMENT_BINARY_REPLACEMENT_RATIO = 0.1;
// Average characters per page below which a PDF's pages ARE pictures (a scan) and the vision half earns its cost; a
// digital document averages thousands and renders nothing. No page-count cap on either half — bytes are the ceiling.
export const PDF_TEXT_THIN_CHARS_PER_PAGE = 100;
// Ceiling on the images REPLAYED across a whole conversation, kept apart from the per-message cap above: every turn
// re-uploads them (the cloud is stateless), so without its own bound one fat turn would tax every turn after it.
export const ATTACHMENT_REPLAY_MAX_BYTES = 20_000_000;
// 2048 / 842pt (A4's long edge): the render lands ON the upload ceiling instead of 57px past it, so the resize pass —
// which decodes and redraws the whole page just to shave those pixels — never runs for A4 or Letter.
export const PDF_PAGE_RENDER_SCALE = 2.43;
// Filenames a failure toast spells out before falling back to "and N more": its body is clamped to two lines, and a
// third name pushes the count past what fits.
export const TOAST_MAX_NAMED_FILES = 2;
// Pages of a SCAN that get rendered and read. A scan costs a render plus a recognition per page — around a second each
// — so this bounds the wait, not the payload; a document that reads as text has no cap at all.
export const PDF_OCR_MAX_PAGES = 30;

// ThinkingDots cadence: each dot loops opacity over DURATION_MS with STAGGER_MS lag so the trio reads as a wave.
export const THINKING_DOT_DURATION_MS = 900;
export const THINKING_DOT_STAGGER_MS = 140;
export const THINKING_DOT_MIN_OPACITY = 0.3;

// Composer: send/stop icon cross-fade window and visible-rows cap (8 = Telegram-style sweet spot) before the TextField starts scrolling internally. Line height lives in componentLayout.composer.inputLineHeight — one home.
export const COMPOSER_SEND_MORPH_DURATION_MS = 200;
export const COMPOSER_MAX_LINES = 8;

// Sheet snap points owned by the chat feature.
export const ATTACH_SHEET_SNAP = "25%" as const;
// Taller snap when the model exposes tool toggles (web search, thinking) so the Tools section clears the safe area — 37% covers the sheet card's internal home-indicator padding on 812-874pt devices (33% left the second tool row ~15pt inside the safe-area band).
export const ATTACH_SHEET_SNAP_WITH_TOOLS = "37%" as const;
// Web search: results per query (Ollama default 5, max 10) and a ceiling on agentic tool rounds so a misbehaving model can't loop forever.
export const WEB_SEARCH_MAX_RESULTS = 5;
export const WEB_SEARCH_MAX_TOOL_ROUNDS = 4;
export const CHAT_HISTORY_SHEET_SNAP = "75%" as const;
// Select-text sheet: tall so a long reply is comfortable to read and select.
export const SELECT_TEXT_SHEET_SNAP = "85%" as const;

// Streaming + cache throttles: coalesce React patches to ~60Hz and disk writes to 200ms.
export const REACT_FLUSH_MS = 16;
export const DB_FLUSH_MS = 200;
export const CHATS_STALE_TIME_MS = 30 * 1000;

// User message bubble entrance: translateY start, fade window, and freshness window during which the spring fires.
export const USER_MESSAGE_ENTER_TRANSLATE_Y = 8;
export const USER_MESSAGE_ENTER_FADE_MS = 200;
export const USER_MESSAGE_FRESH_WINDOW_MS = 1500;

// Inline editor visible-rows cap for editing a user message — large enough for a paragraph, capped so a long message does not push surrounding chat off-screen.
export const USER_MESSAGE_EDIT_MAX_LINES = 6;

// First-message preview used to auto-title a brand-new chat in the sidebar list.
export const CHAT_AUTO_TITLE_MAX_CHARS = 60;

// Excerpt spotlight rim: one lap of the edge light. Slow enough to read as drift, and long enough that a menu open for
// two or three seconds never shows the light repeat.
export const EXCERPT_GLOW_LAP_MS = 3200;
