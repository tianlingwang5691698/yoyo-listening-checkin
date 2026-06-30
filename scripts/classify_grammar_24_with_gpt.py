#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


OUT = Path('data/grammar')
QUESTIONS = OUT / 'shanghai-em2-grammar-questions.json'
TYPES = OUT / 'grammar-topic-types.json'
PROGRESS = OUT / 'gpt-classification-24-progress.json'
BATCH_SIZE = int(os.environ.get('GRAMMAR_BATCH_SIZE', '20'))
START_AT = int(os.environ.get('GRAMMAR_START_AT', '0'))


LEGACY_TOPIC = {
    '冠词': ('article', '冠词'),
    '名词': ('noun', '名词'),
    '代词': ('pronoun', '代词'),
    '数词': ('numeral', '数词'),
    '介词': ('preposition', '介词'),
    '形容词副词': ('adjective-adverb', '形容词副词'),
    '词义与短语辨析': ('word-phrase', '词义与短语辨析'),
    '时态': ('verb-tense-voice', '时态语态'),
    '语态': ('verb-tense-voice', '时态语态'),
    '情态动词': ('modal-verb', '情态动词'),
    '非谓语': ('non-finite-verb', '非谓语动词'),
    '主谓一致': ('verb-agreement', '主谓一致'),
    '宾语从句': ('conjunction-clause', '连词与从句'),
    '状语从句': ('conjunction-clause', '连词与从句'),
    '定语从句': ('conjunction-clause', '连词与从句'),
    '固定句型': ('sentence-pattern', '句型结构'),
    '感叹句': ('sentence-pattern', '句型结构'),
    '反意疑问句': ('sentence-pattern', '句型结构'),
    '倒装': ('sentence-pattern', '句型结构'),
    '并列': ('conjunction-clause', '连词与从句'),
    '转折': ('conjunction-clause', '连词与从句'),
    '原因': ('conjunction-clause', '连词与从句'),
    '条件': ('conjunction-clause', '连词与从句'),
    '时间': ('conjunction-clause', '连词与从句'),
    '让步': ('conjunction-clause', '连词与从句'),
    '日常口语表达': ('communicative', '情景交际'),
}


def env(name):
    return os.environ.get(name, '').strip()


def endpoint():
    return env('GRAMMAR_EXPLAIN_ENDPOINT') or env('READING_STUDY_ENDPOINT') or env('SPEAKING_SCORE_ENDPOINT')


def api_key():
    return env('GRAMMAR_EXPLAIN_API_KEY') or env('READING_STUDY_API_KEY') or env('SPEAKING_SCORE_API_KEY')


def model():
    return env('GRAMMAR_EXPLAIN_MODEL') or env('READING_STUDY_MODEL') or 'gpt-5.5'


def parse_json_text(text):
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            raise
        return json.loads(match.group(0))


def parse_items_text(text):
    try:
        return parse_json_text(text).get('items') or []
    except Exception:
        matches = re.findall(r'\{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*"subtopicId"\s*:\s*"[^"]+"[^{}]*\}', text)
        items = []
        for match in matches:
            try:
                items.append(json.loads(match))
            except Exception:
                continue
        if items:
            return items
        raise


def post_json(url, key, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode('utf-8'))


def post_json_with_retry(url, key, payload):
    last_error = None
    for attempt in range(8):
        try:
            return post_json(url, key, payload)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            wait = min(60, 3 * (attempt + 1))
            print(f'retry {attempt + 1}/8 after error: {error}; wait {wait}s', file=sys.stderr, flush=True)
            time.sleep(wait)
    raise last_error


def message_text(response):
    if isinstance(response.get('output_text'), str):
        return response['output_text']
    choices = response.get('choices') or []
    if choices:
        content = (choices[0].get('message') or {}).get('content')
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return '\n'.join(str(x.get('text') or x.get('content') or '') for x in content)
    return ''


def load_taxonomy():
    groups = json.loads(TYPES.read_text(encoding='utf-8'))
    rows = []
    for group in groups:
        for child in group.get('children') or []:
            rows.append({
                'categoryId': group['topicId'],
                'category': group['topic'],
                'subtopicId': child['topicId'],
                'subtopic': child['topic'],
            })
    return rows


