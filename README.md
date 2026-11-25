# Pipe Cleaner Lavender Flower — Specs Tutorial

Interactive **Spectacles (Specs)** Lens Studio guide that teaches how to make a **lavender flower from pipe cleaners**. All eight craft steps are animated in AR with pinch Next / Back / Replay.

Built for Lens Studio 5.22 + Spectacles Interaction Kit. Geometry is runtime MeshBuilder (no custom shaders). Units are centimeters.

## What’s working (Preview-verified)

| Step | Title | Animation |
|------|--------|-----------|
| 1 | Wrap | Leave 0.5 in tails, wrap turn beside turn on a thin stick, slide the stick out |
| 2 | Stretch | Hold left end, pull right to ~20 cm ridged stick |
| 3 | Twist together | Two equal strands cross at the middle, then twist exactly two full turns |
| 4 | Fold in half | Fold at the twisted middle so four ends hang down; pinch the top |
| 5 | Wind the spiral | Hold the top; wind four ends into one thick rope (flower head) |
| 6 | Cut the leaves | Cut green pipe cleaner in half; trim pointed tips |
| 7 | Glue the flower head | Hot-glue finished head onto **bare stem wire**; press; hold until cool |
| 8 | Glue the leaves | Hot-glue both leaf ends onto the bare wire; hold; finished flower |

**Assembly notes:** Hot glue only — no floral tape. Stem stays bare wire. Materials list includes a hot glue gun. Hot-glue safety note is shown in steps 7–8.

## Project layout

- `Assets/Scripts/FlowerGuideController.ts` — step machine, UI, Preview QA scrub
- `Assets/Scripts/PipeCleanerGeom.ts` — wrap / stretch / twist / fold / spiral / leaf / wire geometry
- `Assets/Materials/` — purple, yellow outline, stick, UI, hand materials
- `reference/` — HTML geometry/timing source of truth (`coil-and-stretch (6).html`)
- `.cursor/skills/flower-animation/` — agent rules for this guide

## How to run

1. Open `Specs Base Template.esproj` in Lens Studio 5.22+
2. Preview on Specs / Wearable Experience
3. Pinch **Next**, **Back**, or **Replay** (or use ← → R keys in Preview)

## Platform

Spectacles / Specs AR — SIK Interactable buttons, world-space guide stage.
