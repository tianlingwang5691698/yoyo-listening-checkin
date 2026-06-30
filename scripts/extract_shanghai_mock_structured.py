#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


DISTRICTS = ['黄浦', '黄埔', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '浦东', '浦东新区', '金山', '松江', '青浦', '奉贤', '崇明']


def clean(text):
    return re.sub(r'\s+', ' ', str(text or '').replace('\u3000', ' ')).strip()


def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            text = clean(Paragraph(child, doc).text)
            if text:
                yield {'type': 'p', 'text': text}
        elif isinstance(child, CT_Tbl):
            rows = []
            for row in Table(child, doc).rows:
                cells = [clean(cell.text) for cell in row.cells if clean(cell.text)]
                if cells:
                    rows.append(cells)
            if rows:
                yield {'type': 'table', 'rows': rows, 'text': '\n'.join(' '.join(row) for row in rows)}


def read_docx(path):
    return list(iter_blocks(Document(path)))


def meta_from_path(path):
    text = str(path)
    year = None
    m = re.search(r'(20\d{2}|201\d)年', text)
    if m:
        year = int(m.group(1))
    district = ''
    for item in DISTRICTS:
        if item in text:
            district = {'浦东新区': '浦东', '黄埔': '黄浦'}.get(item, item)
            break
    return {
        'year': year,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'sourceFile': str(path)
    }


def answer_map(text):
    out = {}
    for start, end, answers in re.findall(r'(\d{1,2})\s*[-－—]\s*(\d{1,2})\s*([A-D]{2,})\b', text):
        start_num = int(start)
        end_num = int(end)
        if len(answers) == end_num - start_num + 1:
            for offset, answer in enumerate(answers):
                out[start_num + offset] = answer
    for num, ans in re.findall(r'(\d{1,2})\s*[\.．、]?\s*([A-D])\b', text):
        out[int(num)] = ans
    return out


def split_options(text):
    parts = re.split(r'\s+(?=[A-D][\.．]\s*)', clean(text))
    opts = {}
    for part in parts:
        m = re.match(r'([A-D])[\.．]\s*(.+)', part)
        if m:
            opts[m.group(1)] = clean(m.group(2))
    return opts


def section_range(blocks, start_re, end_re):
    start = None
    end = len(blocks)
    for i, block in enumerate(blocks):
        if start is None and re.search(start_re, block['text'], re.I):
            start = i
            continue
        if start is not None and re.search(end_re, block['text'], re.I):
            end = i
            break
    return blocks[start:end] if start is not None else []


def parse_choice_section(blocks, section, meta):
    numbered_answers = {}
    for block in blocks:
        if '【答案】' in block['text']:
            numbered_answers.update(answer_map(block['text']))

    questions = []
    current = None
    i = 0
    while i < len(blocks):
        block = blocks[i]
        text = block['text']
        if '【答案】' in text:
            if current:
                direct = re.search(r'【答案】\s*([A-D])\b', text)
                if direct:
                    current['answer'] = direct.group(1)
                for number, answer in answer_map(text).items():
                    if current and current['number'] == number:
                        current['answer'] = answer
            i += 1
            continue
        if '【解析】' in text or re.match(r'【\d+题详解】', text) or text.startswith('【详解】'):
            i += 1
            continue
        m = re.match(r'^(\d{1,2})[\.．]?\s*(.*)', text)
        if m:
            lookahead = ' '.join(blocks[j]['text'] for j in range(i, min(i + 4, len(blocks))))
            if not split_options(lookahead):
                i += 1
                continue
            if current:
                questions.append(current)
            current = {
                'number': int(m.group(1)),
                'prompt': clean(m.group(2)),
                'options': {},
                'answer': numbered_answers.get(int(m.group(1)), '')
            }
            opts = split_options(text)
            if opts:
                current['options'].update(opts)
                current['prompt'] = clean(re.split(r'\s+A[\.．]\s*', current['prompt'])[0])
            i += 1
            continue
        if current:
            opts = split_options(text)
            if opts:
                current['options'].update(opts)
            elif not current['options'] and not re.search(r'^[A-D][\.．]', text):
                current['prompt'] = clean(current['prompt'] + ' ' + text)
        i += 1
    if current:
        questions.append(current)

    by_number = {}
    for q in questions:
        opts = q.get('options') or {}
        if all(opts.get(k) for k in ['A', 'B', 'C', 'D']):
            by_number[q['number']] = q
        elif len(opts) == 1 and re.search(r'故选|答案', q.get('prompt', '')):
            answer = next(iter(opts))
            if q['number'] in by_number:
                by_number[q['number']]['answer'] = answer
    questions = [q for q in questions if all((q.get('options') or {}).get(k) for k in ['A', 'B', 'C', 'D'])]

    return {
        **meta,
        'section': section,
        'questionType': 'choice',
        'questions': questions
    }


