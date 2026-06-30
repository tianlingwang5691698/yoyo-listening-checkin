#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
from pathlib import Path


DISTRICTS = ['黄浦', '黄埔', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '浦东新区', '浦东', '金山', '松江', '青浦', '奉贤', '崇明', '闸北']


def clean(text):
    text = str(text or '').replace('\u3000', ' ').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def read_text(path):
    proc = subprocess.run(
        ['textutil', '-convert', 'txt', '-stdout', str(path)],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode('utf-8', errors='ignore') or 'textutil failed')
    return proc.stdout.decode('utf-8', errors='ignore')


def text_lines(text):
    return [clean(line) for line in text.splitlines() if clean(line)]


def meta_from_path(path):
    path_text = str(path)
    year = None
    match = re.search(r'(20\d{2}|201\d)年', path_text)
    if match:
        year = int(match.group(1))
    found = []
    for item in DISTRICTS:
        if item in path_text:
            norm = {'浦东新区': '浦东', '黄埔': '黄浦'}.get(item, item)
            if norm not in found:
                found.append(norm)
    if '浦东' in found and '浦东新区' in found:
        found = [x for x in found if x != '浦东新区']
    return {
        'year': year,
        'city': '上海',
        'district': ''.join(found[:2]),
        'examType': '二模',
        'sourceFile': str(path),
    }


def answer_map(text):
    out = {}
    text = re.sub(r'\s+', ' ', text or '')
    for start, end, answers in re.findall(r'(\d{1,2})\s*[-－—]\s*(\d{1,2})\s*([A-Da-d]{2,})\b', text):
        start_num = int(start)
        end_num = int(end)
        answers = answers.upper()
        if len(answers) == end_num - start_num + 1:
            for offset, answer in enumerate(answers):
                out[start_num + offset] = answer
    for num, ans in re.findall(r'(\d{1,2})\s*[\.．、]?\s*([A-Da-d])\b', text):
        out[int(num)] = ans.upper()
    return out


def text_answer_map(text):
    out = {}
    for raw_line in str(text or '').splitlines():
        line = clean(raw_line)
        if not line or re.search(r'^(Part|I{1,3}\.|[A-D]\.|参考答案|答案与解析|【解析】|【详解】)', line, re.I):
            continue
        line = re.sub(r'^【答案】\s*', '', line)
        matches = list(re.finditer(r'(?<!\d)(\d{1,2})\s*[\.\、]\s*', line))
        for idx, match in enumerate(matches):
            number = int(match.group(1))
            start = match.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(line)
            value = clean(line[start:end])
            value = re.sub(r'^(答案[:：]?)', '', value).strip()
            if value and not re.fullmatch(r'[A-Da-d]', value):
                out[number] = value
    return out


def split_paper_and_answers(text):
    matches = list(re.finditer(r'(?m)^\s*(参考答案|答案与解析|参考答案及评分标准)\s*$', text))
    if not matches:
        return text, ''
    pos = matches[-1].start()
    return text[:pos], text[pos:]


def split_options(text):
    text = clean(text)
    matches = list(re.finditer(r'([A-D])\s*[\)\.．、]\s*', text))
    opts = {}
    for idx, match in enumerate(matches):
        key = match.group(1)
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        value = clean(text[start:end])
        if value:
            opts[key] = value
    return opts


def strip_options(text):
    first = re.search(r'\s*A\s*[\)\.．、]\s*', text)
    return clean(text[:first.start()] if first else text)


def find_index(lines, pattern, start=0):
    for index in range(start, len(lines)):
        if re.search(pattern, lines[index], re.I):
            return index
    return -1


def section(lines, start_pattern, end_pattern, start=0):
    start_index = find_index(lines, start_pattern, start)
    if start_index < 0:
        return []
    end_index = len(lines)
    for index in range(start_index + 1, len(lines)):
        if re.search(end_pattern, lines[index], re.I):
            end_index = index
            break
    return lines[start_index:end_index]


