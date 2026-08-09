from __future__ import annotations

import base64
import hmac
import hashlib
from io import BytesIO
import json
import os
import re
import signal
import shutil
import sqlite3
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.practice_repair import assign_sequential_numbers, parse_practice_block
import pdfplumber
from docx import Document
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from mistralai.client import Mistral
from PIL import Image, ImageStat
from pydantic import BaseModel

app = FastAPI(title="SAT AI Ingest Service", version="0.1.0")

MAX_UPLOAD_BYTES = 256 * 1024 * 1024
MAX_ZIP_ENTRY_COUNT = int(os.getenv("INGEST_MAX_ZIP_ENTRY_COUNT", "3000"))
MAX_ZIP_UNCOMPRESSED_BYTES = int(os.getenv("INGEST_MAX_ZIP_UNCOMPRESSED_BYTES", str(512 * 1024 * 1024)))
MAX_SOURCE_FILES = int(os.getenv("INGEST_MAX_SOURCE_FILES", "2000"))
UPLOAD_ROOT = Path(os.getenv("INGEST_UPLOAD_ROOT", "/tmp/sat-ai-ingest-uploads"))
PUBLIC_UPLOAD_ROOT = Path(os.getenv("INGEST_PUBLIC_UPLOAD_ROOT", "/app/.private/uploads/ingest"))
PUBLIC_UPLOAD_URL_PREFIX = "/api/admin/ai-import/assets"
MISTRAL_API_KEY_SETTING = "MISTRAL_API_KEY_ENCRYPTED"


def database_path_from_url(database_url: str) -> str:
    if database_url.startswith("file:"):
        return database_url.replace("file:", "", 1)
    return database_url


def encryption_secret() -> str:
    secret = (
        os.getenv("SECRET_ENCRYPTION_KEY")
        or os.getenv("AUTH_SECRET")
        or os.getenv("NEXTAUTH_SECRET")
    )
    if secret:
        return secret
    if os.getenv("NODE_ENV") == "production" or os.getenv("APP_ENV") == "production":
        raise RuntimeError("SECRET_ENCRYPTION_KEY or AUTH_SECRET is required in production.")
    return (
        "sat-platform-dev-secret-change-in-production"
    )


def internal_ingest_token() -> str:
    token = os.getenv("INTERNAL_INGEST_TOKEN")
    if token:
        return token
    if os.getenv("NODE_ENV") == "production" or os.getenv("APP_ENV") == "production":
        raise RuntimeError("INTERNAL_INGEST_TOKEN is required in production.")
    return "sat-platform-dev-internal-token-change"


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    header = request.headers.get("authorization", "")
    prefix = "Bearer "
    provided = header[len(prefix):] if header.startswith(prefix) else ""
    expected = internal_ingest_token()
    if not provided or not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        return JSONResponse({"detail": "Unauthorized ingest service request."}, status_code=401)
    return await call_next(request)


def decrypt_secret_payload(value: str) -> tuple[str | None, dict[str, Any]]:
    try:
        payload = json.loads(value)
        if payload.get("alg") != "AES-256-GCM":
            return None, {}
        key = hashlib.sha256(encryption_secret().encode("utf-8")).digest()
        iv = base64.b64decode(payload["iv"])
        ciphertext = base64.b64decode(payload["ciphertext"])
        tag = base64.b64decode(payload["tag"])
        plaintext = AESGCM(key).decrypt(iv, ciphertext + tag, None).decode("utf-8")
        return plaintext, payload
    except Exception:
        return None, {}


def load_mistral_api_key_from_db(database_url: str) -> tuple[str | None, dict[str, Any]]:
    try:
        connection = sqlite3.connect(database_path_from_url(database_url))
        row = connection.execute("SELECT value FROM AppSetting WHERE key = ?", (MISTRAL_API_KEY_SETTING,)).fetchone()
        connection.close()
        if not row:
            return None, {}
        return decrypt_secret_payload(row[0])
    except Exception:
        return None, {}


@dataclass(frozen=True)
class IngestConfig:
    database_url: str
    text_density_threshold: int
    mistral_api_key: str | None
    ocr_model: str
    structuring_model: str
    force_ocr_source_kinds: frozenset[str]

    @classmethod
    def from_env(cls) -> "IngestConfig":
        database_url = os.getenv("DATABASE_URL", "file:./dev.db")
        db_api_key, _summary = load_mistral_api_key_from_db(database_url)
        # PDFs cuyo texto vectorial (mate/opciones) pdfplumber no extrae confiablemente
        # se fuerzan a OCR. Incluye práctica porque la prosa da una densidad engañosa
        # que suprimiría el OCR y perdería la mate y las alternativas. Opt-out por env.
        force_ocr_kinds = frozenset(
            kind.strip().upper()
            for kind in os.getenv("INGEST_FORCE_OCR_SOURCE_KINDS", "MOCK_EXAM,PRACTICE_EXERCISE").split(",")
            if kind.strip()
        )
        return cls(
            database_url=database_url,
            text_density_threshold=int(os.getenv("INGEST_TEXT_DENSITY_THRESHOLD", "120")),
            mistral_api_key=db_api_key or os.getenv("MISTRAL_API_KEY") or None,
            ocr_model=os.getenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest"),
            structuring_model=os.getenv("MISTRAL_STRUCTURING_MODEL", "mistral-large-latest"),
            force_ocr_source_kinds=force_ocr_kinds,
        )


CONFIG = IngestConfig.from_env()
TEXT_DENSITY_THRESHOLD = CONFIG.text_density_threshold
OCR_MODEL = CONFIG.ocr_model
STRUCTURING_MODEL = CONFIG.structuring_model
FORCE_OCR_SOURCE_KINDS = CONFIG.force_ocr_source_kinds


class BatchCreate(BaseModel):
    name: str = "AI content ingest"
    basePath: str = "files_to_load"


class Timeout:
    def __init__(self, seconds: int) -> None:
        self.seconds = seconds
        self.previous_handler: Any = None

    def __enter__(self) -> None:
        self.previous_handler = signal.signal(signal.SIGALRM, self._handle_timeout)
        signal.alarm(self.seconds)

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        signal.alarm(0)
        if self.previous_handler is not None:
            signal.signal(signal.SIGALRM, self.previous_handler)

    @staticmethod
    def _handle_timeout(signum: int, frame: Any) -> None:
        raise TimeoutError("Page extraction timed out.")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def db_path() -> str:
    return database_path_from_url(CONFIG.database_url)


def conn() -> sqlite3.Connection:
    # timeout = busy_timeout: wait for the web process's write lock on the shared
    # dev.db instead of raising SQLITE_BUSY immediately. WAL is set by the web app
    # and persists at the DB-file level; NORMAL synchronous keeps writes cheap.
    connection = sqlite3.connect(db_path(), timeout=5.0)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=5000")
    connection.execute("PRAGMA synchronous=NORMAL")
    return connection


class SqliteIngestStore:
    def connect(self) -> sqlite3.Connection:
        return conn()

    def init(self) -> None:
        init_db()


class MistralOcrClient:
    def __init__(self, config: IngestConfig) -> None:
        self.config = config
        self.client = Mistral(api_key=config.mistral_api_key) if config.mistral_api_key else None

    def _process_document(self, document: dict[str, Any], pages: list[int] | None = None) -> tuple[str | None, dict[str, Any]]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                request: dict[str, Any] = {
                    "model": self.config.ocr_model,
                    "document": document,
                    "table_format": "html",
                    "include_image_base64": True,
                    "include_blocks": True,
                    "confidence_scores_granularity": "page",
                    "timeout_ms": 120000,
                }
                if pages is not None:
                    request["pages"] = pages
                response = self.client.ocr.process(
                    **request,
                )
                break
            except Exception as exc:
                last_error = exc
                error_text = str(exc)
                if "Status 401" in error_text or attempt == 2:
                    return None, {"warning": f"Mistral OCR failed: {exc}"}
                time.sleep(2**attempt)
        else:
            return None, {"warning": f"Mistral OCR failed: {last_error}"}

        response_payload = response.model_dump() if hasattr(response, "model_dump") else response
        response_pages = response_payload.get("pages") or []
        text = "\n\n".join(page.get("markdown") or page.get("text") or "" for page in response_pages)
        if not text.strip():
            response_payload["warning"] = "Mistral OCR returned no text for this page."
            return None, response_payload
        return text, response_payload

    def _render_page_as_image_document(self, path: Path, page_number: int) -> dict[str, Any]:
        with pdfplumber.open(path) as pdf:
            page = pdf.pages[page_number - 1]
            image = page.to_image(resolution=220).original.convert("RGB")
        output = BytesIO()
        image.save(output, format="JPEG", quality=92, optimize=True)
        encoded = base64.b64encode(output.getvalue()).decode("utf-8")
        return {"type": "image_url", "image_url": f"data:image/jpeg;base64,{encoded}"}

    def process_image_base64(self, image_base64: str, mime_type: str | None = None) -> tuple[str | None, dict[str, Any]]:
        if not self.client:
            return None, {"warning": "MISTRAL_API_KEY is not configured."}
        image_url = image_base64 if image_base64.startswith("data:") else f"data:{mime_type or 'image/jpeg'};base64,{image_base64}"
        text, payload = self._process_document({"type": "image_url", "image_url": image_url})
        if text:
            payload["ocrSource"] = "candidate_image"
        return text, payload

    def process_page(self, path: Path, page_number: int) -> tuple[str | None, dict[str, Any]]:
        try:
            render_info = pdf_page_render_info(path, page_number)
            if render_info.get("isBlank"):
                return None, {
                    "warning": "Blank page detected before OCR.",
                    "blankPage": True,
                    "ocrSource": "blank_page_precheck",
                    "renderInfo": render_info,
                }
        except Exception as exc:
            render_info = {"warning": f"PDF page blank precheck failed: {exc}"}

        if not self.client:
            return None, {"warning": "MISTRAL_API_KEY is not configured."}

        document = {
            "type": "document_url",
            "document_url": f"data:application/pdf;base64,{base64.b64encode(path.read_bytes()).decode('utf-8')}",
            "document_name": path.name,
        }
        text, payload = self._process_document(document, pages=[page_number - 1])
        if text:
            payload["ocrSource"] = "pdf_document"
            return text, payload

        try:
            image_document = self._render_page_as_image_document(path, page_number)
        except Exception as exc:
            payload["fallbackWarning"] = f"PDF page image render failed: {exc}"
            return None, payload

        image_text, image_payload = self._process_document(image_document)
        if image_text:
            image_payload["ocrSource"] = "rendered_page_image"
            image_payload["pdfOcrWarning"] = payload.get("warning")
            image_payload["renderInfo"] = render_info
            return image_text, image_payload

        image_payload["pdfOcrWarning"] = payload.get("warning")
        image_payload["renderInfo"] = render_info
        return None, image_payload


