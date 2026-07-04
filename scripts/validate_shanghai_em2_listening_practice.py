#!/usr/bin/env python3
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data' / 'listening-em2'
PRACTICE_PATH = DATA_DIR / 'listening-practice.json'
REPORT_PATH = DATA_DIR / 'listening-practice.clean-report.json'
REJECTED_PATH = DATA_DIR / 'listening-practice.rejected.json'
MATERIAL_JSON = ROOT / 'data' / 'material-index.json'
MATERIAL_JS = ROOT / 'data' / 'material-index.js'


def clean_text(value):
    return str(value or '').strip()


def has_audio(item):
    if not item.get('hasAudio'):
        return False
    local_path = clean_text(item.get('audioLocalPath'))
    if local_path and (ROOT / local_path).exists():
        return True
    return bool(clean_text(item.get('audioCloudPath')))


def has_valid_answer(question):
    answer = clean_text(question.get('answer'))
    if not answer or set(answer) <= {'_'}:
        return False
    question_type = question.get('questionType')
    if question_type in {'choice', 'picture'}:
        return answer.upper() in set('ABCDEFGH')
    if question_type == 'truefalse':
        return answer.upper() in {'T', 'F'}
    return True


def validate_questions(item):
    reasons = []
    questions = item.get('questions')
    if not isinstance(questions, list):
        return ['missing-questions']
    mode = '25' if len(questions) == 25 or any(int(q.get('number') or 0) > 20 for q in questions) else '20'
    expected_numbers = list(range(1, 26)) if mode == '25' else list(range(1, 21))
    picture_end = 6 if mode == '25' else 5
    choice_start = 7 if mode == '25' else 6
    choice_end = 14 if mode == '25' else 10
    tf_start = 15 if mode == '25' else 11
    tf_end = 20 if mode == '25' else 15
    blank_start = 21 if mode == '25' else 16
    blank_end = 25 if mode == '25' else 20

    if len(questions) not in {20, 25}:
        reasons.append(f'question-count-{len(questions)}')

    numbers = [question.get('number') for question in questions]
    if numbers != expected_numbers:
        reasons.append(f'question-numbers-not-1-{expected_numbers[-1]}')

    images = item.get('images') if isinstance(item.get('images'), list) else []
    if len(images) < 1:
        reasons.append('missing-a-section-images')

    for question in questions:
        number = question.get('number')
        question_type = question.get('questionType')
        if not has_valid_answer(question):
            reasons.append(f'q{number}-missing-or-invalid-answer')
        if 1 <= int(number or 0) <= picture_end and question_type != 'picture':
            reasons.append(f'q{number}-not-picture')
        if choice_start <= int(number or 0) <= choice_end:
            options = question.get('options') or {}
            if question_type != 'choice':
                reasons.append(f'q{number}-not-choice')
            if set(options.keys()) != set('ABCD') or any(not clean_text(options.get(k)) for k in 'ABCD'):
                reasons.append(f'q{number}-missing-abcd-options')
        if tf_start <= int(number or 0) <= tf_end and question_type != 'truefalse':
            reasons.append(f'q{number}-not-truefalse')
        if blank_start <= int(number or 0) <= blank_end and question_type != 'blank':
            reasons.append(f'q{number}-not-blank')
    return reasons


def validate_item(item):
    reasons = []
    for field in ['_id', 'title', 'year', 'district', 'examType']:
        if not item.get(field):
            reasons.append(f'missing-{field}')
    if item.get('examType') != '二模':
        reasons.append('not-em2')
    if not has_audio(item):
        reasons.append('missing-audio')
    reasons.extend(validate_questions(item))
    return sorted(set(reasons))


def slim_item(item):
    return {
        '_id': item.get('_id'),
        'title': item.get('title'),
        'year': item.get('year'),
        'sourceYear': item.get('sourceYear'),
        'district': item.get('district'),
        'examType': item.get('examType'),
        'stage': item.get('stage', '初中'),
        'audioCloudPath': item.get('audioCloudPath', ''),
        'transcript': item.get('transcript', ''),
        'hasAudio': item.get('hasAudio', False),
        'hasTranscript': item.get('hasTranscript', False),
        'questionSourceFile': item.get('questionSourceFile', ''),
        'images': item.get('images', []),
        'questions': item.get('questions', []),
    }


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    items = json.loads(PRACTICE_PATH.read_text(encoding='utf-8'))
    accepted = []
    rejected = []
    reason_counts = {}

    for item in items:
        reasons = validate_item(item)
        if reasons:
            rejected.append({
                '_id': item.get('_id', ''),
                'title': item.get('title', ''),
                'year': item.get('year'),
                'district': item.get('district', ''),
                'questionSourceFile': item.get('questionSourceFile', ''),
                'reasons': reasons,
            })
            for reason in reasons:
                reason_counts[reason] = reason_counts.get(reason, 0) + 1
        else:
            accepted.append(item)

    write_json(PRACTICE_PATH, accepted)
    write_json(REJECTED_PATH, rejected)
    write_json(REPORT_PATH, {
        'sourceCount': len(items),
        'acceptedCount': len(accepted),
        'rejectedCount': len(rejected),
        'reasonCounts': dict(sorted(reason_counts.items())),
        'outputs': {
            'practice': str(PRACTICE_PATH.relative_to(ROOT)),
            'rejected': str(REJECTED_PATH.relative_to(ROOT)),
            'report': str(REPORT_PATH.relative_to(ROOT)),
        },
    })

    if MATERIAL_JSON.exists():
        material = json.loads(MATERIAL_JSON.read_text(encoding='utf-8'))
        material['listeningEm2'] = [slim_item(item) for item in accepted]
        write_json(MATERIAL_JSON, material)
        MATERIAL_JS.write_text(
            'module.exports = ' + json.dumps(material, ensure_ascii=False, indent=2) + ';\n',
            encoding='utf-8',
        )

    print(json.dumps({
        'accepted': len(accepted),
        'rejected': len(rejected),
        'topReasons': sorted(reason_counts.items(), key=lambda x: (-x[1], x[0]))[:12],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
