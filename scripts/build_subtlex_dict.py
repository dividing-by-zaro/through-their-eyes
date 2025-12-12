"""
Convert SUBTLEX movie subtitle frequency data to JSON format.
SUBTLEX is based on ~50 million words from movie/TV subtitles.
"""

import csv
import json

def build_subtlex_dict(input_path, output_path):
    print(f"Loading {input_path}...")

    result = {}

    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for rank, row in enumerate(reader, start=1):
            word = row['Word'].lower()
            # Skip if we already have this word (keep first/higher frequency version)
            if word not in result:
                result[word] = rank

    print(f"Processed {len(result):,} unique words")

    # Save
    print(f"Saving to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(result, f)

    # Show some examples
    print("\nExample ranks (spoken corpus):")
    examples = ['hallway', 'upstairs', 'kitchen', 'refrigerator', 'leftovers', 'gravy', 'mashed']
    for word in examples:
        rank = result.get(word, 'N/A')
        print(f"  {word}: {rank}")

    # File size
    import os
    size = os.path.getsize(output_path)
    print(f"\nFile size: {size/1024/1024:.2f} MB")

if __name__ == '__main__':
    build_subtlex_dict('SUBTLEXfreqPoS-sorted.csv', 'public/words-subtlex.json')