def init_db() -> None:
    with conn() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS IngestBatch (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              basePath TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'PENDING',
              totalFiles INTEGER NOT NULL DEFAULT 0,
              totalPages INTEGER NOT NULL DEFAULT 0,
              filesProcessed INTEGER NOT NULL DEFAULT 0,
              pagesProcessed INTEGER NOT NULL DEFAULT 0,
              candidatesDetected INTEGER NOT NULL DEFAULT 0,
              errorCount INTEGER NOT NULL DEFAULT 0,
              lastError TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS IngestSourceFile (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              path TEXT NOT NULL,
              relativePath TEXT NOT NULL,
              hash TEXT NOT NULL,
              extension TEXT NOT NULL,
              contentType TEXT NOT NULL DEFAULT 'UNKNOWN',
              sourceKind TEXT NOT NULL DEFAULT 'UNKNOWN',
              section TEXT,
              domainName TEXT,
              topicName TEXT,
              difficulty TEXT,
              difficultySource TEXT,
              practiceSetVariant TEXT,
              testNumber INTEGER,
              isAnswerFile BOOLEAN NOT NULL DEFAULT 0,
              isExplanationFile BOOLEAN NOT NULL DEFAULT 0,
              isQuestionSource BOOLEAN NOT NULL DEFAULT 1,
              metadataWarningsJson TEXT,
              status TEXT NOT NULL DEFAULT 'PENDING',
              pageCount INTEGER NOT NULL DEFAULT 0,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestSourceFile_batchId_idx ON IngestSourceFile(batchId);
            CREATE INDEX IF NOT EXISTS IngestSourceFile_hash_idx ON IngestSourceFile(hash);
            CREATE TABLE IF NOT EXISTS IngestPageArtifact (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT NOT NULL,
              pageNumber INTEGER NOT NULL,
              method TEXT NOT NULL DEFAULT 'UNPROCESSED',
              textDensity REAL NOT NULL DEFAULT 0,
              extractedText TEXT,
              layoutJson TEXT,
              contentHash TEXT,
              requiresOcr BOOLEAN NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'PENDING',
              warning TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(sourceFileId, pageNumber)
            );
            CREATE INDEX IF NOT EXISTS IngestPageArtifact_batchId_idx ON IngestPageArtifact(batchId);
            CREATE INDEX IF NOT EXISTS IngestPageArtifact_contentHash_idx ON IngestPageArtifact(contentHash);
            CREATE TABLE IF NOT EXISTS IngestImageArtifact (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT NOT NULL,
              pageArtifactId TEXT,
              pageNumber INTEGER NOT NULL,
              imageIndex INTEGER NOT NULL,
              imageId TEXT,
              origin TEXT NOT NULL DEFAULT 'PDFPLUMBER',
              bboxJson TEXT,
              mimeType TEXT,
              base64Data TEXT,
              fileUrl TEXT,
              width INTEGER,
              height INTEGER,
              contentHash TEXT,
              status TEXT NOT NULL DEFAULT 'AVAILABLE',
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(sourceFileId, pageNumber, imageIndex, origin)
            );
            CREATE INDEX IF NOT EXISTS IngestImageArtifact_batchId_idx ON IngestImageArtifact(batchId);
            CREATE INDEX IF NOT EXISTS IngestImageArtifact_sourceFileId_idx ON IngestImageArtifact(sourceFileId);
            CREATE INDEX IF NOT EXISTS IngestImageArtifact_pageArtifactId_idx ON IngestImageArtifact(pageArtifactId);
            CREATE INDEX IF NOT EXISTS IngestImageArtifact_contentHash_idx ON IngestImageArtifact(contentHash);
            CREATE TABLE IF NOT EXISTS IngestCandidateImageLink (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              candidateId TEXT NOT NULL,
              imageArtifactId TEXT NOT NULL,
              targetType TEXT NOT NULL DEFAULT 'STEM',
              optionLabel TEXT,
              sortOrder INTEGER NOT NULL DEFAULT 0,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(candidateId, imageArtifactId, targetType, optionLabel)
            );
            CREATE INDEX IF NOT EXISTS IngestCandidateImageLink_batchId_idx ON IngestCandidateImageLink(batchId);
            CREATE INDEX IF NOT EXISTS IngestCandidateImageLink_candidateId_idx ON IngestCandidateImageLink(candidateId);
            CREATE INDEX IF NOT EXISTS IngestCandidateImageLink_imageArtifactId_idx ON IngestCandidateImageLink(imageArtifactId);
            CREATE TABLE IF NOT EXISTS IngestReviewSession (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL UNIQUE,
              sourceFileId TEXT,
              currentStep TEXT NOT NULL DEFAULT 'FILES',
              status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
              progressJson TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestReviewSession_sourceFileId_idx ON IngestReviewSession(sourceFileId);
            CREATE TABLE IF NOT EXISTS IngestJobEvent (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT,
              pageArtifactId TEXT,
              jobType TEXT NOT NULL DEFAULT 'PROCESS',
              status TEXT NOT NULL DEFAULT 'RUNNING',
              message TEXT NOT NULL,
              processedFiles INTEGER NOT NULL DEFAULT 0,
              processedPages INTEGER NOT NULL DEFAULT 0,
              totalFilesKnown INTEGER NOT NULL DEFAULT 0,
              totalPagesKnown INTEGER NOT NULL DEFAULT 0,
              estimatedRemainingPages REAL NOT NULL DEFAULT 0,
              estimatedSecondsRemaining INTEGER NOT NULL DEFAULT 0,
              secondsPerPage REAL NOT NULL DEFAULT 60,
              avgPagesPerFile REAL NOT NULL DEFAULT 0,
              metadataJson TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestJobEvent_batchId_idx ON IngestJobEvent(batchId);
            CREATE INDEX IF NOT EXISTS IngestJobEvent_sourceFileId_idx ON IngestJobEvent(sourceFileId);
            CREATE INDEX IF NOT EXISTS IngestJobEvent_jobType_idx ON IngestJobEvent(jobType);
            CREATE INDEX IF NOT EXISTS IngestJobEvent_status_idx ON IngestJobEvent(status);
            CREATE TABLE IF NOT EXISTS IngestOcrCache (
              id TEXT PRIMARY KEY,
              contentHash TEXT NOT NULL,
              model TEXT NOT NULL,
              responseJson TEXT NOT NULL,
              text TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(contentHash, model)
            );
            CREATE TABLE IF NOT EXISTS IngestQuestionCandidate (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT NOT NULL,
              pageArtifactId TEXT,
              questionNumber INTEGER,
              questionExternalId TEXT,
              testNumber INTEGER,
              moduleLabel TEXT,
              sourceLabel TEXT,
              contentType TEXT,
              section TEXT,
              domainName TEXT,
              topicName TEXT,
              subskillName TEXT,
              difficulty TEXT,
              difficultySource TEXT,
              practiceSetVariant TEXT,
              type TEXT NOT NULL DEFAULT 'MC',
              stem TEXT,
              stimulus TEXT,
              optionsJson TEXT,
              correctAnswer TEXT,
              explanation TEXT,
              answerSource TEXT,
              rawJson TEXT NOT NULL,
              confidence REAL NOT NULL DEFAULT 0,
              warningsJson TEXT,
              status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
              officialQuestionId TEXT,
              promotionStatus TEXT NOT NULL DEFAULT 'NOT_PROMOTED',
              promotedAt DATETIME,
              promotedById TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestQuestionCandidate_batchId_idx ON IngestQuestionCandidate(batchId);
            CREATE INDEX IF NOT EXISTS IngestQuestionCandidate_sourceFileId_idx ON IngestQuestionCandidate(sourceFileId);
            CREATE INDEX IF NOT EXISTS IngestQuestionCandidate_status_idx ON IngestQuestionCandidate(status);
            CREATE INDEX IF NOT EXISTS IngestQuestionCandidate_officialQuestionId_idx ON IngestQuestionCandidate(officialQuestionId);
            CREATE INDEX IF NOT EXISTS IngestQuestionCandidate_promotionStatus_idx ON IngestQuestionCandidate(promotionStatus);
            CREATE TABLE IF NOT EXISTS IngestPromotionArtifact (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT,
              artifactType TEXT NOT NULL,
              artifactId TEXT NOT NULL,
              groupKey TEXT NOT NULL,
              createdById TEXT,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(batchId, artifactType, groupKey)
            );
            CREATE INDEX IF NOT EXISTS IngestPromotionArtifact_batchId_idx ON IngestPromotionArtifact(batchId);
            CREATE INDEX IF NOT EXISTS IngestPromotionArtifact_sourceFileId_idx ON IngestPromotionArtifact(sourceFileId);
            CREATE INDEX IF NOT EXISTS IngestPromotionArtifact_artifactType_idx ON IngestPromotionArtifact(artifactType);
            CREATE INDEX IF NOT EXISTS IngestPromotionArtifact_artifactId_idx ON IngestPromotionArtifact(artifactId);
            CREATE TABLE IF NOT EXISTS IngestAnswerCandidate (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT NOT NULL,
              pageArtifactId TEXT,
              questionNumber INTEGER,
              questionExternalId TEXT,
              testNumber INTEGER,
              section TEXT,
              moduleLabel TEXT,
              answer TEXT,
              explanation TEXT,
              rawText TEXT,
              confidence REAL NOT NULL DEFAULT 0,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestAnswerCandidate_batchId_idx ON IngestAnswerCandidate(batchId);
            CREATE INDEX IF NOT EXISTS IngestAnswerCandidate_sourceFileId_idx ON IngestAnswerCandidate(sourceFileId);
            CREATE TABLE IF NOT EXISTS IngestIncident (
              id TEXT PRIMARY KEY,
              batchId TEXT NOT NULL,
              sourceFileId TEXT,
              pageArtifactId TEXT,
              severity TEXT NOT NULL DEFAULT 'WARNING',
              code TEXT NOT NULL,
              message TEXT NOT NULL,
              decision TEXT,
              action TEXT,
              status TEXT NOT NULL DEFAULT 'OPEN',
              contextHash TEXT NOT NULL UNIQUE,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IngestIncident_batchId_idx ON IngestIncident(batchId);
            CREATE INDEX IF NOT EXISTS IngestIncident_severity_idx ON IngestIncident(severity);
            """
        )
        for statement in [
            "ALTER TABLE IngestSourceFile ADD COLUMN contentType TEXT NOT NULL DEFAULT 'UNKNOWN'",
            "ALTER TABLE IngestSourceFile ADD COLUMN difficultySource TEXT",
            "ALTER TABLE IngestSourceFile ADD COLUMN practiceSetVariant TEXT",
            "ALTER TABLE IngestSourceFile ADD COLUMN isExplanationFile BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE IngestSourceFile ADD COLUMN isQuestionSource BOOLEAN NOT NULL DEFAULT 1",
            "ALTER TABLE IngestSourceFile ADD COLUMN metadataWarningsJson TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN contentType TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN questionExternalId TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN testNumber INTEGER",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN moduleLabel TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN difficultySource TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN practiceSetVariant TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN answerSource TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN officialQuestionId TEXT",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN promotionStatus TEXT NOT NULL DEFAULT 'NOT_PROMOTED'",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN promotedAt DATETIME",
            "ALTER TABLE IngestQuestionCandidate ADD COLUMN promotedById TEXT",
            "ALTER TABLE IngestAnswerCandidate ADD COLUMN questionExternalId TEXT",
            "ALTER TABLE IngestAnswerCandidate ADD COLUMN testNumber INTEGER",
            "ALTER TABLE IngestAnswerCandidate ADD COLUMN section TEXT",
            "ALTER TABLE IngestAnswerCandidate ADD COLUMN moduleLabel TEXT",
            "ALTER TABLE IngestImageArtifact ADD COLUMN fileUrl TEXT",
            "ALTER TABLE IngestImageArtifact ADD COLUMN width INTEGER",
            "ALTER TABLE IngestImageArtifact ADD COLUMN height INTEGER",
            "ALTER TABLE IngestImageArtifact ADD COLUMN contentHash TEXT",
            "ALTER TABLE IngestImageArtifact ADD COLUMN status TEXT NOT NULL DEFAULT 'AVAILABLE'",
        ]:
            try:
                db.execute(statement)
            except sqlite3.OperationalError:
                pass


def log_ingest_incident(
    db: sqlite3.Connection,
    *,
    batch_id: str,
    code: str,
    message: str,
    severity: str = "WARNING",
    source_file_id: str | None = None,
    page_artifact_id: str | None = None,
    decision: str | None = None,
    action: str | None = None,
    status: str = "OPEN",
) -> None:
    context_hash = text_hash(
        "|".join(
            [
                batch_id,
                source_file_id or "",
                page_artifact_id or "",
                severity,
                code,
                message,
            ]
        )
    )
    db.execute(
        """
        INSERT OR IGNORE INTO IngestIncident
          (id, batchId, sourceFileId, pageArtifactId, severity, code, message, decision, action, status, contextHash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
        (new_id("inc"), batch_id, source_file_id, page_artifact_id, severity, code, message, decision, action, status, context_hash),
    )


def batch_progress_snapshot(
    db: sqlite3.Connection,
    batch_id: str,
    *,
    started_at: float | None = None,
    started_processed_pages: int = 0,
    processed_pages_override: int | None = None,
) -> dict[str, Any]:
    total_files = db.execute("SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ?", (batch_id,)).fetchone()[0]
    processed_files = db.execute(
        "SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ? AND status = 'COMPLETED'",
        (batch_id,),
    ).fetchone()[0]
    counted_files = db.execute(
        "SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ? AND pageCount > 0",
        (batch_id,),
    ).fetchone()[0]
    total_pages_known = db.execute(
        "SELECT COALESCE(SUM(pageCount), 0) FROM IngestSourceFile WHERE batchId = ?",
        (batch_id,),
    ).fetchone()[0]
    processed_pages = db.execute(
        "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
        (batch_id,),
    ).fetchone()[0]
    if processed_pages_override is not None:
        processed_pages = max(processed_pages, processed_pages_override)
    pending_ocr_pages = db.execute(
        "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'NEEDS_OCR'",
        (batch_id,),
    ).fetchone()[0]

    avg_pages_per_file = (total_pages_known / counted_files) if counted_files else 1
    unknown_files = max(total_files - counted_files, 0)
    estimated_total_pages = total_pages_known + (unknown_files * avg_pages_per_file)
    remaining_pages = max(estimated_total_pages - processed_pages, 0) + pending_ocr_pages

    historic = db.execute(
        """
        SELECT secondsPerPage FROM IngestJobEvent
        WHERE batchId = ? AND secondsPerPage > 0 AND processedPages > 0
        ORDER BY createdAt DESC
        LIMIT 1
        """,
        (batch_id,),
    ).fetchone()
    historic_seconds_per_page = float(historic["secondsPerPage"]) if historic else 60.0
    current_run_pages = max(processed_pages - started_processed_pages, 0)
    if started_at and current_run_pages > 0:
        seconds_per_page = max((time.monotonic() - started_at) / current_run_pages, 1)
    else:
        seconds_per_page = historic_seconds_per_page

    estimated_seconds_remaining = int(max(remaining_pages * seconds_per_page, 0))
    return {
        "totalFiles": total_files,
        "processedFiles": processed_files,
        "countedFiles": counted_files,
        "unknownFiles": unknown_files,
        "totalPagesKnown": int(total_pages_known),
        "processedPages": int(processed_pages),
        "pendingOcrPages": int(pending_ocr_pages),
        "avgPagesPerFile": float(avg_pages_per_file),
        "estimatedRemainingPages": float(remaining_pages),
        "estimatedSecondsRemaining": estimated_seconds_remaining,
        "secondsPerPage": float(seconds_per_page),
    }


def log_ingest_job_event(
    db: sqlite3.Connection,
    *,
    batch_id: str,
    message: str,
    job_type: str = "PROCESS",
    status: str = "RUNNING",
    source_file_id: str | None = None,
    page_artifact_id: str | None = None,
    started_at: float | None = None,
    started_processed_pages: int = 0,
    processed_pages_override: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    snapshot = batch_progress_snapshot(
        db,
        batch_id,
        started_at=started_at,
        started_processed_pages=started_processed_pages,
        processed_pages_override=processed_pages_override,
    )
    db.execute(
        """
        INSERT INTO IngestJobEvent
          (id, batchId, sourceFileId, pageArtifactId, jobType, status, message, processedFiles, processedPages,
           totalFilesKnown, totalPagesKnown, estimatedRemainingPages, estimatedSecondsRemaining, secondsPerPage,
           avgPagesPerFile, metadataJson, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("evt"),
            batch_id,
            source_file_id,
            page_artifact_id,
            job_type,
            status,
            message,
            snapshot["processedFiles"],
            snapshot["processedPages"],
            snapshot["totalFiles"],
            snapshot["totalPagesKnown"],
            snapshot["estimatedRemainingPages"],
            snapshot["estimatedSecondsRemaining"],
            snapshot["secondsPerPage"],
            snapshot["avgPagesPerFile"],
            json.dumps({**snapshot, **(metadata or {})}),
            now_iso(),
        ),
    )
    return snapshot


@app.on_event("startup")
def startup() -> None:
    init_db()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_existing_source_path(path_value: str | Path) -> Path:
    path = Path(path_value)
    if path.exists():
        return path
    parts = path.parts
    if path.is_absolute() and len(parts) > 2 and parts[1] == "app":
        workspace_path = Path.cwd().joinpath(*parts[2:])
        if workspace_path.exists():
            return workspace_path
    relative_path = Path(str(path_value).lstrip("/"))
    workspace_path = Path.cwd() / relative_path
    if workspace_path.exists():
        return workspace_path
    return path


def text_hash(text: str, salt: str = "") -> str:
    return hashlib.sha256((salt + text).encode("utf-8", errors="ignore")).hexdigest()


def bytes_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_ingest_image(batch_id: str, image_id: str, data: bytes, extension: str = "jpg") -> tuple[str, str]:
    digest = bytes_hash(data)
    safe_ext = extension.lower().lstrip(".") or "jpg"
    if safe_ext == "jpeg":
        safe_ext = "jpg"
    directory = PUBLIC_UPLOAD_ROOT / batch_id
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{image_id}-{digest[:12]}.{safe_ext}"
    path = directory / filename
    if not path.exists():
        path.write_bytes(data)
    return f"{PUBLIC_UPLOAD_URL_PREFIX}/{batch_id}/{filename}", digest


def decode_base64_image(value: str | None) -> tuple[bytes | None, str]:
    if not value:
        return None, "jpg"
    raw = value
    extension = "jpg"
    if value.startswith("data:"):
        header, _, raw = value.partition(",")
        if "png" in header:
            extension = "png"
        elif "webp" in header:
            extension = "webp"
    try:
        return base64.b64decode(raw), extension
    except Exception:
        return None, extension


def crop_pdf_image(path: Path, page_number: int, bbox: dict[str, Any]) -> tuple[bytes | None, int | None, int | None]:
    try:
        with pdfplumber.open(path) as pdf:
            page = pdf.pages[page_number - 1]
            x0 = float(bbox.get("x0") if bbox.get("x0") is not None else bbox.get("top_left_x"))
            top = float(bbox.get("top") if bbox.get("top") is not None else bbox.get("top_left_y"))
            x1 = float(bbox.get("x1") if bbox.get("x1") is not None else bbox.get("bottom_right_x"))
            bottom = float(bbox.get("bottom") if bbox.get("bottom") is not None else bbox.get("bottom_right_y"))
            cropped = page.crop((x0, top, x1, bottom)).to_image(resolution=180).original.convert("RGB")
            output = BytesIO()
            cropped.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue(), cropped.width, cropped.height
    except Exception:
        return None, None, None


def render_pdf_page_jpeg(path: Path, page_number: int, dpi: int = 150) -> tuple[bytes | None, float | None, float | None]:
    """Renderiza una página completa a JPEG para mostrarla en el navegador (cropper).
    Devuelve (bytes, page.width, page.height) en puntos PDF para mapear coords."""
    try:
        with pdfplumber.open(path) as pdf:
            if page_number < 1 or page_number > len(pdf.pages):
                return None, None, None
            page = pdf.pages[page_number - 1]
            image = page.to_image(resolution=dpi).original.convert("RGB")
            output = BytesIO()
            image.save(output, format="JPEG", quality=85, optimize=True)
            return output.getvalue(), float(page.width), float(page.height)
    except Exception:
        return None, None, None


def crop_pdf_region_normalized(
    path: Path, page_number: int, bbox_norm: dict[str, Any]
) -> tuple[bytes | None, int | None, int | None, dict[str, float] | None]:
    """Recorta una región dada en coordenadas NORMALIZADAS [0,1] (esquina sup-izq
    = 0,0), convirtiéndolas a puntos PDF con page.width/height. Independiente de
    DPI/zoom del navegador. Devuelve (jpeg, w_px, h_px, puntos_pdf)."""
    try:
        with pdfplumber.open(path) as pdf:
            if page_number < 1 or page_number > len(pdf.pages):
                return None, None, None, None
            page = pdf.pages[page_number - 1]
            pw, ph = float(page.width), float(page.height)
            clamp = lambda v: max(0.0, min(1.0, float(v)))
            x0 = clamp(bbox_norm.get("x0", 0)) * pw
            y0 = clamp(bbox_norm.get("y0", 0)) * ph
            x1 = clamp(bbox_norm.get("x1", 1)) * pw
            y1 = clamp(bbox_norm.get("y1", 1)) * ph
            if x1 - x0 < 1.0 or y1 - y0 < 1.0:
                return None, None, None, None
            cropped = page.crop((x0, y0, x1, y1)).to_image(resolution=180).original.convert("RGB")
            output = BytesIO()
            cropped.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue(), cropped.width, cropped.height, {"x0": x0, "top": y0, "x1": x1, "bottom": y1}
    except Exception:
        return None, None, None, None


def crop_image_region_normalized(
    image_path: Path, bbox_norm: dict[str, Any]
) -> tuple[bytes | None, int | None, int | None, dict[str, float] | None]:
    """Recorta una región NORMALIZADA [0,1] de una imagen de página ya extraída
    (p. ej. el screenshot de un DOCX). Equivalente a crop_pdf_region_normalized
    pero con Pillow, para fuentes que no son PDF. Coord (0,0)=esquina sup-izq."""
    try:
        with Image.open(image_path) as im:
            im = im.convert("RGB")
            W, H = im.width, im.height
            clamp = lambda v: max(0.0, min(1.0, float(v)))
            x0 = int(round(clamp(bbox_norm.get("x0", 0)) * W))
            y0 = int(round(clamp(bbox_norm.get("y0", 0)) * H))
            x1 = int(round(clamp(bbox_norm.get("x1", 1)) * W))
            y1 = int(round(clamp(bbox_norm.get("y1", 1)) * H))
            if x1 - x0 < 2 or y1 - y0 < 2:
                return None, None, None, None
            cropped = im.crop((x0, y0, x1, y1))
            output = BytesIO()
            cropped.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue(), cropped.width, cropped.height, {"x0": float(x0), "top": float(y0), "x1": float(x1), "bottom": float(y1)}
    except Exception:
        return None, None, None, None


def resolve_asset_disk_path(file_url: str | None) -> Path | None:
    """Mapea un fileUrl (/api/admin/ai-import/assets/<batch>/<file>) al archivo en
    disco bajo PUBLIC_UPLOAD_ROOT, con guard de traversal."""
    if not file_url:
        return None
    prefix = PUBLIC_UPLOAD_URL_PREFIX + "/"
    if not file_url.startswith(prefix):
        return None
    rel = file_url[len(prefix):]
    parts = rel.split("/")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    root = PUBLIC_UPLOAD_ROOT.resolve()
    candidate = (root / parts[0] / parts[1]).resolve()
    if not str(candidate).startswith(f"{root}{os.sep}"):
        return None
    return candidate if candidate.exists() else None


def find_page_image_disk_path(db: Any, source_file_id: str, page_number: int) -> Path | None:
    """Devuelve la imagen de página completa (no un recorte manual) para
    (sourceFileId, pageNumber), para poder recortar DOCX por región. Ordena por
    imageIndex ASC para coincidir con la imagen que muestra el visor (el fallback
    de la ruta Next usa el mismo criterio), de modo que las coords normalizadas
    del recorte mapeen sobre la misma imagen."""
    rows = db.execute(
        "SELECT fileUrl, COALESCE(width,0) w, COALESCE(height,0) h FROM IngestImageArtifact "
        "WHERE sourceFileId = ? AND pageNumber = ? AND origin <> 'MANUAL_CROP' "
        "ORDER BY imageIndex ASC",
        (source_file_id, page_number),
    ).fetchall()
    for row in rows:
        p = resolve_asset_disk_path(row["fileUrl"])
        if p:
            return p
    return None


CROP_TARGET_TYPES = {"STEM", "STIMULUS", "OPTION", "OPTION_BLOCK", "ANSWER_FIELD", "EXPLANATION", "PAGE_CONTEXT"}


def crop_candidate_region(
    candidate_id: str,
    page_number: int,
    bbox_norm: dict[str, Any],
    mode: str,
    target_type: str,
    option_label: str | None,
    image_source_file_id: str | None = None,
) -> dict[str, Any]:
    """Recorta una región del PDF de un candidato y la trabaja según `mode`:
    ASSIGN → guarda el recorte como IngestImageArtifact (origin MANUAL_CROP) y crea
    el IngestCandidateImageLink al target. OCR → transcribe el recorte y devuelve el
    texto (y opciones A-D si target es OPTION_BLOCK) para revisión en el front; NO
    modifica el candidato."""
    mode = (mode or "").upper()
    target_type = (target_type or "").upper()
    option_label = option_label.upper() if option_label else None
    if mode not in {"ASSIGN", "OCR"}:
        raise HTTPException(status_code=400, detail="mode must be ASSIGN or OCR.")
    if target_type not in CROP_TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid targetType.")
    if target_type == "OPTION" and not option_label:
        raise HTTPException(status_code=400, detail="optionLabel is required for OPTION target.")
    with conn() as db:
        init_db()
        candidate = db.execute("SELECT * FROM IngestQuestionCandidate WHERE id = ?", (candidate_id,)).fetchone()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found.")
        source = db.execute("SELECT * FROM IngestSourceFile WHERE id = ?", (candidate["sourceFileId"],)).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="Source file not found.")
        # The pixels may come from a *sibling* source in the same batch — e.g. Test 1
        # R&W keeps candidates in the answer-explanations DOCX (no page images) while
        # the passages/figures live in the questions DOCX. The reviewer selects which
        # source to view; we crop from that one but still link the crop to this
        # candidate. The artifact stays recorded under the candidate's own source so
        # it shows up in that file's image board.
        image_source = source
        if image_source_file_id and image_source_file_id != source["id"]:
            alt = db.execute("SELECT * FROM IngestSourceFile WHERE id = ?", (image_source_file_id,)).fetchone()
            if not alt:
                raise HTTPException(status_code=404, detail="Image source file not found.")
            if alt["batchId"] != candidate["batchId"]:
                raise HTTPException(status_code=400, detail="Image source must belong to the same batch.")
            image_source = alt
        path = resolve_existing_source_path(image_source["path"])
        if path.exists() and path.suffix.lower() == ".pdf":
            image_bytes, w_px, h_px, points = crop_pdf_region_normalized(path, page_number, bbox_norm)
        else:
            # Non-PDF source (e.g. a DOCX of page screenshots): crop the already-
            # extracted full-page image with Pillow, so region ASSIGN/OCR behaves
            # the same as for PDFs.
            page_image = find_page_image_disk_path(db, image_source["id"], page_number)
            if not page_image:
                raise HTTPException(status_code=400, detail="No hay imagen de página para recortar en este archivo.")
            image_bytes, w_px, h_px, points = crop_image_region_normalized(page_image, bbox_norm)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Could not render the selected region.")
        image_id = new_id("img")
        file_url, content_hash = save_ingest_image(candidate["batchId"], image_id, image_bytes, "jpg")
        next_index = db.execute(
            "SELECT COALESCE(MAX(imageIndex), -1) + 1 FROM IngestImageArtifact WHERE sourceFileId = ? AND pageNumber = ? AND origin = 'MANUAL_CROP'",
            (source["id"], page_number),
        ).fetchone()[0]
        bbox_json = json.dumps({"normalized": bbox_norm, "points": points, "renderedWidth": w_px, "renderedHeight": h_px})
        db.execute(
            """
            INSERT INTO IngestImageArtifact
              (id, batchId, sourceFileId, pageArtifactId, pageNumber, imageIndex, imageId, origin, bboxJson, mimeType, fileUrl, width, height, contentHash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL_CROP', ?, 'image/jpeg', ?, ?, ?, ?, 'AVAILABLE')
            """,
            (image_id, candidate["batchId"], source["id"], candidate["pageArtifactId"], page_number, next_index, image_id, bbox_json, file_url, w_px, h_px, content_hash),
        )
        result: dict[str, Any] = {"candidateId": candidate_id, "imageArtifactId": image_id, "fileUrl": file_url, "pageNumber": page_number, "mode": mode}
        if mode == "ASSIGN":
            db.execute(
                """
                INSERT OR IGNORE INTO IngestCandidateImageLink
                  (id, batchId, candidateId, imageArtifactId, targetType, optionLabel, sortOrder, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (new_id("imglink"), candidate["batchId"], candidate_id, image_id, target_type, option_label if target_type == "OPTION" else None, now_iso(), now_iso()),
            )
            log_ingest_job_event(
                db,
                batch_id=candidate["batchId"],
                source_file_id=source["id"],
                page_artifact_id=candidate["pageArtifactId"],
                job_type="MANUAL_CROP_ASSIGN",
                status="COMPLETED",
                message=f"Assigned cropped region to {target_type}{('/' + option_label) if option_label else ''} for candidate {candidate_id}.",
                metadata={"imageArtifactId": image_id, "targetType": target_type, "optionLabel": option_label},
            )
            result["assigned"] = {"targetType": target_type, "optionLabel": option_label if target_type == "OPTION" else None}
        else:  # OCR
            text, payload = run_mistral_ocr_image(base64.b64encode(image_bytes).decode("utf-8"), "image/jpeg")
            result["text"] = text
            if payload.get("warning"):
                result["warning"] = payload["warning"]
            # Always attempt A–D parsing so the reviewer can assign the OCR to the
            # options block even if the pre-crop target wasn't OPTION_BLOCK (the
            # destination field is now chosen after OCR, in the review panel).
            options = extract_options_from_image_ocr(text or "")
            if options:
                result["options"] = options
            log_ingest_job_event(
                db,
                batch_id=candidate["batchId"],
                source_file_id=source["id"],
                page_artifact_id=candidate["pageArtifactId"],
                job_type="MANUAL_CROP_OCR",
                status="COMPLETED",
                message=f"OCR'd cropped region ({target_type}) for candidate {candidate_id}.",
                metadata={"imageArtifactId": image_id, "targetType": target_type, "chars": len(text or "")},
            )
        db.commit()
        return result


def detect_difficulty_and_variant(value: str) -> tuple[str | None, str | None]:
    normalized = re.sub(r"[_\-.]+", " ", value.lower())
    difficulty = None
    variant = None
    if re.search(r"\beasy\b|\beasy\d+", normalized):
        difficulty = "EASY"
    elif re.search(r"\bmed(?:ium)?\b|\bmed(?:ium)?\d+", normalized):
        difficulty = "MEDIUM"
    elif re.search(r"\bhard\b|\bhard\d+|\bh\s*\d+\b", normalized):
        difficulty = "HARD"
    variant_match = re.search(r"\b(?:hard|h|med(?:ium)?|easy)\s*(\d+)", normalized)
    if variant_match:
        variant = variant_match.group(1)
    return difficulty, variant


def detect_full_test_section(value: str) -> str | None:
    normalized = re.sub(r"[_\-.]+", " ", value.lower().replace("&", " and "))
    if re.search(r"\bmaths?\b", normalized):
        return "MATH"
    if re.search(r"\breading\b|\bwriting\b|\br\s*and\s*w\b|\brw\b", normalized):
        return "RW"
    return None


def detect_full_test_modules(value: str) -> list[str]:
    normalized = re.sub(r"[_\-.]+", " ", value.lower().replace("&", " and "))
    modules: list[str] = []
    module_2_hint = bool(re.search(r"\bmodule\s*2\b|\bmod\s*2\b|\b(?:math|reading and writing|r and w|rw)\s*2\b|\b2\b", normalized))
    if re.search(r"\bmodule\s*1\b|\bmod\s*1\b|\bmod\s*1\s*(?:and|,|&)|\b(?:math|reading and writing|r and w|rw)\s*1\b", normalized):
        modules.append("1")
    if re.search(r"\bmodule\s*2a\b|\bmod\s*2a\b|\b(?:math|reading and writing|r and w|rw)\s*2a\b|\b2a\b", normalized) or (
        module_2_hint and re.search(r"\beasy\b|\beasier\b", normalized)
    ):
        modules.append("2A")
    if re.search(r"\bmodule\s*2b\b|\bmod\s*2b\b|\b(?:math|reading and writing|r and w|rw)\s*2b\b|\b2b\b", normalized) or (
        module_2_hint and re.search(r"\bhard\b|\bharder\b", normalized)
    ):
        modules.append("2B")
    if re.search(r"\bmodule\s*2\b|\bmod\s*2\b|\b(?:math|reading and writing|r and w|rw)\s*2\b|\b1\s*(?:and|,|&)\s*2\b|\bmodules?\s*1\s*(?:and|,|&)\s*2\b", normalized):
        if "2" not in modules and "2A" not in modules and "2B" not in modules:
            modules.append("2")
    return modules


def infer_full_test_section_from_text(text: str) -> str | None:
    sample = text[:5000]
    math_hits = len(re.findall(r"\bmath\b", sample, re.IGNORECASE))
    rw_hits = len(re.findall(r"\breading\b|\bwriting\b|\br\s*&\s*w\b|\br\s+and\s+w\b", sample, re.IGNORECASE))
    if math_hits and not rw_hits:
        return "MATH"
    if rw_hits and not math_hits:
        return "RW"
    return None


def normalize_taxonomy_key(value: str | None) -> str:
    normalized = (value or "").lower().replace("&", " and ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    replacements = {
        "equiv": "equivalent",
        "equival": "equivalent",
        "expres": "expression",
        "express": "expression",
        "eq": "equations",
        "funct": "functions",
        "lin": "linear",
        "var": "variable",
        "vars": "variables",
        "trig": "trigonometry",
        "propo": "proportions",
        "proport": "proportions",
        "percents": "percentages",
        "percent": "percentages",
        "statis": "statistical",
        "stat": "statistical",
        "grammar": "form structure and sense",
        "sn": "student notes",
        "ce": "command evidence",
    }
    return " ".join(replacements.get(token, token) for token in normalized.split())


PRACTICE_MATH_DOMAIN_MAP = {
    "advanced math": "Advanced Math",
    "algebra": "Algebra",
    "geometry and trigonometry": "Geometry and Trigonometry",
    "problem solving data analysis": "Problem Solving and Data Analysis",
}

PRACTICE_SKILL_MAP = {
    "equivalent expression": "Equivalent Expressions",
    "equivalent expressions": "Equivalent Expressions",
    "non linear equations": "Nonlinear Equations",
    "nonlinear equations": "Nonlinear Equations",
    "non linear functions": "Nonlinear Functions",
    "nonlinear functions": "Nonlinear Functions",
    "linear equations one variable": "Linear Equations in One Variable",
    "linear equations in one variable": "Linear Equations in One Variable",
    "linear equations two variables": "Linear Equations in Two Variables",
    "linear equations in two variables": "Linear Equations in Two Variables",
    "linear functions": "Linear Functions",
    "linear inequalities": "Linear Inequalities",
    "systems two linear equations and equations in two variables": "Systems of Two Linear Equations",
    "areas and volumes": "Area and Volume",
    "area and volume": "Area and Volume",
    "circles": "Circles",
    "lines angles triangles": "Lines, Angles, and Triangles",
    "right triangles and trigonometry": "Right Triangles and Trigonometry",
    "data and mean": "One-Variable Data: Distributions and Measures",
    "inference and margin of error": "Inference and Margin of Error",
    "one variable data": "One-Variable Data",
    "percentages": "Percentages",
    "probability": "Probability",
    "ratios rates proportions units": "Ratios, Rates, Proportions, and Units",
    "statistical claims": "Statistical Claims",
    "two variable data": "Two-Variable Data",
    "command evidence": "Command of Evidence",
    "double passage": "Cross-Text Connections",
    "inferences": "Inferences",
    "main idea and details": "Central Ideas and Details",
    "text structure and purpose": "Text Structure and Purpose",
    "words in context": "Words in Context",
    "boundaries": "Boundaries",
    "structure and form structure and sense": "Form, Structure, and Sense",
    "structure and grammar": "Form, Structure, and Sense",
    "student notes": "Rhetorical Synthesis",
    "transitions": "Transitions",
}

READING_SKILL_DOMAIN_MAP = {
    "Command of Evidence": "Information and Ideas",
    "Cross-Text Connections": "Information and Ideas",
    "Inferences": "Information and Ideas",
    "Central Ideas and Details": "Information and Ideas",
    "Text Structure and Purpose": "Craft and Structure",
    "Words in Context": "Craft and Structure",
}

WRITING_SKILL_DOMAIN_MAP = {
    "Boundaries": "Standard English Conventions",
    "Form, Structure, and Sense": "Standard English Conventions",
    "Rhetorical Synthesis": "Expression of Ideas",
    "Transitions": "Expression of Ideas",
}


def canonical_math_domain(value: str | None) -> str | None:
    return PRACTICE_MATH_DOMAIN_MAP.get(normalize_taxonomy_key(value), value.strip() if value else None)


def canonical_skill(value: str | None) -> str | None:
    if not value:
        return None
    return PRACTICE_SKILL_MAP.get(normalize_taxonomy_key(value), value.strip())


def practice_metadata_from_path_parts(parts: list[str]) -> tuple[str | None, str | None, str | None]:
    upper_parts = [part.upper() for part in parts]
    if "EXERCISES MATH" in upper_parts:
        index = upper_parts.index("EXERCISES MATH")
        domain = canonical_math_domain(parts[index + 1] if index + 1 < len(parts) else None)
        skill = canonical_skill(parts[index + 2] if index + 2 < len(parts) else None)
        return "MATH", domain, skill
    if "EXERCISES READING" in upper_parts:
        index = upper_parts.index("EXERCISES READING")
        skill = canonical_skill(parts[index + 1] if index + 1 < len(parts) else None)
        return "RW", READING_SKILL_DOMAIN_MAP.get(skill or ""), skill
    if "EXERCISES WRITING" in upper_parts:
        index = upper_parts.index("EXERCISES WRITING")
        skill = canonical_skill(parts[index + 1] if index + 1 < len(parts) else None)
        return "RW", WRITING_SKILL_DOMAIN_MAP.get(skill or ""), skill
    return None, None, None


def internal_practice_metadata_from_text(text: str) -> dict[str, str] | None:
    sample = re.sub(r"\s+", " ", text[:2500]).strip()
    if "Assessment Test Domain Skill Difficulty" not in sample:
        return None
    section_match = re.search(r"\bSAT\s+(Math|Reading(?:\s+and\s+Writing)?|Writing)\b", sample, re.IGNORECASE)
    difficulty_match = re.search(r"\bQuestion\s+Difficulty:\s*(Easy|Medium|Med|Hard)\b", sample, re.IGNORECASE)
    if not difficulty_match:
        difficulty_match = re.search(r"\b(Easy|Medium|Med|Hard)\b(?=\s+(?:ID:|Question ID|$))", sample, re.IGNORECASE)
    section = None
    if section_match:
        section = "MATH" if section_match.group(1).lower() == "math" else "RW"
    domain = None
    skill = None
    for canonical_domain in [
        "Advanced Math",
        "Algebra",
        "Problem Solving and Data Analysis",
        "Geometry and Trigonometry",
        "Information and Ideas",
        "Craft and Structure",
        "Expression of Ideas",
        "Standard English Conventions",
    ]:
        match = re.search(re.escape(canonical_domain), sample, re.IGNORECASE)
        if match:
            domain = canonical_domain
            after_domain = sample[match.end():]
            end_match = re.search(r"\b(?:ID:|Question ID|Easy|Medium|Med|Hard|Question Difficulty:)\b", after_domain, re.IGNORECASE)
            raw_skill = after_domain[: end_match.start() if end_match else 120].strip()
            skill = canonical_skill(raw_skill)
            break
    if not any([section, domain, skill, difficulty_match]):
        return None
    return {
        "section": section or "",
        "domainName": domain or "",
        "topicName": skill or "",
        "difficulty": normalize_difficulty_label(difficulty_match.group(1)) if difficulty_match else "",
    }


def normalize_difficulty_label(value: str | None) -> str | None:
    if not value:
        return None
    key = value.strip().upper()
    if key == "MED":
        return "MEDIUM"
    if key in {"EASY", "MEDIUM", "HARD"}:
        return key
    return None


def metadata_warnings(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def metadata_warnings_json(warnings: list[str]) -> str:
    unique: list[str] = []
    for warning in warnings:
        if warning and warning not in unique:
            unique.append(warning)
    return json.dumps(unique)


def normalized_pair_title(path_value: str) -> str:
    stem = Path(path_value).stem.lower()
    stem = re.sub(r"\b(ans|answer|answers|key|explanations?|expl|exp)\b", " ", stem)
    stem = re.sub(r"\b(easy|medium|med|hard|h)\s*\d*\b", " ", stem)
    stem = re.sub(r"\b\d+\b", " ", stem)
    stem = stem.replace("&", " and ")
    stem = re.sub(r"[^a-z0-9]+", " ", stem)
    replacements = {
        "equiv": "equivalent",
        "equival": "equivalent",
        "expres": "expression",
        "express": "expression",
        "funct": "functions",
        "eq": "equations",
        "lin": "linear",
        "var": "variables",
        "tri": "triangles",
        "trig": "trigonometry",
    }
    tokens = [replacements.get(token, token) for token in stem.split() if len(token) > 1]
    return " ".join(tokens)


def source_pair_key(row: sqlite3.Row) -> tuple[Any, ...]:
    if row["contentType"] == "PRACTICE_SET":
        return (
            "PRACTICE_SET",
            row["section"],
            row["domainName"],
            row["topicName"],
            normalized_pair_title(row["relativePath"]),
        )
    if row["contentType"] == "FULL_PRACTICE_TEST":
        return (
            "FULL_PRACTICE_TEST",
            row["testNumber"],
            row["section"],
            row["sourceKind"],
        )
    return ("UNKNOWN", row["relativePath"])


def infer_metadata(base_path: Path, path: Path) -> dict[str, Any]:
    relative = path.relative_to(base_path).as_posix()
    context = f"{base_path.as_posix()}/{relative}"
    lower = context.lower()
    name = path.name.lower()
    parts = [p.strip() for p in relative.split("/")]
    upper_parts = [p.upper() for p in parts]
    metadata_warnings: list[str] = []
    is_explanation = bool(re.search(r"\b(explanations?|expl|exp)\b|explan", name))
    is_answer = bool(re.search(r"(^|[\s_\-.])(ans|answer|answers|key)([\s_\-.]|$)", name)) or is_explanation
    test_match = re.search(r"test\s*([0-9]+)", lower)
    filename_difficulty, filename_variant = detect_difficulty_and_variant(path.stem)
    path_difficulty, path_variant = detect_difficulty_and_variant("/".join(parts[:-1]))
    difficulty = filename_difficulty or path_difficulty
    difficulty_source = "FILENAME" if filename_difficulty else "PATH" if path_difficulty else None
    practice_set_variant = filename_variant or path_variant
    if filename_difficulty and path_difficulty and filename_difficulty != path_difficulty:
        metadata_warnings.append(f"Filename difficulty {filename_difficulty} overrides path difficulty {path_difficulty}.")

    section = detect_full_test_section(lower)

    content_type = "UNKNOWN"
    source_kind = "UNKNOWN"
    if "mock exams" in lower:
        content_type = "FULL_PRACTICE_TEST"
        source_kind = "ANSWER_EXPLANATION" if is_explanation else "ANSWER_KEY" if is_answer else "MOCK_EXAM"
        difficulty = None
        difficulty_source = None
        practice_set_variant = None
        modules = detect_full_test_modules(relative)
        if modules:
            metadata_warnings.append(f"Full Practice Test module hint from path/name: {', '.join(modules)}.")
    elif "practice exercises" in lower:
        content_type = "PRACTICE_SET"
        source_kind = "ANSWER_EXPLANATION" if is_explanation else "ANSWER_KEY" if is_answer else "PRACTICE_EXERCISE"

    domain_name = None
    topic_name = None
    if content_type == "PRACTICE_SET":
        practice_section, canonical_domain, canonical_topic = practice_metadata_from_path_parts(parts)
        section = practice_section or section
        domain_name = canonical_domain
        topic_name = canonical_topic
        if not domain_name or not topic_name:
            relevant = [
                p
                for p in parts
                if p.upper() not in {"PRACTICE EXERCISES", "EXERCISES MATH", "EXERCISES READING", "EXERCISES WRITING"}
                and not p.lower().endswith((".pdf", ".docx"))
            ]
            if relevant and not domain_name:
                domain_name = relevant[0]
            if len(relevant) > 1 and not topic_name:
                topic_name = relevant[-1]
            metadata_warnings.append("Practice Set taxonomy used fallback path inference; review domain/skill mapping.")
    elif content_type == "FULL_PRACTICE_TEST":
        domain_name = "FULL PRACTICE TEST"
        test_label = f"TEST {test_match.group(1)}" if test_match else next((p for p in upper_parts if re.search(r"TEST\s*[0-9]+", p)), None)
        if section:
            section_label = "MATH" if section == "MATH" else "READING AND WRITING"
            topic_name = f"{test_label or 'FULL PRACTICE TEST'} {section_label}"
        else:
            topic_name = test_label or "FULL PRACTICE TEST"

    return {
        "relativePath": relative,
        "extension": path.suffix.lower().replace(".", ""),
        "contentType": content_type,
        "sourceKind": source_kind,
        "section": section,
        "domainName": domain_name,
        "topicName": topic_name,
        "difficulty": difficulty,
        "difficultySource": difficulty_source,
        "practiceSetVariant": practice_set_variant,
        "testNumber": int(test_match.group(1)) if test_match else None,
        "isAnswerFile": is_answer,
        "isExplanationFile": is_explanation,
        "isQuestionSource": not is_answer,
        "metadataWarningsJson": json.dumps(metadata_warnings),
    }


def list_sources(base_path: Path) -> list[Path]:
    sources = sorted([p for p in base_path.rglob("*") if p.is_file() and p.suffix.lower() in {".pdf", ".docx"}])
    if len(sources) > MAX_SOURCE_FILES:
        raise HTTPException(status_code=413, detail=f"Too many source files. Maximum allowed is {MAX_SOURCE_FILES}.")
    return sources


def create_batch_from_path(name: str, base_path: Path) -> dict[str, Any]:
    init_db()
    resolved_base_path = base_path.resolve()
    if not resolved_base_path.exists():
        raise HTTPException(status_code=400, detail=f"Base path does not exist: {resolved_base_path}")
    if not resolved_base_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Base path must be a directory: {resolved_base_path}")
    batch_id = new_id("batch")
    sources = list_sources(resolved_base_path)
    with conn() as db:
        db.execute(
            "INSERT INTO IngestBatch (id, name, basePath, status, totalFiles, updatedAt) VALUES (?, ?, ?, 'SCANNING', ?, ?)",
            (batch_id, name, str(resolved_base_path), len(sources), now_iso()),
        )
        for source in sources:
            insert_source_file(db, batch_id, resolved_base_path, source.resolve())
        normalized = normalize_batch_metadata(db, batch_id)
        db.execute("UPDATE IngestBatch SET status = 'PENDING', updatedAt = ? WHERE id = ?", (now_iso(), batch_id))
    return {"id": batch_id, "totalFiles": len(sources), "basePath": str(resolved_base_path), **normalized}


def insert_source_file(db: sqlite3.Connection, batch_id: str, base_path: Path, path: Path) -> str:
    meta = infer_metadata(base_path, path)
    source_id = new_id("src")
    digest = file_hash(path)
    db.execute(
        """
        INSERT INTO IngestSourceFile
          (id, batchId, path, relativePath, hash, extension, contentType, sourceKind, section, domainName, topicName, difficulty, difficultySource, practiceSetVariant, testNumber, isAnswerFile, isExplanationFile, isQuestionSource, metadataWarningsJson, status, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        """,
        (
            source_id,
            batch_id,
            str(path),
            meta["relativePath"],
            digest,
            meta["extension"],
            meta["contentType"],
            meta["sourceKind"],
            meta["section"],
            meta["domainName"],
            meta["topicName"],
            meta["difficulty"],
            meta["difficultySource"],
            meta["practiceSetVariant"],
            meta["testNumber"],
            1 if meta["isAnswerFile"] else 0,
            1 if meta["isExplanationFile"] else 0,
            1 if meta["isQuestionSource"] else 0,
            meta["metadataWarningsJson"],
            now_iso(),
        ),
    )
    return source_id


def update_source_metadata(
    db: sqlite3.Connection,
    source_id: str,
    *,
    source_kind: str | None | object = ...,
    section: str | None | object = ...,
    domain_name: str | None | object = ...,
    topic_name: str | None | object = ...,
    difficulty: str | None | object = ...,
    difficulty_source: str | None | object = ...,
    practice_set_variant: str | None | object = ...,
    warnings: list[str] | None = None,
) -> None:
    fields: list[str] = []
    values: list[Any] = []
    if source_kind is not ...:
        fields.append("sourceKind = ?")
        values.append(source_kind)
    if section is not ...:
        fields.append("section = ?")
        values.append(section)
    if domain_name is not ...:
        fields.append("domainName = ?")
        values.append(domain_name)
    if topic_name is not ...:
        fields.append("topicName = ?")
        values.append(topic_name)
    if difficulty is not ...:
        fields.append("difficulty = ?")
        values.append(difficulty)
    if difficulty_source is not ...:
        fields.append("difficultySource = ?")
        values.append(difficulty_source)
    if practice_set_variant is not ...:
        fields.append("practiceSetVariant = ?")
        values.append(practice_set_variant)
    if warnings is not None:
        fields.append("metadataWarningsJson = ?")
        values.append(metadata_warnings_json(warnings))
    if not fields:
        return
    fields.append("updatedAt = ?")
    values.append(now_iso())
    values.append(source_id)
    db.execute(f"UPDATE IngestSourceFile SET {', '.join(fields)} WHERE id = ?", values)


def refine_practice_source_metadata_from_text(
    db: sqlite3.Connection,
    source: sqlite3.Row | dict[str, Any],
    text: str,
) -> dict[str, Any] | None:
    if source["contentType"] != "PRACTICE_SET":
        return None
    internal = internal_practice_metadata_from_text(text)
    if not internal:
        return None
    updates: dict[str, Any] = {}
    warnings = metadata_warnings(source["metadataWarningsJson"])
    for field in ["section", "domainName", "topicName", "difficulty"]:
        value = internal.get(field)
        if not value:
            continue
        current = source[field] if field in source.keys() else None
        if current and normalize_taxonomy_key(str(current)) != normalize_taxonomy_key(value):
            warnings.append(f"Internal metadata {field}={value} differs from path metadata {current}; internal metadata was kept for staging.")
        if current != value:
            updates[field] = value
    if not updates and "Internal Practice Set metadata confirmed from source content." not in warnings:
        warnings.append("Internal Practice Set metadata confirmed from source content.")
    update_source_metadata(
        db,
        source["id"],
        section=updates.get("section", ...),
        domain_name=updates.get("domainName", ...),
        topic_name=updates.get("topicName", ...),
        difficulty=updates.get("difficulty", ...),
        difficulty_source="CONTENT" if updates.get("difficulty") else ...,
        warnings=warnings,
    )
    return {**dict(source), **updates, "metadataWarningsJson": metadata_warnings_json(warnings)}


def sync_candidate_metadata_from_sources(db: sqlite3.Connection, batch_id: str) -> None:
    db.execute(
        """
        UPDATE IngestQuestionCandidate
        SET
          contentType = (SELECT contentType FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          section = (SELECT section FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          domainName = (SELECT domainName FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          topicName = (SELECT topicName FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          difficulty = (SELECT difficulty FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          difficultySource = (SELECT difficultySource FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          practiceSetVariant = (SELECT practiceSetVariant FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
          updatedAt = ?
        WHERE batchId = ?
        """,
        (now_iso(), batch_id),
    )


def normalize_practice_set_metadata(db: sqlite3.Connection, batch_id: str) -> dict[str, int]:
    rows = db.execute(
        """
        SELECT * FROM IngestSourceFile
        WHERE batchId = ? AND contentType = 'PRACTICE_SET'
        ORDER BY relativePath
        """,
        (batch_id,),
    ).fetchall()
    groups: dict[tuple[Any, ...], list[sqlite3.Row]] = {}
    for row in rows:
        groups.setdefault(source_pair_key(row), []).append(row)

    inferred = 0
    ambiguous = 0
    missing = 0
    for group_rows in groups.values():
        question_rows = [row for row in group_rows if not bool(row["isAnswerFile"])]
        answer_rows = [row for row in group_rows if bool(row["isAnswerFile"])]
        if not question_rows or not answer_rows:
            continue

        question_keys = {(row["difficulty"], row["practiceSetVariant"]) for row in question_rows if row["difficulty"]}
        answer_keys = {(row["difficulty"], row["practiceSetVariant"]) for row in answer_rows if row["difficulty"]}

        for row in question_rows + answer_rows:
            if row["difficulty"]:
                continue
            warnings = metadata_warnings(row["metadataWarningsJson"])
            counterpart_keys = answer_keys if not bool(row["isAnswerFile"]) else question_keys
            own_family_keys = question_keys if not bool(row["isAnswerFile"]) else answer_keys
            candidates = sorted(counterpart_keys - own_family_keys)
            if len(candidates) == 1:
                difficulty, variant = candidates[0]
                update_source_metadata(
                    db,
                    row["id"],
                    difficulty=difficulty,
                    difficulty_source="PAIRING",
                    practice_set_variant=variant,
                    warnings=warnings + [f"Difficulty inferred from paired {'answer' if not bool(row['isAnswerFile']) else 'question'} document."],
                )
                log_ingest_incident(
                    db,
                    batch_id=batch_id,
                    source_file_id=row["id"],
                    severity="INFO",
                    code="PRACTICE_SET_DIFFICULTY_INFERRED_FROM_PAIR",
                    message=f"Difficulty was missing for {row['relativePath']}.",
                    decision=f"Using {difficulty}{f' variant {variant}' if variant else ''} from the complementary document.",
                    action="No manual action required unless the inferred difficulty is visually incorrect.",
                    status="RESOLVED",
                )
                inferred += 1
            elif len(candidates) > 1:
                update_source_metadata(
                    db,
                    row["id"],
                    warnings=warnings + ["Ambiguous Practice Set pair; keeping document for content-based inference."],
                )
                log_ingest_incident(
                    db,
                    batch_id=batch_id,
                    source_file_id=row["id"],
                    severity="WARNING",
                    code="PRACTICE_SET_PAIR_AMBIGUOUS",
                    message=f"Multiple complementary Practice Set documents could match {row['relativePath']}.",
                    decision="Pairing was not applied; the source will be considered by content-based inference.",
                    action="Review filename/folder naming or inspect extracted text before promoting candidates.",
                )
                ambiguous += 1
            else:
                update_source_metadata(
                    db,
                    row["id"],
                    warnings=warnings + ["Practice Set difficulty missing; content-based inference required."],
                )
                log_ingest_incident(
                    db,
                    batch_id=batch_id,
                    source_file_id=row["id"],
                    severity="WARNING",
                    code="PRACTICE_SET_DIFFICULTY_MISSING",
                    message=f"No difficulty was found in filename, path, or paired document for {row['relativePath']}.",
                    decision="Source is left in staging with missing difficulty until content inference or admin review resolves it.",
                    action="Run processing/OCR and review the resulting candidates.",
                )
                missing += 1

    sync_candidate_metadata_from_sources(db, batch_id)
    return {"pairingInferred": inferred, "pairingAmbiguous": ambiguous, "pairingMissing": missing}


def normalize_full_practice_test_metadata(db: sqlite3.Connection, batch_id: str) -> dict[str, int]:
    rows = db.execute(
        """
        SELECT * FROM IngestSourceFile
        WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST'
        ORDER BY relativePath
        """,
        (batch_id,),
    ).fetchall()
    updated = 0
    duplicate_sources = 0
    grouped_by_test: dict[int | None, list[sqlite3.Row]] = {}
    hashes: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped_by_test.setdefault(row["testNumber"], []).append(row)
        hashes.setdefault(row["hash"], []).append(row)

    for duplicate_rows in hashes.values():
        if len(duplicate_rows) <= 1:
            continue
        canonical = duplicate_rows[0]
        for row in duplicate_rows[1:]:
            warnings = metadata_warnings(row["metadataWarningsJson"])
            update_source_metadata(
                db,
                row["id"],
                warnings=warnings + [f"Duplicate source content detected; canonical source is {canonical['relativePath']}."],
            )
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="WARNING",
                code="FULL_TEST_DUPLICATE_SOURCE",
                message=f"Full Practice Test source {row['relativePath']} duplicates {canonical['relativePath']}.",
                decision="The duplicate remains in staging but should not be promoted twice.",
                action="Review duplicate sources before promotion; keep the canonical file if both contain the same content.",
            )
            duplicate_sources += 1
            updated += 1

    for row in rows:
        warnings = metadata_warnings(row["metadataWarningsJson"])
        next_warnings = warnings[:]
        if row["difficulty"] is not None or row["difficultySource"] is not None or row["practiceSetVariant"] is not None:
            next_warnings.append("Difficulty ignored for Full Practice Test source; adaptive module difficulty is resolved per module/question later.")
            update_source_metadata(db, row["id"], difficulty=None, difficulty_source=None, practice_set_variant=None, warnings=next_warnings)
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="INFO",
                code="FULL_TEST_FILE_DIFFICULTY_IGNORED",
                message=f"Difficulty detected on Full Practice Test source {row['relativePath']}.",
                decision="File-level difficulty was cleared because Full Practice Tests resolve difficulty per module/question.",
                action="No manual action required unless the source is actually a Practice Set.",
                status="RESOLVED",
            )
            updated += 1
            continue
        if row["sourceKind"] in {"ANSWER_KEY", "ANSWER_EXPLANATION"}:
            if row["section"] is None:
                next_warnings.append("Full Practice Test answer source may cover both RW and MATH; section-level pairing is deferred to answer parsing.")
                log_ingest_incident(
                    db,
                    batch_id=batch_id,
                    source_file_id=row["id"],
                    severity="INFO",
                    code="FULL_TEST_ANSWER_SECTION_DEFERRED",
                    message=f"Answer file {row['relativePath']} may cover multiple sections.",
                    decision="Section assignment is deferred to answer parsing instead of forced from filename.",
                    action="Validate section mapping when promoting Full Practice Test candidates.",
                    status="RESOLVED",
                )
            if next_warnings != warnings:
                update_source_metadata(db, row["id"], warnings=next_warnings)
                updated += 1
        elif row["sourceKind"] == "MOCK_EXAM" and row["testNumber"] is None:
            update_source_metadata(db, row["id"], warnings=warnings + ["Full Practice Test source has no test number in path or filename."])
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="ERROR",
                code="FULL_TEST_NUMBER_MISSING",
                message=f"Full Practice Test source {row['relativePath']} has no test number.",
                decision="Source remains in staging; test-level grouping cannot be trusted.",
                action="Rename or move the file under a TEST N folder before promoting.",
            )
            updated += 1
        elif row["sourceKind"] == "MOCK_EXAM" and row["section"] is None:
            update_source_metadata(db, row["id"], warnings=warnings + ["Full Practice Test question source has no section in path or filename; content inference required."])
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="WARNING",
                code="FULL_TEST_QUESTION_SECTION_MISSING",
                message=f"Question source {row['relativePath']} has no reliable section.",
                decision="Source remains in staging; section may be inferred from extracted text/OCR later.",
                action="Review extracted text before promotion.",
            )
            updated += 1

    for test_number, test_rows in grouped_by_test.items():
        if test_number is None:
            continue
        question_sections = {row["section"] for row in test_rows if row["sourceKind"] == "MOCK_EXAM" and row["section"] in {"MATH", "RW"}}
        explanation_sections = {row["section"] for row in test_rows if row["sourceKind"] == "ANSWER_EXPLANATION" and row["section"] in {"MATH", "RW"}}
        answer_keys = [row for row in test_rows if row["sourceKind"] == "ANSWER_KEY"]
        if not answer_keys:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                severity="WARNING",
                code="FULL_TEST_ANSWER_KEY_MISSING",
                message=f"TEST {test_number} has no global answer key source.",
                decision="Answer enrichment can still use explanation files, but score-key validation is incomplete.",
                action="Confirm whether this test intentionally has explanations only.",
            )
        for section in {"MATH", "RW"} - question_sections:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                severity="WARNING",
                code="FULL_TEST_QUESTION_SECTION_MISSING_IN_TEST",
                message=f"TEST {test_number} has no detected {'Math' if section == 'MATH' else 'Reading and Writing'} question source.",
                decision="The test family remains partial in staging.",
                action="Check for a DOCX/PDF question source with unusual naming.",
            )
        for section in {"MATH", "RW"} - explanation_sections:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                severity="INFO",
                code="FULL_TEST_EXPLANATION_SECTION_NOT_DETECTED",
                message=f"TEST {test_number} has no section-specific {'Math' if section == 'MATH' else 'Reading and Writing'} explanation source detected by path.",
                decision="A global answer key or content-based inference may still resolve answers.",
                action="Validate explanation pairing before promotion if candidates lack explanations.",
                status="RESOLVED",
            )
    sync_candidate_metadata_from_sources(db, batch_id)
    return {"fullPracticeWarningsUpdated": updated, "fullPracticeDuplicates": duplicate_sources}


def normalize_batch_metadata(db: sqlite3.Connection, batch_id: str) -> dict[str, int]:
    practice = normalize_practice_set_metadata(db, batch_id)
    full_test = normalize_full_practice_test_metadata(db, batch_id)
    return {**practice, **full_test}


def infer_difficulty_from_text(text: str) -> tuple[str | None, str | None, float, str]:
    sample = text[:20000]
    explicit = re.search(r"(?:Question\s+Difficulty|Difficulty)\s*[:：]?\s*(Easy|Medium|Med|Hard)\b", sample, re.IGNORECASE)
    if explicit:
        difficulty, variant = detect_difficulty_and_variant(explicit.group(1))
        return difficulty, variant, 0.85, "CONTENT_EXPLICIT_LABEL"

    counts = {
        "EASY": len(re.findall(r"\beasy\b", sample, re.IGNORECASE)),
        "MEDIUM": len(re.findall(r"\bmed(?:ium)?\b", sample, re.IGNORECASE)),
        "HARD": len(re.findall(r"\bhard\b", sample, re.IGNORECASE)),
    }
    best = max(counts, key=counts.get)
    if counts[best] > 0 and list(counts.values()).count(counts[best]) == 1:
        return best, None, 0.55, "CONTENT_KEYWORD_COUNTS"
    return None, None, 0.0, "CONTENT_NO_SIGNAL"


def mistral_infer_source_metadata(text: str, relative_path: str) -> dict[str, Any] | None:
    config = IngestConfig.from_env()
    if not config.mistral_api_key or len(text.strip()) < 200:
        return None
    client = Mistral(api_key=config.mistral_api_key)
    prompt = (
        "Infer SAT content metadata from the path and extracted text. "
        "Return only JSON with keys difficulty, practiceSetVariant, confidence, rationale. "
        "difficulty must be EASY, MEDIUM, HARD, or null. "
        "Do not invent a difficulty if the document does not indicate one.\n\n"
        f"Path: {relative_path}\n\nExtracted text sample:\n{text[:6000]}"
    )
    try:
        response = client.chat.complete(
            model=config.structuring_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=300,
            response_format={"type": "json_object"},
            timeout_ms=60000,
        )
        content = response.choices[0].message.content
        if isinstance(content, list):
            content = "".join(str(item) for item in content)
        parsed = json.loads(str(content))
        difficulty = parsed.get("difficulty")
        if isinstance(difficulty, str):
            difficulty = difficulty.upper()
        if difficulty not in {"EASY", "MEDIUM", "HARD"}:
            parsed["difficulty"] = None
        else:
            parsed["difficulty"] = difficulty
        return parsed
    except Exception as exc:
        return {"difficulty": None, "confidence": 0, "rationale": f"Mistral metadata inference failed: {exc}"}


def infer_missing_source_metadata_from_pages(db: sqlite3.Connection, batch_id: str, source_id: str | None = None) -> dict[str, int]:
    params: list[Any] = [batch_id]
    source_filter = ""
    if source_id:
        source_filter = "AND id = ?"
        params.append(source_id)
    rows = db.execute(
        f"""
        SELECT * FROM IngestSourceFile
        WHERE batchId = ? {source_filter}
          AND contentType = 'PRACTICE_SET'
          AND difficulty IS NULL
        ORDER BY relativePath
        """,
        params,
    ).fetchall()
    inferred = 0
    unresolved = 0
    for row in rows:
        text_rows = db.execute(
            """
            SELECT extractedText FROM IngestPageArtifact
            WHERE batchId = ? AND sourceFileId = ? AND status = 'COMPLETED' AND extractedText IS NOT NULL
            ORDER BY pageNumber
            LIMIT 8
            """,
            (batch_id, row["id"]),
        ).fetchall()
        text = "\n\n".join(text_row["extractedText"] or "" for text_row in text_rows)
        warnings = metadata_warnings(row["metadataWarningsJson"])
        difficulty, variant, confidence, source = infer_difficulty_from_text(text)
        rationale = source
        if not difficulty:
            ai_result = mistral_infer_source_metadata(text, row["relativePath"])
            if ai_result and ai_result.get("difficulty") and float(ai_result.get("confidence") or 0) >= 0.65:
                difficulty = ai_result["difficulty"]
                variant = ai_result.get("practiceSetVariant") or None
                confidence = float(ai_result.get("confidence") or 0.65)
                source = "MISTRAL_METADATA"
                rationale = str(ai_result.get("rationale") or "Mistral metadata inference.")
            elif ai_result and ai_result.get("rationale"):
                rationale = str(ai_result["rationale"])

        if difficulty:
            update_source_metadata(
                db,
                row["id"],
                difficulty=difficulty,
                difficulty_source=source,
                practice_set_variant=variant,
                warnings=warnings + [f"Difficulty inferred from extracted content with confidence {confidence:.2f}."],
            )
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="INFO",
                code="PRACTICE_SET_DIFFICULTY_INFERRED_FROM_CONTENT",
                message=f"Difficulty was inferred from extracted content for {row['relativePath']}.",
                decision=f"Using {difficulty}{f' variant {variant}' if variant else ''} via {source}.",
                action="Review visually before promotion if confidence is low or source text looked inconsistent.",
                status="RESOLVED",
            )
            inferred += 1
        else:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="ERROR",
                code="PRACTICE_SET_DIFFICULTY_UNRESOLVED",
                message=f"Difficulty could not be resolved for {row['relativePath']}.",
                decision=f"Left unresolved in staging. Last inference result: {rationale}",
                action="Admin review required before promoting this source.",
            )
            unresolved += 1
    sync_candidate_metadata_from_sources(db, batch_id)
    return {"contentInferred": inferred, "contentUnresolved": unresolved}


def infer_full_test_metadata_from_pages(db: sqlite3.Connection, batch_id: str, source_id: str | None = None) -> dict[str, int]:
    params: list[Any] = [batch_id]
    source_filter = ""
    if source_id:
        source_filter = "AND id = ?"
        params.append(source_id)
    rows = db.execute(
        f"""
        SELECT * FROM IngestSourceFile
        WHERE batchId = ? {source_filter}
          AND contentType = 'FULL_PRACTICE_TEST'
          AND section IS NULL
        ORDER BY relativePath
        """,
        params,
    ).fetchall()
    inferred = 0
    unresolved = 0
    for row in rows:
        text_rows = db.execute(
            """
            SELECT extractedText FROM IngestPageArtifact
            WHERE batchId = ? AND sourceFileId = ? AND status = 'COMPLETED' AND extractedText IS NOT NULL
            ORDER BY pageNumber
            LIMIT 6
            """,
            (batch_id, row["id"]),
        ).fetchall()
        text = "\n\n".join(text_row["extractedText"] or "" for text_row in text_rows)
        section = infer_full_test_section_from_text(text)
        warnings = metadata_warnings(row["metadataWarningsJson"])
        if section:
            section_label = "MATH" if section == "MATH" else "READING AND WRITING"
            test_label = f"TEST {row['testNumber']}" if row["testNumber"] else "FULL PRACTICE TEST"
            update_source_metadata(
                db,
                row["id"],
                section=section,
                topic_name=f"{test_label} {section_label}",
                warnings=warnings + [f"Full Practice Test section inferred from extracted content: {section_label}."],
            )
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="INFO",
                code="FULL_TEST_SECTION_INFERRED_FROM_CONTENT",
                message=f"Section was inferred from extracted content for {row['relativePath']}.",
                decision=f"Using {section_label} for grouping and candidate metadata.",
                action="Review before promotion if the source mixes Math and Reading/Writing.",
                status="RESOLVED",
            )
            inferred += 1
        else:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["id"],
                severity="WARNING",
                code="FULL_TEST_SECTION_UNRESOLVED",
                message=f"Section could not be resolved for {row['relativePath']}.",
                decision="Source remains in staging with null section.",
                action="Admin review required before promoting this source.",
            )
            unresolved += 1
    sync_candidate_metadata_from_sources(db, batch_id)
    return {"fullTestContentInferred": inferred, "fullTestContentUnresolved": unresolved}


