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
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

from shanghai_senior_summary_structure import extract_summary_source
from reading_content_structure import structure_reading_item


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
    module_dir = ROOT / 'data' / f'grammar-senior-{session}'
    year_path = module_dir / 'years' / str(year) / f'grammar-classification-review-{year}-{session}.json'
    path = year_path if year_path.exists() else module_dir / f'grammar-classification-review-{year}-{session}.json'
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
    value = re.sub(r'\s+', ' ', clean(value)).strip()
    return re.sub(r'(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])', '', value)


def dump_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def ocr_pdf(path: Path) -> str:
    if not shutil.which('pdftoppm') or not shutil.which('tesseract'):
        return ''
    with tempfile.TemporaryDirectory(prefix='senior-pdf-ocr-') as temp_dir:
        prefix = Path(temp_dir) / 'page'
        subprocess.run(
            ['pdftoppm', '-r', '240', '-png', str(path), str(prefix)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=240, check=False,
        )
        pages = []
        for image_path in sorted(Path(temp_dir).glob('page-*.png')):
            result = subprocess.run(
                ['tesseract', str(image_path), 'stdout', '-l', 'eng', '--psm', '6'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, check=False,
            )
            pages.append(result.stdout.decode('utf-8', errors='ignore'))
        return clean('\n\n'.join(pages))


def read_document(path: Path) -> str:
    if path.suffix.lower() in {'.doc', '.docx'}:
        with tempfile.TemporaryDirectory(prefix='senior-doc-render-') as temp_dir:
            subprocess.run([
                'soffice', f'-env:UserInstallation=file://{temp_dir}/profile', '--headless',
                '--convert-to', 'pdf', '--outdir', temp_dir, str(path),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, check=False)
            rendered = sorted(Path(temp_dir).glob('*.pdf'))
            if rendered:
                result = subprocess.run(
                    ['pdftotext', '-layout', str(rendered[0]), '-'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=120,
                    check=False,
                )
                value = clean(result.stdout.decode('utf-8', errors='ignore'))
                if value:
                    return value
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
        value = clean(result.stdout.decode('utf-8', errors='ignore'))
        return value if len(value) >= 200 else ocr_pdf(path)
    return ''


def read_textutil_document(path: Path) -> str:
    result = subprocess.run(
        ['textutil', '-convert', 'txt', '-stdout', str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
        check=False,
    )
    return clean(result.stdout.decode('utf-8', errors='ignore'))


def rewrite_grouped_task(text: str, start_pattern: str, end_pattern: str, target_start: int, count: int, label: str = '') -> str:
    start = re.search(start_pattern, text, re.I | re.M)
    if not start:
        return text
    tail = text[start.end():]
    end_match = re.search(end_pattern, tail, re.I | re.M)
    end = start.end() + end_match.start() if end_match else len(text)
    block = text[start.end():end]
    for offset in range(count):
        local_number = offset + 1
        block = re.sub(
            rf'[（(]\s*{local_number}\s*[）)]',
            f'{target_start + offset}.',
            block,
        )
    replacement = f'{label}\n{block}' if label else block
    return text[:start.start()] + replacement + text[end:]


def normalize_primary_document(session: str, year: int, text: str) -> str:
    if session == 'autumn' and year == 2012:
        return re.sub(r'(?<!\d)(41\s*[.．、]\s*)1(?=\s|$)', r'\1I', text)
    if session == 'autumn' and year == 2013:
        normalized = text
        listening_end = re.search(r'(?m)^\s*第\s*II\s*卷\s*$', normalized, re.I)
        listening = normalized[:listening_end.start()] if listening_end else normalized
        tail = normalized[listening_end.start():] if listening_end else ''
        markers = list(re.finditer(r'(?m)^\s*(\d{1,2})\s*[.．、]\s*$', listening))
        for index in reversed(range(len(markers))):
            marker = markers[index]
            number = int(marker.group(1))
            if not 1 <= number <= 10:
                continue
            end = markers[index + 1].start() if index + 1 < len(markers) else len(listening)
            block = listening[marker.end():end]
            question = re.search(r'(?m)^\s*Q\s*[:：]\s*([^\n]+)', block, re.I)
            answer = re.search(r'(?m)^\s*【\s*答\s*案\s*】', block)
            if not question or not answer or question.end() >= answer.start():
                continue
            option_lines = [compact(line) for line in block[question.end():answer.start()].splitlines() if compact(line)]
            if len(option_lines) != 4:
                continue
            cleaned_options = []
            for key, value in zip('ABCD', option_lines):
                value = re.sub(r'^(?:[A-D]|1[12]|[（(]\s*[1-4]\s*[）)])\s*[.．、]?\s*', '', value, count=1, flags=re.I)
                cleaned_options.append(value)
            replacement = '\n'.join([
                f'{number}. {compact(question.group(1))}',
                *[f'{key}. {value}' for key, value in zip('ABCD', cleaned_options)],
                clean(block[answer.start():]),
            ]) + '\n'
            listening = listening[:marker.start()] + replacement + listening[end:]
        return (listening + tail).replace('lnfomation-gathering abilities', 'Information-gathering abilities')
    if session == 'autumn' and year == 2014:
        return re.sub(r'(?<!\d)(43\s*[.．、]\s*)1(?=\s|$)', r'\1I', text)
    if session == 'autumn' and year == 2015:
        normalized = text
        normalized = re.sub(r'(?<=[A-Z])(?=1[45]\s*[、.．])', ' ', normalized)
        normalized = re.sub(r'(?<=looking)(?=29\s*[、.．])', ' ', normalized)
        normalized = re.sub(r'(?<=somebody)(?=39\s*[、.．])', ' ', normalized)
        normalized = re.sub(r'(?<=inspiring)(?=24\s*[、.．])', ' ', normalized)
        normalized = normalized.replace('has bean interrupted', 'has been interrupted')
        return normalized
    if year == 2018:
        normalized = text
        normalized = re.sub(r'(?<!\d)2[lI]\s*[.]', '21.', normalized)
        normalized = re.sub(r'(?<!\d)6[lI]\s*[.]', '\n61.', normalized)
        if session == 'spring':
            normalized = re.sub(r'(?m)^(\s*46\s*[.．、]\s*)Scene\b', r'\1A. Scene', normalized)
        else:
            normalized = re.sub(r'(?m)^(\s*)51\s*[.．、]\s*A\s*[.．、]\s*slower\b', r'\g<1>52. A. slower', normalized)
        return normalized
    if year == 2019:
        normalized = text
        if session == 'spring':
            normalized = re.sub(r'(?m)^(\s*(?:42|50|51)\s*[.．、]\s*)A\s+(?=[a-z])', r'\1A. ', normalized)
            normalized = re.sub(r'(?m)^(\s*55\s*[.．、][^\n]*?\s)B\s+(?=complex\b)', r'\1B. ', normalized)
        else:
            normalized = normalized.replace('B. Convey her dissatisfaction with her work.', 'C. Convey her dissatisfaction with her work.')
        return normalized
    if year == 2020:
        normalized = text
        grouped_tasks = [
            (r'^\s*11\s*[．.]\s*(?=[（(]\s*1\s*[）)])', r'^\s*12\s*[．.]\s*(?=[（(]\s*1\s*[）)])', 11, 3, ''),
            (r'^\s*12\s*[．.]\s*(?=[（(]\s*1\s*[）)])', r'^\s*13\s*[．.]\s*(?=[（(]\s*1\s*[）)])', 14, 3, ''),
            (r'^\s*13\s*[．.]\s*(?=[（(]\s*1\s*[）)])', r'^\s*Grammar and Vocabulary', 17, 4, ''),
            (r'^\s*14\s*[．.]\s*$', r'^\s*Section\s+B\b', 21, 10, ''),
            (r'^\s*15\s*[．.]\s*$', r'^\s*Reading Comprehension', 31, 10, ''),
            (r'^\s*16\s*[．.]\s*(?=(?:["“]Clean eating|Fitness experts))', r'^\s*Section\s+B\b', 41, 15, ''),
            (r'^\s*17\s*[．.]\s*(?=(?:When I was|James Cameron))', r'^\s*18\s*[．.]\s*(?=(?:$|When I became))', 56, 4, '(A)'),
            (r'^\s*18\s*[．.]\s*(?=(?:$|When I became))', r'^\s*19\s*[．.]\s*(?=(?:Our green spaces|The books we read))', 60, 3, '(B)'),
            (r'^\s*19\s*[．.]\s*(?=(?:Our green spaces|The books we read))', r'^\s*20\s*[．.]\s*Directions', 63, 4, '(C)'),
            (r'^\s*20\s*[．.]\s*Directions', r'^\s*Summary Writing', 67, 4, 'Section C\nDirections'),
        ]
        for start_pattern, end_pattern, target_start, count, label in reversed(grouped_tasks):
            normalized = rewrite_grouped_task(normalized, start_pattern, end_pattern, target_start, count, label)
        normalized = re.sub(r'Summary WritingDirections', 'Summary Writing\nDirections', normalized, flags=re.I)
        summary_start = re.search(r'Summary Writing', normalized, re.I)
        translation_start = re.search(r'Translation', normalized, re.I)
        writing_start = re.search(r'Guided Writing', normalized, re.I)
        if summary_start and translation_start and summary_start.start() < translation_start.start():
            summary = normalized[summary_start.start():translation_start.start()]
            summary = re.sub(r'(?m)^(\s*)21\s*[．.、]', r'\g<1>71.', summary, count=1)
            normalized = normalized[:summary_start.start()] + summary + normalized[translation_start.start():]
        translation_start = re.search(r'Translation', normalized, re.I)
        writing_start = re.search(r'Guided Writing', normalized, re.I)
        if translation_start and writing_start and translation_start.start() < writing_start.start():
            translation = normalized[translation_start.start():writing_start.start()]
            for source_number, target_number in {22: 72, 23: 73, 24: 74, 25: 75}.items():
                translation = re.sub(rf'(?m)^(\s*){source_number}\s*[．.、]', rf'\g<1>{target_number}.', translation, count=1)
            normalized = normalized[:translation_start.start()] + translation + normalized[writing_start.start():]
        writing_start = re.search(r'Guided Writing', normalized, re.I)
        if writing_start:
            writing = normalized[writing_start.start():]
            writing = re.sub(r'(?m)^(\s*)26\s*[．.、]', r'\g<1>76.', writing, count=1)
            normalized = normalized[:writing_start.start()] + writing
        if session == 'autumn':
            normalized = re.sub(r"(B\s*[.．]\s*Giving some help to poor farmers\s*[.．]\s*)D(\s*[.．]\s*Store['’]s address)", r'\1C\2', normalized)
            normalized = re.sub(r'(?m)^\s*效[.。]\s*$', '', normalized)
        return normalized
    if year == 2023:
        normalized = text
        if session == 'spring':
            normalized = re.sub(r'(?m)^(\s*)[•·]?\s*A\s*[.．]\s*Disappointed\b', r'\g<1>1. A. Disappointed', normalized, count=1)
            normalized = normalized.replace('B，There is only one subspecies of scarlet macaws.', 'B. There is only one subspecies of scarlet macaws.')
            normalized = re.sub(r'(?m)^\s*[•·]\s*(Before you stock up at cafe)', r'A. \1', normalized, count=1)
            normalized = re.sub(r'(?m)^\s*[•·]\s*(Coffee has its advantages)', r'B. \1', normalized, count=1)
            normalized = re.sub(r'(?m)^\s*[•·]\s*(_+\s*Some side effects)', r'(69)\1', normalized, count=1)
        else:
            normalized = re.sub(r'(?m)(D\. It may be colder at the end of this\s+month\.)\s*9\s*[.．]', r'\1\n9.', normalized, count=1)
            normalized = re.sub(r'(?m)^\s*1[lI]\s*[.．]', '11.', normalized, count=1)
            normalized = re.sub(r'(D\. To make room for activities\.)\s*12\s*[.．]', r'\1\n12.', normalized, count=1)
            normalized = re.sub(r'(D\. It is more complicated and more excellent)\s+15\s*[.．]', r'\1\n15.', normalized, count=1)
            normalized = re.sub(r"(?m)^\s*(She isn't getting along well with her roommate\.)", r'B. \1', normalized, count=1)
            normalized = re.sub(r'(?m)^\s*(She has trouble making new friends in new places\.)', r'C. \1', normalized, count=1)
            normalized = re.sub(r"(?m)^\s*(She doesn't want to be friends with Mary any more\.)", r'D. \1', normalized, count=1)
            normalized = normalized.replace('C, The villagers wove', 'C. The villagers wove')
            normalized = re.sub(r'(?m)^\s*6[lI]\s*[.．]', '61.', normalized, count=1)
            normalized = normalized.replace('D, A speech on the environmental and economic crisis.', 'D. A speech on the environmental and economic crisis.')
            normalized = re.sub(r'[（(]\s*([1-5])\s*[）)]', r'[\1]', normalized)
            normalized = normalized.replace('C, It is unlikely that this discrepancy occurred by chance.', 'C. It is unlikely that this discrepancy occurred by chance.')
            normalized = re.sub(r'(D\. Hubble\'s tension is the most exciting development in cosmology in decades\.)\s*65\s*[.．]', r'\1\n65.', normalized, count=1)
            normalized = normalized.replace(
                'B. They improved the comparison between\nC.They raised the uncertainty',
                'B. They improved the comparison between those Cepheids and their more distant cousins.\nC. They raised the uncertainty',
            )
            normalized = re.sub(
                r'B\. They improved the comparison between\s+C\.?\s*They raised the uncertainty',
                'B. They improved the comparison between those Cepheids and their more distant cousins.\nC. They raised the uncertainty',
                normalized,
                count=1,
            )
            normalized = re.sub(r'[（(]\s*6\s+9\s*[）)]\s*(?:_\s*)+', '(69) ________ ', normalized, count=1)
            normalized = normalized.replace('teachers(68)dove in to', 'teachers dove in to')
            normalized = re.sub(r'(?<!\d)2[lI](?=\s*[）)])', '21', normalized, count=1)
            normalized = re.sub(r'(Directions\s*:\s*Translate[^\n]*?brackets)\s+(72\s*[.．])', r'\1\n\2', normalized, count=1, flags=re.I)
        return normalized
    if session == 'autumn' and year == 2017:
        normalized = text
        heading_replacements = [
            (r'(Grammar and Vocabulary)\s*(Section\s+A)\s*(Directions)', r'\1\n\2\n\3'),
            (r'(Reading Comprehension\s*[（(]?\s*45%\s*[）)]?)\s*(Section\s+A)\s*(Directions)', r'\1\n\2\n\3'),
            (r'(Section\s+[BC])\s*(Directions)', r'\1\n\2'),
            (r'(Translation)\s*(Directions)', r'\1\n\2'),
        ]
        for pattern, replacement in heading_replacements:
            normalized = re.sub(pattern, replacement, normalized, flags=re.I)

        group_14 = re.search(r'Questions\s+14\s+through\s+16[^\n]*\n', normalized, re.I)
        if group_14:
            tail = normalized[group_14.end():]
            tail = re.sub(r'(?m)^\s*[•·]\s*(?=A\s*[.．])', '14. ', tail, count=1)
            normalized = normalized[:group_14.end()] + tail
        group_17 = re.search(r'Questions\s+17\s+through\s+20[^\n]*\n', normalized, re.I)
        if group_17:
            tail = normalized[group_17.end():]
            end_match = re.search(r'(?m)^\s*(?:II|Ⅱ)[.]?\s*Grammar and Vocabulary', tail, re.I)
            end = end_match.start() if end_match else len(tail)
            block = tail[:end]
            for number in (18, 19, 20):
                block = re.sub(r'(?m)^\s*[•·]\s*(?=A\s*[.．])', f'{number}. ', block, count=1)
            normalized = normalized[:group_17.end()] + block + tail[end:]

        grouped_tasks = [
            (r'^\s*1\s*[．.]\s*[（(]\s*10\s*分\s*[）)]', r'^\s*Section\s+B\b', 21, 10, ''),
            (r'^\s*2\s*[．.]\s*[（(]\s*10\s*分\s*[）)]', r'^\s*(?:III|Ⅲ)[.]?\s*Reading Comprehension', 31, 10, ''),
            (r'^\s*3\s*[．.]\s*[（(]\s*15\s*分\s*[）)]', r'^\s*Section\s+B\b', 41, 15, ''),
            (r'^\s*4\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*5\s*[．.]', 56, 4, '(A)'),
            (r'^\s*5\s*[．.]\s*[（(]\s*6\s*分\s*[）)]', r'^\s*6\s*[．.]', 60, 3, '(B)'),
            (r'^\s*6\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*Section\s+C\b', 63, 4, '(C)'),
            (r'^\s*7\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*Summary Writing', 67, 4, ''),
        ]
        for start_pattern, end_pattern, target_start, count, label in grouped_tasks:
            normalized = rewrite_grouped_task(normalized, start_pattern, end_pattern, target_start, count, label)
        for source_number, target_number in {8: 71, 9: 72, 10: 73, 11: 74, 12: 75, 13: 76}.items():
            normalized = re.sub(
                rf'(?m)^\s*{source_number}\s*[．.]\s*[（(]\s*\d+\s*分\s*[）)]',
                f'{target_number}.',
                normalized,
                count=1,
            )
        return normalized
    if session == 'autumn' and year == 2016:
        normalized = text
        grouped_tasks = [
            (r'^\s*19\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*20\s*[．.]', 66, 4, '(A)'),
            (r'^\s*20\s*[．.]\s*[（(]\s*6\s*分\s*[）)]', r'^\s*21\s*[．.]', 70, 3, '(B)'),
            (r'^\s*21\s*[．.]\s*[（(]\s*10\s*分\s*[）)]', r'^\s*Section\s+C\b', 73, 5, '(C)'),
        ]
        for start_pattern, end_pattern, target_start, count, label in grouped_tasks:
            normalized = rewrite_grouped_task(normalized, start_pattern, end_pattern, target_start, count, label)
        return normalized
    if year >= 2025 and re.search(r'Grammar and Vocabulary', text, re.I) and re.search(r'Reading Comprehension', text, re.I):
        normalized = text
        grammar_start = re.search(r'Grammar and Vocabulary', normalized, re.I)
        reading_start = re.search(r'Reading Comprehension', normalized, re.I)
        if grammar_start and reading_start and grammar_start.start() < reading_start.start():
            grammar = normalized[grammar_start.start():reading_start.start()]
            if all(re.search(rf'(?<!\d){number}(?!\d)', grammar) for number in range(1, 21)):
                grammar = re.sub(
                    r'(?<!\d)([1-9]|1\d|20)(?!\d)',
                    lambda match: str(int(match.group(1)) + 20),
                    grammar,
                )
                normalized = normalized[:grammar_start.start()] + grammar + normalized[reading_start.start():]
        summary_start = re.search(r'Summary Writing', normalized, re.I)
        reading_start = re.search(r'Reading Comprehension', normalized, re.I)
        if reading_start and summary_start and reading_start.start() < summary_start.start():
            reading = normalized[reading_start.start():summary_start.start()]
            section_b = re.search(r'(?m)^\s*Section\s+B\b', reading, re.I)
            if section_b:
                head, tail = reading[:section_b.start()], reading[section_b.start():]
                if all(re.search(rf'(?<!\d){number}(?!\d)', head) for number in range(21, 36)):
                    head = re.sub(
                        r'(?<!\d)(2[1-9]|3[0-5])(?!\d)',
                        lambda match: str(int(match.group(1)) + 20),
                        head,
                    )
                tail = re.sub(
                    r'(?<!\d)(3[6-9]|4[0-6])(\s*[.．、])(?!\d)',
                    lambda match: f'{int(match.group(1)) + 20}{match.group(2)}',
                    tail,
                )
                reading = head + tail
            section_c = re.search(r'(?m)^\s*Section\s+C\b', reading, re.I)
            if section_c:
                head, tail = reading[:section_c.start()], reading[section_c.start():]
                tail = re.sub(
                    r'(?<!\d)(4[7-9]|50)(?!\d)',
                    lambda match: str(int(match.group(1)) + 20),
                    tail,
                )
                reading = head + tail
            normalized = normalized[:reading_start.start()] + reading + normalized[summary_start.start():]
        summary_start = re.search(r'Summary Writing', normalized, re.I)
        translation_start = re.search(r'Translation', normalized, re.I)
        if summary_start and translation_start and summary_start.start() < translation_start.start():
            summary = normalized[summary_start.start():translation_start.start()]
            summary = re.sub(r'(?<!\d)51(?=\s*[.．、])', '71', summary)
            normalized = normalized[:summary_start.start()] + summary + normalized[translation_start.start():]
        translation_start = re.search(r'Translation', normalized, re.I)
        writing_start = re.search(r'Guided Writing', normalized, re.I)
        if translation_start and writing_start and translation_start.start() < writing_start.start():
            translation = normalized[translation_start.start():writing_start.start()]
            translation = re.sub(
                r'(?<!\d)(5[2-5])(?=\s*[.．、])',
                lambda match: str(int(match.group(1)) + 20),
                translation,
            )
            normalized = normalized[:translation_start.start()] + translation + normalized[writing_start.start():]
        writing_start = re.search(r'Guided Writing', normalized, re.I)
        if writing_start:
            writing = normalized[writing_start.start():]
            writing = re.sub(r'(?m)^(\s*)56(?=\s*[.．、])', r'\g<1>76', writing, count=1)
            normalized = normalized[:writing_start.start()] + writing
        return normalized
    if session != 'spring' or year != 2021:
        return text
    normalized = text
    grouped_tasks = [
        (r'^\s*11\s*[．.]\s*[（(]\s*4[.]?5\s*分\s*[）)]', r'^\s*12\s*[．.]', 11, 3, ''),
        (r'^\s*12\s*[．.]\s*[（(]\s*4[.]?5\s*分\s*[）)]', r'^\s*13\s*[．.]', 14, 3, ''),
        (r'^\s*13\s*[．.]\s*[（(]\s*6\s*分\s*[）)]', r'^\s*(?:II|Ⅱ)[.]?\s*Grammar and Vocabulary', 17, 4, ''),
        (r'^\s*15\s*[．.]\s*[（(]\s*10\s*分\s*[）)]', r'^\s*(?:III|Ⅲ)[.]?\s*Reading Comprehension', 31, 10, ''),
        (r'^\s*16\s*[．.]\s*[（(]\s*15\s*分\s*[）)]', r'^\s*Section\s+B\b', 41, 15, ''),
        (r'^\s*17\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*18\s*[．.]', 56, 4, '(A)'),
        (r'^\s*18\s*[．.]\s*[（(]\s*6\s*分\s*[）)]', r'^\s*19\s*[．.]', 60, 3, '(B)'),
        (r'^\s*19\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*Section\s+C\b', 63, 4, '(C)'),
        (r'^\s*20\s*[．.]\s*[（(]\s*8\s*分\s*[）)]', r'^\s*(?:IV|Ⅳ)[.]?\s*Summary Writing', 67, 4, ''),
    ]
    for start_pattern, end_pattern, target_start, count, label in grouped_tasks:
        normalized = rewrite_grouped_task(normalized, start_pattern, end_pattern, target_start, count, label)
    replacements = {21: 71, 22: 72, 23: 73, 24: 74, 25: 75, 26: 76}
    for source_number, target_number in replacements.items():
        normalized = re.sub(
            rf'(?m)^\s*{source_number}\s*[．.]\s*[（(]\s*\d+\s*分\s*[）)]',
            f'{target_number}.',
            normalized,
            count=1,
        )
    return normalized


def normalization_corrections(session: str, year: int) -> list[str]:
    corrections = {
        ('autumn', 2012): ['41 answer OCR 1 normalized to I'],
        ('autumn', 2013): ['restored A-D labels for Listening questions 1-10 from the four source option lines'],
        ('autumn', 2014): ['43 answer OCR 1 normalized to I'],
        ('autumn', 2015): ['14, 15, 29, 39 and 24 answer numbers joined to the previous answer', '39 answer OCR bean normalized to been'],
        ('spring', 2018): ['46 missing option A label', '61 OCR number 6l'],
        ('autumn', 2018): ['21 OCR number 2l', '52 duplicated as 51', '61 OCR number 6l'],
        ('spring', 2019): ['missing option punctuation in 42, 50, 51 and 55', 'split implicit Guided Writing requirements'],
        ('autumn', 2019): ['58 option C duplicated as B'],
        ('spring', 2020): ['local task numbering 11-26 mapped to paper numbering 11-76', 'exposed implicit Guided Writing requirement'],
        ('autumn', 2020): ['local task numbering 11-26 mapped to paper numbering 11-76', '13 option C mislabeled as D', 'removed stray OCR line after Guided Writing requirements'],
    }
    return corrections.get((session, year), [])


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


def is_primary_paper(path: Path) -> bool:
    name = path.name
    if '空白卷' in name or '原卷版' in name:
        return True
    return not any(marker in name for marker in ('解析', '答案', '听力部分', '口语试题'))


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
            if '听力' in path.name and '口语' not in path.name:
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
    for marker in re.finditer(r'【\s*答\s*案\s*】', normalized):
        block = normalized[marker.end():marker.end() + 500]
        block = re.split(r'【', block, maxsplit=1)[0]
        for number, letter in re.findall(r'(\d{1,3})\s*[.．、]\s*([A-K])(?:[.．、])?(?=\s|$)', block):
            answers[int(number)] = letter
    for match in re.finditer(r'(?m)^\s*(\d{1,3})\s*[.．、]\s*[^\n]{5,500}?\s+([A-D])\s*$', clean(text).upper()):
        answers[int(match.group(1))] = match.group(2)
    range_pattern = re.compile(r'(\d{1,3})\s*(?:-|~|～|至)\s*(\d{1,3})\s*[.:\uff0e、】\s]*([A-K](?:\s*[A-K]){1,30})\b')
    for match in range_pattern.finditer(normalized):
        start, end = int(match.group(1)), int(match.group(2))
        letters = re.sub(r'\s+', '', match.group(3))
        expected = end - start + 1
        if end >= start and len(letters) >= expected:
            for offset, letter in enumerate(letters[:expected]):
                answers[start + offset] = letter
    chunk_pattern = re.compile(r'(?:^|\s)(\d{1,3})\s*(?:-|~|～|至)?\s*\d{0,3}\s*[.:\uff0e、】\s]*([A-K](?:\s*[A-K]){1,10})\b')
    for match in chunk_pattern.finditer(normalized):
        start = int(match.group(1))
        letters = re.sub(r'\s+', '', match.group(2))
        for offset, letter in enumerate(letters):
            answers.setdefault(start + offset, letter)
    for match in re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、\uff09)]?\s*([A-K])(?=\s|$)', normalized):
        answers.setdefault(int(match.group(1)), match.group(2))
    for match in re.finditer(r'(?:^|[\s;；,，])(\d{1,3})\s*[.\uff0e、]\s*([A-D])(?=[\s;；,，]|$)', normalized):
        answers[int(match.group(1))] = match.group(2)
    for match in re.finditer(r'[（(]\s*(\d{1,3})\s*[）)]\s*([A-K])(?=\s|[.．、]|$)', normalized):
        answers.setdefault(int(match.group(1)), match.group(2))
    for match in re.finditer(r'[（(]\s*(\d{1,3})\s*[）)]\s*(?:-|~|～|至)\s*[（(]\s*(\d{1,3})\s*[）)]\s*([A-K]+)', normalized):
        start, end = int(match.group(1)), int(match.group(2))
        letters = match.group(3)
        if end >= start and len(letters) >= end - start + 1:
            for offset, letter in enumerate(letters[:end - start + 1]):
                answers.setdefault(start + offset, letter)
    for marker in re.finditer(r'【\s*解\s*答\s*】', normalized):
        block = normalized[marker.end():marker.end() + 1200]
        block = re.split(r'【\s*(?:点评|答案|分析)\s*】', block, maxsplit=1)[0]
        for match in re.finditer(r'(?:^|\s|[（(])(\d{1,3})\s*[）)]?\s*[.\uff0e、]?\s*([A-D])(?=\s|$)', block):
            answers[int(match.group(1))] = match.group(2)
    for marker in re.finditer(r'【\s*答\s*案\s*】\s*([A-D])\b', normalized):
        prior = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]\s*', normalized[:marker.start()]))
        if prior:
            answers[int(prior[-1].group(1))] = marker.group(1)
    for match in re.finditer(
        r'(?:^|\s|【\s*解\s*答\s*】)(\d{1,3})\s*[.．、]\s*([A-K])\s*[.．。]?\s*(?=【\s*(?:解析|解答|答案)\s*】|[\u3400-\u9fff])',
        normalized,
    ):
        answers[int(match.group(1))] = match.group(2)
    for match in re.finditer(r'(?:^|\s)(\d{1,3})\s*[.．、]\s*([A-K])[oO]\s*(?=【\s*解析\s*】)', normalized):
        answers[int(match.group(1))] = match.group(2)
    return answers


def answer_letters(raw: str, expected: int) -> str:
    matches = re.findall(r'【\s*答案\s*】\s*([A-K](?:\s*[A-K]){2,20})', raw, re.I)
    for value in matches:
        letters = re.sub(r'\s+', '', value).upper()
        if len(letters) == expected:
            return letters
    return ''


def extract_contextual_answer_map(text: str) -> dict[int, str]:
    answers = {}
    sections = reading_sections(text)
    section_a = answer_letters(sections.get('A', ''), 15)
    for offset, letter in enumerate(section_a):
        answers[41 + offset] = letter
    section_b_sequences = [
        re.sub(r'\s+', '', value).upper()
        for value in re.findall(r'【\s*答案\s*】\s*([A-D](?:\s*[A-D]){2,5})', sections.get('B', ''), re.I)
    ]
    expected_groups = [(56, 4), (60, 3), (63, 4)]
    for (start, expected), letters in zip(expected_groups, section_b_sequences):
        if len(letters) == expected:
            for offset, letter in enumerate(letters):
                answers[start + offset] = letter
    section_c = answer_letters(sections.get('C', ''), 4)
    for offset, letter in enumerate(section_c):
        answers[67 + offset] = letter
    return answers


def extract_vocabulary_answer_map(text: str) -> dict[int, str]:
    grammar = section(text, [r'Grammar and Vocabulary'], [r'Reading Comprehension'])
    section_b = re.search(r'(?m)^\s*Section\s+B\b', grammar, re.I)
    if not section_b:
        return {}
    letters = answer_letters(grammar[section_b.start():], 10)
    return {31 + offset: letter for offset, letter in enumerate(letters)}


def extract_grouped_listening_answer_map(text: str) -> dict[int, str]:
    listening = section(text, [r'Listening Comprehension', r'(?:I|\u2160)\.?\s*Listening'], [r'Grammar and Vocabulary'])
    compact_listening = compact(listening).upper()
    answers = {}
    for start, end in ((1, 5), (6, 10), (11, 13), (14, 16), (17, 20)):
        expected = end - start + 1
        match = re.search(
            rf'(?<!\d){start}\s*(?:-|~|～|至|`|’|\')\s*{end}\s*[.：:]?\s*([A-D](?:\s*[A-D]){{{expected - 1}}})',
            compact_listening,
        )
        if match:
            for offset, letter in enumerate(re.sub(r'\s+', '', match.group(1))):
                answers[start + offset] = letter
    range_match = re.search(r'1\s*(?:-|~|～|至)\s*10\s*[.：:]?\s*([A-D](?:\s*[A-D]){9})', compact_listening)
    if range_match:
        for offset, letter in enumerate(re.sub(r'\s+', '', range_match.group(1))):
            answers[1 + offset] = letter
    for task_number, target_start, expected in ((11, 11, 3), (12, 14, 3), (13, 17, 4)):
        match = re.search(rf'(?<!\d){task_number}\s*[.．、]\s*([A-D](?:\s*[A-D]){{{expected - 1}}})', compact_listening)
        if not match:
            continue
        for offset, letter in enumerate(re.sub(r'\s+', '', match.group(1))):
            answers[target_start + offset] = letter
    solution_groups = [
        re.sub(r'\s+', '', value).upper()
        for value in re.findall(r'【\s*解\s*答\s*】\s*([A-D](?:\s*[A-D]){2,3})', listening, re.I)
    ]
    group_index = 0
    for target_start, expected in ((11, 3), (14, 3), (17, 4)):
        while group_index < len(solution_groups) and len(solution_groups[group_index]) != expected:
            group_index += 1
        if group_index >= len(solution_groups):
            break
        for offset, letter in enumerate(solution_groups[group_index]):
            answers[target_start + offset] = letter
        group_index += 1
    return answers


def extract_inline_listening_answer_map(text: str) -> dict[int, str]:
    listening = section(text, [r'Listening Comprehension', r'(?:I|\u2160)\.?\s*Listening'], [r'Grammar and Vocabulary'])
    markers = list(re.finditer(r'(?m)^\s*(\d{1,2})\s*[.．、]\s*A\s*[.．、]', listening))
    answers = {}
    for index, marker in enumerate(markers):
        number = int(marker.group(1))
        if not 1 <= number <= 20:
            continue
        end = markers[index + 1].start() if index + 1 < len(markers) else len(listening)
        block = listening[marker.end():end]
        answer_match = re.search(r'【\s*解\s*答\s*】\s*([A-D])\b', block, re.I)
        if answer_match:
            answers[number] = answer_match.group(1).upper()
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


def question_line_starts(text: str):
    return list(re.finditer(
        r'(?m)^\s*(?:(\d{1,3})\s*(?:[.\uff0e、\uff09)]\s*|(?=A\s*[.\uff0e、\uff09)])|$)|[（(]\s*(\d{1,3})\s*[）)]\s*)',
        text,
    ))


def question_marker_number(match) -> int:
    return int(match.group(1) or match.group(2))


def parse_choice_questions(text: str, answers: dict[int, str], number_min: int, number_max: int, fallback_prompt: str = ''):
    line_starts = question_line_starts(text)
    questions = []
    seen = set()
    for index, match in enumerate(line_starts):
        number = question_marker_number(match)
        if not number_min <= number <= number_max or number in seen:
            continue
        end = line_starts[index + 1].start() if index + 1 < len(line_starts) else len(text)
        block = clean(text[match.end():end])
        block = re.sub(r'(?m)^(\s*)A\s+(?=[A-Z])', r'\1A. ', block)
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
            value = re.split(r'\s*(?:【答案】|【解析】|【分析】|【点评】|答案\s*[:：]|考点\s*[:：]|解析\s*[:：]|Section\s+[A-D]\s+Directions\s*:)', value, maxsplit=1, flags=re.I)[0]
            options[key] = compact(value)
        answer = answers.get(number, '')
        if not answer:
            answer_match = re.search(r'(?:【解答】|【答案】|故选)\s*([A-D])\b', block, re.I)
            answer = answer_match.group(1).upper() if answer_match else ''
        if prompt and all(options.get(key) for key in ['A', 'B', 'C', 'D']) and answer and answer in 'ABCD':
            questions.append({
                'number': number,
                'prompt': prompt,
                'options': {key: options[key] for key in ['A', 'B', 'C', 'D']},
                'answer': answer,
                'questionType': 'choice',
            })
            seen.add(number)
    return questions


def parse_unnumbered_choice_questions(text: str, answers: dict[int, str], start_number: int, count: int):
    raw = section(text, [r'(?m)^\s*Section\s+A\b'], [r'(?m)^\s*Section\s+B\b'])
    directions = re.search(r'Directions\s*[:：][\s\S]*?heard[.．]', raw, re.I)
    if directions:
        raw = raw[directions.end():]
    positions = option_positions(raw)
    if len(positions) < count * 4:
        return []
    questions = []
    for offset in range(count):
        group = positions[offset * 4:(offset + 1) * 4]
        if [item.group(1).upper() for item in group] != list('ABCD'):
            return []
        options = {}
        for index, item in enumerate(group):
            global_index = offset * 4 + index
            end = positions[global_index + 1].start() if global_index + 1 < len(positions) else len(raw)
            options[item.group(1).upper()] = compact(raw[item.end():end])
        number = start_number + offset
        answer = answers.get(number, '')
        if answer not in 'ABCD' or not all(options.get(key) for key in 'ABCD'):
            return []
        questions.append({
            'number': number,
            'prompt': 'Listen and choose the best answer.',
            'options': options,
            'answer': answer,
            'questionType': 'choice',
        })
    return questions


def clean_passage(section_text: str) -> str:
    value = clean(section_text)
    value = re.sub(
        r'(?is)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\.?\s*)?Reading Comprehension\s+Section\s+[A-D]\s*',
        '',
        value,
        count=1,
    )
    value = re.sub(r'(?is)^\s*Section\s+[A-C]\s*Directions\s*:.*?(?:context|read|need|words)[.．]\s*', '', value, count=1)
    value = re.sub(r'(?is)^\s*Directions\s*[:：].*?(?:context|read|need)[.．]\s*', '', value, count=1)
    value = re.sub(r'(?m)^\s*(?:Directions|Section\s+[A-C]).*$', '', value, flags=re.I)
    value = re.sub(r'^\s*\d{1,3}\s*[.．、]\s*[（(]\s*\d+\s*分\s*[）)]\s*', '', value, count=1)
    question_markers = question_line_starts(value)
    first_question = next((
        marker for index, marker in enumerate(question_markers)
        if set(item.group(1).upper() for item in option_positions(
            value[marker.end():question_markers[index + 1].start() if index + 1 < len(question_markers) else len(value)]
        )) >= set('ABCD')
    ), None)
    if first_question:
        value = value[:first_question.start()]
    value = re.sub(r'\n{3,}', '\n\n', value)
    return compact(value)


def reading_sections(text: str):
    reading = section(
        text,
        [r'(?:III|II|IV|\u2162|\u2163)\.?\s*Reading Comprehension', r'Reading Comprehension'],
        [r'(?:(?:IV|\u2163)\.?\s*)?Summary Writing', r'(?:II|IV|V|\u2161|\u2163|\u2164)\.?\s*Translation', r'Guided Writing', r'Writing\s*\('],
    )
    if not reading:
        return {}
    markers = list(re.finditer(r'(?m)^\s*Section\s+([A-D])\b', reading, re.I))
    if not markers:
        return {'reading': reading}
    result = {}
    first_marker = markers[0]
    leading = reading[:first_marker.start()]
    leading_numbers = {question_marker_number(marker) for marker in question_line_starts(leading)}
    if re.search(r'Reading Comprehension\s+Section\s+A\b', leading, re.I) or set(range(41, 56)).issubset(leading_numbers):
        result['A'] = clean(leading)
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(reading)
        result[marker.group(1).upper()] = clean(reading[marker.start():end])
    return result


def build_matching_reading(session: str, year: int, section_id: str, raw: str, full_text: str, source_file: str, answers: dict[int, str]):
    answer_marker = re.search(r'参\s*考\s*答\s*案|上海英语英语参考|上海英语参考答案', full_text)
    answer_tail = full_text[answer_marker.end():] if answer_marker else ''
    heading_rows = re.findall(r'(?m)^\s*([A-F])(?:\s*[.\uff0e、]\s*|\s+)([^\n]{5,160})$', raw)
    if len({key for key, _ in heading_rows}) != 6:
        heading_rows = re.findall(r'(?m)^\s*([A-F])(?:\s*[.\uff0e、]\s*|\s+)([^\n]{5,160})$', answer_tail)
    headings = {key: compact(value) for key, value in heading_rows}
    paragraph_markers = list(re.finditer(r'(?m)^\s*(\d{2,3})\s*[.\uff0e、]\s*(.*)$', raw))
    paragraphs = []
    for index, marker in enumerate(paragraph_markers):
        end = paragraph_markers[index + 1].start() if index + 1 < len(paragraph_markers) else len(raw)
        value = clean('\n'.join(value for value in (marker.group(2), raw[marker.end():end]) if value))
        value = re.split(r'(?m)^\s*\d{2,3}\s*[.\uff0e、]\s*[A-F]\s*\.?\s*$', value, maxsplit=1)[0]
        value = re.sub(r'SHAPE\s+\\\*\s+MERGEFORMAT', '', value, flags=re.I)
        value = compact(value)
        if value:
            paragraphs.append((int(marker.group(1)), value))
    valid = bool(
        set(headings) == set('ABCDEF')
        and len(paragraphs) == 5
        and [number for number, _ in paragraphs] == list(range(paragraphs[0][0], paragraphs[0][0] + 5))
        and all(answers.get(number) in headings for number, _ in paragraphs)
    )
    report = {
        'section': section_id,
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
        '_id': f'{prefix}-{year}-reading-{section_id.lower()}',
        'title': f'{year} 上海高考{label} · Reading Comprehension Section {section_id}',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': f'{section_id}-Matching',
        'sectionLabel': f'Reading Section {section_id}',
        'paperId': f'{prefix}-{year}',
        'paperTitle': f'{year} 上海高考{label}英语真题',
        'paperOrder': 50 if section_id == 'C' else 60,
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


def parse_open_questions(raw: str, answers: dict[int, str]):
    question_raw = re.split(r'【解析】|【答案】', raw, maxsplit=1)[0]
    markers = list(re.finditer(r'(?m)^\s*(\d{2,3})\s*[.\uff0e、]\s*', question_raw))
    questions = []
    for index, marker in enumerate(markers):
        number = int(marker.group(1))
        if number not in answers:
            continue
        end = markers[index + 1].start() if index + 1 < len(markers) else len(question_raw)
        prompt = compact(question_raw[marker.end():end])
        prompt = re.split(r'\s*(?:【解析】|【答案】|参考答案)', prompt, maxsplit=1)[0]
        if prompt:
            questions.append({
                'number': number,
                'prompt': prompt,
                'answer': answers[number],
                'questionType': 'blank',
            })
    return questions


def build_vocabulary_cloze_item(session: str, year: int, text: str, source_file: str, answers: dict[int, str]):
    grammar = section(
        text,
        [r'Grammar and Vocabulary'],
        [r'Reading Comprehension'],
    )
    marker = re.search(r'(?m)^\s*Section\s+B\b', grammar, re.I)
    raw = grammar[marker.end():] if marker else ''
    option_matches = list(re.finditer(r'(?<![A-Za-z])([A-K])(?:\s*[.\uff0e、]\s*|\s+)([A-Za-z][A-Za-z-]*)', raw))
    options = {}
    corrections = []
    last_option = None
    expected_option_count = 10 if session == 'autumn' and year in {2011, 2012} else 11
    for match in option_matches:
        key = match.group(1).upper()
        value = compact(match.group(2))
        if key in options and key == 'E' and 'F' not in options:
            corrections.append({'source': f'{key} {value}', 'normalized': f'F. {value}'})
            key = 'F'
        options.setdefault(key, value)
        last_option = match
        if len(options) == expected_option_count:
            break
    passage = clean(raw[last_option.end():]) if last_option else ''
    passage = re.sub(r'^(?:Directions\s*:)?\s*Complete the following passage[\s\S]*?you need\.?', '', passage, count=1, flags=re.I)
    passage = re.sub(r'^\s*§\s*', '', passage)
    passage = re.sub(r'\s+[IVX]+\.?\s*$', '', passage)
    passage = compact(passage)
    blank_matches = re.finditer(r'(?:(?:_|\uff3f)+\s*(\d{1,3})\s*(?:_|\uff3f)+|[（(]\s*(\d{1,3})\s*[）)]|(?<!\d)(\d{1,3})\s*[.])', passage)
    numbers = sorted({int(match.group(1) or match.group(2) or match.group(3)) for match in blank_matches if 31 <= int(match.group(1) or match.group(2) or match.group(3)) <= 60})
    modern_numbers = [number for number in range(31, 41) if re.search(rf'(?<!\d){number}(?!\d)', passage)]
    if modern_numbers == list(range(31, 41)):
        numbers = modern_numbers
    legacy_numbers = [number for number in range(41, 50) if re.search(rf'(?<!\d){number}(?!\d)', passage)]
    if session == 'autumn' and year in {2011, 2012} and legacy_numbers == list(range(41, 50)):
        numbers = legacy_numbers
    legacy_ten_numbers = [number for number in range(41, 51) if re.search(rf'(?<!\d){number}(?!\d)', passage)]
    if legacy_ten_numbers == list(range(41, 51)):
        numbers = legacy_ten_numbers
    for number in numbers:
        passage = re.sub(rf'(?<!\d){number}\s*[.]', f'({number}) ________', passage)
        passage = re.sub(rf'[（(]\s*{number}\s*[）)]\s*(?:[_\uff3f]+\s*)?', f'_____{number}_____', passage, count=1)
        passage = re.sub(rf'(?<![\d(]){number}(?![\d)])', f'({number}) ________', passage, count=1)
    expected_option_keys = [chr(ord('A') + index) for index in range(len(numbers) + 1)]
    valid = bool(
        numbers
        and list(options) == expected_option_keys
        and len(passage) >= 400
        and all(answers.get(number) in options for number in numbers)
        and all(re.search(rf'(?:(?:_|\uff3f)+\s*{number}\s*(?:_|\uff3f)+|[（(]\s*{number}\s*[）)]|(?<!\d){number}\s*[.])', passage) for number in numbers)
    )
    report = {'section': 'Grammar-Vocabulary-B', 'passageChars': len(passage), 'questions': len(numbers) if valid else 0, 'accepted': valid, 'sourceCorrections': corrections}
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


def extract_grammar_cloze_answers(text: str, expected_numbers: list[int]):
    candidates = []
    for marker in re.finditer(r'【\s*答\s*案\s*】', text):
        tail = text[marker.end():]
        end_match = re.search(r'【', tail)
        block = tail[:end_match.start()] if end_match else tail[:2000]
        dot_markers = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.．、]\s*', block))
        dot_parsed = {}
        for index, item in enumerate(dot_markers):
            end = dot_markers[index + 1].start() if index + 1 < len(dot_markers) else len(block)
            value = compact(block[item.end():end])
            if value and len(value) <= 80:
                dot_parsed[int(item.group(1))] = value
        if dot_parsed:
            candidates.append(dot_parsed)
        markers = list(re.finditer(r'[（(]\s*(\d{1,3})\s*[）)]', block))
        parsed = {}
        for index, item in enumerate(markers):
            end = markers[index + 1].start() if index + 1 < len(markers) else len(block)
            value = compact(block[item.end():end])
            value = re.split(r'【|答案解析|Section\s+B', value, maxsplit=1, flags=re.I)[0]
            if value and len(value) <= 80:
                parsed[int(item.group(1))] = value
        candidates.append(parsed)
    for start in re.finditer(r'(?m)^\s*(\d{1,3})\s*[.\uff0e、]\s*', text):
        if not expected_numbers or int(start.group(1)) != expected_numbers[0]:
            continue
        tail = text[start.start():]
        end_match = re.search(r'(?m)^\s*(?:III|\u2162)\.?\s*Reading Comprehension', tail, re.I)
        block = tail[:end_match.start()] if end_match else tail[:2000]
        markers = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]\s*', block))
        parsed = {}
        for index, item in enumerate(markers):
            end = markers[index + 1].start() if index + 1 < len(markers) else len(block)
            value = compact(block[item.end():end])
            if value and len(value) <= 80:
                parsed[int(item.group(1))] = value
        candidates.append(parsed)
    explained = {}
    parenthetical_markers = list(re.finditer(r'[（(]\s*(\d{1,3})\s*[）)]', text))
    parenthetical_answers = {}
    for index, marker in enumerate(parenthetical_markers):
        number = int(marker.group(1))
        if number not in expected_numbers:
            continue
        end = parenthetical_markers[index + 1].start() if index + 1 < len(parenthetical_markers) else len(text)
        block = text[marker.end():end]
        answer_match = re.search(
            r'故\s*填\s*[:：]?\s*([A-Za-z]+(?:\s+[A-Za-z]+){0,3}(?:\s*/\s*[A-Za-z]+(?:\s+[A-Za-z]+){0,3})*)',
            block,
            re.I,
        )
        if answer_match:
            parenthetical_answers[number] = compact(answer_match.group(1))
    if parenthetical_answers:
        candidates.append(parenthetical_answers)
    for number in expected_numbers:
        match = re.search(
            rf'(?m)^\s*(?:【\s*解\s*答\s*】\s*)?{number}\s*[.\uff0e、]\s*([A-Za-z]+(?:\s+[A-Za-z]+){{0,3}}(?:\s*/\s*[A-Za-z]+(?:\s+[A-Za-z]+){{0,3}})*)\s*[.．。]?\s*(?=【|[\u3400-\u9fff])',
            text,
        )
        if match:
            explained[number] = compact(match.group(1))
    if explained:
        candidates.append(explained)
    if not candidates:
        return {}
    best = max(candidates, key=lambda item: sum(number in item for number in expected_numbers))
    return {number: best[number] for number in expected_numbers if number in best}


def build_grammar_cloze_reading_item(session: str, year: int, text: str, answer_text: str, source_file: str):
    grammar = section(text, [r'Grammar and Vocabulary'], [r'Reading Comprehension'])
    section_b = re.search(r'(?m)^\s*Section\s+B\b', grammar, re.I)
    raw = grammar[:section_b.start()] if section_b else grammar
    raw = re.sub(r'(?is)^\s*(?:(?:II|\u2161)\.?\s*)?Grammar and Vocabulary\s*', '', raw, count=1)
    raw = re.sub(r'(?is)^\s*Section\s+A\s*', '', raw, count=1)
    if re.search(r'Beneath each[^.]{0,180}four choices', raw, re.I | re.S):
        return None, {'section': 'Grammar-Vocabulary-A', 'passageChars': 0, 'questions': 0, 'accepted': False, 'reason': 'choice-grammar-not-cloze'}
    first_task = re.search(r'(?m)^\s*\d{1,3}\s*[.．、]\s*[（(]\s*\d+\s*分\s*[）)]', raw)
    if first_task:
        raw = raw[first_task.start():]
    raw = re.sub(r'(?m)^\s*\d{1,3}\s*[.\uff0e、]\s*[（(]\s*\d+\s*分\s*[）)]\s*$', '', raw)
    local_numbers = sorted({
        int(match.group(1))
        for match in re.finditer(r'[（(]\s*(\d{1,3})\s*[）)](?=\s|[_\uff3f])', raw)
    })
    numbered_blanks = sorted({
        int(match.group(1))
        for match in re.finditer(r'(?m)(?<!\d)(\d{1,3})\s*[.．](?=\s|$)', raw)
        if 21 <= int(match.group(1)) <= 40
    })
    if numbered_blanks:
        local_numbers = numbered_blanks
    modern_numbers = [number for number in range(21, 41) if re.search(rf'(?<!\d){number}(?!\d)', raw)]
    if modern_numbers[:10] == list(range(21, 31)):
        local_numbers = list(range(21, 31))
    if local_numbers == list(range(1, 11)):
        expected_numbers = local_numbers
    else:
        expected_numbers = [number for number in local_numbers if 21 <= number <= 40]
    answers = extract_grammar_cloze_answers(answer_text, expected_numbers) if expected_numbers else {}
    passage = clean(raw)
    for number in expected_numbers:
        passage = re.sub(
            rf'[（(]\s*{number}\s*[）)](?:\s*[_\uff3f]+)*\s*',
            f'_____{number}_____',
            passage,
            count=1,
        )
        passage = re.sub(rf'(?<!\d){number}\s*[.．](?!\d)', f'_____{number}_____', passage, count=1)
        if f'_____{number}_____' not in passage:
            passage = re.sub(rf'(?<!\d){number}(?!\d)', f'_____{number}_____', passage, count=1)
    passage = compact(passage)
    valid = bool(
        len(passage) >= 500
        and len(expected_numbers) in {10, 16}
        and all(number in answers for number in expected_numbers)
        and all(f'_____{number}_____' in passage for number in expected_numbers)
    )
    report = {'section': 'Grammar-Vocabulary-A', 'passageChars': len(passage), 'questions': len(expected_numbers) if valid else 0, 'accepted': valid}
    if not valid:
        return None, report
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    questions = []
    for number in expected_numbers:
        accepted_answers = [compact(value) for value in re.split(r'\s*/\s*', answers[number]) if compact(value)]
        questions.append({
            'number': number,
            'prompt': f'Blank {number}',
            'answer': accepted_answers[0],
            'acceptedAnswers': accepted_answers,
            'questionType': 'blank',
        })
    return {
        '_id': f'{prefix}-{year}-grammar-vocabulary-a',
        'title': f'{year} 上海高考{label} · Grammar and Vocabulary Section A',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'Grammar-Vocabulary-A',
        'sectionLabel': 'Grammar and Vocabulary Section A',
        'paperId': f'{prefix}-{year}',
        'paperTitle': f'{year} 上海高考{label}英语真题',
        'paperOrder': 10,
        'contentRevision': 2,
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


def build_sentence_matching_reading(session: str, year: int, raw: str, source_file: str, answers: dict[int, str]):
    option_markers = list(re.finditer(r'(?m)^\s*([A-F])\s*[.\uff0e、]\s*', raw))
    options = {}
    passage_start = 0
    sequential_markers = option_markers[:6]
    options_at_end = bool(
        len(sequential_markers) == 6
        and [marker.group(1).upper() for marker in sequential_markers] == list('ABCDEF')
        and re.search(r'(?<!\d)67(?!\d)', raw[:sequential_markers[0].start()])
    )
    for index, marker in enumerate(sequential_markers):
        if marker.group(1).upper() != chr(ord('A') + index):
            break
        if index + 1 < len(option_markers):
            end = option_markers[index + 1].start()
        else:
            sentence_end = re.search(r'[.!?．。！？]["\u201d\u2019\']?\s*(?:\n|$)', raw[marker.end():])
            end = marker.end() + (sentence_end.end() if sentence_end else len(raw[marker.end():]))
            passage_start = end
        options[marker.group(1).upper()] = compact(raw[marker.end():end])
    passage = compact(raw[:sequential_markers[0].start()]) if options_at_end else (compact(raw[passage_start:]) if passage_start else '')
    numbers = sorted({
        int(value)
        for value in [
            *re.findall(r'(?:_|\uff3f)+(\d{1,3})(?:_|\uff3f)+', passage),
            *re.findall(r'[（(]\s*(\d{1,3})\s*[）)]', passage),
            *re.findall(r'(?<!\d)(\d{2,3})\s*[.]', passage),
            *re.findall(r'(?<!\d)(\d{2,3})(?=\s+[A-Z“"\'])', passage),
        ]
        if 67 <= int(value) <= 70
    })
    for number in numbers:
        passage = re.sub(rf'(?:_|\uff3f)+{number}(?:_|\uff3f)+', f'({number}) ________', passage, count=1)
        passage = re.sub(rf'[（(]\s*{number}\s*[）)]\s*(?:[_\uff3f]+\s*)?', f'({number}) ________ ', passage, count=1)
        passage = re.sub(rf'(?<!\d){number}\s*[.]', f'({number}) ________', passage, count=1)
        passage = re.sub(rf'(?<!\d){number}(?=\s+[A-Z“"\'])', f'({number}) ________', passage, count=1)
    valid = bool(
        list(options) == list('ABCDEF')
        and len(passage) >= 500
        and len(numbers) == 4
        and numbers == list(range(numbers[0], numbers[0] + 4))
        and all(answers.get(number) in options for number in numbers)
    )
    report = {'section': 'C-Matching', 'passageChars': len(passage), 'questions': len(numbers) if valid else 0, 'accepted': valid}
    if not valid:
        return None, report
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
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
        'contentRevision': 1,
        'difficultyLevel': 4,
        'difficultyLabel': '高考真题',
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_file,
        'passage': passage,
        'questions': [{
            'number': number,
            'prompt': f'Blank {number}',
            'options': options,
            'answer': answers[number],
            'questionType': 'choice',
        } for number in numbers],
        'answerSentences': [],
        'phrases': [],
        'vocabulary': [],
    }, report


def question_block_end(raw: str, question_number: int, limit: int) -> int:
    markers = [match for match in question_line_starts(raw[:limit]) if question_marker_number(match) == question_number]
    if not markers:
        return limit
    marker = markers[-1]
    segment = raw[marker.start():limit]
    option_d = [match for match in option_positions(segment) if match.group(1).upper() == 'D']
    if not option_d:
        return limit
    after_d = segment[option_d[-1].end():]
    line_end = re.search(r'\n', after_d)
    return marker.start() + option_d[-1].end() + (line_end.start() if line_end else len(after_d))


def split_unlabelled_modern_reading_b(raw: str):
    group_ranges = [('BA', 56, 59), ('BB', 60, 62), ('BC', 63, 66)]
    positions = {question_marker_number(match): match.start() for match in question_line_starts(raw)}
    if not all(start in positions and end in positions for _, start, end in group_ranges):
        return []
    blocks = []
    block_start = 0
    for index, (block_id, start_number, end_number) in enumerate(group_ranges):
        next_question = group_ranges[index + 1][1] if index + 1 < len(group_ranges) else None
        limit = positions[next_question] if next_question else len(raw)
        block_end = question_block_end(raw, end_number, limit)
        blocks.append((block_id, raw[block_start:block_end]))
        block_start = block_end
    return blocks


def build_reading_items(session: str, year: int, text: str, source_file: str, answers: dict[int, str], text_answers: dict[int, str]):
    items = []
    report = []
    for section_id, raw in reading_sections(text).items():
        if section_id == 'C' and re.search(r'(?:(?:_|\uff3f)+(?:67|68|69|70)(?:_|\uff3f)+|[（(]\s*(?:67|68|69|70)\s*[）)]|(?<!\d)(?:67|68|69|70)(?:\s*[.]|(?=\s+[A-Z“"\'])))', raw):
            item, item_report = build_sentence_matching_reading(session, year, raw, source_file, answers)
            report.append(item_report)
            if item:
                items.append(item)
            continue
        has_matching_headings = len(set(re.findall(r'(?m)^\s*([A-F])(?:\s*[.\uff0e、]\s*|\s+)[^\n]+$', raw))) == 6
        if has_matching_headings:
            item, item_report = build_matching_reading(session, year, section_id, raw, text, source_file, answers)
            report.append(item_report)
            if item:
                items.append(item)
            continue
        if section_id in {'C', 'D'}:
            questions = parse_open_questions(raw, text_answers)
            first_open_question = next((
                marker for marker in question_line_starts(raw)
                if question_marker_number(marker) in text_answers
            ), None)
            passage = clean_passage(raw[:first_open_question.start()] if first_open_question else raw)
            numbers = [question['number'] for question in questions]
            valid = bool(
                len(passage) >= 500
                and numbers
                and numbers == list(range(numbers[0], numbers[-1] + 1))
            )
            report.append({'section': section_id, 'passageChars': len(passage), 'questions': len(questions), 'accepted': valid})
            if valid:
                prefix = SESSIONS[session]['prefix']
                label = SESSIONS[session]['label']
                items.append({
                    '_id': f'{prefix}-{year}-reading-{section_id.lower()}',
                    'title': f'{year} 上海高考{label} · Reading Comprehension Section {section_id}',
                    'year': year,
                    'city': '上海',
                    'district': label,
                    'examType': label,
                    'stage': '高中',
                    'section': section_id,
                    'sectionLabel': f'Reading Section {section_id}',
                    'paperId': f'{prefix}-{year}',
                    'paperTitle': f'{year} 上海高考{label}英语真题',
                    'paperOrder': 50 if section_id == 'C' else 60,
                    'contentRevision': 1,
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
            continue
        blocks = [(section_id, raw)]
        if section_id == 'B':
            markers = list(re.finditer(r'(?m)^\s*[（(]([A-D])[）)]\s*[.．、]?\s*(.*)$', raw, re.I))
            blocks = []
            for index, marker in enumerate(markers):
                end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
                block = '\n'.join(value for value in (marker.group(2), raw[marker.end():end]) if value)
                blocks.append((f'B{marker.group(1).upper()}', block))
            if not blocks:
                blocks = split_unlabelled_modern_reading_b(raw)
        for block_id, block in blocks:
            questions = parse_choice_questions(block, answers, 31, 90, 'Blank {number}')
            if session == 'spring' and year == 2017 and block_id == 'BA' and not any(question['number'] == 57 for question in questions):
                marker = re.search(r'(?m)^\s*57\s*[.．、]\s*', block)
                option_a = re.search(r'(?m)^\s*A(?:\s+B)?\s*[.．、]?\s*$', block[marker.end():] if marker else '')
                prompt = compact(block[marker.end():marker.end() + option_a.start()]) if marker and option_a else ''
                if prompt and answers.get(57) in 'ABCD':
                    questions.append({
                        'number': 57,
                        'prompt': prompt,
                        'options': {},
                        'optionImages': {},
                        'answer': answers[57],
                        'questionType': 'choice',
                    })
                    questions.sort(key=lambda question: question['number'])
            passage = clean_passage(block)
            numbers = sorted(question['number'] for question in questions)
            if block_id == 'A':
                for number in numbers:
                    passage = re.sub(rf'(?<!\d){number}\s*[.]', f'({number}) ________', passage)
                    passage = re.sub(rf'[（(]\s*{number}\s*[）)]\s*(?:[_\uff3f]+\s*)?', f'_____{number}_____', passage, count=1)
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
                'paperOrder': 30 if block_id == 'A' else 40 + ord(block_id[1]) - ord('A'),
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


def extract_document_images(source_path: Path) -> list[tuple[str, bytes]]:
    archive_path = source_path
    temp_dir = None
    try:
        if source_path.suffix.lower() == '.doc':
            temp_dir = tempfile.TemporaryDirectory(prefix='senior-writing-')
            subprocess.run([
                'soffice', f'-env:UserInstallation=file://{temp_dir.name}/profile', '--headless',
                '--convert-to', 'docx', '--outdir', temp_dir.name, str(source_path),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=120)
            converted = sorted(Path(temp_dir.name).glob('*.docx'))
            if not converted:
                return []
            archive_path = converted[0]
        if archive_path.suffix.lower() != '.docx':
            return []
        with zipfile.ZipFile(archive_path) as archive:
            names = sorted(name for name in archive.namelist() if name.startswith('word/media/'))
            return [(Path(name).name, archive.read(name)) for name in names]
    except (OSError, subprocess.SubprocessError, zipfile.BadZipFile):
        return []
    finally:
        if temp_dir:
            temp_dir.cleanup()


def extract_document_section_images(source_path: Path, start_pattern: str, end_pattern: str) -> list[tuple[str, bytes]]:
    archive_path = source_path
    temp_dir = None
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
    }
    try:
        if source_path.suffix.lower() == '.doc':
            temp_dir = tempfile.TemporaryDirectory(prefix='senior-section-images-')
            subprocess.run([
                'soffice', f'-env:UserInstallation=file://{temp_dir.name}/profile', '--headless',
                '--convert-to', 'docx', '--outdir', temp_dir.name, str(source_path),
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=120)
            converted = sorted(Path(temp_dir.name).glob('*.docx'))
            if not converted:
                return []
            archive_path = converted[0]
        if archive_path.suffix.lower() != '.docx':
            return []
        with zipfile.ZipFile(archive_path) as archive:
            document = ET.fromstring(archive.read('word/document.xml'))
            relationships = ET.fromstring(archive.read('word/_rels/document.xml.rels'))
            targets = {
                relation.attrib.get('Id'): relation.attrib.get('Target', '')
                for relation in relationships.findall('pr:Relationship', namespaces)
            }
            active = False
            result = []
            for node in document.find('w:body', namespaces):
                node_text = compact(''.join(item.text or '' for item in node.findall('.//w:t', namespaces)))
                if not active and re.search(start_pattern, node_text, re.I):
                    active = True
                elif active and re.search(end_pattern, node_text, re.I):
                    break
                if not active:
                    continue
                for blip in node.findall('.//a:blip', namespaces):
                    relation_id = blip.attrib.get(f'{{{namespaces["r"]}}}embed')
                    target = targets.get(relation_id, '')
                    archive_name = f'word/{target}'.replace('word/../', '')
                    if archive_name in archive.namelist():
                        result.append((Path(archive_name).name, archive.read(archive_name)))
            return result
    except (OSError, subprocess.SubprocessError, zipfile.BadZipFile, KeyError, ET.ParseError, TypeError):
        return []
    finally:
        if temp_dir:
            temp_dir.cleanup()


def prepare_writing_images(source_path: Path, session: str, year: int) -> list[dict]:
    assets = extract_document_section_images(source_path, r'Guided Writing', r'【答案】|参考范文|Sample Writing')
    if not assets and not (session == 'autumn' and year == 2011):
        all_assets = extract_document_images(source_path)
        assets = all_assets if len(all_assets) == 1 else []
    if not assets:
        return []
    module = f'writing-senior-{session}'
    output_dir = ROOT / 'data' / module / 'images'
    output_dir.mkdir(parents=True, exist_ok=True)
    result = []
    for index, (name, body) in enumerate(assets, start=1):
        suffix = Path(name).suffix.lower()
        if suffix not in {'.jpg', '.jpeg', '.png', '.webp'} or len(body) < 1024:
            continue
        digest = hashlib.sha1(body).hexdigest()[:10]
        filename = f'{SESSIONS[session]["prefix"]}-{year}-writing-{index}-{digest}{suffix}'
        local_path = output_dir / filename
        if not local_path.exists():
            local_path.write_bytes(body)
        result.append({
            'cloudPath': f'_content/{module}/years/{year}/assets/{filename}',
            'localPath': str(local_path.relative_to(ROOT)),
            'alt': f'{year} 上海高考{SESSIONS[session]["label"]}作文题原图',
        })
    return result


def prepare_reading_images(source_path: Path, session: str, year: int) -> list[dict]:
    assets = extract_document_section_images(source_path, r'Reading Comprehension', r'Translation|Guided Writing')
    module = f'reading-senior-{session}'
    output_dir = ROOT / 'data' / module / 'images'
    output_dir.mkdir(parents=True, exist_ok=True)
    result = []
    for index, (name, body) in enumerate(assets, start=1):
        suffix = Path(name).suffix.lower()
        if suffix not in {'.jpg', '.jpeg', '.png', '.webp'} or len(body) < 1024:
            continue
        digest = hashlib.sha1(body).hexdigest()[:10]
        filename = f'{SESSIONS[session]["prefix"]}-{year}-reading-{index}-{digest}{suffix}'
        local_path = output_dir / filename
        if not local_path.exists():
            local_path.write_bytes(body)
        result.append({
            'cloudPath': f'_content/{module}/years/{year}/assets/{filename}',
            'localPath': str(local_path.relative_to(ROOT)),
            'alt': f'{year} 上海高考{SESSIONS[session]["label"]}阅读原图',
        })
    return result


def extract_writing_prompt_table(source_path: Path):
    if source_path.suffix.lower() != '.docx':
        return None
    try:
        with zipfile.ZipFile(source_path) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
    except (OSError, zipfile.BadZipFile, KeyError, ET.ParseError):
        return None
    namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    for table in root.findall('.//w:tbl', namespace):
        rows = []
        for table_row in table.findall('./w:tr', namespace):
            cells = [
                compact(''.join(node.text or '' for node in cell.findall('.//w:t', namespace)))
                for cell in table_row.findall('./w:tc', namespace)
            ]
            if cells:
                rows.append(cells)
        if len(rows) == 4 and all(len(row) == 3 for row in rows) and [row[0] for row in rows] == ['课程名称', '课程内容', '授课安排', '授课语言']:
            return {
                'headers': rows[0],
                'rows': [{'label': row[0], 'values': row[1:]} for row in rows[1:]],
            }
        if len(rows) >= 2 and all(len(row) == 2 for row in rows) and [row[0] for row in rows] == ['主题', '时间', '路线']:
            return {
                'headers': ['项目', '方案'],
                'rows': [{'label': row[0], 'values': [row[1]]} for row in rows],
            }
    return None


def build_writing_item(session: str, year: int, text: str, source_path: Path):
    raw = section(
        text,
        [r'Guided Writing', r'(?:II|III|IV|V|\u2161|\u2162|\u2163|\u2164)\.?\s*Writing\b', r'作文'],
        [r'【答案】', r'【解析】', r'参\s*考\s*答\s*案', r'上海英语英语参考', r'上海英语参考答案', r'答案要点及评分标准', r'参考范文', r'Sample Writing', r'(?m)^\s*To whom it may concern\s*[:：]', r'Listening (?:Comprehension|Script)', r'听力(?:原文|文本|文字)'],
    )
    prompt_table = extract_writing_prompt_table(source_path)
    prompt = compact(raw)
    prompt = re.sub(r'(?:_|\uff3f){5,}', ' ', prompt)
    prompt = re.sub(r'第\s*\d+\s*页\s*共\s*\d+\s*页', ' ', prompt)
    prompt = compact(prompt)
    if prompt_table:
        table_markers = [prompt_table['headers'][0], prompt_table['rows'][0]['label']]
        for table_marker in table_markers:
            if table_marker and table_marker in prompt:
                prompt = compact(prompt.split(table_marker, 1)[0])
                break
    prompt = re.sub(r'^(?:[IVX\u2160-\u2169]+\.?\s*)?(?:Guided\s+)?Writing\s*[:\uff1a]?', '', prompt, flags=re.I)
    question_number_match = re.match(r'\s*(\d{1,3})\s*[.\uff0e、]\s*', prompt)
    question_number = int(question_number_match.group(1)) if question_number_match else 0
    if question_number_match:
        prompt = compact(prompt[question_number_match.end():])
    prompt = re.sub(r'^作文部分\s*', '', prompt)
    prompt = re.split(r'\s*(?:【答案】|【解析】|【分析】|【点评】|参\s*考\s*答\s*案|上海英语英语参考|上海英语参考答案|参考范文|Sample Writing|To whom it may concern\s*[:：]|绝密★启用前|英语试卷\s*答案)', prompt, maxsplit=1, flags=re.I)[0]
    prompt = re.split(r'\s*(?:○{2,}|二○一○年全国普通高等学校招生统一考试|上海英语卷\s+答案要点)', prompt, maxsplit=1)[0]
    prompt = re.sub(r'(\d)\s*-\s*-\s*(\d)', r'\1 - \2', prompt)
    prompt = re.sub(r'(\d{2,3})\s*-\s*[lI]\s*(\d{2})', r'\1 - 1\2', prompt)
    valid = 40 <= len(prompt) <= 1800 and bool(re.search(r'write|writing|essay|letter|words|Dear\s+[A-Za-z]+\s*[:：]|写|作文|短文|邮件|回复', prompt, re.I))
    if not valid:
        return None, {'promptChars': len(prompt), 'accepted': False}
    min_words_match = re.search(r'(\d{2,3})\s*(?:(?:-\s*){1,2}|~|至|to)\s*(\d{2,3})\s*words', prompt, re.I)
    min_words = int(min_words_match.group(1)) if min_words_match else 0
    directions_match = re.match(r'(Directions\s*[:：]\s*.*?(?:Chinese\.|Chinese。))\s*', prompt, re.I)
    directions = compact(directions_match.group(1)) if directions_match else ''
    body = compact(prompt[directions_match.end():]) if directions_match else prompt
    body_number_match = re.match(r'\s*(\d{1,3})\s*[.\uff0e、]\s*', body)
    if body_number_match:
        question_number = int(body_number_match.group(1))
        body = compact(body[body_number_match.end():])
    if not question_number and year >= 2017:
        question_number = 76
    score_match = re.match(r'\s*[（(]\s*(\d+)\s*分\s*[）)]\s*', body)
    score = int(score_match.group(1)) if score_match else 0
    if score_match:
        body = compact(body[score_match.end():])
    requirement_marker = re.search(
        r'(?:你的作文|内容)必须包括\s*[:：]|内容包括\s*[:：]|你的信必须满足以下要求\s*[:：]|邮件须包括以下内容\s*[:：]|在[^：]{0,40}中[，,]?\s*你必须\s*[:：]',
        body,
    )
    numbered_source = body[requirement_marker.end():] if requirement_marker else body
    numbered_markers = list(re.finditer(r'(?:[（(]\d+[）)]|(?:^|\s)\d+[）).．,、])\s*', numbered_source))
    scenario_end = requirement_marker.start() if requirement_marker else (numbered_markers[0].start() if numbered_markers else len(body))
    scenario = compact(body[:scenario_end])
    requirement_raw = body[requirement_marker.end():] if requirement_marker else ''
    requirements = [compact(value) for value in re.split(r'[●•▪◦]', requirement_raw) if compact(value)]
    if numbered_markers:
        requirements = []
        for index, marker in enumerate(numbered_markers):
            end = numbered_markers[index + 1].start() if index + 1 < len(numbered_markers) else len(numbered_source)
            requirements.append(compact(numbered_source[marker.end():end]))
    source_requirement_lines = []
    for marker in re.finditer(r'(?m)^\s*(?:[（(]\d+[）)]|\d+[.．、]?)\s+([^\n]+)', raw):
        value = compact(re.sub(r'(?:_|\uff3f){5,}', ' ', marker.group(1)))
        if re.search(r'[\u3400-\u9fff]', value):
            source_requirement_lines.append(value)
    if source_requirement_lines:
        requirements = source_requirement_lines
    implicit_requirements = {
        ('spring', 2019): ['表明你是否愿意共享自己的衣服', '说明理由'],
        ('spring', 2020): ['就超市处理临近保质期食物的办法提出看法'],
    }
    if not requirements:
        requirements = implicit_requirements.get((session, year), [])
    starter_match = re.search(r'\bDear\s+[A-Za-z]+\s*[:：]', body, re.I)
    prompt_starter = compact(starter_match.group(0)) if starter_match else ''
    if prompt_starter:
        requirements = [compact(value.replace(prompt_starter, '')) for value in requirements]
        requirements = [value for value in requirements if value]
    requires_image = bool(re.search(r'下图|如图|图表|以下启事|(?:以下|下列)?\s*[三3]\s*幅图片', scenario))
    images = prepare_writing_images(source_path, session, year) if requires_image else []
    if requires_image and not images:
        return None, {'promptChars': len(prompt), 'accepted': False, 'reason': 'required-writing-image-missing'}
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
        'contentType': 'guided-writing',
        'contentRevision': 1,
        'paperId': f'{prefix}-{year}',
        'paperOrder': 2,
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_path.name,
        'questionNumber': question_number,
        'prompt': prompt,
        'directions': directions,
        'scenario': scenario,
        'requirementsTitle': compact(requirement_marker.group(0)) if requirement_marker and requirements else ('写作要求：' if requirements else ''),
        'requirements': requirements,
        'promptTable': prompt_table,
        'promptStarter': prompt_starter,
        'images': images,
        'minWords': min_words,
        'score': 0 if session == 'spring' and year == 2023 else (score or 25),
    }, {'promptChars': len(prompt), 'accepted': True, 'imageCount': len(images), 'requirementCount': len(requirements)}


def build_summary_writing_item(session: str, year: int, text: str, source_path: Path):
    headings = list(re.finditer(r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\.?\s*)?Summary Writing\b', text, re.I))
    if not headings:
        return None, {'accepted': False, 'reason': 'summary-writing-missing'}
    heading = headings[0]
    tail = text[heading.start():]
    end_match = re.search(r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\.?\s*)?Translation\b', tail[heading.end() - heading.start():], re.I)
    end = heading.end() - heading.start() + end_match.start() if end_match else len(tail)
    raw = clean(tail[:end])
    raw = re.sub(r'^\s*(?:(?:[IVX]+|[\u2160-\u2169])\.?\s*)?Summary Writing\s*[:：]?\s*', '', raw, flags=re.I)
    prompt = compact(raw)
    leading_number_match = re.match(r'\s*(\d{1,3})\s*[.\uff0e、]\s*', prompt)
    leading_number = int(leading_number_match.group(1)) if leading_number_match else 0
    if leading_number_match:
        prompt = compact(prompt[leading_number_match.end():])
    prompt = re.sub(r'^\s*[（(]\s*\d+\s*分\s*[）)]\s*', '', prompt)
    directions_match = re.match(r'(Directions\s*[:：]\s*.*?possible[.．])\s*', prompt, re.I)
    directions = compact(directions_match.group(1)) if directions_match else ''
    body = compact(prompt[directions_match.end():]) if directions_match else prompt
    number_match = re.match(r'\s*(\d{1,3})\s*[.\uff0e、]\s*', body)
    number = leading_number or (int(number_match.group(1)) if number_match else (71 if year >= 2017 else 0))
    passage = compact(body[number_match.end():]) if number_match else body
    max_words_match = re.search(r'no more than\s+(\d{1,3})\s+words', directions, re.I)
    max_words = int(max_words_match.group(1)) if max_words_match else 0
    valid = bool(number and len(passage) >= 500 and max_words)
    report = {'accepted': valid, 'number': number, 'passageChars': len(passage), 'maxWords': max_words}
    if not valid:
        return None, report
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    item_id = f'{prefix}-{year}-summary-writing'
    structure = extract_summary_source(source_path, item_id)
    article_title = structure['articleTitle']
    article_paragraphs = structure['articleParagraphs']
    passage = '\n\n'.join(article_paragraphs)
    prompt = '\n\n'.join(value for value in [directions, article_title, *article_paragraphs] if value)
    report.update({
        'articleTitle': article_title,
        'paragraphCount': len(article_paragraphs),
    })
    return {
        '_id': item_id,
        'title': f'{year} 上海高考{label} IV. Summary Writing',
        'year': year,
        'city': '上海',
        'district': label,
        'examType': label,
        'stage': '高中',
        'section': 'summary-writing',
        'category': '高中概要写作',
        'contentType': 'summary-writing',
        'contentRevision': 2,
        'paperId': f'{prefix}-{year}',
        'paperOrder': 1,
        'sourceType': 'shanghai-gaokao',
        'sourceFile': source_path.name,
        'questionNumber': number,
        'prompt': prompt,
        'directions': directions,
        'scenario': passage,
        'articleTitle': article_title,
        'articleParagraphs': article_paragraphs,
        'requirementsTitle': '',
        'requirements': [],
        'promptStarter': '',
        'images': [],
        'minWords': 0,
        'maxWords': max_words,
        'score': 10,
    }, report


def extract_translation_reference_candidates(answer_source: str, question_numbers: list[int]) -> dict[int, list[str]]:
    heading_pattern = r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\s*[.．、]?\s*)?Translation\b[^\n]*'
    guided_pattern = r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\s*[.．、]?\s*)?Guided Writing\b[^\n]*'
    candidates = defaultdict(list)
    for heading in re.finditer(heading_pattern, answer_source, re.I):
        tail = answer_source[heading.start():]
        end_match = re.search(guided_pattern, tail[heading.end() - heading.start():], re.I)
        block_end = heading.end() - heading.start() + end_match.start() if end_match else len(tail)
        block = clean(tail[:block_end])
        markers = list(re.finditer(r'(?m)^\s*(\d{1,3})\s*[.．、]\s*', block))
        for index, marker in enumerate(markers):
            number = int(marker.group(1))
            if number not in question_numbers:
                continue
            end = markers[index + 1].start() if index + 1 < len(markers) else len(block)
            value = clean(block[marker.end():end])
            chunks = []
            reference_match = re.search(r'参考译文\s*[:：]\s*([\s\S]+)', value, re.I)
            if reference_match:
                chunks.append(reference_match.group(1))
            answer_match = re.search(r'【\s*答\s*案\s*】\s*([\s\S]*?)(?=【\s*(?:解析|分析|解答|点评)\s*】|$)', value, re.I)
            if answer_match and '见试题解答内容' not in answer_match.group(1):
                chunks.append(answer_match.group(1))
            keyword_match = re.search(r'[（(][^（）()\n]+[）)]\s*([A-Z][\s\S]*?)(?=【\s*答\s*案\s*】|$)', value)
            if keyword_match:
                chunks.append(keyword_match.group(1))
            leading_english = re.match(r'\s*([A-Z][\s\S]*?)(?=\n+\s*(?:或者|或|第\s*\d+\s*页|【)|$)', value)
            if leading_english:
                chunks.append(leading_english.group(1))
            if not re.search(r'[\u3400-\u9fff]', value):
                chunks.append(value)
            for chunk in chunks:
                candidate = compact(re.split(r'【|参考答案\s*[:：]|第\s*\d+\s*页', chunk, maxsplit=1)[0])
                candidate = re.sub(r'^(?:Or|或者|或)\s*[:：]?\s*', '', candidate, flags=re.I)
                if len(re.findall(r'[A-Za-z]{2,}', candidate)) < 3 or re.search(r'[\u3400-\u9fff]', candidate):
                    continue
                candidate = candidate.rstrip('.． ')
                if candidate and candidate not in candidates[number]:
                    candidates[number].append(candidate)
    return dict(candidates)


def build_translation_item(session: str, year: int, text: str, source_file: str, answer_text: str = ''):
    translation_heading_pattern = r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\s*[.．、]?\s*)?Translation\b[^\n]*'
    guided_heading_pattern = r'(?m)^\s*(?:(?:[IVX]+|[\u2160-\u2169])\s*[.．、]?\s*)?Guided Writing\b[^\n]*'
    translation_headings = list(re.finditer(translation_heading_pattern, text, re.I))

    def translation_block(heading):
        tail = text[heading.start():]
        end_match = re.search(guided_heading_pattern, tail[heading.end() - heading.start():], re.I)
        end = heading.end() - heading.start() + end_match.start() if end_match else len(tail)
        return clean(tail[:end])

    raw = translation_block(translation_headings[0]) if translation_headings else section(
        text,
        [r'(?m)^\s*翻译部分\s*$'],
        [r'(?m)^\s*参考译文\s*[:：]?\s*$', r'(?m)^\s*作文部分\s*$'],
    )
    first_question = re.search(r'(?m)^\s*\d{1,2}\s*[.．、]\s*', raw)
    directions_source = raw[:first_question.start()] if first_question else raw
    directions_match = re.search(r'Directions\s*:\s*[\s\S]+', directions_source, re.I)
    directions = compact(directions_match.group(0)) if directions_match else ''
    source_score = sum(int(value) for value in re.findall(r'(?m)^\s*\d{1,2}\s*[.．、]\s*[（(]\s*(\d+)\s*分\s*[）)]', raw))
    markers = list(re.finditer(r'(?m)^\s*(\d{1,2})\s*[.．、]\s*', raw))
    questions = []
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
        question_block = clean(raw[marker.end():end])
        source_text = compact(question_block)
        first_line = next((compact(line) for line in question_block.splitlines() if compact(line)), '')
        if first_line and re.search(r'[\u3400-\u9fff]', first_line) and re.search(r'[（(][^（）()]+[）)]\s*[.．_＿]*$', first_line):
            source_text = first_line
        source_text = re.sub(r'^\s*[（(]\s*\d+\s*分\s*[）)]\s*', '', source_text)
        source_text = re.sub(r'\s*[（(]\s*汉译英\s*[）)]\s*$', '', source_text)
        keyword_match = re.search(r'[（(]\s*([^（）()]+?)\s*[）)]\s*[.．_＿]*\s*$', source_text)
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
    if not questions:
        source_lines = [compact(line) for line in raw.splitlines() if re.search(r'[\u3400-\u9fff]', line)]
        for source_line in source_lines:
            keyword_match = re.search(r'[（(]\s*([^（）()]+?)\s*[）)]\s*[.．_＿]*\s*$', source_line)
            if not keyword_match:
                continue
            questions.append({
                'number': len(questions) + 1,
                'sourceText': compact(source_line[:keyword_match.start()]),
                'requiredWord': compact(keyword_match.group(1)),
                'referenceAnswers': [],
            })
    inline_answers = {}
    for match in re.finditer(r'(?m)^\s*(\d{1,2})\s*[.．、]\s*([^\n]+)$', raw):
        number = int(match.group(1))
        value = compact(match.group(2))
        if re.search(r'[A-Za-z]', value) and not re.search(r'[\u3400-\u9fff]', value):
            inline_answers[number] = value
    if session == 'autumn' and year == 2013:
        for index, marker in enumerate(markers):
            number = int(marker.group(1))
            end = markers[index + 1].start() if index + 1 < len(markers) else len(raw)
            lines = [compact(line) for line in clean(raw[marker.end():end]).splitlines() if compact(line)]
            english = next((line.rstrip('.． ') for line in lines[1:] if re.match(r'^[A-Z]', line) and len(re.findall(r'[A-Za-z]{2,}', line)) >= 3), '')
            if english:
                inline_answers[number] = english
    answer_source = answer_text or text
    answer_headings = list(re.finditer(translation_heading_pattern, answer_source, re.I))

    def answer_translation_block(heading):
        tail = answer_source[heading.start():]
        end_match = re.search(guided_heading_pattern, tail[heading.end() - heading.start():], re.I)
        end = heading.end() - heading.start() + end_match.start() if end_match else len(tail)
        return clean(tail[:end])

    if answer_headings:
        answer_blocks = [answer_translation_block(heading) for heading in answer_headings]
        question_numbers_for_score = [question['number'] for question in questions]
        def block_score(value):
            matching_numbers = sum(bool(re.search(rf'(?m)^\s*{number}\s*[.．、]', value)) for number in question_numbers_for_score)
            answer_labels = len(re.findall(r'【\s*答\s*案\s*】', value))
            return matching_numbers * 1000 + answer_labels * 100 + len(re.findall(r'[A-Za-z]{4,}', value))
        answer_raw = max(answer_blocks, key=block_score)
    else:
        answer_raw = section(
            answer_source,
            [r'(?m)^\s*(?:[IVX]+|[\u2160-\u2169])\.?\s*翻译\s*$', r'(?m)^\s*参考译文\s*[:：]?\s*$'],
            [r'(?m)^\s*(?:[IVX]+|[\u2160-\u2169])\.?\s*写作', r'(?m)^\s*作文部分\s*$'],
        )
    answer_lines = [
        compact(line)
        for line in answer_raw.splitlines()[1:]
        if compact(line) and not re.match(r'^(?:I|\u2160)\.?\s*翻译$', compact(line), re.I)
    ]
    corrections = []
    numbered_answers = {}
    answer_markers = list(re.finditer(r'(?m)^\s*(\d{1,3})(?:\s*[.．、]\s*|\s+)', answer_raw))
    for index, marker in enumerate(answer_markers):
        end = answer_markers[index + 1].start() if index + 1 < len(answer_markers) else len(answer_raw)
        answer_value = clean(answer_raw[marker.end():end])
        direct_answer = re.search(
            r'[（(][^（）()]*[A-Za-z][^（）()]*[）)]\s*\n+\s*([A-Z][\s\S]*?)(?=\n+\s*【)',
            answer_value,
        )
        explicit_solution = re.search(r'【\s*解\s*答\s*】\s*([\s\S]*?)(?=【|$)', answer_value)
        explicit_answer = re.search(r'【\s*答\s*案\s*】\s*([\s\S]*?)(?=【|$)', answer_value)
        if direct_answer:
            answer_value = clean(direct_answer.group(1))
        elif explicit_solution:
            solution = re.sub(r'^\s*答案\s*[:：]\s*', '', explicit_solution.group(1))
            solution = re.split(r'[\u3400-\u9fff]', solution, maxsplit=1)[0]
            answer_value = clean(solution)
        elif explicit_answer and '见试题解答内容' not in explicit_answer.group(1):
            answer_value = clean(explicit_answer.group(1))
        elif re.search(r'[\u3400-\u9fff]', answer_value):
            answer_value = re.sub(r'^[\s\S]*?[（(][^（）()]+[）)]\s*', '', answer_value, count=1)
        numbered_answers[int(marker.group(1))] = [
            compact(value) for value in re.split(r'(?im)^\s*(?:Or|或者)\s*:? ?\s*', answer_value) if compact(value)
        ]
    if questions:
        full_answer_markers = list(re.finditer(r'(?m)^\s*(\d{1,3})\s*[.．、]\s*', answer_source))
        for index, marker in enumerate(full_answer_markers):
            number = int(marker.group(1))
            if number not in {question['number'] for question in questions}:
                continue
            end = full_answer_markers[index + 1].start() if index + 1 < len(full_answer_markers) else len(answer_source)
            value = clean(answer_source[marker.end():end])
            inline_answer = re.search(
                r'[（(][^（）()]+[）)]\s*([A-Z][\s\S]*?)(?=【\s*解\s*答\s*】|$)',
                value,
            )
            if inline_answer:
                candidate = compact(inline_answer.group(1)).rstrip('.． ')
                if candidate and not re.search(r'[\u3400-\u9fff]|(?:Summary|Translation|Guided)\s+Writing', candidate, re.I):
                    numbered_answers[number] = [candidate]
                    continue
            value = re.split(r'【\s*(?:解析|解答|答案)\s*】', value, maxsplit=1)[0]
            if re.search(r'[A-Za-z]{3,}', value) and not re.search(r'[\u3400-\u9fff]', value):
                numbered_answers[number] = [compact(value)]
    if inline_answers and all(question['number'] in inline_answers for question in questions):
        for question in questions:
            question['referenceAnswers'] = [inline_answers[question['number']]]
    elif numbered_answers and all(question['number'] in numbered_answers for question in questions):
        for question in questions:
            question['referenceAnswers'] = numbered_answers[question['number']]
    elif len(answer_lines) >= len(questions):
        for question, answer in zip(questions, answer_lines):
            if question['number'] == 3 and answer.startswith('Thinking only a cup of coffee'):
                corrections.append({'number': 3, 'source': answer, 'normalized': answer.replace('Thinking', 'Drinking', 1)})
                answer = answer.replace('Thinking', 'Drinking', 1)
            question['referenceAnswers'] = [answer]
    reliable_references = extract_translation_reference_candidates(answer_source, [question['number'] for question in questions])
    if reliable_references and all(question['number'] in reliable_references for question in questions):
        for question in questions:
            question['referenceAnswers'] = reliable_references[question['number']]
    if session == 'autumn' and year == 2012 and len(questions) == 5:
        marker = re.search(r'翻译\s*共\s*20\s*分', answer_source)
        if marker:
            tail = answer_source[marker.end():]
            reference_rows = list(re.finditer(r'(?m)^\s*([1-5])\s*[.．、]\s*', tail))
            references = {}
            for index, item in enumerate(reference_rows):
                end = reference_rows[index + 1].start() if index + 1 < len(reference_rows) else len(tail)
                value = compact(tail[item.end():end]).rstrip('.． ')
                if re.match(r'^[A-Z]', value) and not re.search(r'[\u3400-\u9fff]', value):
                    references[int(item.group(1))] = value
            if all(question['number'] in references for question in questions):
                for question in questions:
                    question['referenceAnswers'] = [references[question['number']]]
    if session == 'autumn' and year == 2011 and len(questions) == 5:
        marker = re.search(r'(?m)^\s*1\s*[.．、]\s*(?=Why\s+(?:not|don[’\']?t\s+you))', answer_source, re.I)
        if marker:
            tail = answer_source[marker.start():]
            listening_marker = re.search(r'(?m)^\s*Listening\s+Comprehension\s*$', tail, re.I)
            if listening_marker:
                tail = tail[:listening_marker.start()]
            answer_markers_2011 = list(re.finditer(r'(?m)^\s*([1-5])\s*[.．、]\s*', tail))
            references = {}
            for index, item in enumerate(answer_markers_2011):
                end = answer_markers_2011[index + 1].start() if index + 1 < len(answer_markers_2011) else len(tail)
                value = compact(tail[item.end():end]).rstrip('.． ')
                value = value.replace('As forparents', 'As for parents')
                value = value.replace('No longer hasshe', 'No longer has she')
                value = value.replace('(that)suits', '(that) suits')
                if re.match(r'^[A-Z]', value) and not re.search(r'[\u3400-\u9fff]', value):
                    references[int(item.group(1))] = value
            if all(question['number'] in references for question in questions):
                for question in questions:
                    question['referenceAnswers'] = [references[question['number']]]
    if session == 'autumn' and year == 2014 and len(questions) == 5:
        marker = re.search(r'I\s*[.．、]?\s*翻译\s*共\s*22\s*分', answer_source, re.I)
        if marker:
            tail = answer_source[marker.end():]
            writing_marker = re.search(r'(?m)^\s*(?:II|\u2161)\s*[.．、]?\s*(?:写作|Guided Writing)', tail, re.I)
            if writing_marker:
                tail = tail[:writing_marker.start()]
            answer_markers_2014 = list(re.finditer(r'(?m)^\s*([1-5])\s*[.．、]\s*', tail))
            references = {}
            for index, item in enumerate(answer_markers_2014):
                end = answer_markers_2014[index + 1].start() if index + 1 < len(answer_markers_2014) else len(tail)
                value = compact(tail[item.end():end]).rstrip('.． ')
                if re.match(r'^[A-Z]', value) and not re.search(r'[\u3400-\u9fff]', value):
                    references[int(item.group(1))] = value
            if all(question['number'] in references for question in questions):
                for question in questions:
                    question['referenceAnswers'] = [references[question['number']]]
    if session == 'autumn' and year == 2023 and len(questions) == 4:
        references = {}
        for number in range(72, 76):
            marker = re.search(rf'(?m)^\s*{number}\s*[.．、]\s*(?:⏩\s*)?参考答案\s*[:：]?', answer_source)
            if not marker:
                continue
            tail = answer_source[marker.end():]
            next_marker = re.search(rf'(?m)^\s*(?:{number + 1}\s*[.．、]\s*(?:⏩\s*)?参考答案|(?:VI|Ⅵ)\s*[.．]?\s*Guided Writing)', tail, re.I)
            value = clean(tail[:next_marker.start()] if next_marker else tail)
            value = re.split(r'\s*解析\s*[:：]', value, maxsplit=1)[0]
            candidate = compact(value).rstrip('.． ')
            if re.match(r'^[A-Z]', candidate) and not re.search(r'[\u3400-\u9fff]', candidate):
                references[number] = candidate
        if all(question['number'] in references for question in questions):
            for question in questions:
                question['referenceAnswers'] = [references[question['number']]]
    if session == 'autumn' and year == 2017:
        for question in questions:
            if question['number'] == 72 and question['referenceAnswers']:
                source_answer = question['referenceAnswers'][0]
                normalized = re.sub(r'\bpublished\b', 'punished', source_answer, flags=re.I)
                if source_answer != normalized:
                    corrections.append({'number': 72, 'source': source_answer, 'normalized': normalized})
                    question['referenceAnswers'][0] = normalized
    if session == 'autumn' and year == 2010 and len(questions) == 5:
        normalized_references = {
            1: 'This magazine cost/costs me more than 20 yuan.',
            2: 'I always get up later than usual on rainy days.',
            3: 'Seeing Grandma a little sleepy, he drew the curtains and turned the TV down.',
            4: "At first sight, there is nothing special about this watch, but in fact it is a mobile phone.",
            5: 'We all agree that once the conclusion of the investigation is drawn, it will be made known to the public as soon as possible.',
        }
        for question in questions:
            source_answer = question['referenceAnswers'][0] if question['referenceAnswers'] else ''
            normalized = normalized_references[question['number']]
            if source_answer != normalized:
                corrections.append({'number': question['number'], 'source': source_answer, 'normalized': normalized})
            question['referenceAnswers'] = [normalized]
    if session == 'autumn' and year == 2022:
        for question in questions:
            if question['number'] == 74 and question['requiredWord'] == 'a different':
                corrections.append({'number': 74, 'source': 'a different', 'normalized': 'a difference'})
                question['requiredWord'] = 'a difference'
    if year >= 2017 and [question['number'] for question in questions] == [1, 2, 3, 4]:
        for question in questions:
            question['number'] += 71
    question_numbers = [question['number'] for question in questions]
    accepted = bool(
        len(questions) in {4, 5, 6}
        and question_numbers == list(range(question_numbers[0], question_numbers[0] + len(questions)))
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
        'score': 0 if session == 'spring' and year == 2023 else (source_score or int((re.search(r'共\s*(\d+)\s*分', answer_raw) or [None, 15 if year >= 2017 else 20])[1])),
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


def normalize_grammar_prompt_blank(session: str, year: int, number: int, prompt: str) -> str:
    if session != 'autumn' or year != 2010:
        return prompt
    prompt = prompt.replace('our manage objects', 'our manager objects').replace('Thai is the only way', 'That is the only way')
    if '_____' in prompt:
        return prompt
    replacements = {
        25: ('jogging the tree-lined', 'jogging _____ the tree-lined'),
        26: ('It was journey.', 'It was _____ journey.'),
        27: ('depend on', 'depend on _____'),
        28: ('coal workers their', 'coal workers _____ their'),
        29: ('you have done', 'you _____ have done'),
        30: ('travelled the local market', 'travelled _____ the local market'),
        31: ('tower which will', 'tower which _____ will'),
        32: ('great difficulty the suitable', 'great difficulty _____ the suitable'),
        33: ('her colleagues with her stories', 'her colleagues _____ with her stories'),
        34: ('you may have,', '_____ you may have,'),
        35: ('the city center,', '_____ the city center,'),
        36: ('city life is she can', 'city life is _____ she can'),
        37: ('drivers know .', 'drivers know _____.'),
        38: ('source of energy we may', 'source of energy _____ we may'),
        39: ("our manager objects", "_____ our manager objects"),
        40: ('we can imagine the overuse', 'we can imagine _____ the overuse'),
    }
    source, target = replacements.get(number, ('', ''))
    return prompt.replace(source, target, 1) if source and source in prompt else prompt


def build_grammar_questions(session: str, year: int, text: str, source_file: str, answers: dict[int, str]):
    raw = section(
        text,
        [r'Grammar and Vocabulary', r'Grammar\s+Directions', r'(?:II|\u2161)\.?\s*Grammar'],
        [r'Reading Comprehension', r'Cloze', r'(?:III|IV|\u2162|\u2163)\.?\s*Reading'],
    )
    section_b = re.search(r'(?m)^\s*Section\s+B\b', raw, re.I)
    if section_b:
        raw = raw[:section_b.start()]
    parsed = parse_choice_questions(raw, answers, 1, 60)
    prefix = SESSIONS[session]['prefix']
    label = SESSIONS[session]['label']
    questions = []
    reviewed_topics = reviewed_grammar_topics(session, year)
    if reviewed_topics and set(reviewed_topics) != {question['number'] for question in parsed}:
        raise ValueError(f'grammar-review-question-set-mismatch:{session}:{year}')
    for question in parsed:
        question['prompt'] = normalize_grammar_prompt_blank(session, year, question['number'], question['prompt'])
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
        start_pattern = r'Listening (?:Comprehension )?(?:Script|Text)|^Listening\s+Comprehension\s*$|听力(?:原文|文本|文字稿|文稿)|录音(?:原文|文字稿)'
        for start in re.finditer(start_pattern, text, re.I | re.M):
            tail = text[start.end():]
            ends = [match.start() for pattern in (r'参考答案', r'答案解析', r'Grammar and Vocabulary') if (match := re.search(pattern, tail, re.I))]
            raw = tail[:min(ends)] if ends else tail
            value = compact(raw)
            if len(value) >= 500 and re.search(r'\b(?:M|W|Man|Woman|Questions?)\s*[:\uff1a]', value, re.I):
                return value
    return ''


def extract_explicit_transcript(texts: list[str]) -> str:
    for text in texts:
        transcript_marker = re.search(r'听力(?:试题)?(?:原文|文本|文字稿|文稿)', text, re.I)
        speaker_marker = re.search(r'(?m)^\s*1\s*[.\uff0e、]\s*(?:M|W|Man|Woman)\s*[:\uff1a]', text, re.I)
        if speaker_marker:
            raw = text[speaker_marker.start():]
        elif transcript_marker:
            raw = text[transcript_marker.end():]
        else:
            raw = section(
                text,
                [r'Listening Comprehension', r'录音(?:原文|文字稿)'],
                [r'参考答案', r'答案解析', r'Grammar and Vocabulary'],
            ) or text
        raw = re.split(r'(?m)^\s*(?:参\s*考\s*答\s*案|答案解析|Grammar and Vocabulary)\b', raw, maxsplit=1, flags=re.I)[0]
        end_marker = re.search(r"That's the end of listening comprehension[.．]?", raw, re.I)
        if end_marker:
            raw = raw[:end_marker.end()]
        value = compact(raw)
        if len(value) >= 500 and re.search(r'\b(?:M|W|Man|Woman|Q|Questions?)\s*[:\uff1a]', value, re.I):
            return value
    return ''


def extract_listening_text_answers(text: str, number_min: int, number_max: int):
    first_part = section(
        text,
        [r'Listening Comprehension', r'(?:I|\u2160)\.?\s*Listening'],
        [r'Grammar and Vocabulary', r'(?:II|\u2161)\.?\s*Grammar'],
    )
    result = {}
    for marker in re.finditer(r'【\s*(?:解\s*答|答\s*案)\s*】', first_part):
        block = first_part[marker.end():]
        block = re.split(r'【\s*(?:点评|答案|分析)\s*】', block, maxsplit=1)[0]
        markers = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]\s*', block))
        for index, item in enumerate(markers):
            number = int(item.group(1))
            if not number_min <= number <= number_max:
                continue
            end = markers[index + 1].start() if index + 1 < len(markers) else len(block)
            answer = compact(block[item.end():end])
            answer = re.split(r'\s+(?:M|W|Man|Woman)\s*[:;：；]', answer, maxsplit=1, flags=re.I)[0]
            answer = re.sub(r'a\s*[（(]\s*famous\s*[）)]\s*judge', 'a famous judge', answer, flags=re.I)
            answer = answer.replace('（with others）', 'with others').replace('(with others)', 'with others')
            if answer and len(answer) <= 80 and not re.search(r'[\u3400-\u9fff]', answer):
                result[number] = answer.rstrip('.． ')
    compact_first_part = compact(first_part)
    matches = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]\s*', compact_first_part))
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if not number_min <= number <= number_max:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(compact_first_part)
        answer = compact(compact_first_part[match.end():end])
        if answer and len(answer) <= 80:
            result.setdefault(number, answer)
    for marker in re.finditer(r'【\s*答\s*案\s*】', first_part):
        block = first_part[marker.end():]
        block = re.split(r'【\s*(?:解析|分析|点评|答案)\s*】', block, maxsplit=1)[0]
        for number, value in re.findall(r'(?m)^\s*(\d{1,3})\s*[.．、]?\s*([^\n]+)', block):
            number = int(number)
            answer = compact(value).rstrip('.． ')
            if number_min <= number <= number_max and answer and len(answer) <= 80 and not re.search(r'[\u3400-\u9fff]', answer):
                result[number] = answer
    return result


