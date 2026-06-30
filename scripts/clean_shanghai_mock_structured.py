#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


def clean_text(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def valid_options(options):
    return isinstance(options, dict) and all(clean_text(options.get(k)) for k in ['A', 'B', 'C', 'D'])


def valid_answer(answer):
    return clean_text(answer) in ['A', 'B', 'C', 'D']


def invalid_composite_choice(item):
    prompt = clean_text(item.get('prompt'))
    options = item.get('options') or {}
    if re.search(r'\b\d{1,2}[\.．]\s*_+', prompt):
        return True
    option_text = ''.join(clean_text(options.get(k)) for k in ['A', 'B', 'C', 'D'])
    return bool(re.fullmatch(r'[①②③④⑤⑥⑦⑧⑨⑩]+', option_text))


def normalize_question(q):
    item = {
        'number': q.get('number'),
        'prompt': clean_text(q.get('prompt')),
        'options': {k: clean_text((q.get('options') or {}).get(k)) for k in ['A', 'B', 'C', 'D']},
        'answer': clean_text(q.get('answer')).upper()
    }
    if not isinstance(item['number'], int):
        return None
    if invalid_composite_choice(item):
        return None
    if not item['prompt'] or '【' in item['prompt'] or '故选' in item['prompt'] or '考查' in item['prompt']:
        return None
    if not valid_options(item['options']) or not valid_answer(item['answer']):
        return None
    return item


def source_name(path):
    return Path(str(path or '')).name


def formal_reading_item(item):
    passage = str(item.get('passage') or '').strip()
    questions = [normalize_question(q) for q in item.get('questions') or []]
    questions = [q for q in questions if q]
    if not item.get('year') or not item.get('district'):
        return None, 'missing-meta'
    if len(passage) < 500:
        return None, 'missing-passage'
    if len(questions) < 5:
        return None, 'too-few-valid-questions'
    section = item.get('section') or 'A'
    district = item.get('district')
    year = item.get('year')
    return {
        '_id': f"sh-em2-{year}-{district}-reading-{str(section).lower()}",
        'title': f"{year} 上海{district}二模阅读 {section}",
        'year': year,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'section': section,
        'sourceType': 'shanghai-mock',
        'sourceFile': source_name(item.get('sourceFile')),
        'passage': passage,
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': []
    }, ''


def formal_grammar_item(item):
    questions = [normalize_question(q) for q in item.get('questions') or []]
    questions = [q for q in questions if q]
    if not item.get('year') or not item.get('district'):
        return None, 'missing-meta'
    if len(questions) != 15:
        return None, 'question-count-not-15'
    district = item.get('district')
    year = item.get('year')
    return {
        '_id': f"sh-em2-{year}-{district}-grammar-choice",
        'title': f"{year} 上海{district}二模语法单选",
        'year': year,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'section': 'grammar-choice',
        'sourceType': 'shanghai-mock',
        'sourceFile': source_name(item.get('sourceFile')),
        'questions': questions
    }, ''


def dedupe(items):
    out = {}
    for item in items:
        key = item['_id']
        prev = out.get(key)
        if not prev or len(item.get('questions') or []) > len(prev.get('questions') or []):
            out[key] = item
    return list(out.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='data/imports/shanghai-em2')
    parser.add_argument('--out-dir', default='')
    args = parser.parse_args()
    root = Path(args.root)
    out = Path(args.out_dir) if args.out_dir else root / 'formal'
    readings_raw = json.loads((root / 'reading.json').read_text(encoding='utf-8'))
    grammars_raw = json.loads((root / 'grammar-choice.json').read_text(encoding='utf-8'))
    readings, grammars, rejected = [], [], []

    for item in readings_raw:
        formal, reason = formal_reading_item(item)
        if formal:
            readings.append(formal)
        else:
            rejected.append({'type': 'reading', 'title': item.get('title'), 'sourceFile': item.get('sourceFile'), 'reason': reason})

    for item in grammars_raw:
        formal, reason = formal_grammar_item(item)
        if formal:
            grammars.append(formal)
        else:
            rejected.append({'type': 'grammar-choice', 'title': item.get('title'), 'sourceFile': item.get('sourceFile'), 'reason': reason})

    readings = dedupe(readings)
    grammars = dedupe(grammars)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'reading-passages.formal.json').write_text(json.dumps(readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'grammar-choice.formal.json').write_text(json.dumps(grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'clean-report.json').write_text(json.dumps({
        'readingInput': len(readings_raw),
        'readingFormal': len(readings),
        'grammarInput': len(grammars_raw),
        'grammarFormal': len(grammars),
        'rejected': rejected
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'readingFormal': len(readings),
        'grammarFormal': len(grammars),
        'outDir': str(out)
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
