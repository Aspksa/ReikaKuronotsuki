# v227 — Independent browser-based Reika head rig

A working **SVG 2D head rig**, requiring no Cubism Editor or proprietary runtime, is mounted on the existing animated Reika prototype.

Features: independently controllable yaw (-30…30), pitch (-20…20), roll (-20…20), gaze X/Y, smooth exponential motion, center reset, optional pointer-controlled gaze and instant changes under reduced-motion preferences. The existing SVG parts are wrapped in scene-graph transforms rather than exporting static PNGs. The existing mouth, blink, ears, hair, emotion and nine-tail controllers remain responsible for their own channels.

Open `prototype/index.html` in a modern browser and use **Живая голова Рэйки · собственный 2D-риг** in the control panel. No installation is required.

**Limitations:** a constrained 2D transform rig approximates head turning and is *not* volumetric face reconstruction, true deformable facial mesh, manually drawn layered source art, Live2D .cmo3 or Live2D .moc3. For genuine Cubism model output, independent painting and native mesh rigging are still needed. This release gives the user a working no-Cubism animated head, which is a different output from a native Live2D asset.
