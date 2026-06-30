#!/usr/bin/env python3
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

from docx import Document


ROOTS = [
    Path('/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/一模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/6. 2025年上海一模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/8.2026年上海一模'),
]
FORMAL_OUT = Path('data/imports/shanghai-em1-2014-2026/formal')
UPLOAD_OUT = Path('data/grammar-em1-upload')
DISTRICTS = ['黄浦', '黄埔', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '浦东', '浦东新区', '金山', '松江', '青浦', '奉贤', '崇明']

TOPICS = [
    ('verb', '动词类', ['时态', '语态', '情态动词', '非谓语', '主谓一致']),
    ('lexical', '词法类', ['名词', '冠词', '代词', '形容词副词', '介词', '数词', '词义与短语辨析']),
    ('clause', '从句类', ['宾语从句', '状语从句', '定语从句']),
    ('sentence', '句型结构类', ['固定句型', '感叹句', '反意疑问句', '倒装']),
    ('logic', '连词逻辑类', ['并列', '转折', '原因', '条件', '时间', '让步']),
    ('communicative', '情景交际类', ['日常口语表达']),
]


def norm(text):
    return re.sub(r'\s+', ' ', str(text or '').replace('\u3000', ' ')).strip()


def read_docx(path):
    doc = Document(path)
    parts = [p.text for p in doc.paragraphs if norm(p.text)]
    for table in doc.tables:
        for row in table.rows:
            cells = [norm(c.text) for c in row.cells if norm(c.text)]
            if cells:
                parts.append(' '.join(cells))
    return '\n'.join(parts)


def read_with_command(path, command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=60)
    return result.stdout


def read_text(path):
    suffix = path.suffix.lower()
    if suffix == '.docx':
        return read_docx(path)
    if suffix == '.doc':
        return read_with_command(path, ['textutil', '-convert', 'txt', '-stdout', str(path)])
    if suffix == '.pdf':
        return read_with_command(path, ['pdftotext', '-layout', str(path), '-'])
    return ''


def year_of(path):
    m = re.search(r'(20\d{2}|201\d)', str(path))
    return int(m.group(1)) if m else None


def district_of(path):
    text = str(path)
    for d in DISTRICTS:
        if d in text:
            return {'浦东新区': '浦东', '黄埔': '黄浦'}.get(d, d)
    return ''


def is_candidate(path):
    s = str(path)
    name = path.name
    if path.suffix.lower() not in {'.docx', '.doc', '.pdf'}:
        return False
    if any(x in s for x in ['语文', '数学', '物理', '化学', '道法', '历史', '跨学科', 'mp3', '答题卡']):
        return False
    if any(x in name for x in ['听力', '参考答案', '听力文本', '听力文字']):
        return False
    if '答案' in name and not any(x in name for x in ['试题', '试卷']):
        return False
    return '英语' in s and '一模' in s and year_of(path) in range(2014, 2027) and district_of(path)


def file_score(path):
    s = str(path)
    score = 0
    if path.suffix.lower() == '.docx':
        score += 30
    if '解析版' in s:
        score += 25
    if '官方' in s or '试卷' in s:
        score += 10
    if '原卷' in s:
        score -= 5
    if path.suffix.lower() == '.pdf':
        score -= 15
    return score


def collect_files():
    best = {}
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if not path.is_file() or not is_candidate(path):
                continue
            key = (year_of(path), district_of(path))
            if key not in best or file_score(path) > file_score(best[key]):
                best[key] = path
    return best


def answer_map(text):
    out = {}
    for start, end, answers in re.findall(r'(\d{1,2})\s*[-－—]\s*(\d{1,2})\s*([A-D]{2,})\b', text):
        start, end = int(start), int(end)
        if len(answers) == end - start + 1:
            for i, a in enumerate(answers):
                out[start + i] = a
    for num, ans in re.findall(r'(?:^|\s)(\d{1,2})\s*[\.．、]?\s*([A-D])\b', text):
        out[int(num)] = ans
    for num, ans in re.findall(r'【答案】\s*(\d{1,2})?\s*([A-D])\b', text):
        if num:
            out[int(num)] = ans
    return out


def split_options(text):
    opts = {}
    for key in ['A', 'B', 'C', 'D']:
        m = re.search(rf'(?:^|\s){key}[\)\.．、]\s*(.*?)(?=\s+[A-D][\)\.．、]\s*|$)', text)
        if m:
            opts[key] = norm(m.group(1))
    return opts


