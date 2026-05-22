"""
RAG Retriever — v2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Returns the best semantic match from the FAISS index.
Includes a similarity score threshold so low-quality matches
are rejected rather than returned as if confident.

Integration with DriveLegal:
  - Called *after* the structured DB lookup fails
  - Handles paraphrased queries ("how much if caught without seat belt")
  - Handles queries about violations not yet in violations.json
    but present in indexed government PDFs
"""

from __future__ import annotations
import pickle
from pathlib import Path
from typing import Optional

try:
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

INDEX_PATH  = Path(__file__).parent / "legal.index"
CHUNKS_PATH = Path(__file__).parent / "chunks.pkl"
MODEL_NAME  = "all-MiniLM-L6-v2"

# Minimum similarity score to return a result (cosine similarity, 0–1)
# Below this threshold we return "" and let the caller use the fallback
SIMILARITY_THRESHOLD = 0.40

_model:  Optional["SentenceTransformer"] = None
_index:  Optional["faiss.Index"] = None
_chunks: list[str] = []



def _seed_keyword_search(query: str) -> str:
    """
    Simple keyword fallback over MV_ACT_SEEDS when FAISS index is not built.
    Counts keyword overlaps; returns best chunk if >= 3 tokens match.
    """
    try:
        from app.rag.seeds import MV_ACT_SEEDS
    except ImportError:
        return ""
    q_tokens = set(query.lower().split())
    best_score, best_chunk = 0, ""
    for chunk in MV_ACT_SEEDS:
        chunk_tokens = set(chunk.lower().split())
        score = len(q_tokens & chunk_tokens)
        if score > best_score:
            best_score, best_chunk = score, chunk
    return best_chunk if best_score >= 3 else ""


def _load() -> bool:
    global _model, _index, _chunks
    if not FAISS_AVAILABLE:
        return False
    if not INDEX_PATH.exists() or not CHUNKS_PATH.exists():
        return False
    if _model is None:
        print("Loading RAG model…")
        _model = SentenceTransformer(MODEL_NAME)
        _index = faiss.read_index(str(INDEX_PATH))
        with open(CHUNKS_PATH, "rb") as f:
            _chunks = pickle.load(f)
        print(f"  ✅ RAG ready — {len(_chunks)} indexed chunks")
    return True


def rag_search(query: str, top_k: int = 1) -> str:
    """
    Returns the best matching legal text for the query.
    Returns "" if:
      - FAISS index not built yet (run embedder.py first)
      - Best match similarity is below SIMILARITY_THRESHOLD
    """
    if not _load():
        return _seed_keyword_search(query)

    vec = _model.encode([query], normalize_embeddings=True).astype("float32")

    # IndexFlatIP gives inner product (= cosine for normalised vecs, range 0–1)
    scores, indices = _index.search(vec, top_k)

    best_score = float(scores[0][0])
    best_idx   = int(indices[0][0])

    if best_idx == -1 or best_score < SIMILARITY_THRESHOLD:
        return ""   # not confident enough — let caller use structured fallback

    return _chunks[best_idx]


def rag_search_multi(query: str, top_k: int = 3) -> list[dict]:
    """
    Returns up to top_k results with scores — useful for debugging
    or for building a 'related laws' feature in the UI.
    """
    if not _load():
        return []

    vec = _model.encode([query], normalize_embeddings=True).astype("float32")
    scores, indices = _index.search(vec, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1 or float(score) < SIMILARITY_THRESHOLD:
            continue
        results.append({"text": _chunks[int(idx)], "score": round(float(score), 3)})

    return results
