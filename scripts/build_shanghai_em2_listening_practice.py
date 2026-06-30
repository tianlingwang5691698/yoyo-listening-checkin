#!/usr/bin/env python3
import json
import re
import zipfile
from pathlib import Path

from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph

from build_shanghai_em1_reading_upload import DISTRICTS, clean

ROOTS = [
    Path('/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/二模（12年无音频）'),
    Path('/Users/wangtianlong/工作/未命名文件夹/7. 2025年上海二模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/9.2026年上海二模'),
]
OUT_DIR = Path('data/listening-em2')
IMAGE_DIR = OUT_DIR / 'images'
PRACTICE_OUT = OUT_DIR / 'listening-practice.json'
INDEX_OUT = Path('data/material-index.js')
INDEX_JSON_OUT = Path('data/material-index.json')


def year_of(path):
    m = re.search(r'(20\d{2}|201\d)', str(path))
    return int(m.group(1)) if m else None


def district_of(path):
    s = str(path)
    for d in DISTRICTS:
        if d in s:
            return {'浦东新区': '浦东', '黄埔': '黄浦'}.get(d, d)
    return ''


def iter_docx_text(path):
    doc = Document(path)
    texts = []
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            text = clean(Paragraph(child, doc).text)
            if text:
                texts.append(text)
        elif isinstance(child, CT_Tbl):
            for row in Table(child, doc).rows:
                cells = [clean(cell.text) for cell in row.cells if clean(cell.text)]
                if cells:
                    texts.append(' '.join(cells))
    return '\n'.join(texts)


def read_text(path):
    if path.suffix.lower() == '.docx':
        try:
            return iter_docx_text(path)
        except Exception:
            return ''
    if path.suffix.lower() == '.txt':
        return path.read_text(encoding='utf-8', errors='ignore')
    return ''


def candidate_text_files():
    files = []
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if path.name.startswith('~$') or not path.is_file():
                continue
            low = path.suffix.lower()
            s = str(path)
            if low in {'.docx', '.txt'} and '英语' in s and ('二模' in s or '听力' in s):
                if any(bad in s for bad in ['答案纸', '答题纸', '答题卡']):
                    continue
                files.append(path)
    for path in Path('data/imports').glob('shanghai-em2-*/work/*.txt'):
        files.append(path)
    return sorted(files)


def score_text_source(path, text):
    score = 0
    s = str(path)
    if '原卷' in s or '真题卷' in s or '试卷' in s:
        score += 20
    if '解析' in s:
        score += 5
    if '听力文本' in s or '听力文字' in s or '参考答案' in s:
        score -= 20
    if 'Part 1' in text and 'Listening' in text:
        score += 20
    if re.search(r'6\.\s*A[).．]', text):
        score += 10
    if re.search(r'16\.\s*.+_{3,}', text):
        score += 10
    return score


def split_listening(text):
    start = re.search(r'Part\s*1\s+Listening|Listening Comprehension|Listening comprehension', text, re.I)
    if not start:
        return ''
    end = re.search(r'Part\s*2|Grammar and Vocabulary|Vocabulary and Grammar|第二部分', text[start.start():], re.I)
    if end:
        return text[start.start():start.start() + end.start()]
    return text[start.start():]


def option_map(line):
    opts = {}
    for key, value in re.findall(r'([A-D])[\).．]\s*(.*?)(?=\s+[A-D][\).．]\s*|$)', clean(line)):
        value = clean(value)
        if value:
            opts[key] = value
    return opts


def parse_choice(lines):
    questions = []
    current = None
    for line in lines:
        m = re.match(r'^(\d{1,2})[\.．]\s*(.+)', line)
        if m and 6 <= int(m.group(1)) <= 10:
            if current:
                questions.append(current)
            num = int(m.group(1))
            current = {'number': num, 'prompt': 'Listen and choose the best answer.', 'questionType': 'choice', 'options': {}, 'answer': ''}
            opts = option_map(line)
            current['options'].update(opts)
            continue
        if current:
            opts = option_map(line)
            if opts:
                current['options'].update(opts)
    if current:
        questions.append(current)
    return [q for q in questions if len(q['options']) >= 4]


def parse_true_false(lines):
    questions = []
    for line in lines:
        m = re.match(r'^(1[1-5])[\.．]\s*(.+)', line)
        if m:
            questions.append({
                'number': int(m.group(1)),
                'prompt': clean(m.group(2)),
                'questionType': 'truefalse',
                'options': {'T': 'T', 'F': 'F'},
                'answer': ''
            })
    return questions


