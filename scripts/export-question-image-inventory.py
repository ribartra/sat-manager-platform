#!/usr/bin/env python3
"""Export an auditable inventory of questions that reference images.

The database is opened read-only. The workbook intentionally separates official
questions from ingestion staging records so ingestion artifacts are not
mistaken for content currently used by students.
"""

from __future__ import annotations

import argparse
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


RELEVANT_STAGING_TARGETS = ("STEM", "STIMULUS", "OPTION", "OPTION_BLOCK")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="dev.db", help="SQLite database path")
    parser.add_argument(
        "--output",
        default="docs/qa/question-image-inventory.xlsx",
        help="Output .xlsx path",
    )
    parser.add_argument(
        "--base-dir",
        default=".",
        help="Repository root used to resolve /uploads/... paths",
    )
    return parser.parse_args()


def clean(value: Any) -> str:
    return "" if value is None else str(value)


def nonempty(value: Any) -> bool:
    return bool(clean(value).strip())


def placeholders(values: Iterable[str]) -> str:
    return ",".join("?" for _ in values)


def rows(db: sqlite3.Connection, sql: str, parameters: Iterable[Any] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in db.execute(sql, tuple(parameters)).fetchall()]


def resolve_local_file(base_dir: Path, image_url: str) -> Path:
    relative = image_url.split("?", 1)[0].lstrip("/")
    if relative.startswith("uploads/"):
        relative = f"public/{relative}"
    return (base_dir / relative).resolve()


def join_values(values: Iterable[str]) -> str:
    return " | ".join(value for value in values if value)


def set_sheet_layout(ws, widths: dict[int, int], freeze: str = "A2") -> None:
    ws.freeze_panes = freeze
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    for column, width in widths.items():
        ws.column_dimensions[get_column_letter(column)].width = width
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)


def write_table_sheet(
    ws,
    headers: list[str],
    data: list[list[Any]],
    table_name: str,
    widths: dict[int, int],
) -> None:
    ws.append(headers)
    for row in data:
        ws.append(row)
    if data:
        table = Table(displayName=table_name, ref=f"A1:{get_column_letter(len(headers))}{len(data) + 1}")
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        ws.add_table(table)
    set_sheet_layout(ws, widths)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1F4E78")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 34


def hyperlink_cell(cell, path: Path | None, display: str) -> None:
    cell.value = display
    if path is not None and path.exists():
        cell.hyperlink = path.as_uri()
        cell.style = "Hyperlink"