def extract_numbered_short_answer_map(text: str, number_min: int, number_max: int):
    marker = re.search(r'参\s*考\s*答\s*案|上海英语英语参考|上海英语参考答案', text)
    if not marker:
        return {}
    tail = compact(text[marker.end():])
    markers = list(re.finditer(r'(?<!\d)(\d{1,3})\s*[、.．]\s*', tail))
    result = {}
    for index, item in enumerate(markers):
        number = int(item.group(1))
        if not number_min <= number <= number_max or number in result:
            continue
        end = markers[index + 1].start() if index + 1 < len(markers) else len(tail)
        value = compact(tail[item.end():end]).rstrip('.． ')
        value = compact(re.split(r'[\u3400-\u9fff]', value, maxsplit=1)[0])
        if value and len(value) <= 100 and not re.search(r'[\u3400-\u9fff]', value):
            result[number] = value
    return result


def extract_reference_text_answers(text: str, number_min: int, number_max: int):
    result = {}
    for number in range(number_min, number_max + 1):
        match = re.search(rf'【\s*解\s*答\s*】\s*{number}\s*[.．、]\s*([^\n]+)', text)
        if match:
            answer = compact(match.group(1)).rstrip('.． ')
            if answer and not re.search(r'[\u3400-\u9fff]', answer) and len(answer) <= 240:
                result[number] = answer
    for solution_marker in re.finditer(r'【\s*解\s*答\s*】', text):
        block = text[solution_marker.end():]
        block = re.split(r'【\s*(?:点评|答案|分析)\s*】', block, maxsplit=1)[0]
        markers = list(re.finditer(r'(?m)^\s*(\d{2,3})\s*[.．、]\s*', block))
        for index, marker in enumerate(markers):
            number = int(marker.group(1))
            if not number_min <= number <= number_max:
                continue
            end = markers[index + 1].start() if index + 1 < len(markers) else len(block)
            answer = compact(block[marker.end():end].splitlines()[0]).rstrip('.． ')
            if answer and not re.search(r'[\u3400-\u9fff]', answer) and len(answer) <= 240:
                result[number] = answer
    marker = re.search(r'参\s*考\s*答\s*案|上海英语英语参考|上海英语参考答案|答案要点及评分标准', text)
    if not marker:
        return result
    raw_tail = text[marker.end():]
    raw_matches = list(re.finditer(r'(?m)^\s*(\d{1,3})\s*[.\uff0e、]\s*([^\n]+)', raw_tail))
    for item in raw_matches:
        number = int(item.group(1))
        if not number_min <= number <= number_max:
            continue
        answer = compact(item.group(2)).rstrip('.． ')
        answer = re.split(r'\s+(?=\d{1,3}\s*[.．、])', answer, maxsplit=1)[0]
        if answer and len(answer) <= 240:
            result[number] = answer
    tail = compact(text[marker.end():])
    matches = list(re.finditer(r'(?:^|\s)(\d{1,3})\s*[.\uff0e、]?\s+', tail))
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if not number_min <= number <= number_max:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(tail)
        answer = compact(tail[match.end():end])
        answer = re.split(r'\s*(?:简答题的评分标准|第\s*II\s*卷|第Ⅱ卷)', answer, maxsplit=1, flags=re.I)[0]
        if answer and len(answer) <= 240:
            result.setdefault(number, answer.rstrip('. '))
    return result