def parse_reading_a(blocks, meta):
    sec = section_range(
        blocks,
        r'A\.\s*Choose the best answer',
        r'B\.\s*(Choose the best answer and complete the passage|Choose the best words or expressions and complete the passage)'
    )
    if not sec:
        return None
    passage_parts = []
    for block in sec:
        text = block['text']
        if re.match(r'^\d{1,2}[\.．]\s*', text) or '【答案】' in text:
            break
        if 'Choose the best answer' not in text and '【解析】' not in text:
            passage_parts.append(text)
    parsed = parse_choice_section(sec, 'A', meta)
    parsed.update({
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{(meta.get('district') or 'unknown').lower()}-reading-a",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模阅读 A".strip(),
        'passage': '\n'.join(passage_parts)
    })
    return parsed if parsed['questions'] else None


def parse_reading_b(blocks, meta):
    sec = section_range(
        blocks,
        r'B\.\s*(Choose the best answer and complete the passage|Choose the best words or expressions and complete the passage)',
        r'C\.\s*Fill in the blanks'
    )
    if not sec:
        return None
    parsed = parse_choice_section(sec, 'B', meta)
    passage_parts = []
    for block in sec:
        text = block['text']
        if re.match(r'^\d{1,2}[\.．]\s*$', text) or re.match(r'^A[\.．]\s*', text) or '【答案】' in text:
            break
        if 'Choose the best answer' not in text and '【解析】' not in text:
            passage_parts.append(text)
    parsed.update({
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{(meta.get('district') or 'unknown').lower()}-reading-b",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模阅读 B".strip(),
        'passage': '\n'.join(passage_parts)
    })
    return parsed if parsed['questions'] else None


def parse_grammar(blocks, meta):
    sec = section_range(
        blocks,
        r'(Ⅱ|II)\.\s*Choose the best answer',
        r'(Ⅲ|III)\.?|Choose the proper words|complete the following passage|Part\s*3|A\.\s*Choose the best answer'
    )
    if not sec:
        return None
    parsed = parse_choice_section(sec, 'grammar-choice', meta)
    parsed.update({
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{(meta.get('district') or 'unknown').lower()}-grammar-choice",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模语法单选".strip()
    })
    return parsed if parsed['questions'] else None


def collect_files(root):
    files = []
    for path in Path(root).rglob('*.docx'):
        name = path.name
        path_text = str(path)
        if '解析版' in name and not name.startswith('~$') and '专题' not in path_text and '分类汇编' not in path_text:
            files.append(path)
    return sorted(files)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('root')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--out-dir', default='data/imports/shanghai-em2')
    args = parser.parse_args()

    files = collect_files(args.root)
    if args.limit:
        files = files[:args.limit]

    readings = []
    grammars = []
    report = []
    for path in files:
        try:
            blocks = read_docx(path)
            meta = meta_from_path(path)
            grammar = parse_grammar(blocks, meta)
            reading_a = parse_reading_a(blocks, meta)
            reading_b = parse_reading_b(blocks, meta)
            if grammar:
                grammars.append(grammar)
            for item in [reading_a, reading_b]:
                if item:
                    readings.append(item)
            report.append({
                'file': str(path),
                'district': meta.get('district'),
                'year': meta.get('year'),
                'grammarQuestions': len(grammar['questions']) if grammar else 0,
                'readingAQuestions': len(reading_a['questions']) if reading_a else 0,
                'readingAPassageChars': len(reading_a.get('passage', '')) if reading_a else 0,
                'readingBQuestions': len(reading_b['questions']) if reading_b else 0,
                'readingBPassageChars': len(reading_b.get('passage', '')) if reading_b else 0
            })
        except Exception as exc:
            report.append({'file': str(path), 'error': str(exc)})

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'reading.json').write_text(json.dumps(readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (out_dir / 'grammar-choice.json').write_text(json.dumps(grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (out_dir / 'extract-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'files': len(files),
        'readingSets': len(readings),
        'grammarSets': len(grammars),
        'outDir': str(out_dir)
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
