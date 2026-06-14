from pathlib import Path
import os
import re
import tempfile

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = Path(os.environ["TARGET_PDF"])
OUTPUT_PDF = Path(os.environ["OUTPUT_PDF"])
MD_PATH = ROOT / "docs" / "D1_PROTOCOL_INTERFACE_FINAL.md"
SECTION_PDF = Path(tempfile.gettempdir()) / "linktown_protocol_interface_section.pdf"


def register_japanese_font():
    for font_path in [
        r"C:\Windows\Fonts\meiryo.ttc",
        r"C:\Windows\Fonts\YuGothM.ttc",
        r"C:\Windows\Fonts\msgothic.ttc",
    ]:
        if not Path(font_path).exists():
            continue

        try:
            try:
                pdfmetrics.registerFont(TTFont("LinkTownJP", font_path, subfontIndex=0))
            except TypeError:
                pdfmetrics.registerFont(TTFont("LinkTownJP", font_path))
            return "LinkTownJP"
        except Exception:
            continue

    from reportlab.pdfbase.cidfonts import UnicodeCIDFont

    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    return "HeiseiKakuGo-W5"


FONT_NAME = register_japanese_font()
STYLES = {
    "title": ParagraphStyle("title", fontName=FONT_NAME, fontSize=18, leading=24, spaceAfter=8, textColor=colors.HexColor("#111827")),
    "h1": ParagraphStyle("h1", fontName=FONT_NAME, fontSize=15, leading=20, spaceBefore=10, spaceAfter=6, textColor=colors.HexColor("#111827")),
    "h2": ParagraphStyle("h2", fontName=FONT_NAME, fontSize=12.5, leading=17, spaceBefore=8, spaceAfter=5, textColor=colors.HexColor("#111827")),
    "body": ParagraphStyle("body", fontName=FONT_NAME, fontSize=9.3, leading=13.5, spaceAfter=4, alignment=TA_LEFT),
    "small": ParagraphStyle("small", fontName=FONT_NAME, fontSize=7.6, leading=10.6, spaceAfter=3),
    "code": ParagraphStyle("code", fontName=FONT_NAME, fontSize=7.6, leading=10.5, textColor=colors.HexColor("#111827")),
}


def escape_html(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_code(text):
    escaped = escape_html(text)
    return re.sub(r"`([^`]+)`", r'<font color="#1d4ed8">\1</font>', escaped)


def paragraph(text, style="body"):
    return Paragraph(inline_code(text.strip()), STYLES[style])


def split_table_cells(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def build_table(rows):
    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]
    data = [[Paragraph(inline_code(cell), STYLES["small"]) for cell in row] for row in normalized]

    if col_count == 2:
        widths = [38 * mm, 122 * mm]
    elif col_count == 3:
        widths = [35 * mm, 32 * mm, 93 * mm]
    elif col_count == 4:
        widths = [43 * mm, 23 * mm, 25 * mm, 69 * mm]
    else:
        widths = [160 * mm / col_count] * col_count

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    return table


def markdown_to_flowables(markdown_text):
    story = []
    lines = markdown_text.splitlines()
    in_code = False
    code_lines = []
    i = 0

    while i < len(lines):
        stripped = lines[i].rstrip().strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lines = []
            else:
                in_code = False
                story.append(Preformatted("\n".join(code_lines), STYLES["code"]))
                story.append(Spacer(1, 3))
            i += 1
            continue

        if in_code:
            code_lines.append(lines[i].rstrip())
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        if stripped.startswith("# "):
            story.append(Paragraph(escape_html(stripped[2:]), STYLES["title"]))
            i += 1
            continue

        if stripped.startswith("## "):
            story.append(Paragraph(escape_html(stripped[3:]), STYLES["h1"]))
            i += 1
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(escape_html(stripped[4:]), STYLES["h2"]))
            i += 1
            continue

        if stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = split_table_cells(lines[i])
                if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                    rows.append(cells)
                i += 1
            if rows:
                story.append(build_table(rows))
                story.append(Spacer(1, 6))
            continue

        if stripped.startswith("- "):
            story.append(paragraph("・" + stripped[2:]))
        else:
            story.append(paragraph(stripped))

        i += 1

    return story


def build_section_pdf():
    preamble = [
        ("h1", "7. データフロー（前ページからの続き）"),
        ("body", "履歴・ポイント参照フロー"),
        ("body", "② WebアプリがREST API経由でサーバへ取得要求を送信する。"),
        ("body", "③ サーバがDBから該当ユーザーの保有ポイント・参加履歴・取引履歴を取得する。"),
        ("body", "④ 取得データをWebアプリへ返却・表示する。"),
        ("h2", "7.2 管理者のデータフロー"),
        ("body", "イベント・加盟店管理フロー: 管理者がWebアプリにログインし、イベントまたは加盟店・サービスの登録/編集内容を入力する。Backend APIは入力内容を検証しDBへ反映し、処理結果をWebアプリへ返却する。"),
        ("body", "確認・集計フロー: 管理者が参加状況・ポイント付与状況・取引状況の確認画面を表示し、Webアプリが集計要求を送信する。Backend APIは参加履歴・ポイント取引履歴を集計し、結果を返却する。"),
        ("body", "以下、現行実装と最終理想形に合わせて「8. プロトコルとインターフェース」を差し替える。"),
    ]

    markdown = MD_PATH.read_text(encoding="utf-8")
    marker = "## 8. プロトコルとインターフェース"
    markdown_for_pdf = marker + markdown.split(marker, 1)[1]

    story = []
    for style, text in preamble:
        story.append(paragraph(text, style))
    story.append(PageBreak())
    story.extend(markdown_to_flowables(markdown_for_pdf))

    doc = SimpleDocTemplate(
        str(SECTION_PDF),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    doc.build(story)


def merge_pdf():
    source = PdfReader(str(SOURCE_PDF))
    section = PdfReader(str(SECTION_PDF))
    writer = PdfWriter()

    for page in source.pages[:12]:
        writer.add_page(page)
    for page in section.pages:
        writer.add_page(page)

    with OUTPUT_PDF.open("wb") as file:
        writer.write(file)

    print(OUTPUT_PDF)
    print(f"pages={len(PdfReader(str(OUTPUT_PDF)).pages)}")
    print(f"section_pages={len(section.pages)}")


if __name__ == "__main__":
    build_section_pdf()
    merge_pdf()
