# Voice personas — v117–v134

This package extends Reika's existing **browser text-to-speech** controls with three optional voice-style presets, emotion-linked selection (off by default), and a simple word-count/duration estimate. It does **not** add automatic speech recognition, a neural voice model, or phoneme-accurate lip-sync.

## Eighteen tested increments

v117 text trimming; v118 500-character cap; v119 gentle style; v120 playful style; v121 composed style; v122 style validation; v123 happy emotion; v124 serious emotion; v125 thinking emotion; v126 magic emotion; v127 neutral fallback; v128 rate bounds; v129 pitch bounds; v130 input validation; v131 user-adjustable speed; v132 word estimates; v133 empty-input handling; v134 browser integration and regression tests.

The UI appears under **Голос Рэйки**. Use **Манера речи** to change rate/pitch sliders. Enable **Подбирать манеру речи по эмоции** to allow the most recent chat reaction to select a style automatically. Selecting a style does not start voice playback. Automatic spoken replies remain controlled by the existing separate opt-in checkbox. Synthesis quality and installed Russian voices depend on the browser and operating system; actual duration can differ considerably from the estimate.

All settings are tab-local and do not transmit data independently. This change is scoped to voice interaction, not Live2D artwork or AI model hosting.