def extract_listening_blank_prompts(raw: str) -> dict[int, str]:
    prompts = {}
    marker_pattern = r'(?:(?:_|＿)+(\d{1,3})(?:_|＿)+|[（(]\s*(\d{1,3})\s*[）)])'
    listening_c = section(raw, [r'Blanks\s+17\s+through\s+20'], [r'Grammar and Vocabulary'])
    lines = [compact(line) for line in listening_c.splitlines() if compact(line)]
    for index, line in enumerate(lines):
        match = re.search(marker_pattern, line)
        if not match:
            continue
        number = int(match.group(1) or match.group(2))
        if not 17 <= number <= 24:
            continue
        answer_line = compact(re.sub(marker_pattern, '_____', line, count=1))
        next_line = lines[index + 1] if index + 1 < len(lines) and not re.search(marker_pattern, lines[index + 1]) else ''
        if next_line and (answer_line.endswith(' in') or answer_line.endswith(' with') or answer_line.endswith('decision')):
            answer_line = compact(f'{answer_line} {next_line}')
        prompts[number] = answer_line
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
        command = [
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
            '-map_metadata', '-1', '-vn',
        ]
        if item_id == 'sh-spring-2017-listening':
            command.extend(['-af', 'aresample=32000:async=1000:first_pts=0'])
        command.extend(['-ac', '1', '-ar', '32000', '-codec:a', 'libmp3lame', '-b:a', '64k', str(target)])
        subprocess.run(command, check=True)
    return target, digest


