# v20 — Browser speech

The Reika SVG prototype supports opt-in text-to-speech through the browser's built-in Speech Synthesis API. Type up to 500 characters and click **Произнести**; **Остановить речь** cancels the utterance. Playback stays within the browser's speech engine, which may use platform-provided voices. Availability and voice quality depend on browser and OS.

Mouth movement uses speech start and boundary callbacks as a coarse talking indicator. It is **not** precise lip-sync, microphone speech recognition, AI responses, or a production Live2D mouth rig. If speech synthesis is unavailable, the controls are disabled.