def parse_choice_section(lines, answers):
    questions = []
    current = None
    for index, line in enumerate(lines):
        if '【答案】' in line:
            direct = re.search(r'【答案】\s*([A-Da-d])\b', line)
            if current and direct:
                current['answer'] = direct.group(1).upper()
            mapped = answer_map(line)
            if current and current.get('number') in mapped:
                current['answer'] = mapped[current['number']]
            continue
        if '【解析】' in line or line.startswith('【详解】') or re.match(r'【\d+题详解】', line):
            continue
        if re.search(r'^(Part|I{1,3}\.|[A-D]\.\s*Choose|C\.\s*Fill|D\.\s*Answer|Ⅲ|III|IV|Ⅴ|V|Ⅵ|VI)\b', line, re.I):
            continue
        match = re.match(r'^(\d{1,2})\s*[\.．]\s*(.*)', line)
        if match:
            lookahead = ' '.join(lines[index:min(index + 5, len(lines))])
            opts = split_options(lookahead)
            if not all(opts.get(k) for k in ['A', 'B', 'C', 'D']):
                if current and not split_options(line):
                    current['prompt'] = clean(current['prompt'] + ' ' + line)
                continue
            if current:
                questions.append(current)
            number = int(match.group(1))
            current = {
                'number': number,
                'prompt': strip_options(match.group(2)),
                'options': {},
                'answer': answers.get(number, ''),
            }
            line_opts = split_options(line)
            if line_opts:
                current['options'].update(line_opts)
            continue
        if current:
            opts = split_options(line)
            if opts:
                current['options'].update(opts)
            elif not all(current['options'].get(k) for k in ['A', 'B', 'C', 'D']):
                current['prompt'] = clean(current['prompt'] + ' ' + line)
    if current:
        questions.append(current)
    return [q for q in questions if all((q.get('options') or {}).get(k) for k in ['A', 'B', 'C', 'D'])]


def parse_grammar(lines, answers, meta):
    sec = section(
        lines,
        r'(Ⅱ|II)\.?\s*Choose the best answer',
        r'(Ⅲ|III)\.?\s*|Complete the following passage|Choose the words',
    )
    questions = parse_choice_section(sec, answers)
    if not questions:
        return None
    return {
        **meta,
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{meta.get('district') or 'unknown'}-grammar-choice",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模语法单选".strip(),
        'section': 'grammar-choice',
        'questionType': 'choice',
        'questions': questions,
    }


def reading_start(lines):
    return find_index(lines, r'Reading comprehension|Reading and Writing|读写')


def parse_reading(lines, answers, meta, part):
    start = reading_start(lines)
    if start < 0:
        start = 0
    if part == 'A':
        sec = section(lines, r'A[\.．]\s*Choose the best answer', r'B[\.．]\s*Choose', start)
    else:
        sec = section(lines, r'B[\.．]\s*Choose.*(complete the passage|words or expressions)', r'C[\.．]\s*Fill|Read the passage and fill|D[\.．]\s*Answer', start)
    if not sec:
        return None
    questions = parse_choice_section(sec, answers)
    first_question = len(sec)
    for index, line in enumerate(sec):
        if re.match(r'^\d{1,2}\s*[\.．]\s*', line) and split_options(' '.join(sec[index:min(index + 5, len(sec))])):
            first_question = index
            break
    passage = '\n'.join(
        line for line in sec[1:first_question]
        if not re.search(r'Choose the best answer|根据.*选择|选择最恰当', line, re.I)
    ).strip()
    if not questions:
        return None
    return {
        **meta,
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{meta.get('district') or 'unknown'}-reading-{part.lower()}",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模阅读 {part}".strip(),
        'section': part,
        'questionType': 'choice',
        'passage': passage,
        'questions': questions,
    }


def parse_fill_reading(lines, text_answers, meta):
    start = reading_start(lines)
    if start < 0:
        start = 0
    sec = section(lines, r'C[\.．]\s*(Fill in the blanks|Read the passage and fill)|Read the passage and fill', r'D[\.．]\s*Answer', start)
    if not sec:
        return None
    questions = []
    for line in sec:
        if re.search(r'Fill in the blanks|首字母|空格', line, re.I):
            continue
        for match in re.finditer(r'([A-Za-z])\s*[_＿]{2,}\s*(\d{1,2})\s*[_＿]{2,}', line):
            number = int(match.group(2))
            questions.append({
                'number': number,
                'prompt': line,
                'answer': text_answers.get(number, ''),
                'questionType': 'blank'
            })
    if not questions:
        return None
    return {
        **meta,
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{meta.get('district') or 'unknown'}-reading-c",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模阅读 C".strip(),
        'section': 'C',
        'questionType': 'blank',
        'passage': '\n'.join(sec[1:]).strip(),
        'questions': questions,
    }


