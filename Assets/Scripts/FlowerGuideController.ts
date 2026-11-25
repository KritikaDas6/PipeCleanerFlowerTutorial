/**
 * Pipe-cleaner flower guide — steps 1–5.
 * Steps 1–2 (coil + stretch) reworked for clear reading; 3–5 unchanged in content.
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {
  Vec3,
  easeInOut,
  lerp,
  clamp01,
  easeSmooth,
  wrapPoints,
  wrapStickPoints,
  helixPoint,
  WRAP_TAIL,
  WRAP_TURNS,
  WRAP_COIL_LEN,
  WRAP_COIL_R,
  WRAP_WIRE,
  makeStretchingHorizontalCoil,
  twistPoints,
  TWIST_W,
  foldPoints,
  spiralPoints,
  HANG,
  buildLeafMesh,
  stemWirePoints,
  finishedHeadPaths,
  buildFuzzyTube,
  buildSimpleTube,
} from "./PipeCleanerGeom"

const PATH_SAMPLES = 48
const STRETCH_LEN = 20 // cm
/** Shared with wrap finish — step 2 start coil (from reference HTML). */
const COIL_START_LEN = WRAP_COIL_LEN
const COIL_TURNS = WRAP_TURNS
const COIL_START_R = WRAP_COIL_R
const COIL_END_R = 0.38
const PURPLE_R = 0.55
const OUTLINE_SCALE = 1.2
/** Live stretch in front; start-length guide stays above (no yellow/purple blend). */
const Z_LIVE = -1.5
const Y_START_GUIDE = 3.2
const WRAP_ORIGIN_X = -WRAP_COIL_LEN * 0.5
/** Lift assemble steps (7–8) so head + bare stem stay in view. */
const ASSEMBLE_Y_LIFT = 12
/** Extra scale for assemble so head/stem/leaves read in Preview. */
const ASSEMBLE_STAGE_SCALE = 1.85

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

@component
export class FlowerGuideController extends BaseScriptComponent {
  @input purpleMat!: Material
  @input yellowMat!: Material
  @input stickMat!: Material
  @input uiMat!: Material
  @input handMat!: Material

  private root!: SceneObject
  private stage!: SceneObject
  private strandObjs: SceneObject[] = []
  private outlineObjs: SceneObject[] = []
  private handL!: SceneObject
  private handR!: SceneObject
  private arrowObj!: SceneObject
  private beeObj!: SceneObject
  private stickObj!: SceneObject
  private holdMarker!: SceneObject
  private pullArrow!: SceneObject
  private pullArrowLabel!: Text
  private rulerObj!: SceneObject
  private rulerLabel!: Text
  private wrapActionLabel!: Text
  private wrapTailLabelL!: Text
  private wrapTailLabelR!: Text
  private titleText!: Text
  private hintText!: Text

  private step: StepId = 1
  private phase: "holdStart" | "showOutline" | "animate" | "holdEnd" = "holdStart"
  private phaseT = 0
  private loopGen = 0
  private meshAccum = 0
  private lastMeshT = -1
  private autoAdvanceOnce = false
  private autoDone = false

  /** QA: freeze timeline for Preview captures. -1 = play. */
  private scrubT = -1
  private qaCaptureMode = false
  private qaIdx = 0
  private qaHoldT = 0
  private qaPhase: "glueHead" | "glueLeaves" = "glueHead"
  private readonly qaGlueTimes = [0.22, 0.5, 0.78]
  private readonly qaGlueNames = ["gluing", "pressing", "holding"]
  private readonly qaFinishTimes = [1.0]
  private readonly qaFinishNames = ["finished"]
  private qaHoldSeconds = 4.5

  private startPaths: Vec3[][] = []
  private endPaths: Vec3[][] = []

