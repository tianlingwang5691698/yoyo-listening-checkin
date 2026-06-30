#!/usr/bin/env python3
import json
import re
from pathlib import Path


SOURCES = [
    Path('data/imports/shanghai-em2-2012-2021/formal/grammar-choice.formal.json'),
    Path('data/imports/shanghai-em2/formal/grammar-choice.formal.json'),
    Path('data/imports/shanghai-em2-2024/formal/grammar-choice.formal.json'),
    Path('data/imports/shanghai-em2-2025/formal/grammar-choice.formal.json'),
    Path('data/imports/shanghai-em2-2026/formal/grammar-choice.formal.json'),
]
OUT = Path('data/grammar')


TOPICS = [
    ('article', '冠词', [' a ', ' an ', ' the ', ' / ', 'college', 'university']),
    ('preposition', '介词', [' in ', ' on ', ' at ', ' for ', ' of ', 'with', 'from', 'to ', 'among', 'between', 'by ']),
    ('pronoun', '代词', [' he ', 'him', 'his', 'himself', 'they', 'them', 'their', 'themselves', 'itself', 'one', 'oneself', 'both', 'all', 'either', 'neither', 'another', 'other']),
    ('noun', '名词', ['advice', 'information', 'suggestion', 'method', 'number of', 'amount of']),
    ('adjective-adverb', '形容词副词', ['as ', 'than', 'more', 'most', 'enough', 'too', 'look', 'sound', 'feel', 'seem']),
    ('verb-tense-voice', '时态语态', ['yesterday', 'last ', 'already', 'since', 'for years', 'at that time', 'before', 'will', 'was ', 'were ', 'has ', 'have ', 'had ', 'be done', 'is done', 'are done']),
    ('modal-verb', '情态动词', ['must', 'may', 'can', 'could', 'should', 'need', 'would', 'shall']),
    ('non-finite-verb', '非谓语动词', ['to do', 'doing', 'done', 'suggest', 'enjoy', 'finish', 'avoid', 'enable', 'allow', 'ask', 'tell', 'want']),
    ('conjunction-clause', '连词与从句', ['if', 'whether', 'when', 'while', 'because', 'although', 'unless', 'so that', 'even though', 'which', 'who', 'where', 'what', 'why', 'how']),
    ('sentence-pattern', '句型结构', ['what a', 'what an', 'how ', 'there be', 'not only', 'neither nor', 'so that', 'too to']),
    ('communicative', '情景交际', ['—', 'sorry', 'thanks', 'would you', 'could you', 'shall we', 'why not']),
]


def norm(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def option_text(q):
    return ' '.join(norm((q.get('options') or {}).get(k)) for k in ['A', 'B', 'C', 'D'])


def classify(q):
    prompt = f" {norm(q.get('prompt')).lower()} "
    opts = f" {option_text(q).lower()} "
    text = f"{prompt} {opts}"

    if re.search(r'\b(a|an|the|/)\b', opts) and len(set(re.findall(r'\b(a|an|the|/)\b', opts))) >= 3:
        return 'article'
    if re.search(r'\b(must|may|might|can|could|should|need|shall|would)\b', opts):
        return 'modal-verb'
    if re.search(r'\b(in|on|at|for|of|with|from|to|among|between|by|through|during)\b', opts) and re.search(r'\b(in|on|at|for|of|with|from|to|among|between|by|through|during)\b', prompt + opts):
        return 'preposition'
    if re.search(r'\b(he|him|his|himself|she|her|herself|they|them|their|themselves|we|us|our|ourselves|it|itself|both|all|either|neither|another|other|others)\b', opts):
        return 'pronoun'
    if re.search(r'\b(to\s+\w+|\w+ing|done|do)\b', opts) and re.search(r'\b(suggest|enjoy|finish|avoid|enable|allow|ask|tell|want|help|make|let|keep|practice)\b', text):
        return 'non-finite-verb'
    if re.search(r'\b(will|would|am|is|are|was|were|has|have|had|did|does|do)\b', opts) or re.search(r'\b(yesterday|last|since|already|before|at that time|now|next)\b', prompt):
        return 'verb-tense-voice'
    if re.search(r'\b(if|whether|when|while|because|although|unless|so that|even though|which|who|where|what|why|how)\b', opts + prompt):
        return 'conjunction-clause'
    if re.search(r'\b(as|than|more|most|enough|too|friendly|fluently|politely|slowly|careful|relaxing)\b', text):
        return 'adjective-adverb'
    if re.search(r'\b(what|how|there|so|such)\b', opts + prompt):
        return 'sentence-pattern'
    if re.search(r'\b(advice|information|suggestion|method|prize|money|number|amount)\b', text):
        return 'noun'
    if re.search(r'\b(sorry|thanks|please|would you|could you|shall we|why not)\b', text):
        return 'communicative'
    return 'other'


def topic_label(topic_id):
    return dict((tid, label) for tid, label, _ in TOPICS).get(topic_id, '综合辨析')


def load_items():
    items = []
    seen = set()
    for source in SOURCES:
        if not source.exists():
            continue
        for paper in json.loads(source.read_text(encoding='utf-8')):
            if paper.get('_id') in seen:
                continue
            seen.add(paper.get('_id'))
            for q in paper.get('questions') or []:
                topic = classify(q)
                items.append({
                    '_id': f"{paper['_id']}-q{q['number']}",
                    'sourceSetId': paper['_id'],
                    'year': paper.get('year'),
                    'city': paper.get('city'),
                    'district': paper.get('district'),
                    'examType': paper.get('examType'),
                    'sourceFile': paper.get('sourceFile'),
                    'number': q.get('number'),
                    'prompt': norm(q.get('prompt')),
                    'options': q.get('options') or {},
                    'answer': q.get('answer'),
                    'topicId': topic,
                    'topic': topic_label(topic),
                    'stage': '初中',
                    'questionType': 'grammar-choice'
                })
    return items


def main():
    deduped = {}
    for item in load_items():
        deduped.setdefault(item['_id'], item)
    items = list(deduped.values())
    groups = []
    topic_ids = [x[0] for x in TOPICS] + ['other']
    for topic_id in topic_ids:
        qs = [x for x in items if x['topicId'] == topic_id]
        if qs:
            groups.append({
                'topicId': topic_id,
                'topic': topic_label(topic_id),
                'count': len(qs),
                'questions': qs
            })
    topic_types = [{'topicId': g['topicId'], 'topic': g['topic'], 'count': g['count']} for g in groups]
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = {
        'shanghai-em2-grammar-questions': items,
        'shanghai-em2-grammar-by-topic': groups,
        'grammar-topic-types': topic_types,
    }
    for name, payload in outputs.items():
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        (OUT / f'{name}.json').write_text(text, encoding='utf-8')
        (OUT / f'{name}.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    (OUT / 'README.md').write_text('# 语法模块数据\n\n本目录为上海中考二模语法单选正式题库，按初中考点分类。\n', encoding='utf-8')
    print(json.dumps({
        'questions': len(items),
        'topics': topic_types,
        'outDir': str(OUT)
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
