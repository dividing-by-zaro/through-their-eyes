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

**Stack:** React 18 + Vite 4 + wink-lemmatizer + compromise (NER) + jsPDF (export)

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
3. User inputs text or clicks sample text links in empty textarea
4. Text processing (debounced 300ms after typing):
   - Proper nouns detected via compromise.js (people, places, organizations) and excluded
   - Em/en dashes split into separate tokens
   - Contractions expanded to base verbs (aren't → are)
   - Words lemmatized via wink-lemmatizer (running → run)
   - Rank looked up in selected corpus
   - Words above threshold or not found → marked as unfamiliar
5. Stats calculated: total words, unique words, comprehension %
6. Live preview rendered with selected display style (blur, underline, or highlight)
7. Export options: Download highlighted text PDF or vocab list PDF via jsPDF

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
- **Focused sidebar**: Proficiency level selector always visible; collapsible sidebar
- **View toggle**: Icon buttons in stats bar for side-by-side or full-screen view
- **PDF Export**: Download highlighted text or vocab list as PDF (jsPDF)
- **Proper noun detection**: Names, places, organizations excluded via compromise.js NER
- **Lemmatization**: Groups inflected forms (run/runs/running/ran) under base lemma
- **Two corpora**: Spoken (default, movie subtitles) vs Written (web corpus) in Advanced Settings
- **Contraction handling**: Maps contractions to base verbs
- **Em-dash handling**: Splits "word—word" into separate tokens
- **Comprehension bar**: Responsive bar showing if text meets 95% research threshold
- **Proficiency tooltips**: Hover info icons for CEFR level descriptions
- **Sample texts**: Inline links in empty textarea (History, Biology, Literature, News, Gaming)
- **Hover reveal**: Marked words reveal on hover
- **Advanced Settings modal**: Display style and word frequency dataset options
- **About modal**: Documentation and FAQ

## Styling

- Warm scholarly theme with paper textures
- Focused dark sidebar with proficiency level cards and tooltips
- Compact stats bar with view toggle icons, export buttons, and comprehension bar
- Side-by-side editor with live preview (blur/underline/highlight modes)
- Sample text suggestions appear in empty textarea
- Advanced Settings and About modals

## TODO

- [ ] Custom ignore list (click to add words)
- [ ] AI simplification
- [ ] Word details on hover