def extract_docx_images(doc: Any) -> list[dict[str, Any]]:
    """Embedded images (word/media/*) in document order, inline and anchored.

    Some mock-exam modules are exported as DOCX where every question is a full-page
    screenshot: the DOCX text layer is almost empty and the real content lives in
    these images. We pull them (base64 + mime) so the pipeline can OCR them like
    PDF pages.
    """
    from docx.oxml.ns import qn

    images: list[dict[str, Any]] = []
    rels = doc.part.rels
    for blip in doc.element.body.iter(qn("a:blip")):
        rid = blip.get(qn("r:embed")) or blip.get(qn("r:link"))
        if not rid:
            continue
        rel = rels.get(rid)
        if rel is None or "image" not in (getattr(rel, "reltype", "") or ""):
            continue
        try:
            blob = rel.target_part.blob
        except Exception:
            continue
        if not blob:
            continue
        content_type = getattr(rel.target_part, "content_type", "") or "image/png"
        extension = (content_type.split("/")[-1].split("+")[0] or "png").lower()
        try:
            name = rel.target_ref.split("/")[-1]
        except Exception:
            name = f"image{len(images) + 1}.{extension}"
        images.append(
            {
                "base64": base64.b64encode(blob).decode("utf-8"),
                "mime": content_type,
                "ext": extension,
                "name": name,
            }
        )
    return images


def extract_docx(path: Path) -> list[dict[str, Any]]:
    doc = Document(path)
    chunks: list[str] = []
    chunks.extend(p.text.strip() for p in doc.paragraphs if p.text.strip())
    tables: list[list[list[str]]] = []
    for table in doc.tables:
        table_rows: list[list[str]] = []
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells]
            table_rows.append(row_cells)
            cells = [cell.replace("\n", " / ") for cell in row_cells if cell]
            if cells:
                chunks.append(" | ".join(cells))
        tables.append(table_rows)
    text = "\n".join(chunks)
    images = extract_docx_images(doc)

    # Image-only DOCX (question modules exported as page screenshots): emit one page
    # per embedded image and route each through the same OCR path used for PDF pages.
    meaningful_text = len(re.sub(r"\s+", "", text))
    if len(images) >= 3 and meaningful_text < max(200, 40 * len(images)):
        pages: list[dict[str, Any]] = []
        for index, image in enumerate(images, start=1):
            pages.append(
                {
                    "page": index,
                    "text": "",
                    "density": 0,
                    "requiresOcr": True,
                    "ocrImage": {"base64": image["base64"], "mimeType": image["mime"], "ext": image["ext"]},
                    "layout": {"imageCount": 1, "docxImageOnly": True, "docxImages": [image]},
                }
            )
        return pages

    layout = {
        "imageCount": len(images),
        "docxTables": tables,
        "docxExplanationBlocks": docx_explanation_blocks(doc, tables),
    }
    if images:
        layout["docxImages"] = images
    return [{"page": 1, "text": text, "density": len(text), "layout": layout}]


