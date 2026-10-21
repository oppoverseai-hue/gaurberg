"""Cut a 10-K (iXBRL .htm) into plain-text sections by standard Item headings.

Usage: python split_10k.py <10k.htm> <out_dir>
Keeps: Item 1 (Business), Item 1A (Risk Factors), Item 7 (MD&A), Item 8 notes mentioning customers/partners.
Writes one .txt per kept section plus sections.json with character counts.
"""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup

KEEP = {"1": "business", "1a": "risk_factors", "7": "mdna"}


def to_text(path: str) -> str:
    soup = BeautifulSoup(open(path, encoding="utf-8", errors="ignore").read(), "lxml")
    for t in soup.find_all(["ix:header", "script", "style"]):
        t.decompose()
    text = soup.get_text("\n")
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text


def split(text: str) -> dict[str, str]:
    # Item headings sit on their own line, e.g. "Item 1A. Risk Factors" (the table of contents repeats them).
    pat = re.compile(r"^\s*item\s+(\d+[a-c]?)\s*[\.\:\-—–]?\s*(.*)$", re.I | re.M)
    marks = [(m.start(), m.group(1).lower(), m.group(2).strip()) for m in pat.finditer(text)]
    out: dict[str, str] = {}
    for i, (pos, item, title) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        body = text[pos:end]
        # The real section is the longest block for that item (table of contents entries are short).
        if item in KEEP and len(body) > len(out.get(item, "")):
            out[item] = body
    return out


if __name__ == "__main__":
    src, dest = sys.argv[1], Path(sys.argv[2])
    dest.mkdir(parents=True, exist_ok=True)
    secs = split(to_text(src))
    report = {}
    for item, name in KEEP.items():
        body = secs.get(item, "")
        (dest / f"{name}.txt").write_text(body, encoding="utf-8")
        report[name] = len(body)
    (dest / "sections.json").write_text(json.dumps(report, indent=2))
    print(report)
