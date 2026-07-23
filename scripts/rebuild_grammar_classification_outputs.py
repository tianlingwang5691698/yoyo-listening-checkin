#!/usr/bin/env python3
"""Safely rebuild grammar classification outputs without dropping frozen IDs."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from grammar_content_cleaning import (
    clean_question_source_watermarks,
    strip_source_watermarks,
)


ROOT = Path(__file__).resolve().parent.parent
TAXONOMY_PATH = ROOT / 'data/grammar/grammar-topic-taxonomy.json'
STEMS = (
    'shanghai-em2-grammar-questions',
    'shanghai-em2-grammar-by-topic',
    'grammar-topic-types',
)
TOP_CATEGORY_ORDER = (
    'verb',
    'lexical',
    'clause',
    'sentence',
    'logic',
    'communicative',
)
CLASSIFICATION_REMAP = {
    'phonetics:underlined-pronunciation': (
        'lexical', '词法类', 'lexical:phonetics-underlined-pronunciation', '语音辨析-划线发音'
    ),
    'phonetics:phonetic-symbol': (
        'lexical', '词法类', 'lexical:phonetics-symbol', '语音辨析-音标'
    ),
    'phonetics:intonation': (
        'lexical', '词法类', 'lexical:phonetics-intonation', '语音辨析-语调'
    ),
    'culture:common-knowledge': (
        'communicative', '情景交际类', 'communicative:culture-common-knowledge', '文化常识-其他'
    ),
    'other:manual-review': (
        'lexical', '词法类', 'lexical:manual-review', '其他-需人工复核'
    ),
}


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def head_json(relative_path, head_ref):
    result = subprocess.run(
        ['git', 'show', f'{head_ref}:{relative_path.as_posix()}'],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def merge_frozen_ids(current, frozen):
    current_by_id = {item['_id']: item for item in current}
    frozen_ids = {item['_id'] for item in frozen}
    restored = [item for item in frozen if item['_id'] not in current_by_id]
    merged = [current_by_id.get(item['_id'], item) for item in frozen]
    merged.extend(item for item in current if item['_id'] not in frozen_ids)
    return merged, restored


def normalize_top_categories(items, restored_ids):
    remapped = 0
    for item in items:
        if item['_id'] in restored_ids:
            continue
        target = CLASSIFICATION_REMAP.get(item.get('subtopicId'))
        if not target:
            continue
        category_id, category, subtopic_id, subtopic = target
        item['categoryId'] = category_id
        item['category'] = category
        item['subtopicId'] = subtopic_id
        item['subtopic'] = subtopic
        item['topicId'] = subtopic_id
        item['topic'] = subtopic
        remapped += 1
    return remapped


def taxonomy_rows(items):
    taxonomy = load_json(TAXONOMY_PATH)
    categories = {group['topicId']: group['topic'] for group in taxonomy}
    if tuple(group['topicId'] for group in taxonomy) != TOP_CATEGORY_ORDER:
        raise ValueError('taxonomy top categories must be exactly the configured six categories')

    rows = []
    known = set()
    for group in taxonomy:
        for child in group.get('children') or []:
            rows.append({
                'categoryId': group['topicId'],
                'category': group['topic'],
                'subtopicId': child['topicId'],
                'subtopic': child['topic'],
            })
            known.add(child['topicId'])

    # Frozen legacy records retain their original fields. Add their old fine-topic
    # IDs as compatibility children under the same one of the six top categories.
    for item in items:
        subtopic_id = item.get('subtopicId')
        category_id = item.get('categoryId')
        if subtopic_id in known:
            continue
        if category_id not in categories:
            raise ValueError(f"unsupported top category {category_id!r} for {item.get('_id')}")
        rows.append({
            'categoryId': category_id,
            'category': categories[category_id],
            'subtopicId': subtopic_id,
            'subtopic': item.get('subtopic') or item.get('topic') or subtopic_id,
        })
        known.add(subtopic_id)
    return taxonomy, rows


def build_outputs(items):
    taxonomy, rows = taxonomy_rows(items)
    groups = []
    topic_types = []
    for category in taxonomy:
        category_id = category['topicId']
        category_rows = [row for row in rows if row['categoryId'] == category_id]
        category_questions = [q for q in items if q.get('categoryId') == category_id]
        children = []
        for row in category_rows:
            questions = [q for q in items if q.get('subtopicId') == row['subtopicId']]
            if not questions:
                continue
            children.append({
                'topicId': row['subtopicId'],
                'topic': row['subtopic'],
                'count': len(questions),
            })
            groups.append({
                'topicId': row['subtopicId'],
                'topic': row['subtopic'],
                'categoryId': category_id,
                'category': category['topic'],
                'count': len(questions),
                'questions': questions,
            })
        topic_types.append({
            'topicId': category_id,
            'topic': category['topic'],
            'count': len(category_questions),
            'children': children,
        })
    return groups, topic_types


def write_payload(path, payload, write_js=False):
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(text, encoding='utf-8')
    js_path = path.with_suffix('.js')
    if write_js or js_path.exists():
        js_path.write_text(f'module.exports = {text};\n', encoding='utf-8')


def write_topics(out_dir, groups):
    topic_dir = out_dir / 'topics'
    topic_dir.mkdir(parents=True, exist_ok=True)
    for stale in topic_dir.glob('*.json'):
        stale.unlink()
    for group in groups:
        filename = hashlib.sha1(group['topicId'].encode('utf-8')).hexdigest() + '.json'
        write_payload(topic_dir / filename, {
            'topicId': group['topicId'],
            'topic': group['topic'],
            'questions': group['questions'],
        })


def write_prompt_clean_report(out_dir, current, frozen, head_ref):
    current_by_id = {item['_id']: item for item in current}
    changes = []
    for old in frozen:
        new = current_by_id.get(old['_id'])
        if not new or old.get('prompt') == new.get('prompt'):
            continue
        if strip_source_watermarks(old.get('prompt')) == new.get('prompt'):
            continue
        changes.append({
            '_id': old['_id'],
            'oldPrompt': old.get('prompt', ''),
            'newPrompt': new.get('prompt', ''),
            'reason': 'remove duplicated A-D option text from prompt; options remain in options field',
        })
    if not changes:
        return 0
    report = {
        'schemaVersion': 1,
        'scope': out_dir.relative_to(ROOT).as_posix(),
        'baseline': head_ref,
        'summary': {
            'changedCount': len(changes),
            'reason': 'prompt_tail_duplicated_options_removed',
        },
        'changes': changes,
    }
    write_payload(out_dir / 'prompt-clean-report.json', report)
    return len(changes)


def clean_source_watermarks(items):
    changes = []
    for item in items:
        for change in clean_question_source_watermarks(item):
            changes.append({
                '_id': item['_id'],
                'sourceFile': item.get('sourceFile', ''),
                **change,
                'oldValueHash': hashlib.sha256(
                    str(change['oldValue']).encode('utf-8')
                ).hexdigest(),
                'newValueHash': hashlib.sha256(
                    str(change['newValue']).encode('utf-8')
                ).hexdigest(),
            })
    return changes


def write_source_watermark_clean_report(
    out_dir,
    changes,
    head_ref,
    source_payload_hash,
    cleaned_payload_hash,
):
    report = {
        'schemaVersion': 1,
        'scope': out_dir.relative_to(ROOT).as_posix(),
        'baseline': head_ref,
        'sourcePayloadHash': source_payload_hash,
        'cleanedPayloadHash': cleaned_payload_hash,
        'summary': {
            'changedQuestionCount': len({item['_id'] for item in changes}),
            'changedFieldCount': len(changes),
            'reason': 'grammar_prompt_option_source_watermarks_removed',
        },
        'changes': changes,
    }
    write_payload(out_dir / 'source-watermark-clean-report.json', report)


def rebuild(relative_dir, head_ref):
    out_dir = ROOT / relative_dir
    questions_path = out_dir / f'{STEMS[0]}.json'
    source_payload_hash = hashlib.sha256(questions_path.read_bytes()).hexdigest()
    current = load_json(questions_path)
    frozen = head_json(questions_path.relative_to(ROOT), head_ref)
    merged, restored = merge_frozen_ids(current, frozen)
    source_watermark_changes = clean_source_watermarks(merged)
    restored_ids = {item['_id'] for item in restored}
    remapped = normalize_top_categories(merged, restored_ids)
    groups, topic_types = build_outputs(merged)

    write_payload(questions_path, merged, write_js=(out_dir.name == 'grammar'))
    write_payload(out_dir / f'{STEMS[1]}.json', groups, write_js=(out_dir.name == 'grammar'))
    write_payload(out_dir / f'{STEMS[2]}.json', topic_types, write_js=(out_dir.name == 'grammar'))
    write_topics(out_dir, groups)
    clean_count = write_prompt_clean_report(out_dir, merged, frozen, head_ref)
    cleaned_payload_hash = hashlib.sha256(questions_path.read_bytes()).hexdigest()
    write_source_watermark_clean_report(
        out_dir,
        source_watermark_changes,
        head_ref,
        source_payload_hash,
        cleaned_payload_hash,
    )
    return {
        'dataset': relative_dir.as_posix(),
        'questions': len(merged),
        'restored': len(restored),
        'remapped': remapped,
        'promptCleanChanges': clean_count,
        'sourceWatermarkQuestions': len({
            item['_id'] for item in source_watermark_changes
        }),
        'sourceWatermarkFields': len(source_watermark_changes),
        'categories': len(topic_types),
        'topics': len(groups),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--head-ref', default='HEAD')
    parser.add_argument(
        'datasets',
        nargs='*',
        type=Path,
        default=[Path('data/grammar'), Path('data/grammar-em1-upload')],
    )
    args = parser.parse_args()
    results = [rebuild(dataset, args.head_ref) for dataset in args.datasets]
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
