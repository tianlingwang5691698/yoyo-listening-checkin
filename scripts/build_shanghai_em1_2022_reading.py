#!/usr/bin/env python3
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


YEAR = int(os.environ.get('EM1_YEAR', '2022'))
DEFAULT_SOURCE_ROOTS = {
    2022: '/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/一模/2022年上海市中考英语一模试卷（14区，听力全）',
    2023: '/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/一模/2023年上海市中考英语一模试卷（16区听力全）',
}
SOURCE_ROOT = Path(os.environ.get('EM1_SOURCE_ROOT', DEFAULT_SOURCE_ROOTS.get(YEAR, DEFAULT_SOURCE_ROOTS[2022])))
DEFAULT_WORD_ROOT = SOURCE_ROOT / '【1】试卷word版'
WORD_ROOT = DEFAULT_WORD_ROOT if DEFAULT_WORD_ROOT.exists() else SOURCE_ROOT
ONLINE_BACKUP = Path(os.environ.get('EM1_ONLINE_BACKUP', 'tmp/cloud-backups/reading-em1-reading-passages-2026-07-07.json'))
FORMAL_OUT = Path(f'data/imports/shanghai-em1-{YEAR}-reading/formal')
UPLOAD_OUT = Path('data/reading-em1')

DISTRICTS = ['黄浦', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '浦东新区', '浦东', '金山', '松江', '青浦', '奉贤', '崇明']
SECTION_META = {
    'A': {'sectionLabel': '阅读选择', 'difficultyLevel': 1, 'difficultyLabel': '基础理解', 'questionType': 'choice'},
    'B': {'sectionLabel': '完形填空', 'difficultyLevel': 2, 'difficultyLabel': '语境词汇', 'questionType': 'choice'},
    'C': {'sectionLabel': '首字母填空', 'difficultyLevel': 3, 'difficultyLabel': '综合运用', 'questionType': 'blank'},
    'D': {'sectionLabel': '回答问题', 'difficultyLevel': 4, 'difficultyLabel': '表达输出', 'questionType': 'answer'},
}

BAOSHAN_OCR_ANSWERS = {
    59: 'D', 60: 'A', 61: 'C', 62: 'D', 63: 'B', 64: 'C',
    65: 'D', 66: 'B', 67: 'A', 68: 'C', 69: 'B', 70: 'D',
    71: 'important', 72: 'organizes', 73: 'Activities', 74: 'products', 75: 'since', 76: 'learn', 77: 'Anyone',
    78: 'Yes.',
    79: 'When she was eight years old.',
    80: 'She met all of the needs.',
    81: 'By learning about each child.',
    82: 'To let the children who get the blanket feel loved and cared.',
    83: 'Everyone should do something kind to others.',
}


