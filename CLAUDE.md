# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Through Their Eyes" is a React-based reading level visualization tool that helps educators understand how text appears to students with different vocabulary levels. It blurs words that fall outside a user's selected vocabulary threshold based on word frequency data.

## Commands

```bash
# Development
npm run dev        # Start Vite dev server

# Build
npm run build      # Production build

# Preview production build
npm run preview
```

## Architecture

**Stack:** React 18 + Vite 4

**Core Components:**
- `src/App.jsx` - Main application logic with text processing and blur visualization
- `src/Components/ThresholdSelector.jsx` - Radio button selector for vocabulary level presets (500, 3000, 10000, 15000 words)

**Data Flow:**
1. Word frequency data loads from `/public/words.json` (format: `{ "word": rank }`)
2. User inputs text and selects vocabulary threshold
3. Text is tokenized and each word's frequency rank is checked against threshold
4. Words above threshold are wrapped in `.blur` class for visual obscuring

**Key Logic in App.jsx:**
- `freqRef` holds the frequency map (word → rank)
- `customWords` Set contains special-cased words that bypass blur (e.g., "biden", "trump")
- Tokenization handles hyphens and apostrophes by splitting and checking sub-tokens
- Words with rank > threshold or not in frequency list get blurred

**Styling:**
- `.blur` class applies text-shadow blur effect, reveals on hover
- Dark theme by default in App.css