  private purpleClone!: Material
  private purpleCloneB!: Material
  private yellowClone!: Material
  private ghostClone!: Material
  private stickClone!: Material
  private uiClone!: Material
  private handClone!: Material
  private markerClone!: Material
  private crossArrowTop!: SceneObject
  private crossArrowBot!: SceneObject
  private twistArc!: SceneObject
  private twistCounterLabel!: Text
  private twistCrossLabel!: Text
  private foldArrowL!: SceneObject
  private foldArrowR!: SceneObject
  private pinchArrowL!: SceneObject
  private pinchArrowR!: SceneObject
  private foldActionLabel!: Text
  private spiralWindArc!: SceneObject
  private spiralActionLabel!: Text
  private leafObjA!: SceneObject
  private leafObjB!: SceneObject
  private wireObj!: SceneObject
  private scissorsObj!: SceneObject
  private glueGunObj!: SceneObject
  private glueBeadA!: SceneObject
  private glueBeadB!: SceneObject
  private assembleLabel!: Text
  private materialsLabel!: Text
  private greenClone!: Material
  private wireClone!: Material
  private glueClone!: Material
  private steelClone!: Material
  private gunOrangeClone!: Material

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.boot())
  }

  private boot() {
    this.purpleClone = this.cloneMat(this.purpleMat, new vec4(0.55, 0.22, 0.85, 1), false)
    // Second strand shade (HTML hsl 285 65% 72% ≈ lighter magenta-purple)
    this.purpleCloneB = this.cloneMat(this.purpleMat, new vec4(0.85, 0.45, 0.95, 1), false)
    this.yellowClone = this.cloneMat(this.yellowMat, new vec4(1.0, 0.92, 0.15, 0.85), true)
    this.ghostClone = this.cloneMat(this.handMat, new vec4(0.75, 0.7, 0.85, 0.35), true)
    this.stickClone = this.cloneMat(this.stickMat, new vec4(0.55, 0.55, 0.58, 1), false)
    this.uiClone = this.cloneMat(this.uiMat, new vec4(0.12, 0.4, 0.75, 0.95), true)
    this.handClone = this.cloneMat(this.handMat, new vec4(0.9, 0.9, 0.92, 0.45), true)
    // Match HTML hold ring (yellow)
    this.markerClone = this.cloneMat(this.yellowMat, new vec4(1.0, 0.89, 0.36, 1), false)
    // Green leaf (HTML hsl 130 55% 36%), bare stem wire, hot glue, scissors/gun
    this.greenClone = this.cloneMat(this.stickMat, new vec4(0.28, 0.55, 0.28, 1), false)
    this.wireClone = this.cloneMat(this.stickMat, new vec4(0.45, 0.32, 0.28, 1), false)
    this.glueClone = this.cloneMat(this.yellowMat, new vec4(1.0, 0.96, 0.84, 0.9), true)
    this.steelClone = this.cloneMat(this.handMat, new vec4(0.81, 0.83, 0.85, 1), false)
    this.gunOrangeClone = this.cloneMat(this.yellowMat, new vec4(0.94, 0.54, 0.24, 1), false)

    this.root = this.sceneObject
    this.stage = this.makeChild(this.root, "Stage")
    // Level, centered, ~60 cm ahead, 1.5x
    this.stage.getTransform().setLocalPosition(new vec3(0, 0, -60))
    this.stage.getTransform().setLocalScale(new vec3(1.5, 1.5, 1.5))

    this.buildLabels()
    this.buildHands()
    this.buildArrow()
    this.buildBee()
    this.buildStick()
    this.buildStretchHelpers()
    this.buildTwistHelpers()
    this.buildFoldHelpers()
    this.buildSpiralHelpers()
    this.buildAssembleHelpers()
    this.buildNavButtons()
    this.ensureStrandSlots(4)

    // Hide bee / hand rings until shapes read clearly
    this.beeObj.enabled = false
    this.handL.enabled = false
    this.handR.enabled = false
    this.arrowObj.enabled = false

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("KeyPressEvent").bind((ev: KeyPressEvent) => {
      if (ev.key === Keys.Right) this.onNext()
      else if (ev.key === Keys.Left) this.onBack()
      else if (ev.key === Keys.R) this.onReplay()
    })

    if (this.qaCaptureMode) {
      this.beginQaCapture()
    } else {
      this.goToStep(1, true)
    }
    print("[FlowerGuide] boot complete")
  }

  private beginQaCapture() {
    this.qaIdx = 0
    this.qaHoldT = 0
    this.qaPhase = "glueHead"
    this.goToStep(7, true)
    this.phase = "animate"
    this.phaseT = 0
    this.scrubT = this.qaGlueTimes[0]
    this.applyScrubFrame()
    print(`[QA_CAPTURE] step=7 ${this.qaGlueNames[0]} t=${this.scrubT} — hold ${this.qaHoldSeconds}s`)
  }

  private buildTwistHelpers() {
    // Cross arrows: toward center from above / below (shaft + chevron tip)
    this.crossArrowTop = this.makeChild(this.stage, "CrossArrowTop")
    this.applyMesh(
      this.crossArrowTop,
      buildSimpleTube(
        [
          [0, 4.2, 0],
          [0, 1.4, 0],
        ],
        0.2,
        5,
      ),
      this.yellowClone,
    )
    const tipT = this.makeChild(this.crossArrowTop, "Tip")
    this.applyMesh(
      tipT,
      buildSimpleTube(
        [
          [-0.85, 2.2, 0],
          [0, 1.15, 0],
          [0.85, 2.2, 0],
        ],
        0.18,
        4,
      ),
      this.yellowClone,
    )
    this.crossArrowTop.enabled = false

    this.crossArrowBot = this.makeChild(this.stage, "CrossArrowBot")
    this.applyMesh(
      this.crossArrowBot,
      buildSimpleTube(
        [
          [0, -4.2, 0],
          [0, -1.4, 0],
        ],
        0.2,
        5,
      ),
      this.yellowClone,
    )
    const tipB = this.makeChild(this.crossArrowBot, "Tip")
    this.applyMesh(
      tipB,
      buildSimpleTube(
        [
          [-0.85, -2.2, 0],
          [0, -1.15, 0],
          [0.85, -2.2, 0],
        ],
        0.18,
        4,
      ),
      this.yellowClone,
    )
    this.crossArrowBot.enabled = false

    // Curved twist arrow (HTML ellipse on the right of the twist window)
    this.twistArc = this.makeChild(this.stage, "TwistArc")
    const arcPts: Vec3[] = []
    for (let i = 0; i <= 24; i++) {
      const a = -1.3 + (2.6 * i) / 24
      arcPts.push([0.7 * Math.cos(a), 2.4 * Math.sin(a), 0])
    }
    this.applyMesh(this.twistArc, buildSimpleTube(arcPts, 0.18, 5), this.yellowClone)
    const arcTip = this.makeChild(this.twistArc, "Tip")
    this.applyMesh(
      arcTip,
      buildSimpleTube(
        [
          [0.2, 2.0, 0],
          [0.05, 2.5, 0],
          [0.7, 2.3, 0],
          [0.2, 2.0, 0],
        ],
        0.16,
        4,
      ),
      this.yellowClone,
    )
    this.twistArc.enabled = false

    const counterObj = this.makeChild(this.stage, "TwistCounter")
    this.twistCounterLabel = counterObj.createComponent("Component.Text") as Text
    this.twistCounterLabel.size = 30
    this.twistCounterLabel.horizontalAlignment = HorizontalAlignment.Center
    counterObj.getTransform().setLocalPosition(new vec3(0, 6.5, Z_LIVE))
    counterObj.enabled = false

    const crossLblObj = this.makeChild(this.stage, "TwistCrossLabel")
    this.twistCrossLabel = crossLblObj.createComponent("Component.Text") as Text
    this.twistCrossLabel.size = 28
    this.twistCrossLabel.horizontalAlignment = HorizontalAlignment.Center
    this.twistCrossLabel.text = "cross at the middle"
    crossLblObj.getTransform().setLocalPosition(new vec3(0, 5.8, Z_LIVE))
    crossLblObj.enabled = false
  }

  private buildFoldHelpers() {
    const mkDownArrow = (name: string): SceneObject => {
      const o = this.makeChild(this.stage, name)
      this.applyMesh(
        o,
        buildSimpleTube(
          [
            [0, 0, 0],
            [0.9, -2.4, 0],
          ],
          0.18,
          5,
        ),
        this.yellowClone,
      )
      const tip = this.makeChild(o, "Tip")
      this.applyMesh(
        tip,
        buildSimpleTube(
          [
            [0.2, -1.8, 0],
            [1.15, -2.7, 0],
            [0.55, -1.5, 0],
          ],
          0.16,
          4,
        ),
        this.yellowClone,
      )
      o.enabled = false
      return o
    }
    this.foldArrowL = mkDownArrow("FoldArrowL")
    this.foldArrowR = mkDownArrow("FoldArrowR")
    this.foldArrowR.getTransform().setLocalScale(new vec3(-1, 1, 1))

    const mkPinch = (name: string, dir: number): SceneObject => {
      const o = this.makeChild(this.stage, name)
      this.applyMesh(
        o,
        buildSimpleTube(
          [
            [0, 0, 0],
            [dir * 1.8, 0, 0],
          ],
          0.18,
          5,
        ),
        this.yellowClone,
      )
      const tip = this.makeChild(o, "Tip")
      this.applyMesh(
        tip,
        buildSimpleTube(
          [
            [dir * 1.2, -0.7, 0],
            [dir * 2.0, 0, 0],
            [dir * 1.2, 0.7, 0],
          ],
          0.15,
          4,
        ),
        this.yellowClone,
      )
      o.enabled = false
      return o
    }
    // Point inward: left arrow points +X, right points -X
    this.pinchArrowL = mkPinch("PinchArrowL", 1)
    this.pinchArrowR = mkPinch("PinchArrowR", -1)

    const lbl = this.makeChild(this.stage, "FoldActionLabel")
    this.foldActionLabel = lbl.createComponent("Component.Text") as Text
    this.foldActionLabel.size = 28
    this.foldActionLabel.horizontalAlignment = HorizontalAlignment.Center
    lbl.getTransform().setLocalPosition(new vec3(0, 7.2, Z_LIVE))
    lbl.enabled = false
  }

  private buildSpiralHelpers() {
    this.spiralWindArc = this.makeChild(this.stage, "SpiralWindArc")
    const arcPts: Vec3[] = []
    for (let i = 0; i <= 28; i++) {
      const a = 0.25 + ((2.9 - 0.25) * i) / 28
      arcPts.push([2.5 * Math.cos(a), 0.7 * Math.sin(a), 0])
    }
    this.applyMesh(this.spiralWindArc, buildSimpleTube(arcPts, 0.16, 5), this.yellowClone)
    const tip = this.makeChild(this.spiralWindArc, "Tip")
    this.applyMesh(
      tip,
      buildSimpleTube(
        [
          [-2.0, 0.2, 0],
          [-2.55, -0.15, 0],
          [-1.85, -0.35, 0],
        ],
        0.14,
        4,
      ),
      this.yellowClone,
    )
    this.spiralWindArc.enabled = false

    const lbl = this.makeChild(this.stage, "SpiralActionLabel")
    this.spiralActionLabel = lbl.createComponent("Component.Text") as Text
    this.spiralActionLabel.size = 28
    this.spiralActionLabel.horizontalAlignment = HorizontalAlignment.Center
    lbl.getTransform().setLocalPosition(new vec3(5.5, 0, Z_LIVE))
    lbl.enabled = false
  }

  private buildAssembleHelpers() {
    this.leafObjA = this.makeChild(this.stage, "LeafA")
    this.leafObjB = this.makeChild(this.stage, "LeafB")
    this.leafObjA.enabled = false
    this.leafObjB.enabled = false

    this.wireObj = this.makeChild(this.stage, "StemWire")
    this.wireObj.enabled = false

    // Scissors: two blades + finger rings
    this.scissorsObj = this.makeChild(this.stage, "Scissors")
    const bladeL = this.makeChild(this.scissorsObj, "BladeL")
    this.applyMesh(
      bladeL,
      buildSimpleTube(
        [
          [-1.8, 2.0, 0],
          [0.6, -0.7, 0],
        ],
        0.12,
        5,
      ),
      this.steelClone,
    )
    const bladeR = this.makeChild(this.scissorsObj, "BladeR")
    this.applyMesh(
      bladeR,
      buildSimpleTube(
        [
          [1.8, 2.0, 0],
          [-0.6, -0.7, 0],
        ],
        0.12,
        5,
      ),
      this.steelClone,
    )
    const ringL = this.makeChild(this.scissorsObj, "RingL")
    const ringR = this.makeChild(this.scissorsObj, "RingR")
    const ringPts = (ox: number): Vec3[] => {
      const pts: Vec3[] = []
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2
        pts.push([ox + Math.cos(a) * 0.5, -1.35 + Math.sin(a) * 0.5, 0])
      }
      return pts
    }
    this.applyMesh(ringL, buildSimpleTube(ringPts(-0.85), 0.08, 5), this.steelClone)
    this.applyMesh(ringR, buildSimpleTube(ringPts(0.85), 0.08, 5), this.steelClone)
    this.scissorsObj.enabled = false

    // Glue gun: nozzle tip at local origin
    this.glueGunObj = this.makeChild(this.stage, "GlueGun")
    const nozzle = this.makeChild(this.glueGunObj, "Nozzle")
    this.applyMesh(
      nozzle,
      buildSimpleTube(
        [
          [0.25, 0, 0],
          [0.75, 0, 0],
        ],
        0.18,
        5,
      ),
      this.steelClone,
    )
    const body = this.makeChild(this.glueGunObj, "Body")
    this.applyMesh(
      body,
      buildSimpleTube(
        [
          [0.8, 0, 0],
          [3.2, 0, 0],
        ],
        0.55,
        6,
      ),
      this.gunOrangeClone,
    )
    const handle = this.makeChild(this.glueGunObj, "Handle")
    this.applyMesh(
      handle,
      buildSimpleTube(
        [
          [2.2, -0.4, 0],
          [2.6, -2.2, 0],
        ],
        0.35,
        5,
      ),
      this.gunOrangeClone,
    )
    const stick = this.makeChild(this.glueGunObj, "GlueStick")
    this.applyMesh(
      stick,
      buildSimpleTube(
        [
          [3.1, 0, 0],
          [4.4, 0, 0],
        ],
        0.22,
        5,
      ),
      this.glueClone,
    )
    this.glueGunObj.enabled = false

    this.glueBeadA = this.makeChild(this.stage, "GlueBeadA")
    this.glueBeadB = this.makeChild(this.stage, "GlueBeadB")
    this.glueBeadA.enabled = false
    this.glueBeadB.enabled = false

    const aLbl = this.makeChild(this.stage, "AssembleLabel")
    this.assembleLabel = aLbl.createComponent("Component.Text") as Text
    this.assembleLabel.size = 26
    this.assembleLabel.horizontalAlignment = HorizontalAlignment.Center
    aLbl.enabled = false

    const mLbl = this.makeChild(this.root, "MaterialsLabel")
    mLbl.getTransform().setLocalPosition(new vec3(0, 24, -50))
    this.materialsLabel = mLbl.createComponent("Component.Text") as Text
    this.materialsLabel.size = 22
    this.materialsLabel.horizontalAlignment = HorizontalAlignment.Center
    this.materialsLabel.text =
      "Materials: purple pipe cleaners · green pipe cleaner · thin stick · scissors · stem wire · hot glue gun"
    mLbl.enabled = false
  }

  private cloneMat(src: Material, color: vec4, transparent: boolean): Material {
    const m = src.clone()
    m.mainPass.baseColor = color
    m.mainPass.twoSided = true
    m.mainPass.depthTest = true
    m.mainPass.depthWrite = !transparent
    if (transparent) {
      m.mainPass.blendMode = BlendMode.PremultipliedAlpha
    }
    return m
  }

  private makeChild(parent: SceneObject, name: string): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    return o
  }

  private buildLabels() {
    // Keep text above the animation band
    const titleObj = this.makeChild(this.root, "Title")
    titleObj.getTransform().setLocalPosition(new vec3(0, 36, -50))
    this.titleText = titleObj.createComponent("Component.Text") as Text
    this.titleText.text = "Step 1 — Coil"
    this.titleText.size = 52
    this.titleText.horizontalAlignment = HorizontalAlignment.Center
    this.titleText.verticalAlignment = VerticalAlignment.Center

    const hintObj = this.makeChild(this.root, "Hint")
    hintObj.getTransform().setLocalPosition(new vec3(0, 30, -50))
    this.hintText = hintObj.createComponent("Component.Text") as Text
    this.hintText.text = "Pinch Next / Back / Replay"
    this.hintText.size = 28
    this.hintText.horizontalAlignment = HorizontalAlignment.Center
  }

  private buildHands() {
    this.handL = this.makeChild(this.stage, "HandL")
    this.handR = this.makeChild(this.stage, "HandR")
    this.applyMesh(this.handL, this.makeHandOutlineMesh(), this.handClone)
    this.applyMesh(this.handR, this.makeHandOutlineMesh(), this.handClone)
  }

  private makeHandOutlineMesh(): RenderMesh {
    const ring: Vec3[] = []
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 1.6 + 0.3
      ring.push([Math.cos(a) * 2.2, Math.sin(a) * 2.8, 0])
    }
    return buildSimpleTube(ring, 0.18, 6)
  }

  private buildArrow() {
    this.arrowObj = this.makeChild(this.stage, "Arrow")
    const shaft: Vec3[] = [
      [0, 0, 0],
      [0, 4, 0],
    ]
    const head: Vec3[] = [
      [-1.2, 3.2, 0],
      [0, 5.2, 0],
      [1.2, 3.2, 0],
    ]
    this.applyMesh(this.arrowObj, buildSimpleTube(shaft, 0.25, 6), this.yellowClone)
    const tip = this.makeChild(this.arrowObj, "ArrowTip")
    this.applyMesh(tip, buildSimpleTube(head, 0.2, 5), this.yellowClone)
  }

  private buildBee() {
    this.beeObj = this.makeChild(this.stage, "Bee")
    const body: Vec3[] = []
    for (let i = 0; i <= 16; i++) {
      const u = i / 16
      const a = u * Math.PI * 2
      body.push([Math.cos(a) * 1.1, Math.sin(a) * 0.7, 0])
    }
    this.applyMesh(this.beeObj, buildSimpleTube(body, 0.35, 8), this.cloneMat(this.yellowMat, new vec4(1, 0.85, 0.1, 1), false))
  }

  private buildStick() {
    this.stickObj = this.makeChild(this.stage, "ThinStick")
    // Horizontal thin stick for coiling (along +X)
    const stick: Vec3[] = [
      [-8, 0, 0],
      [8, 0, 0],
    ]
    this.applyMesh(this.stickObj, buildSimpleTube(stick, 0.12, 6), this.stickClone)
    this.stickObj.enabled = false
  }

  private buildStretchHelpers() {
    this.holdMarker = this.makeChild(this.stage, "HoldMarker")
    const holdRing: Vec3[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2
      holdRing.push([Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0])
    }
    this.applyMesh(this.holdMarker, buildSimpleTube(holdRing, 0.15, 6), this.markerClone)
    const holdLabel = this.makeChild(this.holdMarker, "HoldLabel")
    holdLabel.getTransform().setLocalPosition(new vec3(0, -2.2, 0))
    const ht = holdLabel.createComponent("Component.Text") as Text
    ht.text = "HOLD"
    ht.size = 24
    ht.horizontalAlignment = HorizontalAlignment.Center
    this.holdMarker.enabled = false

    this.pullArrow = this.makeChild(this.stage, "PullArrow")
    // Large pull arrow pointing +X (sideways)
    const shaft: Vec3[] = [
      [0, 0, 0],
      [5.5, 0, 0],
    ]
    const head: Vec3[] = [
      [4.2, -1.6, 0],
      [6.8, 0, 0],
      [4.2, 1.6, 0],
      [4.2, -1.6, 0],
    ]
    this.applyMesh(this.pullArrow, buildSimpleTube(shaft, 0.35, 6), this.yellowClone)
    const tip = this.makeChild(this.pullArrow, "Tip")
    this.applyMesh(tip, buildSimpleTube(head, 0.28, 5), this.yellowClone)
    const pullLabel = this.makeChild(this.pullArrow, "PullLabel")
    pullLabel.getTransform().setLocalPosition(new vec3(2.5, 2.4, 0))
    this.pullArrowLabel = pullLabel.createComponent("Component.Text") as Text
    this.pullArrowLabel.text = "PULL"
    this.pullArrowLabel.size = 28
    this.pullArrowLabel.horizontalAlignment = HorizontalAlignment.Center
    this.pullArrow.enabled = false

    this.rulerObj = this.makeChild(this.stage, "Ruler")
    const rulerLabelObj = this.makeChild(this.rulerObj, "RulerLabel")
    rulerLabelObj.getTransform().setLocalPosition(new vec3(0, -2.8, 0))
    this.rulerLabel = rulerLabelObj.createComponent("Component.Text") as Text
    this.rulerLabel.text = "0 cm"
    this.rulerLabel.size = 26
    this.rulerLabel.horizontalAlignment = HorizontalAlignment.Center
    this.rulerObj.enabled = false

    // Step 1 wrap labels (hold / 0.5 in / wrap / slide)
    const mkLabel = (name: string, size: number): Text => {
      const o = this.makeChild(this.stage, name)
      const t = o.createComponent("Component.Text") as Text
      t.size = size
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      o.enabled = false
      return t
    }
    this.wrapActionLabel = mkLabel("WrapActionLabel", 28)
    this.wrapTailLabelL = mkLabel("WrapTailL", 22)
    this.wrapTailLabelR = mkLabel("WrapTailR", 22)
    this.wrapTailLabelL.text = "0.5 in"
    this.wrapTailLabelR.text = "0.5 in"
  }

  private buildNavButtons() {
    // Buttons well below the animation band
    const bar = this.makeChild(this.root, "NavBar")
    bar.getTransform().setLocalPosition(new vec3(0, -34, -48))

    this.makeButton(bar, "Back", new vec3(-12, 0, 0), () => this.onBack())
    this.makeButton(bar, "Replay", new vec3(0, 0, 0), () => this.onReplay())
    this.makeButton(bar, "Next", new vec3(12, 0, 0), () => this.onNext())
  }

  private makeButton(parent: SceneObject, label: string, pos: vec3, onPinch: () => void) {
    const btn = this.makeChild(parent, "Btn_" + label)
    btn.getTransform().setLocalPosition(pos)

    const plate: Vec3[] = [
      [-3.5, -1.4, 0],
      [3.5, -1.4, 0],
      [3.5, 1.4, 0],
      [-3.5, 1.4, 0],
      [-3.5, -1.4, 0],
    ]
    this.applyMesh(btn, buildSimpleTube(plate, 0.35, 4), this.uiClone)

    const labelObj = this.makeChild(btn, "Label")
    labelObj.getTransform().setLocalPosition(new vec3(0, 0, 0.5))
    const t = labelObj.createComponent("Component.Text") as Text
    t.text = label
    t.size = 32
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center

    const collider = btn.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(8, 3.5, 2)
    collider.shape = shape
    collider.fitVisual = false

    const interactable = btn.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onTriggerStart.add(() => {
      print("[FlowerGuide] pinched " + label)
      onPinch()
    })
  }

  private ensureStrandSlots(count: number) {
    while (this.strandObjs.length < count) {
      const i = this.strandObjs.length
      const s = this.makeChild(this.stage, "Strand_" + i)
      const o = this.makeChild(this.stage, "Outline_" + i)
      this.strandObjs.push(s)
      this.outlineObjs.push(o)
    }
    for (let i = 0; i < this.strandObjs.length; i++) {
      this.strandObjs[i].enabled = i < count
      this.outlineObjs[i].enabled = false
    }
  }

  private applyMesh(obj: SceneObject, mesh: RenderMesh, mat: Material) {
    let rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (!rmv) {
      rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    }
    rmv.mesh = mesh
    rmv.mainMaterial = mat
  }

  private setStrandMeshes(paths: Vec3[][], radius: number, ridge: number, fibers: number, asOutline: boolean) {
    const objs = asOutline ? this.outlineObjs : this.strandObjs
    const mat = asOutline ? this.yellowClone : this.purpleClone
    const r = asOutline ? radius * OUTLINE_SCALE : radius
    const rad = asOutline ? 6 : 7
    // No fuzz until shapes read clearly
    const fib = 0
    for (let i = 0; i < objs.length; i++) {
      if (i >= paths.length) {
        objs[i].enabled = false
        continue
      }
      objs[i].enabled = true
      this.applyMesh(objs[i], buildFuzzyTube(paths[i], r, rad, ridge, fib), mat)
    }
  }

  private setClearTube(obj: SceneObject, path: Vec3[], radius: number, mat: Material, ridge: number = 0.15) {
    obj.enabled = true
    this.applyMesh(obj, buildFuzzyTube(path, radius, 8, ridge, 0), mat)
  }

  // ---- Step machine ----

  private goToStep(step: StepId, restart: boolean) {
    this.step = step
    this.phase = "holdStart"
    this.phaseT = 0
    this.loopGen++
    this.lastMeshT = -1
    this.configureStepPaths()
    this.hideStretchHelpers()
    if (this.step === 1 || this.step === 2) {
      this.setupCoilStretchVisuals(0)
    } else if (this.step === 3) {
      this.setupTwistVisuals(0)
    } else if (this.step === 4) {
      this.setupFoldVisuals(0)
    } else if (this.step === 5) {
      this.setupSpiralVisuals(0)
    } else if (this.step === 6) {
      this.setupCutLeavesVisuals(0)
    } else if (this.step === 7) {
      this.setupGlueHeadVisuals(0)
    } else {
      this.setupGlueLeavesVisuals(0)
    }
    // Assemble steps need more height in frame (head + bare stem + leaves)
    const assemble = this.step >= 7
    const sc = assemble ? ASSEMBLE_STAGE_SCALE : 1.5
    this.stage.getTransform().setLocalScale(new vec3(sc, sc, sc))
    this.stage.getTransform().setLocalPosition(new vec3(0, assemble ? 4 : 0, -60))
    this.updateChrome()
    print("[FlowerGuide] enter step " + step + (restart ? " (restart)" : ""))
  }

  private configureStepPaths() {
    if (this.step === 1) {
      // Wrap animation driven by wrapPoints() — paths filled each frame
      this.ensureStrandSlots(1)
      this.startPaths = [wrapPoints(0, WRAP_ORIGIN_X, Z_LIVE)]
      this.endPaths = [wrapPoints(1, WRAP_ORIGIN_X, Z_LIVE)]
    } else if (this.step === 2) {
      // Unchanged stretch — start coil matches wrap finish (shared WRAP_* constants)
      this.ensureStrandSlots(2)
      const leftX = WRAP_ORIGIN_X
      const live0 = makeStretchingHorizontalCoil(0, leftX, COIL_START_LEN, STRETCH_LEN, COIL_TURNS, COIL_START_R, COIL_END_R, PATH_SAMPLES, Z_LIVE)
      const live1 = makeStretchingHorizontalCoil(1, leftX, COIL_START_LEN, STRETCH_LEN, COIL_TURNS, COIL_START_R, COIL_END_R, PATH_SAMPLES, Z_LIVE)
      this.startPaths = [live0]
      this.endPaths = [live1]
    } else if (this.step === 3) {
      // HTML twistPoints — driven each frame; keep start/end for reference
      this.ensureStrandSlots(2)
      this.startPaths = [twistPoints(1, 0, 0, Z_LIVE), twistPoints(-1, 0, 0, Z_LIVE)]
      this.endPaths = [twistPoints(1, 1, 1, Z_LIVE), twistPoints(-1, 1, 1, Z_LIVE)]
    } else if (this.step === 4) {
      this.ensureStrandSlots(2)
      this.startPaths = [foldPoints(1, 0, 0, Z_LIVE), foldPoints(-1, 0, 0, Z_LIVE)]
      this.endPaths = [foldPoints(1, 1, 1, Z_LIVE), foldPoints(-1, 1, 1, Z_LIVE)]
    } else if (this.step === 5) {
      this.ensureStrandSlots(2)
      this.startPaths = [spiralPoints(1, 0, Z_LIVE), spiralPoints(-1, 0, Z_LIVE)]
      this.endPaths = [spiralPoints(1, 1, Z_LIVE), spiralPoints(-1, 1, Z_LIVE)]
    } else {
      // Steps 6–8 rebuild meshes each frame from HTML timelines
      this.ensureStrandSlots(2)
      this.startPaths = []
      this.endPaths = []
    }
  }

  private hideOutlines() {
    for (const o of this.outlineObjs) o.enabled = false
  }

  private hideStretchHelpers() {
    this.holdMarker.enabled = false
    this.pullArrow.enabled = false
    this.rulerObj.enabled = false
    this.stickObj.enabled = false
    if (this.wrapActionLabel) this.wrapActionLabel.getSceneObject().enabled = false
    if (this.wrapTailLabelL) this.wrapTailLabelL.getSceneObject().enabled = false
    if (this.wrapTailLabelR) this.wrapTailLabelR.getSceneObject().enabled = false
    this.hideTwistHelpers()
  }

  private hideTwistHelpers() {
    if (this.crossArrowTop) this.crossArrowTop.enabled = false
    if (this.crossArrowBot) this.crossArrowBot.enabled = false
    if (this.twistArc) this.twistArc.enabled = false
    if (this.twistCounterLabel) this.twistCounterLabel.getSceneObject().enabled = false
    if (this.twistCrossLabel) this.twistCrossLabel.getSceneObject().enabled = false
    this.hideFoldHelpers()
    this.hideSpiralHelpers()
  }

  private hideFoldHelpers() {
    if (this.foldArrowL) this.foldArrowL.enabled = false
    if (this.foldArrowR) this.foldArrowR.enabled = false
    if (this.pinchArrowL) this.pinchArrowL.enabled = false
    if (this.pinchArrowR) this.pinchArrowR.enabled = false
    if (this.foldActionLabel) this.foldActionLabel.getSceneObject().enabled = false
  }

  private hideSpiralHelpers() {
    if (this.spiralWindArc) this.spiralWindArc.enabled = false
    if (this.spiralActionLabel) this.spiralActionLabel.getSceneObject().enabled = false
    this.hideAssembleHelpers()
  }

  private hideAssembleHelpers() {
    if (this.leafObjA) this.leafObjA.enabled = false
    if (this.leafObjB) this.leafObjB.enabled = false
    if (this.wireObj) this.wireObj.enabled = false
    if (this.scissorsObj) this.scissorsObj.enabled = false
    if (this.glueGunObj) this.glueGunObj.enabled = false
    if (this.glueBeadA) this.glueBeadA.enabled = false
    if (this.glueBeadB) this.glueBeadB.enabled = false
    if (this.assembleLabel) this.assembleLabel.getSceneObject().enabled = false
  }

  private setGlueBead(obj: SceneObject, amount: number, pos: vec3) {
    if (amount <= 0.01) {
      obj.enabled = false
      return
    }
    obj.enabled = true
    obj.getTransform().setLocalPosition(pos)
    obj.getTransform().setLocalScale(new vec3(amount, amount, amount))
    // Three soft blobs (HTML glue dab)
    const blobs: Vec3[] = [
      [0, 0.15, 0],
      [0.12, -0.05, 0.05],
      [-0.1, -0.2, -0.05],
    ]
    this.applyMesh(obj, buildSimpleTube(blobs, 0.35 * amount + 0.08, 6), this.glueClone)
  }

  private liftPath(pts: Vec3[], yLift: number): Vec3[] {
    if (yLift === 0) return pts
    return pts.map((p) => [p[0], p[1] + yLift, p[2]] as Vec3)
  }

  /**
   * Step 4 timeline from reference HTML:
   * f = ease((t-0.15)/0.45), pinch = ease((t-0.7)/0.15)
   * Starts from finished twist; fold ends down, then pinch the top.
   */
  private setupFoldVisuals(timeline: number) {
    const t = clamp01(timeline)
    const f = easeSmooth((t - 0.15) / 0.45)
    const pinch = easeSmooth((t - 0.7) / 0.15)
    // HTML shifts view up as fold progresses (oy = 250 - 150*f)
    const yLift = 4.4 * f

    this.hideOutlines()
    this.hideSpiralHelpers()
    this.stickObj.enabled = false
    this.rulerObj.enabled = false
    this.pullArrow.enabled = false
    this.holdMarker.enabled = false
    if (this.wrapActionLabel) this.wrapActionLabel.getSceneObject().enabled = false
    if (this.wrapTailLabelL) this.wrapTailLabelL.getSceneObject().enabled = false
    if (this.wrapTailLabelR) this.wrapTailLabelR.getSceneObject().enabled = false

    this.ensureStrandSlots(2)
    const stickR = COIL_END_R * 1.15
    const pathA = this.liftPath(foldPoints(1, f, pinch, Z_LIVE), yLift)
    const pathB = this.liftPath(foldPoints(-1, f, pinch, Z_LIVE), yLift)
    this.setClearTube(this.strandObjs[0], pathA, stickR, this.purpleClone, 0.32)
    this.setClearTube(this.strandObjs[1], pathB, stickR, this.purpleCloneB, 0.32)
    for (let i = 2; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    this.foldActionLabel.getSceneObject().enabled = true
    this.foldActionLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 7.2 + yLift * 0.15, Z_LIVE))

    if (t < 0.62) {
      this.foldActionLabel.text = "fold the ends down"
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
      this.foldArrowL.enabled = true
      this.foldArrowR.enabled = true
      // HTML: arrows near ends, angling down as fold progresses
      const ax = 8.8 - 3.5 * f
      const ay = 2.4 - 1.8 * f + yLift
      this.foldArrowL.getTransform().setLocalPosition(new vec3(-ax, ay, Z_LIVE))
      this.foldArrowR.getTransform().setLocalPosition(new vec3(ax, ay, Z_LIVE))
    } else {
      this.foldActionLabel.text = "pinch the top gently"
      this.foldArrowL.enabled = false
      this.foldArrowR.enabled = false
      this.pinchArrowL.enabled = true
      this.pinchArrowR.enabled = true
      const gap = 3.5 - 1.3 * pinch
      const py = yLift + 1.6
      this.pinchArrowL.getTransform().setLocalPosition(new vec3(-gap - 1.5, py, Z_LIVE))
      this.pinchArrowR.getTransform().setLocalPosition(new vec3(gap + 1.5, py, Z_LIVE))
    }
  }

  /**
   * Step 5 timeline from reference HTML:
   * w = clamp((t-0.12)/0.72)
   * Starts from pinched fold; wind four ends into one rope, top to bottom.
   */
  private setupSpiralVisuals(timeline: number) {
    const t = clamp01(timeline)
    const w = clamp01((t - 0.12) / 0.72)
    // HTML oy≈100 — keep hanging rope in frame
    const yLift = 6.5

    this.hideOutlines()
    this.hideFoldHelpers()
    this.stickObj.enabled = false
    this.rulerObj.enabled = false
    this.pullArrow.enabled = false
    if (this.wrapActionLabel) this.wrapActionLabel.getSceneObject().enabled = false
    if (this.wrapTailLabelL) this.wrapTailLabelL.getSceneObject().enabled = false
    if (this.wrapTailLabelR) this.wrapTailLabelR.getSceneObject().enabled = false

    this.ensureStrandSlots(2)
    const stickR = COIL_END_R * 1.15
    const pathA = this.liftPath(spiralPoints(1, w, Z_LIVE), yLift)
    const pathB = this.liftPath(spiralPoints(-1, w, Z_LIVE), yLift)
    this.setClearTube(this.strandObjs[0], pathA, stickR, this.purpleClone, 0.32)
    this.setClearTube(this.strandObjs[1], pathB, stickR, this.purpleCloneB, 0.32)
    for (let i = 2; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    // Hold at top (HTML hold near fold tip)
    this.holdMarker.enabled = true
    this.holdMarker.getTransform().setLocalPosition(new vec3(-0.95, yLift + 0.65, Z_LIVE))

    this.spiralActionLabel.getSceneObject().enabled = true
    if (w < 1) {
      this.spiralActionLabel.text = "twist downward"
      this.spiralWindArc.enabled = true
      const ay = yLift + 0.9 - w * HANG
      this.spiralWindArc.getTransform().setLocalPosition(new vec3(0, ay, Z_LIVE))
      this.spiralActionLabel.getSceneObject().getTransform().setLocalPosition(new vec3(5.6, ay, Z_LIVE))
    } else {
      this.spiralWindArc.enabled = false
      this.spiralActionLabel.text = "flower head done"
      this.spiralActionLabel.getSceneObject().getTransform().setLocalPosition(new vec3(5.6, yLift - 4.5, Z_LIVE))
    }
  }

  /**
   * Step 6: Cut the leaves — green pipe cleaner halved, tips trimmed to points.
   * cut = ease((t-0.32)/0.15), trim = ease((t-0.65)/0.2)
   */
  private setupCutLeavesVisuals(timeline: number) {
    const t = clamp01(timeline)
    const cut = easeSmooth((t - 0.32) / 0.15)
    const trim = easeSmooth((t - 0.65) / 0.2)
    const gap = 3 * cut

    this.hideOutlines()
    this.hideFoldHelpers()
    this.hideSpiralHelpers()
    this.holdMarker.enabled = false
    this.pullArrow.enabled = false
    this.stickObj.enabled = false
    this.rulerObj.enabled = false
    for (const o of this.strandObjs) o.enabled = false

    const baseA: Vec3 = [-15 * (1 - cut) - 7.5 * cut, gap, Z_LIVE]
    const baseB: Vec3 = [-7.5 * cut, -gap, Z_LIVE]
    this.leafObjA.enabled = true
    this.leafObjB.enabled = true
    this.applyMesh(this.leafObjA, buildLeafMesh(baseA, Math.PI / 2, trim), this.greenClone)
    this.applyMesh(this.leafObjB, buildLeafMesh(baseB, Math.PI / 2, trim), this.greenClone)

    this.assembleLabel.getSceneObject().enabled = true
    this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 7.5, Z_LIVE))

    if (t < 0.34) {
      this.assembleLabel.text = "cut in the middle"
      this.scissorsObj.enabled = true
      const open = 1 - easeSmooth((t - 0.16) / 0.16)
      this.scissorsObj.getTransform().setLocalPosition(new vec3(0, 0, Z_LIVE))
      this.scissorsObj.getTransform().setLocalScale(new vec3(1.2 + open * 0.4, 1.2, 1.2))
    } else if (t > 0.55 && t < 0.9) {
      this.assembleLabel.text = "trim the tips"
      this.scissorsObj.enabled = true
      const snip = 1 - easeSmooth((t - 0.62) / 0.12)
      this.scissorsObj.getTransform().setLocalPosition(new vec3(7.5 - 1.0, gap * 0.2, Z_LIVE))
      this.scissorsObj.getTransform().setLocalScale(new vec3(0.9 + snip * 0.35, 0.9, 0.9))
    } else if (t >= 0.9) {
      this.assembleLabel.text = "two pointed leaves"
      this.scissorsObj.enabled = false
    } else {
      this.assembleLabel.text = "cut in the middle"
      this.scissorsObj.enabled = false
    }
  }

  /**
   * Step 7: Glue flower head onto bare stem wire.
   * dab = clamp((t-0.1)/0.22), join = ease((t-0.4)/0.22)
   * Head = exact finished step-5 spiral. Careful: hot.
   */
  private setupGlueHeadVisuals(timeline: number) {
    const t = clamp01(timeline)
    const dab = clamp01((t - 0.1) / 0.22)
    const join = easeSmooth((t - 0.4) / 0.22)
    const dx = -7 * (1 - join)
    const yLift = ASSEMBLE_Y_LIFT

    this.hideOutlines()
    this.hideFoldHelpers()
    this.hideSpiralHelpers()
    this.pullArrow.enabled = false
    this.stickObj.enabled = false
    this.rulerObj.enabled = false

    this.ensureStrandSlots(2)
    const stickR = COIL_END_R * 1.15
    const [headA, headB] = finishedHeadPaths(dx, Z_LIVE)
    this.setClearTube(this.strandObjs[0], this.liftPath(headA, yLift), stickR, this.purpleClone, 0.32)
    this.setClearTube(this.strandObjs[1], this.liftPath(headB, yLift), stickR, this.purpleCloneB, 0.32)
    for (let i = 2; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    this.wireObj.enabled = true
    this.applyMesh(this.wireObj, buildSimpleTube(this.liftPath(stemWirePoints(Z_LIVE), yLift), 0.15, 5), this.wireClone)

    const joinY = yLift - HANG + 0.6
    this.setGlueBead(this.glueBeadA, dab, new vec3(0, joinY, Z_LIVE))
    this.glueBeadB.enabled = false

    this.assembleLabel.getSceneObject().enabled = true
    if (t < 0.36) {
      this.holdMarker.enabled = false
      this.glueGunObj.enabled = true
      this.glueGunObj.getTransform().setLocalPosition(new vec3(0.15, joinY, Z_LIVE))
      this.assembleLabel.text = "add hot glue  ·  Careful: it is hot"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(4.5, joinY + 1.2, Z_LIVE))
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
    } else if (t < 0.64) {
      this.glueGunObj.enabled = false
      this.holdMarker.enabled = false
      this.assembleLabel.text = "press the head on"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(-5.5, joinY - 2.2, Z_LIVE))
      this.pinchArrowL.enabled = true
      this.pinchArrowR.enabled = false
      this.pinchArrowL.getTransform().setLocalPosition(new vec3(dx - 2.5, joinY, Z_LIVE))
    } else {
      this.glueGunObj.enabled = false
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
      this.holdMarker.enabled = true
      this.holdMarker.getTransform().setLocalPosition(new vec3(0, joinY, Z_LIVE))
      const left = Math.max(0, Math.ceil(20 * (1 - (t - 0.64) / 0.24)))
      this.assembleLabel.text = left > 0 ? `hold still: ${left} s  ·  Careful: it is hot` : "set"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(5.5, joinY, Z_LIVE))
    }
  }

  /**
   * Step 8: Glue both pointed leaves onto the bare stem.
   * Starts from finished step 7 (head already glued). Hot glue only — no floral tape.
   */
  private setupGlueLeavesVisuals(timeline: number) {
    const t = clamp01(timeline)
    const dab = clamp01((t - 0.1) / 0.22)
    const add = easeSmooth((t - 0.4) / 0.22)
    const base = -HANG - 7
    const off = 8 * (1 - add)
    const yLift = ASSEMBLE_Y_LIFT

    this.hideOutlines()
    this.hideFoldHelpers()
    this.hideSpiralHelpers()
    this.pullArrow.enabled = false
    this.stickObj.enabled = false
    this.rulerObj.enabled = false

    this.ensureStrandSlots(2)
    const stickR = COIL_END_R * 1.15
    const [headA, headB] = finishedHeadPaths(0, Z_LIVE)
    this.setClearTube(this.strandObjs[0], this.liftPath(headA, yLift), stickR, this.purpleClone, 0.32)
    this.setClearTube(this.strandObjs[1], this.liftPath(headB, yLift), stickR, this.purpleCloneB, 0.32)
    for (let i = 2; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    this.wireObj.enabled = true
    this.applyMesh(this.wireObj, buildSimpleTube(this.liftPath(stemWirePoints(Z_LIVE), yLift), 0.15, 5), this.wireClone)

    // Head joint glue stays; leaf glue grows
    this.setGlueBead(this.glueBeadA, 1, new vec3(0, yLift - HANG + 0.6, Z_LIVE))
    const leafJoinY = yLift + base
    this.setGlueBead(this.glueBeadB, dab, new vec3(0, leafJoinY, Z_LIVE))

    this.leafObjA.enabled = true
    this.leafObjB.enabled = true
    this.applyMesh(this.leafObjA, buildLeafMesh([-off, base, Z_LIVE - 0.3], -0.5, 1), this.greenClone)
    this.applyMesh(this.leafObjB, buildLeafMesh([off, base, Z_LIVE - 0.3], 0.5, 1), this.greenClone)
    this.leafObjA.getTransform().setLocalPosition(new vec3(0, yLift, 0))
    this.leafObjB.getTransform().setLocalPosition(new vec3(0, yLift, 0))

    this.assembleLabel.getSceneObject().enabled = true
    if (t < 0.36) {
      this.holdMarker.enabled = false
      this.glueGunObj.enabled = true
      this.glueGunObj.getTransform().setLocalPosition(new vec3(0.15, leafJoinY, Z_LIVE))
      this.assembleLabel.text = "add hot glue  ·  Careful: it is hot"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(4.5, leafJoinY + 1.2, Z_LIVE))
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
    } else if (t < 0.64) {
      this.glueGunObj.enabled = false
      this.holdMarker.enabled = false
      this.assembleLabel.text = "press both leaves on"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(6.2, leafJoinY + 1.8, Z_LIVE))
      this.pinchArrowL.enabled = true
      this.pinchArrowR.enabled = true
      this.pinchArrowL.getTransform().setLocalPosition(new vec3(-off - 1.5, leafJoinY, Z_LIVE))
      this.pinchArrowR.getTransform().setLocalPosition(new vec3(off + 1.5, leafJoinY, Z_LIVE))
    } else if (t < 0.9) {
      this.glueGunObj.enabled = false
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
      this.holdMarker.enabled = true
      this.holdMarker.getTransform().setLocalPosition(new vec3(0, leafJoinY, Z_LIVE))
      const left = Math.max(0, Math.ceil(20 * (1 - (t - 0.64) / 0.24)))
      this.assembleLabel.text = left > 0 ? `hold still: ${left} s  ·  Careful: it is hot` : "set"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(5.5, leafJoinY, Z_LIVE))
    } else {
      this.glueGunObj.enabled = false
      this.holdMarker.enabled = false
      this.pinchArrowL.enabled = false
      this.pinchArrowR.enabled = false
      this.assembleLabel.text = "your flower is finished!"
      this.assembleLabel.getSceneObject().getTransform().setLocalPosition(new vec3(6.5, leafJoinY + 1.8, Z_LIVE))
    }
  }

  /**
   * Step 3 timeline from reference HTML:
   * cross = ease((t-0.1)/0.2), twist = clamp((t-0.38)/0.5)
   * Two equal 20 cm strands + 0.5 in tails, no offset, exactly 2 turns.
   */
  private setupTwistVisuals(timeline: number) {
    const t = clamp01(timeline)
    const cross = easeSmooth((t - 0.1) / 0.2)
    const twist = clamp01((t - 0.38) / 0.5)

    this.hideOutlines()
    this.stickObj.enabled = false
    this.rulerObj.enabled = false
    this.pullArrow.enabled = false
    if (this.wrapActionLabel) this.wrapActionLabel.getSceneObject().enabled = false
    if (this.wrapTailLabelL) this.wrapTailLabelL.getSceneObject().enabled = false
    if (this.wrapTailLabelR) this.wrapTailLabelR.getSceneObject().enabled = false

    this.ensureStrandSlots(2)
    // Match finished step-2 stick look (tube + ridge); path ripple from twistPoints END_R
    const pathA = twistPoints(1, cross, twist, Z_LIVE)
    const pathB = twistPoints(-1, cross, twist, Z_LIVE)
    const stickR = COIL_END_R * 1.15
    this.setClearTube(this.strandObjs[0], pathA, stickR, this.purpleClone, 0.32)
    this.setClearTube(this.strandObjs[1], pathB, stickR, this.purpleCloneB, 0.32)
    for (let i = 2; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    if (t < 0.34) {
      // Cross phase: arrows toward middle + label
      this.holdMarker.enabled = false
      this.twistArc.enabled = false
      this.crossArrowTop.enabled = true
      this.crossArrowBot.enabled = true
      this.crossArrowTop.getTransform().setLocalPosition(new vec3(0, 0, Z_LIVE))
      this.crossArrowBot.getTransform().setLocalPosition(new vec3(0, 0, Z_LIVE))
      this.twistCrossLabel.getSceneObject().enabled = true
      this.twistCrossLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 5.8, Z_LIVE))
      this.twistCounterLabel.getSceneObject().enabled = false
    } else {
      // Twist phase: hold at left of twist window + curved arrow + counter
      this.crossArrowTop.enabled = false
      this.crossArrowBot.enabled = false
      this.twistCrossLabel.getSceneObject().enabled = false

      this.holdMarker.enabled = true
      this.holdMarker.getTransform().setLocalPosition(new vec3(-TWIST_W / 2 - 0.2, 0, Z_LIVE))

      this.twistArc.enabled = true
      this.twistArc.getTransform().setLocalPosition(new vec3(TWIST_W / 2 + 0.4, 0, Z_LIVE))

      this.twistCounterLabel.getSceneObject().enabled = true
      if (twist < 1) {
        this.twistCounterLabel.text = twist < 0.5 ? "twist 1 of 2" : "twist 2 of 2"
      } else {
        this.twistCounterLabel.text = "done: joined in the middle"
      }
      this.twistCounterLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 5.8, Z_LIVE))
    }
  }

  /**
   * Step 1 timeline t in [0,1] from the HTML reference:
   * wrap p = (t-0.08)/0.67, stick slide off = ease((t-0.8)/0.18)
   */
  private setupWrapVisuals(timeline: number) {
    const t = clamp01(timeline)
    const p = clamp01((t - 0.08) / 0.67)
    const off = easeSmooth((t - 0.8) / 0.18)

    this.rulerObj.enabled = false
    this.hideOutlines()
    for (let i = 1; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

    // Stick slides out to the right; coil stays still
    this.stickObj.enabled = true
    const stickPath = wrapStickPoints(off, WRAP_ORIGIN_X, Z_LIVE)
    this.applyMesh(this.stickObj, buildSimpleTube(stickPath, 0.12, 6), this.stickClone)

    // Purple wrap path
    const pts = wrapPoints(p, WRAP_ORIGIN_X, Z_LIVE)
    this.setClearTube(this.strandObjs[0], pts, WRAP_WIRE, this.purpleClone, 0.05)

    // Hold marker on left 0.5 in tail
    const holdPos = new vec3(WRAP_ORIGIN_X - WRAP_TAIL * 0.5, WRAP_COIL_R, Z_LIVE)
    this.holdMarker.enabled = true
    this.holdMarker.getTransform().setLocalPosition(holdPos)
    // Match HTML: yellow "hold" ring — reuse green marker mat is ok; label below
    this.wrapTailLabelL.getSceneObject().enabled = true
    this.wrapTailLabelL.getSceneObject().getTransform().setLocalPosition(new vec3(holdPos.x, holdPos.y - 2.4, holdPos.z))

    if (p > 0.98) {
      this.wrapTailLabelR.getSceneObject().enabled = true
      this.wrapTailLabelR.getSceneObject().getTransform().setLocalPosition(
        new vec3(WRAP_ORIGIN_X + WRAP_COIL_LEN + WRAP_TAIL * 0.5, WRAP_COIL_R - 2.4, Z_LIVE),
      )
    } else {
      this.wrapTailLabelR.getSceneObject().enabled = false
    }

    if (t < 0.78) {
      // Wrap arrow at current helix tip (HTML: label 'wrap' + arrow to the right)
      const tip = helixPoint(p, WRAP_COIL_LEN, WRAP_COIL_R)
      const tipX = WRAP_ORIGIN_X + tip[0]
      const tipY = tip[1]
      this.pullArrow.enabled = true
      this.pullArrowLabel.text = "wrap"
      this.pullArrow.getTransform().setLocalPosition(new vec3(tipX + 1.2, tipY + 1.8, Z_LIVE))
      this.pullArrow.getTransform().setLocalScale(new vec3(1.0, 1.0, 1.0))
      this.wrapActionLabel.getSceneObject().enabled = false
    } else {
      this.pullArrow.enabled = false
      this.wrapActionLabel.text = "slide the stick out"
      this.wrapActionLabel.getSceneObject().enabled = true
      this.wrapActionLabel.getSceneObject().getTransform().setLocalPosition(new vec3(4, 5.5, Z_LIVE))
    }
  }

  private setupCoilStretchVisuals(t: number) {
    if (this.step === 1) {
      this.setupWrapVisuals(t)
    } else if (this.step === 2) {
      this.stickObj.enabled = false
      const leftX = WRAP_ORIGIN_X
      const curLen = lerp(COIL_START_LEN, STRETCH_LEN, t)

      // Start-length bracket ABOVE the live coil (separate band — no purple blend)
      this.ensureStrandSlots(3)
      const guide: Vec3[] = [
        [leftX, Y_START_GUIDE, Z_LIVE],
        [leftX + COIL_START_LEN, Y_START_GUIDE, Z_LIVE],
      ]
      const capL: Vec3[] = [
        [leftX, Y_START_GUIDE - 0.55, Z_LIVE],
        [leftX, Y_START_GUIDE + 0.55, Z_LIVE],
      ]
      const capR: Vec3[] = [
        [leftX + COIL_START_LEN, Y_START_GUIDE - 0.55, Z_LIVE],
        [leftX + COIL_START_LEN, Y_START_GUIDE + 0.55, Z_LIVE],
      ]
      this.applyMesh(this.outlineObjs[0], buildSimpleTube(guide, 0.06, 4), this.ghostClone)
      this.applyMesh(this.outlineObjs[1], buildSimpleTube(capL, 0.06, 4), this.ghostClone)
      this.applyMesh(this.outlineObjs[2], buildSimpleTube(capR, 0.06, 4), this.ghostClone)
      this.outlineObjs[0].enabled = true
      this.outlineObjs[1].enabled = true
      this.outlineObjs[2].enabled = true
      for (let i = 3; i < this.outlineObjs.length; i++) this.outlineObjs[i].enabled = false

      // ONE continuous purple coil: left fixed, right pulls, turns open, radius shrinks
      const live = makeStretchingHorizontalCoil(
        t,
        leftX,
        COIL_START_LEN,
        STRETCH_LEN,
        COIL_TURNS,
        COIL_START_R,
        COIL_END_R,
        PATH_SAMPLES,
        Z_LIVE,
      )
      const liveR = lerp(COIL_START_R * 0.55, COIL_END_R * 1.15, t)
      this.setClearTube(this.strandObjs[0], live, liveR, this.purpleClone, lerp(0.1, 0.32, t))
      for (let i = 1; i < this.strandObjs.length; i++) this.strandObjs[i].enabled = false

      // HOLD marker at left end
      this.holdMarker.enabled = true
      this.holdMarker.getTransform().setLocalPosition(new vec3(leftX, 0, Z_LIVE))

      // Large PULL arrow at moving right end
      this.pullArrow.enabled = true
      this.pullArrowLabel.text = "PULL"
      this.pullArrow.getTransform().setLocalPosition(new vec3(leftX + curLen + 2.2, 0, Z_LIVE))
      this.pullArrow.getTransform().setLocalScale(new vec3(1.35, 1.35, 1.35))

      // Ruler under the stretch, growing to 20 cm
      this.rulerObj.enabled = true
      const rulerY = -3.6
      const rulerPath: Vec3[] = [
        [leftX, rulerY, Z_LIVE],
        [leftX + curLen, rulerY, Z_LIVE],
      ]
      this.applyMesh(this.rulerObj, buildSimpleTube(rulerPath, 0.1, 4), this.yellowClone)
      this.rulerLabel.text = `${curLen.toFixed(0)} / 20 cm`
      this.rulerLabel.getSceneObject().getTransform().setLocalPosition(new vec3(curLen * 0.5, -2.6, 0))
    }
  }

  private applyScrubFrame() {
    const t = this.scrubT < 0 ? 0 : this.scrubT
    if (this.step === 1) {
      // Raw HTML timeline (not eased) so wrap/slide keyframes match the reference
      this.setupWrapVisuals(t)
    } else if (this.step === 2) {
      this.setupCoilStretchVisuals(easeInOut(t))
    } else if (this.step === 3) {
      this.setupTwistVisuals(t)
    } else if (this.step === 4) {
      this.setupFoldVisuals(t)
    } else if (this.step === 5) {
      this.setupSpiralVisuals(t)
    } else if (this.step === 6) {
      this.setupCutLeavesVisuals(t)
    } else if (this.step === 7) {
      this.setupGlueHeadVisuals(t)
    } else if (this.step === 8) {
      this.setupGlueLeavesVisuals(t)
    }
  }

  private updateChrome() {
    const titles: Record<StepId, string> = {
      1: "Step 1 — Wrap",
      2: "Step 2 — Stretch to 20 cm",
      3: "Step 3 — Twist together",
      4: "Step 4 — Fold in half",
      5: "Step 5 — Wind the spiral",
      6: "Step 6 — Cut the leaves",
      7: "Step 7 — Glue the flower head",
      8: "Step 8 — Glue the leaves",
    }
    const hints: Record<StepId, string> = {
      1: "Leave a 0.5 in tail, wrap turn beside turn, leave 0.5 in, then slide the stick out",
      2: "Hold left · pull right · turns open into a ridged stick",
      3: "Cross the two strands at the middle. Hold there and twist them around each other twice.",
      4: "Fold at the twisted middle so all four ends point down. Then pinch the top gently.",
      5: "Hold the top. Twist all four ends together, working down, into one thick rope.",
      6: "Cut the green pipe cleaner in half. Trim one end of each half into a point.",
      7: "Add hot glue to the top of the wire, press the head on and hold until it cools. Careful: it is hot.",
      8: "Put a dab of hot glue on the wire, press both leaf ends into it and hold until it cools.",
    }
    this.titleText.text = titles[this.step]
    this.hintText.text = hints[this.step] + "  ·  Pinch Next when ready"

    // HTML steps use hold/arrows/labels — keep bee/hands off
    this.beeObj.enabled = false
    this.handL.enabled = false
    this.handR.enabled = false
    this.arrowObj.enabled = false

    // Materials list (hot glue gun — no floral tape). Stem stays bare wire.
    if (this.materialsLabel) {
      this.materialsLabel.getSceneObject().enabled = this.step >= 6
    }
  }

  private placeHands(l: vec3, r: vec3) {
    this.handL.getTransform().setLocalPosition(l)
    this.handR.getTransform().setLocalPosition(r)
  }

  private placeBee(p: vec3) {
    this.beeObj.getTransform().setLocalPosition(p)
  }

  private placeArrow(p: vec3, rotZDeg: number) {
    this.arrowObj.getTransform().setLocalPosition(p)
    this.arrowObj.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, (rotZDeg * Math.PI) / 180))
  }

  private durations() {
    if (this.step === 1) {
      // HTML reference: ~12s wrap+slide cycle
      return { holdStart: 0.4, showOutline: 0.0, animate: 12.0, holdEnd: 2.5 }
    }
    if (this.step === 2) {
      // Spec: 4s stretch, 2s hold — skip yellow end-outline blend phase
      return { holdStart: 0.6, showOutline: 0.0, animate: 4.0, holdEnd: 2.0 }
    }
    if (this.step === 3) {
      // HTML reference: secs:12 twist cycle
      return { holdStart: 0.4, showOutline: 0.0, animate: 12.0, holdEnd: 2.5 }
    }
    if (this.step === 4) {
      // HTML reference: secs:10 fold+pinch
      return { holdStart: 0.4, showOutline: 0.0, animate: 10.0, holdEnd: 2.5 }
    }
    if (this.step === 6) {
      return { holdStart: 0.4, showOutline: 0.0, animate: 10.0, holdEnd: 2.5 }
    }
    // Steps 5, 7, 8: secs:12
    return { holdStart: 0.4, showOutline: 0.0, animate: 12.0, holdEnd: 2.5 }
  }

  private onUpdate() {
    const dt = getDeltaTime()

    // ---- QA: step 7 gluing/pressing/holding, then step 8 finished ----
    if (this.qaCaptureMode) {
      this.qaHoldT += dt
      this.applyScrubFrame()
      if (this.qaHoldT >= this.qaHoldSeconds) {
        this.qaHoldT = 0
        this.qaIdx++
        if (this.qaPhase === "glueHead") {
          if (this.qaIdx >= this.qaGlueTimes.length) {
            this.qaPhase = "glueLeaves"
            this.qaIdx = 0
            this.goToStep(8, true)
            this.phase = "animate"
            this.phaseT = 0
            this.scrubT = this.qaFinishTimes[0]
            this.applyScrubFrame()
            print(`[QA_CAPTURE] step=8 ${this.qaFinishNames[0]} t=${this.scrubT} — hold ${this.qaHoldSeconds}s`)
          } else {
            this.scrubT = this.qaGlueTimes[this.qaIdx]
            this.applyScrubFrame()
            print(`[QA_CAPTURE] step=7 ${this.qaGlueNames[this.qaIdx]} t=${this.scrubT} — hold ${this.qaHoldSeconds}s`)
          }
        } else {
          if (this.qaIdx >= this.qaFinishTimes.length) {
            this.qaCaptureMode = false
            this.scrubT = -1
            this.goToStep(1, true)
            print("[QA_CAPTURE] done — returning to normal Step 1 loop")
          } else {
            this.scrubT = this.qaFinishTimes[this.qaIdx]
            this.applyScrubFrame()
            print(`[QA_CAPTURE] step=8 ${this.qaFinishNames[this.qaIdx]} t=${this.scrubT} — hold ${this.qaHoldSeconds}s`)
          }
        }
      }
      return
    }

    this.phaseT += dt
    const d = this.durations()

    if (this.step === 1 || this.step === 2) {
      this.updateCoilStretchPhases(d)
      return
    }
    if (this.step === 3) {
      this.updateTwistPhases(d)
      return
    }
    if (this.step === 4) {
      this.updateFoldPhases(d)
      return
    }
    if (this.step === 5) {
      this.updateSpiralPhases(d)
      return
    }
    if (this.step === 6) {
      this.updateTimedStepPhases(d, (tt) => this.setupCutLeavesVisuals(tt))
      return
    }
    if (this.step === 7) {
      this.updateTimedStepPhases(d, (tt) => this.setupGlueHeadVisuals(tt))
      return
    }
    if (this.step === 8) {
      this.updateTimedStepPhases(d, (tt) => this.setupGlueLeavesVisuals(tt))
      return
    }
  }

  private updateTimedStepPhases(
    d: { holdStart: number; showOutline: number; animate: number; holdEnd: number },
    apply: (t: number) => void,
  ) {
    if (this.phase === "holdStart") {
      apply(0)
      if (this.phaseT >= d.holdStart) {
        this.phase = "animate"
        this.phaseT = 0
      }
    } else if (this.phase === "animate") {
      const t = Math.min(1, this.phaseT / d.animate)
      this.meshAccum += dtSafe()
      const quantized = Math.floor(t * 16) / 16
      if (this.meshAccum >= 0.08 || quantized !== this.lastMeshT) {
        this.meshAccum = 0
        this.lastMeshT = quantized
        apply(t)
      }
      if (this.phaseT >= d.animate) {
        this.phase = "holdEnd"
        this.phaseT = 0
        this.lastMeshT = -1
        apply(1)
      }
    } else if (this.phase === "holdEnd") {
      apply(1)
      if (this.phaseT >= d.holdEnd) {
        this.phase = "holdStart"
        this.phaseT = 0
        this.lastMeshT = -1
        apply(0)
      }
    }
  }

  private updateFoldPhases(d: { holdStart: number; showOutline: number; animate: number; holdEnd: number }) {
    if (this.phase === "holdStart") {
      this.setupFoldVisuals(0)
      if (this.phaseT >= d.holdStart) {
        this.phase = "animate"
        this.phaseT = 0
      }
    } else if (this.phase === "animate") {
      const t = Math.min(1, this.phaseT / d.animate)
      this.meshAccum += dtSafe()
      const quantized = Math.floor(t * 16) / 16
      if (this.meshAccum >= 0.08 || quantized !== this.lastMeshT) {
        this.meshAccum = 0
        this.lastMeshT = quantized
        this.setupFoldVisuals(t)
      }
      if (this.phaseT >= d.animate) {
        this.phase = "holdEnd"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupFoldVisuals(1)
      }
    } else if (this.phase === "holdEnd") {
      this.setupFoldVisuals(1)
      if (this.phaseT >= d.holdEnd) {
        this.phase = "holdStart"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupFoldVisuals(0)
      }
    }
  }

  private updateSpiralPhases(d: { holdStart: number; showOutline: number; animate: number; holdEnd: number }) {
    if (this.phase === "holdStart") {
      this.setupSpiralVisuals(0)
      if (this.phaseT >= d.holdStart) {
        this.phase = "animate"
        this.phaseT = 0
      }
    } else if (this.phase === "animate") {
      const t = Math.min(1, this.phaseT / d.animate)
      this.meshAccum += dtSafe()
      const quantized = Math.floor(t * 16) / 16
      if (this.meshAccum >= 0.08 || quantized !== this.lastMeshT) {
        this.meshAccum = 0
        this.lastMeshT = quantized
        this.setupSpiralVisuals(t)
      }
      if (this.phaseT >= d.animate) {
        this.phase = "holdEnd"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupSpiralVisuals(1)
      }
    } else if (this.phase === "holdEnd") {
      this.setupSpiralVisuals(1)
      if (this.phaseT >= d.holdEnd) {
        this.phase = "holdStart"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupSpiralVisuals(0)
      }
    }
  }

  private updateTwistPhases(d: { holdStart: number; showOutline: number; animate: number; holdEnd: number }) {
    if (this.phase === "holdStart") {
      this.setupTwistVisuals(0)
      if (this.phaseT >= d.holdStart) {
        this.phase = "animate"
        this.phaseT = 0
      }
    } else if (this.phase === "animate") {
      const t = Math.min(1, this.phaseT / d.animate)
      this.meshAccum += dtSafe()
      const quantized = Math.floor(t * 16) / 16
      if (this.meshAccum >= 0.08 || quantized !== this.lastMeshT) {
        this.meshAccum = 0
        this.lastMeshT = quantized
        this.setupTwistVisuals(t)
      }
      if (this.phaseT >= d.animate) {
        this.phase = "holdEnd"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupTwistVisuals(1)
      }
    } else if (this.phase === "holdEnd") {
      this.setupTwistVisuals(1)
      if (this.phaseT >= d.holdEnd) {
        this.phase = "holdStart"
        this.phaseT = 0
        this.lastMeshT = -1
        this.setupTwistVisuals(0)
      }
    }
  }

  private updateCoilStretchPhases(d: { holdStart: number; showOutline: number; animate: number; holdEnd: number }) {
    if (this.phase === "holdStart") {
      if (this.step === 1) this.setupWrapVisuals(0)
      else this.setupCoilStretchVisuals(0)
      if (this.phaseT >= d.holdStart) {
        this.phase = "animate"
        this.phaseT = 0
      }
    } else if (this.phase === "animate") {
      const raw = Math.min(1, this.phaseT / d.animate)
      // Step 1 uses HTML timeline; step 2 keeps eased stretch
      const t = this.step === 1 ? raw : easeInOut(raw)
      this.meshAccum += dtSafe()
      const quantized = Math.floor(t * 16) / 16
      if (this.meshAccum >= 0.08 || quantized !== this.lastMeshT) {
        this.meshAccum = 0
        this.lastMeshT = quantized
        if (this.step === 1) this.setupWrapVisuals(t)
        else this.setupCoilStretchVisuals(t)
      }
      if (this.phaseT >= d.animate) {
        this.phase = "holdEnd"
        this.phaseT = 0
        this.lastMeshT = -1
        if (this.step === 1) this.setupWrapVisuals(1)
        else this.setupCoilStretchVisuals(1)
      }
    } else if (this.phase === "holdEnd") {
      if (this.step === 1) this.setupWrapVisuals(1)
      else this.setupCoilStretchVisuals(1)
      if (this.phaseT >= d.holdEnd) {
        this.phase = "holdStart"
        this.phaseT = 0
        this.lastMeshT = -1
        if (this.step === 1) this.setupWrapVisuals(0)
        else this.setupCoilStretchVisuals(0)
      }
    }
  }

  private onNext() {
    this.qaCaptureMode = false
    this.scrubT = -1
    if (this.step < 8) {
      this.goToStep((this.step + 1) as StepId, true)
    } else {
      this.hintText.text = "Flower finished — pinch Replay or Back"
      this.onReplay()
    }
  }

  private onBack() {
    this.qaCaptureMode = false
    this.scrubT = -1
    if (this.step > 1) {
      this.goToStep((this.step - 1) as StepId, true)
    } else {
      this.onReplay()
    }
  }

  private onReplay() {
    this.qaCaptureMode = false
    this.scrubT = -1
    this.goToStep(this.step, true)
  }
}

function dtSafe(): number {
  return getDeltaTime()
}
