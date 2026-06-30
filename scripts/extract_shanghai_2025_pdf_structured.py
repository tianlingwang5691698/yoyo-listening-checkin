#!/usr/bin/env python3
import json
import re
from pathlib import Path


DISTRICTS = ['宝山', '崇明', '奉贤', '虹口', '黄浦', '嘉定', '金山', '静安', '闵行', '浦东', '普陀', '青浦', '松江', '徐汇', '杨浦', '长宁']
BASE = Path('data/imports/shanghai-em2-2025')
WORK = BASE / 'work'
OUT = BASE / 'formal'


def clean(text):
    text = str(text or '').replace('\f', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def parse_answer_line(text, start, end):
    out = {}
    for number, answer in re.findall(r'(\d{1,2})\s*[\.．]?\s*([A-D])\b', text):
        n = int(number)
        if start <= n <= end:
            out[n] = answer
    return out


def answer_maps(answer_text):
    grammar, reading_a, reading_b = [], [], []
    for match in re.finditer(r'21\s*[\.．]?\s*[A-D].{0,260}?35\s*[\.．]?\s*[A-D]', answer_text, re.S):
        grammar.append(parse_answer_line(match.group(0), 21, 35))
    for match in re.finditer(r'59\s*[\.．]?\s*[A-D].{0,140}?64\s*[\.．]?\s*[A-D]', answer_text, re.S):
        reading_a.append(parse_answer_line(match.group(0), 59, 64))
    for match in re.finditer(r'65\s*[\.．]?\s*[A-D].{0,140}?70\s*[\.．]?\s*[A-D]', answer_text, re.S):
        reading_b.append(parse_answer_line(match.group(0), 65, 70))
    return grammar, reading_a, reading_b


def split_districts(paper_text):
    matches = list(re.finditer(r'(宝山区|崇明区|奉贤区|虹口区|黄浦区|嘉定区|金山区|静安区|闵行区|浦东新区|普陀区|青浦区|松江区|徐汇区|杨浦区|长宁区)\s+2024~2025', paper_text))
    sections = []
    for i, m in enumerate(matches):
        district = m.group(1).replace('浦东新区', '浦东').replace('区', '')
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(paper_text)
        sections.append((district, paper_text[start:end]))
    return sections


def section_between(text, start_re, end_re):
    start = re.search(start_re, text, re.I)
    if not start:
        return ''
    tail = text[start.end():]
    end = re.search(end_re, tail, re.I)
    return tail[:end.start()] if end else tail


def parse_options(chunk):
    opts = {}
    for m in re.finditer(r'([A-D])[\)）\.．]\s*(.*?)(?=\s+[A-D][\)）\.．]\s*|$)', chunk, re.S):
        opts[m.group(1)] = clean(m.group(2))
    for key in ['A', 'B', 'C', 'D']:
        if key in opts and not opts[key]:
            opts[key] = '/'
    return opts


def parse_questions(section, numbers, answers):
    text = clean(section)
    positions = []
    for n in numbers:
        m = re.search(rf'\b{n}\s*[\.\uff0e]\s+', text)
        if m:
            positions.append((n, m.start(), m.end()))
    questions = []
    for idx, (number, start, content_start) in enumerate(positions):
        end = positions[idx + 1][1] if idx + 1 < len(positions) else len(text)
        chunk = text[content_start:end]
        a_pos = re.search(r'\s+A[\)）\.．]\s*', chunk)
        if not a_pos:
            continue
        prompt = clean(chunk[:a_pos.start()])
        opts = parse_options(chunk[a_pos.start():])
        if prompt and all(opts.get(k) for k in ['A', 'B', 'C', 'D']):
            questions.append({
                'number': number,
                'prompt': prompt,
                'options': {k: opts[k] for k in ['A', 'B', 'C', 'D']},
                'answer': answers.get(number, '')
            })
    return questions


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


def passage_before(section, first_number):
    text = clean(section)
    m = re.search(rf'\b{first_number}\s*[\.\uff0e]\s+', text)
    passage = text[:m.start()] if m else text
    passage = re.sub(r'^(VI\.)?\s*Reading comprehension.*?A\.\s*Choose the best answer.*?\)?', '', passage, flags=re.I)
    passage = re.sub(r'^Choose the best answer and complete the passage.*?\)?', '', passage, flags=re.I)
    return clean(passage)


def passage_before_any_question(section):
    text = clean(section)
    match = re.search(r'\b(?:71|78)\s*[\.\uff0e]\s+', text)
    return clean(text[:match.start()] if match else text)


def add_reading(readings, district, section, passage, questions):
    if len(questions) < 5 or len(passage) < 300:
        return
    readings.append({
        '_id': f'sh-em2-2025-{district}-reading-{section.lower()}',
        'title': f'2025 上海{district}二模阅读 {section}',
        'year': 2025,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'section': section,
        'sourceType': 'shanghai-mock',
        'sourceFile': '2025上海初三英语二模16区试卷.pdf',
        'passage': passage,
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': []
    })


def build():
    paper_text = (WORK / 'papers.txt').read_text(encoding='utf-8', errors='ignore')
    answer_text = (WORK / 'answers-ocr.txt').read_text(encoding='utf-8', errors='ignore')
    grammar_answers, reading_a_answers, reading_b_answers = answer_maps(answer_text)
    sections = split_districts(paper_text)
    readings, grammars, report = [], [], []
    for idx, (district, block) in enumerate(sections):
        g_ans = grammar_answers[idx] if idx < len(grammar_answers) else {}
        a_ans = reading_a_answers[idx] if idx < len(reading_a_answers) else {}
        b_ans = reading_b_answers[idx] if idx < len(reading_b_answers) else {}
        grammar_sec = section_between(block, r'II\.\s*Choose the best answer', r'III\.')
        reading_a_sec = section_between(block, r'A\.\s*Choose the best answer', r'B\.?\s*Choose the best answer')
        reading_b_sec = section_between(block, r'B\.?\s*Choose the best answer and complete the passage', r'C\.\s*Fill in the blanks')
        reading_c_sec = section_between(block, r'C\.?\s*Fill in the blanks', r'D\.?\s*Answer the questions')
        reading_d_sec = section_between(block, r'D\.?\s*Answer the questions', r'(VII|Ⅶ)\.?\s*Writing')

        grammar_q = parse_questions(grammar_sec, range(21, 36), g_ans)
        a_q = parse_questions(reading_a_sec, range(59, 65), a_ans)
        b_q = parse_questions(reading_b_sec, range(65, 71), b_ans)
        c_q = parse_blank_questions(reading_c_sec, range(71, 78))
        d_q = parse_answer_questions(reading_d_sec, range(78, 84))
        if len(grammar_q) == 15:
            grammars.append({
                '_id': f'sh-em2-2025-{district}-grammar-choice',
                'title': f'2025 上海{district}二模语法单选',
                'year': 2025,
                'city': '上海',
                'district': district,
                'examType': '二模',
                'section': 'grammar-choice',
                'sourceType': 'shanghai-mock',
                'sourceFile': '2025上海初三英语二模16区试卷.pdf',
                'questions': grammar_q
            })
        add_reading(readings, district, 'A', passage_before(reading_a_sec, 59), a_q)
        add_reading(readings, district, 'B', passage_before(reading_b_sec, 65), b_q)
        add_reading(readings, district, 'C', passage_before_any_question(reading_c_sec), c_q)
        add_reading(readings, district, 'D', passage_before_any_question(reading_d_sec), d_q)
        report.append({
            'district': district,
            'grammarQuestions': len(grammar_q),
            'readingAQuestions': len(a_q),
            'readingAPassageChars': len(passage_before(reading_a_sec, 59)),
            'readingBQuestions': len(b_q),
            'readingBPassageChars': len(passage_before(reading_b_sec, 65)),
            'readingCQuestions': len(c_q),
            'readingCPassageChars': len(passage_before_any_question(reading_c_sec)),
            'readingDQuestions': len(d_q),
            'readingDPassageChars': len(passage_before_any_question(reading_d_sec))
        })
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'reading-passages.formal.json').write_text(json.dumps(readings, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'grammar-choice.formal.json').write_text(json.dumps(grammars, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'clean-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'districts': len(sections), 'readingFormal': len(readings), 'grammarFormal': len(grammars), 'outDir': str(OUT)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
