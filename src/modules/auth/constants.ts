// Auth module constants — login screen choreography + Ed25519 / SSH wire-format values.

// Login screen choreography: stagger delays + transition timing.
export const LOGIN_MIN_LOADING_MS = 1500;

// Login stagger cadence: logo lands first, then title (+80ms), button (+160ms), legal (+240ms).
export const LOGIN_STAGGER_LOGO_DELAY_MS = 0;
export const LOGIN_STAGGER_TITLE_DELAY_MS = 80;
export const LOGIN_STAGGER_BUTTON_DELAY_MS = 160;
export const LOGIN_STAGGER_LEGAL_DELAY_MS = 240;
export const LOGIN_ELEMENT_FADE_MS = 320;
export const LOGIN_ELEMENT_TRANSLATE_Y = 8;
export const LOGIN_LOGO_SCALE_FROM = 0.85;
export const LOGIN_LOGO_SIZE = 64;
export const LOGIN_ERROR_SLIDE_DISTANCE = 8;
export const LOGIN_ERROR_FADE_MS = 200;

// Poll cadence for /api/me while the connect-URL browser is open. Tuned to beat Ollama's server-bind → JS `ollama://` redirect, which fires within a few hundred ms of the user tapping Connect; a sub-second cadence is what lets `WebBrowser.dismissAuthSession()` land before iOS surfaces "Safari cannot open the page" on phones without the first-party Ollama app.
export const BIND_POLL_INTERVAL_MS = 500;

// SecureStore slot for the persisted Ed25519 seed (32 raw bytes, base64). The full secret is re-derived on reload.
export const KEYPAIR_SEED_STORE_KEY = "ollama_ed25519_seed";
// Ed25519 raw byte lengths defined by the curve / RFC 8032.
export const ED25519_SEED_BYTES = 32;
export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SECRET_KEY_BYTES = 64;
// SSH wire-format markers for ed25519 keys, per RFC 4253 §6.6 + draft-bjh21-ssh-ed25519.
export const SSH_ED25519_TYPE = "ssh-ed25519";
// Length-prefix bytes in the SSH wire format are 32-bit big-endian.
export const SSH_LENGTH_PREFIX_BYTES = 4;
