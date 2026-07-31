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

Sending anything needs a bound account and a picked model, and the OS document picker is a separate process, so this flow stays manual for the same reason the rest of the chat does. Run it on the simulator before a release touching attachments. The four fixtures cover the four paths a document can take; `pdf-fixtures/` in the task scratchpad builds them, or make your own to the same shapes.

| Fixture | Shape | Expected |
|---|---|---|
| a text-rich PDF (e.g. an 11-page bill) | ~2.800 characters per page | text only, **zero** pages rendered; the answer cites a page number |
| an image-only PDF, 2 pages, a distinct code on each | no text layer | on a vision model both codes come back; the second proves the render did not stop at page 1 |
| the same image-only PDF | — | on a NON-vision model the reply says the document has no text layer, and invents nothing |
| a password-protected PDF | encrypted | red toast "… is password protected", and the model says it could not read it |

Two checks that catch the failures worth catching:

1. **Ask a second question about the same document.** The answer must still come from it. A model that says it has no document — or apologises for the correct answer it just gave — means the per-turn replay regressed.
2. **Ask for something on the last pages.** A value from page 1 proves nothing; a value from the tail proves the whole document travelled.

Watch the Metro output while testing: every degradation logs under `pdfDocument:` (a page that would not extract, a budget that ran out, a document that would not open).

## testID dependencies

| testID | Component |
|---|---|
| `login-continue` | "Continue with Ollama" button in `app/login.tsx` |

When a flow needs a new testID, declare it here and add the prop on the component in the same PR.
