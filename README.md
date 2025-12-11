# Through Their Eyes

A reading level visualization tool that helps educators understand how text appears to students with different vocabulary levels. Words outside a student's expected vocabulary are blurred, simulating the reading experience of language learners.

## Getting Started

```bash
npm install
npm run dev
```

## TODO

- [x] **UI Redesign** - Modernize the interface for better aesthetics and usability
- [x] **95% Comprehension Threshold** - Display percentage of known words and indicate whether text meets the 95% threshold required for reading comprehension
- [x] **CEFR Vocabulary Levels** - Implement standardized A1, A2, B1, B2, C1, C2 vocabulary tiers based on research data
- [x] **Lemmatization** - Group inflected forms (run/runs/running/ran) under base lemmas for accurate word family counting
- [ ] **Custom Ignore List** - Click on a word to add it to a custom "ignore" list; display and manage the ignore list
- [ ] **AI Simplification** - Use AI to generate a simpler version of the article at the selected reading level
- [ ] **Word Details on Hover** - Show frequency rank and definition when hovering over a word
