# Flashcards

Minimal Electron flashcards app extracted from Zipcatcher.

Run locally:

```bash
cd flashcards
npm ci
npm run start
```

Notes:
- Deck file: `flashcards.csv` (bundled) or set `FLASHCARDS_CSV_PATH` to point elsewhere.
- Per-user state saved in Electron `userData` as `flashcards-state.json`.
