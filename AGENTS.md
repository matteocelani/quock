# AGENTS.md — Quock

Single source of truth for any AI coding agent operating on this repository (Claude Code, Cursor, Codex, Gemini, Aider, Continue, …). `CLAUDE.md` is a 1-line shim that points here. Slash command procedures live in `.agent/commands/{commit,pr,code-review}.md` and read this file at the start of every iteration.

---

## Project

Quock is a community-built mobile client for **Ollama Cloud**. React Native + Expo, iOS + Android. The user signs in with an `ollama.com` account, picks a cloud-hosted model, and chats with streaming responses. Conversations persist locally in SQLite — the cloud only sees the message currently in flight.

Quock is **not affiliated with Ollama, Inc.** It is an unofficial third-party client, distributed under MIT with the original Ollama copyright preserved.

**Design north star**: open the app → tap a model → type → streamed response, in under three taps from home.

---

## Reading order (mandatory, every task)

Working memory is not persistent across tasks. Re-read at the start of every iteration:

1. This file end-to-end.
2. The file the task touches end-to-end, plus its immediate consumers (`grep -rn "SymbolName"`).
3. The slash command procedure when invoking `/commit`, `/pr`, or `/review` — `.agent/commands/{commit,pr,code-review}.md`.

When a rule is missing, contradictory, or silent on the exact question, surface the gap and ask the human. Do not guess.

---

## Quick start prompt

Copy-paste into any AI dev tool to onboard it:

```
You are the sequential AI dev for Quock, an unofficial React Native + Expo client for Ollama Cloud.

Rules:
1. Read AGENTS.md end-to-end before writing code.
2. Branch from `develop`, never from `main`. One feature → one branch → multi-commit → one PR into `develop` → STOP, wait for human merge.
3. Run /review (.agent/commands/code-review.md) before /pr — it is iterative and resets after every fix.
4. Add the assisting AI tool's `Co-Authored-By` trailer to commits it makes (and its attribution footer to PR bodies) — AI-authored work must stay traceable.
5. English in code, commits, PR bodies. Italian / other languages are fine in conversation only.
```

---

## The 5 non-negotiables

1. **Brand neutrality.** App, README, LICENSE, and About screen state that Quock is not affiliated with Ollama, Inc. The Ollama logo and mascot are never used inside Quock.
2. **MIT dual copyright preserved.** `LICENSE` keeps `Copyright (c) 2026 Matteo Celani` first and `Copyright (c) Ollama` second — never remove the Ollama line.
3. **Cloud-only target.** Backend is `ollama.com`. No localhost discovery, no `/api/tags`, no paired-desktop mode. If a feature requires a local runtime, it does not ship.
4. **Ed25519 device keypair auth.** Every API call is signed via `signRequest()` in `src/modules/auth/lib/sign.ts`. Seed lives in `expo-secure-store` only. No OAuth, password, cookie, JWT.
5. **The design system is owned in-repo.** No external design or UI libraries — every surface, primitive, and motion in Quock is built from `GlassOrb`, `Sheet`, `Button`, `Pressable`, the design tokens in `src/lib/design/`, and the Tailwind theme. Any new npm package requires explicit approval; justify it in the PR description.

---

## Tech stack (locked)

Expo SDK 55 (New Architecture, Fabric, TurboModules) · React 19 + React Native 0.83.6 · Expo Router · NativeWind v4 + Tailwind v3 · TanStack Query 5 · react-native-reanimated 4 + react-native-worklets · `@shopify/flash-list` · `expo-sqlite` · `expo-secure-store` · `react-native-mmkv` · `expo/fetch` (streaming) · `tweetnacl` (Ed25519) · `expo-blur` · `expo-linear-gradient` + `@react-native-masked-view/masked-view` (gradient blur masks behind the floating header / composer) · `zustand` 5 · `react-native-keyboard-controller` · `react-native-gesture-handler` v2.

