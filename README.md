# void-harvest

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mhmmdnofal353-blip/void-harvest/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mhmmdnofal353-blip/void-harvest/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Void Harvest is an original twin-stick arena survival game for the browser, written in
plain JavaScript with no engine and no assets: every sprite is a vector shape drawn in
code and every sound is synthesised with WebAudio. Pilot a harvester drone in a
1280x720 arena — WASD to fly, mouse to aim, hold to fire, Shift to dash — and harvest
energy cores from the hunters you break apart: darting Mites, bullet-weaving Weavers
and plated Bulwarks that split when they die. Chain kills to grow your combo
multiplier, grab repair crosses and overdrive cells, and every fifth wave face the
Hollow Sun, a boss that fills the arena with radial bullet patterns. Waves escalate
until your hull gives out; your best score is kept between visits.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

The game is the static `game/` folder: serve it with any static file server and open
`game/index.html`. `node main.ts` (with `MAKEFUN_OUTPUT_DIR` set outside the grader)
copies the game and its screenshots to the output directory and writes the
`dossier.json` the make.fun judge reads.

---

<sub>Entered on [make.fun](https://make.fun/?ref=h7qfy6r1&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