def main() -> None:
    args = parse_args()
    db_path = Path(args.db).resolve()
    output_path = Path(args.output).resolve()
    base_dir = Path(args.base_dir).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        quick_check = clean(db.execute("PRAGMA quick_check").fetchone()[0])
        integrity_check = clean(db.execute("PRAGMA integrity_check").fetchone()[0])

        question_rows = rows(
            db,
            """
            SELECT
              q.id, q.status, q.type, q.difficulty, q.stem, q.stimulus,
              q.imageUrl, q.topicId, t.name AS topic, d.name AS domain,
              s.name AS section, s.label AS sectionLabel
            FROM Question q
            JOIN Topic t ON t.id = q.topicId
            JOIN Domain d ON d.id = t.domainId
            JOIN Section s ON s.id = d.sectionId
            WHERE (q.imageUrl IS NOT NULL AND trim(q.imageUrl) <> '')
               OR EXISTS (
                 SELECT 1 FROM QuestionOption qo
                 WHERE qo.questionId = q.id
                   AND qo.imageUrl IS NOT NULL AND trim(qo.imageUrl) <> ''
               )
            ORDER BY s.name, d.name, t.name, q.id
            """,
        )
        question_ids = [row["id"] for row in question_rows]

        option_rows = rows(
            db,
            f"""
            SELECT qo.questionId, qo.label, qo.text, qo.imageUrl
            FROM QuestionOption qo
            WHERE qo.questionId IN ({placeholders(question_ids)})
              AND qo.imageUrl IS NOT NULL AND trim(qo.imageUrl) <> ''
            ORDER BY qo.questionId, qo.label
            """,
            question_ids,
        ) if question_ids else []

        fpt_rows = rows(
            db,
            f"""
            SELECT fq.questionId, t.name AS test, m.name AS module,
                   m.section AS moduleSection, fq."order" AS questionOrder
            FROM FullPracticeTestQuestion fq
            JOIN FullPracticeTestModule m ON m.id = fq.moduleId
            JOIN FullPracticeTest t ON t.id = m.testId
            WHERE fq.questionId IN ({placeholders(question_ids)})
            ORDER BY t.name, m."order", fq."order"
            """,
            question_ids,
        ) if question_ids else []

        practice_rows = rows(
            db,
            f"""
            SELECT psq.questionId, ps.name AS practiceSet, ps.status AS practiceSetStatus,
                   ps.difficulty AS practiceSetDifficulty, psq."order" AS questionOrder
            FROM PracticeSetQuestion psq
            JOIN PracticeSet ps ON ps.id = psq.practiceSetId
            WHERE psq.questionId IN ({placeholders(question_ids)})
            ORDER BY ps.name, psq."order"
            """,
            question_ids,
        ) if question_ids else []

        staging_filter = placeholders(RELEVANT_STAGING_TARGETS)
        staging_rows = rows(
            db,
            f"""
            SELECT
              l.id AS linkId, l.candidateId, l.imageArtifactId, l.targetType,
              l.optionLabel, l.sortOrder AS linkOrder,
              c.officialQuestionId, c.status AS candidateStatus,
              c.promotionStatus, c.questionNumber, c.testNumber,
              c.moduleLabel, c.section AS candidateSection,
              c.domainName AS candidateDomain, c.topicName AS candidateTopic,
              c.difficulty AS candidateDifficulty, c.type AS candidateType,
              sf.relativePath AS sourceRelativePath, sf.sourceKind,
              sf.contentType AS sourceContentType,
              pa.pageNumber,
              a.imageId, a.origin, a.fileUrl, a.mimeType,
              a.width, a.height, a.status AS artifactStatus
            FROM IngestCandidateImageLink l
            LEFT JOIN IngestQuestionCandidate c ON c.id = l.candidateId
            LEFT JOIN IngestImageArtifact a ON a.id = l.imageArtifactId
            LEFT JOIN IngestSourceFile sf ON sf.id = a.sourceFileId
            LEFT JOIN IngestPageArtifact pa ON pa.id = a.pageArtifactId
            WHERE l.targetType IN ({staging_filter})
            ORDER BY COALESCE(c.section, ''), COALESCE(c.testNumber, 0),
                     COALESCE(c.moduleLabel, ''), COALESCE(c.questionNumber, 0),
                     l.candidateId, l.sortOrder
            """,
            RELEVANT_STAGING_TARGETS,
        )
        excluded_staging_rows = rows(
            db,
            """
            SELECT
              l.id AS linkId, l.candidateId, l.imageArtifactId, l.targetType,
              l.optionLabel, l.sortOrder AS linkOrder,
              c.officialQuestionId, c.status AS candidateStatus,
              c.promotionStatus, c.questionNumber, c.testNumber,
              c.moduleLabel, c.section AS candidateSection,
              c.domainName AS candidateDomain, c.topicName AS candidateTopic,
              c.difficulty AS candidateDifficulty, c.type AS candidateType,
              sf.relativePath AS sourceRelativePath, sf.sourceKind,
              sf.contentType AS sourceContentType,
              pa.pageNumber,
              a.imageId, a.origin, a.fileUrl, a.mimeType,
              a.width, a.height, a.status AS artifactStatus
            FROM IngestCandidateImageLink l
            LEFT JOIN IngestQuestionCandidate c ON c.id = l.candidateId
            LEFT JOIN IngestImageArtifact a ON a.id = l.imageArtifactId
            LEFT JOIN IngestSourceFile sf ON sf.id = a.sourceFileId
            LEFT JOIN IngestPageArtifact pa ON pa.id = a.pageArtifactId
            WHERE l.targetType = 'ANSWER_FIELD'
            ORDER BY l.candidateId, l.sortOrder
            """,
        )

        fpt_by_question: dict[str, list[str]] = defaultdict(list)
        for row in fpt_rows:
            fpt_by_question[row["questionId"]].append(
                f"{row['test']} / {row['module']} / Q{int(row['questionOrder']) + 1}"
            )
        practice_by_question: dict[str, list[str]] = defaultdict(list)
        for row in practice_rows:
            practice_by_question[row["questionId"]].append(
                f"{row['practiceSet']} ({row['practiceSetStatus']}) / Q{int(row['questionOrder']) + 1}"
            )
        options_by_question: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in option_rows:
            options_by_question[row["questionId"]].append(row)

        local_question_image_count = 0
        local_option_image_count = 0

        wb = Workbook()
        summary = wb.active
        summary.title = "Resumen"
        official = wb.create_sheet("Preguntas oficiales")
        official_options = wb.create_sheet("Alternativas oficiales")
        staging = wb.create_sheet("Staging imágenes")
        excluded = wb.create_sheet("Exclusiones staging")

        # Summary sheet.
        summary_rows = [
            ["Inventario de preguntas con imágenes", ""],
            ["Generado (UTC)", datetime.now(timezone.utc).isoformat(timespec="seconds")],
            ["Base de datos", str(db_path)],
            ["Criterio oficial", "Question.imageUrl o QuestionOption.imageUrl no vacío"],
            ["Criterio staging incluido", "STEM, STIMULUS, OPTION, OPTION_BLOCK"],
            ["Criterio staging excluido", "ANSWER_FIELD: artefacto de campo de respuesta"],
            ["", ""],
            ["Métrica", "Valor"],
            ["Preguntas oficiales con imágenes", len(question_rows)],
            ["Imágenes en enunciado/estímulo", sum(nonempty(row["imageUrl"]) for row in question_rows)],
            ["Preguntas con imagen en alternativas", len({row["questionId"] for row in option_rows})],
            ["Filas de alternativas con imagen", len(option_rows)],
            ["Preguntas en Full Practice Tests", len({row["questionId"] for row in fpt_rows})],
            ["Preguntas en Practice Sets", len({row["questionId"] for row in practice_rows})],
            ["Enlaces staging incluidos", len(staging_rows)],
            ["Candidatos staging incluidos", len({row["candidateId"] for row in staging_rows})],
            ["Enlaces staging excluidos (ANSWER_FIELD)", len(excluded_staging_rows)],
            ["Candidatos staging excluidos", len({row["candidateId"] for row in excluded_staging_rows})],
            ["Integridad SQLite quick_check", quick_check],
            ["Integridad SQLite integrity_check", integrity_check],
            ["", ""],
            ["Notas", "Las hojas oficiales son únicas por pregunta; las hojas de alternativas y staging son filas de imágenes/enlaces."],
            ["Notas", "Las URLs oficiales se conservan como rutas de aplicación y se acompaña una ruta local clicable cuando el archivo existe."],
        ]
        for row in summary_rows:
            summary.append(row)
        summary.column_dimensions["A"].width = 46
        summary.column_dimensions["B"].width = 110
        summary.sheet_view.showGridLines = False
        for cell in summary[1]:
            cell.font = Font(bold=True, size=14, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="1F4E78")
        for row_number in (8,):
            for cell in summary[row_number]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor="5B9BD5")
        for row in summary.iter_rows():
            for cell in row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
        summary.freeze_panes = "A8"

        official_headers = [
            "Question ID", "Status", "Type", "Difficulty", "Section", "Section label",
            "Domain", "Topic", "Stem", "Stimulus", "Has stem image", "Stem image URL",
            "Stem image local file", "Stem image exists locally", "Option image count",
            "Option image labels", "Option image URLs", "Full Practice Tests", "Practice Sets",
        ]
        official_data: list[list[Any]] = []
        for row in question_rows:
            image_url = clean(row["imageUrl"]).strip()
            local_path = resolve_local_file(base_dir, image_url) if image_url else None
            if local_path is not None and local_path.exists():
                local_question_image_count += 1
            image_options = options_by_question.get(row["id"], [])
            for option in image_options:
                option_url = clean(option["imageUrl"]).strip()
                option_path = resolve_local_file(base_dir, option_url)
                if option_url:
                    local_option_image_count += int(option_path.exists())
            official_data.append(
                [
                    row["id"], row["status"], row["type"], row["difficulty"], row["section"],
                    row["sectionLabel"], row["domain"], row["topic"], row["stem"], row["stimulus"],
                    "Yes" if image_url else "No", image_url, str(local_path) if local_path else "",
                    "Yes" if local_path and local_path.exists() else "No", len(image_options),
                    join_values(f"{option['label']}" for option in image_options),
                    join_values(clean(option["imageUrl"]).strip() for option in image_options),
                    join_values(fpt_by_question.get(row["id"], [])),
                    join_values(practice_by_question.get(row["id"], [])),
                ]
            )
        write_table_sheet(
            official,
            official_headers,
            official_data,
            "OfficialQuestionImages",
            {1: 26, 2: 12, 3: 10, 4: 12, 5: 16, 6: 20, 7: 30, 8: 42, 9: 75, 10: 45, 11: 16, 12: 48, 13: 58, 14: 20, 15: 18, 16: 18, 17: 70, 18: 48, 19: 60},
        )

        option_headers = [
            "Question ID", "Option label", "Option text", "Section", "Domain", "Topic",
            "Difficulty", "Status", "Image URL", "Local file", "Exists locally",
        ]
        question_by_id = {row["id"]: row for row in question_rows}
        option_data: list[list[Any]] = []
        for option in option_rows:
            question = question_by_id[option["questionId"]]
            image_url = clean(option["imageUrl"]).strip()
            local_path = resolve_local_file(base_dir, image_url)
            option_data.append(
                [
                    option["questionId"], option["label"], option["text"], question["section"],
                    question["domain"], question["topic"], question["difficulty"], question["status"],
                    image_url, str(local_path), "Yes" if local_path.exists() else "No",
                ]
            )
        write_table_sheet(
            official_options,
            option_headers,
            option_data,
            "OfficialOptionImages",
            {1: 26, 2: 14, 3: 75, 4: 16, 5: 30, 6: 42, 7: 12, 8: 12, 9: 55, 10: 58, 11: 16},
        )

        staging_headers = [
            "Link ID", "Candidate ID", "Official Question ID", "Target type", "Option label",
            "Link order", "Candidate status", "Promotion status", "Question number", "Test number",
            "Module", "Section", "Domain", "Topic", "Difficulty", "Question type",
            "Source file", "Source kind", "Source content type", "Page", "Artifact ID", "Image ID",
            "Origin", "File URL", "MIME type", "Width", "Height", "Artifact status",
            "Candidate record found", "Official question found",
        ]
        staging_data: list[list[Any]] = []
        for row in staging_rows:
            staging_data.append(
                [
                    row["linkId"], row["candidateId"], row["officialQuestionId"] or "", row["targetType"],
                    row["optionLabel"] or "", row["linkOrder"], row["candidateStatus"] or "", row["promotionStatus"] or "",
                    row["questionNumber"] or "", row["testNumber"] or "", row["moduleLabel"] or "",
                    row["candidateSection"] or "", row["candidateDomain"] or "", row["candidateTopic"] or "",
                    row["candidateDifficulty"] or "", row["candidateType"] or "", row["sourceRelativePath"] or "",
                    row["sourceKind"] or "", row["sourceContentType"] or "", row["pageNumber"] or "",
                    row["imageArtifactId"], row["imageId"] or "", row["origin"] or "", row["fileUrl"] or "",
                    row["mimeType"] or "", row["width"] or "", row["height"] or "", row["artifactStatus"] or "",
                    "Yes" if row["candidateId"] else "No", "Yes" if row["officialQuestionId"] else "No",
                ]
            )
        write_table_sheet(
            staging,
            staging_headers,
            staging_data,
            "StagingQuestionImages",
            {1: 26, 2: 34, 3: 26, 4: 16, 5: 14, 6: 12, 7: 16, 8: 16, 9: 14, 10: 12, 11: 14, 12: 14, 13: 30, 14: 42, 15: 12, 16: 14, 17: 60, 18: 20, 19: 22, 20: 10, 21: 34, 22: 34, 23: 18, 24: 90, 25: 18, 26: 10, 27: 10, 28: 18, 29: 18, 30: 20},
        )

        excluded_headers = staging_headers + ["Exclusion reason"]
        excluded_data = []
        for row in excluded_staging_rows:
            excluded_data.append(
                [
                    row["linkId"], row["candidateId"], row["officialQuestionId"] or "", row["targetType"],
                    row["optionLabel"] or "", row["linkOrder"], row["candidateStatus"] or "", row["promotionStatus"] or "",
                    row["questionNumber"] or "", row["testNumber"] or "", row["moduleLabel"] or "",
                    row["candidateSection"] or "", row["candidateDomain"] or "", row["candidateTopic"] or "",
                    row["candidateDifficulty"] or "", row["candidateType"] or "", row["sourceRelativePath"] or "",
                    row["sourceKind"] or "", row["sourceContentType"] or "", row["pageNumber"] or "",
                    row["imageArtifactId"], row["imageId"] or "", row["origin"] or "", row["fileUrl"] or "",
                    row["mimeType"] or "", row["width"] or "", row["height"] or "", row["artifactStatus"] or "",
                    "Yes" if row["candidateId"] else "No", "Yes" if row["officialQuestionId"] else "No",
                    "ANSWER_FIELD: ingestion artifact for the answer field, not the stem or an alternative",
                ]
            )
        write_table_sheet(
            excluded,
            excluded_headers,
            excluded_data,
            "ExcludedAnswerFieldImages",
            {index: 18 for index in range(1, len(excluded_headers) + 1)},
        )

        # Add local hyperlinks to the two official sheets without changing display text.
        for row_index, row in enumerate(official_data, start=2):
            image_url = clean(row[11]).strip()
            local_path = resolve_local_file(base_dir, image_url) if image_url else None
            hyperlink_cell(official.cell(row_index, 13), local_path, row[12])
            if local_path is not None and local_path.exists():
                official.cell(row_index, 14).value = "Yes"
        for row_index, row in enumerate(option_data, start=2):
            local_path = Path(row[9]) if row[9] else None
            hyperlink_cell(official_options.cell(row_index, 10), local_path, row[9])

        # Mark non-OK integrity checks clearly in the summary.
        danger_fill = PatternFill("solid", fgColor="F4CCCC")
        if quick_check != "ok":
            summary["B19"].fill = danger_fill
        if integrity_check != "ok":
            summary["B20"].fill = danger_fill

        wb.save(output_path)
        print(f"Wrote {output_path}")
        print(f"official_questions={len(question_rows)}")
        print(f"official_option_image_rows={len(option_rows)}")
        print(f"staging_included_links={len(staging_rows)}")
        print(f"staging_excluded_answer_field_links={len(excluded_staging_rows)}")
        print(f"official_stem_files_present={local_question_image_count}/{sum(nonempty(row['imageUrl']) for row in question_rows)}")
        print(f"official_option_files_present={local_option_image_count}/{len(option_rows)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
