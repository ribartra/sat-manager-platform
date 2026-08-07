"""Pruebas del parser estructural de candidatos de práctica.

Codifican la estructura de marcadores que el servicio debe entender
(Question → [estímulo] → enunciado → Answer → A-D → Correct Answer →
Rationale) y protegen contra regresiones de los tres bugs originales:
numeración, cabecera pegada al enunciado y opciones mal separadas.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.practice_repair import parse_practice_block, split_stimulus_and_prompt


def test_math_mc_with_header_and_answer_markers():
    text = (
        "Question ID: 4f7981a0\n"
        "Assessment Test Domain Skill Difficulty\n"
        "SAT Math Algebra Linear equations in one Easy\n"
        "variable\n"
        "Question\n"
        "If $3x + 2 = 8$, what is the value of $9x + 6$ ?\n"
        "Answer\n"
        "A. 6\n"
        "B. 18\n"
        "C. 24\n"
        "D. 30\n"
        "Correct Answer: B\n"
        "Rationale\n"
        "Choice B is correct...\n"
    )
    r = parse_practice_block(text)
    # Enunciado limpio: sin "Question", sin la cola "variable", sin "Answer".
    assert r["stem"] == "If $3x + 2 = 8$, what is the value of $9x + 6$ ?"
    assert "Question" not in r["stem"]
    assert "variable" not in r["stem"]
    assert [o["label"] for o in r["options"]] == ["A", "B", "C", "D"]
    assert [o["text"] for o in r["options"]] == ["6", "18", "24", "30"]
    assert r["type"] == "MC"
    assert r["image_backed"] is False
    assert r["stimulus"] is None


def test_article_A_is_not_option_A():
    """El artículo 'A student...' NO debe leerse como la alternativa A.

    Las alternativas reales solo aparecen tras el marcador 'Answer'.
    """
    text = (
        "Question ID: 0147b080\n"
        "Question\n"
        "A student is writing an essay about four pyramids and finds that el "
        "Castillo was built 1,100 to 1,400 years ago and is ______\n"
        "Which choice most effectively uses data from the table?\n"
        "Answer\n"
        "A. 33 meters tall.\n"
        "B. 47 meters tall.\n"
        "C. 40 meters tall.\n"
        "D. 60 meters tall.\n"
    )
    r = parse_practice_block(text)
    assert r["stem"].startswith("A student is writing")
    assert [o["text"] for o in r["options"]] == [
        "33 meters tall.",
        "47 meters tall.",
        "40 meters tall.",
        "60 meters tall.",
    ]
    # Ninguna opción debe filtrar Correct Answer/Rationale.
    assert not any("Rationale" in o["text"] or "Correct Answer" in o["text"] for o in r["options"])


def test_image_backed_options_kept_empty():
    text = (
        "Question ID: 83f2c3bf\n"
        "SAT Math Algebra Linear equations in two Easy\n"
        "variables\n"
        "Question\n"
        "Which table gives three values of x and their corresponding values of y?\n"
        "Answer\n"
        "A.\n"
        "B.\n"
        "C.\n"
        "D.\n"
        "Correct Answer: A\n"
    )
    r = parse_practice_block(text)
    assert r["stem"] == "Which table gives three values of x and their corresponding values of y?"
    assert len(r["options"]) == 4
    assert all(o["text"] == "" for o in r["options"])
    assert r["image_backed"] is True
    assert r["type"] == "MC"


def test_markdown_decorated_headers():
    text = (
        "Question ID: 9ed9f54d**\n"
        "# **Question**\n"
        "Which of the following is equivalent to $2(x^2 - 3)$?\n"
        "Answer\n"
        "A. $2x^2 - 6$\n"
        "B. $2x^2 - 3$\n"
        "C. $x^2 - 6$\n"
        "D. $2x^2$\n"
    )
    r = parse_practice_block(text)
    assert r["stem"] == "Which of the following is equivalent to $2(x^2 - 3)$?"
    assert r["stem"].lstrip().startswith("Which")


def test_numbered_question_header():
    text = (
        "Question ID: 6d9e01a2\n"
        "Question 27\n"
        "The given equation defines the function f. For what value of x is f minimized?\n"
        "Answer\n"
        "A. 1\nB. 2\nC. 3\nD. 4\n"
    )
    r = parse_practice_block(text)
    assert r["stem"].startswith("The given equation")
    assert "27" not in r["stem"].split(".")[0]


def test_numeric_without_options():
    text = (
        "Question ID: ab12cd34\n"
        "Question\n"
        "If $k > 0$ and $k^4 + 5 = 21$, what is the value of $k$?\n"
    )
    r = parse_practice_block(text)
    assert r["stem"].startswith("If $k > 0$")
    assert r["options"] == []
    assert r["type"] == "NUMERIC"


def test_reading_stimulus_split():
    text = (
        "Question ID: eb89dcc8\n"
        "Question\n"
        "Text 1\n"
        "Imagine you and your friend are trying to decide where to eat lunch.\n"
        "Text 2\n"
        "Research shows that people who don't state their preferences aren't more likable.\n"
        "Based on the texts, how would the author of Text 2 most likely respond to Text 1?\n"
        "Answer\n"
        "A. With agreement.\n"
        "B. With skepticism.\n"
        "C. With indifference.\n"
        "D. With confusion.\n"
    )
    r = parse_practice_block(text)
    assert r["stimulus"] is not None
    assert r["stimulus"].startswith("Text 1")
    assert "Research shows" in r["stimulus"]
    # El enunciado es solo la consigna, no el pasaje.
    assert r["stem"].startswith("Based on the texts")
    assert "Imagine you" not in r["stem"]


def test_no_false_stimulus_split_for_math():
    stim, stem = split_stimulus_and_prompt("What is the value of $x$ if $x + 1 = 3$?")
    assert stim is None
    assert stem == "What is the value of $x$ if $x + 1 = 3$?"


def test_empty_and_garbage_blocks_return_none():
    assert parse_practice_block("") is None
    assert parse_practice_block("   \n\n  ") is None