def grammar_window(text):
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    starts = list(re.finditer(r'(?:Ⅱ|II)\.?\s*Choose the best answer|Choose the best answer', text, re.I))
    start = None
    for item in starts:
        head = text[item.start():item.start() + 260].lower()
        if 'hear' not in head and '听到' not in head:
            start = item
            break
    if start is None and len(starts) > 1:
        start = starts[1]
    if not start:
        return ''
    tail = text[start.start():]
    end = re.search(r'(?:Ⅲ|III)\.?\s*Complete|Complete the following passage|Part\s*3|Reading and Writing', tail, re.I)
    return tail[:end.start()] if end else tail[:8000]


def parse_questions(text, answers):
    section = grammar_window(text)
    if not section:
        return []
    section = re.sub(r'【解析】[\s\S]*?(?=\n\s*\d{1,2}[\.．])', '\n', section)
    matches = list(re.finditer(r'(?:^|\n)\s*(\d{1,2})[\.．]\s+', section))
    questions = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        if num < 1 or num > 50:
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(section)
        block = norm(section[m.end():end])
        opts = split_options(block)
        if not all(opts.get(k) for k in ['A', 'B', 'C', 'D']):
            continue
        prompt = norm(re.split(r'\s+A[\.．、]\s*', block)[0])
        ans = answers.get(num)
        if not ans:
            dm = re.search(r'【答案】\s*([A-D])\b|故选([A-D])', block)
            ans = (dm.group(1) or dm.group(2)) if dm else ''
        questions.append({'number': num, 'prompt': prompt, 'options': opts, 'answer': ans or ''})
    return questions


def topic_for(q):
    text = (' ' + q['prompt'] + ' ' + ' '.join(q['options'].values()) + ' ').lower()
    opts = (' ' + ' '.join(q['options'].values()) + ' ').lower()
    if re.search(r'\b(a|an|the|/)\b', opts) and len(set(re.findall(r'\b(a|an|the|/)\b', opts))) >= 3:
        return 'lexical', '词法类', '冠词'
    if re.search(r'\b(must|may|might|can|could|should|need|shall|would)\b', opts):
        return 'verb', '动词类', '情态动词'
    if re.search(r'\b(in|on|at|for|of|with|from|to|among|between|by|through|during|without|against)\b', opts):
        return 'lexical', '词法类', '介词'
    if re.search(r'\b(he|him|his|himself|she|her|herself|they|them|their|themselves|we|us|our|it|itself|both|all|either|neither|another|other|others|one|ones)\b', opts):
        return 'lexical', '词法类', '代词'
    if re.search(r'\b(to\s+\w+|\w+ing|done|do)\b', opts) and re.search(r'\b(suggest|enjoy|finish|avoid|enable|allow|ask|tell|want|help|make|let|keep|practice|decide|learn|prefer)\b', text):
        return 'verb', '动词类', '非谓语'
    if re.search(r'\b(will|would|am|is|are|was|were|has|have|had|did|does|do|been|being)\b', opts) or re.search(r'\b(yesterday|last|since|already|before|at that time|now|next|so far)\b', text):
        if re.search(r'\b(is|are|was|were|be|been|being)\s+\w+ed\b|by\s+\w+', text):
            return 'verb', '动词类', '语态'
        return 'verb', '动词类', '时态'
    if re.search(r'\b(who|which|that|whose|where)\b', text):
        return 'clause', '从句类', '定语从句'
    if re.search(r'\b(what|whether|if|why|how|where|when)\b', text) and re.search(r'\b(know|tell|wonder|ask|said|think|believe)\b', text):
        return 'clause', '从句类', '宾语从句'
    if re.search(r'\b(because|since|as)\b', text):
        return 'logic', '连词逻辑类', '原因'
    if re.search(r'\b(if|unless)\b', text):
        return 'logic', '连词逻辑类', '条件'
    if re.search(r'\b(when|while|before|after|until|as soon as)\b', text):
        return 'logic', '连词逻辑类', '时间'
    if re.search(r'\b(although|though|even though)\b', text):
        return 'logic', '连词逻辑类', '让步'
    if re.search(r'\b(as|than|more|most|enough|too|friendly|fluently|politely|slowly|careful|relaxing)\b', text):
        return 'lexical', '词法类', '形容词副词'
    if re.search(r'\b(advice|information|suggestion|method|prize|money|number|amount)\b', text):
        return 'lexical', '词法类', '名词'
    if re.search(r'\b(what|how|there|so|such)\b', text):
        return 'sentence', '句型结构类', '感叹句' if re.search(r'\bwhat\b|\bhow\b', text) else '固定句型'
    if re.search(r'\b(sorry|thanks|please|would you|could you|shall we|why not)\b', text):
        return 'communicative', '情景交际类', '日常口语表达'
    return 'lexical', '词法类', '词义与短语辨析'


