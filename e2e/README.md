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

## testID dependencies

| testID | Component |
|---|---|
| `login-continue` | "Continue with Ollama" button in `app/login.tsx` |

When a flow needs a new testID, declare it here and add the prop on the component in the same PR.
