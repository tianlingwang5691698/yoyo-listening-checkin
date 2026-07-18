#!/usr/bin/env python3
"""Build additive Shanghai senior-high spring/autumn practice candidates.

The script only admits content that can be traced to the supplied paper files.
Missing questions, answers, transcripts, or options are reported instead of
being invented. Audio conversion is optional and uses immutable fingerprints.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path('/Users/wangtianlong/工作/未命名文件夹/3.上海历年英语真题')
IMPORT_DIR = ROOT / 'data' / 'imports' / 'shanghai-senior-1990-2023' / 'formal'
SESSIONS = {
    'spring': {
        'label': '春考',
        'prefix': 'sh-spring',
        'folder': '上海春考历年题',
    },
    'autumn': {
        'label': '秋考',
        'prefix': 'sh-autumn',
        'folder': '上海秋考历年题',
    },
}
TOPIC_META = [
    ('verb', '动词类'),
    ('lexical', '词法类'),
    ('clause', '从句类'),
    ('sentence', '句型结构类'),
    ('logic', '连词逻辑类'),
    ('communicative', '情景交际类'),
]
GRAMMAR_REVIEW_CACHE = {}


def reviewed_grammar_topics(session: str, year: int) -> dict[int, dict]:
    cache_key = (session, year)
    if cache_key in GRAMMAR_REVIEW_CACHE:
        return GRAMMAR_REVIEW_CACHE[cache_key]
    path = ROOT / 'data' / f'grammar-senior-{session}' / f'grammar-classification-review-{year}-{session}.json'
    if not path.exists():
        GRAMMAR_REVIEW_CACHE[cache_key] = {}
        return {}
    review = json.loads(path.read_text(encoding='utf-8'))
    if review.get('model') != 'gpt-5.6-sol':
        raise ValueError(f'grammar-review-model-mismatch:{path.name}')
    rows = {int(row['number']): row for row in review.get('questions', [])}
    GRAMMAR_REVIEW_CACHE[cache_key] = rows
    return rows


def clean(value: str) -> str:
    value = str(value or '')
    value = value.replace('\ufeff', '').replace('\u200f', '').replace('\u200e', '')
    value = value.replace('\u00a0', ' ').replace('\u3000', ' ').replace('\f', '\n')
    value = value.replace('\ufe63', '-').replace('\uff0d', '-').replace('\u2011', '-')
    value = value.replace('\u2013', '-').replace('\u2014', '-')
    value = re.sub(r'[ \t]+', ' ', value)
    value = re.sub(r' *\n *', '\n', value)
    value = re.sub(r'\n{3,}', '\n\n', value)
    return value.strip()


def compact(value: str) -> str:
    return re.sub(r'\s+', ' ', clean(value)).strip()


def dump_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_document(path: Path) -> str:
    if path.suffix.lower() in {'.doc', '.docx'}:
        result = subprocess.run(
            ['textutil', '-convert', 'txt', '-stdout', str(path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
        )
        return clean(result.stdout.decode('utf-8', errors='ignore'))
    if path.suffix.lower() == '.pdf':
        result = subprocess.run(
            ['pdftotext', '-layout', str(path), '-'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
        )
        return clean(result.stdout.decode('utf-8', errors='ignore'))
    return ''


def source_session(path: Path) -> str:
    text = str(path)
    return 'spring' if '春考' in text or '春季' in text else 'autumn'


def source_year(path: Path) -> int | None:
    match = re.search(r'(19\d{2}|20\d{2})', path.name)
    return int(match.group(1)) if match else None


def source_score(path: Path) -> int:
    name = path.name
    score = 0
    if '解析卷' in name or '解析' in name:
        score += 80
    if '真题及答案' in name or '真题与答案' in name:
        score += 65
    if '答案' in name:
        score += 35
    if '空白卷' in name:
        score += 20
    if path.suffix.lower() == '.docx':
        score += 8
    if '听力文本' in name or '听力原文' in name:
        score -= 120
    return score


def collect_sources(source_root: Path):
    documents = defaultdict(list)
    audios = {}
    transcript_docs = defaultdict(list)
    for path in sorted(source_root.rglob('*')):
        if not path.is_file() or path.name.startswith('~$') or path.name == '.DS_Store':
            continue
        year = source_year(path)
        if not year:
            continue
        session = source_session(path)
        key = (session, year)
        suffix = path.suffix.lower()
        if suffix == '.mp3':
            audios[key] = path
        elif suffix in {'.doc', '.docx', '.pdf'}:
            if '听力文本' in path.name or '听力原文' in path.name:
                transcript_docs[key].append(path)
            else:
                documents[key].append(path)
    return documents, audios, transcript_docs


def extract_answer_map(text: str) -> dict[int, str]:
    normalized = compact(text).upper()
    answers: dict[int, str] = {}
    range_pattern = re.compile(r'(\d{1,3})\s*(?:-|~|～|至)\s*(\d{1,3})\s*[.:\uff0e、】\s]*([A-J](?:\s*[A-J]){1,30})\b')
    for match in range_pattern.finditer(normalized):
        start, end = int(match.group(1)), int(match.group(2))
        letters = re.sub(r'\s+', '', match.group(3))
        expected = end - start + 1
        if end >= start and len(letters) >= expected:
            for offset, letter in enumerate(letters[:expected]):
                answers[start + offset] = letter
    for match in re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、\uff09)]?\s*([A-J])(?=\s|$)', normalized):
        answers.setdefault(int(match.group(1)), match.group(2))
    return answers


def section(text: str, start_patterns: list[str], end_patterns: list[str]) -> str:
    starts = []
    for pattern in start_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            starts.append(match)
    if not starts:
        return ''
    start = min(starts, key=lambda item: item.start())
    tail = text[start.start():]
    ends = []
    for pattern in end_patterns:
        match = re.search(pattern, tail[start.end() - start.start():], re.I)
        if match:
            ends.append(start.end() - start.start() + match.start())
    end = min(ends) if ends else len(tail)
    return clean(tail[:end])


def option_positions(block: str):
    return list(re.finditer(r'(?<![A-Za-z])([A-D])\s*[.\uff0e、\uff09)]\s*', block, re.I))


def parse_choice_questions(text: str, answers: dict[int, str], number_min: int, number_max: int, fallback_prompt: str = ''):
    line_starts = list(re.finditer(r'(?m)^\s*(\d{1,3})\s*(?:[.\uff0e、\uff09)]\s*|$)', text))
    questions = []
    seen = set()
    for index, match in enumerate(line_starts):
        number = int(match.group(1))
        if not number_min <= number <= number_max or number in seen:
            continue
        end = line_starts[index + 1].start() if index + 1 < len(line_starts) else len(text)
        block = clean(text[match.end():end])
        positions = option_positions(block)
        keys = [item.group(1).upper() for item in positions]
        if not all(key in keys for key in ['A', 'B', 'C', 'D']):
            continue
        first = next((item for item in positions if item.group(1).upper() == 'A'), None)
        prompt = compact(block[:first.start()]) if first else ''
        if not prompt:
            prompt = fallback_prompt.format(number=number) if fallback_prompt else ''
        options = {}
        for pos_index, item in enumerate(positions):
            key = item.group(1).upper()
            if key in options:
                continue
            value_end = positions[pos_index + 1].start() if pos_index + 1 < len(positions) else len(block)
            value = compact(block[item.end():value_end])
            value = re.split(r'\s*(?:【答案】|【解析】|【分析】|【点评】|Section\s+[A-D]\s+Directions\s*:)', value, maxsplit=1, flags=re.I)[0]
            options[key] = compact(value)
        answer = answers.get(number, '')
        if not answer:
            answer_match = re.search(r'(?:【解答】|【答案】|故选)\s*([A-D])\b', block, re.I)
            answer = answer_match.group(1).upper() if answer_match else ''
        if prompt and all(options.get(key) for key in ['A', 'B', 'C', 'D']) and answer in 'ABCD':
            questions.append({
                'number': number,
                'prompt': prompt,
                'options': {key: options[key] for key in ['A', 'B', 'C', 'D']},
                'answer': answer,
                'questionType': 'choice',
            })
            seen.add(number)
    return questions


def clean_passage(section_text: str) -> str:
    value = clean(section_text)
    value = re.sub(r'(?m)^\s*(?:Directions|Section\s+[A-C]).*$', '', value, flags=re.I)
    first_question = re.search(r'(?m)^\s*\d{1,3}\s*(?:[.\uff0e、\uff09)]\s*|$)', value)
    if first_question:
        value = value[:first_question.start()]
    value = re.sub(r'\n{3,}', '\n\n', value)
    return compact(value)


def reading_sections(text: str):
    reading = section(
        text,
        [r'(?:III|II|IV|\u2162|\u2163)\.?\s*Reading Comprehension', r'Reading Comprehension'],
        [r'(?:II|IV|V|\u2161|\u2163|\u2164)\.?\s*Translation', r'Guided Writing', r'Writing\s*\('],
    )
    if not reading:
        return {}
    markers = list(re.finditer(r'(?m)^\s*Section\s+([A-C])\b', reading, re.I))
    if not markers:
        return {'reading': reading}
    result = {}
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(reading)
        result[marker.group(1).upper()] = clean(reading[marker.start():end])
    return result


def build_matching_reading(session: str, year: int, raw: str, full_text: str, source_file: str, answers: dict[int, str]):
    answer_marker = re.search(r'参\s*考\s*答\s*案', full_text)
    answer_tail = full_text[answer_marker.end():] if answer_marker else ''
    heading_rows = re.findall(r'(?m)^\s*([A-F])\s*[.\uff0e、]\s*([^\n]{5,160})$', answer_tail)
    headings = {key: compact(value) for key, value in heading_rows}
    paragraph_markers = list(re.finditer(r'(?m)^\s*(8[0-4])\s*[.\uff0e、]\s*', raw))
    paragraphs = []
    for index, marker in enumerate(paragraph_markers):
        end = paragraph_markers[index + 1].start() if index + 1 < len(paragraph_markers) else len(raw)
        value = clean(raw[marker.end():end])
        value = re.sub(r'SHAPE\s+\\\*\s+MERGEFORMAT', '', value, flags=re.I)
        value = compact(value)
        if value:
            paragraphs.append((int(marker.group(1)), value))
    valid = bool(
        set(headings) == set('ABCDEF')
        and [number for number, _ in paragraphs] == list(range(80, 85))
        and all(answers.get(number) in headings for number, _ in paragraphs)
    )
    report = {
        'section': 'C',
        'passageChars': sum(len(value) for _, value in paragraphs),
        'questions': len(paragraphs) if valid else 0,
        'accepted': valid,
    }
    if not valid:
        return None, report
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    questions = [{
        'number': number,
        'prompt': f'Choose the most suitable heading for paragraph {number}.',
        'options': headings,
        'answer': answers[number],
        'questionType': 'choice',
    } for number, _ in paragraphs]
    return {
        '_id': f'{prefix}-{year}-reading-c',
        'title': f'{year} 上海高考{label} · Reading Comprehension Section C',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'C-Matching',
        'sectionLabel': 'Reading Section C',
        'paperId': f'{prefix}-{year}',
        'paperTitle': f'{year} 上海高考{label}英语真题',
        'paperOrder': 50,
        'contentRevision': 2 if session == 'autumn' and year == 2009 else 1,
        'difficultyLevel': 4,
        'difficultyLabel': '高考真题',
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'passage': '\n\n'.join(f'{number}. {value}' for number, value in paragraphs),
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': [],
    }, report


def build_vocabulary_cloze_item(session: str, year: int, text: str, source_file: str, answers: dict[int, str]):
    grammar = section(
        text,
        [r'Grammar and Vocabulary'],
        [r'Reading Comprehension'],
    )
    marker = re.search(r'(?m)^\s*Section\s+B\b', grammar, re.I)
    raw = grammar[marker.end():] if marker else ''
    word_rows = list(re.finditer(r'(?m)^\s*([A-J])\s*[.\uff0e、]\s*([^\n]+?)\s*$', raw))
    options = {match.group(1).upper(): compact(match.group(2)) for match in word_rows}
    passage = clean(raw[word_rows[-1].end():]) if word_rows else ''
    passage = re.sub(r'^(?:Directions\s*:)?\s*Complete the following passage[\s\S]*?you need\.?', '', passage, count=1, flags=re.I)
    passage = compact(passage)
    numbers = list(range(41, 50))
    valid = bool(
        list(options) == list('ABCDEFGHIJ')
        and len(passage) >= 500
        and all(answers.get(number) in options for number in numbers)
        and all(re.search(rf'(?:_|\uff3f)+\s*{number}\s*(?:_|\uff3f)+', passage) for number in numbers)
    )
    report = {'section': 'Grammar-Vocabulary-B', 'passageChars': len(passage), 'questions': 9 if valid else 0, 'accepted': valid}
    if not valid:
        return None, report
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    questions = [{
        'number': number,
        'prompt': f'Blank {number}',
        'options': options,
        'answer': answers[number],
        'questionType': 'choice',
    } for number in numbers]
    return {
        '_id': f'{prefix}-{year}-grammar-vocabulary-b',
        'title': f'{year} 上海高考{label} · Grammar and Vocabulary Section B',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'Grammar-Vocabulary-B',
        'sectionLabel': 'Grammar and Vocabulary Section B',
        'paperId': f'{prefix}-{year}',
        'paperTitle': f'{year} 上海高考{label}英语真题',
        'paperOrder': 20,
        'contentRevision': 2 if session == 'autumn' and year == 2009 else 1,
        'difficultyLevel': 4,
        'difficultyLabel': '高考真题',
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'passage': passage,
        'questions': questions,
        'answerSentences': [],
        'phrases': [],
        'vocabulary': [],
    }, report


def build_reading_items(session: str, year: int, text: str, source_file: str, answers: dict[int, str]):
    items = []
    report = []
    for section_id, raw in reading_sections(text).items():
        if section_id == 'C':
            item, item_report = build_matching_reading(session, year, raw, text, source_file, answers)
            report.append(item_report)
            if item:
                items.append(item)
            continue
        blocks = [(section_id, raw)]
        if section_id == 'B':
            markers = list(re.finditer(r'(?m)^\s*\(([A-D])\)\s*$', raw, re.I))
            blocks = []
            for index, marker in enumerate(markers):
                end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
                blocks.append((f'B{marker.group(1).upper()}', raw[marker.end():end]))
        for block_id, block in blocks:
            questions = parse_choice_questions(block, answers, 31, 90, 'Blank {number}')
            passage = clean_passage(block)
            numbers = sorted(question['number'] for question in questions)
            valid = bool(
                len(passage) >= 500
                and len(questions) >= 3
                and numbers
                and numbers == list(range(numbers[0], numbers[-1] + 1))
            )
            report.append({'section': block_id, 'passageChars': len(passage), 'questions': len(questions), 'accepted': valid})
            if not valid:
                continue
            slug = block_id.lower()
            prefix = SESSIONS[session]['prefix']
            label = SESSIONS[session]['label']
            items.append({
                '_id': f'{prefix}-{year}-reading-{slug}',
                'title': f'{year} 上海高考{label} · Reading Comprehension Section {block_id[0]}{f" ({block_id[1]})" if len(block_id) > 1 else ""}',
                'year': year,
                'city': '上海',
                'district': label,
                'examType': label,
                'stage': '高中',
                'section': block_id,
                'sectionLabel': f'Reading Section {block_id[0]}{f" ({block_id[1]})" if len(block_id) > 1 else ""}',
                'paperId': f'{prefix}-{year}',
                'paperTitle': f'{year} 上海高考{label}英语真题',
                'paperOrder': 30 if block_id == 'A' else 39 + ord(block_id[1]) - ord('A'),
                'contentRevision': 2 if session == 'autumn' and year == 2009 else 1,
                'difficultyLevel': 4,
                'difficultyLabel': '高考真题',
                'sourceType': 'shanghai-gaokao',
                'sourceFile': source_file,
                'passage': passage,
                'questions': questions,
                'answerSentences': [],
                'phrases': [],
                'vocabulary': [],
            })
    return items, report


def build_writing_item(session: str, year: int, text: str, source_file: str):
    raw = section(
        text,
        [r'Guided Writing', r'(?:II|III|IV|V|\u2161|\u2162|\u2163|\u2164)\.?\s*Writing\b', r'作文'],
        [r'【答案】', r'【解析】', r'参\s*考\s*答\s*案', r'参考范文', r'Sample Writing', r'Listening (?:Comprehension|Script)', r'听力(?:原文|文本|文字)'],
    )
    prompt = compact(raw)
    prompt = re.sub(r'^(?:[IVX\u2160-\u2169]+\.?\s*)?(?:Guided\s+)?Writing\s*[:\uff1a]?', '', prompt, flags=re.I)
    prompt = re.split(r'\s*(?:【答案】|【解析】|【分析】|【点评】|参\s*考\s*答\s*案|参考范文|Sample Writing)', prompt, maxsplit=1, flags=re.I)[0]
    valid = 40 <= len(prompt) <= 1800 and bool(re.search(r'write|writing|essay|letter|words|写|作文|短文', prompt, re.I))
    if not valid:
        return None, {'promptChars': len(prompt), 'accepted': False}
    min_words_match = re.search(r'(\d{2,3})\s*(?:-|~|至|to)\s*(\d{2,3})\s*words', prompt, re.I)
    min_words = int(min_words_match.group(1)) if min_words_match else 120
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    return {
        '_id': f'{prefix}-{year}-writing',
        'title': f'{year} 上海高考{label}作文',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'writing',
        'category': '高中作文',
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'prompt': prompt,
        'minWords': min_words,
        'score': 25,
    }, {'promptChars': len(prompt), 'accepted': True}


def build_translation_item(session: str, year: int, text: str, source_file: str):
    raw = section(
        text,
        [r'(?m)^\s*(?:I|\u2160)\.?\s*Translation\s*$'],
        [r'(?m)^\s*(?:II|\u2161)\.?\s*Guided Writing\s*$'],
    )
    directions_match = re.search(r'Directions\s*:\s*([^\n]+)', raw, re.I)
    directions = compact(directions_match.group(0)) if directions_match else ''
    markers = list(re.finditer(r'(?m)^\s*(\d{1,2})\s*[.．、]\s*', raw))
    questions = []
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
        source_text = compact(raw[marker.end():end])
        keyword_match = re.search(r'[（(]\s*([^（）()]+?)\s*[）)]\s*$', source_text)
        keyword = compact(keyword_match.group(1)) if keyword_match else ''
        if keyword_match:
            source_text = compact(source_text[:keyword_match.start()])
        if source_text and keyword:
            questions.append({
                'number': int(marker.group(1)),
                'sourceText': source_text,
                'requiredWord': keyword,
                'referenceAnswers': [],
            })
    answer_raw = section(
        text,
        [r'(?m)^\s*(?:I|\u2160)\.?\s*翻译\s*$'],
        [r'(?m)^\s*(?:II|\u2161)\.?\s*写作'],
    )
    answer_lines = [
        compact(line)
        for line in answer_raw.splitlines()[1:]
        if compact(line) and not re.match(r'^(?:I|\u2160)\.?\s*翻译$', compact(line), re.I)
    ]
    corrections = []
    if len(answer_lines) >= len(questions):
        for question, answer in zip(questions, answer_lines):
            if question['number'] == 3 and answer.startswith('Thinking only a cup of coffee'):
                corrections.append({'number': 3, 'source': answer, 'normalized': answer.replace('Thinking', 'Drinking', 1)})
                answer = answer.replace('Thinking', 'Drinking', 1)
            question['referenceAnswers'] = [answer]
    accepted = bool(
        len(questions) == 6
        and [question['number'] for question in questions] == list(range(1, 7))
        and all(question['referenceAnswers'] for question in questions)
    )
    if not accepted:
        return None, {
            'accepted': False,
            'questionCount': len(questions),
            'answerCount': len(answer_lines),
        }
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    return {
        '_id': f'{prefix}-{year}-translation',
        'title': f'{year} 上海高考{label} I. Translation',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'translation',
        'category': '高中翻译',
        'contentType': 'translation',
        'contentRevision': 2 if session == 'autumn' and year == 2009 else 1,
        'paperId': f'{prefix}-{year}',
        'paperOrder': 1,
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'directions': directions,
        'questionCount': len(questions),
        'questions': questions,
        'score': 20,
    }, {
        'accepted': True,
        'questionCount': len(questions),
        'answerCount': len(answer_lines),
        'answerCorrections': corrections,
    }


def grammar_topic(question, session: str = '', year: int = 0):
    reviewed = reviewed_grammar_topics(session, year).get(int(question.get('number', 0)))
    if reviewed:
        return tuple(reviewed[key] for key in ('categoryId', 'category', 'subtopicId', 'subtopic'))
    prompt = compact(question.get('prompt', '')).lower()
    options = ' '.join(question.get('options', {}).values()).lower()
    text = f' {prompt} {options} '
    if re.search(r'\b(must|may|might|can|could|should|need|shall|would)\b', options):
        return 'verb', '动词类', 'verb:modal', '情态动词'
    if re.search(r'\b(to\s+\w+|\w+ing|\w+ed)\b', options):
        return 'verb', '动词类', 'verb:nonfinite', '非谓语'
    if re.search(r'\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would)\b', options):
        return 'verb', '动词类', 'verb:tense-voice', '时态语态'
    if re.search(r'\b(who|whom|whose|which|that|where|when)\b', options) and re.search(r'\bwho|whom|whose|which|that|where|when\b', text):
        return 'clause', '从句类', 'clause:relative', '定语从句'
    if re.search(r'\b(if|unless|although|though|because|since|while|when|before|after|until)\b', options):
        return 'logic', '连词逻辑类', 'logic:clause-link', '从属连词'
    if re.search(r'\b(a|an|the)\b', options):
        return 'lexical', '词法类', 'lexical:article', '冠词'
    if re.search(r'\b(in|on|at|for|of|with|from|to|by|through|during|without|against|among|between)\b', options):
        return 'lexical', '词法类', 'lexical:preposition', '介词'
    if re.search(r'\b(he|him|his|she|her|they|them|their|we|us|our|it|its|myself|yourself|themselves|another|other|others)\b', options):
        return 'lexical', '词法类', 'lexical:pronoun', '代词'
    if re.search(r'\b(what|how)\b', options) and re.search(r'!|\uff01', prompt):
        return 'sentence', '句型结构类', 'sentence:exclamation', '感叹句'
    if re.search(r'\b(sorry|thanks|please|would you|could you|shall we|why not)\b', text):
        return 'communicative', '情景交际类', 'communicative:daily', '日常口语表达'
    return 'lexical', '词法类', 'lexical:usage', '词义与用法'


def build_grammar_questions(session: str, year: int, text: str, source_file: str, answers: dict[int, str]):
    raw = section(
        text,
        [r'Grammar and Vocabulary', r'Grammar\s+Directions', r'(?:II|\u2161)\.?\s*Grammar'],
        [r'Reading Comprehension', r'Cloze', r'(?:III|IV|\u2162|\u2163)\.?\s*Reading'],
    )
    parsed = parse_choice_questions(raw, answers, 1, 60)
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    questions = []
    reviewed_topics = reviewed_grammar_topics(session, year)
    if reviewed_topics and set(reviewed_topics) != {question['number'] for question in parsed}:
        raise ValueError(f'grammar-review-question-set-mismatch:{session}:{year}')
    for question in parsed:
        category_id, category, subtopic_id, subtopic = grammar_topic(question, session, year)
        number = question['number']
        questions.append({
            '_id': f'{prefix}-{year}-grammar-q{number}',
            'sourceSetId': f'{prefix}-{year}-grammar',
            'year': year,
            'city': '上海',
            'district': label,
            'examType': label,
            'sourceFile': source_file,
            **question,
            'categoryId': category_id,
            'category': category,
            'subtopicId': subtopic_id,
            'subtopic': subtopic,
            'topicId': subtopic_id,
            'topic': subtopic,
            'stage': '高中',
            'questionType': 'grammar-choice',
            'classificationModel': 'gpt-5.6-sol' if number in reviewed_topics else '',
            'classificationRevision': 2 if number in reviewed_topics else 1,
        })
    return questions, {'choiceQuestions': len(questions), 'accepted': bool(questions)}


def extract_transcript(texts: list[str]) -> str:
    for text in texts:
        raw = section(
            text,
            [r'Listening (?:Comprehension )?(?:Script|Text)', r'听力(?:原文|文本|文字稿|文稿)', r'录音(?:原文|文字稿)'],
            [r'参考答案', r'答案解析', r'Grammar and Vocabulary'],
        )
        value = compact(raw)
        value = re.sub(r'^(?:Listening (?:Comprehension )?(?:Script|Text)|听力(?:原文|文本|文字稿|文稿))\s*', '', value, flags=re.I)
        if len(value) >= 500 and re.search(r'\b(?:M|W|Man|Woman|Questions?)\s*[:\uff1a]', value, re.I):
            return value
    return ''


def extract_explicit_transcript(texts: list[str]) -> str:
    for text in texts:
        raw = section(
            text,
            [r'Listening Comprehension', r'听力(?:原文|文本|文字稿|文稿)', r'录音(?:原文|文字稿)'],
            [r'参考答案', r'答案解析', r'Grammar and Vocabulary'],
        ) or text
        value = compact(raw)
        if len(value) >= 500 and re.search(r'\b(?:M|W|Man|Woman|Q|Questions?)\s*[:\uff1a]', value, re.I):
            return value
    return ''


def extract_listening_text_answers(text: str, number_min: int, number_max: int):
    marker = re.search(r'参\s*考\s*答\s*案', text)
    tail = compact(text[marker.end():]) if marker else compact(text)
    first_part = re.split(r'第二大题|Grammar and Vocabulary', tail, maxsplit=1, flags=re.I)[0]
    result = {}
    matches = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]\s*', first_part))
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if not number_min <= number <= number_max:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(first_part)
        answer = compact(first_part[match.end():end])
        if answer and len(answer) <= 80:
            result[number] = answer
    return result


def extract_listening_blank_prompts(raw: str) -> dict[int, str]:
    prompts = {}
    first = section(raw, [r'Blanks\s+17\s+through\s+20'], [r'Complete the form'])
    first_lines = [compact(line) for line in first.splitlines() if compact(line)]
    labels = [line[:-1].strip() for line in first_lines if line.endswith(':')]
    if labels:
        last_label_index = max(index for index, line in enumerate(first_lines) if line.endswith(':'))
        values = [line for line in first_lines[last_label_index + 1:] if not re.match(r'Complete the form', line, re.I)]
        for label, value in zip(labels, values):
            match = re.search(r'(?:_|＿)+(\d{1,3})(?:_|＿)+', value)
            if match:
                number = int(match.group(1))
                answer_line = re.sub(r'(?:_|＿)+\d{1,3}(?:_|＿)+', '_____', value)
                prompts[number] = f'{label}: {answer_line}'
    second = section(raw, [r'Blanks\s+21\s+through\s+24'], [r'Complete the form'])
    second_lines = [compact(line) for line in second.splitlines() if compact(line)]
    for index, line in enumerate(second_lines):
        match = re.search(r'(?:_|＿)+(\d{1,3})(?:_|＿)+', line)
        if not match:
            continue
        number = int(match.group(1))
        context = second_lines[index - 1] if index else ''
        answer_line = re.sub(r'(?:_|＿)+\d{1,3}(?:_|＿)+', '_____', line)
        prompts[number] = compact(f'{context} {answer_line}')
    return prompts


def extract_listening_form_context(raw: str) -> dict:
    first = section(raw, [r'Blanks\s+17\s+through\s+20'], [r'Complete the form'])
    lines = [compact(line) for line in first.splitlines() if compact(line)]
    labels = [line[:-1].strip() for line in lines if line.endswith(':')]
    title = ''
    if labels:
        first_label_index = next(index for index, line in enumerate(lines) if line.endswith(':'))
        title_candidates = [line for line in lines[1:first_label_index] if not re.match(r'Blanks\s+17\s+through\s+20', line, re.I)]
        title = title_candidates[-1] if title_candidates else ''
    given_rows = []
    given_rows_before = defaultdict(list)
    if labels:
        last_label_index = max(index for index, line in enumerate(lines) if line.endswith(':'))
        values = lines[last_label_index + 1:]
        pairs = list(zip(labels, values))
        for index, (label, value) in enumerate(pairs):
            if not re.search(r'(?:_|＿)+\d{1,3}(?:_|＿)+', value):
                row = {'label': label, 'value': value}
                given_rows.append(row)
                next_number = next((
                    int(match.group(1))
                    for _, following_value in pairs[index + 1:]
                    if (match := re.search(r'(?:_|＿)+(\d{1,3})(?:_|＿)+', following_value))
                ), 17)
                given_rows_before[next_number].append(row)
    return {
        'formTitle': title,
        'givenRows': given_rows,
        'givenRowsBefore': dict(given_rows_before),
    }


def audio_probe(path: Path):
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,channels,sample_rate,bit_rate', '-of', 'json', str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    try:
        return json.loads(result.stdout.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def decoded_audio_duration(path: Path) -> float:
    result = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-map', '0:a:0', '-f', 'null', '-', '-progress', 'pipe:1', '-nostats'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    values = re.findall(rb'out_time_us=(\d+)', result.stdout)
    return round(int(values[-1]) / 1_000_000, 3) if values else 0.0


def prepare_audio(source: Path, destination_dir: Path, item_id: str, apply: bool):
    digest = hashlib.sha1(source.read_bytes()).hexdigest()[:10]
    target = destination_dir / f'{item_id}-{digest}-64k-mono.mp3'
    if apply:
        destination_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
            '-map_metadata', '-1', '-vn', '-ac', '1', '-ar', '32000', '-codec:a', 'libmp3lame',
            '-b:a', '64k', str(target),
        ], check=True)
    return target, digest


def build_listening_item(session: str, year: int, text: str, source_file: str, answers: dict[int, str], text_answers: dict[int, str], transcript: str, audio: Path | None, apply_audio: bool):
    raw = section(
        text,
        [r'Listening Comprehension', r'(?:I|\u2160)\.?\s*Listening'],
        [r'Grammar and Vocabulary', r'(?:II|\u2161)\.?\s*Grammar'],
    )
    questions = parse_choice_questions(raw, answers, 1, 20, 'Listen and choose the best answer.')
    for question in questions:
        question['sectionKey'] = 'A' if question['number'] <= 10 else 'B'
        question['sectionTitle'] = 'Section A · Listen and choose the best answer.' if question['number'] <= 10 else 'Section B · Listen and choose the best answer.'
        if 11 <= question['number'] <= 13:
            question['groupKey'] = 'B-11-13'
            question['groupTitle'] = 'Questions 11 through 13 are based on the following passage.'
        elif 14 <= question['number'] <= 16:
            question['groupKey'] = 'B-14-16'
            question['groupTitle'] = 'Questions 14 through 16 are based on the following speech.'
    blank_prompts = extract_listening_blank_prompts(raw)
    form_context = extract_listening_form_context(raw)
    for number in sorted(text_answers):
        if number in blank_prompts:
            questions.append({
                'number': number,
                'prompt': blank_prompts[number],
                'answer': text_answers[number],
                'questionType': 'blank',
                'sectionKey': 'C',
                'sectionTitle': 'Section C · Listen and complete the form.',
                'groupKey': 'C-17-20' if number <= 20 else 'C-21-24',
                'groupTitle': 'Blanks 17 through 20 are based on the following conversation.' if number <= 20 else 'Blanks 21 through 24 are based on the following conversation.',
                'groupInstruction': 'Write ONE WORD for each answer.' if number <= 20 else 'Write NO MORE THAN THREE WORDS for each answer.',
                'formTitle': form_context.get('formTitle', '') if number == 17 else '',
                'givenRows': form_context.get('givenRowsBefore', {}).get(number, []),
            })
    questions.sort(key=lambda question: question['number'])
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    base_item_id = f'{prefix}-{year}-listening'
    item_id = f'{base_item_id}-v5' if session == 'autumn' and year == 2009 else base_item_id
    question_numbers = sorted(question['number'] for question in questions)
    expected_count = 20 if session == 'spring' or year >= 2017 else 24
    complete_numbering = bool(
        question_numbers
        and question_numbers[0] == 1
        and question_numbers == list(range(1, question_numbers[-1] + 1))
        and question_numbers[-1] == expected_count
    )
    accepted = bool(audio and complete_numbering)
    target = None
    probe = {}
    if audio:
        if accepted:
            target, _ = prepare_audio(audio, ROOT / 'data' / f'listening-senior-{session}' / 'audio', base_item_id, apply_audio)
        probe_path = target if target and target.exists() else audio
        probe = audio_probe(probe_path)
    source_decoded_duration = decoded_audio_duration(audio) if audio else 0.0
    output_decoded_duration = decoded_audio_duration(target) if target and target.exists() else 0.0
    report = {
        'questions': len(questions),
        'expectedQuestions': expected_count,
        'hasAudio': bool(audio),
        'hasTranscript': bool(transcript),
        'blankPromptsComplete': all(number in blank_prompts for number in range(17, expected_count + 1)) if expected_count >= 24 else True,
        'accepted': accepted,
        'sourceAudio': str(audio) if audio else '',
        'audioProbe': probe,
        'decodedDurationSeconds': {
            'source': source_decoded_duration,
            'output': output_decoded_duration,
            'difference': round(abs(source_decoded_duration - output_decoded_duration), 3),
            'unchanged': bool(output_decoded_duration and abs(source_decoded_duration - output_decoded_duration) <= 0.05),
        },
    }
    if not accepted:
        return None, report
    cloud_path = f'_content/listening-senior-{session}/audio/{target.name}'
    return {
        '_id': item_id,
        'title': f'{year} 上海高考{label}听力',
        'year': year,
        'sourceYear': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'audioCloudPath': cloud_path,
        'audioLocalPath': str(target.relative_to(ROOT)),
        'durationSec': output_decoded_duration,
        'hasAudio': True,
        'hasTranscript': bool(transcript),
        'transcript': transcript,
        'questions': questions,
        'images': [],
    }, report


def build_grammar_files(session: str, questions: list[dict]):
    by_topic = defaultdict(list)
    topic_names = {}
    category_names = dict(TOPIC_META)
    for question in questions:
        by_topic[question['topicId']].append(question)
        topic_names[question['topicId']] = question['topic']
    category_children = defaultdict(list)
    for topic_id, rows in sorted(by_topic.items()):
        category_id = rows[0]['categoryId']
        category_children[category_id].append({'topicId': topic_id, 'topic': topic_names[topic_id], 'count': len(rows)})
    topic_types = []
    for category_id, category in TOPIC_META:
        children = category_children.get(category_id, [])
        topic_types.append({'topicId': category_id, 'topic': category, 'count': sum(item['count'] for item in children), 'children': children})
    groups = [{'topicId': topic_id, 'topic': topic_names[topic_id], 'questions': rows} for topic_id, rows in sorted(by_topic.items())]
    out = ROOT / 'data' / f'grammar-senior-{session}'
    topics_dir = out / 'topics'
    topics_dir.mkdir(parents=True, exist_ok=True)
    for stale_file in topics_dir.glob('*.json'):
        stale_file.unlink()
    dump_json(out / 'grammar-topic-types.json', topic_types)
    dump_json(out / 'shanghai-senior-grammar-by-topic.json', groups)
    dump_json(out / 'shanghai-senior-grammar-questions.json', questions)
    for topic_id, rows in by_topic.items():
        filename = hashlib.sha1(topic_id.encode('utf-8')).hexdigest() + '.json'
        dump_json(topics_dir / filename, {'topicId': topic_id, 'topic': topic_names[topic_id], 'questions': rows})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--apply-audio', action='store_true')
    parser.add_argument('--years', default='', help='Comma-separated years, for example 2009')
    parser.add_argument('--sessions', default='', help='Comma-separated sessions: spring,autumn')
    args = parser.parse_args()
    selected_years = {int(value) for value in args.years.split(',') if value.strip()}
    selected_sessions = {value.strip() for value in args.sessions.split(',') if value.strip()}
    documents, audios, transcript_docs = collect_sources(args.source)
    all_reports = []
    outputs = {session: {'reading': [], 'writing': [], 'grammar': [], 'listening': []} for session in SESSIONS}
    for key in sorted(set(documents) | set(audios) | set(transcript_docs)):
        session, year = key
        if selected_years and year not in selected_years:
            continue
        if selected_sessions and session not in selected_sessions:
            continue
        candidates = sorted(documents.get(key, []), key=source_score, reverse=True)
        texts = []
        for path in candidates:
            value = read_document(path)
            if value:
                texts.append((path, value))
        if not texts:
            all_reports.append({'session': session, 'year': year, 'accepted': False, 'reason': 'paper-text-missing'})
            continue
        source_path, primary = next(
            ((path, value) for path, value in texts if '空白卷' in path.name),
            texts[0],
        )
        combined = '\n'.join(value for _, value in texts)
        answers = extract_answer_map(combined)
        text_answers = extract_listening_text_answers(combined, 1, 30)
        explicit_transcripts = [read_document(path) for path in transcript_docs.get(key, [])]
        transcript = extract_explicit_transcript(explicit_transcripts)
        if not transcript:
            transcript = extract_transcript([value for _, value in texts])
        vocabulary_cloze, vocabulary_cloze_report = build_vocabulary_cloze_item(session, year, primary, source_path.name, answers)
        readings, reading_report = build_reading_items(session, year, primary, source_path.name, answers)
        if vocabulary_cloze:
            readings.insert(0, vocabulary_cloze)
        translation, translation_report = build_translation_item(session, year, primary, source_path.name)
        writing, writing_report = build_writing_item(session, year, primary, source_path.name)
        grammar, grammar_report = build_grammar_questions(session, year, primary, source_path.name, answers)
        listening, listening_report = build_listening_item(
            session, year, primary, source_path.name, answers, text_answers, transcript,
            audios.get(key), args.apply_audio,
        )
        outputs[session]['reading'].extend(readings)
        outputs[session]['grammar'].extend(grammar)
        if translation:
            outputs[session]['writing'].append(translation)
        if writing:
            outputs[session]['writing'].append(writing)
        if listening:
            outputs[session]['listening'].append(listening)
        all_reports.append({
            'session': session,
            'year': year,
            'sourceFile': source_path.name,
            'sourceCandidates': [path.name for path, _ in texts],
            'answerCount': len(answers),
            'reading': reading_report,
            'vocabularyCloze': vocabulary_cloze_report,
            'writing': writing_report,
            'translation': translation_report,
            'grammar': grammar_report,
            'listening': listening_report,
        })
    for session, content in outputs.items():
        dump_json(ROOT / 'data' / f'reading-senior-{session}' / 'reading-passages.json', content['reading'])
        dump_json(ROOT / 'data' / f'writing-senior-{session}' / 'writing-prompts.json', content['writing'])
        dump_json(ROOT / 'data' / f'listening-senior-{session}' / 'listening-practice.json', content['listening'])
        build_grammar_files(session, content['grammar'])
    summary = {
        session: {key: len(value) for key, value in content.items()}
        for session, content in outputs.items()
    }
    dump_json(IMPORT_DIR / 'clean-report.json', {'summary': summary, 'papers': all_reports})
    print(json.dumps({'mode': 'apply-audio' if args.apply_audio else 'dry-run', 'summary': summary}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