def docx_explanation_blocks(doc: Any, tables: list[list[list[str]]]) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    current_module: str | None = None
    current_section: str | None = None
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        if module := last_module_heading(text):
            current_module = module
            current_section = detect_full_test_section(text) or current_section
            continue
        question_match = re.match(r"^\s*Question\s+([0-9]{1,3})\s*[:.)-]?\s*(.*)$", text, re.IGNORECASE)
        if question_match:
            questions.append(
                {
                    "questionNumber": int(question_match.group(1)),
                    "questionText": question_match.group(2).strip(),
                    "moduleLabel": current_module,
                    "section": current_section,
                }
            )
    blocks: list[dict[str, Any]] = []
    question_index = 0
    expected_by_module: dict[str, int] = {}
    for table in tables:
        table_text = "\n".join(" | ".join(cell for cell in row if cell).strip() for row in table).strip()
        if not table_text:
            continue
        if question_index >= len(questions):
            break
        question = questions[question_index]
        module_key = question.get("moduleLabel") or ""
        expected_number = expected_by_module.get(module_key, 1)
        if question["questionNumber"] > expected_number:
            question = {
                "questionNumber": expected_number,
                "questionText": "",
                "moduleLabel": question.get("moduleLabel"),
                "section": question.get("section"),
                "questionNumberInferred": True,
            }
        else:
            question_index += 1
        expected_by_module[module_key] = int(question["questionNumber"]) + 1
        blocks.append({**question, "explanationText": table_text})
    return blocks


def pdfplumber_page_render_info(page: Any) -> dict[str, Any]:
    image = page.to_image(resolution=72).original.convert("L")
    stats = ImageStat.Stat(image)
    mean = float(stats.mean[0])
    stddev = float(stats.stddev[0])
    return {
        "width": image.width,
        "height": image.height,
        "mean": round(mean, 4),
        "stddev": round(stddev, 4),
        "isBlank": mean >= 254.5 and stddev <= 1.0,
    }


def is_pdfplumber_page_blank(page: Any) -> bool:
    try:
        return bool(pdfplumber_page_render_info(page)["isBlank"])
    except Exception:
        return False


def pdf_page_render_info(path: Path, page_number: int) -> dict[str, Any]:
    with pdfplumber.open(path) as pdf:
        return pdfplumber_page_render_info(pdf.pages[page_number - 1])


def is_pdf_page_blank(path: Path, page_number: int) -> bool:
    return bool(pdf_page_render_info(path, page_number)["isBlank"])


def extract_pdf_text(path: Path, force_ocr: bool = False) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            image_regions = [
                {
                    "x0": image.get("x0"),
                    "top": image.get("top"),
                    "x1": image.get("x1"),
                    "bottom": image.get("bottom"),
                    "width": image.get("width"),
                    "height": image.get("height"),
                    "name": image.get("name"),
                }
                for image in page.images
            ]
            page_layout = {
                "width": page.width,
                "height": page.height,
                "rotation": page.rotation,
                "imageCount": len(page.images),
                "images": image_regions,
            }
            render_info = pdfplumber_page_render_info(page)
            is_blank = bool(render_info["isBlank"])
            page_layout["isBlank"] = is_blank
            page_layout["renderInfo"] = render_info
            if force_ocr:
                pages.append(
                    {
                        "page": index,
                        "text": "",
                        "density": 0,
                        "imageCount": len(page.images),
                        "layout": page_layout,
                        "requiresOcr": not is_blank,
                        "blankPage": is_blank,
                        "warning": "Blank page detected." if is_blank else None,
                    }
                )
                continue
            try:
                if threading.current_thread() is threading.main_thread():
                    with Timeout(int(os.getenv("INGEST_PAGE_TIMEOUT_SECONDS", "12"))):
                        text = page.extract_text() or ""
                else:
                    text = page.extract_text() or ""
                image_count = len(page.images)
                density = len(text.strip())
                pages.append(
                    {
                        "page": index,
                        "text": text,
                        "density": density,
                        "imageCount": image_count,
                        "layout": page_layout,
                        "requiresOcr": density < TEXT_DENSITY_THRESHOLD and not is_blank,
                        "blankPage": is_blank,
                        "warning": "Blank page detected." if is_blank else None,
                    }
                )
            except Exception as exc:
                if "signal only works in main thread" in str(exc):
                    try:
                        text = page.extract_text() or ""
                        image_count = len(page.images)
                        density = len(text.strip())
                        pages.append(
                            {
                                "page": index,
                                "text": text,
                                "density": density,
                                "imageCount": image_count,
                                "layout": page_layout,
                                "requiresOcr": density < TEXT_DENSITY_THRESHOLD and not is_blank,
                                "blankPage": is_blank,
                                "warning": "Blank page detected." if is_blank else None,
                            }
                        )
                        continue
                    except Exception as fallback_exc:
                        exc = fallback_exc
                pages.append(
                    {
                        "page": index,
                        "text": "",
                        "density": 0,
                        "imageCount": len(page.images),
                        "layout": page_layout,
                        "requiresOcr": True,
                        "warning": str(exc),
                    }
                )
    return pages


def cached_ocr(db: sqlite3.Connection, content_hash: str) -> str | None:
    row = db.execute(
        "SELECT text FROM IngestOcrCache WHERE contentHash = ? AND model = ?",
        (content_hash, OCR_MODEL),
    ).fetchone()
    return row["text"] if row else None


def run_mistral_ocr(path: Path, page_number: int) -> tuple[str | None, dict[str, Any]]:
    return MistralOcrClient(IngestConfig.from_env()).process_page(path, page_number)


def run_mistral_ocr_image(image_base64: str, mime_type: str | None = None) -> tuple[str | None, dict[str, Any]]:
    return MistralOcrClient(IngestConfig.from_env()).process_image_base64(image_base64, mime_type)


QUESTION_ID_RE = re.compile(r"(?:Question\s+ID:?|ID:)\s*([A-Fa-f0-9]{8})", re.IGNORECASE)
QUESTION_RE = re.compile(r"(?:^|\n)\s*(?:Q(?:uestion)?\s*)?([0-9]{1,3})[\).:\s-]+", re.IGNORECASE)
ANSWER_RE = re.compile(r"Correct Answer\s*[:：]\s*([A-D]|[-+]?\d+(?:/\d+)?(?:\.\d+)?)", re.IGNORECASE)
OPTION_MARKER = r"(?:[×✕✖※*•-]\s*)?"
OPTION_RE = re.compile(
    rf"(?:^|\n)\s*{OPTION_MARKER}([A-D])(?:[\).])?\s+(.+?)(?=(?:\n\s*{OPTION_MARKER}[A-D](?:[\).])?\s+)|(?:\n\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER|$))|$)",
    re.IGNORECASE | re.DOTALL,
)
IMAGE_BACKED_CHOICE_RE = re.compile(
    r"\b(which\s+of\s+the\s+following|which\s+(?:expression|equation|statement|function)|which\s+.*?correctly|best\s+(?:describes|defines|represents|interpretation)|what\s+must\s+be\s+true)\b",
    re.IGNORECASE | re.DOTALL,
)
ANSWER_PAIR_RE = re.compile(r"(?:^|[\n/|])\s*([0-9]{1,3})[\).]?\s+([A-D]|[-+]?\d+(?:/\d+)?(?:\.\d+)?)\b", re.IGNORECASE)
QUESTION_SPLIT_RE = re.compile(r"(?m)^\s*(?:Q(?:uestion)?\s*)?([0-9]{1,3})[\).:\s-]+")
MODULE_HEADING_RE = re.compile(
    r"(?im)^\s*(?:#+\s*)?(?:(?:math|reading(?:\s+and\s+writing)?|r\s*&\s*w)\s+)?module\s*(1|2A|2B|2)\b(?:\s*(?:\((easy|easier|hard|harder)\)|[-–—:]?\s*(easy|easier|hard|harder)))?"
)


def clean_answer_value(value: str) -> str | None:
    if re.search(r"\bextra\b", value, re.IGNORECASE):
        return None
    value = re.sub(r"\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}", r"\1/\2", value)
    cleaned = re.sub(r"[*_`$]", "", value)
    cleaned = re.sub(r"^\s*(?:✓|✔|✗|✘|×|x)\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\(?:frac|sqrt)\s*", "", cleaned)
    cleaned = cleaned.replace("{", "").replace("}", "")
    cleaned = re.sub(r"\s+", " ", cleaned.replace("|", " ")).strip(" .;:#")
    letter = re.match(r"^([A-Da-d])(?:\b|[^A-Za-z0-9])", cleaned)
    if letter:
        return letter.group(1).upper()
    numeric_list = re.match(
        r"^([-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?)(?:\s*,\s*[-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?))+)(?:\b|[^A-Za-z0-9/])",
        cleaned,
    )
    if numeric_list:
        return numeric_list.group(1).replace("−", "-")
    numeric = re.match(r"^([-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?))(?:\b|[^A-Za-z0-9/])", cleaned)
    if numeric:
        return numeric.group(1).replace("−", "-")
    if len(cleaned) <= 40 and not re.search(r"[.!?;]", cleaned) and len(cleaned.split()) <= 4:
        return cleaned or None
    return None


def extract_correct_answer(text: str) -> str | None:
    checked = re.search(r"(?:^|[\n|])\s*(?:✓|✔)\s*([A-D])\b", text, re.IGNORECASE)
    if checked:
        return checked.group(1).upper()
    table_solution = re.search(r"(?im)^\s*Answer\s*\|\s*(?:Solution|Choice|Why Correct).*?\n\s*([^|\n]+)", text, re.DOTALL)
    if table_solution:
        value = clean_answer_value(table_solution.group(1))
        if value:
            return value.upper() if re.fullmatch(r"[A-Da-d]", value) else value
    direct = re.search(
        r"Correct Answer\s*[:：]\s*(?:\n|\s|\|)*(.*?)(?=(?:\n|\s|\|)+(?:#*\s*Rationale|Question Difficulty|Choice [A-D]\b)|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if direct:
        value = clean_answer_value(direct.group(1))
        if value:
            return value.upper() if re.fullmatch(r"[A-Da-d]", value) else value
    sentence = re.search(r"The correct answer is\s+(.+?)(?:\.|\n)", text, re.IGNORECASE | re.DOTALL)
    if sentence:
        return clean_answer_value(sentence.group(1))
    choice_sentence = re.search(r"\bChoice\s+([A-D])\s+is\s+(?:the\s+)?(?:best\s+answer|correct)\b", text, re.IGNORECASE)
    if choice_sentence:
        return choice_sentence.group(1).upper()
    legacy = ANSWER_RE.search(text)
    if legacy:
        value = clean_answer_value(legacy.group(1))
        return value.upper() if value and re.fullmatch(r"[A-Da-d]", value) else value
    return None


def parse_docx_answer_table_options(text: str) -> list[dict[str, str]]:
    options_by_label: dict[str, str] = {}
    for line in text.splitlines():
        if "|" not in line:
            continue
        cells = [cell.strip() for cell in line.split("|")]
        if len(cells) < 2:
            continue
        if re.search(r"\bAnswer\b", cells[0], re.IGNORECASE):
            continue
        label_match = re.search(r"(?:✓|✔|✗|✘|×)?\s*([A-D])\b", cells[0], re.IGNORECASE)
        if not label_match:
            continue
        choice = cells[1].strip()
        if not choice:
            continue
        options_by_label[label_match.group(1).upper()] = choice
    return [{"label": label, "text": options_by_label[label]} for label in ["A", "B", "C", "D"] if label in options_by_label]


def normalize_docx_answer_explanation(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return text.strip()
    if len(lines) >= 2 and re.search(r"\bAnswer\b", lines[0], re.IGNORECASE) and "|" in lines[0]:
        rendered: list[str] = []
        for line in lines[1:]:
            cells = [cell.strip() for cell in line.split("|")]
            if len(cells) >= 3:
                answer_cell, choice_cell, why_cell = cells[0], cells[1], " ".join(cells[2:]).strip()
                rendered.append(f"{answer_cell}: {choice_cell}. {why_cell}".strip())
            elif len(cells) >= 2:
                rendered.append(f"{cells[0]}: {cells[1]}".strip())
        if rendered:
            return "\n".join(rendered)
    return text.strip()


def clean_ingested_question_text(value: str) -> str:
    value = re.sub(r"(?im)^\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER)\s*$", "", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


# Artefactos que la extracción de PDF suele dejar dentro del contenido de la pregunta:
# la línea del Question ID y la cabecera "Assessment Test / SAT ... | Domain | Skill | Difficulty".
QUESTION_ID_LINE_RE = re.compile(r"(?im)^\s*(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\s*$")
QUESTION_ID_INLINE_RE = re.compile(r"(?i)\b(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\b")
ASSESSMENT_HEADER_RE = re.compile(r"(?im)^\s*(?:Assessment Test\s+Domain\s+Skill\s+Difficulty|SAT (?:Math|Reading and Writing)\b.*)$")


def strip_question_id(value: str | None) -> str:
    """Remove leaked 'Question ID: xxxx' markers from a stem/text."""
    if not value:
        return ""
    value = QUESTION_ID_LINE_RE.sub("", value)
    value = QUESTION_ID_INLINE_RE.sub("", value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def extract_rationale(text: str | None) -> str | None:
    """The ANS page dump = header + stem + options + 'Correct Answer' + Rationale.
    Store only the Rationale (the real explanation) when present, minus header/ID leaks."""
    if not text:
        return None
    marker = re.search(r"\bRationale\b", text, re.IGNORECASE)
    body = text[marker.end():] if marker else text
    body = ASSESSMENT_HEADER_RE.sub("", body)
    body = strip_question_id(body)
    return body or None


def extract_options_and_stem(text: str) -> tuple[list[dict[str, str]], str]:
    matches = list(OPTION_RE.finditer(text))
    if not matches:
        return [], clean_ingested_question_text(text)

    options: list[dict[str, str]] = []
    seen_labels: set[str] = set()
    for match in matches:
        label = match.group(1).upper()
        option_text = clean_ingested_question_text(" ".join(match.group(2).split()))
        option_text = re.sub(r"(?i)\b(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER)\b", "", option_text).strip()
        if label in seen_labels or not option_text:
            continue
        options.append({"label": label, "text": option_text[:2000]})
        seen_labels.add(label)

    if len(options) < 2:
        return [], clean_ingested_question_text(text)

    stem = clean_ingested_question_text(text[: matches[0].start()] + text[matches[-1].end() :])
    return options, stem


# ── Canonical A–D option-block parser ────────────────────────────────────────
# Shared robust pipeline used by the crop-OCR path and the option-image OCR. It
# tolerates every option-marker variant seen across the ingested sources:
#   • leading strike / checkbox / bullet glyphs:  ✕ A)   ☐ B.   • C)
#   • markdown emphasis around the letter:        **A)**   __B__   *C*
#   • optional punctuation after the letter:      A) / A. / A: / A、
#     (or none, when a glyph or emphasis already marks the letter)
#   • multi-line option text (continuation lines are appended to the option)
#   • markdown table rows:                        | A | administer |
#   • single-line inline runs:                    A) x  B) y  C) z  D) w
# A contiguous run starting at A is required (A→B→C→D), which guards against
# matching stray capitals in prose. All parsers return options in A→D order.
_OPT_STRIKE = "×✕✖✗☒☐✓✔"
_OPT_BULLET = "•▪◦※–\\-"
_OPT_EMPH = r"(?:\*\*|__|\*|_)"
_OPT_PUNCT_RE = re.compile(
    rf"^\s*(?:[{_OPT_STRIKE}{_OPT_BULLET}]\s*)?{_OPT_EMPH}?\s*([A-D])\s*{_OPT_EMPH}?\s*[\).:：．、]\s*(.*)$",
    re.IGNORECASE,
)
_OPT_MARKED_RE = re.compile(
    rf"^\s*(?:[{_OPT_STRIKE}{_OPT_BULLET}]\s*{_OPT_EMPH}?|{_OPT_EMPH})\s*([A-D])\s*{_OPT_EMPH}?\s+(.*)$",
    re.IGNORECASE,
)
_OPT_TABLE_RE = re.compile(
    rf"^\s*\|?\s*(?:[{_OPT_STRIKE}{_OPT_BULLET}]\s*)?{_OPT_EMPH}?\s*([A-D])\s*{_OPT_EMPH}?\s*\|\s*(.*?)\s*\|?\s*$",
    re.IGNORECASE,
)
_OPT_INLINE_RE = re.compile(
    rf"(?:^|\s|\|)(?:[{_OPT_STRIKE}{_OPT_BULLET}]\s*)?{_OPT_EMPH}?\s*([A-D])\s*{_OPT_EMPH}?\s*[\).:]\s+(.+?)"
    rf"(?=(?:\s(?:[{_OPT_STRIKE}{_OPT_BULLET}]\s*)?{_OPT_EMPH}?\s*[A-D]\s*{_OPT_EMPH}?\s*[\).:]\s+)|$)",
    re.IGNORECASE | re.DOTALL,
)
_OPT_NAV_RE = re.compile(r"(?i)^\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER)\s*$")
_OPT_STOP_RE = re.compile(r"(?i)^\s*#*\s*(?:Correct\s+Answer|Rationale|Question\s+Difficulty)\b")


def _strip_emphasis(value: str) -> str:
    """Drop markdown emphasis markers while preserving math asterisks (e.g. 3*x)."""
    value = value.replace("**", "").replace("__", "")
    value = re.sub(r"(?<![\w*])\*(?!\s)", "", value)  # opening *
    value = re.sub(r"(?<!\s)\*(?![\w*])", "", value)  # closing *
    return value.strip()


def _option_start(line: str) -> tuple[str, str] | None:
    for pattern in (_OPT_TABLE_RE, _OPT_PUNCT_RE, _OPT_MARKED_RE):
        match = pattern.match(line)
        if match:
            return match.group(1).upper(), (match.group(2) or "").strip()
    return None


def parse_option_block(text: str) -> list[dict[str, str]]:
    """Line-based A–D parser with multi-line continuation and a contiguous-run guard."""
    if not text:
        return []
    lines = [line.rstrip() for line in text.replace("\r", "").split("\n")]
    start = next((i for i, line in enumerate(lines) if (st := _option_start(line)) and st[0] == "A"), None)
    if start is None:
        return []
    order = ["A", "B", "C", "D"]
    options: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    expected = 0
    for line in lines[start:]:
        if _OPT_STOP_RE.match(line):
            break
        started = _option_start(line)
        if started:
            label, rest = started
            if expected < len(order) and label == order[expected]:
                current = {"label": label, "text": rest}
                options.append(current)
                expected += 1
                continue
            if label in {opt["label"] for opt in options}:  # repeated label → run ended
                break
        if current is not None and line.strip() and not _OPT_NAV_RE.match(line):
            current["text"] = f"{current['text']} {line.strip()}".strip()
    cleaned = [
        {"label": opt["label"], "text": strip_question_id(clean_ingested_question_text(_strip_emphasis(" ".join(opt["text"].split()))))[:2000]}
        for opt in options
    ]
    return cleaned if len(cleaned) >= 2 else []


def _parse_inline_options(text: str) -> list[dict[str, str]]:
    """Options crammed onto one line: 'A) x B) y C) z D) w'."""
    seen: dict[str, str] = {}
    for match in _OPT_INLINE_RE.finditer(text or ""):
        label = match.group(1).upper()
        if label not in seen:
            seen[label] = strip_question_id(clean_ingested_question_text(_strip_emphasis(" ".join(match.group(2).split()))))[:2000]
    ordered = [{"label": label, "text": seen[label]} for label in ["A", "B", "C", "D"] if label in seen]
    return ordered if len(ordered) >= 2 else []


def extract_options_from_image_ocr(text: str) -> list[dict[str, str]]:
    """Best-effort A–D extraction from OCR'd text (crop OCR + option-image OCR).

    Runs the robust block parser plus the table/regex/inline fallbacks and returns
    the most complete set (a full A–D run wins). May return 2–3 options so the
    reviewer can complete the rest; callers that require exactly 4 still check len."""
    text = text or ""
    best: list[dict[str, str]] = []
    for parsed in (
        parse_option_block(text),
        parse_docx_answer_table_options(text),
        extract_options_and_stem(text)[0],
        _parse_inline_options(text),
    ):
        if len(parsed) > len(best):
            best = parsed
        if len(best) == 4:
            break
    return best


def normalize_module_label(value: str | None, descriptor: str | None = None) -> str | None:
    if not value:
        return None
    module = value.upper()
    if module == "2" and descriptor:
        descriptor = descriptor.lower()
        if "easy" in descriptor or "easier" in descriptor:
            return "2A"
        if "hard" in descriptor or "harder" in descriptor:
            return "2B"
    return module


def last_module_heading(text: str) -> str | None:
    module = None
    for match in MODULE_HEADING_RE.finditer(text):
        module = normalize_module_label(match.group(1), match.group(2) or match.group(3))
    return module


def split_question_blocks(text: str, default_module_label: str | None = None) -> list[tuple[int | None, str, str | None]]:
    cleaned = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not cleaned:
        return []
    id_matches = list(QUESTION_ID_RE.finditer(cleaned))
    if id_matches:
        return [
            (
                None,
                cleaned[match.start() : id_matches[index + 1].start() if index + 1 < len(id_matches) else len(cleaned)].strip(),
                last_module_heading(cleaned[: match.start()]) or default_module_label,
            )
            for index, match in enumerate(id_matches)
        ]
    matches = list(QUESTION_SPLIT_RE.finditer(cleaned))
    if len(matches) <= 1:
        q_match = QUESTION_RE.search(cleaned)
        module_context = cleaned[: q_match.start()] if q_match else cleaned
        return [(int(q_match.group(1)) if q_match else None, cleaned, last_module_heading(module_context) or default_module_label)]
    blocks: list[tuple[int | None, str, str | None]] = []
    prefix = cleaned[: matches[0].start()].strip()
    current_module = last_module_heading(prefix) or default_module_label
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(cleaned)
        block = cleaned[match.start() : end].strip()
        trailing_heading = None
        heading_matches = list(MODULE_HEADING_RE.finditer(block))
        if heading_matches:
            question_marker = QUESTION_RE.search(block)
            for heading in heading_matches:
                if question_marker and heading.start() > question_marker.end():
                    trailing_heading = heading
            if trailing_heading:
                next_module = normalize_module_label(trailing_heading.group(1), trailing_heading.group(2))
                block = block[: trailing_heading.start()].strip()
            else:
                current_module = normalize_module_label(heading_matches[-1].group(1), heading_matches[-1].group(2)) or current_module
        if prefix and index == 0 and not block.startswith(prefix):
            block = f"{prefix}\n\n{block}"
        blocks.append((int(match.group(1)), block, current_module))
        if trailing_heading:
            current_module = normalize_module_label(trailing_heading.group(1), trailing_heading.group(2)) or current_module
    return blocks


def make_candidate_from_text(
    text: str,
    meta: sqlite3.Row,
    page_id: str | None,
    question_number_override: int | None = None,
    module_label_override: str | None = None,
) -> dict[str, Any] | None:
    cleaned = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not cleaned:
        return None
    q_match = QUESTION_RE.search(cleaned)
    external_match = QUESTION_ID_RE.search(cleaned)
    if meta["contentType"] == "FULL_PRACTICE_TEST" and not q_match and not external_match:
        return None
    correct_answer = extract_correct_answer(cleaned)
    image_refs = markdown_image_refs(cleaned)
    # Los bloques de práctica (con "Question ID") tienen una estructura de
    # marcadores regular (Question → enunciado → Answer → A-D → Correct Answer →
    # Rationale). El parser genérico dejaba la cabecera dentro del enunciado y
    # confundía el artículo "A student…" con la alternativa A, así que para ellos
    # usamos el parser por marcadores.
    practice = parse_practice_block(cleaned) if external_match and not bool(meta["isAnswerFile"]) else None
    practice_stimulus = None
    if practice is not None:
        options = practice["options"]
        stem_text = practice["stem"]
        practice_stimulus = practice["stimulus"]
        image_backed_options = practice["image_backed"] or bool(image_refs and not options and IMAGE_BACKED_CHOICE_RE.search(cleaned))
    else:
        options, stem_text = extract_options_and_stem(cleaned)
        image_backed_options = bool(image_refs and not options and IMAGE_BACKED_CHOICE_RE.search(cleaned))
    question_number = question_number_override if question_number_override is not None else int(q_match.group(1)) if q_match else None
    is_answer_file = bool(meta["isAnswerFile"])
    module_context = cleaned[: q_match.start()] if q_match else cleaned[:300]
    modules = detect_full_test_modules(module_context) if meta["contentType"] == "FULL_PRACTICE_TEST" else []
    module_label = module_label_override or (modules[-1] if modules else None)
    stem = strip_question_id(stem_text)[:2500] if not is_answer_file else None
    confidence = 0.55
    warnings: list[str] = []
    if not stem:
        warnings.append("Answer/explanation source; question stem is not confirmed.")
        confidence -= 0.2
    if not correct_answer:
        warnings.append("Correct answer not detected.")
        confidence -= 0.15
    if len(options) not in {0, 4}:
        warnings.append("Option count is not A-D.")
        confidence -= 0.1
    if image_backed_options:
        warnings.append("Choices appear to be image-backed; manual transcription or option image assignment is required.")
        confidence -= 0.1
    elif image_refs and not options:
        warnings.append("Answer field image detected; treated as numeric response visual.")
    status = "READY" if stem and correct_answer and (len(options) == 4 or not options) and not image_backed_options else "NEEDS_REVIEW"
    raw = {
        "text": cleaned,
        "structuringModel": STRUCTURING_MODEL,
        "contentType": meta["contentType"],
        "sourceKind": meta["sourceKind"],
        "relativePath": meta["relativePath"],
        "questionExternalId": external_match.group(1).lower() if external_match else None,
    }
    return {
        "id": new_id("cand"),
        "batchId": meta["batchId"],
        "sourceFileId": meta["id"],
        "pageArtifactId": page_id,
        "questionNumber": question_number,
        "questionExternalId": external_match.group(1).lower() if external_match else None,
        "testNumber": meta["testNumber"],
        "moduleLabel": module_label,
        "sourceLabel": meta["relativePath"],
        "contentType": meta["contentType"],
        "section": meta["section"],
        "domainName": meta["domainName"],
        "topicName": meta["topicName"],
        "difficulty": meta["difficulty"],
        "difficultySource": meta["difficultySource"],
        "practiceSetVariant": meta["practiceSetVariant"],
        "type": "MC" if options or image_backed_options else "NUMERIC",
        "stem": stem,
        "stimulus": practice_stimulus,
        "optionsJson": json.dumps(options if options else [{"label": label, "text": ""} for label in ["A", "B", "C", "D"]]) if options or image_backed_options else None,
        "correctAnswer": correct_answer,
        "explanation": (extract_rationale(cleaned) or cleaned)[:3000] if is_answer_file else None,
        "rawJson": json.dumps(raw),
        "confidence": max(0.05, min(0.95, confidence)),
        "warningsJson": json.dumps(warnings),
        "status": status,
    }


def make_candidates_from_text(text: str, meta: sqlite3.Row, page_id: str | None, default_module_label: str | None = None) -> list[dict[str, Any]]:
    if bool(meta["isAnswerFile"]):
        return []
    # Image-only mock-exam DOCX: question modules are page screenshots that do NOT
    # segment reliably per image (one question spans passage/question/table images;
    # many pages are tables or lone options). Do not create per-image candidates;
    # the canonical, correctly-numbered candidates come from the answer-DOCX spine
    # (create_missing_full_test_candidates_from_docx_answers). The OCR'd images stay
    # as linkable page context.
    meta_keys = meta.keys() if hasattr(meta, "keys") else []
    extension = str((meta["extension"] if "extension" in meta_keys else "") or "").lower()
    if meta["contentType"] == "FULL_PRACTICE_TEST" and extension == "docx":
        return []
    if meta["contentType"] == "FULL_PRACTICE_TEST" and re.search(r"\bEXTRA\s+PRACTICE\b", text, re.IGNORECASE):
        return []
    return [
        candidate
        for number, block, module_label in split_question_blocks(text, default_module_label=default_module_label)
        if (
            candidate := make_candidate_from_text(
                block,
                meta,
                page_id,
                question_number_override=number,
                module_label_override=module_label,
            )
        )
    ]


def remove_full_test_extra_practice_candidates(db: sqlite3.Connection, batch_id: str, source_file_id: str | None = None) -> int:
    params: list[Any] = [batch_id]
    source_filter = ""
    if source_file_id:
        source_filter = "AND p.sourceFileId = ?"
        params.append(source_file_id)
    rows = db.execute(
        f"""
        SELECT DISTINCT p.id AS pageId, p.sourceFileId, f.relativePath, p.pageNumber
        FROM IngestPageArtifact p
        JOIN IngestSourceFile f ON f.id = p.sourceFileId
        WHERE p.batchId = ? {source_filter}
          AND f.contentType = 'FULL_PRACTICE_TEST'
          AND p.extractedText LIKE '%EXTRA PRACTICE%'
        """,
        params,
    ).fetchall()
    removed = 0
    for row in rows:
        result = db.execute(
            """
            DELETE FROM IngestQuestionCandidate
            WHERE batchId = ? AND pageArtifactId = ?
            """,
            (batch_id, row["pageId"]),
        )
        count = result.rowcount if result.rowcount and result.rowcount > 0 else 0
        if count:
            removed += count
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=row["sourceFileId"],
                page_artifact_id=row["pageId"],
                severity="INFO",
                code="FULL_TEST_EXTRA_PRACTICE_SKIPPED",
                message=f"Skipped {count} candidates from extra practice page {row['pageNumber']} of {row['relativePath']}.",
                decision="Extra practice content is excluded from official Full Practice Test staging candidates.",
                action="No action required unless this page should be promoted as a separate practice set.",
                status="RESOLVED",
            )
    return removed


def insert_candidate(db: sqlite3.Connection, candidate: dict[str, Any]) -> None:
    candidate.setdefault("stimulus", None)  # no todos los builders separan estímulo
    if candidate.get("questionExternalId"):
        duplicate = db.execute(
            """
            SELECT id, sourceLabel FROM IngestQuestionCandidate
            WHERE batchId = ? AND questionExternalId = ? AND id != ?
            LIMIT 1
            """,
            (candidate["batchId"], candidate["questionExternalId"], candidate["id"]),
        ).fetchone()
        if duplicate:
            log_ingest_incident(
                db,
                batch_id=candidate["batchId"],
                source_file_id=candidate["sourceFileId"],
                page_artifact_id=candidate["pageArtifactId"],
                severity="WARNING",
                code="DUPLICATE_QUESTION_EXTERNAL_ID",
                message=f"Question ID {candidate['questionExternalId']} was already detected in this batch.",
                decision=f"Ignoring duplicate candidate from {candidate['sourceLabel']}; first candidate is {duplicate['id']}.",
                action="Review source files if the duplicate should replace the first candidate.",
            )
            return
    db.execute(
        """
        INSERT INTO IngestQuestionCandidate
          (id, batchId, sourceFileId, pageArtifactId, questionNumber, questionExternalId, testNumber, moduleLabel, sourceLabel, contentType, section, domainName, topicName, difficulty, difficultySource, practiceSetVariant, type, stem, stimulus, optionsJson, correctAnswer, explanation, rawJson, confidence, warningsJson, status, updatedAt)
        VALUES
          (:id, :batchId, :sourceFileId, :pageArtifactId, :questionNumber, :questionExternalId, :testNumber, :moduleLabel, :sourceLabel, :contentType, :section, :domainName, :topicName, :difficulty, :difficultySource, :practiceSetVariant, :type, :stem, :stimulus, :optionsJson, :correctAnswer, :explanation, :rawJson, :confidence, :warningsJson, :status, :updatedAt)
        """,
        {**candidate, "updatedAt": now_iso()},
    )


def normalize_full_test_candidate_modules(db: sqlite3.Connection, batch_id: str, source_file_id: str | None = None) -> int:
    where = "batchId = ? AND contentType = 'FULL_PRACTICE_TEST' AND sourceKind = 'MOCK_EXAM'"
    params: list[Any] = [batch_id]
    if source_file_id:
        where += " AND id = ?"
        params.append(source_file_id)
    sources = db.execute(f"SELECT id, relativePath FROM IngestSourceFile WHERE {where}", params).fetchall()
    updated = 0
    for source in sources:
        candidates = db.execute(
            """
            SELECT q.id, q.moduleLabel, q.questionNumber
            FROM IngestQuestionCandidate q
            LEFT JOIN IngestPageArtifact p ON p.id = q.pageArtifactId
            WHERE q.batchId = ? AND q.sourceFileId = ?
            ORDER BY COALESCE(p.pageNumber, 999999), q.createdAt, q.questionNumber
            """,
            (batch_id, source["id"]),
        ).fetchall()
        if len(candidates) < 2:
            continue
        # Módulos: preferir hints del path; si no hay (archivo combinado sin "Module N"
        # en el nombre, p.ej. ".../MATH/Test 10 Innov. Math.pdf"), derivarlos de las
        # etiquetas que la detección por OCR SÍ resolvió en algunos candidatos. Así se
        # normalizan las combinaciones donde solo el encabezado de un módulo fue legible.
        modules = detect_full_test_modules(source["relativePath"])
        if len(modules) < 2:
            seen: list[str] = []
            for candidate in candidates:
                label = candidate["moduleLabel"]
                if label and label not in seen:
                    seen.append(label)
            if len(seen) >= 2:
                modules = seen[:2]
        if len(modules) < 2:
            continue
        # (module, questionNumber) ya ocupados por candidatos con etiqueta: evita crear
        # duplicados y desambigua los interpolados por orden de página (una pregunta cuyo
        # módulo "preferido" por posición ya tiene ese número va al otro módulo).
        taken: set[tuple[str, Any]] = {
            (c["moduleLabel"], c["questionNumber"]) for c in candidates if c["moduleLabel"]
        }
        midpoint = len(candidates) // 2
        for index, candidate in enumerate(candidates):
            if candidate["moduleLabel"]:
                continue
            preferred = modules[0] if index < midpoint else modules[-1]
            other = modules[-1] if preferred == modules[0] else modules[0]
            qn = candidate["questionNumber"]
            module_label = preferred
            if (preferred, qn) in taken and (other, qn) not in taken:
                module_label = other
            taken.add((module_label, qn))
            db.execute(
                "UPDATE IngestQuestionCandidate SET moduleLabel = ?, updatedAt = ? WHERE id = ?",
                (module_label, now_iso(), candidate["id"]),
            )
            updated += 1
    if updated:
        log_ingest_incident(
            db,
            batch_id=batch_id,
            source_file_id=source_file_id,
            severity="INFO",
            code="FULL_TEST_MODULES_NORMALIZED",
            message=f"Assigned module labels to {updated} Full Practice Test candidates using source order and filename module hints.",
            decision="Questions in combined module files are split by detected source order when module headings are absent in OCR text.",
            action="Review only if a source document interleaves modules instead of listing them sequentially.",
            status="RESOLVED",
        )
    return updated


def insert_image_artifacts(
    db: sqlite3.Connection,
    batch_id: str,
    source_file_id: str,
    source_path: Path | None,
    page_artifact_id: str | None,
    page_number: int,
    layout: dict[str, Any] | None,
    ocr_payload: dict[str, Any] | None = None,
) -> int:
    inserted = 0
    for index, image in enumerate((layout or {}).get("images") or []):
        image_id = new_id("img")
        file_url = None
        content_hash = None
        width = None
        height = None
        if source_path:
            image_bytes, width, height = crop_pdf_image(source_path, page_number, image)
            if image_bytes:
                file_url, content_hash = save_ingest_image(batch_id, image_id, image_bytes, "jpg")
        db.execute(
            """
            INSERT OR IGNORE INTO IngestImageArtifact
              (id, batchId, sourceFileId, pageArtifactId, pageNumber, imageIndex, imageId, origin, bboxJson, mimeType, fileUrl, width, height, contentHash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PDFPLUMBER', ?, ?, ?, ?, ?, ?, 'AVAILABLE')
            """,
            (
                image_id,
                batch_id,
                source_file_id,
                page_artifact_id,
                page_number,
                index,
                image.get("name"),
                json.dumps(image),
                "image/jpeg" if file_url else None,
                file_url,
                width,
                height,
                content_hash,
            ),
        )
        inserted += 1
    for image in (layout or {}).get("docxImages") or []:
        # Best-effort: a single bad/undecodable image or a filesystem write error
        # must not abort processing of the whole source file.
        try:
            image_id = new_id("img")
            image_bytes, _ext = decode_base64_image(image.get("base64"))
            file_url = None
            content_hash = None
            width = None
            height = None
            if image_bytes:
                file_url, content_hash = save_ingest_image(batch_id, image_id, image_bytes, image.get("ext") or "png")
                try:
                    with Image.open(BytesIO(image_bytes)) as loaded:
                        width, height = loaded.size
                except Exception:
                    width = height = None
            db.execute(
                """
                INSERT OR IGNORE INTO IngestImageArtifact
                  (id, batchId, sourceFileId, pageArtifactId, pageNumber, imageIndex, imageId, origin, bboxJson, mimeType, fileUrl, width, height, contentHash, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'DOCX_MEDIA', ?, ?, ?, ?, ?, ?, 'AVAILABLE')
                """,
                (
                    image_id,
                    batch_id,
                    source_file_id,
                    page_artifact_id,
                    page_number,
                    inserted,
                    image.get("name"),
                    None,
                    image.get("mime") or "image/png",
                    file_url,
                    width,
                    height,
                    content_hash,
                ),
            )
            inserted += 1
        except Exception:
            continue
    image_index = 0
    for page in (ocr_payload or {}).get("pages") or []:
        for image in page.get("images") or []:
            image_id = new_id("img")
            image_bytes, extension = decode_base64_image(image.get("image_base64"))
            file_url = None
            content_hash = None
            width = None
            height = None
            if image_bytes:
                file_url, content_hash = save_ingest_image(batch_id, image_id, image_bytes, extension)
                try:
                    with Image.open(BytesIO(image_bytes)) as loaded:
                        width, height = loaded.size
                except Exception:
                    width = height = None
            bbox = {
                "top_left_x": image.get("top_left_x"),
                "top_left_y": image.get("top_left_y"),
                "bottom_right_x": image.get("bottom_right_x"),
                "bottom_right_y": image.get("bottom_right_y"),
            }
            db.execute(
                """
                INSERT OR IGNORE INTO IngestImageArtifact
                  (id, batchId, sourceFileId, pageArtifactId, pageNumber, imageIndex, imageId, origin, bboxJson, mimeType, base64Data, fileUrl, width, height, contentHash, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'MISTRAL_OCR', ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
	                """,
                (
                    image_id,
                    batch_id,
                    source_file_id,
                    page_artifact_id,
                    page_number,
                    image_index,
                    image.get("id"),
                    json.dumps(bbox),
                    f"image/{extension}",
                    image.get("image_base64"),
                    file_url,
                    width,
                    height,
                    content_hash,
                ),
            )
            inserted += 1
            image_index += 1
    return inserted


MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)]+)\)")


