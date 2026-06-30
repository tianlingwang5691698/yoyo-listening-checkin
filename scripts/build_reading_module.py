#!/usr/bin/env python3
import json
import re
from pathlib import Path


SOURCES = [
    Path('data/imports/shanghai-em2-2012-2021/formal/reading-passages.formal.json'),
    Path('data/imports/shanghai-em2/formal/reading-passages.formal.json'),
    Path('data/imports/shanghai-em2-2024/formal/reading-passages.formal.json'),
    Path('data/imports/shanghai-em2-2025/formal/reading-passages.formal.json'),
    Path('data/imports/shanghai-em2-2026/formal/reading-passages.formal.json'),
]
OUT = Path('data/reading')

SECTION_META = {
    'A': {'sectionLabel': '阅读选择', 'difficultyLevel': 1, 'difficultyLabel': '基础理解'},
    'B': {'sectionLabel': '完形填空', 'difficultyLevel': 2, 'difficultyLabel': '语境词汇'},
    'C': {'sectionLabel': '首字母填空', 'difficultyLevel': 3, 'difficultyLabel': '综合运用'},
    'D': {'sectionLabel': '回答问题', 'difficultyLevel': 4, 'difficultyLabel': '表达输出'},
}


def score(item):
    return (len(item.get('questions') or []), len(item.get('passage') or ''))


def clean_text(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def invalid_composite_choice(question):
    prompt = clean_text(question.get('prompt'))
    options = question.get('options') or {}
    if re.search(r'\b\d{1,2}[\.．]\s*_+', prompt):
        return True
    option_text = ''.join(clean_text(options.get(k)) for k in ['A', 'B', 'C', 'D'])
    return bool(re.fullmatch(r'[①②③④⑤⑥⑦⑧⑨⑩]+', option_text))


def normalize_questions(item):
    questions = []
    for question in item.get('questions') or []:
        if invalid_composite_choice(question):
            continue
        questions.append(question)
    return questions


def main():
    by_id = {}
    for source in SOURCES:
        if not source.exists():
            continue
        for item in json.loads(source.read_text(encoding='utf-8')):
            prev = by_id.get(item.get('_id'))
            if not prev or score(item) > score(prev):
                by_id[item['_id']] = item

    items = []
    for item in by_id.values():
        meta = SECTION_META.get(item.get('section'), {})
        next_item = dict(item)
        next_item.update(meta)
        next_item['questions'] = normalize_questions(next_item)
        if len(next_item['questions']) < 5:
            continue
        items.append(next_item)
    items = sorted(items, key=lambda x: (x.get('year') or 0, x.get('district') or '', x.get('section') or ''))
    OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(items, ensure_ascii=False, indent=2)
    (OUT / 'reading-passages.json').write_text(text, encoding='utf-8')
    (OUT / 'reading-passages.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    (OUT / 'README.md').write_text(
        '# 阅读模块数据\n\n本目录为上海中考二模阅读 A/B/C/D 正式题库。上传云存储时可对应 `_content/reading/reading-passages.json`。\n',
        encoding='utf-8',
    )
    print(json.dumps({'passages': len(items), 'outFile': str(OUT / 'reading-passages.json')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
