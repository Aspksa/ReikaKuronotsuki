# v135–v152 — Speech discovery and opt-in local preferences

The prototype supports manual selection of browser-provided voices, preferring an installed Russian voice by default. The **Refresh voices** button can discover voices that arrive after page initialization. Browser TTS remains platform-dependent; no neural voice model, speech recognition or phoneme-based lip-sync is included.

An opt-in preferences panel lets the user choose a nickname (up to 40 characters), voice persona and whether persona style follows the mood. Nothing is saved automatically: to persist preferences, check the local-save box and click Save. The Delete button clears the local record and resets the voice persona controls. Saved preferences remain in that browser's localStorage and are not sent to the AI provider by this feature. A nickname is a display preference only, not an AI memory or persistent server profile.

The package also includes punctuation segment parsing and approximate mouth-opening cue helpers for experimental animation. These are not a completed acoustic analysis pipeline and are not wired as phoneme detectors. Tests cover validation, JSON versioning, opt-in persistence, deletion, Russian voice selection, timing cue helpers and Chromium UI behavior.

This release is an incremental set of 18 versioned checks/milestones (v135–v152), not a production quality voice clone or a Live2D rig.