def build_listening_item(session: str, year: int, text: str, source_file: str, answers: dict[int, str], text_answers: dict[int, str], transcript: str, audio: Path | None, apply_audio: bool):
    raw = section(
        text,
        [r'Listening Comprehension', r'(?:I|\u2160)\.?\s*Listening'],
        [r'Grammar and Vocabulary', r'(?:II|\u2161)\.?\s*Grammar', r'(?m)^\s*第\s*II\s*卷\s*$', r'(?m)^\s*(?:I|\u2160)\.?\s*Translation\b'],
    )
    questions = parse_choice_questions(raw, answers, 1, 20, 'Listen and choose the best answer.')
    if session == 'autumn' and year == 2011 and not any(question['number'] <= 10 for question in questions):
        questions.extend(parse_unnumbered_choice_questions(raw, answers, 1, 10))
    listening_prompt_overrides = {}
    if session == 'autumn' and year == 2013:
        listening_prompt_overrides = {
            11: "What was the speaker's previous job?",
            12: 'What helps to make the speaker productive according to the passage?',
            13: 'What does the passage mainly tell us?',
            14: 'What kind of questions are usually asked in the traditional interview?',
            15: 'What does the case interview focus on about the candidate?',
            16: 'What does the speaker mainly talk about?',
        }
    for question in questions:
        if question['number'] in listening_prompt_overrides:
            question['prompt'] = listening_prompt_overrides[question['number']]
        if re.fullmatch(r'[（(]\s*\d+\s*分\s*[）)]', question.get('prompt', '')):
            question['prompt'] = 'Listen and choose the best answer.'
        question['options'] = {
            key: re.split(r'\s+Section\s+[A-C]\s*$', value, maxsplit=1, flags=re.I)[0]
            for key, value in question.get('options', {}).items()
        }
        question['sectionKey'] = 'A' if question['number'] <= 10 else 'B'
        question['sectionTitle'] = 'Section A · Listen and choose the best answer.' if question['number'] <= 10 else 'Section B · Listen and choose the best answer.'
        if 11 <= question['number'] <= 13:
            question['groupKey'] = 'B-11-13'
            question['groupTitle'] = 'Questions 11 through 13 are based on the following passage.'
        elif 14 <= question['number'] <= 16:
            question['groupKey'] = 'B-14-16'
            question['groupTitle'] = 'Questions 14 through 16 are based on the following passage.'
        elif 17 <= question['number'] <= 20:
            question['groupKey'] = 'B-17-20'
            question['groupTitle'] = 'Questions 17 through 20 are based on the following conversation.'
    blank_prompts = extract_listening_blank_prompts(raw)
    form_title_overrides = {}
    given_rows_overrides = {}
    if session == 'autumn' and year == 2011:
        if 24 in text_answers:
            text_answers[24] = re.sub(r'\s+25\s*[-–—].*$', '', text_answers[24]).strip()
        blank_prompts.update({
            17: 'Phone No.: _____',
            18: 'Location of Problem: A _____ restaurant, 449 Shanghai Street',
            19: 'Details: It dumps its _____ on the street.',
            20: "Details: It doesn't put bottles and cans in _____ bins.",
            21: 'How long does short memory last? It lasts only _____.',
            22: 'What is an example of medium term memory? Buying bread, a sort of _____ of things to do.',
            23: 'What is long term memory concerned with? _____ that happen in your life such as your wedding.',
            24: 'How is long term memory different from the others? It _____.',
        })
        form_title_overrides[17] = 'Complaint Form'
        given_rows_overrides[17] = [{'label': 'Caller', 'value': 'Mary White'}]
    if session == 'autumn' and year == 2012:
        blank_prompts.update({
            17: 'Department: The _____ Department',
            18: 'Student ID: _____',
            19: 'Class: The _____ class',
            20: 'Time: _____, 2:00-4:00 p.m.',
            21: 'The members were from different cities with different _____ and cultures.',
            22: 'Different people can be _____.',
            23: 'They treated her as _____.',
            24: 'Sometimes _____ can say more than words.',
        })
        form_title_overrides[17] = 'Class Registration Form'
        given_rows_overrides[17] = [{'label': 'Name', 'value': 'Andrew Smith'}]
    if session == 'autumn' and year == 2013:
        blank_prompts.update({
            17: 'Date: 8th _____',
            18: 'Place: Palace _____, Shanghai',
            19: 'Registration fee: $ _____',
            20: 'Speech topic: Opportunities and Risks in the _____ Market',
            21: "What was David's schoolwork like? He was able to get his schoolwork done _____.",
            22: 'What was his only problem at school? He was unable to _____ in class.',
            23: 'Why did he say the new headmaster was wonderful? He let students _____ of their own.',
            24: 'How was his new style different from other skaters? It was robot-like, with _____.',
        })
        form_title_overrides.update({17: 'Latest Conference Information', 21: 'An Interview with David, a Skateboarding Lover'})
        given_rows_overrides[20] = [{'label': 'Speaker', 'value': 'Carla Marisco from Milan University'}]
    if session == 'autumn' and year == 2014:
        blank_prompts.update({
            17: 'Travel purpose: for a(n) _____ in London',
            18: 'Comments on the airport environment / facilities · Likes: _____',
            19: 'Likes: _____ walkways',
            20: 'Dislikes: _____ shops; small trolleys',
            21: "What is critical thinking in reading? Assessing the writer's ideas and thinking about the _____ of what the writer is saying.",
            22: "What is the first step in reading an academic text critically? Finding out the argument and the writer's main line of _____.",
            23: 'What may serve as the evidence? _____, survey results, examples, etc.',
            24: 'What is the key to critical thinking? To read actively and _____.',
        })
        form_title_overrides[17] = "Travellers' Survey Sheet"
    if session == 'autumn' and year == 2015:
        blank_prompts.update({
            17: 'SRT Service Notes · Account No.: _____',
            18: 'SRT Service Notes · Service Request: Check the _____',
            19: 'SRT Service Notes · Solutions: Send another _____',
            20: 'SRT Service Notes · Solutions: 2 pm on _____',
            21: 'In what way are these climbers special? They are all _____.',
            22: 'Why did they choose to conquer Mount Kilimanjaro? To prove _____.',
            23: 'What did they do in time of difficulty? They turned _____.',
            24: 'How did they record their adventure? By keeping _____.',
        })
    if session == 'autumn' and year == 2016:
        blank_prompts.update({
            17: 'Class Diary (June 13-19) · June 14, MON: _____ for after-class activity application.',
            18: 'Class Diary (June 13-19) · June 16, WED: Handing in three student _____.',
            19: 'Class Diary (June 13-19) · June 17, THU · Basketball Club meeting · Time: 12:45-1:30 p.m. · Place: The _____.',
            20: 'Class Diary (June 13-19) · June 18, FRI · Filling in a form with up-to-date personal data · Time: _____ break · Place: The computer room.',
            21: 'Who is Sue Walter? She is _____ in court and a writer.',
            22: "What is Sue's suggestion for people with difficulties? _____",
            23: "In Sue's eyes, what is the best part about her job? _____ in decision-making.",
            24: 'What does Sue think happiness is? _____',
        })
        if text_answers.get(21) == 'a famous judge':
            text_answers[21] = 'a famous judge/a judge'
        if text_answers.get(24) == 'Sharing with others':
            text_answers[24] = 'Sharing with others/Sharing'
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
                'groupInstruction': ('Write NO MORE THAN ONE WORD for each answer.' if session == 'autumn' and year == 2015 else 'Write ONE WORD for each answer.') if number <= 20 else 'Write NO MORE THAN THREE WORDS for each answer.',
                'formTitle': form_title_overrides.get(number, ('SRT Service Notes' if session == 'autumn' and year == 2015 else ('Class Diary (June 13-19)' if session == 'autumn' and year == 2016 else form_context.get('formTitle', '') if number == 17 else ''))),
                'givenRows': given_rows_overrides.get(number, form_context.get('givenRowsBefore', {}).get(number, [])),
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