def parse_answer_reading(lines, text_answers, meta):
    start = reading_start(lines)
    if start < 0:
        start = 0
    sec = section(lines, r'D[\.．]\s*Answer', r'(Ⅶ|VII)\.?\s*Writing|Writing|作文', start)
    if not sec:
        return None
    first_question = len(sec)
    for index, line in enumerate(sec):
        if re.match(r'^\d{1,2}\s*[\.．]\s*', line):
            first_question = index
            break
    passage = '\n'.join(sec[1:first_question]).strip()
    questions = []
    for line in sec[first_question:]:
        match = re.match(r'^(\d{1,2})\s*[\.．]\s*(.+)', line)
        if not match:
            continue
        number = int(match.group(1))
        prompt = clean(match.group(2))
        if prompt and not re.search(r'答案|解析|故选', prompt):
            questions.append({
                'number': number,
                'prompt': prompt,
                'answer': text_answers.get(number, ''),
                'questionType': 'answer'
            })
    if not questions:
        return None
    return {
        **meta,
        '_id': f"sh-em2-{meta.get('year') or 'unknown'}-{meta.get('district') or 'unknown'}-reading-d",
        'title': f"{meta.get('year') or ''} 上海{meta.get('district') or ''}二模阅读 D".strip(),
        'section': 'D',
        'questionType': 'answer',
        'passage': passage,
        'questions': questions,
    }


def collect_files(root):
    files = []
    for path in Path(root).rglob('*'):
        if path.suffix.lower() not in ['.doc', '.docx']:
            continue
        text = str(path)
        match = re.search(r'(20\d{2}|201\d)年', text)
        if not match:
            continue
        year = int(match.group(1))
        if not 2012 <= year <= 2021:
            continue
        name = path.name
        if any(skip in text for skip in ['分类汇编', '专项汇编', '押题', '模拟卷', '扫描版', '图片版']):
            continue
        if '答案' in name and not any(key in name for key in ['试题', '解析']):
            continue
        files.append(path)
    return sorted(files)


def collect_doc_files(root):
    files = []
    for path in Path(root).rglob('*'):
        if path.suffix.lower() not in ['.doc', '.docx']:
            continue
        text = str(path)
        match = re.search(r'(20\d{2}|201\d)年', text)
        if not match:
            continue
        year = int(match.group(1))
        if 2012 <= year <= 2021:
            files.append(path)
    return sorted(files)


def source_name(path):
    return Path(str(path or '')).name


def normalize_question(q):
    question_type = q.get('questionType') or ('choice' if q.get('options') else 'blank')
    item = {
        'number': q.get('number'),
        'prompt': clean(q.get('prompt')),
        'answer': clean(q.get('answer')),
        'questionType': question_type,
    }
    if q.get('options'):
        item['options'] = {k: clean((q.get('options') or {}).get(k)) for k in ['A', 'B', 'C', 'D']}
        item['answer'] = item['answer'].upper()
    if not isinstance(item['number'], int):
        return None
    if not item['prompt'] or re.search(r'故选|考查|解析|答案', item['prompt']):
        return None
    if question_type == 'choice':
        if not all(item.get('options', {}).get(k) for k in ['A', 'B', 'C', 'D']):
            return None
        if item['answer'] not in ['A', 'B', 'C', 'D']:
            return None
    elif not item['answer']:
        return None
    return item


def formal_reading(item):
    if item.get('section') == 'B':
        for q in item.get('questions') or []:
            if not clean(q.get('prompt')):
                q['prompt'] = f"完形填空第 {q.get('number')} 空"
    questions = [normalize_question(q) for q in item.get('questions') or []]
    questions = [q for q in questions if q]
    if not item.get('year') or not item.get('district'):
        return None, 'missing-meta'
    if len(item.get('passage') or '') < 500:
        return None, 'missing-passage'
    if len(questions) < 5:
        return None, 'too-few-valid-questions'
    return {
        '_id': item['_id'],
        'title': item['title'],
        'year': item.get('year'),
        'city': '上海',
        'district': item.get('district'),
        'examType': '二模',
        'section': item.get('section'),
        'sourceType': 'shanghai-mock',
        'sourceFile': source_name(item.get('sourceFile')),
        'passage': item.get('passage'),
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': [],
    }, ''


def formal_grammar(item):
    questions = [normalize_question(q) for q in item.get('questions') or []]
    questions = [q for q in questions if q]
    if not item.get('year') or not item.get('district'):
        return None, 'missing-meta'
    if len(questions) < 15:
        return None, 'too-few-valid-questions'
    return {
        '_id': item['_id'],
        'title': item['title'],
        'year': item.get('year'),
        'city': '上海',
        'district': item.get('district'),
        'examType': '二模',
        'section': 'grammar-choice',
        'sourceType': 'shanghai-mock',
        'sourceFile': source_name(item.get('sourceFile')),
        'questions': questions,
    }, ''


