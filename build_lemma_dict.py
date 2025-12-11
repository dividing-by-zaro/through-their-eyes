"""
Build a compressed word frequency dictionary by grouping inflected forms under their base lemmas.
Each lemma gets the lowest (most common) rank from its word family.
"""

import json
import nltk
from nltk.stem import WordNetLemmatizer
from collections import defaultdict

# Download required NLTK data
nltk.download('wordnet', quiet=True)
nltk.download('omw-1.4', quiet=True)

def get_all_lemmas(word, lemmatizer):
    """Get all possible lemmas for a word (as noun, verb, adjective, adverb)."""
    lemmas = set()
    lemmas.add(word)  # Original word
    lemmas.add(lemmatizer.lemmatize(word, pos='n'))  # As noun
    lemmas.add(lemmatizer.lemmatize(word, pos='v'))  # As verb
    lemmas.add(lemmatizer.lemmatize(word, pos='a'))  # As adjective
    lemmas.add(lemmatizer.lemmatize(word, pos='r'))  # As adverb
    return lemmas

def build_lemma_dict(input_path, output_path):
    """Build compressed dictionary grouped by lemmas."""

    print(f"Loading {input_path}...")
    with open(input_path, 'r') as f:
        words = json.load(f)

    print(f"Loaded {len(words):,} words")

    lemmatizer = WordNetLemmatizer()

    # For each word, find its best lemma and track the lowest rank
    lemma_ranks = defaultdict(lambda: float('inf'))
    lemma_sources = defaultdict(list)  # Track which words contributed to each lemma

    print("Processing words...")
    for i, (word, rank) in enumerate(words.items()):
        if i % 50000 == 0:
            print(f"  Processed {i:,} words...")

        # Get all possible lemmas for this word
        lemmas = get_all_lemmas(word, lemmatizer)

        # Find the lemma that exists in our dictionary with the lowest rank
        # If no lemma exists, use the word itself
        best_lemma = word
        best_lemma_rank = rank

        for lemma in lemmas:
            if lemma in words and words[lemma] < best_lemma_rank:
                best_lemma = lemma
                best_lemma_rank = words[lemma]

        # Update the lemma's rank if this word's family has a lower rank
        if best_lemma_rank < lemma_ranks[best_lemma]:
            lemma_ranks[best_lemma] = best_lemma_rank

        lemma_sources[best_lemma].append((word, rank))

    # Sort lemmas by their original rank and assign new sequential ranks
    sorted_lemmas = sorted(lemma_ranks.items(), key=lambda x: x[1])

    # Re-rank: assign 1, 2, 3, ... based on sorted position
    result = {}
    for new_rank, (lemma, old_rank) in enumerate(sorted_lemmas, start=1):
        result[lemma] = new_rank

    print(f"\nCompressed to {len(result):,} lemmas")
    print(f"Reduction: {len(words):,} → {len(result):,} ({100 - len(result)/len(words)*100:.1f}% smaller)")

    # Save the compressed dictionary
    print(f"\nSaving to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(result, f)

    # Show rank changes for words near thresholds
    print("\nRank changes for words near 17K threshold:")
    threshold_examples = []
    for lemma, new_rank in result.items():
        old_rank = lemma_ranks[lemma]
        if 16000 <= old_rank <= 18000:
            threshold_examples.append((lemma, old_rank, new_rank))

    threshold_examples.sort(key=lambda x: x[1])
    for lemma, old_rank, new_rank in threshold_examples[:15]:
        direction = "↓" if new_rank < old_rank else "↑"
        print(f"  {lemma}: {old_rank:,} → {new_rank:,} ({direction} {abs(old_rank - new_rank):,})")

    # Print some examples
    print("\nExamples of word family grouping (old rank → new rank):")
    examples = ['run', 'happy', 'go', 'eat', 'leftover', 'refrigerate']
    for lemma in examples:
        if lemma in lemma_sources and lemma in result:
            sources = lemma_sources[lemma][:5]  # First 5 forms
            source_str = ', '.join(f"{w}({r})" for w, r in sorted(sources, key=lambda x: x[1]))
            old_rank = lemma_ranks[lemma]
            new_rank = result[lemma]
            print(f"  {lemma}: {old_rank:,} → {new_rank:,} ← [{source_str}...]")

    # Stats
    print("\nFile sizes:")
    import os
    orig_size = os.path.getsize(input_path)
    new_size = os.path.getsize(output_path)
    print(f"  Original: {orig_size/1024/1024:.2f} MB")
    print(f"  Compressed: {new_size/1024/1024:.2f} MB")
    print(f"  Reduction: {100 - new_size/orig_size*100:.1f}%")

if __name__ == '__main__':
    build_lemma_dict('public/words.json', 'public/words-lemmatized.json')
