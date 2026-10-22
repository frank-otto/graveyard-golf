# ⛳ Graveyard Golf

Day 13 of a daily Halloween web-game series – **7 days to Halloween 🎃**

Nine haunted mini-golf holes through a foggy graveyard at night, under a giant moon. Swinging coffin lids, zombie hands, a spinning scarecrow, bats, a patrolling ghost, a crypt tunnel and a giant mausoleum. Sink a hole in one and **the graveyard wakes**: time slows as the ball drops, then every jack-o'-lantern ignites in a wave, tombstones jolt, zombie hands burst out of the graves, ghosts rise, bats swarm and a stone slab carved "HOLE IN ONE!" grinds out of the ground.

## How to play
- **Pull back** from anywhere on the screen (mouse or finger) and **let go** to putt – further means harder, the opposite direction is the aim, like a slingshot.
- Keyboard: **← →** aim, **↑ ↓** power (Shift = fine), **Space** putt, **V** overview, **M** do-over.
- Real ball physics: rolling friction, slopes and bowls, ramps and jumps, cushion bounces, moving obstacles that push the ball, cups that only catch a ball that is slow enough – too fast and it lips out or hops over.
- Open graves cost a penalty stroke (the ball comes back), the crypt tunnel carries the ball across, the ghost sends it back to the start.
- Trick shots: BANK SHOT, JUMP SHOT, TUNNEL SHOT; plus LIP-OUT! and GHOSTED!.

**The holes:** Gravedigger's Gate, Crooked Stones, Coffin Swing, Open Graves, Scarecrow Mill, Haunted Tunnel, Ghost Walk, Grave Jump and The Mausoleum (par 4: up the ramp, through the open coffin, past the iron doors). Par 27.
**Modes:** 9-hole round · Player 1 vs Player 2 hot-seat duel (both play every hole).
**Difficulty:** Easy / Medium / Hard (aim guide length, do-overs, stroke limit, obstacle speed), best score per difficulty. **Kids mode:** full aim guide, unlimited do-overs, no stroke limit, no penalty – after a few strokes a friendly ghost carries the ball in.

The game opens with a cinematic ride on the ball through The Mausoleum (the real shot, real physics). One tap or click anywhere on the intro goes straight to hole 1 (saved difficulty, Medium by default) and switches on the sound in the same tap. The start screen has one big PLAY button; duel, difficulty, kids mode, graphics quality and the intro replay (🎬) are in the "⚙ Modes & options" sheet. The language follows the browser (German for de-*, otherwise English); the DE/EN button overrides it and is remembered. A 1080×1350 scorecard image to save or share. Quality levels (Normal by default; steps down only if the frame rate stays low).

## Tech
- Three.js (WebGL): the whole course is one world; sky shader with stars, clouds and a blood moon, billboard moon with halo and god rays, a screen-space height fog that reads the depth buffer (looks volumetric, lit by the moon), velvet felt with sheen, clearcoat dimpled ball, PBR stone, iron and wood, moonlight shadows, tasteful bloom, colour grade with vignette and grain, MSAA.
- Physics at a fixed 240 Hz on an absolute clock: obstacles are pure functions of time, so the aim guide, the slow-motion "it's going in" prediction and the test solver match the game exactly.
- Sounds: real CC0 recordings only, no oscillators; sample-based music. See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
python3 test/test_game.py   # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py # phones: WebKit iPhone 13 / 8 / SE + Chromium Pixel 7, portrait + landscape (one tap to play, ≥44 px targets, no scrolling)
```

Built with Grok Bot. Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).