def markdown_image_refs(value: str | None) -> list[str]:
    if not value:
        return []
    return [Path(match.group(1)).name.lower() for match in MARKDOWN_IMAGE_PATTERN.finditer(value)]


def strip_markdown_image_refs(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = MARKDOWN_IMAGE_PATTERN.sub("", value)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned or None


def link_markdown_images_for_page(db: sqlite3.Connection, batch_id: str, page_artifact_id: str) -> int:
    images = db.execute(
        """
        SELECT id, imageId, imageIndex, origin
        FROM IngestImageArtifact
        WHERE batchId = ? AND pageArtifactId = ?
        ORDER BY CASE WHEN origin = 'MISTRAL_OCR' THEN 0 ELSE 1 END, imageIndex
        """,
        (batch_id, page_artifact_id),
    ).fetchall()
    if not images:
        return 0

    image_by_name: dict[str, sqlite3.Row] = {}
    image_by_index: dict[int, sqlite3.Row] = {}
    for image in images:
        if image["imageId"]:
            image_by_name[Path(str(image["imageId"])).name.lower()] = image
        image_by_index.setdefault(int(image["imageIndex"]), image)

    linked = 0
    candidates = db.execute(
        """
        SELECT id, stem, stimulus, explanation, optionsJson, type
        FROM IngestQuestionCandidate
        WHERE batchId = ? AND pageArtifactId = ?
        """,
        (batch_id, page_artifact_id),
    ).fetchall()
    for candidate in candidates:
        stem_refs = markdown_image_refs(candidate["stem"])
        options_are_empty = False
        try:
            parsed_for_empty = json.loads(candidate["optionsJson"] or "[]")
            options_are_empty = (
                candidate["type"] == "MC"
                and isinstance(parsed_for_empty, list)
                and len(parsed_for_empty) >= 2
                and all(not str(option.get("text") or "").strip() for option in parsed_for_empty if isinstance(option, dict))
            )
        except Exception:
            options_are_empty = False

        answer_field_refs = set(stem_refs[-1:] if candidate["type"] == "NUMERIC" and stem_refs else [])
        option_block_refs = set(stem_refs[-1:] if options_are_empty and stem_refs else [])
        targets: list[tuple[str, str | None, str, set[str]]] = [
            ("STEM", None, candidate["stem"] or "", answer_field_refs | option_block_refs),
            ("STIMULUS", None, candidate["stimulus"] or "", set()),
            ("EXPLANATION", None, candidate["explanation"] or "", set()),
        ]
        if options_are_empty and stem_refs:
            targets.append(("OPTION_BLOCK", None, f"![choices]({stem_refs[-1]})", set()))
        elif answer_field_refs:
            targets.append(("ANSWER_FIELD", None, f"![answer-field]({stem_refs[-1]})", set()))
        cleaned_options_json = candidate["optionsJson"]
        try:
            options = json.loads(candidate["optionsJson"] or "[]")
            if isinstance(options, list):
                changed_options = False
                for option in options:
                    if not isinstance(option, dict):
                        continue
                    label = str(option.get("label") or "").upper() or None
                    text = str(option.get("text") or "")
                    targets.append(("OPTION", label, text, set()))
                    cleaned_text = strip_markdown_image_refs(text) or ""
                    if cleaned_text != text:
                        option["text"] = cleaned_text
                        changed_options = True
                if changed_options:
                    cleaned_options_json = json.dumps(options)
        except Exception:
            cleaned_options_json = candidate["optionsJson"]

        for target_type, option_label, value, skipped_refs in targets:
            for sort_order, ref in enumerate(markdown_image_refs(value)):
                if ref in skipped_refs:
                    continue
                image = image_by_name.get(ref)
                if not image:
                    index_match = re.search(r"img[-_]?(\d+)", ref, re.IGNORECASE)
                    if index_match:
                        image = image_by_index.get(int(index_match.group(1)))
                if not image:
                    continue
                db.execute(
                    """
                    INSERT OR IGNORE INTO IngestCandidateImageLink
                      (id, batchId, candidateId, imageArtifactId, targetType, optionLabel, sortOrder, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id("imglink"),
                        batch_id,
                        candidate["id"],
                        image["id"],
                        target_type,
                        option_label,
                        sort_order,
                        now_iso(),
                        now_iso(),
                    ),
                )
                linked += db.execute("SELECT changes()").fetchone()[0]

        cleaned_stem = strip_markdown_image_refs(candidate["stem"])
        cleaned_stimulus = strip_markdown_image_refs(candidate["stimulus"])
        cleaned_explanation = strip_markdown_image_refs(candidate["explanation"])
        if (
            cleaned_stem != candidate["stem"]
            or cleaned_stimulus != candidate["stimulus"]
            or cleaned_explanation != candidate["explanation"]
            or cleaned_options_json != candidate["optionsJson"]
        ):
            db.execute(
                """
                UPDATE IngestQuestionCandidate
                SET stem = ?, stimulus = ?, explanation = ?, optionsJson = ?, updatedAt = ?
                WHERE id = ?
                """,
                (cleaned_stem, cleaned_stimulus, cleaned_explanation, cleaned_options_json, now_iso(), candidate["id"]),
            )
    return linked


def split_answer_values(value: str) -> list[str]:
    return [
        cleaned
        for part in re.split(r"(?:\s+/\s+|\n+)", value)
        if (cleaned := clean_answer_value(part))
    ]


def is_answer_key_header_cell(value: str) -> bool:
    cleaned = re.sub(r"\s+", " ", value).strip()
    return bool(re.fullmatch(r"(?:RW|READING(?:\s+AND\s+WRITING)?|MATH)\s+(?:MOD(?:ULE)?\s*)?[0-9A-Z]+", cleaned, re.IGNORECASE))


def clean_answer_key_cell_value(value: str) -> str | None:
    if is_answer_key_header_cell(value):
        return None
    had_question_prefix = bool(re.match(r"^\s*(?:Q(?:uestion)?\s*)?[0-9]{1,3}\s*[\).:-]", value, re.IGNORECASE))
    stripped = re.sub(r"^\s*(?:Q(?:uestion)?\s*)?[0-9]{1,3}\s*[\).:-]\s*", "", value, flags=re.IGNORECASE).strip()
    if had_question_prefix and not stripped:
        return None
    return clean_answer_value(stripped or value)


def split_answer_key_cell_values(value: str) -> tuple[list[str], bool]:
    answers: list[str] = []
    for part in re.split(r"(?:\s+/\s+|\n+)", value):
        if re.search(r"\bextra\b", part, re.IGNORECASE):
            return answers, True
        if cleaned := clean_answer_key_cell_value(part):
            answers.append(cleaned)
    return answers, False


def docx_table_answer_key_columns(tables: list[Any], meta: sqlite3.Row | dict[str, Any]) -> list[dict[str, Any]]:
    columns: list[dict[str, Any]] = []
    for table in tables:
        if not isinstance(table, list) or len(table) < 2:
            continue
        headers = [str(cell).strip() for cell in table[0]]
        if len(headers) < 2:
            continue
        if not any(detect_full_test_section(header) and detect_full_test_modules(header) for header in headers):
            continue
        for column_index, header in enumerate(headers):
            if not header:
                continue
            values: list[str] = []
            stop_column = False
            for row in table[1:]:
                if not isinstance(row, list) or column_index >= len(row):
                    continue
                cell_values, stop_column = split_answer_key_cell_values(str(row[column_index]))
                values.extend(cell_values)
                if stop_column:
                    break
            answers = [value for value in values if value]
            if not answers:
                continue
            section = detect_full_test_section(header) or meta["section"]
            module_hint = detect_full_test_modules(header)
            columns.append(
                {
                    "section": section,
                    "moduleLabel": module_hint[-1] if module_hint else None,
                    "header": header,
                    "answers": answers,
                }
            )
    return columns


def answer_key_columns(text: str, meta: sqlite3.Row | dict[str, Any]) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    columns: list[dict[str, Any]] = []
    for index, line in enumerate(lines[:-1]):
        if "|" not in line:
            continue
        value_line = lines[index + 1]
        if "|" not in value_line:
            continue
        headers = [part.strip() for part in line.split("|")]
        values = [part.strip() for part in value_line.split("|")]
        if len(headers) != len(values):
            continue
        if not any(detect_full_test_section(header) and detect_full_test_modules(header) for header in headers):
            continue
        for header, value in zip(headers, values):
            answers, _stop_column = split_answer_key_cell_values(value)
            if not answers:
                continue
            section = detect_full_test_section(header) or meta["section"]
            module_hint = detect_full_test_modules(header)
            columns.append(
                {
                    "section": section,
                    "moduleLabel": module_hint[-1] if module_hint else header[:80],
                    "header": header,
                    "answers": answers,
                }
            )
    return columns


def docx_explanation_answer_rows(layout: dict[str, Any] | None, meta: sqlite3.Row | dict[str, Any]) -> list[dict[str, Any]]:
    if not layout:
        return []
    rows: list[dict[str, Any]] = []
    for block in layout.get("docxExplanationBlocks") or []:
        if not isinstance(block, dict):
            continue
        explanation = str(block.get("explanationText") or "").strip()
        question_number = block.get("questionNumber")
        if not explanation or not isinstance(question_number, int):
            continue
        module_label = block.get("moduleLabel")
        section = block.get("section") or meta["section"]
        options = parse_docx_answer_table_options(explanation)
        normalized_explanation = normalize_docx_answer_explanation(explanation)
        raw_payload = {
            "questionText": str(block.get("questionText") or "").strip(),
            "explanationText": explanation[:6000],
            "options": options,
        }
        rows.append(
            {
                "questionNumber": question_number,
                "section": section,
                "moduleLabel": module_label,
                "answer": extract_correct_answer(explanation),
                "explanation": normalized_explanation[:3000],
                "rawText": json.dumps(raw_payload),
                "confidence": 0.88 if module_label else 0.7,
            }
        )
    return rows


def insert_answer_candidate_row(
    db: sqlite3.Connection,
    meta: sqlite3.Row | dict[str, Any],
    page_id: str | None,
    question_number: int | None,
    question_external_id: str | None,
    section: str | None,
    module_label: str | None,
    answer: str | None,
    explanation: str | None,
    raw_text: str | None,
    confidence: float,
) -> None:
    db.execute(
        """
        INSERT INTO IngestAnswerCandidate
          (id, batchId, sourceFileId, pageArtifactId, questionNumber, questionExternalId, testNumber, section, moduleLabel, answer, explanation, rawText, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("ans"),
            meta["batchId"],
            meta["id"],
            page_id,
            question_number,
            question_external_id,
            meta["testNumber"],
            section,
            module_label,
            answer,
            explanation,
            raw_text,
            confidence,
        ),
    )


def insert_answer_candidates(
    db: sqlite3.Connection,
    text: str,
    meta: sqlite3.Row | dict[str, Any],
    page_id: str | None,
    layout: dict[str, Any] | None = None,
) -> int:
    if not text.strip():
        return 0
    seen: set[tuple[str | None, str | None, str | None, int | None, str | None, str | None]] = set()
    inserted = 0
    if meta["contentType"] == "FULL_PRACTICE_TEST":
        columns = docx_table_answer_key_columns(layout.get("docxTables") or [], meta) if layout else []
        if not columns:
            columns.extend(answer_key_columns(text, meta))
        for column in columns:
            for index, answer in enumerate(column["answers"], start=1):
                key = (None, column["section"], column["moduleLabel"], index, answer, None)
                if key in seen:
                    continue
                seen.add(key)
                insert_answer_candidate_row(
                    db,
                    meta,
                    page_id,
                    index,
                    None,
                    column["section"],
                    column["moduleLabel"],
                    answer,
                    None,
                    f"{column['header']} question {index}: {answer}",
                    0.9 if column["section"] else 0.75,
                )
                inserted += 1
        for row in docx_explanation_answer_rows(layout, meta):
            key = (None, row["section"], row["moduleLabel"], row["questionNumber"], row["answer"], row["explanation"])
            if key in seen:
                continue
            seen.add(key)
            insert_answer_candidate_row(
                db,
                meta,
                page_id,
                row["questionNumber"],
                None,
                row["section"],
                row["moduleLabel"],
                row["answer"],
                row["explanation"],
                row["rawText"],
                row["confidence"],
            )
            inserted += 1
        if inserted and columns:
            return inserted
    pairs: list[tuple[str | None, int | None, str]] = []
    external_match = QUESTION_ID_RE.search(text)
    question_external_id = external_match.group(1).lower() if external_match else None
    for match in ANSWER_PAIR_RE.finditer(text):
        pairs.append((question_external_id, int(match.group(1)), match.group(2).upper()))
    direct_answer = extract_correct_answer(text)
    if direct_answer:
        q_match = QUESTION_RE.search(text)
        pairs.append((question_external_id, int(q_match.group(1)) if q_match else None, direct_answer))
    for question_external_id, question_number, answer in pairs:
        key = (question_external_id, meta["section"], None, question_number, answer, None)
        if key in seen:
            continue
        seen.add(key)
        insert_answer_candidate_row(
            db,
            meta,
            page_id,
            question_number,
            question_external_id,
            meta["section"],
            None,
            answer,
            (extract_rationale(text) or text)[:3000] if bool(meta["isAnswerFile"]) else None,
            text[:3000],
            0.9 if question_external_id else 0.75 if question_number else 0.5,
        )
        inserted += 1
    return inserted


def create_missing_full_test_candidates_from_docx_answers(
    db: sqlite3.Connection,
    meta: sqlite3.Row | dict[str, Any],
    page_id: str | None,
    layout: dict[str, Any] | None,
) -> int:
    if not layout or meta["contentType"] != "FULL_PRACTICE_TEST" or not bool(meta["isAnswerFile"]):
        return 0
    created = 0
    for row in docx_explanation_answer_rows(layout, meta):
        question_number = row["questionNumber"]
        section = row["section"]
        module_label = row["moduleLabel"]
        if not question_number or not section or not module_label:
            continue
        existing = db.execute(
            """
            SELECT id
            FROM IngestQuestionCandidate
            WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST'
              AND testNumber IS ? AND section IS ? AND moduleLabel IS ? AND questionNumber IS ?
            LIMIT 1
            """,
            (meta["batchId"], meta["testNumber"], section, module_label, question_number),
        ).fetchone()
        if existing:
            continue
        raw_payload = json.loads(row["rawText"]) if row.get("rawText") else {}
        stem = str(raw_payload.get("questionText") or "").strip()
        options = raw_payload.get("options") if isinstance(raw_payload.get("options"), list) else []
        candidate_type = "MC" if len(options) == 4 or (row["answer"] and re.fullmatch(r"[A-D]", str(row["answer"]))) else "NUMERIC"
        warnings = ["Candidate created from DOCX answer/explanation source because the matching PDF question was missing."]
        if candidate_type == "MC" and len(options) != 4:
            warnings.append("Alternatives were not available in the DOCX table; review against the source PDF before promotion.")
        candidate = {
            "id": new_id("cand"),
            "batchId": meta["batchId"],
            "sourceFileId": meta["id"],
            "pageArtifactId": page_id,
            "questionNumber": question_number,
            "questionExternalId": None,
            "testNumber": meta["testNumber"],
            "moduleLabel": module_label,
            "sourceLabel": meta["relativePath"],
            "contentType": meta["contentType"],
            "section": section,
            "domainName": meta["domainName"],
            "topicName": meta["topicName"],
            "difficulty": meta["difficulty"],
            "difficultySource": meta["difficultySource"],
            "practiceSetVariant": meta["practiceSetVariant"],
            "type": candidate_type,
            "stem": stem[:2500] if stem else None,
            "optionsJson": json.dumps(options) if len(options) == 4 else None,
            "correctAnswer": row["answer"],
            "explanation": row["explanation"],
            "rawJson": json.dumps({"source": "DOCX_ANSWER_EXPLANATION", "rawText": raw_payload}),
            "confidence": 0.62 if stem else 0.45,
            "warningsJson": json.dumps(warnings),
            "status": "NEEDS_REVIEW",
        }
        insert_candidate(db, candidate)
        log_ingest_incident(
            db,
            batch_id=meta["batchId"],
            source_file_id=meta["id"],
            page_artifact_id=page_id,
            severity="WARNING",
            code="FULL_TEST_DOCX_QUESTION_ONLY_CANDIDATE",
            message=f"Created TEST {meta['testNumber']} {section} module {module_label} Q{question_number} candidate from DOCX answer/explanation source.",
            decision="Candidate remains NEEDS_REVIEW because the PDF question candidate was missing.",
            action="Review the question text/options against the source PDF before promotion.",
        )
        created += 1
    return created


def full_test_module_match_values(
    db: sqlite3.Connection,
    batch_id: str,
    test_number: int | None,
    section: str | None,
    module_label: str | None,
) -> list[str]:
    if not module_label:
        return []
    values = [module_label]
    labels = {
        row["moduleLabel"]
        for row in db.execute(
            """
            SELECT DISTINCT moduleLabel
            FROM IngestQuestionCandidate
            WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST'
              AND testNumber IS ? AND section IS ? AND moduleLabel IS NOT NULL
            """,
            (batch_id, test_number, section),
        ).fetchall()
    }
    if module_label == "2B" and "2" in labels and "2A" not in labels:
        values.append("2")
    elif module_label == "2" and "2B" in labels and "2A" not in labels:
        values.append("2B")
    return values


def full_test_answer_key_invalid_groups(db: sqlite3.Connection, batch_id: str) -> set[tuple[str, str | None, str | None]]:
    invalid: set[tuple[str, str | None, str | None]] = set()
    groups = db.execute(
        """
        SELECT a.sourceFileId, a.section, a.moduleLabel,
               COUNT(DISTINCT a.questionNumber) answerCount,
               MAX(a.questionNumber) maxAnswerQuestion,
               f.testNumber
        FROM IngestAnswerCandidate a
        JOIN IngestSourceFile f ON f.id = a.sourceFileId
        WHERE a.batchId = ? AND f.contentType = 'FULL_PRACTICE_TEST' AND f.sourceKind = 'ANSWER_KEY'
          AND a.questionNumber IS NOT NULL
        GROUP BY a.sourceFileId, a.section, a.moduleLabel, f.testNumber
        """,
        (batch_id,),
    ).fetchall()
    for group in groups:
        candidate_modules = full_test_module_match_values(db, batch_id, group["testNumber"], group["section"], group["moduleLabel"])
        if not candidate_modules:
            candidate_modules = [group["moduleLabel"]]
        placeholders = ",".join("?" for _ in candidate_modules)
        candidate_stats = db.execute(
            f"""
            SELECT COUNT(DISTINCT questionNumber) candidateCount,
                   MAX(questionNumber) maxCandidateQuestion
            FROM IngestQuestionCandidate
            WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST'
              AND testNumber IS ? AND section IS ? AND moduleLabel IN ({placeholders})
              AND stem IS NOT NULL AND questionNumber IS NOT NULL
            """,
            [batch_id, group["testNumber"], group["section"], *candidate_modules],
        ).fetchone()
        candidate_count = int(candidate_stats["candidateCount"] or 0) if candidate_stats else 0
        max_candidate_question = int(candidate_stats["maxCandidateQuestion"] or 0) if candidate_stats and candidate_stats["maxCandidateQuestion"] else 0
        if int(group["answerCount"] or 0) > candidate_count or int(group["maxAnswerQuestion"] or 0) > max_candidate_question:
            invalid.add((group["sourceFileId"], group["section"], group["moduleLabel"]))
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=group["sourceFileId"],
                severity="WARNING",
                code="FULL_TEST_ANSWER_GROUP_COUNT_MISMATCH",
                message=(
                    f"Answer key group TEST {group['testNumber']} {group['section']} module {group['moduleLabel']} "
                    f"has {group['answerCount']} answers up to Q{group['maxAnswerQuestion']}, but only "
                    f"{candidate_count} candidate question numbers up to Q{max_candidate_question} are available."
                ),
                decision="This answer-key group was not applied automatically.",
                action="Review the answer key table for extra rows or mismatched modules.",
            )
    return invalid


