#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import validate_shanghai_em2_listening_practice as base


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data' / 'listening-em1'
PRACTICE_PATH = DATA_DIR / 'listening-practice.json'
REPORT_PATH = DATA_DIR / 'listening-practice.clean-report.json'
REJECTED_PATH = DATA_DIR / 'listening-practice.rejected.json'
MATERIAL_JSON = ROOT / 'data' / 'material-index.json'
MATERIAL_JS = ROOT / 'data' / 'material-index.js'


def validate_item(item):
    reasons = []
    for field in ['_id', 'title', 'year', 'district', 'examType']:
        if not item.get(field):
            reasons.append(f'missing-{field}')
    if item.get('examType') != '一模':
        reasons.append('not-em1')
    if not base.has_audio(item):
        reasons.append('missing-audio')
    reasons.extend(base.validate_questions(item))
    return sorted(set(reasons))


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
    })
    material = json.loads(MATERIAL_JSON.read_text(encoding='utf-8'))
    material['listeningEm1'] = [base.slim_item(item) for item in accepted]
    write_json(MATERIAL_JSON, material)
    MATERIAL_JS.write_text('module.exports = ' + json.dumps(material, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(json.dumps({'accepted': len(accepted), 'rejected': len(rejected), 'reasonCounts': reason_counts}, ensure_ascii=False, indent=2))
    if rejected:
        sys.exit(1)


if __name__ == '__main__':
    main()
