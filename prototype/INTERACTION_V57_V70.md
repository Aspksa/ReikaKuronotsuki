# Reika interaction package v57–v70

This patch connects the existing **offline rule-based** chat to expressive SVG face states and optional browser TTS. No remote AI inference, phoneme detection, microphone input or production Live2D is introduced.

Milestones: **v57** greeting reaction; **v58** question reaction; **v59** magic/tail reaction; **v60** concerned/serious reaction; **v61** neutral fallback; **v62** five-and-a-half-second temporary mood; **v63** opt-out for automatic mood; **v64** manual reaction reset; **v65** quiet mouth when not speaking; **v66** coarse rhythmic mouth motion during speech; **v67** lip-animation toggle; **v68** handling of invalid animation timing; **v69** safe manual-mood fallback; **v70** independently testable behavior controller with browser controls.

Additional usability: automatic reply-to-speech is **off by default**; browser utterance rate and pitch are adjustable. Mouth motion uses approximate time-based rhythm, **not phoneme-accurate lip-sync**; voices and boundary support vary by browser. The system's reduced-motion setting suppresses new rhythmic lip animation. History still remains in the current tab only. All reply classification is from local Russian keyword rules.
