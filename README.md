# AI Personal Trainer

Real-time exercise form coaching in the browser. Point your webcam at yourself, pick an
exercise, and the app watches your form using computer vision — counting reps and giving
spoken feedback like *"straighten your back"* or *"go lower"* when your form drifts, and
the occasional *"nice rep"* when it doesn't.

Starting exercises: **pushups, squats, crunches.**

## How it works

Everything in the real-time loop runs client-side — no video ever leaves your device.

```
Webcam frame
  → MediaPipe PoseLandmarker        33 body landmarks (x, y, z, visibility)
  → Angle calculation               joint triples → degrees (elbow, knee, back, trunk)
  → Rep state machine               per-exercise down/up phases w/ hysteresis → rep count
  → Form rule evaluation            are angles in the "good" range for this phase?
  → Feedback throttler              debounce + cooldown + single highest-severity cue
  → Voice output                    speaks the cue
```

The core insight: MediaPipe gives 33 landmarks at ~30fps, and everything downstream is
just geometry on those points. The form logic is trigonometry plus per-exercise rules —
no custom ML model required.

## Voice

- **v1:** the browser's built-in `speechSynthesis` (Web Speech API) speaks cues live —
  free, offline, zero dependencies.
- **Later:** selectable **voice personas** (e.g. pirate, robot, Optimus Prime). Because
  the cue set is small and fixed, each cue is pre-rendered to an mp3 per persona
  (`voices/{persona}/{cueId}.mp3`) and played instantly — no live synthesis. This is
  *character voice selection*, not cloning the user's own voice.

Both go through a single `speak(cueId)` call, so adding personas is purely additive.

## Roadmap

The app is **frontend-first**. All CV and coaching logic is built and proven client-side
before any backend exists.

**Phase 1 — Frontend (current focus)**
1. Camera + skeleton overlay — prove MediaPipe tracks well at a usable framerate
2. Angles + rep counting for pushups (one exercise, end-to-end)
3. Form rules + browser TTS — the coach actually talks
4. Generalize to squats + crunches via the config pattern
5. Polish: form score, session summary, persona voices

**Phase 2 — Backend (later, peripheral only)**

A Node backend that never touches the real-time loop. It owns:
- Workout history & trends across devices
- An analytics dashboard — how well you perform each exercise and what to work on,
  derived from which form rules fire most
- Hosting/managing persona voice packs

This is enabled by recording **structured per-rep data** from v1 onward (per rep:
exercise, key angle values, which form rules fired) behind a `storage` seam. v1 writes it
to `localStorage`; the backend later ingests the same shape — no workout code changes.

## Tech stack

- **Vite + React 19 + TypeScript**
- **[@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)** — in-browser pose detection (WASM/WebGL)
- Web Speech API (v1 voice)

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # eslint
```

A webcam is required. Allow camera access when prompted.
