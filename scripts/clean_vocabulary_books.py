#!/usr/bin/env python3
import argparse
import csv
import re
import subprocess
import unicodedata
from pathlib import Path


DEFAULT_JUNIOR = Path("/Users/wangtianlong/工作/01_教学与备考/词汇/归档/初中词汇/初中英语词汇词根联想记忆法乱序版新东方.pdf")
DEFAULT_SENIOR = Path("/Users/wangtianlong/工作/01_教学与备考/词汇/归档/高中词汇/高中英语词汇 乱序.pdf")
SOURCE_DIR = Path("data/dictionary-import/source")

WORD_RE = re.compile(r"^[a-z][a-z' -]{0,36}$")
PHONETIC_RE = re.compile(r"^[\[［/I丨｜|].{1,80}[\]］/I丨｜|]$")
JUNIOR_POS_RE = re.compile(r"^(n|v|adj|adv|pron|prep|conj|interj|num|art)\.?\s", re.I)
SENIOR_ENTRY_RE = re.compile(
    r"^([a-z][a-z'-]{1,30})(?:\s+[「『])?\s+"
    r"((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|a)[\.,，．]?.*)$",
    re.I,
)
MARKER_RE = re.compile(r"^(记|例|搭|派|辨|真题|解析|译文|Tips|口|□|回|固|圈|圃|国|匣|匿|酣|lffl|E国|E冒)")
SENIOR_CORRECTIONS = {
    "accept": "v. 接受",
    "ability": "n. 能力；才能",
    "away": "adv. 离开，远离",
    "congratulation": "n. 祝贺",
    "grey": "adj. 灰色的；灰白的",
    "literature": "n. 文学",
    "senior": "adj. 年长的，资深的；高级的 n. 上级，长辈",
    "respond": "v. 回答，回应；做出反应",
    "prohibit": "v. 禁止，阻止",
    "universe": "n. 宇宙",
    "able": "adj. 有能力的；有才干的",
    "far": "adj./adv. 远的；远地",
    "reply": "n./v. 回答，答复",
    "forecast": "n. 预报 v. 预测",
    "reward": "n. 奖赏；报答；报酬；回报",
}
VALID_SHORT_WORDS = {"am", "an", "as", "at", "be", "by", "do", "go", "he", "hi", "if", "in", "is", "it", "me", "my", "no", "of", "oh", "on", "or", "ox", "so", "to", "up", "us", "we"}


def extract_text(pdf_path):
    result = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    return result.stdout


def clean_space(text):
    text = re.sub(r"[ \t]+", " ", text.replace("\u3000", " "))
    text = re.sub(r"\s+([,.;:!?，。；：！？])", r"\1", text)
    return text.strip()


def clean_phonetic(text):
    text = unicodedata.normalize("NFKC", clean_space(text))
    text = text.strip("[]［］/I丨｜| ")
    return text


def normalize_word(text):
    text = clean_space(text).lower()
    text = re.sub(r"^[^a-z]+|[^a-z]+$", "", text)
    text = re.sub(r"\s+", "-", text)
    return text


def clean_definition(text):
    text = clean_space(text)
    text = re.split(r"\s*(?:－|—|【|固词根|国词根|回|圃|圈|匣|匮|酣)\s*", text, maxsplit=1)[0]
    text = re.sub(r"^[^\w\u4e00-\u9fff]*(回|固|圆|圈|圃|国|匣|匿|酣|lffl|E国|E冒)\s*", "", text)
    text = re.sub(r"\b(a|ad以|adv|adj|ac布|a吟i|a啡|a吟f|dj)\b[，,．.]?", "adj.", text, flags=re.I)
    text = re.sub(r"\b(vt|vi|v|以|饥|叹|t)\b[，,．.]?", "v.", text, flags=re.I)
    text = re.sub(r"\b(n|门)\b[，,．.]?", "n.", text, flags=re.I)
    text = re.sub(r"^(v\.|n\./v\.|v\./n\.)\s*[\(（][^）)]*[\)）]\s*", r"\1 ", text)
    return clean_space(text)


