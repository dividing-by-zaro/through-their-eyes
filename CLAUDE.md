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

**Stack:** React 18 + Vite 4 + wink-lemmatizer + compromise (NER)

**Key Files:**
- `src/App.jsx` - Main application with text processing, corpus selection, and UI
- `src/App.css` - Styling with warm scholarly theme (Fraunces + Source Serif fonts)
- `src/Components/ThresholdSelector.jsx` - Proficiency level selector (A1-C2 + Native)
- `src/Components/CollapsibleSection.jsx` - Reusable collapsible sidebar sections
- `src/utils/lemmatizer.js` - Runtime lemmatization with caching

**Frequency Data (in `/public/`):**
- `words-lemmatized.json` - Written corpus, 307K lemmas (from web text)
- `words-subtlex.json` - Spoken corpus, 60K words (from movie subtitles)

**Build Scripts (in `/scripts/`):**
- `build_lemma_dict.py` - Converts raw frequency data to lemmatized JSON
- `build_subtlex_dict.py` - Converts SUBTLEX CSV to JSON

## Data Flow

1. Both frequency corpora load on startup (`freqWrittenRef`, `freqSpokenRef`)
2. User selects proficiency level (threshold) and optionally changes corpus in Advanced Settings
3. User inputs text or loads a sample from the sidebar
4. Text processing (debounced 300ms after typing):
   - Proper nouns detected via compromise.js (people, places, organizations) and excluded
   - Em/en dashes split into separate tokens
   - Contractions expanded to base verbs (aren't → are)
   - Words lemmatized via wink-lemmatizer (running → run)
   - Rank looked up in selected corpus
   - Words above threshold or not found → marked as unfamiliar
5. Stats calculated: total words, unique words, comprehension %, proper nouns excluded
6. Live preview rendered with selected display style (blur, underline, or highlight)

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

- **Live preview**: Words marked instantly as you type (300ms debounce)
- **Display modes**: Blur (simulates reading), underline (spell-check style), or highlight
- **Collapsible sidebar**: Proficiency levels, sample texts, view toggle; can be collapsed
- **View toggle**: Side-by-side editor or full-screen reader view
- **Proper noun detection**: Names, places, organizations excluded via compromise.js NER
- **Lemmatization**: Groups inflected forms (run/runs/running/ran) under base lemma
- **Two corpora**: Spoken (default, movie subtitles) vs Written (web corpus) in Advanced Settings
- **Contraction handling**: Maps contractions to base verbs
- **Em-dash handling**: Splits "word—word" into separate tokens
- **Comprehension bar**: Visual indicator of whether text meets 95% research threshold
- **Proficiency tooltips**: Hover info icons for CEFR level descriptions
- **Sample texts**: History, biology, literature, news, gaming
- **Hover reveal**: Marked words reveal on hover
- **Advanced Settings modal**: Display style and word frequency dataset options
- **About modal**: Documentation and FAQ

## Styling

- Warm scholarly theme with paper textures
- Collapsible dark sidebar with proficiency level cards and custom tooltips
- Collapsible sections for proficiency, samples, and view toggle
- Side-by-side editor with live preview (blur/underline/highlight modes)
- Compact stats bar with comprehension indicator
- Advanced Settings and About modals

## TODO

- [ ] Custom ignore list (click to add words)
- [ ] AI simplification
- [ ] Word details on hover
