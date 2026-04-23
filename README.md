# Thai Flashcards (Anki-style)

Simple mobile-friendly Thai flashcards built with Vite + React.

## Features

- Code-defined multiple decks
- Anki-style ratings: `Again`, `Hard`, `Good`, `Easy`
- SM-2 style spaced repetition scheduling
- Local browser progress persistence (`localStorage`)
- Audio playback per card from your deck files

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Generate Audio (Python)

From the repo root:

```bash
cd generate-thai-audio
python3 -m venv .venv
source .venv/bin/activate
python -m pip install edge-tts
python generate_thai_audio.py
```

Deactivate when done:

```bash
deactivate
```

## Deck Structure

Decks are auto-discovered from folders inside `decks/`.

Each deck folder must contain:

- `decks/<deck-folder>/thai_words.csv`
- `decks/<deck-folder>/audio/audio_manifest.csv`
- `decks/<deck-folder>/audio/*.mp3`

Example:

- `decks/glue-words/thai_words.csv`
- `decks/glue-words/audio/audio_manifest.csv`
- `decks/glue-words/audio/glue_1.mp3`

Expected CSV columns:

- words CSV: `id,english,romanized,thai`
- audio manifest: `id,english,romanized,thai,audio`

Audio values support Anki format like `[sound:glue_1.mp3]`.

## Add More Decks (Copy/Paste Friendly)

1. Copy an existing deck folder in `decks/` and rename it (for example: `decks/food/`).
2. Replace:
   - `decks/food/thai_words.csv`
   - `decks/food/audio/audio_manifest.csv`
   - `decks/food/audio/*.mp3`
3. Refresh the app. The new deck appears automatically.

No TypeScript edits required.

### Optional: Custom deck name/metadata

Add `decks/<deck-folder>/deck.json`:

```json
{
  "id": "thai-food-basics",
  "title": "Thai Food Basics",
  "description": "Useful food vocabulary."
}
```

If `deck.json` is omitted, folder name is used automatically.

## Deploy to Vercel

This is a standard static Vite deploy:

1. Push repo to GitHub.
2. Import project into Vercel.
3. Build command: `npm run build`
4. Output directory: `dist`