def clean(text):
    text = str(text or '').replace('\f', ' ').replace('\u3000', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def run_textutil(path):
    result = subprocess.run(['textutil', '-convert', 'txt', '-stdout', str(path)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=90)
    return result.stdout


def ocr_image(path):
    result = subprocess.run(['tesseract', str(path), 'stdout', '-l', 'eng'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=90)
    return result.stdout


def ocr_pdf(path, max_pages=8):
    with tempfile.TemporaryDirectory() as tmpdir:
        prefix = str(Path(tmpdir) / 'page')
        subprocess.run(['pdftoppm', '-f', '1', '-l', str(max_pages), '-r', '120', '-png', str(path), prefix], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        texts = []
        for image in sorted(Path(tmpdir).glob('page-*.png')):
            texts.append(ocr_image(image))
        return '\n'.join(texts)


def iter_docx_blocks(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, parent)
        elif child.tag.endswith('}tbl'):
            yield Table(child, parent)


def read_docx_ordered(path):
    doc = Document(path)
    parts = []
    for block in iter_docx_blocks(doc):
        if isinstance(block, Paragraph):
            text = clean(block.text)
            if text:
                parts.append(text)
        else:
            rows = []
            for row in block.rows:
                cells = [clean(cell.text) for cell in row.cells if clean(cell.text)]
                if cells:
                    rows.append(' | '.join(cells))
            if rows:
                parts.append(' / '.join(rows))
    return '\n'.join(parts)


def read_text(path):
    suffix = path.suffix.lower()
    if suffix == '.docx':
        return read_docx_ordered(path)
    if suffix == '.doc':
        return run_textutil(path)
    if suffix == '.pdf':
        result = subprocess.run(['pdftotext', '-layout', str(path), '-'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=90)
        return result.stdout
    if suffix in {'.jpg', '.jpeg', '.png'}:
        return ocr_image(path)
    return ''


def read_source_text(path):
    text = read_text(path)
    if path.suffix.lower() == '.pdf' and len(clean(text)) < 500:
        return ocr_pdf(path, max_pages=14)
    return text


def district_of(path):
    text = str(path)
    for district in DISTRICTS:
        if district in text:
            return {'浦东新区': '浦东'}.get(district, district)
    return ''


def collect_files():
    papers = {}
    answers = {}
    for path in WORD_ROOT.rglob('*'):
        suffix = path.suffix.lower()
        if not path.is_file() or suffix not in {'.docx', '.doc', '.pdf', '.jpg', '.jpeg', '.png'}:
            continue
        if any(part in str(path) for part in ['分项汇编', '答题卡']):
            continue
        district = district_of(path)
        if not district:
            continue
        name = path.name
        path_text = str(path)
        is_english = '英语' in name or '/英语/' in path_text
        is_original = is_english and ('原卷' in name or ('试卷' in name and not any(token in name for token in ['答案', '解析版', '答题纸', '听力文字', '听力文稿'])))
        is_answer = is_english and ('答案' in name or '解析版' in name or '参考答案' in name or '点评与解析' in name)
        if is_answer and not is_original:
            answers.setdefault(district, []).append(path)
            continue
        if suffix in {'.jpg', '.jpeg', '.png'}:
            continue
        if not is_original:
            continue
        score = 0
        if suffix == '.docx':
            score += 20
        if suffix == '.pdf':
            score += 10
        if '原卷' in name:
            score += 30
        if 'Word官方版' in path_text:
            score += 12
        if '分科目整理' in path_text:
            score += 10
        if '官方' in name:
            score += 8
        if '精校' in name:
            score += 6
        if district not in papers or score > papers[district][0]:
            papers[district] = (score, path)
    return {district: item[1] for district, item in papers.items()}, answers


def reading_tail(text):
    source = clean(text)
    starts = [m.start() for m in re.finditer(r'(?:Part\s*3.*?Reading.*?Writing|VI\.?\s*Reading|Ⅵ\.?\s*Reading|Reading comprehension|Reading Comprehension)', source, re.I)]
    if starts:
        source = source[starts[-1]:]
    end = re.search(r'(?:VII|Ⅶ)\.?\s*Writing', source, re.I)
    return source[:end.start()] if end else source


def answer_number_offset(chunk):
    numbers = [int(value) for value in re.findall(r'(?:^|\s)(\d{2})\s*[\.．、-]', chunk)]
    if not numbers:
        return 0
    low, high = min(numbers), max(numbers)
    if 39 <= low and high <= 63:
        return 20
    if 55 <= low and high <= 79:
        return 4
    return 0


def normalize_answer_value(value, number):
    value = clean(value)
    value = re.sub(r'^[\(（]([A-Za-z])[\)）]', r'\1', value)
    value = value.replace('##', '/')
    value = re.split(r'\s*/\s*|（|\(|;|；|，|, any reasonable|Any reasonable', value, maxsplit=1)[0]
    value = re.split(r'【|D[\.．、]?\s*Answer|VII|Ⅶ', value, maxsplit=1, flags=re.I)[0]
    value = re.sub(r'^[①②③④⑤⑥⑦⑧⑨⑩]\s*', '', value)
    value = clean(value).strip(' .。')
    if number <= 70:
        m = re.search(r'\b([A-D])\b', value)
        return m.group(1) if m else ''
    return value


def parse_answer_text(text):
    tail = reading_tail(text)
    chunks = re.findall(r'【答案】([\s\S]*?)(?=【解析】|【分析】|【详解】|【导语】|VII|Ⅶ|$)', tail)
    if not chunks:
        chunks = [tail]
    answers = {}
    for chunk in chunks:
        chunk = clean(chunk)
        offset = answer_number_offset(chunk)
        for start, end, letters in re.findall(r'(\d{2})\s*[-－—]\s*(\d{2})\s*([A-D](?:\s*[A-D]){4,7})', chunk):
            raw_start = int(start)
            start_num = raw_start + offset
            letters = re.sub(r'\s+', '', letters)
            for index, letter in enumerate(letters):
                answers[raw_start + index] = letter
                answers[start_num + index] = letter
        for number, letter in re.findall(r'(?:^|\s)(\d{2})\s*[\.．、]?\s*([A-D])(?=\s|$)', chunk):
            raw_number = int(number)
            n = raw_number + offset
            if 39 <= raw_number <= 83:
                answers[raw_number] = letter
            if 59 <= n <= 70:
                answers[n] = letter
        for match in re.finditer(r'(?:^|\s)(\d{2})\s*[\.．、]\s*(.*?)(?=\s+\d{2}\s*[\.．、]|\s+(?:VII|Ⅶ)\.?\s*Writing|$)', chunk):
            raw_number = int(match.group(1))
            n = raw_number + offset
            if 71 <= n <= 83:
                value = normalize_answer_value(match.group(2), n)
                if value:
                    answers[n] = value
            if 51 <= raw_number <= 83:
                value = normalize_answer_value(match.group(2), raw_number)
                if value:
                    answers[raw_number] = value
    return answers


def answer_map(district, answer_paths):
    answers = {}
    ordered_paths = sorted(answer_paths, key=lambda path: (0 if '答案' in path.name and '解析' not in path.name else 1, path.name))
    for path in ordered_paths:
        parsed = parse_answer_text(read_text(path))
        if not parsed and path.suffix.lower() == '.pdf':
            parsed = parse_answer_text(ocr_pdf(path))
        for number, value in parsed.items():
            answers.setdefault(number, value)
    if YEAR == 2022 and district == '宝山':
        answers.update(BAOSHAN_OCR_ANSWERS)
    return answers


def section_positions(text):
    source = reading_tail(text)
    patterns = {
        'A': r'(?:^|\s)(?:A[\.．、]\s*)?Choose the best answer',
        'B': r'(?:^|\s)(?:B[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?Choose (?:the )?(?:best )?(?:words?|answer|expressions).{0,100}?(?:complete|passage)',
        'C': r'(?:^|\s)(?:C[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?(?:(?:Read the passage and )?Fill? in the blanks|Read the passage and fill)',
        'D': r'(?:^|\s)(?:D[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?(?:Answer the questions|Read (?:and answer|the passage.*?answer))',
    }
    found = []
    for section, pattern in patterns.items():
        match = re.search(pattern, source, re.I)
        if match:
            found.append((match.start(), section))
    found.sort()
    blocks = {}
    for index, (start, section) in enumerate(found):
        end = found[index + 1][0] if index + 1 < len(found) else len(source)
        blocks[section] = source[start:end]
    return blocks


def strip_section_header(text, section):
    text = clean(text)
    if section == 'A':
        text = re.sub(r'^(?:A[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?Choose the best answer.*?(?:\)|）|\.)(?:\s*[（(]\d+分[）)])?', '', text, flags=re.I)
    elif section == 'B':
        text = re.sub(r'^(?:B[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?Choose.*?(?:passage|短文).*?(?:\)|）|\.)(?:\s*[（(]\d+分[）)])?', '', text, flags=re.I)
    elif section == 'C':
        text = re.sub(r'^(?:C[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?(?:Read the passage and )?Fill?.*?(?:首字母已给|首字母已给\)|\.)', '', text, flags=re.I)
    elif section == 'D':
        text = re.sub(r'^(?:D[\.．、]?\s*(?:[（(]\d+分[）)]\s*)?)?(?:Answer the questions|Read (?:and answer|the passage.*?answer)).*?(?:\)|）|\.)(?:\s*[（(]\d+分[）)])?', '', text, flags=re.I)
    return clean(text)


def parse_options(chunk):
    options = {}
    for match in re.finditer(r'(?:^|\s)([A-D])[\)）\.．、]\s*(.*?)(?=\s+[A-D][\)）\.．、]\s*|$)', clean(chunk), re.S):
        value = clean(match.group(2))
        value = re.split(r'\s*(?:【|\[)\s*(?:答案|解析)|\s+\d{2}\s*[\.．、]\s+', value, maxsplit=1)[0]
        options[match.group(1)] = clean(value)
    return options


def has_choice_options_near(text, pos):
    lookahead = text[pos:pos + 420]
    return all(re.search(rf'(?:^|\s){key}[\)）\.．、]\s*', lookahead) for key in ['A', 'B', 'C', 'D'])


def section_number_offset(section, source_number):
    starts = {'A': 59, 'B': 65, 'C': 71, 'D': 78}
    return starts[section] - int(source_number)


def normalized_question_number(section, source_number, offset):
    return int(source_number) + offset


def source_choice_positions(body, min_count=5):
    positions = [
        (int(m.group(1)), m.start(), m.end())
        for m in re.finditer(r'(?:^|\s)(\d{2})[\.．、]\s+', body)
        if has_choice_options_near(body, m.end())
    ]
    return positions if len(positions) >= min_count else []


def source_number_positions(body, low=1, high=99):
    return [
        (int(m.group(1)), m.start(), m.end())
        for m in re.finditer(r'(?:^|\s)(\d{2})[\.．、]\s+', body)
        if low <= int(m.group(1)) <= high
    ]


def first_question_pos(text, start, end, require_options=False):
    for match in re.finditer(r'(?:^|\s)(\d{2})[\.．、]\s+', text):
        number = int(match.group(1))
        if start <= number <= end and (not require_options or has_choice_options_near(text, match.end())):
            return match.start()
    return -1


def passage_before_questions(block, start, end, section):
    body = strip_section_header(block, section)
    pos = -1
    if section in {'A', 'B'}:
        positions = source_choice_positions(body)
        pos = positions[0][1] if positions else -1
    elif section == 'C':
        pos = -1
    else:
        positions = source_number_positions(body)
        pos = positions[0][1] if positions else -1
    return clean(body[:pos] if pos >= 0 else body)


def parse_choice_questions(block, answers, start, end):
    body = strip_section_header(block, 'A' if start == 59 else 'B')
    positions = source_choice_positions(body)
    if not positions:
        return []
    section = 'A' if start == 59 else 'B'
    offset = section_number_offset(section, positions[0][0])
    questions = []
    for index, (number, start_pos, content_start) in enumerate(positions):
        normalized_number = normalized_question_number(section, number, offset)
        if not (start <= normalized_number <= end):
            continue
        chunk_end = positions[index + 1][1] if index + 1 < len(positions) else len(body)
        chunk = body[content_start:chunk_end]
        option_start = re.search(r'(?:^|\s)A[\)）\.．、]\s*', chunk)
        if not option_start:
            continue
        prompt = clean(chunk[:option_start.start()])
        if not prompt and start == 65:
            prompt = f'___{normalized_number}___'
        options = parse_options(chunk[option_start.start():])
        answer = answers.get(normalized_number, '') or answers.get(number, '')
        if prompt and answer in ['A', 'B', 'C', 'D'] and all(options.get(k) for k in ['A', 'B', 'C', 'D']):
            questions.append({
                'number': normalized_number,
                'prompt': prompt,
                'options': {k: options[k] for k in ['A', 'B', 'C', 'D']},
                'answer': answer,
                'questionType': 'choice',
            })
    return questions


def parse_cloze_questions(passage, answers):
    questions = []
    blanks = list(re.finditer(r'([A-Za-z])?[_＿]{2,}(\d{2})[_＿]{2,}', passage))
    if not blanks:
        return []
    offset = section_number_offset('C', int(blanks[0].group(2)))
    for match in blanks:
        source_number = int(match.group(2))
        number = normalized_question_number('C', source_number, offset)
        answer = answers.get(number, '') or answers.get(source_number, '')
        if 71 <= number <= 77 and answer:
            questions.append({
                'number': number,
                'prompt': match.group(0),
                'answer': answer,
                'questionType': 'blank',
            })
    seen = set()
    out = []
    for question in questions:
        if question['number'] not in seen:
            out.append(question)
            seen.add(question['number'])
    return out


def parse_answer_questions(block, answers):
    body = strip_section_header(block, 'D')
    positions = source_number_positions(body)
    if not positions:
        return []
    offset = section_number_offset('D', positions[0][0])
    questions = []
    for index, (number, start_pos, content_start) in enumerate(positions):
        normalized_number = normalized_question_number('D', number, offset)
        if not (78 <= normalized_number <= 83):
            continue
        chunk_end = positions[index + 1][1] if index + 1 < len(positions) else len(body)
        prompt = clean(body[content_start:chunk_end])
        prompt = re.sub(r'[_＿]{3,}', '________', prompt).strip()
        answer = answers.get(number, '')
        answer = answers.get(normalized_number, answer)
        if '?' in answer or '？' in answer or '___' in answer or '【' in answer:
            answer = ''
        if prompt and answer:
            questions.append({
                'number': normalized_number,
                'prompt': prompt,
                'answer': answer,
                'questionType': 'answer',
            })
    return questions


def build_item(district, source, section, passage, questions):
    meta = SECTION_META[section]
    return {
        '_id': f'sh-em1-{YEAR}-{district}-reading-{section.lower()}',
        'title': f'{YEAR} 上海{district}一模阅读 {section}',
        'year': YEAR,
        'city': '上海',
        'district': district,
        'examType': '一模',
        'section': section,
        'sourceType': 'shanghai-mock',
        'sourceFile': source.name,
        'passage': passage,
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': [],
        'sectionLabel': meta['sectionLabel'],
        'difficultyLevel': meta['difficultyLevel'],
        'difficultyLabel': meta['difficultyLabel'],
    }


def accepted(section, passage, questions):
    if len(clean(passage)) < 500 or len(questions) < 5:
        return False
    if section in {'A', 'B'}:
        return all(
            q.get('questionType') == 'choice'
            and q.get('answer') in ['A', 'B', 'C', 'D']
            and all(q.get('options', {}).get(k) for k in ['A', 'B', 'C', 'D'])
            for q in questions
        )
    expected_type = 'blank' if section == 'C' else 'answer'
    return all(q.get('questionType') == expected_type and q.get('answer') for q in questions)


def reject_reason(section, passage, questions):
    reasons = []
    if len(clean(passage)) < 500:
        reasons.append('passage too short or missing')
    if len(questions) < 5:
        reasons.append('less than 5 valid questions')
    if section in {'A', 'B'} and questions:
        bad = [q.get('number') for q in questions if q.get('answer') not in ['A', 'B', 'C', 'D'] or not all(q.get('options', {}).get(k) for k in ['A', 'B', 'C', 'D'])]
        if bad:
            reasons.append(f'incomplete choice options or answers: {bad}')
    if section in {'C', 'D'} and questions:
        bad = [q.get('number') for q in questions if not q.get('answer')]
        if bad:
            reasons.append(f'missing answers: {bad}')
    return '; '.join(reasons) or 'not accepted'


def valid_formal_item(item):
    required = ['_id', 'title', 'year', 'district', 'examType', 'section', 'sourceFile', 'passage', 'questions']
    if not all(item.get(field) for field in required):
        return False
    numbers = [question.get('number') for question in item.get('questions', [])]
    if any(not isinstance(number, int) for number in numbers) or len(numbers) != len(set(numbers)):
        return False
    if any(not clean(question.get('prompt')) for question in item.get('questions', [])):
        return False
    return accepted(item.get('section'), item.get('passage'), item.get('questions'))


def merge_incremental(new_items):
    formal_baseline = UPLOAD_OUT / 'reading-passages.json'
    baseline_path = formal_baseline if formal_baseline.exists() else ONLINE_BACKUP
    base = json.loads(baseline_path.read_text(encoding='utf-8')) if baseline_path.exists() else []
    invalid_base = [item.get('_id', '<missing-id>') for item in base if not valid_formal_item(item)]
    if invalid_base:
        raise ValueError(f'formal baseline contains invalid passages: {invalid_base}')
    base_ids = [item['_id'] for item in base]
    if len(base_ids) != len(set(base_ids)):
        raise ValueError('formal baseline contains duplicate passage ids')
    by_id = {item['_id']: item for item in base}
    added = []
    for item in new_items:
        if valid_formal_item(item) and item['_id'] not in by_id:
            by_id[item['_id']] = item
            added.append(item['_id'])
    merged = base + [by_id[item_id] for item_id in added]
    return merged, added, len(base)


def main():
    papers, answer_paths = collect_files()
    formal = []
    report = []
    for district in sorted(papers):
        source = papers[district]
        text = read_source_text(source)
        answers = answer_map(district, answer_paths.get(district, []))
        blocks = section_positions(text)
        row = {'year': YEAR, 'district': district, 'sourceFile': str(source), 'answerCount': len([k for k in answers if 59 <= k <= 83])}
        for section in ['A', 'B', 'C', 'D']:
            block = blocks.get(section, '')
            if section == 'A':
                passage = passage_before_questions(block, 59, 64, section)
                questions = parse_choice_questions(block, answers, 59, 64)
            elif section == 'B':
                passage = passage_before_questions(block, 65, 70, section)
                questions = parse_choice_questions(block, answers, 65, 70)
            elif section == 'C':
                passage = passage_before_questions(block, 71, 77, section)
                questions = parse_cloze_questions(passage, answers)
            else:
                passage = passage_before_questions(block, 78, 83, section)
                questions = parse_answer_questions(block, answers)
            ok = accepted(section, passage, questions)
            row[f'{section}PassageChars'] = len(passage)
            row[f'{section}Questions'] = len(questions)
            row[f'{section}Accepted'] = ok
            if not ok:
                row[f'{section}RejectReason'] = reject_reason(section, passage, questions)
            if ok:
                formal.append(build_item(district, source, section, passage, questions))
        report.append(row)

    merged, added, before_count = merge_incremental(formal)
    FORMAL_OUT.mkdir(parents=True, exist_ok=True)
    UPLOAD_OUT.mkdir(parents=True, exist_ok=True)
    formal_text = json.dumps(formal, ensure_ascii=False, indent=2)
    merged_text = json.dumps(merged, ensure_ascii=False, indent=2)
    (FORMAL_OUT / 'reading-passages.formal.json').write_text(formal_text, encoding='utf-8')
    (FORMAL_OUT / 'clean-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (UPLOAD_OUT / 'reading-passages.json').write_text(merged_text, encoding='utf-8')
    (UPLOAD_OUT / 'reading-passages.js').write_text(f'module.exports = {merged_text};\n', encoding='utf-8')
    print(json.dumps({
        'papers': len(papers),
        'formalPassages': len(formal),
        'onlineBefore': before_count,
        'mergedPassages': len(merged),
        'added': len(added),
        'outFile': str(UPLOAD_OUT / 'reading-passages.json'),
        'report': str(FORMAL_OUT / 'clean-report.json'),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
