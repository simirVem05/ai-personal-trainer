# AI Personal Trainer — Project Guide

Real-time exercise form coaching in the browser. The webcam observes the user's form via
computer vision; the app counts reps and gives spoken feedback ("straighten your back",
"go lower", "nice rep") when form drifts or holds. Starting exercises: pushups, squats,
crunches.

## Core principles

- **The CV + form loop is always client-side.** MediaPipe runs as WASM/WebGL in the
  browser. A backend (later) never participates in the real-time loop.
- **Frontend-first.** Prove the coaching logic works before building any backend.
- **Config-driven exercises.** Adding an exercise = adding a config file, not new
  plumbing. Avoid hardcoding exercise-specific logic into shared modules.
- **Privacy:** webcam video never leaves the device.

## Real-time pipeline

```
Webcam frame
  → MediaPipe PoseLandmarker   33 landmarks {x, y, z, visibility}
  → Angle calculation          3-point joint angles in degrees
  → Rep state machine          per-exercise down/up phases w/ hysteresis
  → Form rule evaluation       declarative per-phase rules → violations
  → Feedback throttler         debounce + cooldown + single highest-severity cue
  → Voice output               speak(cueId)
```

The fundamental primitive is the **3-point angle** (angle at joint B formed by A-B-C).
Everything downstream is geometry on the 33 landmarks — no custom ML model.

Key landmark indices: 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips,
25/26 knees, 27/28 ankles. Derived angles: elbow = angle(shoulder, elbow, wrist);
back/trunk = angle(shoulder, hip, knee); knee = angle(hip, knee, ankle).

## Key design decisions

- **Rep counting uses hysteresis** — two thresholds (enter-down, enter-up), not one — so
  jitter near the boundary doesn't double-count. This is the most important detail for
  reliable counting.
- **Feedback throttling:** a violation must persist ~0.5s before speaking (debounce); no
  repeating the same cue within ~3-4s (cooldown); only the highest-severity active
  violation is spoken; occasionally give positive reinforcement on clean reps.
- **Cue IDs are a fixed enum.** Every voice persona must have a matching audio file per
  cue, so cues cannot be free-form strings.
- **Persistence behind a `storage` seam** (`saveSession()`, `getHistory()`). v1 =
  `localStorage`; backend later swaps the implementation to fetch calls with no workout
  code changes.
- **Record structured per-rep data from v1** (per rep: exercise, key angle values, which
  form rules fired) to enable the future analytics dashboard. A bare rep count is not
  enough to analyze.

## Voice

- **v1:** browser `speechSynthesis` (Web Speech API), the "generic" persona — speaks cue
  text live.
- **Later:** ~5-10 selectable character personas (pirate, robot, Optimus Prime, etc.) as
  pre-rendered mp3s at `voices/{personaId}/{cueId}.mp3`, played instantly. This is
  character voice *selection*, not cloning the user's own voice. No live synthesis needed
  since the cue set is small and fixed.
- Both paths go through one `speak(cueId)` call; adding personas is additive.

## Planned structure

```
src/
  pose/
    usePoseLandmarker.ts   # init MediaPipe, webcam, frame loop
    landmarks.ts           # named landmark accessors (LM.LEFT_ELBOW, etc.)
    geometry.ts            # angle(), distance() helpers
  exercises/
    types.ts               # Exercise, FormRule, RepState interfaces
    pushup.ts  squat.ts  crunch.ts
    index.ts               # registry
  coaching/
    repCounter.ts          # state machine w/ hysteresis
    formEvaluator.ts       # runs rules → violations
    feedbackQueue.ts       # debounce + cooldown + priority
    voice.ts               # speak() — TTS now, persona clips later
  storage/                 # storage seam: localStorage now, backend later
  components/
    CameraView.tsx         # video + canvas skeleton overlay
    SessionHUD.tsx         # rep count, current cue, form score
    ExercisePicker.tsx
  App.tsx
```

## Roadmap

**Phase 1 — Frontend (current):** (1) camera + skeleton overlay → (2) angles + pushup
rep counting → (3) form rules + browser TTS → (4) squats + crunches via config →
(5) polish + persona voices.

**Phase 2 — Backend (later, peripheral):** Node backend for workout history, trends, a
performance analytics dashboard (what the user needs to work on, from which rules fire
most), and persona voice packs. Never touches the real-time loop.

## Stack

Vite + React 19 + TypeScript. `@mediapipe/tasks-vision` for pose detection. Scripts:
`npm run dev`, `npm run build` (tsc + vite), `npm run lint`.