def full_test_answer_target_count(db: sqlite3.Connection, where: str, where_params: list[Any]) -> int:
    row = db.execute(
        f"""
        SELECT COUNT(*) AS count
        FROM IngestQuestionCandidate
        WHERE {where}
        """,
        where_params,
    ).fetchone()
    return int(row["count"] or 0) if row else 0


def log_full_test_answer_match_issue(
    db: sqlite3.Connection,
    answer: sqlite3.Row,
    count: int,
    module_label: str | None,
) -> None:
    code = "FULL_TEST_ANSWER_MATCH_MISSING" if count == 0 else "FULL_TEST_ANSWER_MATCH_AMBIGUOUS"
    severity = "INFO" if count == 0 else "WARNING"
    log_ingest_incident(
        db,
        batch_id=answer["batchId"],
        source_file_id=answer["sourceFileId"],
        page_artifact_id=answer["pageArtifactId"],
        severity=severity,
        code=code,
        message=(
            f"Answer candidate for TEST {answer['resolvedTestNumber']} {answer['resolvedSection']} "
            f"module {module_label} Q{answer['questionNumber']} matched {count} question candidates."
        ),
        decision="Parsed answer was not applied because the target question was not unique.",
        action="Review duplicate/missing question candidates before promotion.",
    )


def log_answer_conflicts(
    db: sqlite3.Connection,
    answer: sqlite3.Row,
    where: str,
    where_params: list[Any],
) -> None:
    if not answer["answer"]:
        return
    conflicts = db.execute(
        f"""
        SELECT id, correctAnswer, sourceLabel
        FROM IngestQuestionCandidate
        WHERE {where} AND correctAnswer IS NOT NULL AND correctAnswer <> ?
        """,
        [*where_params, answer["answer"]],
    ).fetchall()
    for conflict in conflicts:
        parsed_answer_wins = answer["sourceKind"] == "ANSWER_KEY" or (
            answer["sourceKind"] == "ANSWER_EXPLANATION" and answer["moduleLabel"] and answer["explanation"]
        )
        log_ingest_incident(
            db,
            batch_id=answer["batchId"],
            source_file_id=answer["sourceFileId"],
            page_artifact_id=answer["pageArtifactId"],
            severity="WARNING",
            code="FULL_TEST_ANSWER_CONFLICT",
            message=f"Answer conflict for candidate {conflict['id']}: existing {conflict['correctAnswer']} vs parsed {answer['answer']}.",
            decision="Parsed answer source was used to overwrite the existing candidate answer."
            if parsed_answer_wins
            else "Existing candidate answer was kept; parsed answer was not used to overwrite it.",
            action=f"Review candidate and source {conflict['sourceLabel']}.",
        )


def apply_answer_update(
    db: sqlite3.Connection,
    answer: sqlite3.Row,
    where: str,
    where_params: list[Any],
) -> int:
    log_answer_conflicts(db, answer, where, where_params)
    answer_source = "DOCX_ANSWER_EXPLANATION" if answer["sourceKind"] == "ANSWER_EXPLANATION" else "ANSWER_KEY"
    parsed_options: list[dict[str, str]] = []
    parsed_question_text: str | None = None
    if answer["rawText"]:
        try:
            payload = json.loads(answer["rawText"])
            if isinstance(payload, dict) and isinstance(payload.get("options"), list):
                parsed_options = [
                    {"label": str(option.get("label", "")).strip().upper(), "text": str(option.get("text", "")).strip()}
                    for option in payload["options"]
                    if isinstance(option, dict) and option.get("label") and option.get("text")
                ]
            if isinstance(payload, dict):
                question_text = str(payload.get("questionText") or "").strip()
                parsed_question_text = question_text[:2500] if question_text else None
        except Exception:
            parsed_options = parse_docx_answer_table_options(str(answer["rawText"]))
    parsed_options_json = json.dumps(parsed_options) if len(parsed_options) == 4 else None
    answer_value_sql = (
        "? "
        if answer["answer"]
        and (
            answer["sourceKind"] == "ANSWER_KEY"
            or (answer["sourceKind"] == "ANSWER_EXPLANATION" and answer["moduleLabel"] and answer["explanation"])
        )
        else "COALESCE(correctAnswer, ?)"
    )
    explanation_value_sql = (
        "? "
        if answer["sourceKind"] == "ANSWER_EXPLANATION" and answer["moduleLabel"] and answer["explanation"]
        else "COALESCE(explanation, ?)"
    )
    options_value_sql = (
        """
            optionsJson = CASE
              WHEN ? IS NOT NULL
                AND (optionsJson IS NULL OR optionsJson = '' OR optionsJson = '[]' OR optionsJson LIKE '%"text": ""%')
              THEN ?
              ELSE optionsJson
            END,
            stem = CASE
              WHEN ? IS NOT NULL AND (stem IS NULL OR stem = '')
              THEN ?
              ELSE stem
            END,
        """
    )
    result = db.execute(
        f"""
        UPDATE IngestQuestionCandidate
        SET correctAnswer = {answer_value_sql},
            explanation = {explanation_value_sql},
            {options_value_sql}
            answerSource = COALESCE(answerSource, ?),
            status = CASE
              WHEN COALESCE(stem, ?) IS NOT NULL AND COALESCE(correctAnswer, ?) IS NOT NULL THEN 'READY'
              ELSE status
            END,
            updatedAt = ?
        WHERE {where}
        """,
        [
            answer["answer"],
            answer["explanation"],
            parsed_options_json,
            parsed_options_json,
            parsed_question_text,
            parsed_question_text,
            answer_source,
            parsed_question_text,
            answer["answer"],
            now_iso(),
            *where_params,
        ],
    )
    return result.rowcount if result.rowcount and result.rowcount > 0 else 0


def enrich_candidates_from_answers(db: sqlite3.Connection, batch_id: str) -> int:
    invalid_answer_key_groups = full_test_answer_key_invalid_groups(db, batch_id)
    answers = db.execute(
        """
        SELECT a.*, f.contentType, f.section AS sourceSection, f.domainName, f.topicName, f.difficulty, f.practiceSetVariant,
               f.sourceKind,
               COALESCE(a.testNumber, f.testNumber) AS resolvedTestNumber,
               COALESCE(a.section, f.section) AS resolvedSection
        FROM IngestAnswerCandidate a
        JOIN IngestSourceFile f ON f.id = a.sourceFileId
        WHERE a.batchId = ?
        ORDER BY a.confidence DESC, a.createdAt ASC
        """,
        (batch_id,),
    ).fetchall()
    updated = 0
    for answer in answers:
        if (
            answer["contentType"] == "FULL_PRACTICE_TEST"
            and answer["sourceKind"] == "ANSWER_KEY"
            and (answer["sourceFileId"], answer["resolvedSection"], answer["moduleLabel"]) in invalid_answer_key_groups
        ):
            continue
        where_params: list[Any] = [batch_id]
        where = "batchId = ?"
        if answer["questionExternalId"]:
            where += " AND questionExternalId = ?"
            where_params.append(answer["questionExternalId"])
        elif answer["contentType"] == "FULL_PRACTICE_TEST":
            where += """
              AND contentType = 'FULL_PRACTICE_TEST'
              AND testNumber IS ?
              AND section IS ?
              AND questionNumber IS ?
            """
            where_params.extend([answer["resolvedTestNumber"], answer["resolvedSection"], answer["questionNumber"]])
            if answer["moduleLabel"]:
                module_values = full_test_module_match_values(
                    db,
                    batch_id,
                    answer["resolvedTestNumber"],
                    answer["resolvedSection"],
                    answer["moduleLabel"],
                )
                for module_value in module_values:
                    module_where = f"{where} AND moduleLabel IS ?"
                    module_params = [*where_params, module_value]
                    target_count = full_test_answer_target_count(db, module_where, module_params)
                    if target_count != 1:
                        if target_count > 1:
                            log_full_test_answer_match_issue(db, answer, target_count, module_value)
                        continue
                    rowcount = apply_answer_update(db, answer, module_where, module_params)
                    updated += rowcount
                    if rowcount:
                        break
                continue
            unique_candidates = db.execute(
                f"""
                SELECT id
                FROM IngestQuestionCandidate
                WHERE {where}
                """,
                where_params,
            ).fetchall()
            if len(unique_candidates) != 1:
                log_full_test_answer_match_issue(db, answer, len(unique_candidates), answer["moduleLabel"])
                continue
            where = "id = ?"
            where_params = [unique_candidates[0]["id"]]
        else:
            where += """
              AND contentType IS ?
              AND section IS ?
              AND domainName IS ?
              AND topicName IS ?
              AND difficulty IS ?
              AND COALESCE(practiceSetVariant, '') = COALESCE(?, '')
              AND (questionNumber IS ? OR ? IS NULL)
            """
            where_params.extend(
                [
                    answer["contentType"],
                    answer["resolvedSection"],
                    answer["domainName"],
                    answer["topicName"],
                    answer["difficulty"],
                    answer["practiceSetVariant"],
                    answer["questionNumber"],
                    answer["questionNumber"],
                ]
            )
        updated += apply_answer_update(db, answer, where, where_params)
    return updated


class IngestPipeline:
    def __init__(self, config: IngestConfig | None = None, store: SqliteIngestStore | None = None) -> None:
        self.config = config or CONFIG
        self.store = store or SqliteIngestStore()

    def process_batch(self, batch_id: str) -> None:
        _process_batch(batch_id)


def recalc_batch(db: sqlite3.Connection, batch_id: str, status: str | None = None) -> None:
    total_files = db.execute("SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ?", (batch_id,)).fetchone()[0]
    files_processed = db.execute(
        "SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ? AND status = 'COMPLETED'",
        (batch_id,),
    ).fetchone()[0]
    total_pages = db.execute("SELECT COALESCE(SUM(pageCount), 0) FROM IngestSourceFile WHERE batchId = ?", (batch_id,)).fetchone()[0]
    pages_processed = db.execute(
        "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
        (batch_id,),
    ).fetchone()[0]
    candidates = db.execute("SELECT COUNT(*) FROM IngestQuestionCandidate WHERE batchId = ?", (batch_id,)).fetchone()[0]
    ocr_required = db.execute(
        "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'NEEDS_OCR'",
        (batch_id,),
    ).fetchone()[0]
    failed_files = db.execute(
        "SELECT COUNT(*) FROM IngestSourceFile WHERE batchId = ? AND status = 'FAILED'",
        (batch_id,),
    ).fetchone()[0]
    next_status = status or ("COMPLETED" if files_processed == total_files and ocr_required == 0 and failed_files == 0 else "NEEDS_REVIEW")
    last_error = f"{ocr_required} pages still need OCR." if ocr_required else None
    db.execute(
        """
        UPDATE IngestBatch
        SET status = ?, totalFiles = ?, filesProcessed = ?, totalPages = ?, pagesProcessed = ?,
            candidatesDetected = ?, errorCount = ?, lastError = ?, updatedAt = ?
        WHERE id = ?
        """,
        (next_status, total_files, files_processed, total_pages, pages_processed, candidates, failed_files + ocr_required, last_error, now_iso(), batch_id),
    )


def normalize_ocr_required_page_state(db: sqlite3.Connection, batch_id: str) -> int:
    db.execute(
        """
        UPDATE IngestPageArtifact
        SET requiresOcr = 0, updatedAt = ?
        WHERE batchId = ? AND method IN ('MISTRAL_OCR', 'PDF_TEXT', 'DOCX_TEXT', 'BLANK_PAGE') AND status = 'COMPLETED'
        """,
        (now_iso(), batch_id),
    )
    result = db.execute(
        """
        UPDATE IngestPageArtifact
        SET status = 'NEEDS_OCR', requiresOcr = 1, updatedAt = ?
        WHERE batchId = ? AND method = 'OCR_REQUIRED'
        """,
        (now_iso(), batch_id),
    )
    updated = result.rowcount if result.rowcount and result.rowcount > 0 else 0
    if updated:
        db.execute(
            """
            UPDATE IngestIncident
            SET status = 'OPEN'
            WHERE batchId = ? AND code = 'PAGE_OCR_REQUIRED'
              AND pageArtifactId IN (
                SELECT id FROM IngestPageArtifact WHERE batchId = ? AND method = 'OCR_REQUIRED'
              )
            """,
            (batch_id, batch_id),
        )
    return updated


def dedupe_ingest_incidents(db: sqlite3.Connection, batch_id: str) -> int:
    before = db.execute("SELECT COUNT(*) FROM IngestIncident WHERE batchId = ?", (batch_id,)).fetchone()[0]
    db.execute(
        """
        DELETE FROM IngestIncident
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM IngestIncident
          WHERE batchId = ?
          GROUP BY batchId, COALESCE(sourceFileId, ''), COALESCE(pageArtifactId, ''), severity, code, message
        )
        AND batchId = ?
        """,
        (batch_id, batch_id),
    )
    after = db.execute("SELECT COUNT(*) FROM IngestIncident WHERE batchId = ?", (batch_id,)).fetchone()[0]
    return before - after


def reconcile_ingest_incidents(db: sqlite3.Connection, batch_id: str) -> dict[str, int]:
    deduped = dedupe_ingest_incidents(db, batch_id)

    duplicate_ids = {
        row["questionExternalId"]
        for row in db.execute(
            """
            SELECT questionExternalId
            FROM IngestQuestionCandidate
            WHERE batchId = ? AND questionExternalId IS NOT NULL AND questionExternalId <> ''
            GROUP BY questionExternalId
            HAVING COUNT(*) > 1
            """,
            (batch_id,),
        ).fetchall()
    }
    duplicate_incidents = db.execute(
        """
        SELECT id, message
        FROM IngestIncident
        WHERE batchId = ? AND status = 'OPEN' AND code = 'DUPLICATE_QUESTION_EXTERNAL_ID'
        """,
        (batch_id,),
    ).fetchall()
    stale_duplicate_ids: list[str] = []
    for incident in duplicate_incidents:
        match = re.search(r"Question ID\s+([A-Fa-f0-9]+)", incident["message"] or "")
        if not match or match.group(1).lower() not in duplicate_ids:
            stale_duplicate_ids.append(incident["id"])
    if stale_duplicate_ids:
        placeholders = ",".join("?" for _ in stale_duplicate_ids)
        db.execute(
            f"""
            UPDATE IngestIncident
            SET status = 'RESOLVED'
            WHERE id IN ({placeholders})
            """,
            stale_duplicate_ids,
        )

    stale_conflict_ids: list[str] = []
    conflict_incidents = db.execute(
        """
        SELECT id, message
        FROM IngestIncident
        WHERE batchId = ? AND status = 'OPEN' AND code = 'FULL_TEST_ANSWER_CONFLICT'
        """,
        (batch_id,),
    ).fetchall()
    for incident in conflict_incidents:
        match = re.search(r"candidate\s+([A-Za-z0-9_]+):\s+existing\s+.+?\s+vs\s+parsed\s+(.+?)\.", incident["message"] or "")
        if not match:
            continue
        candidate = db.execute(
            "SELECT correctAnswer FROM IngestQuestionCandidate WHERE id = ?",
            (match.group(1),),
        ).fetchone()
        parsed_answer = clean_answer_value(match.group(2))
        if not candidate or (parsed_answer and candidate["correctAnswer"] == parsed_answer):
            stale_conflict_ids.append(incident["id"])
    if stale_conflict_ids:
        placeholders = ",".join("?" for _ in stale_conflict_ids)
        db.execute(
            f"""
            UPDATE IngestIncident
            SET status = 'RESOLVED',
                decision = 'Conflict is stale after rehydration; the candidate now has the parsed final answer.',
                action = 'No action required.'
            WHERE id IN ({placeholders})
            """,
            stale_conflict_ids,
        )

    docx_candidate_ready_ids: list[str] = []
    docx_candidate_incidents = db.execute(
        """
        SELECT id, sourceFileId, message
        FROM IngestIncident
        WHERE batchId = ? AND status = 'OPEN' AND code = 'FULL_TEST_DOCX_QUESTION_ONLY_CANDIDATE'
        """,
        (batch_id,),
    ).fetchall()
    for incident in docx_candidate_incidents:
        match = re.search(r"TEST\s+([0-9]+)\s+([A-Z]+)\s+module\s+(.+?)\s+Q([0-9]+)", incident["message"] or "")
        if not match:
            continue
        candidate = db.execute(
            """
            SELECT id
            FROM IngestQuestionCandidate
            WHERE batchId = ? AND sourceFileId = ? AND contentType = 'FULL_PRACTICE_TEST'
              AND testNumber IS ? AND section IS ? AND moduleLabel IS ? AND questionNumber IS ?
              AND status = 'READY' AND stem IS NOT NULL AND correctAnswer IS NOT NULL
            LIMIT 1
            """,
            (batch_id, incident["sourceFileId"], int(match.group(1)), match.group(2), match.group(3), int(match.group(4))),
        ).fetchone()
        if candidate:
            docx_candidate_ready_ids.append(incident["id"])
    if docx_candidate_ready_ids:
        placeholders = ",".join("?" for _ in docx_candidate_ready_ids)
        db.execute(
            f"""
            UPDATE IngestIncident
            SET status = 'RESOLVED',
                decision = 'DOCX-only candidate was hydrated and is ready for review/promotion.',
                action = 'No extra source file is required for this staged candidate.'
            WHERE id IN ({placeholders})
            """,
            docx_candidate_ready_ids,
        )

    duplicate_question_groups = db.execute(
        """
        SELECT testNumber, section, moduleLabel, questionNumber, COUNT(*) count,
               GROUP_CONCAT(DISTINCT sourceLabel) sourceLabels
        FROM IngestQuestionCandidate
        WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST'
          AND questionNumber IS NOT NULL AND stem IS NOT NULL
        GROUP BY testNumber, section, moduleLabel, questionNumber
        HAVING COUNT(*) > 1
        """,
        (batch_id,),
    ).fetchall()
    for group in duplicate_question_groups:
        log_ingest_incident(
            db,
            batch_id=batch_id,
            severity="WARNING",
            code="FULL_TEST_DUPLICATE_QUESTION_NUMBER",
            message=(
                f"TEST {group['testNumber']} {group['section']} module {group['moduleLabel']} "
                f"has {group['count']} candidates for Q{group['questionNumber']}."
            ),
            decision="Answers for this question number are not applied automatically unless the target is unique.",
            action=f"Review duplicate candidates from: {group['sourceLabels']}",
        )

    section_answer_key_rows = db.execute(
        """
        SELECT i.id, i.sourceFileId, f.relativePath,
               COUNT(a.id) answerCount,
               COUNT(DISTINCT a.section) sectionCount
        FROM IngestIncident i
        JOIN IngestSourceFile f ON f.id = i.sourceFileId
        LEFT JOIN IngestAnswerCandidate a ON a.sourceFileId = f.id AND a.section IN ('MATH', 'RW')
        WHERE i.batchId = ? AND i.status = 'OPEN'
          AND i.code = 'FULL_TEST_SECTION_UNRESOLVED'
          AND f.sourceKind = 'ANSWER_KEY'
        GROUP BY i.id, i.sourceFileId, f.relativePath
        HAVING answerCount > 0 AND sectionCount > 0
        """,
        (batch_id,),
    ).fetchall()
    section_answer_key_ids = [row["id"] for row in section_answer_key_rows]
    if section_answer_key_ids:
        placeholders = ",".join("?" for _ in section_answer_key_ids)
        db.execute(
            f"""
            UPDATE IngestIncident
            SET status = 'RESOLVED',
                decision = 'Answer key is global/multi-section; section mapping was resolved from parsed answer columns.',
                action = 'No source-level section is required. Use parsed answer candidates by section during promotion.'
            WHERE id IN ({placeholders})
            """,
            section_answer_key_ids,
        )

    unresolved_answer_key_rows = db.execute(
        """
        SELECT i.id, f.relativePath, f.testNumber
        FROM IngestIncident i
        JOIN IngestSourceFile f ON f.id = i.sourceFileId
        LEFT JOIN IngestAnswerCandidate a ON a.sourceFileId = f.id
        WHERE i.batchId = ? AND i.status = 'OPEN'
          AND i.code = 'FULL_TEST_SECTION_UNRESOLVED'
          AND f.sourceKind = 'ANSWER_KEY'
        GROUP BY i.id, f.relativePath, f.testNumber
        HAVING COUNT(a.id) = 0
        """,
        (batch_id,),
    ).fetchall()
    for row in unresolved_answer_key_rows:
        db.execute(
            """
            UPDATE IngestIncident
            SET decision = ?,
                action = ?
            WHERE id = ?
            """,
            (
                "Global answer key source exists, but the current parser could not convert its table/text into section answer candidates.",
                f"Cannot auto-resolve with current parser. Review or normalize this file: {row['relativePath']}",
                row["id"],
            ),
        )

    section_result = db.execute(
        """
        UPDATE IngestIncident
        SET status = 'RESOLVED'
        WHERE batchId = ? AND status = 'OPEN' AND code = 'FULL_TEST_SECTION_UNRESOLVED'
          AND sourceFileId IN (
            SELECT id FROM IngestSourceFile
            WHERE batchId = ? AND section IS NOT NULL
          )
        """,
        (batch_id, batch_id),
    )
    stale_sections = section_result.rowcount if section_result.rowcount and section_result.rowcount > 0 else 0

    duplicate_source_rows = db.execute(
        """
        SELECT i.id, i.sourceFileId, f.hash, f.relativePath
        FROM IngestIncident i
        JOIN IngestSourceFile f ON f.id = i.sourceFileId
        WHERE i.batchId = ? AND i.status = 'OPEN' AND i.code = 'FULL_TEST_DUPLICATE_SOURCE'
          AND EXISTS (
            SELECT 1 FROM IngestSourceFile canonical
            WHERE canonical.batchId = i.batchId
              AND canonical.id != f.id
              AND canonical.hash = f.hash
          )
        """,
        (batch_id,),
    ).fetchall()
    duplicate_source_ids = [row["id"] for row in duplicate_source_rows]
    if duplicate_source_ids:
        placeholders = ",".join("?" for _ in duplicate_source_ids)
        db.execute(
            f"""
            UPDATE IngestIncident
            SET status = 'RESOLVED',
                decision = 'Duplicate source confirmed by identical content hash; canonical source is retained.',
                action = 'Duplicate is excluded from promotion; no additional source file is required.'
            WHERE id IN ({placeholders})
            """,
            duplicate_source_ids,
        )

    missing_key_rows = db.execute(
        """
        SELECT i.id, i.message
        FROM IngestIncident i
        WHERE i.batchId = ? AND i.status = 'OPEN' AND i.code = 'FULL_TEST_ANSWER_KEY_MISSING'
        """,
        (batch_id,),
    ).fetchall()
    for incident in missing_key_rows:
        match = re.search(r"TEST\s+([0-9]+)", incident["message"] or "", re.IGNORECASE)
        if not match:
            continue
        test_number = int(match.group(1))
        related = db.execute(
            """
            SELECT relativePath, sourceKind, section
            FROM IngestSourceFile
            WHERE batchId = ? AND contentType = 'FULL_PRACTICE_TEST' AND testNumber = ?
            ORDER BY
              CASE sourceKind
                WHEN 'ANSWER_KEY' THEN 0
                WHEN 'ANSWER_EXPLANATION' THEN 1
                WHEN 'MOCK_EXAM' THEN 2
                ELSE 3
              END,
              relativePath
            """,
            (batch_id, test_number),
        ).fetchall()
        related_labels: list[str] = []
        for row in related:
            section_suffix = f"/{row['section']}" if row["section"] else ""
            related_labels.append(f"{row['relativePath']} ({row['sourceKind']}{section_suffix})")
        related_paths = "; ".join(related_labels)
        db.execute(
            """
            UPDATE IngestIncident
            SET decision = ?,
                action = ?
            WHERE id = ?
            """,
            (
                "No global answer key file is present. Existing explanations/questions are tracked, but score-key validation is incomplete.",
                f"Needs source file: add the missing TEST {test_number} answer key or improve explanation parsing. Related files: {related_paths}",
                incident["id"],
            ),
        )

    section_deduped = 0
    duplicates = db.execute(
        """
        SELECT MIN(id) keepId, GROUP_CONCAT(id) ids, COUNT(*) count
        FROM IngestIncident
        WHERE batchId = ? AND status = 'OPEN' AND code = 'FULL_TEST_SECTION_UNRESOLVED'
        GROUP BY batchId, code, COALESCE(sourceFileId, ''), COALESCE(pageArtifactId, ''), message
        HAVING COUNT(*) > 1
        """,
        (batch_id,),
    ).fetchall()
    for group in duplicates:
        ids = [value for value in (group["ids"] or "").split(",") if value and value != group["keepId"]]
        if not ids:
            continue
        placeholders = ",".join("?" for _ in ids)
        db.execute(f"DELETE FROM IngestIncident WHERE id IN ({placeholders})", ids)
        section_deduped += len(ids)

    return {
        "incidentsDeduped": deduped + section_deduped,
        "staleDuplicateIncidentsResolved": len(stale_duplicate_ids),
        "staleAnswerConflictIncidentsResolved": len(stale_conflict_ids),
        "staleSectionIncidentsResolved": stale_sections,
        "docxQuestionOnlyIncidentsResolved": len(docx_candidate_ready_ids),
        "globalAnswerKeyIncidentsResolved": len(section_answer_key_ids),
        "duplicateSourceIncidentsResolved": len(duplicate_source_ids),
        "missingAnswerKeyIncidentsEnriched": len(missing_key_rows),
        "unresolvedAnswerKeyIncidentsEnriched": len(unresolved_answer_key_rows),
        "incidentsResolved": (
            len(stale_duplicate_ids)
            + len(stale_conflict_ids)
            + len(docx_candidate_ready_ids)
            + stale_sections
            + len(section_answer_key_ids)
            + len(duplicate_source_ids)
        ),
    }