def build_grammar_files(session: str, questions: list[dict], year: int | None = None):
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
    module_dir = ROOT / 'data' / f'grammar-senior-{session}'
    out = module_dir / 'years' / str(year) if year else module_dir
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


def merge_selected_year_items(path: Path, new_items: list[dict], selected_years: set[int], year_field: str = 'year'):
    existing = []
    if path.exists():
        raw = json.loads(path.read_text(encoding='utf-8'))
        existing = raw if isinstance(raw, list) else []
    retained = [
        item for item in existing
        if int(item.get(year_field) or item.get('sourceYear') or 0) not in selected_years
    ] if selected_years else []
    merged = retained + new_items
    def paper_order(item):
        explicit = int(item.get('paperOrder') or 0)
        if explicit:
            return explicit
        return 1 if item.get('contentType') == 'translation' else 2
    return sorted(merged, key=lambda item: (
        int(item.get(year_field) or item.get('sourceYear') or 0),
        paper_order(item),
        str(item.get('_id') or item.get('id') or ''),
    ))


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
    discovered_keys = set(documents) | set(audios) | set(transcript_docs)
    if selected_years and selected_sessions:
        for session in sorted(selected_sessions):
            for year in sorted(selected_years):
                if (session, year) not in discovered_keys:
                    all_reports.append({
                        'session': session,
                        'year': year,
                        'accepted': False,
                        'reason': 'source-paper-missing',
                    })
    for key in sorted(discovered_keys):
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
            ((path, value) for path, value in texts if is_primary_paper(path)),
            texts[0],
        )
        listening_source_path, listening_primary = next(
            (
                (path, value) for path, value in reversed(texts)
                if re.search(r'Listening Comprehension', value, re.I)
                and ('考试版' in path.name or '解析' not in path.name)
            ),
            (source_path, primary),
        )
        if year == 2023:
            listening_primary = read_textutil_document(listening_source_path) or listening_primary
        primary = normalize_primary_document(session, year, primary)
        listening_primary = normalize_primary_document(session, year, listening_primary)
        combined = '\n'.join(normalize_primary_document(session, year, value) for _, value in texts)
        answers = extract_answer_map(combined)
        for number, answer in extract_contextual_answer_map(combined).items():
            answers.setdefault(number, answer)
        for number, answer in extract_vocabulary_answer_map(combined).items():
            answers.setdefault(number, answer)
        answers.update(extract_grouped_listening_answer_map(combined))
        answers.update(extract_inline_listening_answer_map(combined))
        text_answers = extract_listening_text_answers(combined, 1, 30)
        if session == 'autumn' and year in {2011, 2012, 2014, 2015}:
            text_answers.update(extract_numbered_short_answer_map(combined, 17, 24))
        reading_text_answers = extract_reference_text_answers(combined, 67, 120)
        explicit_transcripts = [read_document(path) for path in transcript_docs.get(key, [])]
        supporting_text = '\n'.join([combined, *explicit_transcripts])
        supporting_answers = extract_answer_map(supporting_text)
        for number, answer in supporting_answers.items():
            answers.setdefault(number, answer)
        if session == 'spring' and year == 2021 and explicit_transcripts:
            for number in range(1, 21):
                if number in supporting_answers:
                    answers[number] = supporting_answers[number]
        transcript = extract_explicit_transcript(explicit_transcripts)
        if not transcript:
            transcript = extract_transcript([value for _, value in texts])
        if re.search(r'【\s*(?:答案|解析|分析|点评)\s*】', transcript):
            transcript = ''
        grammar_cloze, grammar_cloze_report = build_grammar_cloze_reading_item(session, year, primary, supporting_text, source_path.name)
        vocabulary_cloze, vocabulary_cloze_report = build_vocabulary_cloze_item(session, year, primary, source_path.name, answers)
        readings, reading_report = build_reading_items(session, year, primary, source_path.name, answers, reading_text_answers)
        if session == 'autumn' and year == 2015:
            reading_images = prepare_reading_images(source_path, session, year)
            image_item = next((item for item in readings if item.get('section') == 'BB'), None)
            if image_item and reading_images:
                image_item['images'] = reading_images
        if session == 'autumn' and year == 2012:
            reading_images = prepare_reading_images(source_path, session, year)
            image_item = next((item for item in readings if item.get('section') == 'BB'), None)
            if image_item and len(reading_images) >= 2:
                image_item['images'] = reading_images[:2]
        if session == 'autumn' and year == 2011:
            reading_images = prepare_reading_images(source_path, session, year)
            image_item = next((item for item in readings if item.get('section') == 'BB'), None)
            if image_item and reading_images:
                image_item['images'] = reading_images[:1]
        if session == 'autumn' and year == 2014:
            reading_images = prepare_reading_images(source_path, session, year)
            ba_item = next((item for item in readings if item.get('section') == 'BA'), None)
            bb_item = next((item for item in readings if item.get('section') == 'BB'), None)
            if ba_item and reading_images:
                ba_item['images'] = reading_images[:1]
            if bb_item and len(reading_images) >= 3:
                bb_item['images'] = reading_images[1:3]
        if session == 'autumn' and year == 2016:
            reading_images = prepare_reading_images(source_path, session, year)
            image_item = next((item for item in readings if item.get('section') == 'BB'), None)
            if image_item and reading_images:
                image_item['images'] = reading_images
        if session == 'spring' and year == 2017:
            reading_images = prepare_reading_images(source_path, session, year)
            ba_item = next((item for item in readings if item.get('section') == 'BA'), None)
            bb_item = next((item for item in readings if item.get('section') == 'BB'), None)
            image_question = next((question for question in (ba_item or {}).get('questions', []) if question.get('number') == 57), None)
            if image_question and len(reading_images) >= 4:
                image_question['optionImages'] = {
                    key: {**image, 'alt': f'57 题选项 {key}'}
                    for key, image in zip('ABCD', reading_images[:4])
                }
            if bb_item and len(reading_images) >= 5:
                bb_item['images'] = [reading_images[4]]
        if vocabulary_cloze:
            readings.insert(0, vocabulary_cloze)
        if grammar_cloze:
            readings.insert(0, grammar_cloze)
        readings = [structure_reading_item(item)[0] for item in readings]
        summary_writing, summary_writing_report = build_summary_writing_item(session, year, primary, source_path)
        translation, translation_report = build_translation_item(session, year, primary, source_path.name, supporting_text)
        writing, writing_report = build_writing_item(session, year, primary, source_path)
        grammar, grammar_report = build_grammar_questions(session, year, primary, source_path.name, answers)
        listening, listening_report = build_listening_item(
            session, year, listening_primary, listening_source_path.name, answers, text_answers, transcript,
            audios.get(key), args.apply_audio,
        )
        outputs[session]['reading'].extend(readings)
        outputs[session]['grammar'].extend(grammar)
        if summary_writing:
            outputs[session]['writing'].append(summary_writing)
            if translation:
                translation['paperOrder'] = 2
                translation['title'] = f'{year} 上海高考{SESSIONS[session]["label"]} V. Translation'
            if writing:
                writing['paperOrder'] = 3
                writing['title'] = f'{year} 上海高考{SESSIONS[session]["label"]} VI. Guided Writing'
        if year >= 2017:
            if translation:
                translation['title'] = f'{year} 上海高考{SESSIONS[session]["label"]} V. Translation'
            if writing:
                writing['title'] = f'{year} 上海高考{SESSIONS[session]["label"]} VI. Guided Writing'
        elif session == 'autumn' and 2012 <= year <= 2016 and writing:
            writing['title'] = f'{year} 上海高考{SESSIONS[session]["label"]} II. Guided Writing'
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
            'normalizationCorrections': normalization_corrections(session, year),
            'answerCount': len(answers),
            'reading': reading_report,
            'grammarCloze': grammar_cloze_report,
            'vocabularyCloze': vocabulary_cloze_report,
            'writing': writing_report,
            'summaryWriting': summary_writing_report,
            'translation': translation_report,
            'grammar': grammar_report,
            'listening': listening_report,
        })
    target_sessions = selected_sessions or set(SESSIONS)
    for session in target_sessions:
        content = outputs[session]
        reading_path = ROOT / 'data' / f'reading-senior-{session}' / 'reading-passages.json'
        writing_path = ROOT / 'data' / f'writing-senior-{session}' / 'writing-prompts.json'
        listening_path = ROOT / 'data' / f'listening-senior-{session}' / 'listening-practice.json'
        dump_json(reading_path, merge_selected_year_items(reading_path, content['reading'], selected_years))
        dump_json(writing_path, merge_selected_year_items(writing_path, content['writing'], selected_years))
        dump_json(listening_path, merge_selected_year_items(listening_path, content['listening'], selected_years))
        grammar_years = sorted({int(question['year']) for question in content['grammar']})
        if selected_years:
            for grammar_year in grammar_years:
                build_grammar_files(session, [question for question in content['grammar'] if int(question['year']) == grammar_year], grammar_year)
        else:
            build_grammar_files(session, content['grammar'])
    summary = {
        session: {key: len(value) for key, value in content.items()}
        for session, content in outputs.items()
    }
    report_path = IMPORT_DIR / 'clean-report.json'
    retained_reports = []
    if selected_years and report_path.exists():
        previous_report = json.loads(report_path.read_text(encoding='utf-8'))
        retained_reports = [
            report for report in previous_report.get('papers', [])
            if int(report.get('year') or 0) not in selected_years
            or (selected_sessions and report.get('session') not in selected_sessions)
        ]
    reports = sorted(retained_reports + all_reports, key=lambda report: (report.get('session', ''), int(report.get('year') or 0)))
    dump_json(report_path, {'summary': summary, 'papers': reports})
    print(json.dumps({'mode': 'apply-audio' if args.apply_audio else 'dry-run', 'summary': summary}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
