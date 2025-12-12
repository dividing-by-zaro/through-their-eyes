# Through Their Eyes

A reading level visualization tool that helps educators understand how text appears to students with different vocabulary levels. Words outside a student's expected vocabulary are blurred instantly as you type, simulating the reading experience of language learners at different CEFR levels (A1-C2).

![Through Their Eyes UI](public/through-their-eyes-ui.png?v=2)

## Features

- **Live preview** — Words marked instantly as you type (300ms debounce)
- **Multiple display modes** — Blur (simulates reading), underline, or highlight unfamiliar words
- **PDF Export** — Download highlighted text or vocab list as PDF
- **Focused sidebar** — Proficiency level selector always visible; collapsible
- **Two views** — Side-by-side editor or full-screen reader mode (toggle in stats bar)
- **Proper noun detection** — Names, places, and organizations automatically excluded
- **Two frequency corpora** — Spoken (SUBTLEX, default) or Written (web corpus) in Advanced Settings
- **CEFR vocabulary levels** — A1 through C2 plus Native speaker thresholds
- **Comprehension indicator** — Visual bar showing if text meets 95% research threshold
- **Lemmatization** — Groups inflected forms (run/runs/running/ran) under base lemmas
- **Sample texts** — Inline links in empty textarea to load example content

## Getting Started

```bash
npm install
npm run dev
```

## Data Sources

- **Spoken corpus**: [SUBTLEX word frequency](https://www.kaggle.com/datasets/lukevanhaezebrouck/subtlex-word-frequency) (60K words from movie subtitles)
- **Written corpus**: [English word frequency](https://www.kaggle.com/datasets/rtatman/english-word-frequency) (307K words from Google Web Trillion Word Corpus)
- **CEFR thresholds**: [myvocab.info](https://www.myvocab.info/en)

## TODO

- [x] **UI Redesign** - Modernize the interface for better aesthetics and usability
- [x] **95% Comprehension Threshold** - Display percentage of known words
- [x] **CEFR Vocabulary Levels** - Implement standardized A1-C2 vocabulary tiers
- [x] **Lemmatization** - Group inflected forms under base lemmas
- [x] **Spoken Corpus** - Add SUBTLEX movie subtitle corpus
- [x] **Proper Noun Handling** - Detect names, places, organizations via NER
- [x] **Live Preview** - Instant marking as you type with side-by-side editor
- [x] **Collapsible Sidebar** - Sidebar sections collapse, entire sidebar can be hidden
- [x] **Display Modes** - Choose blur, underline, or highlight for unfamiliar words
- [x] **Advanced Settings** - Modal for display style and frequency dataset options
- [x] **PDF Export** - Download highlighted text or vocab list as PDF
- [x] **Sidebar Redesign** - Focused sidebar with proficiency selector; view/export in stats bar
- [ ] **Custom Ignore List** - Click on a word to add it to a custom "ignore" list
- [ ] **AI Simplification** - Use AI to generate a simpler version at selected reading level
- [ ] **Word Details on Hover** - Show frequency rank and definition when hovering
