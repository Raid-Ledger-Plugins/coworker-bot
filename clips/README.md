# Clips folder

Drop audio files here. The loader scans this folder recursively on bot startup
(and on `/coworker reload-clips`) and picks files randomly at visit time.

## Supported formats

`.mp3`, `.ogg`, `.opus`, `.wav`, `.m4a`

FFmpeg (bundled via `ffmpeg-static`) handles transcoding to Opus for Discord's
voice gateway, so any of those should work without conversion.

## Categories (optional, via subfolders)

Files at the root of `clips/` get the category `uncategorized`. Anything under
a subfolder gets that folder's lowercase name as its category. Example:

```
clips/
  greeting/
    hi_there.mp3
    oh_youre_back.mp3
  mundane/
    coffee_machine_broken.mp3
    have_you_seen_my_stapler.mp3
  creepy/
    silence_then_breathing.mp3
    i_can_hear_you.mp3
  farewell/
    well_back_to_work.mp3
```

The current picker just randomizes across all clips. A future weighted picker
can use the category — e.g. lean on `greeting/` near the start of a visit and
`farewell/` at the end. Hook is in `clip-loader.service.ts::pickRandomFromCategory`.

## Getting source clips

Abiotic Factor is an Unreal Engine 5 game, so the cleanest extraction is:

1. Install **FModel** ([fmodel.app](https://fmodel.app)).
2. Point it at `Steam/steamapps/common/Abiotic Factor/AbioticFactor/Content/Paks/`.
3. Find the Coworker's voice bank under `Content/.../Audio/` or `Content/.../VO/`
   (Unreal naming varies — search the asset tree for "Coworker" or known lines).
4. Export the `.uasset`/`.uexp` audio entries as `.ogg`.

Or grab them from a fan soundboard (e.g. 101soundboards or Steam community
guides) if someone's already done the extraction. Quality varies.

**Copyright reminder:** these are game audio assets owned by the game's publisher.
Fine for private use among friends; do not redistribute the bot publicly with
clips bundled in.

## Naming convention

The bot logs `category/filename.mp3` on every play, so descriptive names make
the log readable. Suggested format: `<short-description>.mp3`, lowercase,
hyphen-separated. Example: `well-back-to-work.mp3` rather than `clip_47.mp3`.
