"""
RAG Embedder — v2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Indexes two sources:
  1. violations.json  — structured legal DB  (always available)
  2. Any PDFs in data/legal/pdfs/            — government rule books
     (place downloaded MoRTH / BRTA PDFs here)

Run once:  python -m app.rag.embedder
"""

from __future__ import annotations
import json
import pickle
from pathlib import Path

try:
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("⚠️  Install sentence-transformers and faiss-cpu to enable RAG.")

ROOT        = Path(__file__).parent.parent.parent
DATA_DIR    = ROOT / "data" / "legal"
PDF_DIR     = DATA_DIR / "pdfs"
INDEX_PATH  = Path(__file__).parent / "legal.index"
CHUNKS_PATH = Path(__file__).parent / "chunks.pkl"
MODEL_NAME  = "all-MiniLM-L6-v2"

# Chunk size for PDF text splitting
CHUNK_SIZE  = 300   # characters
CHUNK_OVERLAP = 50


def _violation_to_chunk(v: dict) -> str:
    """Convert a violations.json entry to a searchable text chunk."""
    aliases = ", ".join(v.get("aliases", []))
    state   = f" in {v['state']}" if v.get("state") else ""
    city    = f", {v['city']}" if v.get("city") else ""
    return (
        f"Violation: {v['violation']} (also known as: {aliases}). "
        f"Location: {v['location']}{state}{city}. "
        f"Fine: {v['fine']} INR. "
        f"Repeat penalty: {v.get('repeat_penalty', 'N/A')} INR. "
        f"Law section: {v.get('law_section', 'N/A')}. "
        f"Notes: {v.get('notes', '')}."
    )


def _split_text(text: str) -> list[str]:
    """Sliding-window chunker for long PDF text."""
    chunks = []
    start  = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end].strip())
        start = end - CHUNK_OVERLAP
    return [c for c in chunks if len(c) > 50]


def _load_pdf_chunks() -> list[str]:
    chunks = []
    if not PDF_DIR.exists():
        return chunks
    try:
        from pdfminer.high_level import extract_text
    except ImportError:
        print("  ⚠️  pdfminer.six not installed — skipping PDFs")
        return chunks

    for pdf in PDF_DIR.glob("*.pdf"):
        print(f"  📄 Reading {pdf.name}…")
        text = extract_text(str(pdf))
        chunks.extend(_split_text(text))
    return chunks


def build_index():
    if not FAISS_AVAILABLE:
        return

    model  = SentenceTransformer(MODEL_NAME)
    chunks: list[str] = []

    # Source 1 — Hardcoded MV Act / BIMSTEC seed chunks (always present)
    try:
        import sys, os
        sys.path.insert(0, str(ROOT))
        from app.rag.seeds import MV_ACT_SEEDS
        chunks.extend(MV_ACT_SEEDS)
        print(f"  ✅ Loaded {len(MV_ACT_SEEDS)} seed chunks (MV Act + BIMSTEC laws)")
    except ImportError:
        pass

    # Source 2 — violations.json
    legal_path = DATA_DIR / "violations.json"
    if legal_path.exists():
        with open(legal_path) as f:
            violations = json.load(f)
        for v in violations:
            chunks.append(_violation_to_chunk(v))
        print(f"  ✅ Loaded {len(violations)} violations from JSON")

    # Source 2 — PDF rule books
    pdf_chunks = _load_pdf_chunks()
    chunks.extend(pdf_chunks)
    print(f"  ✅ Loaded {len(pdf_chunks)} chunks from PDFs")

    if not chunks:
        print("No chunks to index. Add data and run again.")
        return

    print(f"Embedding {len(chunks)} total chunks…")
    embeddings = model.encode(chunks, show_progress_bar=True,
                              normalize_embeddings=True)
    embeddings = np.array(embeddings).astype("float32")

    index = faiss.IndexFlatIP(embeddings.shape[1])   # Inner product (cosine for normalised vecs)
    index.add(embeddings)

    faiss.write_index(index, str(INDEX_PATH))
    with open(CHUNKS_PATH, "wb") as f:
        pickle.dump(chunks, f)

    print(f"\n✅ FAISS index built → {INDEX_PATH}  ({len(chunks)} vectors)")


if __name__ == "__main__":
    build_index()