def main():
    selected = collect_files()
    papers, report = [], []
    for (year, district), path in sorted(selected.items()):
        try:
            text = read_text(path)
            answers = answer_map(text)
            questions = parse_questions(text, answers)
            ok = len(questions) >= 10 and all(q['answer'] in ['A', 'B', 'C', 'D'] for q in questions)
            report.append({'year': year, 'district': district, 'questions': len(questions), 'ok': ok, 'sourceFile': str(path)})
            if not ok:
                continue
            paper_id = f"sh-em1-{year}-{district.lower()}-grammar-choice"
            papers.append({
                '_id': paper_id,
                'title': f'{year} 上海{district}一模语法单选',
                'year': year,
                'city': '上海',
                'district': district,
                'examType': '一模',
                'sourceFile': path.name,
                'section': 'grammar-choice',
                'questionType': 'choice',
                'questions': questions,
            })
        except Exception as exc:
            report.append({'year': year, 'district': district, 'error': str(exc), 'sourceFile': str(path)})

    items = []
    for paper in papers:
        for q in paper['questions']:
            category_id, category, subtopic = topic_for(q)
            item = {
                '_id': f"{paper['_id']}-q{q['number']}",
                'sourceSetId': paper['_id'],
                'year': paper['year'],
                'city': '上海',
                'district': paper['district'],
                'examType': '一模',
                'sourceFile': paper['sourceFile'],
                'number': q['number'],
                'prompt': q['prompt'],
                'options': q['options'],
                'answer': q['answer'],
                'categoryId': category_id,
                'category': category,
                'subtopicId': f'{category_id}:{subtopic}',
                'subtopic': subtopic,
                'topicId': f'{category_id}:{subtopic}',
                'topic': subtopic,
                'stage': '初中',
                'questionType': 'grammar-choice',
            }
            items.append(item)

    groups, flat = [], []
    for category_id, category, preferred in TOPICS:
        qs = [q for q in items if q['categoryId'] == category_id]
        if not qs:
            continue
        children = []
        for sub in preferred:
            sub_qs = [q for q in qs if q['subtopic'] == sub]
            if sub_qs:
                topic_id = f'{category_id}:{sub}'
                children.append({'topicId': topic_id, 'topic': sub, 'count': len(sub_qs)})
                flat.append({'topicId': topic_id, 'topic': sub, 'categoryId': category_id, 'category': category, 'count': len(sub_qs), 'questions': sub_qs})
        groups.append({'topicId': category_id, 'topic': category, 'count': len(qs), 'children': children, 'questions': qs})

    FORMAL_OUT.mkdir(parents=True, exist_ok=True)
    UPLOAD_OUT.mkdir(parents=True, exist_ok=True)
    (UPLOAD_OUT / 'topics').mkdir(exist_ok=True)
    for stale in (UPLOAD_OUT / 'topics').glob('*.json'):
        stale.unlink()

    outputs = {
        FORMAL_OUT / 'grammar-choice.formal.json': papers,
        FORMAL_OUT / 'extract-report.json': report,
        UPLOAD_OUT / 'shanghai-em2-grammar-questions.json': items,
        UPLOAD_OUT / 'shanghai-em2-grammar-by-topic.json': flat,
        UPLOAD_OUT / 'grammar-topic-types.json': groups,
    }
    for path, payload in outputs.items():
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    for group in flat:
        name = hashlib.sha1(group['topicId'].encode('utf-8')).hexdigest() + '.json'
        (UPLOAD_OUT / 'topics' / name).write_text(json.dumps({'topicId': group['topicId'], 'topic': group['topic'], 'questions': group['questions']}, ensure_ascii=False, indent=2), encoding='utf-8')

    print(json.dumps({
        'papers': len(papers),
        'questions': len(items),
        'years': sorted({p['year'] for p in papers}),
        'rejected': len([r for r in report if not r.get('ok')]),
        'formalOut': str(FORMAL_OUT),
        'uploadOut': str(UPLOAD_OUT),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
