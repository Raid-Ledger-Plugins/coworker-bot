# Lines folder

Text-channel counterpart to [`clips/`](../clips/README.md). When the bot
occasionally chimes into a **text** channel, it reads the last few messages,
runs them through the same keyword tree as the voice path
([`src/listener/clip-selector.service.ts`](../src/listener/clip-selector.service.ts)),
and posts one of the phrases below.

```
lines/
  ty/              thank-you replies
  ty_stapler/      office / "thanks for the stapler" replies
  bye/             farewell replies
  idle/            ambient mutterings (fallback when nothing matched)
  idle_hungry/     idle + hunger lines
  hungry_larvae/   questionable-snack lines
```

## Format

- One phrase per line inside any `.txt` file.
- Blank lines and lines starting with `#` are ignored (use `#` for comments).
- The **folder name** is the category. The keyword tree maps a matched keyword
  to one of these category names, so the folders here must line up with the
  categories used in `clip-selector.service.ts` — renaming a folder means
  updating the rule that points at it.
- Files at the root of `lines/` get the category `uncategorized`.

The loader ([`src/lines/line-loader.service.ts`](../src/lines/line-loader.service.ts))
scans this folder recursively on startup and on `/coworker reload-lines`.

## Adding your own lines

Drop new phrases into the appropriate category file (or add a new `.txt` file
to that folder), then run `/coworker reload-lines` in Discord to re-scan
without restarting the bot.
