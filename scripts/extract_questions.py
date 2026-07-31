#!/usr/bin/env python3
"""Convert the structured logic-question DOCX into app-ready TypeScript data."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from docx import Document


OPTION_RE = re.compile(r"^([A-F])[.．、]\s*(.*)$")
ANSWER_PREFIX_RE = re.compile(r"^([A-F](?:\s*[、,，/和及]\s*[A-F])*)")


def strip_prefix(text: str, prefix: str) -> str:
    return text[len(prefix) :].strip() if text.startswith(prefix) else text.strip()


def extract(input_path: Path) -> list[dict[str, object]]:
    document = Document(input_path)
    questions: list[dict[str, object]] = []
    section = "逻辑推理题"
    current: dict[str, object] | None = None

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style = paragraph.style.name
        if style == "Heading 1":
            section = text.replace("　", " ")
        elif style == "Question Heading":
            if current:
                questions.append(current)
            current = {
                "id": len(questions) + 1,
                "source": section,
                "sourceNumber": text,
                "prompt": "",
                "options": [],
                "answer": "",
                "correctOptions": [],
                "analysis": "",
                "kind": "open",
            }
        elif current is not None and style == "Question Body":
            current["prompt"] = strip_prefix(text, "题目：")
        elif current is not None and style == "Option":
            option_match = OPTION_RE.match(text)
            if option_match:
                options = current["options"]
                assert isinstance(options, list)
                options.append({"label": option_match.group(1), "text": option_match.group(2)})
        elif current is not None and style == "Answer Box":
            answer = strip_prefix(text, "答案：")
            current["answer"] = answer
            answer_match = ANSWER_PREFIX_RE.match(answer)
            if answer_match:
                current["correctOptions"] = re.findall(r"[A-F]", answer_match.group(1))
        elif current is not None and style == "Analysis":
            current["analysis"] = strip_prefix(text, "解析：")

    if current:
        questions.append(current)

    for question in questions:
        options = question["options"]
        correct_options = question["correctOptions"]
        assert isinstance(options, list)
        assert isinstance(correct_options, list)
        option_labels = {option["label"] for option in options}
        question["kind"] = (
            "choice"
            if len(options) >= 2
            and bool(correct_options)
            and set(correct_options).issubset(option_labels)
            else "open"
        )

    return questions


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_questions.py INPUT.docx OUTPUT.ts")
    questions = extract(Path(sys.argv[1]).resolve())
    payload = json.dumps(questions, ensure_ascii=False, indent=2)
    output = """export type QuestionOption = { label: string; text: string };

export type LogicQuestion = {
  id: number;
  source: string;
  sourceNumber: string;
  prompt: string;
  options: QuestionOption[];
  answer: string;
  correctOptions: string[];
  analysis: string;
  kind: \"choice\" | \"open\";
};

export const questions: LogicQuestion[] = """ + payload + ";\n"
    output_path = Path(sys.argv[2]).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")
    open_count = sum(question["kind"] == "open" for question in questions)
    print(f"Wrote {len(questions)} questions ({open_count} open-ended) to {output_path}")


if __name__ == "__main__":
    main()
