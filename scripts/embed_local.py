"""Local sentence-transformers embeddings.

Reads a JSON list of strings from stdin and writes a JSON list of vectors.
The model name comes from EMBEDDING_MODEL, defaulting to all-MiniLM-L6-v2.
This script does not download anything if the model is already cached.
"""

from __future__ import annotations

import json
import os
import sys


def main() -> None:
    from sentence_transformers import SentenceTransformer

    name = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    texts = json.load(sys.stdin)
    if not isinstance(texts, list) or any(not isinstance(item, str) for item in texts):
        raise SystemExit("stdin must be a JSON list of strings")
    model = SentenceTransformer(name)
    vectors = model.encode(texts, normalize_embeddings=True)
    json.dump(vectors.tolist(), sys.stdout)


if __name__ == "__main__":
    main()
