import lemmatizer from 'wink-lemmatizer';

// Cache to avoid repeated lemmatization of the same word
const lemmaCache = new Map();

/**
 * Get the best lemma for a word by trying verb, noun, and adjective forms.
 * Returns the form with the lowest (most common) frequency rank.
 *
 * @param {string} word - The word to lemmatize (should be lowercase, letters only)
 * @param {Object} freqDict - The frequency dictionary { word: rank }
 * @returns {string} The best lemma form
 */
export function getBestLemma(word, freqDict) {
  // Check cache first
  if (lemmaCache.has(word)) {
    return lemmaCache.get(word);
  }

  // Get all possible lemma forms
  const candidates = [
    word,                          // original form
    lemmatizer.verb(word),         // as verb: running → run
    lemmatizer.noun(word),         // as noun: cats → cat
    lemmatizer.adjective(word)     // as adjective: better → good
  ];

  // Find the candidate with the lowest (most common) rank
  let bestRank = Infinity;
  let bestForm = word;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const rank = freqDict[candidate];
    if (rank !== undefined && rank < bestRank) {
      bestRank = rank;
      bestForm = candidate;
    }
  }

  // Cache the result
  lemmaCache.set(word, bestForm);

  return bestForm;
}

/**
 * Clear the lemma cache (useful if frequency dictionary changes)
 */
export function clearLemmaCache() {
  lemmaCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getLemmaCacheStats() {
  return {
    size: lemmaCache.size,
    entries: Array.from(lemmaCache.entries()).slice(0, 20) // First 20 for inspection
  };
}
