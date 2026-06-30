#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path


QUESTIONS = Path('data/grammar/shanghai-em2-grammar-questions.json')
OUT = Path('data/grammar')
PROGRESS = OUT / 'gpt-classification-progress.json'
BATCH_SIZE = int(os.environ.get('GRAMMAR_CLASSIFY_BATCH_SIZE') or 20)

TOPICS = [
    ('article', '冠词'),
    ('noun', '名词'),
    ('pronoun', '代词'),
    ('numeral', '数词'),
    ('preposition', '介词'),
    ('adjective-adverb', '形容词副词'),
    ('verb-tense-voice', '时态语态'),
    ('modal-verb', '情态动词'),
    ('non-finite-verb', '非谓语动词'),
    ('conjunction-clause', '连词与从句'),
    ('sentence-pattern', '句型结构'),
    ('communicative', '情景交际'),
    ('word-phrase', '词义与短语辨析'),
    ('other', '综合辨析'),
]


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


def post_json(url, key, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode('utf-8'))


def post_json_with_retry(url, key, payload):
    last_error = None
    for attempt in range(4):
        try:
            return post_json(url, key, payload)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            wait = 2 + attempt * 4
            print(f'retry {attempt + 1}/4 after error: {error}', file=sys.stderr, flush=True)
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


def classify_batch(url, key, model_name, batch):
    topic_lines = '\n'.join(f'- {topic_id}: {label}' for topic_id, label in TOPICS)
    payload_items = [{
        'id': item['_id'],
        'prompt': item.get('prompt', ''),
        'options': item.get('options') or {},
        'answer': item.get('answer', ''),
    } for item in batch]
    prompt = '\n'.join([
        '你是上海中考英语语法教研老师。请把每道单选题按主要考点分类。',
        '只能使用下面 topicId，不要自创分类：',
        topic_lines,
        '返回 JSON，不要 Markdown。格式：{"items":[{"id":"","topicId":"","topic":"","reason":""}]}',
        '分类原则：按这题真正考查点，不按选项表面词乱分；语音题不作为语法考点，归 other；词组/动词短语/词义辨析归 word-phrase。',
        json.dumps(payload_items, ensure_ascii=False),
    ])
    response = post_json_with_retry(url, key, {
        'model': model_name,
        'temperature': 0,
        'messages': [{'role': 'user', 'content': prompt}],
    })
    parsed = parse_json_text(message_text(response))
    return parsed.get('items') or []


def write_outputs(items):
    label_by_id = dict(TOPICS)
    groups = []
    for topic_id, label in TOPICS:
        qs = [item for item in items if item.get('topicId') == topic_id]
        if qs:
            groups.append({
                'topicId': topic_id,
                'topic': label,
                'count': len(qs),
                'questions': qs,
            })
    topic_types = [{'topicId': g['topicId'], 'topic': g['topic'], 'count': g['count']} for g in groups]
    for name, payload in {
        'shanghai-em2-grammar-questions': items,
        'shanghai-em2-grammar-by-topic': groups,
        'grammar-topic-types': topic_types,
    }.items():
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        (OUT / f'{name}.json').write_text(text, encoding='utf-8')
        (OUT / f'{name}.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    return topic_types


def load_progress():
    if not PROGRESS.exists():
        return {}
    try:
        return json.loads(PROGRESS.read_text(encoding='utf-8'))
    except Exception:
        return {}


def save_progress(progress):
    PROGRESS.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    url = endpoint()
    key = api_key()
    if not url or not key:
        print('missing endpoint/api key: set GRAMMAR_EXPLAIN_ENDPOINT and GRAMMAR_EXPLAIN_API_KEY', file=sys.stderr)
        sys.exit(2)
    items = json.loads(QUESTIONS.read_text(encoding='utf-8'))
    by_id = {item['_id']: item for item in items}
    label_by_id = dict(TOPICS)
    progress = load_progress()
    completed = progress.get('completed') or {}
    for rows in completed.values():
        for row in rows:
            item = by_id.get(row.get('id'))
            topic_id = row.get('topicId')
            if item and topic_id in label_by_id:
                item['topicId'] = topic_id
                item['topic'] = label_by_id[topic_id]
                item['topicReason'] = str(row.get('reason') or '').strip()
    total = len(items)
    for start in range(0, total, BATCH_SIZE):
        batch_key = str(start)
        batch = items[start:start + BATCH_SIZE]
        if batch_key in completed:
            print(f'skip {min(start + BATCH_SIZE, total)}/{total}', flush=True)
            continue
        result = classify_batch(url, key, model(), batch)
        for row in result:
            item = by_id.get(row.get('id'))
            topic_id = row.get('topicId')
            if item and topic_id in label_by_id:
                item['topicId'] = topic_id
                item['topic'] = label_by_id[topic_id]
                item['topicReason'] = str(row.get('reason') or '').strip()
        completed[batch_key] = result
        progress['completed'] = completed
        save_progress(progress)
        print(f'classified {min(start + BATCH_SIZE, total)}/{total}', flush=True)
        time.sleep(0.2)
    topic_types = write_outputs(items)
    print(json.dumps({'questions': len(items), 'topics': topic_types}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
