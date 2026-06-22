# Privacy Policy — Quock

**Effective date**: 2026-06-03
**Version**: 0.2 (alpha)
**Document language**: English (controlling).

> [!IMPORTANT]
> **Quock is an unofficial third-party mobile client for [Ollama Cloud](https://ollama.com).** It is not affiliated with, endorsed by, or sponsored by Ollama, Inc. This policy describes how **Quock the app** handles Your data on Your device. The Ollama Cloud service that Quock talks to is governed separately by [Ollama's own Privacy Policy](https://ollama.com/privacy).

> [!NOTE]
> This document is the maintainer's good-faith disclosure based on the technical reality of the app. It has not been reviewed by counsel. Before any commercial release or scaled distribution, qualified legal review is recommended.

---

## TL;DR

- **There is no Quock server.** The Author does not operate any backend infrastructure that receives, stores, or processes Your personal data.
- **All Your conversations stay on Your device** (an SQLite database in Your iOS or Android app sandbox).
- **The only data that leaves Your device is the message You actively send.** It goes directly to Ollama Cloud over an HTTPS connection, signed with a per-device cryptographic key.
- **We don't track You.** No analytics, no advertising, no crash reporters, no behavioral profiling. Today (v0.2) Quock makes zero outbound calls that aren't a direct request to Ollama on Your behalf.
- Ollama, Inc. is a separate data controller for whatever they do server-side. **Read [Ollama's Privacy Policy](https://ollama.com/privacy)** for the cloud-side picture.

---

## 1. Who is the Data Controller?

For the narrow set of activities Quock performs:

- **Matteo Celani** (the "Author"), acting in a non-professional, open-source-maintainer capacity, is the data controller for the **decision** to route Your messages from Your device to Ollama Cloud. The Author does not, however, retain or process those messages — the decision is encoded in software that runs locally and forwards data outbound.
- **Ollama, Inc.**, located in the United States, is the independent data controller (and/or processor on behalf of its own users) for everything that happens server-side once Your message reaches Ollama Cloud.

If You have questions about Quock's role specifically, contact the Author by opening an issue on the repository (see Section 11). Questions about what Ollama does with Your data must be directed to Ollama at [`hello@ollama.com`](mailto:hello@ollama.com).

## 2. What categories of personal data does Quock process?

The honest answer is *almost none*. The categories below are the complete list. They are processed **on Your device** and, except where explicitly noted, are never transmitted anywhere.

| Data | Where it lives | Why | Sent to Ollama? | Sent to Author? |
|---|---|---|---|---|
| **Ed25519 device keypair** (public + secret) | `expo-secure-store` (iOS Keychain / Android Keystore), on-device | To authenticate Your requests to Ollama Cloud without passwords | Public key only, during request signing | Never |
| **Chat history** (messages, attachments) | Local SQLite database, on-device | To let You scroll past conversations | No (each new send replays from device-side history) | Never |
| **App preferences** (theme, default model, haptics) | MMKV, on-device | To remember Your settings | No | Never |
| **The message You're currently sending** | RAM, then HTTPS body to Ollama | To get an AI response | **Yes — that's the point** | Never |
| **The AI response** | RAM, then SQLite once committed | To show You the answer and let You scroll back | No (Ollama already has it; Quock receives, does not echo) | Never |
| **Account email + name** (returned by `/api/me`) | RAM + SQLite (cached) | To show You who is signed in | Already known by Ollama (You created the account with them) | Never |

Quock collects **no** advertising identifier, **no** crash reporting telemetry (today; see Section 8 on potential future inclusions), **no** behavioral analytics, **no** location data, **no** contacts, **no** photos beyond what You explicitly attach to a single message.

## 3. Legal basis for processing (GDPR Art. 6)

For users in the European Economic Area, the United Kingdom, Switzerland, and other GDPR-aligned jurisdictions, the Author processes the limited data described in Section 2 on the following bases:

- **Performance of a contract (Art. 6(1)(b) GDPR)** — sending Your message to Ollama is necessary to deliver the service You requested by tapping "send".
- **Legitimate interest (Art. 6(1)(f) GDPR)** — storing Your chat history on Your device serves Your interest in having a usable chat app. The processing is local, has no recipient outside Your device, and a balancing test against Your fundamental rights and freedoms favours the processing.
- **Consent (Art. 6(1)(a) GDPR)** — to the extent any future telemetry or analytics is introduced, it will be opt-in only and require Your explicit, informed, freely-given, withdrawable consent. None is collected today.

## 4. Where does data go?

| Recipient | What | How | Where in the world |
|---|---|---|---|
| **Ollama, Inc.** | The message You send (text + any attached image/file) | Direct HTTPS POST from Your device to `https://ollama.com/api/chat`, signed with Your device public key | United States — Ollama's infrastructure |
| **Apple / Google** | Platform-level telemetry that the OS collects for **all** apps (e.g. App Store usage stats, crash counts if You haven't disabled them in Settings) | Out of Quock's control | According to each platform's policy |
| **Author** | Nothing | — | — |

**International transfers (EU → US):** because Ollama is a US company, sending Your message to Ollama Cloud is a transfer of personal data to a third country under Article 44 GDPR. The legal basis for that transfer is Ollama's own framework (You established a direct contractual relationship with Ollama when You created Your Ollama account). The Author facilitates the transmission but is not the importer of the data. **Read Ollama's privacy policy** for transfer-mechanism details (typically Standard Contractual Clauses adopted by the European Commission and/or the EU–U.S. Data Privacy Framework).

## 5. Retention

- **On Your device**: as long as You keep Quock installed and have not used the "Clear all chats" action in Settings. Uninstalling Quock removes the SQLite database, the MMKV preferences, and the Ed25519 keypair from Your device permanently.
- **Server-side**: not applicable. The Author retains nothing.
- **At Ollama**: governed by Ollama's policy.

## 6. Your rights

Under GDPR (EU/EEA), UK GDPR, the Italian *Codice Privacy* (D.Lgs. 196/2003 as amended), the French *Loi Informatique et Libertés*, the California Consumer Privacy Act / CPRA, and other comparable regimes, You have rights including:

- **Access** — the right to know what data the Author processes about You. **Answer: nothing on the Author's side.**
- **Rectification** — the right to correct inaccurate data. **Quock holds none.** Adjust profile data with Ollama; Your local chat history is editable on-device (delete + retry / regenerate).
- **Erasure ("right to be forgotten")** — the right to deletion. **Uninstall the app** (immediate, complete, irreversible) or use **Settings → Clear all chats** for a softer erasure that keeps Your preferences. For data Ollama holds, contact Ollama.
- **Restriction** — the right to limit processing. **The Author processes none, so there is nothing to restrict.** You may limit what Ollama does only through Ollama.
- **Portability** — the right to receive Your data in a structured machine-readable format. **Quock's chat history lives in a standard SQLite file** on Your device; You can extract it via iOS / Android backup tooling. The Author does not currently provide an in-app export; if You need one, please open an issue.
- **Objection** — the right to object to processing based on legitimate interest. **You can object by uninstalling.** No automated decision-making with legal or similarly significant effects is performed by Quock.
- **Withdraw consent** — for any future consent-based processing You may have opted into. **None today.**
- **Lodge a complaint** with Your national supervisory authority. For Italy: [Garante per la protezione dei dati personali](https://www.garanteprivacy.it/). For France: [CNIL](https://www.cnil.fr/). For the UK: [ICO](https://ico.org.uk/). For other EU member states: the [EDPB list](https://edpb.europa.eu/about-edpb/about-edpb/members_en). For California residents: the [California Attorney General](https://oag.ca.gov/privacy).

To exercise any right against the Author, contact us as described in Section 11. Because we hold essentially nothing about You, most rights resolve instantly (we have no records to access, rectify, or erase). Rights against Ollama must be exercised through Ollama directly.

## 7. Children

Quock is not intended for use by children below the minimum age set in Section 2 of the [Terms of Service](./TERMS.md). The Author does not knowingly collect personal data from children. If You believe a child has used Quock against these rules, please open an issue and we will assist with deletion to the extent any data is involved.

## 8. Analytics, crash reporting, advertising — none today, opt-in only if ever

As of the effective date above, Quock contains:

- **No analytics SDK** (no Firebase, Amplitude, PostHog, Mixpanel, Segment, Plausible, etc.).
- **No crash reporter** (no Sentry, no Crashlytics, no Bugsnag, no native crash uploader configured by the Author).
- **No advertising network**.
- **No marketing or attribution SDK**.
- **No third-party tracker** beyond OS-level platform telemetry that Apple / Google may collect for all apps independently of the Author.

If a future release of Quock introduces any of the above, the addition will be:

1. Documented in this file and in the relevant release notes.
2. **Opt-in by default** (never opt-out), with a clear in-app explanation of what is collected and why.
3. Withdrawable at any time without penalty or loss of functionality.

## 9. Security

The Author follows reasonable security practices for the limited surface Quock owns:

- The Ed25519 secret key never leaves the device's hardware-backed secure element (`expo-secure-store` → iOS Keychain / Android Keystore).
- All requests to Ollama Cloud are signed and transmitted over TLS 1.2+ (HTTPS).
- No password is ever stored or transmitted by Quock.
- The source code is open and publicly auditable at [`github.com/matteocelani/quock`](https://github.com/matteocelani/quock); security issues can be reported by opening an issue tagged `security`.

Despite these measures, no software is perfectly secure. **You acknowledge that no system can guarantee absolute security**, and that compromise of Your device, Your Ollama account, or the underlying OS may expose data outside the Author's control.

## 10. Changes to this Policy

The Author may revise this Policy at any time. Material revisions take effect on the next release of Quock that bundles them, or on the effective date specified at the top of this file — whichever is later.

Because this file lives in the project's Git repository, every revision is publicly visible in `git log docs/PRIVACY.md`. Where revisions are material (i.e. they enable a new category of processing, a new recipient, or a new lawful basis), the Author will additionally surface a clear in-app notice on the first launch following the change.

## 11. Contact

- For privacy questions related to **Quock the app**: open an issue at [`github.com/matteocelani/quock/issues`](https://github.com/matteocelani/quock/issues) tagged `privacy`, or email the address listed in the repository's most recent maintainer commit.
- For privacy questions related to **Ollama Cloud**: contact Ollama, Inc. at [`hello@ollama.com`](mailto:hello@ollama.com) and consult [Ollama's Privacy Policy](https://ollama.com/privacy).
- For privacy questions related to **the underlying platform**: contact [Apple](https://www.apple.com/legal/privacy/) or [Google](https://policies.google.com/privacy) directly.
