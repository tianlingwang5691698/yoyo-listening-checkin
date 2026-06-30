#!/usr/bin/env python3
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from docx import Document


ROOT = Path('/Users/wangtianlong/工作/未命名文件夹/9.2026年上海二模')
BASE = Path('data/imports/shanghai-em2-2026')
WORK = BASE / 'work'
OUT = BASE / 'formal'
DISTRICTS = ['宝山', '崇明', '奉贤', '虹口', '黄浦', '嘉定', '金山', '静安', '闵行', '浦东', '普陀', '青浦', '松江', '徐汇', '杨浦', '长宁']


def clean(text):
    text = unicodedata.normalize('NFKC', str(text or '')).replace('\f', '\n')
    text = re.sub(r'第\s*\d+\s*页\s*/\s*共\s*\d+\s*页', ' ', text)
    text = re.sub(r'学科\s*网.*?公司', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def normalize_source(text):
    return unicodedata.normalize('NFKC', str(text or '')).replace('\f', '\n')


def district_in_path(path, district):
    name = str(path)
    return district in name or (district == '浦东' and '浦东新区' in name)


def pdf_text(path):
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / (re.sub(r'[^A-Za-z0-9一-龥]+', '-', path.stem)[:80] + '.txt')
    if not out.exists():
        subprocess.run(['pdftotext', '-layout', str(path), str(out)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out.read_text(encoding='utf-8', errors='ignore') if out.exists() else ''


def ocr_pdf_text(path, first_page=None, last_page=None):
    stem = re.sub(r'[^A-Za-z0-9一-龥]+', '-', path.stem)[:60]
    suffix = f'-p{first_page or 1}-{last_page or "end"}'
    out = WORK / f'{stem}{suffix}-ocr.txt'
    if out.exists():
        return out.read_text(encoding='utf-8', errors='ignore')
    image_prefix = WORK / 'ocr' / stem / 'page'
    image_prefix.parent.mkdir(parents=True, exist_ok=True)
    cmd = ['pdftoppm', '-r', '140', '-png']
    if first_page:
        cmd += ['-f', str(first_page)]
    if last_page:
        cmd += ['-l', str(last_page)]
    cmd += [str(path), str(image_prefix)]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    parts = []
    for image in sorted(image_prefix.parent.glob('page-*.png')):
        txt_base = image.with_suffix('')
        try:
            subprocess.run(['tesseract', str(image), str(txt_base), '-l', 'eng', '--psm', '6'], check=False, timeout=25, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            continue
        txt = image.with_suffix('.txt')
        if txt.exists():
            parts.append(txt.read_text(encoding='utf-8', errors='ignore'))
    out.write_text('\n'.join(parts), encoding='utf-8')
    return out.read_text(encoding='utf-8', errors='ignore')


def candidates_for(district):
    out = []
    for path in ROOT.rglob('*.pdf'):
        s = str(path)
        if '英语' not in s or '听力' in path.name:
            continue
        if district_in_path(path, district):
            out.append(path)
    return out


def answer_candidates_for(district):
    out = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in ['.pdf', '.docx']:
            continue
        s = str(path)
        if '英语' not in s or '答案' not in s or '听力' in path.name:
            continue
        if district_in_path(path, district):
            out.append(path)
    return out


def paper_candidates_for(district):
    out = []
    for path in ROOT.rglob('*.pdf'):
        s = str(path)
        if '英语' not in s or '听力' in path.name:
            continue
        if not district_in_path(path, district):
            continue
        if any(k in path.name for k in ['答案', '解析', '分析', '总结']):
            continue
        out.append(path)
    return out


def score_candidate(path, text):
    name = path.name
    score = 0
    if '官方解析' in name or '解析版' in name:
        score += 80
    if '独家解析' in name or '含解析' in name:
        score += 60
    if '参考答案' in name:
        score += 20
    if '原卷' in name or '真题卷' in name or '试卷.pdf' in name:
        score -= 20
    if '手写' in name or '不全' in name:
        score -= 40
    score += min(len(text) // 1000, 40)
    score += len(re.findall(r'【答案】\s*[A-D]', text)) * 4
    if re.search(r'Choose the best answer', text, re.I):
        score += 20
    if re.search(r'Reading comprehension', text, re.I):
        score += 20
    return score


def choose_source(district):
    scored = []
    for path in candidates_for(district):
        text = pdf_text(path)
        scored.append((score_candidate(path, text), path, text))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0] if scored else (0, None, '')


def read_answer_file(path):
    if not path:
        return ''
    if path.suffix.lower() == '.docx':
        doc = Document(str(path))
        return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
    text = pdf_text(path)
    return text


def choose_answer_source(district):
    scored = []
    for path in answer_candidates_for(district):
        text = read_answer_file(path)
        score = len(re.findall(r'(?m)^[A-D]\s*$', text)) + len(re.findall(r'\b\d{1,2}\s*[\.．]?\s*[A-D]\b', text))
        if '手写' in path.name or '不全' in path.name:
            score -= 20
        scored.append((score, path, text))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0] if scored else (0, None, '')


def choose_paper_source(district):
    scored = []
    for path in paper_candidates_for(district):
        text = pdf_text(path)
        score = len(text) // 1000
        score += 20 if re.search(r'Choose the best answer', text, re.I) else 0
        score += 20 if re.search(r'Reading', text, re.I) else 0
        scored.append((score, path, text))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0] if scored else (0, None, '')


def between(text, start_re, end_re):
    m = re.search(start_re, text, re.I)
    if not m:
        return ''
    tail = text[m.end():]
    e = re.search(end_re, tail, re.I)
    return tail[:e.start()] if e else tail


def answer_from(chunk):
    m = re.search(r'【答案】\s*(?:\d{1,2}\s*[\.．]?\s*)?([A-D])\b', chunk)
    return m.group(1) if m else ''


def answer_map(section):
    out = {}
    for m in re.finditer(r'【答案】(.*?)(?=【解析】|【详解】|$)', section, re.S):
        for number, answer in re.findall(r'(\d{1,2})\s*[\.．]?\s*([A-D])\b', m.group(1)):
            out[int(number)] = answer
    return out


def answer_sequences(text):
    lines = [clean(x) for x in text.splitlines()]
    lines = [x for x in lines if x]
    def collect(start_pat, stop_pat, limit):
        start = next((i for i, v in enumerate(lines) if re.search(start_pat, v, re.I)), -1)
        if start < 0:
            return []
        ans = []
        for v in lines[start + 1:]:
            if re.search(stop_pat, v, re.I):
                break
            m = re.fullmatch(r'([A-D])', v)
            if m:
                ans.append(m.group(1))
                if len(ans) >= limit:
                    break
        return ans
    return {
        'grammar': collect(r'II\.?\s*Choose the best answer|Choose the best answer.*15', r'III\.|Choose the proper|Complete the passage|Part\s*3', 15),
        'readingA': collect(r'A\.?\s*Choose the best answer', r'B\.|C\.|D\.', 6),
        'readingB': collect(r'B\.?.*(complete the passage|Cloze|Choose the words)', r'C\.|D\.', 6),
    }


def parse_options(part):
    part = re.sub(r'【答案】.*$', '', part, flags=re.S)
    opts = {}
    for m in re.finditer(r'([A-D])[\)）\.．]\s*(.*?)(?=\s+[A-D][\)）\.．]\s*|$)', clean(part), re.S):
        val = clean(m.group(2))
        if val:
            opts[m.group(1)] = val
    return opts


def parse_question_chunks(section, external_answers=None):
    text = section.replace('\f', '\n')
    answers = answer_map(text)
    starts = list(re.finditer(r'(?m)(?:^|\n)\s*(\d{1,2})[\.\uff0e]\s+', text))
    questions = []
    for i, m in enumerate(starts):
        number = int(m.group(1))
        end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
        chunk = text[m.start():end]
        before_answer = chunk.split('【答案】', 1)[0]
        a_pos = re.search(r'\s+A[\)）\.．]\s*', before_answer)
        if not a_pos:
            continue
        prompt = clean(before_answer[:a_pos.start()])
        prompt = re.sub(r'^\d{1,2}[\.\uff0e]\s*', '', prompt).strip()
        opts = parse_options(before_answer[a_pos.start():])
        seq_answer = external_answers[len(questions)] if external_answers and len(questions) < len(external_answers) else ''
        answer = answers.get(number, '') or answer_from(chunk) or seq_answer
        if prompt and all(opts.get(k) for k in ['A', 'B', 'C', 'D']):
            questions.append({
                'number': number,
                'prompt': prompt,
                'options': {k: opts[k] for k in ['A', 'B', 'C', 'D']},
                'answer': answer
            })
    return questions


def passage_before_questions(section):
    text = section.replace('\f', '\n')
    m = re.search(r'(?m)(?:^|\n)\s*\d{1,2}[\.\uff0e]\s+', text)
    passage = text[:m.start()] if m else text
    passage = re.sub(r'^.*?Choose the best answer.*?\)', '', passage, flags=re.I | re.S)
    return clean(passage)


def parse_blank_questions(section, numbers):
    text = clean(section)
    questions = []
    for number in numbers:
        if re.search(rf'(?:\b{number}\s*[\.\uff0e]?\s*[_a-zA-Z]|[_a-zA-Z]_*{number}_*)', text):
            questions.append({
                'number': number,
                'prompt': f'Complete blank {number} with a proper word.',
                'answer': '',
                'questionType': 'blank'
            })
    return questions


def parse_answer_questions(section, numbers):
    text = clean(section)
    positions = []
    for number in numbers:
        match = re.search(rf'\b{number}\s*[\.\uff0e]\s+', text)
        if match:
            positions.append((number, match.start(), match.end()))
    questions = []
    for index, (number, start, content_start) in enumerate(positions):
        end = positions[index + 1][1] if index + 1 < len(positions) else len(text)
        prompt = clean(text[content_start:end])
        if prompt:
            questions.append({
                'number': number,
                'prompt': prompt,
                'answer': '',
                'questionType': 'answer'
            })
    return questions


def passage_before_any_question(section):
    text = clean(section)
    match = re.search(r'\b(?:71|78)\s*[\.\uff0e]\s+', text)
    return clean(text[:match.start()] if match else text)


def add_reading(readings, district, source, section, passage, questions):
    if len(questions) < 5 or len(passage) < 300:
        return
    readings.append({
        '_id': f'sh-em2-2026-{district}-reading-{section.lower()}',
        'title': f'2026 上海{district}二模阅读 {section}',
        'year': 2026,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'section': section,
        'sourceType': 'shanghai-mock',
        'sourceFile': source,
        'passage': passage,
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': []
    })


def first_n(items, n):
    return items[:n] if len(items) >= n else items


def build():
    readings, grammars, report, manifest = [], [], [], []
    for district in DISTRICTS:
        score, path, text = choose_source(district)
        text = normalize_source(text)
        source = path.name if path else ''
        grammar_sec = between(text, r'(?:II|Ⅱ)\.?\s*Choose the best answer', r'(?:III|Ⅲ)\.')
        reading_block = between(text, r'(?:VI|Ⅵ)\.?\s*Reading comprehension', r'(?:VII|Ⅶ)\.')
        if not reading_block:
            reading_block = between(text, r'A\.\s*Choose the best answer', r'C\.\s*Fill in the blanks')
        reading_a_sec = between(reading_block, r'A\.\s*Choose the best answer', r'B\.\s*Choose the best (?:answer|words)')
        reading_b_sec = between(reading_block, r'B\.\s*Choose the best (?:answer|words).*?passage', r'C\.\s*Fill in the blanks')
        reading_c_sec = between(reading_block, r'C\.\s*Fill in the blanks', r'D\.\s*Answer the questions')
        reading_d_sec = between(reading_block, r'D\.\s*Answer the questions', r'(?:VII|Ⅶ)\.?\s*Writing|Writing')
        grammar_q = first_n(parse_question_chunks(grammar_sec), 15)
        a_q = first_n(parse_question_chunks(reading_a_sec), 6)
        b_q = first_n(parse_question_chunks(reading_b_sec), 6)
        c_q = parse_blank_questions(reading_c_sec, range(71, 78))
        d_q = parse_answer_questions(reading_d_sec, range(78, 84))
        a_passage = passage_before_questions(reading_a_sec)
        b_passage = passage_before_questions(reading_b_sec)
        c_passage = passage_before_any_question(reading_c_sec)
        d_passage = passage_before_any_question(reading_d_sec)
        answer_source = ''
        if len(grammar_q) < 15 or len(a_q) < 5:
            _, answer_path, answer_text = choose_answer_source(district)
            _, paper_path, paper_text = choose_paper_source(district)
            paper_text = normalize_source(paper_text)
            seq = answer_sequences(answer_text)
            paper_source = paper_path.name if paper_path else source
            paper_grammar = between(paper_text, r'(?:II|Ⅱ)\.?\s*Choose the best answer', r'(?:III|Ⅲ)\.')
            paper_reading_block = between(paper_text, r'(?:VI|Ⅵ)\.?\s*Reading', r'(?:VII|Ⅶ)\.')
            paper_a = between(paper_reading_block, r'A\.\s*Choose the best answer', r'B\.\s*Choose')
            paper_b = between(paper_reading_block, r'B\.\s*Choose.*?(?:passage|Cloze)', r'C\.\s*')
            paper_c = between(paper_reading_block, r'C\.\s*Fill in the blanks', r'D\.\s*Answer the questions')
            paper_d = between(paper_reading_block, r'D\.\s*Answer the questions', r'(?:VII|Ⅶ)\.?\s*Writing|Writing')
            if len(grammar_q) < 15:
                fallback = first_n(parse_question_chunks(paper_grammar, seq.get('grammar')), 15)
                if len(fallback) > len(grammar_q):
                    grammar_q = fallback
                    source = paper_source
            if len(a_q) < 5:
                fallback = first_n(parse_question_chunks(paper_a, seq.get('readingA')), 6)
                fallback_passage = passage_before_questions(paper_a)
                if len(fallback) > len(a_q):
                    a_q = fallback
                    a_passage = fallback_passage
                    source = paper_source
            if len(b_q) < 5:
                fallback = first_n(parse_question_chunks(paper_b, seq.get('readingB')), 6)
                fallback_passage = passage_before_questions(paper_b)
                if len(fallback) > len(b_q):
                    b_q = fallback
                    b_passage = fallback_passage
                    source = paper_source
            if len(c_q) < 5:
                fallback = parse_blank_questions(paper_c, range(71, 78))
                fallback_passage = passage_before_any_question(paper_c)
                if len(fallback) > len(c_q):
                    c_q = fallback
                    c_passage = fallback_passage
                    source = paper_source
            if len(d_q) < 5:
                fallback = parse_answer_questions(paper_d, range(78, 84))
                fallback_passage = passage_before_any_question(paper_d)
                if len(fallback) > len(d_q):
                    d_q = fallback
                    d_passage = fallback_passage
                    source = paper_source
            answer_source = answer_path.name if answer_path else ''
        if len(grammar_q) == 15:
            grammars.append({
                '_id': f'sh-em2-2026-{district}-grammar-choice',
                'title': f'2026 上海{district}二模语法单选',
                'year': 2026,
                'city': '上海',
                'district': district,
                'examType': '二模',
                'section': 'grammar-choice',
                'sourceType': 'shanghai-mock',
                'sourceFile': source,
                'questions': grammar_q
            })
        add_reading(readings, district, source, 'A', a_passage, a_q)
        add_reading(readings, district, source, 'B', b_passage, b_q)
        add_reading(readings, district, source, 'C', c_passage, c_q)
        add_reading(readings, district, source, 'D', d_passage, d_q)
        row = {
            'district': district,
            'score': score,
            'sourceFile': source,
            'answerSourceFile': answer_source,
            'grammarQuestions': len(grammar_q),
            'readingAQuestions': len(a_q),
            'readingAPassageChars': len(a_passage),
            'readingBQuestions': len(b_q),
            'readingBPassageChars': len(b_passage),
            'readingCQuestions': len(c_q),
            'readingCPassageChars': len(c_passage),
            'readingDQuestions': len(d_q),
            'readingDPassageChars': len(d_passage)
        }
        report.append(row)
        manifest.append({'district': district, 'sourceFile': str(path) if path else '', 'score': score})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'reading-passages.formal.json').write_text(json.dumps(readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'grammar-choice.formal.json').write_text(json.dumps(grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'clean-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'districts': len(DISTRICTS), 'readingFormal': len(readings), 'grammarFormal': len(grammars), 'outDir': str(OUT)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