def dedupe(items):
    out = {}
    for item in items:
        prev = out.get(item['_id'])
        if not prev or len(item.get('questions') or []) > len(prev.get('questions') or []):
            out[item['_id']] = item
    return list(out.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('root')
    parser.add_argument('--out-dir', default='data/imports/shanghai-em2-2012-2021')
    args = parser.parse_args()

    all_files = collect_doc_files(args.root)
    answer_bank = {}
    answer_text_bank = {}
    text_cache = {}
    for path in all_files:
        try:
            text = read_text(path)
            text_cache[path] = text
            _, answer_text = split_paper_and_answers(text)
            source_text = answer_text
            path_text = str(path)
            if not source_text and ('答案' in path_text or ('解析' in path_text and '原卷' not in path_text)):
                source_text = text
            if source_text:
                meta = meta_from_path(path)
                key = (meta.get('year'), meta.get('district'))
                answer_bank.setdefault(key, {}).update(answer_map(source_text))
                answer_text_bank[key] = f"{answer_text_bank.get(key, '')}\n{source_text}"
        except Exception:
            continue

    raw_readings, raw_grammars, report = [], [], []
    for path in collect_files(args.root):
        try:
            text = text_cache.get(path) or read_text(path)
            paper_text, answer_text = split_paper_and_answers(text)
            lines = text_lines(paper_text)
            meta = meta_from_path(path)
            answers = {}
            answers.update(answer_bank.get((meta.get('year'), meta.get('district')), {}))
            answers.update(answer_map(answer_text))
            text_answers = {}
            text_answers.update(text_answer_map(answer_text_bank.get((meta.get('year'), meta.get('district')), '')))
            text_answers.update(text_answer_map(answer_text))
            grammar = parse_grammar(lines, answers, meta)
            reading_a = parse_reading(lines, answers, meta, 'A')
            reading_b = parse_reading(lines, answers, meta, 'B')
            reading_c = parse_fill_reading(lines, text_answers, meta)
            reading_d = parse_answer_reading(lines, text_answers, meta)
            if grammar:
                raw_grammars.append(grammar)
            for item in [reading_a, reading_b, reading_c, reading_d]:
                if item:
                    raw_readings.append(item)
            report.append({
                'file': str(path),
                'year': meta.get('year'),
                'district': meta.get('district'),
                'answers': len(answers),
                'grammarQuestions': len(grammar.get('questions') or []) if grammar else 0,
                'readingAQuestions': len(reading_a.get('questions') or []) if reading_a else 0,
                'readingAPassageChars': len(reading_a.get('passage') or '') if reading_a else 0,
                'readingBQuestions': len(reading_b.get('questions') or []) if reading_b else 0,
                'readingBPassageChars': len(reading_b.get('passage') or '') if reading_b else 0,
                'readingCQuestions': len(reading_c.get('questions') or []) if reading_c else 0,
                'readingDQuestions': len(reading_d.get('questions') or []) if reading_d else 0,
            })
        except Exception as exc:
            report.append({'file': str(path), 'error': str(exc)})

    out = Path(args.out_dir)
    formal_out = out / 'formal'
    out.mkdir(parents=True, exist_ok=True)
    formal_out.mkdir(parents=True, exist_ok=True)
    (out / 'reading.json').write_text(json.dumps(raw_readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'grammar-choice.json').write_text(json.dumps(raw_grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'extract-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    formal_readings, formal_grammars, rejected = [], [], []
    for item in raw_readings:
        formal, reason = formal_reading(item)
        if formal:
            formal_readings.append(formal)
        else:
            rejected.append({'type': 'reading', 'title': item.get('title'), 'sourceFile': item.get('sourceFile'), 'reason': reason})
    for item in raw_grammars:
        formal, reason = formal_grammar(item)
        if formal:
            formal_grammars.append(formal)
        else:
            rejected.append({'type': 'grammar-choice', 'title': item.get('title'), 'sourceFile': item.get('sourceFile'), 'reason': reason})

    formal_readings = dedupe(formal_readings)
    formal_grammars = dedupe(formal_grammars)
    (formal_out / 'reading-passages.formal.json').write_text(json.dumps(formal_readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (formal_out / 'grammar-choice.formal.json').write_text(json.dumps(formal_grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (formal_out / 'clean-report.json').write_text(json.dumps({
        'readingInput': len(raw_readings),
        'readingFormal': len(formal_readings),
        'grammarInput': len(raw_grammars),
        'grammarFormal': len(formal_grammars),
        'rejected': rejected,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'files': len(report),
        'readingFormal': len(formal_readings),
        'grammarFormal': len(formal_grammars),
        'outDir': str(formal_out),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
