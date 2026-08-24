#!/usr/bin/env python3
"""Convert a Markdown document to a styled PDF using reportlab platypus.

Usage:
    python3 md_to_pdf.py input.md -o output.pdf

Supports: #/##/### headings, paragraphs, -/* bullets, 1. numbered lists,
| a | b | tables, and fenced (```) code blocks. Long code lines wrap.

Requires: python3 -m pip install reportlab pypdf
"""
import argparse
import re
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

TITLE = ParagraphStyle("TitleX", fontName="Helvetica-Bold", fontSize=20,
                       leading=24, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"))
SUBTITLE = ParagraphStyle("SubtitleX", fontName="Helvetica-Oblique", fontSize=11,
                         leading=14, spaceAfter=16, textColor=colors.HexColor("#555555"))
H1 = ParagraphStyle("H1X", fontName="Helvetica-Bold", fontSize=16, leading=20,
                    spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#0f4c81"))
H2 = ParagraphStyle("H2X", fontName="Helvetica-Bold", fontSize=13, leading=17,
                    spaceBefore=12, spaceAfter=5, textColor=colors.HexColor("#0f4c81"))
H3 = ParagraphStyle("H3X", fontName="Helvetica-Bold", fontSize=11, leading=15,
                    spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#333333"))
BODY = ParagraphStyle("BodyX", fontName="Helvetica", fontSize=10, leading=14,
                      spaceAfter=6, textColor=colors.black)
BULLET = ParagraphStyle("BulletX", fontName="Helvetica", fontSize=10, leading=14,
                        spaceAfter=3, textColor=colors.black, leftIndent=14)
CODE = ParagraphStyle("CodeX", fontName="Courier", fontSize=8, leading=10.5,
                      textColor=colors.HexColor("#1a1a1a"), wordWrap="CJK")
CELL = ParagraphStyle("CellX", fontName="Helvetica", fontSize=9, leading=12)
CELL_HEAD = ParagraphStyle("CellHeadX", fontName="Helvetica-Bold", fontSize=9, leading=12)
CODE_BG = colors.HexColor("#f5f5f5")
CODE_BORDER = colors.HexColor("#cccccc")
HEADER_BG = colors.HexColor("#dce6f1")


def esc(text):
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def inline(text):
    t = esc(text)
    t = re.sub(r"`([^`]+)`", r"<font face='Courier' size='8.5'>\1</font>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    return t


def parse_table(lines):
    rows = []
    for ln in lines:
        ln = ln.strip()
        if not ln or re.match(r"^\s*\|?[\s:|-]+\|?\s*$", ln):
            continue
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    return rows


def build(src_path, out_path, page_size_name="A4", title=None, author=None):
    with open(src_path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    page_size = letter if page_size_name.lower() == "letter" else A4
    story = []
    i, n = 0, len(lines)
    in_code, code_buf = False, []
    table_buf = []

    def flush_code():
        nonlocal code_buf
        if code_buf:
            txt = "\n".join(code_buf)
            para = Paragraph(esc(txt).replace("\n", "<br/>"), CODE)
            t = Table([[para]], colWidths=[page_size[0] - 1.6 * inch])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("BOX", (0, 0), (-1, -1), 0.5, CODE_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))
            code_buf = []

    def flush_table():
        nonlocal table_buf
        if table_buf:
            rows = parse_table(table_buf)
            if rows:
                data = []
                for r_i, r in enumerate(rows):
                    style = CELL_HEAD if r_i == 0 else CELL
                    data.append([Paragraph(esc(c), style) for c in r])
                t = Table(data, repeatRows=1)
                t.setStyle(TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))
            table_buf = []

    while i < n:
        ln = lines[i]

        if ln.strip().startswith("```"):
            if in_code:
                flush_code()
                in_code = False
            else:
                flush_table()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(ln)
            i += 1
            continue

        if ln.strip().startswith("|"):
            flush_code()
            table_buf.append(ln)
            i += 1
            continue
        else:
            flush_table()

        stripped = ln.strip()
        if not stripped:
            i += 1
            continue

        m = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = inline(m.group(2))
            story.append(Paragraph(text, {1: H1, 2: H2, 3: H3}[level]))
            i += 1
            continue

        if re.match(r"^---+$", stripped):
            story.append(Spacer(1, 6))
            i += 1
            continue

        if re.match(r"^[-*]\s+", stripped):
            items = []
            while i < n and re.match(r"^[-*]\s+", lines[i].strip()):
                items.append(Paragraph(inline(re.sub(r"^[-*]\s+", "", lines[i].strip())), BULLET))
                i += 1
            story.append(ListFlowable(
                [ListItem(it, leftIndent=14) for it in items],
                bulletType="bullet", start="\u2022", bulletFontSize=8))
            story.append(Spacer(1, 6))
            continue

        if re.match(r"^\d+\.\s+", stripped):
            items = []
            while i < n and re.match(r"^\d+\.\s+", lines[i].strip()):
                items.append(Paragraph(inline(re.sub(r"^\d+\.\s+", "", lines[i].strip())), BULLET))
                i += 1
            story.append(ListFlowable(
                [ListItem(it, leftIndent=14) for it in items], bulletType="1"))
            story.append(Spacer(1, 6))
            continue

        story.append(Paragraph(inline(stripped), BODY))
        i += 1

    flush_code()
    flush_table()

    def draw_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(page_size[0] / 2.0, 0.5 * inch, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        out_path, pagesize=page_size,
        title=title or "", author=author or "",
        leftMargin=0.8 * inch, rightMargin=0.8 * inch,
        topMargin=0.8 * inch, bottomMargin=0.8 * inch,
    )
    doc.build(story, onFirstPage=draw_page_number, onLaterPages=draw_page_number)
    print(f"Wrote {out_path}")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    p = argparse.ArgumentParser(description="Convert Markdown to a styled PDF.")
    p.add_argument("input", help="Path to Markdown file")
    p.add_argument("-o", "--output", required=True, help="Output PDF path")
    p.add_argument("--page-size", default="A4", choices=["A4", "letter"])
    p.add_argument("--title", default=None, help="PDF title metadata")
    p.add_argument("--author", default=None, help="PDF author metadata")
    args = p.parse_args()
    build(args.input, args.output, args.page_size, args.title, args.author)


if __name__ == "__main__":
    main()
