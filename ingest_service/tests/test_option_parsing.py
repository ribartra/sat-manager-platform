"""Pruebas del parser A–D de opciones (crop OCR + OCR de imagen de opciones).

Protege contra regresiones en los marcadores de opción tolerados. El bug que
originó estas pruebas: el OCR de Mistral emite las opciones como viñeta
markdown MÁS glifo de tachado a la vez (`- ✕ **A** ...`), y el parser solo
admitía un glifo inicial, así que no detectaba ninguna opción.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import extract_options_from_image_ocr, parse_option_block


STACKED_MARKERS = """PREV. QUESTION

NEXT QUESTION

# 15. Which choice most logically completes the text?

- ✕ **A** doctors give prescriptions that can reduce patients' pain, enabling physical therapists to provide regular exercises that can improve functioning.
- ✕ **B** many patients care more about their ability to go about their normal activities than their level of pain.
- ✕ **C** physical therapists prioritize long-term treatment plans whereas doctors prioritize short-term treatment plans.
- ✕ **D** doctors prefer to prescribe pain-relieving medication that can accelerate the healing process."""


def test_stacked_bullet_and_strike_markers():
    """`- ✕ **A**` (md bullet + strike + emphasis) must parse all four options."""
    options = extract_options_from_image_ocr(STACKED_MARKERS)
    assert [o["label"] for o in options] == ["A", "B", "C", "D"]
    assert options[0]["text"].startswith("doctors give prescriptions")
    assert options[3]["text"].startswith("doctors prefer to prescribe")
    # markers/emphasis stripped, nav lines not appended
    assert "✕" not in options[0]["text"]
    assert "**" not in options[0]["text"]
    assert "QUESTION" not in options[3]["text"]


def test_single_strike_marker_still_parses():
    text = "✕ A) administer\n✕ B) divert\n✕ C) remit\n✕ D) reimburse"
    options = parse_option_block(text)
    assert [o["label"] for o in options] == ["A", "B", "C", "D"]
    assert options[0]["text"] == "administer"


def test_plain_letters_without_glyphs():
    text = "A. one\nB. two\nC. three\nD. four"
    options = parse_option_block(text)
    assert [o["label"] for o in options] == ["A", "B", "C", "D"]
    assert options[2]["text"] == "three"


def test_prose_is_not_mistaken_for_options():
    text = "A day at the beach was nice.\nBecause of rain we left early."
    assert parse_option_block(text) == []