def repair_batch(batch_id: str) -> dict[str, int]:
    with conn() as db:
        init_db()
        ocr_state_normalized = normalize_ocr_required_page_state(db, batch_id)
        normalized = normalize_batch_metadata(db, batch_id)
        pages = db.execute(
            """
            SELECT p.*, f.batchId AS fileBatchId, f.path, f.relativePath, f.contentType, f.sourceKind, f.section, f.domainName,
                   f.topicName, f.difficulty, f.difficultySource, f.practiceSetVariant, f.isAnswerFile, f.id AS fileId
                   , f.testNumber
            FROM IngestPageArtifact p
            JOIN IngestSourceFile f ON f.id = p.sourceFileId
            WHERE p.batchId = ? AND p.status = 'COMPLETED'
            ORDER BY f.relativePath, p.pageNumber
            """,
            (batch_id,),
        ).fetchall()
        db.execute("DELETE FROM IngestCandidateImageLink WHERE batchId = ?", (batch_id,))
        db.execute("DELETE FROM IngestQuestionCandidate WHERE batchId = ?", (batch_id,))
        db.execute("DELETE FROM IngestAnswerCandidate WHERE batchId = ?", (batch_id,))
        db.execute("DELETE FROM IngestImageArtifact WHERE batchId = ?", (batch_id,))
        candidates = 0
        answers = 0
        images = 0
        image_links = 0
        module_context_by_source: dict[str, str | None] = {}
        for page in pages:
            meta = {
                "batchId": batch_id,
                "id": page["sourceFileId"],
                "relativePath": page["relativePath"],
                "contentType": page["contentType"],
                "sourceKind": page["sourceKind"],
                "section": page["section"],
                "domainName": page["domainName"],
                "topicName": page["topicName"],
                "difficulty": page["difficulty"],
                "difficultySource": page["difficultySource"],
                "practiceSetVariant": page["practiceSetVariant"],
                "testNumber": page["testNumber"],
                "isAnswerFile": page["isAnswerFile"],
            }
            layout = json.loads(page["layoutJson"]) if page["layoutJson"] else None
            ocr_payload = None
            if page["contentHash"]:
                cache_row = db.execute(
                    "SELECT responseJson FROM IngestOcrCache WHERE contentHash = ? AND model = ?",
                    (page["contentHash"], OCR_MODEL),
                ).fetchone()
                if cache_row:
                    ocr_payload = json.loads(cache_row["responseJson"])
            source_path = Path(page["path"]) if "path" in page.keys() and page["path"] else None
            images += insert_image_artifacts(db, batch_id, page["sourceFileId"], source_path, page["id"], page["pageNumber"], layout, ocr_payload)
            text = page["extractedText"] or ""
            inferred_section = None
            if meta["contentType"] == "FULL_PRACTICE_TEST" and meta["section"] is None:
                inferred_section = infer_full_test_section_from_text(text)
            if inferred_section:
                section_label = "MATH" if inferred_section == "MATH" else "READING AND WRITING"
                test_match = re.search(r"TEST\s*([0-9]+)", meta["relativePath"], re.IGNORECASE)
                meta["section"] = inferred_section
                meta["topicName"] = f"TEST {test_match.group(1)} {section_label}" if test_match else f"FULL PRACTICE TEST {section_label}"
                update_source_metadata(
                    db,
                    meta["id"],
                    section=inferred_section,
                    topic_name=meta["topicName"],
                    warnings=metadata_warnings(None) + [f"Full Practice Test section inferred from extracted content: {section_label}."],
                )
            refined_meta = refine_practice_source_metadata_from_text(db, meta, text)
            if refined_meta:
                meta = refined_meta
            current_module = module_context_by_source.get(page["sourceFileId"])
            for candidate in make_candidates_from_text(text, meta, page["id"], default_module_label=current_module):
                insert_candidate(db, candidate)
                candidates += 1
            image_links += link_markdown_images_for_page(db, batch_id, page["id"])
            if meta["contentType"] == "FULL_PRACTICE_TEST" and (page_module := last_module_heading(text)):
                module_context_by_source[page["sourceFileId"]] = page_module
            if bool(page["isAnswerFile"]) or "Correct Answer" in text:
                page_layout = layout if isinstance(layout, dict) else None
                answers += insert_answer_candidates(db, text, meta, page["id"], page_layout)
                candidates += create_missing_full_test_candidates_from_docx_answers(db, meta, page["id"], page_layout)
        content_inferred = infer_missing_source_metadata_from_pages(db, batch_id)
        full_test_inferred = infer_full_test_metadata_from_pages(db, batch_id)
        modules_normalized = normalize_full_test_candidate_modules(db, batch_id)
        extra_practice_removed = remove_full_test_extra_practice_candidates(db, batch_id)
        enriched = enrich_candidates_from_answers(db, batch_id)
        renumbered = assign_sequential_numbers(db, batch_id)
        incident_reconciliation = reconcile_ingest_incidents(db, batch_id)
        recalc_batch(db, batch_id)
        return {
            "pages": len(pages),
            "candidates": candidates,
            "renumbered": renumbered,
            "answers": answers,
            "images": images,
            "imageLinks": image_links,
            "modulesNormalized": modules_normalized,
            "extraPracticeRemoved": extra_practice_removed,
            "ocrStatesNormalized": ocr_state_normalized,
            "enriched": enriched,
            **incident_reconciliation,
            **normalized,
            **content_inferred,
            **full_test_inferred,
        }


def rehydrate_full_test_docx_sources(
    batch_id: str,
    *,
    test_number: int | None = None,
    source_file_id: str | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    with conn() as db:
        init_db()
        where = "batchId = ? AND contentType = 'FULL_PRACTICE_TEST' AND extension = 'docx'"
        params: list[Any] = [batch_id]
        if test_number is not None:
            where += " AND testNumber = ?"
            params.append(test_number)
        if source_file_id is not None:
            where += " AND id = ?"
            params.append(source_file_id)
        sources = db.execute(
            f"""
            SELECT *
            FROM IngestSourceFile
            WHERE {where}
            ORDER BY relativePath
            """,
            params,
        ).fetchall()
        if dry_run:
            extracted_pages = 0
            answer_rows = 0
            for source in sources:
                extracted = extract_docx(resolve_existing_source_path(source["path"]))
                extracted_pages += len(extracted)
                for page in extracted:
                    layout = page.get("layout") if isinstance(page.get("layout"), dict) else None
                    if source["contentType"] == "FULL_PRACTICE_TEST" and source["isAnswerFile"]:
                        columns = docx_table_answer_key_columns(layout.get("docxTables") or [], source) if layout else []
                        rows = docx_explanation_answer_rows(layout, source)
                        answer_rows += sum(len(column["answers"]) for column in columns) + len(rows)
            return {"sources": len(sources), "pages": extracted_pages, "answers": answer_rows, "dryRun": 1}

        started_at = time.monotonic()
        started_processed_pages = db.execute(
            "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
            (batch_id,),
        ).fetchone()[0]
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            job_type="REHYDRATE_FULL_TEST_DOCX",
            status="STARTED",
            message="Full Practice Test DOCX rehydration started.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
            metadata={"testNumber": test_number, "sourceFileId": source_file_id},
        )
        db.commit()
        pages = 0
        answers = 0
        candidates = 0
        for source in sources:
            path = resolve_existing_source_path(source["path"])
            extracted = extract_docx(path)
            db.execute("DELETE FROM IngestAnswerCandidate WHERE sourceFileId = ?", (source["id"],))
            if source["sourceKind"] == "MOCK_EXAM":
                db.execute("DELETE FROM IngestQuestionCandidate WHERE sourceFileId = ?", (source["id"],))
            db.execute(
                "DELETE FROM IngestPageArtifact WHERE sourceFileId = ? AND pageNumber > ?",
                (source["id"], len(extracted)),
            )
            source_meta: sqlite3.Row | dict[str, Any] = source
            module_context_by_source: dict[str, str | None] = {}
            for page in extracted:
                text = page.get("text", "") or ""
                existing_page = db.execute(
                    "SELECT id FROM IngestPageArtifact WHERE sourceFileId = ? AND pageNumber = ?",
                    (source["id"], page["page"]),
                ).fetchone()
                page_id = existing_page["id"] if existing_page else new_id("page")
                content_hash = text_hash(text, f"{source['hash']}:{page['page']}")
                layout = page.get("layout") if isinstance(page.get("layout"), dict) else {"imageCount": page.get("imageCount", 0)}
                db.execute(
                    """
                    INSERT OR REPLACE INTO IngestPageArtifact
                      (id, batchId, sourceFileId, pageNumber, method, textDensity, extractedText, layoutJson, contentHash, requiresOcr, status, warning, updatedAt)
                    VALUES (?, ?, ?, ?, 'DOCX_TEXT', ?, ?, ?, ?, 0, 'COMPLETED', NULL, ?)
                    """,
                    (
                        page_id,
                        batch_id,
                        source["id"],
                        page["page"],
                        float(page.get("density", 0)),
                        text,
                        json.dumps(layout),
                        content_hash,
                        now_iso(),
                    ),
                )
                source_meta: sqlite3.Row | dict[str, Any] = source
                if source["contentType"] == "FULL_PRACTICE_TEST" and source["section"] is None:
                    inferred_section = infer_full_test_section_from_text(text)
                    if inferred_section:
                        section_label = "MATH" if inferred_section == "MATH" else "READING AND WRITING"
                        test_label = f"TEST {source['testNumber']}" if source["testNumber"] else "FULL PRACTICE TEST"
                        source_meta = dict(source)
                        source_meta["section"] = inferred_section
                        source_meta["topicName"] = f"{test_label} {section_label}"
                        update_source_metadata(
                            db,
                            source["id"],
                            section=inferred_section,
                            topic_name=source_meta["topicName"],
                            warnings=metadata_warnings(source["metadataWarningsJson"])
                            + [f"Full Practice Test section inferred from extracted content: {section_label}."],
                        )
                refined_meta = refine_practice_source_metadata_from_text(db, source_meta, text)
                if refined_meta:
                    source_meta = refined_meta
                current_module = module_context_by_source.get(source["id"])
                for candidate in make_candidates_from_text(text, source_meta, page_id, default_module_label=current_module):
                    insert_candidate(db, candidate)
                    candidates += 1
                if source["contentType"] == "FULL_PRACTICE_TEST" and (page_module := last_module_heading(text)):
                    module_context_by_source[source["id"]] = page_module
                if bool(source["isAnswerFile"]) or "Correct Answer" in text:
                    answers += insert_answer_candidates(db, text, source_meta, page_id, layout)
                    candidates += create_missing_full_test_candidates_from_docx_answers(db, source_meta, page_id, layout)
                pages += 1
            db.execute(
                "UPDATE IngestSourceFile SET pageCount = ?, status = 'COMPLETED', updatedAt = ? WHERE id = ?",
                (len(extracted), now_iso(), source["id"]),
            )
            log_ingest_job_event(
                db,
                batch_id=batch_id,
                source_file_id=source["id"],
                job_type="REHYDRATE_FULL_TEST_DOCX",
                status="RUNNING",
                message=f"Rehydrated DOCX source {source['relativePath']}.",
                started_at=started_at,
                started_processed_pages=started_processed_pages,
                metadata={"pages": len(extracted)},
            )
            db.commit()
        normalize_batch_metadata(db, batch_id)
        infer_missing_source_metadata_from_pages(db, batch_id)
        infer_full_test_metadata_from_pages(db, batch_id)
        modules_normalized = normalize_full_test_candidate_modules(db, batch_id, source_file_id)
        extra_practice_removed = remove_full_test_extra_practice_candidates(db, batch_id, source_file_id)
        enriched = enrich_candidates_from_answers(db, batch_id)
        assign_sequential_numbers(db, batch_id)
        incident_reconciliation = reconcile_ingest_incidents(db, batch_id)
        recalc_batch(db, batch_id)
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            job_type="REHYDRATE_FULL_TEST_DOCX",
            status="COMPLETED",
            message="Full Practice Test DOCX rehydration completed.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
            metadata={"sources": len(sources), "pages": pages, "answers": answers, "candidates": candidates, "enriched": enriched},
        )
        db.commit()
        return {
            "sources": len(sources),
            "pages": pages,
            "answers": answers,
            "candidates": candidates,
            "modulesNormalized": modules_normalized,
            "extraPracticeRemoved": extra_practice_removed,
            "enriched": enriched,
            **incident_reconciliation,
        }


def materialize_completed_page(
    db: sqlite3.Connection,
    page: sqlite3.Row,
    module_context_by_source: dict[str, str | None],
) -> dict[str, int]:
    meta = {
        "batchId": page["batchId"],
        "id": page["sourceFileId"],
        "relativePath": page["relativePath"],
        "contentType": page["contentType"],
        "sourceKind": page["sourceKind"],
        "section": page["section"],
        "domainName": page["domainName"],
        "topicName": page["topicName"],
        "difficulty": page["difficulty"],
        "difficultySource": page["difficultySource"],
        "practiceSetVariant": page["practiceSetVariant"],
        "testNumber": page["testNumber"],
        "isAnswerFile": page["isAnswerFile"],
        "metadataWarningsJson": page["metadataWarningsJson"] if "metadataWarningsJson" in page.keys() else None,
    }
    layout = json.loads(page["layoutJson"]) if page["layoutJson"] else None
    ocr_payload = None
    if page["contentHash"]:
        cache_row = db.execute(
            "SELECT responseJson FROM IngestOcrCache WHERE contentHash = ? AND model = ?",
            (page["contentHash"], OCR_MODEL),
        ).fetchone()
        if cache_row:
            ocr_payload = json.loads(cache_row["responseJson"])
    source_path = Path(page["path"]) if page["path"] else None
    images = insert_image_artifacts(db, page["batchId"], page["sourceFileId"], source_path, page["id"], page["pageNumber"], layout, ocr_payload)
    text = page["extractedText"] or ""
    inferred_section = None
    if meta["contentType"] == "FULL_PRACTICE_TEST" and meta["section"] is None:
        inferred_section = infer_full_test_section_from_text(text)
    if inferred_section:
        section_label = "MATH" if inferred_section == "MATH" else "READING AND WRITING"
        test_match = re.search(r"TEST\s*([0-9]+)", meta["relativePath"], re.IGNORECASE)
        meta["section"] = inferred_section
        meta["topicName"] = f"TEST {test_match.group(1)} {section_label}" if test_match else f"FULL PRACTICE TEST {section_label}"
        update_source_metadata(
            db,
            meta["id"],
            section=inferred_section,
            topic_name=meta["topicName"],
            warnings=metadata_warnings(None) + [f"Full Practice Test section inferred from extracted content: {section_label}."],
        )
    refined_meta = refine_practice_source_metadata_from_text(db, meta, text)
    if refined_meta:
        meta = refined_meta
    current_module = module_context_by_source.get(page["sourceFileId"])
    candidates = 0
    for candidate in make_candidates_from_text(text, meta, page["id"], default_module_label=current_module):
        insert_candidate(db, candidate)
        candidates += 1
    image_links = link_markdown_images_for_page(db, page["batchId"], page["id"])
    if meta["contentType"] == "FULL_PRACTICE_TEST" and (page_module := last_module_heading(text)):
        module_context_by_source[page["sourceFileId"]] = page_module
    answers = 0
    if bool(page["isAnswerFile"]) or "Correct Answer" in text:
        page_layout = layout if isinstance(layout, dict) else None
        answers += insert_answer_candidates(db, text, meta, page["id"], page_layout)
        candidates += create_missing_full_test_candidates_from_docx_answers(db, meta, page["id"], page_layout)
    return {"candidates": candidates, "answers": answers, "images": images, "imageLinks": image_links}


def retry_ocr_required(batch_id: str, limit: int = 100, source_file_id: str | None = None) -> dict[str, int]:
    with conn() as db:
        init_db()
        started_at = time.monotonic()
        started_processed_pages = db.execute(
            "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
            (batch_id,),
        ).fetchone()[0]
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            source_file_id=source_file_id,
            job_type="RETRY_OCR",
            status="STARTED",
            message="OCR retry started.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
            metadata={"limit": limit},
        )
        db.commit()
        where = "p.batchId = ? AND p.method = 'OCR_REQUIRED'"
        params: list[Any] = [batch_id]
        if source_file_id:
            where += " AND p.sourceFileId = ?"
            params.append(source_file_id)
        params.append(limit)
        rows = db.execute(
            f"""
            SELECT p.*, f.path, f.hash, f.relativePath, f.contentType, f.sourceKind, f.section, f.domainName,
                   f.topicName, f.difficulty, f.difficultySource, f.practiceSetVariant, f.isAnswerFile,
                   f.testNumber
            FROM IngestPageArtifact p
            JOIN IngestSourceFile f ON f.id = p.sourceFileId
            WHERE {where}
            ORDER BY f.relativePath, p.pageNumber
            LIMIT ?
            """,
            params,
        ).fetchall()
        fixed = 0
        still_required = 0
        candidates = 0
        answers = 0
        images = 0
        module_context_by_source: dict[str, str | None] = {}
        for index, row in enumerate(rows, start=1):
            ocr_text, payload = run_mistral_ocr(Path(row["path"]), int(row["pageNumber"]))
            if ocr_text:
                db.execute(
                    "INSERT OR IGNORE INTO IngestOcrCache (id, contentHash, model, responseJson, text, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                    (new_id("ocr"), row["contentHash"], OCR_MODEL, json.dumps(payload), ocr_text, now_iso()),
                )
                db.execute(
                    """
                    UPDATE IngestPageArtifact
                    SET method = 'MISTRAL_OCR', status = 'COMPLETED', requiresOcr = 0,
                        extractedText = ?, warning = NULL, updatedAt = ?
                    WHERE id = ?
                    """,
                    (ocr_text, now_iso(), row["id"]),
                )
                db.execute(
                    """
                    UPDATE IngestIncident
                    SET status = 'RESOLVED'
                    WHERE batchId = ? AND pageArtifactId = ? AND code = 'PAGE_OCR_REQUIRED'
                    """,
                    (batch_id, row["id"]),
                )
                refreshed = db.execute(
                    """
                    SELECT p.*, f.path, f.hash, f.relativePath, f.contentType, f.sourceKind, f.section, f.domainName,
                           f.topicName, f.difficulty, f.difficultySource, f.practiceSetVariant, f.isAnswerFile,
                           f.testNumber
                    FROM IngestPageArtifact p
                    JOIN IngestSourceFile f ON f.id = p.sourceFileId
                    WHERE p.id = ?
                    """,
                    (row["id"],),
                ).fetchone()
                if refreshed:
                    materialized = materialize_completed_page(db, refreshed, module_context_by_source)
                    candidates += materialized["candidates"]
                    answers += materialized["answers"]
                    images += materialized["images"]
                fixed += 1
            else:
                if payload.get("blankPage") or is_pdf_page_blank(Path(row["path"]), int(row["pageNumber"])):
                    db.execute(
                        """
                        UPDATE IngestPageArtifact
                        SET method = 'BLANK_PAGE', status = 'COMPLETED', requiresOcr = 0,
                            extractedText = '', warning = ?, updatedAt = ?
                        WHERE id = ?
                        """,
                        (payload.get("warning") or "Blank page detected before OCR.", now_iso(), row["id"]),
                    )
                    db.execute(
                        """
                        UPDATE IngestIncident
                        SET status = 'RESOLVED'
                        WHERE batchId = ? AND pageArtifactId = ? AND code = 'PAGE_OCR_REQUIRED'
                        """,
                        (batch_id, row["id"]),
                    )
                    fixed += 1
                    db.commit()
                    continue
                db.execute(
                    "UPDATE IngestPageArtifact SET status = 'NEEDS_OCR', warning = ?, updatedAt = ? WHERE id = ?",
                    (payload.get("warning"), now_iso(), row["id"]),
                )
                still_required += 1
            db.commit()
            log_ingest_job_event(
                db,
                batch_id=batch_id,
                source_file_id=row["sourceFileId"],
                page_artifact_id=row["id"],
                job_type="RETRY_OCR",
                status="RUNNING",
                message=f"OCR retry {index}/{len(rows)} processed for page {row['pageNumber']}.",
                started_at=started_at,
                started_processed_pages=started_processed_pages,
                metadata={"attempted": index, "fixed": fixed, "stillRequired": still_required},
            )
            db.commit()
        recalc_batch(db, batch_id)
        if fixed:
            infer_missing_source_metadata_from_pages(db, batch_id, source_file_id)
            infer_full_test_metadata_from_pages(db, batch_id, source_file_id)
            normalize_full_test_candidate_modules(db, batch_id, source_file_id)
            remove_full_test_extra_practice_candidates(db, batch_id, source_file_id)
            enrich_candidates_from_answers(db, batch_id)
            recalc_batch(db, batch_id)
        incident_reconciliation = reconcile_ingest_incidents(db, batch_id)
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            source_file_id=source_file_id,
            job_type="RETRY_OCR",
            status="COMPLETED",
            message="OCR retry completed.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
            metadata={"attempted": len(rows), "fixed": fixed, "stillRequired": still_required, "candidates": candidates, "answers": answers, "images": images},
        )
        db.commit()
        return {
            "attempted": len(rows),
            "fixed": fixed,
            "stillRequired": still_required,
            "candidates": candidates,
            "answers": answers,
            "images": images,
            **incident_reconciliation,
        }


def parse_candidate_option_image(candidate_id: str, image_artifact_id: str) -> dict[str, Any]:
    with conn() as db:
        init_db()
        candidate = db.execute("SELECT * FROM IngestQuestionCandidate WHERE id = ?", (candidate_id,)).fetchone()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found.")
        image = db.execute("SELECT * FROM IngestImageArtifact WHERE id = ?", (image_artifact_id,)).fetchone()
        if not image or image["batchId"] != candidate["batchId"]:
            raise HTTPException(status_code=404, detail="Image not found for this candidate batch.")

        image_base64 = image["base64Data"]
        if not image_base64 and image["fileUrl"]:
            asset_prefix = f"{PUBLIC_UPLOAD_URL_PREFIX}/{image['batchId']}/"
            if image["fileUrl"].startswith(asset_prefix):
                file_name = image["fileUrl"][len(asset_prefix) :]
                root = (PUBLIC_UPLOAD_ROOT / image["batchId"]).resolve()
                path = (root / file_name).resolve()
                if str(path).startswith(str(root)) and path.exists():
                    image_base64 = base64.b64encode(path.read_bytes()).decode("utf-8")
        if not image_base64:
            raise HTTPException(status_code=400, detail="Image has no fileUrl/base64Data available for OCR.")

        text, payload = MistralOcrClient(IngestConfig.from_env()).process_image_base64(image_base64, image["mimeType"])
        options = extract_options_from_image_ocr(text or "")
        if len(options) != 4:
            log_ingest_incident(
                db,
                batch_id=candidate["batchId"],
                source_file_id=candidate["sourceFileId"],
                page_artifact_id=candidate["pageArtifactId"],
                severity="WARNING",
                code="OPTION_IMAGE_OCR_UNRESOLVED",
                message=f"Could not parse A-D options from image {image_artifact_id} for candidate {candidate_id}.",
                decision="The image OCR completed, but did not produce four reliable option rows.",
                action="Review the linked option image manually and transcribe A-D options in the staging editor.",
            )
            db.commit()
            return {"candidateId": candidate_id, "imageArtifactId": image_artifact_id, "options": [], "text": text, "warning": payload.get("warning") or "A-D options not detected."}

        warnings = [warning for warning in json.loads(candidate["warningsJson"] or "[]") if "image-backed" not in str(warning)]
        status = "READY" if candidate["correctAnswer"] else "NEEDS_REVIEW"
        db.execute(
            """
            UPDATE IngestQuestionCandidate
            SET type = 'MC', optionsJson = ?, warningsJson = ?, status = ?, updatedAt = ?
            WHERE id = ?
            """,
            (json.dumps(options), json.dumps(warnings), status, now_iso(), candidate_id),
        )
        db.execute(
            """
            INSERT OR IGNORE INTO IngestCandidateImageLink
              (id, batchId, candidateId, imageArtifactId, targetType, optionLabel, sortOrder, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'OPTION_BLOCK', NULL, 0, ?, ?)
            """,
            (new_id("imglink"), candidate["batchId"], candidate_id, image_artifact_id, now_iso(), now_iso()),
        )
        log_ingest_job_event(
            db,
            batch_id=candidate["batchId"],
            source_file_id=candidate["sourceFileId"],
            page_artifact_id=candidate["pageArtifactId"],
            job_type="OPTION_IMAGE_OCR",
            status="COMPLETED",
            message=f"Parsed A-D options from image for candidate {candidate_id}.",
            metadata={"candidateId": candidate_id, "imageArtifactId": image_artifact_id, "options": options},
        )
        recalc_batch(db, candidate["batchId"])
        db.commit()
        return {"candidateId": candidate_id, "imageArtifactId": image_artifact_id, "options": options, "text": text, "status": status}


def _normalize_match_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (value or "").lower())).strip()


