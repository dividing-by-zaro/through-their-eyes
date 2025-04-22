import pandas as pd

# 1. Read the CSV into a DataFrame
df = pd.read_csv('unigram_freq.csv')

# 2. Export to JSON (one object per row)
df.to_json('output.json', orient='records', indent=2)
