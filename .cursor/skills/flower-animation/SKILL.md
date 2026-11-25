---
name: flower-animation
description: Use when building or fixing the pipe-cleaner flower guide.
disable-model-invocation: true
---

# flower-animation

- Use CLAD. Build everything in code, with no custom shaders.
- Make fuzzy pipe cleaners from mesh geometry.
- For each step, show pieces in their start position, a glowing yellow outline of the end position, then smooth motion into it.
- Add arrows, and a small original bee that points to the action.
- Loop each animation until Next. Include Back and Replay, pressed by pinching.
- Show simple hand-position outlines, not realistic hands.
- Test in Preview, fix errors, and say what you couldn't verify.

## Steps 6–8 (assembly) — hot glue only

- Step 6: cut the green pipe cleaner in half; trim pointed tips (`leafSegments` / `leafPoints`).
- Step 7: hot-glue the finished step-5 flower head onto the **bare stem wire** (glue → press → hold until cool). Keep the hot-glue safety note.
- Step 8: starts from finished step 7; hot-glue both leaf ends onto the bare wire (glue → press → hold → finished).
- **No floral tape** — not in animation, geometry, text, or materials. Stem stays bare wire.
- Materials include a **hot glue gun** (plus purple/green pipe cleaners, thin stick, scissors, stem wire).
- Flower head in steps 7–8 must be the exact finished shape from step 5 (`spiralPoints(side, 1)`).