def parse_blanks(lines):
    questions = []
    for line in lines:
        m = re.match(r'^(1[6-9]|20)[\.．]\s*(.+)', line)
        if m and re.search(r'_{3,}|__+', m.group(2)):
            questions.append({
                'number': int(m.group(1)),
                'prompt': clean(m.group(2)),
                'questionType': 'blank',
                'answer': ''
            })
    return questions


def extract_docx_images(path, item_id):
    if path.suffix.lower() != '.docx':
        return []
    out = []
    try:
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if n.startswith('word/media/')]
            for idx, name in enumerate(names[:12], 1):
                ext = Path(name).suffix.lower() or '.png'
                if ext not in {'.png', '.jpg', '.jpeg', '.gif'}:
                    continue
                IMAGE_DIR.mkdir(parents=True, exist_ok=True)
                out_path = IMAGE_DIR / f'{item_id}-image-{idx}{ext}'
                out_path.write_bytes(zf.read(name))
                out.append({
                    'localPath': str(out_path),
                    'cloudPath': f'_content/listening-em2/images/{out_path.name}'
                })
    except Exception:
        return []
    return out


def parse_questions(text):
    sec = split_listening(text)
    if not sec:
        return []
    lines = [clean(x) for x in sec.splitlines() if clean(x)]
    questions = []
    questions.extend(parse_choice(lines))
    questions.extend(parse_true_false(lines))
    questions.extend(parse_blanks(lines))
    return sorted(questions, key=lambda x: x['number'])


def picture_questions():
    return [{
        'number': number,
        'prompt': 'Listen and choose the right picture.',
        'questionType': 'picture',
        'answer': ''
    } for number in range(1, 6)]


def best_sources():
    best = {}
    for path in candidate_text_files():
        year = year_of(path)
        district = district_of(path)
        if not year or not district:
            continue
        text = read_text(path)
        questions = parse_questions(text)
        if len(questions) < 10:
            continue
        key = (year, district)
        score = score_text_source(path, text) + len(questions)
        old = best.get(key)
        if not old or score > old['score']:
            best[key] = {'path': path, 'text': text, 'questions': questions, 'score': score}
    return best


def main():
    sets = json.load(open(OUT_DIR / 'listening-sets.json', encoding='utf-8'))
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for stale in IMAGE_DIR.glob('*'):
        if stale.is_file():
            stale.unlink()
    sources = best_sources()
    items = []
    for item in sets:
        key = (item.get('year'), item.get('district'))
        source = sources.get(key)
        if not source:
            continue
        next_item = dict(item)
        next_item['questions'] = source['questions']
        next_item['questionSourceFile'] = source['path'].name
        next_item['images'] = extract_docx_images(source['path'], next_item['_id'])
        next_item['hasPictureQuestions'] = bool(next_item['images'])
        if next_item['hasPictureQuestions']:
            existing = {q['number'] for q in next_item['questions']}
            next_item['questions'] = picture_questions() + [q for q in next_item['questions'] if q['number'] not in existing or q['number'] > 5]
        if next_item['hasPictureQuestions'] and len(next_item['questions']) == 20:
            items.append(next_item)
    used_images = {Path(image['localPath']).name for item in items for image in item.get('images', [])}
    for image_path in IMAGE_DIR.glob('*'):
        if image_path.is_file() and image_path.name not in used_images:
            image_path.unlink()
    PRACTICE_OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')

    material = json.load(open('data/material-index.json', encoding='utf-8'))
    slim = []
    for item in items:
        slim.append({
            '_id': item['_id'],
            'title': item['title'],
            'year': item['year'],
            'district': item['district'],
            'examType': item['examType'],
            'stage': item.get('stage', '初中'),
            'audioCloudPath': item.get('audioCloudPath', ''),
            'transcript': item.get('transcript', ''),
            'hasAudio': item.get('hasAudio', False),
            'hasTranscript': item.get('hasTranscript', False),
            'questionSourceFile': item.get('questionSourceFile', ''),
            'images': item.get('images', []),
            'questions': item.get('questions', [])
        })
    material['listeningEm2'] = slim
    INDEX_JSON_OUT.write_text(json.dumps(material, ensure_ascii=False, indent=2), encoding='utf-8')
    INDEX_OUT.write_text('module.exports = ' + json.dumps(material, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(json.dumps({
        'practiceSets': len(items),
        'withImages': sum(1 for x in items if x.get('images')),
        'out': str(PRACTICE_OUT)
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
