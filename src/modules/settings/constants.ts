// Settings module constants — account sheet snap points + drill transition tuning.

export const ACCOUNT_SHEET_SNAP_ACCOUNT = "40%" as const;
export const ACCOUNT_SHEET_SNAP_SETTINGS = "75%" as const;
// Settings/account drill transition: settings re-enters from a slightly farther scale than account for a softer feel.
export const SETTINGS_DRILL_SCALE_FROM = 0.96;
export const SETTINGS_DRILL_SCALE_TO = 1;
export const ACCOUNT_DRILL_SCALE_FROM = 0.985;
// Sheet content fade timings used when drilling between account and settings.
export const SHEET_FADE_IN_MS = 180;
export const SHEET_FADE_OUT_MS = 120;

// A reworded excerpt instruction is prepended to every excerpt action and persisted, so it gets the same bound as
// pasted document text: room for a paragraph of guidance, not for an essay that then rides on every turn.
export const EXCERPT_INSTRUCTION_MAX_CHARS = 400;