**Banned (categorical)**: any third-party design / UI / component library (we own the design system) · Redux · Jotai · Recoil · axios · moment / dayjs (use `Intl.*`) · `@gorhom/bottom-sheet` (fails silently on iOS Fabric — we use our own `<Sheet>`) · native `<FlatList>` for messages · RN `Animated.*` legacy · `<TouchableOpacity>` (use `<Pressable>`).

---

## Getting started

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm start` | Metro bundler |
| `pnpm ios` | Build + open iOS simulator |
| `pnpm android` | Build + open Android emulator |
| `pnpm prebuild` | Regenerate native `ios/` + `android/` projects |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Build gate (see below) |

> **First run.** Needs **pnpm 11+** — Metro's hoist settings live in `pnpm-workspace.yaml` (not `.npmrc`, which pnpm 11 ignores).
> **On a physical device**, enable iOS **Developer Mode** (Settings → Privacy & Security) or Android **USB debugging** (Developer options) first, then `pnpm ios --device` / `pnpm android --device` — otherwise the app installs but won't launch.

**When the build breaks**, run in order: `pnpm start --reset-cache`, then `watchman watch-del-all && rm -rf ~/Library/Developer/Xcode/DerivedData/*`, then `cd ios && bundle exec pod install`.

---

## Repository structure

```
app/                      Expo Router routes (repo ROOT, not src/) — every file is a route, no components.
codegen/                  Generated Go type mirror (gotypes.gen.ts), imported as @/gotypes. Never hand-edit.
assets/                   Static app resources (app.json icons, splash, doc PDFs). In-app SVG icons live in src/assets/icons/.
src/
  modules/<feature>/      Feature business logic: hooks/, stores/, api/, lib/, context/, types.ts, constants.ts.
  components/             UI only — ui/ (primitives), <feature>/ (feature UI), layout/, global/.
  lib/                    Infra shared by 2+ modules: api/, db/, design/, contexts/, theme/, stores/, hooks/, constants/, types/.
```

Features today: `chat`, `auth`, `models`, `settings`.

**Placement rule.** Used by 2+ modules → `src/lib/` (or `components/ui/` for a primitive). Used by one module → inside that module. Used by one file → named constant at top of that file. When a module-local unit gets a second consumer, promote it in the same PR.

**Threshold rule.** 1 item → flat file (`hooks.ts`, `types.ts`). 2+ items → folder (`hooks/`, `types/`). No empty folders. No stub files "for the future" — the structure grows as features land, not in anticipation.

---

## Where to find what

| Topic | Canonical file |
| --- | --- |
| API client + Ed25519 signing | `src/lib/api/client.ts` · `src/modules/auth/lib/sign.ts` |
| API errors | `src/lib/api/errors.ts` |
| Streaming wire shape (chat) | `src/modules/chat/api/chat.ts` |
| Streaming pipeline (buffers, abort) | `src/modules/chat/lib/streamPipeline.ts` |
| Repository pattern | `src/lib/db/chatRepository.ts` · `messageRepository.ts` · `attachmentRepository.ts` |
| DB schema | `src/lib/db/schema.ts` |
| Branded ID types | `src/lib/types/ids.ts` |
| Design tokens (numeric) | `src/lib/design/tokens.ts` |
| Spring configs | `src/lib/design/motion.ts` |
| Color palette + semantic layer | `src/lib/design/colors.cjs` |
| Theme context | `src/lib/theme/ThemeContext.tsx` |
| Query keys factory | `src/lib/hooks/queryKeys.ts` |
| Zustand store pattern | `src/lib/stores/ui.store.ts` |
| Persistent store (MMKV) | `src/lib/stores/settings.store.ts` |
| Sheet primitive (gesture, overlays slot) | `src/components/ui/Sheet.tsx` |
| GlassOrb / Button primitives | `src/components/ui/{GlassOrb,Button}.tsx` |
| Markdown parser (LLM-defensive) | `src/components/ui/markdown/parseMarkdown.ts` |
| Floating header pattern | `src/components/layout/FloatingHeader.tsx` |
| Magic number registry (shared) | `src/lib/constants/magic-numbers.ts` |

---

## How to add things

| Task | Pattern |
| --- | --- |
| New feature | `src/modules/<feature>/` (logic) + `src/components/<feature>/` (UI). Never scatter across the tree. |
| New server-state hook | `src/modules/<feature>/hooks/use<X>.ts`. Use `queryKeys.<x>(…)` from `@/lib/hooks/queryKeys`, never inline arrays. Components consume the hook — never call `useQuery` directly. |
| New repository method | Extend the relevant file in `src/lib/db/`. SQLite repos are native-module surfaces covered by Maestro E2E on device (see §Testing), not a Jest test; add a unit test only for any pure helper extracted alongside. |
| New sheet | Compose `<Sheet>` + `<SheetHeader>`. Mount unconditionally as a sibling of chat home; visibility is a prop, not a conditional render. |
| Dialog centered against the display, not the sheet | Pass it via the `overlays` slot of `<Sheet>` — otherwise an `absolute inset-0` dialog centers against the sheet body. |
| Labeled CTA (Cancel, Confirm, Sign Out, Upgrade, …) | `<Button>` with the matching variant. Never compose raw `<Pressable bg-X rounded-full>`. |
| Icon-only floating button | `<GlassOrb interactive>` with `borderRadius={999}`. |
| New magic number | Module-local → `src/modules/<feature>/constants.ts`. Shared by 2+ modules → `src/lib/constants/magic-numbers.ts`. Never inline. |
| New design value (color, spacing, motion) | Extend one of the three design files (`colors.cjs`, `tailwind.config.js`, `tokens.ts`). Never inline at the use-site. |

---

## Code rules

### TypeScript

- No `any`. Use `unknown` + type guard if a type is truly unknown.
- Explicit return types on every exported function, hook, component.
- `interface` for object shapes (props, API payloads, entities); `type` for unions, intersections, branded, derived.
- Branded IDs from `src/lib/types/ids.ts` (`ChatId`, `MessageId`, `AttachmentId`) — never raw `number` / `string`. Brand via `asChatId()`, `asMessageId()`.
- `as const` for fixed configuration arrays and objects.
- Never mutate state, props, arrays, or objects in place — spread, `map`, `filter`.

### Imports & paths

- All imports use absolute `@/*` paths, including same-folder. Zero relative imports outside auto-generated code.
- No barrel `index.ts` files. Import directly from the source file.
- Never invent or import packages not in `package.json`.
- Import order: external packages → `@/gotypes` → `@/*`. No blank lines between groups.

### Comments

- English only.
- 1-2 lines max per comment.
- Explain WHY, not WHAT.
- Prohibited: bullets, numbered lists, `-`/`*` list markers, decorative dividers (`// ── XYZ ──`), ASCII art, multi-paragraph blocks. Em-dash punctuation (`X — Y`) in prose is fine.
- Default to no comment unless the WHY is non-obvious.

### Naming

- Components `PascalCase`. Hooks `camelCase` starting with `use`. Utilities `camelCase`. Constants `UPPER_SNAKE_CASE`. Type aliases `PascalCase`.
- Booleans prefix `is`, `has`, `should`, or `can`.

### Styling (NativeWind v4)

- NativeWind classes for layout, color, spacing, typography. Inline `style={{}}` only for `useAnimatedStyle` results or measured numeric values.
- No arbitrary Tailwind values (`w-[50px]`, `text-[13px]`, `bg-[#xxx]`). Use the scale or extend `tailwind.config.js`.
- Semantic color classes (`bg-card`, `text-muted-foreground`) or `useThemeColors()` — never palette accessors (`gray2`), never inline hex.
- `clsx` for dynamic class merges — never template strings.
- **Tailwind-first scale.** Use stock Tailwind classes for fonts, spacing, tracking, radii. Never redefine a stock name with a different value, and never add a custom tier that's a synonym for a value a stock class already renders. NativeWind inlines `rem` at **14px** here (metro default, not overridden), so a stock class renders at 0.875× its web px — e.g. `text-xs` = 10.5px, `rounded-lg` = 7px. A custom px tier is allowed only where stock genuinely lacks a step a layout needs (e.g. `p-4.5` = 18px). `tokens.ts` holds only axes Tailwind can't express (icons, shadows, z-layers, motion, per-component layout) — one home per value, no synonyms.

### Components & React

- Named exports everywhere except Expo Router files (`app/_layout.tsx`, `app/index.tsx`, `app/[route].tsx`).
- `React.memo` wrapped: `export const X = React.memo(...)`. Never `export default React.memo(...)`.
- No `React.FC` / `React.FunctionComponent`. Type props directly.
- Hooks consuming React Context throw a clear error outside their Provider.
- Component file size: indicative ≤ 300 lines. Split only on a clean logical seam.

### Animations (Reanimated 4)

- Reanimated 4 worklets only. No RN `Animated.*` legacy.
- Spring configs from `src/lib/design/motion.ts` (`pressSpring`, `surfaceSpring`, `toggleSpring`, `sheetSpring`). Never hand-roll damping / stiffness.
- `useAnimatedStyle` results only on `Animated.*` components — never on `<View>` / `<Text>`.
- `useSharedValue` for JS-side values consumed by worklets — never closure capture.

### State

State is chosen by **persistence** and **scope**. Pick the bucket from the table — never duplicate the same piece of state across two buckets.

| Bucket | Tool | When |
| --- | --- | --- |
| Server state | TanStack Query, via `src/modules/<feature>/hooks/` | Anything originating from `ollama.com` (chats, messages, models, capabilities). Never `useQuery` / `useMutation` in components. Keys via `queryKeys.*` factory. |
| Volatile UI state | Zustand, one store per domain | Streaming chunks, sheet visibility, toast queue. Global in `src/lib/stores/`, feature in `src/modules/<feature>/stores/`. Never a mega-store. |
| Persistent prefs | Zustand + `persist` middleware (MMKV) | Theme, default model, haptics. `src/lib/stores/settings.store.ts`. Volatile stores never persist. |
| Persistent data | SQLite via repositories in `src/lib/db/` | Chat rows, message rows, attachments. No SQL outside repositories. |
| DI singletons | React Context (`ApiContext`, `DbContext`, `AuthContext`) | Wrap instances, not state. |
| Ephemeral | `useState` | Draft text, open / close, hover, focus. |

**State anti-patterns** (refuse on review):

- Duplicating server data in `useState` or Zustand — the cache is truth, refetch on mutation.
- Mirroring a TanStack Query cache into Zustand — use a TQ `select` or a custom hook.
- Global Context for ephemeral UI state — `useState` is the answer.
- Scattered `isLoading` / `isError` / `data` shadowing TanStack Query's own status fields.
- `useReducer` for simple toggles — `useState`.

### Zustand discipline

- Never `useXStore()` without a selector — whole-store subscriptions cause re-render storms.
- Object selectors require `useShallow` from `zustand/react/shallow`.
- Actions live inside the store. Never mutate via `set` from outside the store file.
- Never mirror a TanStack Query cache into Zustand. Use a TQ `select` or a custom hook instead.
- MMKV adapter only stores plain JSON-serializable values. Never persist React refs, functions, or SQLite rows.

### API & data access

- Components never call `fetch` directly. Go through `@/lib/api/client.ts` + `src/modules/<feature>/api/`.
- Use `expo/fetch` for streaming — global `fetch` has `response.body === null` on iOS.
- All API errors flow through `CloudAPIError` in `@/lib/api/errors`.
- Components never open SQLite directly — use a repository.
- Components never read SecureStore or MMKV directly — wrap in a hook (`useAuth`, `useSettingsStore`, …).

### Hook naming

Server-state hooks in `src/modules/<feature>/hooks/` follow a semantic prefix so a reader knows the lifecycle at a glance:

| Prefix | Meaning | Example |
| --- | --- | --- |
| `useGet*` | Single fetch | `useGetChat(id)` |
| `useList*` | List / paginated fetch | `useListChats()` |
| `useInfinite*` | Infinite scroll | `useInfiniteMessages(chatId)` |
| `useCreate*` | Create mutation | `useCreateChat()` |
| `useUpdate*` | Update mutation | `useUpdateChatTitle(id)` |
| `useDelete*` | Delete mutation | `useDeleteChat(id)` |
| `useSend*` | Streaming / fire-and-forget action | `useSendMessage(chatId)` |
| `usePrefetch*` | Hover / intent prefetch | `usePrefetchChat(id)` |

Non-server hooks (theme, haptics, keyboard state) keep plain `useX` names.

### Errors & logging

- Never swallow errors silently. `try { } catch (e) {}` is prohibited.
- Re-throw with cause preserved: `throw new Error("Action failed", { cause: error });`.
- Surface user-facing failures via `Toast` / `Banner` primitives OR the `status: 'error'` lifecycle on the message row.
- No `console.log`. Allowed: `console.error`, `console.warn`, `console.info`.
- Production catch blocks use `console.warn` (not `error`) so RN's dev LogBox does not fullscreen on expected mock failures.
- `__DEV__`-gated API trace logs (`[API] →`, `[API] ←`) carry the marker comment `// Debug trace log — remove before release.` so they can be greppable for v1.0.

### Magic numbers

- All durations, thresholds, throttle intervals, retry counts, status codes, byte sizes, animation timings → a `constants.ts`. Never inline.
- Module-local → `src/modules/<feature>/constants.ts`. Shared by 2+ modules → `src/lib/constants/magic-numbers.ts`.
- Not magic numbers: Tailwind utility values (`w-12`, `gap-2`), SVG attributes (`viewBox`, `cx`, `strokeWidth`, `d`), trivial 0 / 1 in boolean expressions, `padStart(2, "0")`.

### Sheets & modals

- `<Sheet>` from `@/components/ui/Sheet` is the only sheet primitive. Never `@gorhom/bottom-sheet`.
- `<SheetHeader>` for the header row (title + optional left/right slots, 44pt height). All sheets consume it for visual unity.
- The 4 sheets (`AccountSheet`, `ChatHistorySheet`, `ModelPickerSheet`, `AttachSheet`) render unconditionally as siblings of chat home — visibility is a prop, not a conditional render.
- Dialogs centered against the display use the `overlays` slot of `<Sheet>`.

### Lists

- `@shopify/flash-list` with stable `keyExtractor`, `estimatedItemSize`, `getItemType` for mixed-row lists.
- Never `FlatList` for messages — performance degrades above ~50 rows.
- Auto-scroll only when the user is at the tail (see `isAtBottomRef` pattern in `MessageList.tsx`).

### Images

- `expo-image` only. Never RN `<Image>`.
- Attachment thumbs: prefer `uri` from `DbAttachment`; otherwise build a `data:` URI via `bytesToDataUri()` (memoized per chip).
- Static assets via `require("@/assets/images/...")`.

### Streaming chat

- Endpoint `/api/chat` on `ollama.com`. Never `/api/v1/chat/:id` (that is the desktop app's proprietary endpoint).
- JSONL parsing via `parseJsonlFromResponse` from `@/modules/chat/api/jsonl`.
- Message lifecycle: `pending` → `streaming` → `complete` | `error` | `interrupted`. The `status` column is the source of truth. Never smuggle state inside `content`.
- Retry mutates the same row id — never delete + recreate.
- **Thinking is opt-in; the `think` flag is omitted unless forced.** It rides as `think: true` only when the user has turned thinking on for the chat (a sticky per-chat toggle in the + hub) AND the model is thinking-capable; otherwise the flag is absent and the server applies the model's own default (thinking-capable models reason, others don't), so the user never has to manage it. `think: true` 400s on a non-thinking model, so the toggle is capability-gated. Detection being unreliable (`/api/show` sometimes omits `thinking` for a model that reasons, e.g. minimax-m3) is fine here: omitting lets such a model fall back to its own reasoning default rather than being suppressed.

### Markdown rendering (LLM-defensive)

The parser at `src/components/ui/markdown/parseMarkdown.ts` is intentionally permissive about malformed LLM output:

- Both `- ` and `* ` are valid bullet markers (CommonMark; LLMs emit either).
- Whitespace-only inline code spans are skipped (orphan backticks would otherwise render as empty chips).
- Paragraph source is sanitised before inline parsing: runs of 2+ backticks are stripped (LLM-emitted noise), whitespace is collapsed.
- CommonMark-style emphasis: the `*` / `**` marker must hug non-whitespace on both sides, otherwise the asterisks stay as literal text.

### Testing

- Jest with `jest-expo`. React Native Testing Library for components. Maestro for E2E in `e2e/`.
- Tests co-located: `chat.ts` + `chat.test.ts`.
- Unit tests focus on logic that breaks silently in production: signing, wire shapes, streaming parsers, LLM-defensive markdown. Native-module surfaces (SQLite repositories, expo-image-picker) are covered by Maestro E2E on device, not Jest.
- Tests gated by native modules use `__mocks__/*.ts` shims. New native deps need a matching mock.
- No coverage thresholds — `pnpm test` passing is the gate. Avoid writing tests just to lift a percentage.

### Surgical edits

- Touch only the lines the task requires. Never rename what was not asked. Never reformat untouched code.
- Never use placeholders like `// ... existing code ...`. Always return complete functional code.
- English in code, comments, UI source strings, commit messages, and PR bodies. Italian / other languages stay in conversation and design notes — never in code.

---

## Design system

The design source lives in three files. Components consume from them — never invent at the use-site.

- `src/lib/design/colors.cjs` — Apple HIG palette + shadcn semantic layer (background, foreground, card, primary, secondary, muted, destructive, destructive-soft, border, ring).
- `tailwind.config.js` — HIG type ramp, named spacing, radii, tracking presets.
- `src/lib/design/tokens.ts` — numeric tokens (icon size, stroke width, motion timings, component layout, opacity tiers, shadow profiles, sheet primitive thresholds).

**Layering**: body = gray6, cards = white, separators = gray4 (iOS Settings pattern, mandatory).

### Surface primitives

One surface primitive (`<GlassOrb>`) plus the labeled `<Button>`. A 5-layer real-glass recipe (BlurView + specular + edge highlights) was prototyped and abandoned — it only read as glass over scrolling content; over opaque sheet bodies it degraded into fake 3D embossing that broke uniformity. The orb is now solid.

- `<GlassOrb>` — pill-shape solid orb with theme-aware tint, soft shadow, press feedback. Used for icon-only floating controls, filter chips, swipe actions, tile cards. Props: `variant: 'clear' | 'regular' | 'thick'`, `interactive`, `disabled`, `tintColor`, `borderRadius`.
- `<Button>` — labeled CTAs. Variants: `primary`, `secondary`, `ghost`, `destructive`, `destructiveSoft` (Apple HIG iOS Settings Sign-Out pattern). Sizes: `sm` / `md` / `lg`.

### Shape language

Apple HIG iOS 26 uses pill shape (`rounded-full`) across the system. Quock follows the same rule everywhere — labeled CTAs and icon orbs share one corner. The single exception is AttachSheet's tile cards (18pt custom radius for the share-sheet aesthetic).

### Layout paradigm (Apple HIG iOS 26)

- **Header dissolved.** Three independent `<GlassOrb>` floating on a `pointerEvents="box-none"` container — no monolithic bar. A `MaskedView` + `LinearGradient` mask paints a soft blur over the safe-area-top, fading to 0% exactly at the orb seam. See `src/components/layout/FloatingHeader.tsx`.
- **Composer floats.** Attach / think / send buttons are `<GlassOrb>` floating over the bare background; the `TextField` is a solid `bg-card` pill in the middle. Same MaskedView gradient blur paints the safe-area-bottom, fading to 0% at the top of the orbs.
- **Sheets are full-width slabs.** Span the display, only top corners rounded (28pt). Body is opaque `bg-card`.
- **Solid CTAs stay solid.** `<Button>` for labeled actions — never compose raw `<Pressable bg-X rounded-full>`.

---

## Platform notes (Fabric iOS 26)

Workarounds for known New-Architecture quirks. Apply categorically:

- **`<TextField>` single-line** — set `height: 44` via the `style` prop (not `className`); Fabric's intrinsic content size is unreliable for a fixed-height row. **Multi-line** — use `minHeight: oneLineHeight` + `maxHeight: maxLines * lineHeight` via `style` and let RN auto-grow inside; manual `onContentSizeChange` tracking jittered on Fabric iOS 26 and was abandoned.
- **`flex-1 aspect-square` in a `flex-row`** — collapses to height 0. Set explicit `width` and `height` instead.
- **`Modal` is a separate UIWindow.** Nest `<GestureHandlerRootView>` inside the `<Modal>`, not outside, or gestures will not register inside the modal.
- **Press tint vs scale** — when a `Pressable` overlay paints a tint and the inner view also scales, the edges of the scaled child diverge from the outer. When both are active, lock `scale = 1`.
- **`@gorhom/bottom-sheet`** — fails silently on Fabric. Use `<Sheet>`.

---

## Environment & secrets

Quock has no runtime `.env` — the device Ed25519 seed is generated on first launch and lives in `expo-secure-store`, never on disk in plain form. **Never paste tokens, API keys, or seed material in chat, commits, logs, or screenshots** — redact in summaries.

## Files not to edit

- `node_modules/`, `ios/Pods/`, `ios/build/`, `android/build/` — build artifacts.
- `codegen/gotypes.gen.ts` (imported as `@/gotypes`) — regenerated from the Go backend; touching it manually breaks the next codegen run.
- `LICENSE` — touch is a STOP signal (see below).
- Compiled locale catalogs — edit the source, not the output.

## STOP signals (announce and wait for human)

- Need to add a new npm package.
- Need to change `app.json` identity (name, slug, scheme, bundleId).
- Need to break an existing public API surface (component prop, hook signature).
- Need to introduce a new top-level folder under `src/` (a new `src/modules/<feature>/` is fine; a new sibling of `modules`/`components`/`lib`/`dev` is a STOP).
- Need to skip a `magic-numbers.ts` constraint (inline magic value).
- A migration adds a destructive DB operation (DROP COLUMN, DELETE FROM, …).
- Tests fail and the fix would require disabling a rule rather than fixing the cause.
- The change touches `LICENSE` text.
- `/review` has run 3 iterations and still finds violations the loop cannot auto-fix.
- AGENTS.md is silent, contradictory, or out-of-date on the exact question — surface the gap, do not guess.

## When the docs and the code disagree

The docs are the contract. If a rule in AGENTS.md no longer matches reality:

1. Stop. Do not silently follow the code over the docs (or vice versa) — both will drift.
2. Surface the gap to the human with a one-line summary of what conflicts.
3. If the rule needs to change, the **docs PR lands first** (small, isolated to AGENTS.md). Then the code PR refers to the new rule.
4. Never develop against an obsolete rule. The cost of a one-day docs PR is lower than the cost of a feature built on a rule that turned out to be stale.

---

## Workflow

**One feature → one branch from `develop` → multi-commit → one PR into `develop` → STOP → human merges → next task.**

`develop` is the integration branch. `main` is release-only — never push to `main` directly, never target `main` with a PR.

### Workflow principles

1. **Sequential, never parallel.** One feature at a time, one branch at a time, one PR at a time. Parallel work guarantees spaghetti and rule loss.
2. **Mandatory self-review.** `/review` runs before every PR and loops until clean.
3. **Stop at PR ready.** Once the PR is open, stop and wait for the human to merge. Only after merge do you move to the next task.
4. **Trust the docs.** When in doubt, re-read AGENTS.md before inventing — existing rule beats improvisation.

### Branch naming

| Prefix | Use for | Example |
| --- | --- | --- |
| `feat/` | New feature or feature-shaping change | `feat/liquid-glass`, `feat/account-sheet` |
| `fix/` | Bug fix | `fix/sheet-grabber-velocity`, `fix/markdown-empty-chips` |
| `chore/` | Maintenance, deps, config, tooling | `chore/deps-reanimated-4-3`, `chore/agents-rewrite` |
| `docs/` | Docs-only change | `docs/onboarding` |
| `refactor/` | Refactor without new feature or fix | `refactor/sheet-primitive` |
| `release/X.Y.Z` | Release candidate frozen for App Store submission. Fixes during Apple review land here. | `release/0.1.0` |
| `hotfix/X.Y.Z` | Emergency fix on the version currently live in the App Store. Branched from `main`. | `hotfix/0.1.1` |

Branch names are kebab-case, descriptive, no ticket numbers (Quock has no tracker in repo).

### Commit pattern

Incremental, never one mega-commit. Aim for 3-7 commits per task, each commit a logical step a reviewer can follow without re-reading the diff back-and-forth. One commit = one concern. When unrelated changes pile up locally, split before pushing.

### Anti-patterns

Cross-cutting workflow don'ts that apply to every command:

- Working on 2 features in parallel — sequential principle, one branch and one PR at a time.
- Mixing doc and code in the same PR — when a rule in AGENTS.md needs to change, the docs PR lands first, then the code PR refers to it.
- Inventing scope when in doubt — ask the human.

Command-specific anti-patterns (force-push, mega-commit, English-only, merge own PR, target main, …) live in the NEVER lists of each `.agent/commands/*.md` — those files are canonical for their procedure.

---

## Versioning & releases

Quock follows **SemVer** (`MAJOR.MINOR.PATCH`). `main` reflects exactly the version currently published on the App Store; `develop` is the next release in flight. App Store review is slow (weeks), so the two branches stay separated to let work on the next version proceed while the submitted one is in review.

Full lifecycle, version-bump table, and branch model (release/X.Y.Z, hotfix/X.Y.Z, tag-on-approval) live in [`.agent/commands/release.md`](.agent/commands/release.md). Read it when starting a release.

---

## Slash commands

Procedures live in `.agent/commands/`. Each is an iterative loop: read AGENTS.md, check the diff, fix violations, restart. The cycle closes only when a clean pass produces zero violations.

| Command | Purpose | Rule file |
| --- | --- | --- |
| `/commit` | Stage + diff + Conventional Commit + push | `.agent/commands/commit.md` |
| `/pr` | Run `/review` + rebase on `develop` + push + `gh pr create` | `.agent/commands/pr.md` |
| `/review` | Self-review + adversarial panel (independent critics + skeptic verify per finding) + auto-fix loop | `.agent/commands/code-review.md` |
| `/release-start X.Y.Z` | Freeze `develop` into `release/X.Y.Z`, bump version + buildNumber, open draft PR to `main` | `.agent/commands/release.md` |
| `/hotfix X.Y.Z` | Branch from `main` for an emergency fix on the live App Store version | `.agent/commands/release.md` |
| `/cleanup` (post-merge) | Checkout `develop`, pull, prune local branch | inline in `.agent/commands/pr.md` |

Conventional Commit `type`s and `scope`s are listed in `.agent/commands/commit.md` — that file is canonical, do not duplicate here. Each command's NEVER list (in its own `.md`) is the canonical reminder of procedure-specific rules; the AI-attribution policy (always co-author AI-made commits/PRs) lives in each command's write step.

## Build gate (zero tolerance)

```
pnpm typecheck    → 0 errors
pnpm lint         → 0 errors, 0 new warnings
pnpm test         → all passing
```

`.github/workflows/mobile-ci.yml` runs the same three commands on every PR into `develop`. PRs cannot merge on red CI.
