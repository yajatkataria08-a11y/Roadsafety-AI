FROM python:3.11-slim

# System deps:
#   libpq-dev + gcc        — psycopg2-binary (PostgreSQL)
#   tesseract-ocr          — pytesseract OCR engine (required for /ocr/scan)
#   tesseract-ocr-eng      — English language pack  (default)
#   tesseract-ocr-hin      — Hindi language pack     (bilingual challan support)
#   libgl1-mesa-glx        — OpenCV headless dep
#   libglib2.0-0           — OpenCV headless dep
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-hin \
        libgl1-mesa-glx \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformer model at build time (not cold-start).
# This avoids an 80 MB download on first request and keeps startup < 2s.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# Build the FAISS index from violations.json + seed chunks at image build time.
# If you later add PDFs to data/legal/pdfs/, re-run: docker build --no-cache
RUN python -m app.rag.embedder || echo "⚠️  RAG index build skipped (non-fatal)"

EXPOSE 8000

# Use a single worker for the hackathon demo; scale workers for production.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
