# Asset sources and licences

Every shipped asset is made in this repository. Nothing is downloaded or sampled.

| Asset | Source | Licence |
| --- | --- | --- |
| `public/sounds/tap-1..3.{ogg,mp3}`, `tick.{ogg,mp3}` | Synthesised by `scripts/assets/sounds.ts` (damped sines plus a seeded noise burst). Encoded with ffmpeg: Opus in Ogg (`.ogg`), MP3. Total 5.5 KB. | Self-made, CC0 1.0 |
| `src/assets/models/*.glb`, `lines.json`, `poster.svg` | Code-built by `scripts/models`. | Self-made, same licence as the site code |
| `src/assets/marks/*.svg`, `src/assets/nib.svg` | Hand-written SVG. | Self-made |
| `public/og.png`, `favicon.*`, `apple-touch-icon.png`, `icon-*.png` | Rendered by `scripts/assets/render-og.ts` from the poster, the nib and the project fonts. | Self-made |
| `public/fonts/*.woff2` | Subsets built by `pnpm fonts` from Fraunces and JetBrains Mono (SIL OFL 1.1). | SIL OFL 1.1 |

## Sounds
- `.ogg` is Ogg Opus (headers are about 1 KB smaller than Vorbis, which would have blown the 20 KB budget). Opus in Ogg plays in Chrome, Firefox, Edge and Safari 18.4+. Older Safari falls back to the `.mp3`: the runtime (E-08) should pick via `Audio.canPlayType('audio/ogg; codecs=opus')` and otherwise use the mp3.
- The PCM is deterministic. The encoded bytes depend on the ffmpeg build, so `pnpm sounds` is not part of `pnpm assets` or CI diffing; the files are committed.