def classify_batch(url, key, model_name, batch, taxonomy):
    allowed = '\n'.join(
        f"- {row['subtopicId']}: {row['category']} / {row['subtopic']}"
        for row in taxonomy
    )
    payload_items = [{
        'id': item['_id'],
        'prompt': item.get('prompt', ''),
        'options': item.get('options') or {},
        'answer': item.get('answer', ''),
    } for item in batch]
    prompt = '\n'.join([
        '你是上海中考英语语法教研老师。请把每道单选题直接归入一个细分考点。',
        '只能使用下面 subtopicId，不要自创分类：',
        allowed,
        '返回 JSON，不要 Markdown。格式：{"items":[{"id":"","subtopicId":"","reason":""}]}',
        '分类原则：按真正考查点分类，不按选项表面词乱分；优先判断学生答题时必须掌握的语法点；词组、动词短语、词义辨析归“词义与短语辨析”；交际问答归“日常口语表达”。',
        json.dumps(payload_items, ensure_ascii=False),
    ])
    response = post_json_with_retry(url, key, {
        'model': model_name,
        'temperature': 0,
        'messages': [{'role': 'user', 'content': prompt}],
    })
    return parse_items_text(message_text(response))


def load_progress():
    if not PROGRESS.exists():
        return {}
    try:
        return json.loads(PROGRESS.read_text(encoding='utf-8'))
    except Exception:
        return {}


def save_progress(progress):
    PROGRESS.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding='utf-8')


def apply_classification(items, rows, taxonomy_by_id):
    by_id = {item['_id']: item for item in items}
    for row in rows:
        item = by_id.get(row.get('id'))
        meta = taxonomy_by_id.get(row.get('subtopicId'))
        if not item or not meta:
            continue
        item['categoryId'] = meta['categoryId']
        item['category'] = meta['category']
        item['subtopicId'] = meta['subtopicId']
        item['subtopic'] = meta['subtopic']
        item['topicId'], item['topic'] = LEGACY_TOPIC.get(meta['subtopic'], (meta['subtopicId'], meta['subtopic']))
        item['topicReason'] = str(row.get('reason') or '').strip()


def write_outputs(items, taxonomy):
    groups = []
    topic_types = []
    category_order = []
    for row in taxonomy:
        if row['categoryId'] not in category_order:
            category_order.append(row['categoryId'])

    for category_id in category_order:
        cat_rows = [row for row in taxonomy if row['categoryId'] == category_id]
        category = cat_rows[0]['category']
        category_questions = [q for q in items if q.get('categoryId') == category_id]
        children = []
        for row in cat_rows:
            qs = [q for q in items if q.get('subtopicId') == row['subtopicId']]
            if not qs:
                continue
            children.append({'topicId': row['subtopicId'], 'topic': row['subtopic'], 'count': len(qs)})
            groups.append({
                'topicId': row['subtopicId'],
                'topic': row['subtopic'],
                'categoryId': category_id,
                'category': category,
                'count': len(qs),
                'questions': qs,
            })
        topic_types.append({
            'topicId': category_id,
            'topic': category,
            'count': len(category_questions),
            'children': children,
            'questions': category_questions,
        })

    for name, payload in {
        'shanghai-em2-grammar-questions': items,
        'shanghai-em2-grammar-by-topic': groups,
        'grammar-topic-types': topic_types,
    }.items():
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        (OUT / f'{name}.json').write_text(text, encoding='utf-8')
        (OUT / f'{name}.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    return topic_types


def main():
    url = endpoint()
    key = api_key()
    if not url or not key:
        print('missing endpoint/api key: set GRAMMAR_EXPLAIN_ENDPOINT and GRAMMAR_EXPLAIN_API_KEY', file=sys.stderr)
        sys.exit(2)

    taxonomy = load_taxonomy()
    taxonomy_by_id = {row['subtopicId']: row for row in taxonomy}
    items = json.loads(QUESTIONS.read_text(encoding='utf-8'))
    progress = load_progress()
    completed = progress.get('completed') or {}
    for rows in completed.values():
        apply_classification(items, rows, taxonomy_by_id)

    total = len(items)
    for start in range(START_AT, total, BATCH_SIZE):
        batch_key = str(start)
        if batch_key in completed:
            print(f'skip {min(start + BATCH_SIZE, total)}/{total}', flush=True)
            continue
        batch = items[start:start + BATCH_SIZE]
        result = classify_batch(url, key, model(), batch, taxonomy)
        apply_classification(items, result, taxonomy_by_id)
        completed[batch_key] = result
        progress['completed'] = completed
        save_progress(progress)
        print(f'classified {min(start + BATCH_SIZE, total)}/{total}', flush=True)
        time.sleep(0.2)

    topic_types = write_outputs(items, taxonomy)
    print(json.dumps({
        'questions': len(items),
        'categories': [{'topic': g['topic'], 'count': g['count'], 'children': g['children']} for g in topic_types],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