def is_word_line(line):
    line = clean_space(line)
    if not WORD_RE.match(line):
        return False
    bad = {"word list", "table of contents", "contents", "tips"}
    return line.lower() not in bad and len(line.split()) <= 3


def parse_junior(text):
    lines = [line.strip() for line in text.splitlines()]
    rows = []
    seen = set()
    for i, line in enumerate(lines[:-2]):
        if not is_word_line(line):
            continue
        next_line = clean_space(lines[i + 1])
        if not PHONETIC_RE.match(next_line):
            continue
        word = normalize_word(line)
        if not word or word in seen:
            continue
        definition_parts = []
        for raw in lines[i + 2:i + 8]:
            item = clean_space(raw)
            if not item:
                if definition_parts:
                    break
                continue
            if is_word_line(item):
                break
            if MARKER_RE.match(item):
                if definition_parts:
                    break
                continue
            if JUNIOR_POS_RE.match(item) or definition_parts:
                definition_parts.append(item)
        definition = clean_definition(" ".join(definition_parts))
        if definition:
            rows.append({
                "word": word,
                "phonetic": clean_phonetic(next_line),
                "definition": definition,
                "example": "",
            })
            seen.add(word)
    return rows


def looks_like_definition(text):
    return bool(re.search(r"\b(n|v|vt|vi|adj|adv|prep|conj|pron|num|art)\.?\b|[\u4e00-\u9fff]", text, re.I))


def parse_senior(text):
    rows = []
    seen = set()
    in_word_lists = False
    for raw in text.splitlines():
        if re.search(r"Wo.?d List\s+1\s+\+-\s+3", raw) or re.match(r"^\s*member\s{2,}n", raw):
            in_word_lists = True
        if not in_word_lists:
            continue
        if len(raw) - len(raw.lstrip(" ")) > 4:
            continue
        line = clean_space(raw)
        if not line or line.lower().startswith("word list"):
            continue
        if "附录" in line or "索剖" in line:
            break
        line = line.replace("。", "o")
        line = re.sub(r"^repl\s+ace\b", "replace", line)
        line = re.sub(r"^([a-z]{2,})\s+[「『]\s+", r"\1r ", line)
        match = SENIOR_ENTRY_RE.match(line)
        if not match:
            continue
        word = normalize_word(match.group(1))
        definition = clean_definition(match.group(2))
        if word in SENIOR_CORRECTIONS:
            definition = SENIOR_CORRECTIONS[word]
        if not word or word in seen or not looks_like_definition(definition):
            continue
        if len(word) < 2 or (len(word) == 2 and word not in VALID_SHORT_WORDS) or len(definition) < 2:
            continue
        rows.append({
            "word": word,
            "phonetic": "",
            "definition": definition,
            "example": "",
        })
        seen.add(word)
    return rows


def write_csv(level, rows):
    out_dir = SOURCE_DIR / level
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "words.csv"
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["word", "phonetic", "definition", "example"])
        writer.writeheader()
        writer.writerows(rows)
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Clean local junior/senior vocabulary PDFs into dictionary import CSV files.")
    parser.add_argument("--junior", type=Path, default=DEFAULT_JUNIOR)
    parser.add_argument("--senior", type=Path, default=DEFAULT_SENIOR)
    args = parser.parse_args()

    junior_rows = parse_junior(extract_text(args.junior))
    senior_rows = parse_senior(extract_text(args.senior))
    junior_path = write_csv("junior", junior_rows)
    senior_path = write_csv("senior", senior_rows)

    print(f"junior: {len(junior_rows)} -> {junior_path}")
    print(f"senior: {len(senior_rows)} -> {senior_path}")


if __name__ == "__main__":
    main()
