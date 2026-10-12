# v17 — nine-tail inertial motion

The SVG prototype and local PNG layer player now use `prototype/physics.js` spring dynamics on the existing nine-tail target angles. Each tail stores its own angular velocity; the integrator uses bounded substeps for time-step stability. With zero procedural motion or paused SVG animation, targets are snapped without residual velocity.

This is **lightweight 2D spring motion**, not collision-aware tail simulation or Live2D mesh deformation. Ear, eye and hair movement still use the existing procedural controls; original artwork remains experimental.