def link_docx_full_test_candidate_images(db: sqlite3.Connection, batch_id: str, source_file_id: str | None = None) -> int:
    """Attach the OCR'd page screenshot to each image-only mock DOCX candidate.

    Candidates for image-only FULL_PRACTICE_TEST DOCX come from the answer spine and
    carry a prompt but no options/passage (those live inside the page screenshots).
    Here we match each candidate's prompt to the page whose OCR text contains it and
    link that page's image as STEM so promotion renders the full question image.
    Idempotent: skips candidates that already have a STEM link.
    """
    source_filter = "AND f.extension = 'docx' AND f.contentType = 'FULL_PRACTICE_TEST'"
    params: list[Any] = [batch_id]
    if source_file_id:
        source_filter += " AND f.id = ?"
        params.append(source_file_id)
    sources = db.execute(
        f"SELECT f.id, f.testNumber, f.section FROM IngestSourceFile f WHERE f.batchId = ? AND f.isQuestionSource = 1 {source_filter}",
        params,
    ).fetchall()
    linked = 0
    for source in sources:
        pages = db.execute(
            """
            SELECT p.id AS pageId, p.extractedText,
                   (SELECT i.id FROM IngestImageArtifact i WHERE i.pageArtifactId = p.id ORDER BY i.imageIndex LIMIT 1) AS imageId
            FROM IngestPageArtifact p
            WHERE p.sourceFileId = ? AND p.status = 'COMPLETED'
            ORDER BY p.pageNumber
            """,
            (source["id"],),
        ).fetchall()
        page_index = [(p["pageId"], p["imageId"], _normalize_match_text(p["extractedText"])) for p in pages if p["imageId"]]
        if not page_index:
            continue
        # Candidates for this test/section that still lack a STEM image link.
        candidates = db.execute(
            """
            SELECT q.id, q.stem, q.moduleLabel, q.questionNumber
            FROM IngestQuestionCandidate q
            WHERE q.batchId = ? AND q.contentType = 'FULL_PRACTICE_TEST'
              AND q.testNumber IS ? AND q.section IS ?
              AND NOT EXISTS (
                SELECT 1 FROM IngestCandidateImageLink l
                WHERE l.candidateId = q.id AND l.targetType = 'STEM'
              )
            ORDER BY q.moduleLabel, q.questionNumber
            """,
            (batch_id, source["testNumber"], source["section"]),
        ).fetchall()
        used_pages: set[str] = set()

        def _hint_tokens(stem: str | None) -> set[str]:
            # The answer-DOCX prompt carries a "[proper-noun / topic hint]" tail whose
            # distinctive tokens (names, places) usually appear in the passage OCR.
            match = re.search(r"\[([^\]]*)\]", stem or "")
            if not match:
                return set()
            return {t for t in _normalize_match_text(match.group(1)).split(" ") if len(t) > 3}

        def _prompt_head(stem: str | None) -> str:
            return _normalize_match_text(re.split(r"\[", stem or "", maxsplit=1)[0])

        unlinked = 0
        for candidate in candidates:
            best_page = None
            # Signal 1: exact prompt substring, but only trust it when it hits a single
            # page (generic prompts like "Which choice completes the text" repeat, so an
            # ambiguous multi-page hit is discarded).
            prompt = _prompt_head(candidate["stem"])
            if len(prompt) >= 25:
                hits = [(pid, iid) for pid, iid, pn in page_index if pid not in used_pages and prompt in pn]
                if len(hits) == 1:
                    best_page = hits[0]
            # Signal 2: distinctive hint tokens with a unique, strictly-best page.
            if not best_page:
                tokens = _hint_tokens(candidate["stem"])
                if len(tokens) >= 2:
                    scored = sorted(
                        ((sum(1 for t in tokens if t in pn), pid, iid) for pid, iid, pn in page_index if pid not in used_pages),
                        key=lambda row: row[0],
                        reverse=True,
                    )
                    if scored and scored[0][0] >= 2 and (len(scored) < 2 or scored[0][0] > scored[1][0]):
                        best_page = (scored[0][1], scored[0][2])
            if not best_page:
                unlinked += 1
                continue
            page_id, image_id = best_page
            used_pages.add(page_id)
            db.execute(
                """
                INSERT OR IGNORE INTO IngestCandidateImageLink
                  (id, batchId, candidateId, imageArtifactId, targetType, optionLabel, sortOrder, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 'STEM', NULL, 0, ?, ?)
                """,
                (new_id("cil"), batch_id, candidate["id"], image_id, now_iso(), now_iso()),
            )
            linked += 1

        # Candidates we couldn't confidently match keep their prompt/answer but need a
        # human to attach the right page image in the wizard — flag instead of guessing.
        if unlinked:
            log_ingest_incident(
                db,
                batch_id=batch_id,
                source_file_id=source["id"],
                severity="WARNING",
                code="DOCX_FULL_TEST_IMAGE_LINK_PENDING",
                message=f"{unlinked} TEST {source['testNumber']} {source['section']} questions from the image-only DOCX could not be auto-linked to a page image.",
                decision="These candidates keep prompt/answer but have no STEM image; their passage/options live in an unassigned page screenshot.",
                action="Assign the correct page image to each in the review wizard before promotion.",
            )
    return linked


def _process_batch(batch_id: str) -> None:
    with conn() as db:
        batch = db.execute("SELECT * FROM IngestBatch WHERE id = ?", (batch_id,)).fetchone()
        if not batch:
            return
        started_at = time.monotonic()
        started_processed_pages = db.execute(
            "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
            (batch_id,),
        ).fetchone()[0]
        db.execute("UPDATE IngestBatch SET status = 'PROCESSING', updatedAt = ? WHERE id = ?", (now_iso(), batch_id))
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            job_type="PROCESS",
            status="STARTED",
            message="Batch processing started.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
        )
        db.commit()
        sources = db.execute(
            """
            SELECT * FROM IngestSourceFile
            WHERE batchId = ?
            ORDER BY
              CASE
                WHEN extension = 'docx' THEN 0
                WHEN sourceKind != 'MOCK_EXAM' THEN 1
                ELSE 2
              END,
              relativePath
            """,
            (batch_id,),
        ).fetchall()
        pages_processed = db.execute(
            "SELECT COUNT(*) FROM IngestPageArtifact WHERE batchId = ? AND status = 'COMPLETED'",
            (batch_id,),
        ).fetchone()[0]
        candidates_detected = db.execute(
            "SELECT COUNT(*) FROM IngestQuestionCandidate WHERE batchId = ?",
            (batch_id,),
        ).fetchone()[0]
        answers_detected = 0
        total_pages = db.execute(
            "SELECT COALESCE(SUM(pageCount), 0) FROM IngestSourceFile WHERE batchId = ?",
            (batch_id,),
        ).fetchone()[0]
        errors = 0
        last_error = None
        module_context_by_source: dict[str, str | None] = {}
        for source in sources:
            if source["status"] == "COMPLETED":
                continue
            path = Path(source["path"])
            try:
                db.execute(
                    "UPDATE IngestSourceFile SET status = 'PROCESSING', updatedAt = ? WHERE id = ?",
                    (now_iso(), source["id"]),
                )
                log_ingest_job_event(
                    db,
                    batch_id=batch_id,
                    source_file_id=source["id"],
                    job_type="PROCESS",
                    status="RUNNING",
                    message=f"Opening source file {source['relativePath']}.",
                    started_at=started_at,
                    started_processed_pages=started_processed_pages,
                )
                db.commit()
                force_ocr = path.suffix.lower() == ".pdf" and source["sourceKind"] in FORCE_OCR_SOURCE_KINDS
                extracted = extract_docx(path) if path.suffix.lower() == ".docx" else extract_pdf_text(path, force_ocr=force_ocr)
                db.execute(
                    "UPDATE IngestSourceFile SET pageCount = ?, status = 'PROCESSING', updatedAt = ? WHERE id = ?",
                    (len(extracted), now_iso(), source["id"]),
                )
                total_pages = db.execute(
                    "SELECT COALESCE(SUM(pageCount), 0) FROM IngestSourceFile WHERE batchId = ?",
                    (batch_id,),
                ).fetchone()[0]
                db.execute("UPDATE IngestBatch SET totalPages = ?, updatedAt = ? WHERE id = ?", (total_pages, now_iso(), batch_id))
                log_ingest_job_event(
                    db,
                    batch_id=batch_id,
                    source_file_id=source["id"],
                    job_type="PROCESS",
                    status="RUNNING",
                    message=f"Detected {len(extracted)} pages in {source['relativePath']}.",
                    started_at=started_at,
                    started_processed_pages=started_processed_pages,
                    metadata={"detectedPages": len(extracted)},
                )
                db.commit()
                for page in extracted:
                    existing_page = db.execute(
                        "SELECT id, status FROM IngestPageArtifact WHERE sourceFileId = ? AND pageNumber = ?",
                        (source["id"], page["page"]),
                    ).fetchone()
                    if existing_page and existing_page["status"] == "COMPLETED":
                        continue
                    content_hash = text_hash(page.get("text", ""), f"{source['hash']}:{page['page']}")
                    is_blank_page = bool(page.get("blankPage"))
                    suffix = path.suffix.lower()
                    docx_ocr_image = page.get("ocrImage") if suffix == ".docx" else None
                    method = "DOCX_TEXT" if suffix == ".docx" and not docx_ocr_image else "BLANK_PAGE" if is_blank_page else "PDF_TEXT"
                    text = page.get("text", "") or ""
                    requires_ocr = bool(page.get("requiresOcr"))
                    warning = page.get("warning")
                    ocr_payload = None
                    if requires_ocr and (suffix == ".pdf" or docx_ocr_image):
                        cached = cached_ocr(db, content_hash)
                        if cached is not None:
                            text = cached
                            method = "MISTRAL_OCR"
                            cache_row = db.execute(
                                "SELECT responseJson FROM IngestOcrCache WHERE contentHash = ? AND model = ?",
                                (content_hash, OCR_MODEL),
                            ).fetchone()
                            if cache_row:
                                ocr_payload = json.loads(cache_row["responseJson"])
                        elif docx_ocr_image:
                            ocr_text, payload = run_mistral_ocr_image(docx_ocr_image["base64"], docx_ocr_image.get("mimeType"))
                        else:
                            ocr_text, payload = run_mistral_ocr(path, int(page["page"]))
                        if cached is None:
                            if ocr_text:
                                text = ocr_text
                                method = "MISTRAL_OCR"
                                ocr_payload = payload
                                db.execute(
                                    "INSERT OR IGNORE INTO IngestOcrCache (id, contentHash, model, responseJson, text, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                                    (new_id("ocr"), content_hash, OCR_MODEL, json.dumps(payload), ocr_text, now_iso()),
                                )
                            elif payload.get("blankPage"):
                                method = "BLANK_PAGE"
                                requires_ocr = False
                                is_blank_page = True
                                warning = payload.get("warning") or "Blank page detected before OCR."
                            else:
                                method = "OCR_REQUIRED"
                                warning = payload.get("warning")
                    page_id = new_id("page")
                    page_status = "NEEDS_OCR" if method == "OCR_REQUIRED" else "COMPLETED" if text or is_blank_page else "NEEDS_OCR"
                    db.execute(
                        """
                        INSERT OR REPLACE INTO IngestPageArtifact
                          (id, batchId, sourceFileId, pageNumber, method, textDensity, extractedText, layoutJson, contentHash, requiresOcr, status, warning, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            page_id,
                            batch_id,
                            source["id"],
                            page["page"],
                            method,
                            float(page.get("density", 0)),
                            text,
                            json.dumps(page.get("layout") or {"imageCount": page.get("imageCount", 0)}),
                            content_hash,
                            1 if requires_ocr else 0,
                            page_status,
                            warning,
                            now_iso(),
                        ),
                    )
                    if method == "OCR_REQUIRED":
                        log_ingest_incident(
                            db,
                            batch_id=batch_id,
                            source_file_id=source["id"],
                            page_artifact_id=page_id,
                            severity="ERROR",
                            code="PAGE_OCR_REQUIRED",
                            message=f"Page {page['page']} of {source['relativePath']} could not be processed with available text/OCR.",
                            decision="Page is kept in staging with OCR_REQUIRED status.",
                            action="Retry OCR after validating MISTRAL_API_KEY or inspect the rendered page image.",
                        )
                    elif warning:
                        log_ingest_incident(
                            db,
                            batch_id=batch_id,
                            source_file_id=source["id"],
                            page_artifact_id=page_id,
                            severity="WARNING" if method != "BLANK_PAGE" else "INFO",
                            code="PAGE_EXTRACTION_WARNING",
                            message=f"Page {page['page']} of {source['relativePath']} produced an extraction warning.",
                            decision=warning,
                            action="Review only if candidates from this file look incomplete.",
                            status="RESOLVED" if method == "BLANK_PAGE" else "OPEN",
                        )
                    insert_image_artifacts(
                        db,
                        batch_id,
                        source["id"],
                        path,
                        page_id,
                        int(page["page"]),
                        page.get("layout") or {"imageCount": page.get("imageCount", 0)},
                        ocr_payload,
                    )
                    page_meta: sqlite3.Row | dict[str, Any] = source
                    inferred_section = None
                    if source["contentType"] == "FULL_PRACTICE_TEST" and source["section"] is None:
                        inferred_section = infer_full_test_section_from_text(text)
                    if inferred_section:
                        section_label = "MATH" if inferred_section == "MATH" else "READING AND WRITING"
                        test_label = f"TEST {source['testNumber']}" if source["testNumber"] else "FULL PRACTICE TEST"
                        topic_name = f"{test_label} {section_label}"
                        page_meta = dict(source)
                        page_meta["section"] = inferred_section
                        page_meta["topicName"] = topic_name
                        update_source_metadata(
                            db,
                            source["id"],
                            section=inferred_section,
                            topic_name=topic_name,
                            warnings=metadata_warnings(source["metadataWarningsJson"])
                            + [f"Full Practice Test section inferred from extracted content: {section_label}."],
                        )
                    refined_meta = refine_practice_source_metadata_from_text(db, page_meta, text)
                    if refined_meta:
                        page_meta = refined_meta
                    current_module = module_context_by_source.get(source["id"])
                    for candidate in make_candidates_from_text(text, page_meta, page_id, default_module_label=current_module):
                        insert_candidate(db, candidate)
                        candidates_detected += 1
                    if source["contentType"] == "FULL_PRACTICE_TEST" and (page_module := last_module_heading(text)):
                        module_context_by_source[source["id"]] = page_module
                    if bool(source["isAnswerFile"]) or "Correct Answer" in text:
                        page_layout = page.get("layout") if isinstance(page.get("layout"), dict) else None
                        answers_detected += insert_answer_candidates(
                            db,
                            text,
                            page_meta,
                            page_id,
                            page_layout,
                        )
                        candidates_detected += create_missing_full_test_candidates_from_docx_answers(db, page_meta, page_id, page_layout)
                    pages_processed += 1
                    db.execute(
                        """
                        UPDATE IngestBatch
                        SET totalPages = ?, pagesProcessed = ?, candidatesDetected = ?, errorCount = ?, lastError = ?, updatedAt = ?
                        WHERE id = ?
                        """,
                        (total_pages, pages_processed, candidates_detected, errors, last_error, now_iso(), batch_id),
                    )
                    if pages_processed % 10 == 0 or (extracted and page["page"] == extracted[-1]["page"]):
                        log_ingest_job_event(
                            db,
                            batch_id=batch_id,
                            source_file_id=source["id"],
                            page_artifact_id=page_id,
                            job_type="PROCESS",
                            status="RUNNING",
                            message=f"Processed page {page['page']} of {source['relativePath']}.",
                            started_at=started_at,
                            started_processed_pages=started_processed_pages,
                            metadata={"method": method, "requiresOcr": requires_ocr},
                        )
                db.commit()
                db.execute("UPDATE IngestSourceFile SET status = 'COMPLETED', updatedAt = ? WHERE id = ?", (now_iso(), source["id"]))
                infer_missing_source_metadata_from_pages(db, batch_id, source["id"])
                infer_full_test_metadata_from_pages(db, batch_id, source["id"])
                db.execute(
                    """
                    UPDATE IngestBatch
                    SET filesProcessed = filesProcessed + 1, totalPages = ?, pagesProcessed = ?, candidatesDetected = ?, errorCount = ?, lastError = ?, updatedAt = ?
                    WHERE id = ?
                    """,
                    (total_pages, pages_processed, candidates_detected, errors, last_error, now_iso(), batch_id),
                )
                log_ingest_job_event(
                    db,
                    batch_id=batch_id,
                    source_file_id=source["id"],
                    job_type="PROCESS",
                    status="RUNNING",
                    message=f"Completed source file {source['relativePath']}.",
                    started_at=started_at,
                    started_processed_pages=started_processed_pages,
                    metadata={"answersDetected": answers_detected},
                )
                db.commit()
            except Exception as exc:
                errors += 1
                last_error = f"{source['relativePath']}: {exc}"
                log_ingest_incident(
                    db,
                    batch_id=batch_id,
                    source_file_id=source["id"],
                    severity="ERROR",
                    code="SOURCE_PROCESSING_FAILED",
                    message=f"Source file {source['relativePath']} failed during processing.",
                    decision=str(exc),
                    action="Inspect the source file and rerun repair/retry after correcting the issue.",
                )
                db.execute("UPDATE IngestSourceFile SET status = 'FAILED', updatedAt = ? WHERE id = ?", (now_iso(), source["id"]))
                db.execute(
                    "UPDATE IngestBatch SET errorCount = ?, lastError = ?, updatedAt = ? WHERE id = ?",
                    (errors, last_error, now_iso(), batch_id),
                )
                log_ingest_job_event(
                    db,
                    batch_id=batch_id,
                    source_file_id=source["id"],
                    job_type="PROCESS",
                    status="FAILED",
                    message=f"Failed source file {source['relativePath']}.",
                    started_at=started_at,
                    started_processed_pages=started_processed_pages,
                    metadata={"error": str(exc)},
                )
                db.commit()
        normalize_batch_metadata(db, batch_id)
        infer_missing_source_metadata_from_pages(db, batch_id)
        infer_full_test_metadata_from_pages(db, batch_id)
        normalize_full_test_candidate_modules(db, batch_id)
        remove_full_test_extra_practice_candidates(db, batch_id)
        enrich_candidates_from_answers(db, batch_id)
        link_docx_full_test_candidate_images(db, batch_id)
        reconcile_ingest_incidents(db, batch_id)
        recalc_batch(db, batch_id, "FAILED" if errors else None)
        log_ingest_job_event(
            db,
            batch_id=batch_id,
            job_type="PROCESS",
            status="FAILED" if errors else "COMPLETED",
            message="Batch processing finished.",
            started_at=started_at,
            started_processed_pages=started_processed_pages,
            metadata={"errors": errors},
        )
        db.commit()


@app.get("/health")
def health() -> dict[str, Any]:
    database_url = os.getenv("DATABASE_URL", "file:./dev.db")
    db_key, db_summary = load_mistral_api_key_from_db(database_url)
    config = IngestConfig.from_env()
    key_source = "database" if db_key else "env" if os.getenv("MISTRAL_API_KEY") else None
    fingerprint = db_summary.get("sha256")
    return {
        "ok": True,
        "mistralKeyConfigured": bool(config.mistral_api_key),
        "mistralKeySource": key_source,
        "mistralKeySha256": f"{fingerprint[:12]}..." if fingerprint else None,
        "ocrModel": config.ocr_model,
        "structuringModel": config.structuring_model,
    }


@app.post("/batches")
def create_batch(payload: BatchCreate) -> dict[str, Any]:
    return create_batch_from_path(payload.name, Path(payload.basePath))


def safe_extract_zip(zip_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        entries = [member for member in archive.infolist() if not member.is_dir()]
        if len(entries) > MAX_ZIP_ENTRY_COUNT:
            raise HTTPException(status_code=413, detail=f"ZIP has too many files. Maximum allowed is {MAX_ZIP_ENTRY_COUNT}.")
        total_uncompressed = 0
        for member in entries:
            if member.is_dir():
                continue
            member_name = member.filename.replace("\\", "/")
            if member.file_size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"ZIP entry is too large: {member.filename}")
            total_uncompressed += member.file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP uncompressed content exceeds the allowed limit.")
            target = (destination / member_name).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise HTTPException(status_code=400, detail=f"Unsafe ZIP entry path: {member.filename}")
            if target.suffix.lower() not in {".pdf", ".docx"}:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)


def safe_upload_filename(filename: str) -> str:
    cleaned = Path(filename.replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._()&+\- ]+", "_", cleaned).strip(" .")
    return cleaned or f"source-{uuid.uuid4().hex}.pdf"


def upload_staging_path(root: Path, content_type: str, filename: str, difficulty: str | None, topic_name: str | None, domain_name: str | None, test_number: int | None) -> Path:
    safe_name = safe_upload_filename(filename)
    if content_type == "FULL_PRACTICE_TEST":
        test_label = f"TEST {test_number}" if test_number else "UPLOADED TEST"
        return root / "MOCK EXAMS" / test_label / safe_name

    domain = safe_upload_filename(domain_name or "UPLOADED PRACTICE SETS")
    topic = safe_upload_filename(topic_name or "UPLOADED TOPIC")
    if difficulty and not re.search(r"\b(EASY|MED|MEDIUM|HARD)\b", safe_name, re.IGNORECASE):
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        safe_name = f"{stem} {difficulty.upper()}{suffix}"
    return root / "PRACTICE EXERCISES" / "EXERCISES MATH" / domain / topic / safe_name


@app.post("/batches/upload-sources")
async def upload_source_batch(
    request: Request,
    name: str = Form("Questionnaire PDF/DOCX ingest"),
    contentType: str = Form("PRACTICE_SET"),
    difficulty: str | None = Form(None),
    topicName: str | None = Form(None),
    domainName: str | None = Form(None),
    testNumber: int | None = Form(None),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES + 1024 * 1024:
        raise HTTPException(status_code=413, detail="Upload exceeds the 256 MB limit.")
    normalized_content_type = contentType.strip().upper()
    if normalized_content_type not in {"PRACTICE_SET", "FULL_PRACTICE_TEST"}:
        raise HTTPException(status_code=400, detail="contentType must be PRACTICE_SET or FULL_PRACTICE_TEST.")
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one PDF or DOCX source file.")
    if len(files) > MAX_SOURCE_FILES:
        raise HTTPException(status_code=413, detail=f"Too many source files. Maximum allowed is {MAX_SOURCE_FILES}.")

    upload_id = new_id("upload")
    upload_dir = (UPLOAD_ROOT / upload_id).resolve()
    staging_dir = upload_dir / "questionnaire"
    upload_dir.mkdir(parents=True, exist_ok=True)

    total_size = 0
    saved = 0
    try:
        for index, file in enumerate(files, start=1):
            filename = file.filename or ""
            if not filename.lower().endswith((".pdf", ".docx")):
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {filename or 'unnamed file'}")
            target = upload_staging_path(staging_dir, normalized_content_type, filename, difficulty, topicName, domainName, testNumber).resolve()
            if not target.is_relative_to(staging_dir.resolve()):
                raise HTTPException(status_code=400, detail=f"Unsafe file name: {filename}")
            if target.exists():
                target = target.with_name(f"{target.stem}-{index}{target.suffix}")
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    total_size += len(chunk)
                    if total_size > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="Upload exceeds the 256 MB limit.")
                    output.write(chunk)
            saved += 1
    finally:
        for file in files:
            await file.close()

    result = create_batch_from_path(name, staging_dir)
    return {**result, "uploadId": upload_id, "uploadedBytes": total_size, "uploadedFiles": saved, "contentType": normalized_content_type}


@app.post("/batches/upload-zip")
async def upload_zip_batch(request: Request, name: str = "AI ZIP content ingest", file: UploadFile = File(...)) -> dict[str, Any]:
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES + 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP upload exceeds the 256 MB limit.")
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload a .zip file containing PDF and DOCX sources.")

    upload_id = new_id("upload")
    upload_dir = (UPLOAD_ROOT / upload_id).resolve()
    zip_path = upload_dir / "source.zip"
    extract_dir = upload_dir / "extracted"
    upload_dir.mkdir(parents=True, exist_ok=True)

    size = 0
    try:
        with zip_path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="ZIP upload exceeds the 256 MB limit.")
                output.write(chunk)
        safe_extract_zip(zip_path, extract_dir)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid ZIP archive.") from exc
    finally:
        await file.close()

    result = create_batch_from_path(name, extract_dir)
    return {**result, "uploadId": upload_id, "uploadedBytes": size}


@app.post("/batches/{batch_id}/process")
def start_batch(batch_id: str, background_tasks: BackgroundTasks) -> dict[str, Any]:
    with conn() as db:
        batch = db.execute("SELECT id FROM IngestBatch WHERE id = ?", (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    background_tasks.add_task(IngestPipeline().process_batch, batch_id)
    return {"id": batch_id, "status": "PROCESSING"}


@app.post("/batches/{batch_id}/repair")
def repair_existing_batch(batch_id: str) -> dict[str, Any]:
    with conn() as db:
        batch = db.execute("SELECT id FROM IngestBatch WHERE id = ?", (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"id": batch_id, **repair_batch(batch_id)}


@app.post("/batches/{batch_id}/rehydrate-full-test-docx")
def rehydrate_existing_full_test_docx(
    batch_id: str,
    testNumber: int | None = None,
    sourceFileId: str | None = None,
    dryRun: bool = False,
) -> dict[str, Any]:
    with conn() as db:
        batch = db.execute("SELECT id FROM IngestBatch WHERE id = ?", (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {
        "id": batch_id,
        **rehydrate_full_test_docx_sources(batch_id, test_number=testNumber, source_file_id=sourceFileId, dry_run=dryRun),
    }


@app.post("/batches/{batch_id}/retry-ocr-required")
def retry_existing_ocr_required(batch_id: str, limit: int = 100, sourceFileId: str | None = None) -> dict[str, Any]:
    with conn() as db:
        batch = db.execute("SELECT id FROM IngestBatch WHERE id = ?", (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"id": batch_id, **retry_ocr_required(batch_id, limit=limit, source_file_id=sourceFileId)}


@app.post("/candidates/{candidate_id}/parse-option-image")
def parse_candidate_option_image_endpoint(candidate_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    image_artifact_id = payload.get("imageArtifactId")
    if not image_artifact_id:
        raise HTTPException(status_code=400, detail="imageArtifactId is required.")
    return parse_candidate_option_image(candidate_id, str(image_artifact_id))


@app.get("/sources/{source_file_id}/pages/{page_number}/image")
def render_source_page_image(source_file_id: str, page_number: int, dpi: int = 150) -> Response:
    dpi = max(72, min(300, dpi))
    with conn() as db:
        source = db.execute("SELECT * FROM IngestSourceFile WHERE id = ?", (source_file_id,)).fetchone()
    if not source:
        raise HTTPException(status_code=404, detail="Source file not found.")
    path = resolve_existing_source_path(source["path"])
    if path.exists() and path.suffix.lower() == ".pdf":
        image_bytes, page_width, page_height = render_pdf_page_jpeg(path, page_number, dpi)
        if not image_bytes:
            raise HTTPException(status_code=404, detail="Could not render the requested page.")
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "X-Page-Width": str(page_width),
                "X-Page-Height": str(page_height),
                "Cache-Control": "private, max-age=300",
            },
        )
    # Non-PDF (e.g. DOCX): serve the extracted full-page image so the crop tool
    # can display and crop it just like a PDF page.
    with conn() as db:
        page_image = find_page_image_disk_path(db, source_file_id, page_number)
    if not page_image:
        raise HTTPException(status_code=400, detail="No page image available for this source.")
    data = page_image.read_bytes()
    with Image.open(BytesIO(data)) as im:
        w, h = im.width, im.height
    media = "image/png" if page_image.suffix.lower() == ".png" else "image/jpeg"
    return Response(
        content=data,
        media_type=media,
        headers={
            "X-Page-Width": str(w),
            "X-Page-Height": str(h),
            "Cache-Control": "private, max-age=300",
        },
    )


@app.post("/candidates/{candidate_id}/crop-region")
def crop_candidate_region_endpoint(candidate_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    page_number = payload.get("pageNumber")
    if page_number is None:
        raise HTTPException(status_code=400, detail="pageNumber is required.")
    bbox = payload.get("bbox")
    if not isinstance(bbox, dict):
        raise HTTPException(status_code=400, detail="bbox {x0,y0,x1,y1} (normalized) is required.")
    image_source_file_id = payload.get("imageSourceFileId")
    return crop_candidate_region(
        candidate_id,
        int(page_number),
        bbox,
        str(payload.get("mode", "ASSIGN")),
        str(payload.get("targetType", "PAGE_CONTEXT")),
        payload.get("optionLabel"),
        str(image_source_file_id) if image_source_file_id else None,
    )
