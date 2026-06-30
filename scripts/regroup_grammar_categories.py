#!/usr/bin/env python3
import json
import re
from pathlib import Path


OUT = Path('data/grammar')
QUESTIONS = OUT / 'shanghai-em2-grammar-questions.json'

CATEGORIES = [
    ('verb', '动词类', ['时态', '语态', '情态动词', '非谓语', '主谓一致']),
    ('lexical', '词法类', ['名词', '冠词', '代词', '形容词副词', '介词', '数词']),
    ('clause', '从句类', ['宾语从句', '状语从句', '定语从句']),
    ('sentence', '句型结构类', ['固定句型', '感叹句', '反意疑问句', '倒装']),
    ('logic', '连词逻辑类', ['并列', '转折', '原因', '条件', '时间', '让步']),
    ('communicative', '情景交际类', ['日常口语表达']),
]


def text_of(q):
    options = ' '.join(str((q.get('options') or {}).get(k, '')) for k in ['A', 'B', 'C', 'D'])
    return f"{q.get('prompt', '')} {options}".lower()


def subtopic(q):
    tid = q.get('topicId')
    text = text_of(q)
    if tid == 'verb-tense-voice':
        if re.search(r'\b(is|are|was|were|be|been|being)\s+\w+ed\b|by\s+\w+', text):
            return 'verb', '动词类', '语态'
        return 'verb', '动词类', '时态'
    if tid == 'modal-verb':
        return 'verb', '动词类', '情态动词'
    if tid == 'non-finite-verb':
        return 'verb', '动词类', '非谓语'
    if tid == 'noun':
        return 'lexical', '词法类', '名词'
    if tid == 'article':
        return 'lexical', '词法类', '冠词'
    if tid == 'pronoun':
        return 'lexical', '词法类', '代词'
    if tid == 'adjective-adverb':
        return 'lexical', '词法类', '形容词副词'
    if tid == 'preposition':
        return 'lexical', '词法类', '介词'
    if tid == 'numeral':
        return 'lexical', '词法类', '数词'
    if tid == 'conjunction-clause':
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
        if re.search(r'\b(but|however)\b', text):
            return 'logic', '连词逻辑类', '转折'
        if re.search(r'\b(and|or|nor|both|either|neither)\b', text):
            return 'logic', '连词逻辑类', '并列'
        return 'clause', '从句类', '状语从句'
    if tid == 'sentence-pattern':
        if re.search(r'\bwhat\b|\bhow\b', text):
            return 'sentence', '句型结构类', '感叹句'
        if re.search(r'\bisn.t|aren.t|doesn.t|didn.t|hasn.t|haven.t|will you|shall we\b', text):
            return 'sentence', '句型结构类', '反意疑问句'
        if re.search(r'\bneither|so\s+\w+\s+(i|he|she|they|we)\b', text):
            return 'sentence', '句型结构类', '倒装'
        return 'sentence', '句型结构类', '固定句型'
    if tid == 'communicative':
        return 'communicative', '情景交际类', '日常口语表达'
    if tid == 'word-phrase':
        return 'lexical', '词法类', '词义与短语辨析'
    return 'sentence', '句型结构类', '固定句型'


def main():
    questions = json.loads(QUESTIONS.read_text(encoding='utf-8'))
    for q in questions:
        category_id, category, sub = subtopic(q)
        q['categoryId'] = category_id
        q['category'] = category
        q['subtopicId'] = f"{category_id}:{sub}"
        q['subtopic'] = sub

    groups = []
    for category_id, category, preferred in CATEGORIES:
        category_questions = [q for q in questions if q.get('categoryId') == category_id]
        if not category_questions:
            continue
        subgroups = []
        for sub in preferred + sorted({q['subtopic'] for q in category_questions if q['subtopic'] not in preferred}):
            sub_questions = [q for q in category_questions if q.get('subtopic') == sub]
            if sub_questions:
                subgroups.append({
                    'topicId': f"{category_id}:{sub}",
                    'topic': sub,
                    'categoryId': category_id,
                    'category': category,
                    'count': len(sub_questions),
                    'questions': sub_questions,
                })
        groups.append({
            'topicId': category_id,
            'topic': category,
            'count': len(category_questions),
            'children': [{'topicId': g['topicId'], 'topic': g['topic'], 'count': g['count']} for g in subgroups],
            'questions': category_questions,
        })
    flat_groups = []
    for group in groups:
        for child in group['children']:
            flat_groups.append({
                'topicId': child['topicId'],
                'topic': child['topic'],
                'categoryId': group['topicId'],
                'category': group['topic'],
                'count': child['count'],
                'questions': [q for q in group['questions'] if q.get('subtopicId') == child['topicId']],
            })
    for name, payload in {
        'shanghai-em2-grammar-questions': questions,
        'shanghai-em2-grammar-by-topic': flat_groups,
        'grammar-topic-types': groups,
    }.items():
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        (OUT / f'{name}.json').write_text(text, encoding='utf-8')
        (OUT / f'{name}.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    print(json.dumps([{'topic': g['topic'], 'count': g['count'], 'children': g['children']} for g in groups], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
