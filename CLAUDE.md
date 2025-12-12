# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Through Their Eyes" is a React-based reading level visualization tool that helps educators understand how text appears to students with different vocabulary levels. Words outside a reader's expected vocabulary are blurred, simulating the reading experience of language learners at different CEFR levels (A1-C2).

## Commands

```bash
# Development
npm run dev        # Start Vite dev server (port 5173 or 5174)

# Build
npm run build      # Production build
npm run preview    # Preview production build

# Build frequency dictionaries (Python/uv)
uv run python scripts/build_lemma_dict.py     # Build lemmatized written corpus
uv run python scripts/build_subtlex_dict.py   # Build spoken corpus from SUBTLEX
```

## Architecture

**Stack:** React 18 + Vite 4 + wink-lemmatizer

**Key Files:**
- `src/App.jsx` - Main application with text processing, corpus selection, and UI
- `src/App.css` - Styling with warm scholarly theme (Fraunces + Source Serif fonts)
- `src/Components/ThresholdSelector.jsx` - CEFR level selector (A1-C2 + Native)
- `src/utils/lemmatizer.js` - Runtime lemmatization with caching

**Frequency Data (in `/public/`):**
- `words-lemmatized.json` - Written corpus, 307K lemmas (from web text)
- `words-subtlex.json` - Spoken corpus, 60K words (from movie subtitles)

**Build Scripts (in `/scripts/`):**
- `build_lemma_dict.py` - Converts raw frequency data to lemmatized JSON
- `build_subtlex_dict.py` - Converts SUBTLEX CSV to JSON

## Data Flow

1. Both frequency corpora load on startup (`freqWrittenRef`, `freqSpokenRef`)
2. User selects CEFR level (threshold) and corpus type (Written/Spoken)
3. User inputs text or loads a sample
4. Text processing:
   - Contractions expanded to base verbs (aren't → are)
   - Words lemmatized via wink-lemmatizer (running → run)
   - Rank looked up in selected corpus
   - Words above threshold or not found → blurred
5. Stats calculated: total words, unique words, known %, avg rank
6. Output rendered with blur effect on unknown words

## CEFR Thresholds (from myvocab.info)

| Level | Words |
|-------|-------|
| A1 | 1,750 |
| A2 | 2,650 |
| B1 | 4,150 |
| B2 | 6,050 |
| C1 | 8,950 |
| C2 | 12,150 |
| Native | 17,000 |

## Key Features

- **Lemmatization**: Groups inflected forms (run/runs/running/ran) under base lemma
- **Two corpora**: Written (formal text) vs Spoken (movie subtitles for everyday vocab)
- **Contraction handling**: Maps contractions to base verbs
- **95% comprehension bar**: Visual indicator of whether text meets research threshold
- **Sample texts**: Science, history, biology, literature, news, gaming
- **Hover reveal**: Blurred words reveal on hover

## Styling

- Warm scholarly theme with paper textures
- Dark sidebar with CEFR level cards
- Corpus toggle (Written/Spoken) at bottom of sidebar
- Comprehension bar with 95% threshold marker (blue/orange colorblind-friendly)

## TODO (from README)

- [ ] Proper noun handling
- [ ] Custom ignore list (click to add words)
- [ ] AI simplification
- [ ] Word details on hover
