# Clips folder

The bot ships with a starter set of 45 clips, organized by category:

```
clips/
  bye/             12 farewell lines
  hungry_larvae/    1 line referencing larvae
  idle/            12 ambient mutterings
  idle_hungry/      4 idle + hunger lines
  ty/              13 thank-you lines
  ty_stapler/       3 office / "thanks for the stapler" type lines
```

The loader scans this folder recursively on bot startup (and on
`/coworker reload-clips`). Files at the root of `clips/` get the category
`uncategorized`; anything under a subfolder gets that folder's lowercase
name as its category. The keyword tree in
`src/listener/clip-selector.service.ts` uses these category names directly,
so renaming a subfolder also requires updating the rule that points at it.

## Supported formats

`.mp3`, `.ogg`, `.opus`, `.wav`, `.m4a`

FFmpeg handles transcoding to Opus for Discord's voice gateway, so any of
those should work without conversion.

## How the bundled clips were made

Source: <https://www.youtube.com/watch?v=nTe8fy4sadg> — a public fan
compilation by *CloseDatMouf*. The video has YouTube chapters tagging the
in-game category for each segment (`bye`, `idle`, `ty`, etc.), which we used
directly as subfolder names.

Extraction pipeline (one-off, not committed):

1. `yt-dlp -x --audio-format mp3 --audio-quality 0 <url>` → full 1:47 source
2. ffmpeg per-chapter slice using the YouTube chapter timestamps
3. ffmpeg `silencedetect=noise=-25dB:d=0.25` to find utterance boundaries
   inside each chapter
4. ffmpeg re-encode each utterance to mp3, pad ±50ms to avoid clipped
   consonants
5. Post-process: prune clips <0.5s (mid-word chops, artifacts) and re-split
   any clip >6s with aggressive silence detection

Final distribution: 0.5–5.8s per clip, average ~2s.

## Adding your own clips

Drop new audio files into the appropriate category folder. Run
`/coworker reload-clips` in Discord to re-scan without restarting the bot.

Suggested filename format: `<category>_NNN.mp3` (matches the existing
bundled clips) or `<short-description>.mp3`. The bot logs
`category/filename` on every play, so descriptive names make the log
readable.

## A note on copyright

The clips are derivative work of *Abiotic Factor* (game audio © Deep Field
Games / Playstack). Bundled here for use with this bot only. If a rights
holder objects, file an issue and the clips will be removed.
