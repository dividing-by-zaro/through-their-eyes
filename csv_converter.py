import pandas as pd
import json

df = pd.read_json("word_frequencies.json")                 # rows stay in file order
mapping = dict(zip(df["word"], df.index + 1))   # { word : 1‑based‑index }

# (optional) save it back out
with open("words.json", "w") as f:
    json.dump(mapping, f, indent=2)

