# Mobile E2E (Maestro)

End-to-end smoke test for Quock, written in [Maestro](https://maestro.mobile.dev/) YAML.

## Scope

A single hermetic flow that verifies the app boots cleanly and the Login screen renders. Anything past the OAuth handoff (real chat, attachments, account flows) is exercised manually on the simulator before each release — automating those requires a bound Ollama account on the device and is out of scope until Maestro Cloud + a test account are wired.

| File | Scope |
|---|---|
| `smoke.yaml` | Cold launch → Login screen with the OAuth CTA visible. Stops before the Safari handoff. |

## Running locally

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`.
2. Boot a simulator and install the app (`pnpm ios`).
3. From the repo root: `pnpm e2e` (or `maestro test e2e/smoke.yaml` for the single file).

Maestro Studio (`maestro studio`) is useful for authoring new flows and inspecting `testID`s on a running app.

## Manual: document attachments

Sending anything needs a bound account and a picked model, and the OS document picker is a separate process, so this flow stays manual for the same reason the rest of the chat does. Run it on the simulator before a release touching attachments. The fixtures below cover every path a document can take, the failures included — build your own to these shapes, any PDF toolchain will do.

| Fixture | Shape | Expected |
|---|---|---|
| a text-rich PDF (e.g. an 11-page bill) | ~2,800 characters per page | text only, **zero** pages rendered; the answer cites a page number |
| an image-only PDF, 2 pages, a distinct code on each | no text layer | on a vision model both codes come back; the second proves the render did not stop at page 1 |
| the same image-only PDF | — | on a NON-vision model the codes still come back, recognised on-device by OCR; nothing is invented |
| a password-protected PDF | encrypted | red toast "… is password protected", and the model says it could not read it |
| a damaged PDF (truncate a real one, or rename a `.zip`) | not parseable | red toast "… couldn't be used" / "The file is damaged, or it is not really a PDF." — a document that reaches the model empty must never do so in silence |
| two damaged PDFs in one send | not parseable | ONE red toast counting both and naming them, never two toasts (the store keeps only the last) |
| an image-only PDF on a NON-vision model, with OCR unavailable | nothing recognised | amber toast "No text could be read from …", pointing at re-attaching with a vision model |
| several documents at once, one of them unreadable | mixed | the readable ones attach, and ONE toast names how many were dropped (the store keeps only the last toast) |

Two checks that catch the failures worth catching:

1. **Ask a second question about the same document.** The answer must still come from it. A model that says it has no document — or apologises for the correct answer it just gave — means the per-turn replay regressed.
2. **Ask for something on the last pages.** A value from page 1 proves nothing; a value from the tail proves the whole document travelled.

Watch the Metro output while testing: every degradation logs under `pdfDocument:` (a page that would not extract, a budget that ran out, a document that would not open).

## testID dependencies

| testID | Component |
|---|---|
| `login-continue` | "Continue with Ollama" button in `app/login.tsx` |

When a flow needs a new testID, declare it here and add the prop on the component in the same PR.
