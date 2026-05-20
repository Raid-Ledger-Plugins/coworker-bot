# Design notes & future work

Internal notes on calibration, design choices that aren't obvious from the
code, and explicit non-features. None of this is required reading to use
the bot; it's here for anyone who forks or extends it.

## How the visit rate was calibrated

With the defaults in `.env.example`:

- `TICK_INTERVAL_MS=120000` (one tick every 2 minutes → 30 ticks per hour)
- `VISIT_PROBABILITY=0.03`
- `GLOBAL_COOLDOWN_MIN=90`
- `CHANNEL_COOLDOWN_MIN=360`

Expected visit rate when at least one eligible channel exists:

```
30 ticks/hr × 3% = 0.9 attempts/hr
≈ one attempt per ~67 min, gated by the 90-min global cooldown
→ in practice, one visit per ~90–120 min in an active server
```

If you want it to feel more frequent in a friend-group server, raise
`VISIT_PROBABILITY` to `0.06` (one attempt every ~33 min on average, still
clamped by the 90-min cooldown).

If you want it to feel rarer, lower `VISIT_PROBABILITY` to `0.01` (one
attempt per ~3 hours). The cooldowns mostly stop mattering at that rate.

## Why the listening window IS the awkward silence

An earlier draft had a separate `AWKWARD_SILENCE_MS` parameter (the bot
would join, sit silently for ~12s, then maybe play). When we added the
listener, the silent window became *useful* (it's the recording window),
so we collapsed the two. The bot now joins, listens for `LISTEN_DURATION_MS`,
transcribes (~1–2s on Apple Silicon with `tiny.en`), and plays.

The effect is identical from a user's perspective — bot sits silently for
~8–10s, then speaks — but the silence is doing work instead of being
performative.

## Known limitations

### No reaction recording

Recording the reactions people have when the bot drops in would be funny,
but it's been intentionally scoped out: recording voice without explicit
consent runs afoul of Discord's TOS and many jurisdictions' two-party-
consent laws. If you want to add it for your own private use among
friends who've agreed, the plumbing is already there — `VoiceReceiver`
subscribes to per-user Opus streams in `src/listener/audio-recorder.service.ts`.
Decoding to a WAV file is a few lines of `prism.opus.Decoder` + a write
stream.

### Crude keyword matching

The selector matches plain substrings. It will happily fire `ty` on the
word "ty**p**ing" if the transcript contains it (the rule guards against
this with surrounding spaces, but the protection is shallow). Whisper
also sometimes produces transcription artifacts that match keywords
spuriously.

A few easy improvements if it bothers you:

- Match whole words only (regex word boundaries)
- Add a confidence threshold — Whisper exposes per-segment confidence in
  its verbose output
- Move to embedding-based matching for fuzzier intent detection — overkill
  for six categories, but doable

### Multi-bot conflict

If you also run RL's main bot (or any other bot) and they both end up in
the same voice channel, Discord shows them both in the participant list
and they'll independently play their audio. That's the explicit point of
running this as a separate bot identity (see
[`raid-ledger-integration.md`](raid-ledger-integration.md)).

### Tiny.en accuracy ceiling

We default to `ggml-tiny.en` (~75MB). It's fast and good enough for the
short keyword vocabulary the selector cares about, but it does mis-hear
things — especially short utterances and heavy accents. If you want
better transcription:

```bash
curl -fL -o models/ggml-base.en.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
# Then in .env:
# WHISPER_MODEL_PATH=./models/ggml-base.en.bin
```

`base.en` is ~150MB and ~2x slower than `tiny.en` but noticeably more
accurate.

## Possible directions

These haven't been built. Easy mode → harder:

- **Weighted clip categories**: `pickSequence` in
  `src/clips/clip-loader.service.ts` already supports a preferred category
  for the first pick. Extending to a per-category weight (lean on
  `bye/` near the end of the listening window, `idle/` otherwise) is small.
- **Time-of-day flavor**: bias toward `hungry_larvae/` near noon, `bye/`
  near typical bedtime — minor scheduler change.
- **Per-user opt-out**: today the only opt-out is per-channel. A
  `/coworker forget-me` command could exclude a specific user from being
  "heard" (the transcriber would mute their stream before mixing).
- **More voices**: the architecture is voice-agnostic. Drop another set
  of clips under `clips/` with new category folders, expand the keyword
  tree, and you have a different character.
