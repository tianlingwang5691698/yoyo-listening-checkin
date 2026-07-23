#!/usr/bin/env python3
"""Clean current junior/senior reading JSON and emit an auditable report."""

from __future__ import annotations

import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

from reading_content_structure import structure_reading_item


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_DIR = ROOT / 'data/cloud-backups/2026-07-24-junior-ielts-structure'
GROUPS = {
    'junior-em1': {
        'path': ROOT / 'data/reading-em1/reading-passages.json',
        'snapshot': SNAPSHOT_DIR / 'reading-em1__reading-passages.json',
    },
    'junior-em2': {
        'path': ROOT / 'data/reading/reading-passages.json',
        'snapshot': SNAPSHOT_DIR / 'reading__reading-passages.json',
    },
    'senior-spring': {'path': ROOT / 'data/reading-senior-spring/reading-passages.json'},
    'senior-autumn': {'path': ROOT / 'data/reading-senior-autumn/reading-passages.json'},
}
for book in range(10, 22):
    GROUPS[f'ielts-{book}'] = {
        'path': ROOT / f'data/ielts-academic/cambridge-{book}/reading/v2/reading-passages.json',
        'snapshot': SNAPSHOT_DIR / f'ielts-academic__cambridge-{book}__reading__v2__reading-passages.json',
    }
REPORT_PATH = ROOT / 'data/reading-content-structure-clean-report.json'


def digest(value) -> str:
    body = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(body.encode('utf-8')).hexdigest()


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def baseline_by_id(path: Path) -> dict:
    relative = path.relative_to(ROOT).as_posix()
    result = subprocess.run(
        ['git', 'show', f'HEAD:{relative}'],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    if result.returncode:
        return {}
    return {item.get('_id'): item for item in json.loads(result.stdout)}


def merge_snapshot_items(path: Path, snapshot_path: Path | None) -> tuple[list[dict], dict]:
    local_items = json.loads(path.read_text(encoding='utf-8'))
    if not snapshot_path or not snapshot_path.exists():
        return local_items, {}
    snapshot_items = json.loads(snapshot_path.read_text(encoding='utf-8'))
    snapshot_by_id = {item.get('_id'): item for item in snapshot_items}
    snapshot_ids = set(snapshot_by_id)
    merged = list(snapshot_items)
    merged.extend(item for item in local_items if item.get('_id') not in snapshot_ids)
    return merged, snapshot_by_id


def main():
    previous_rows = {}
    if REPORT_PATH.exists():
        previous = json.loads(REPORT_PATH.read_text(encoding='utf-8'))
        previous_rows = {row.get('_id'): row for row in previous.get('affectedIds', [])}
    report = {
        'schema': ['directions', 'sectionHeading', 'articleTitle', 'articleSubtitle', 'passageParagraphs', 'passage'],
        'cloudSnapshot': str(SNAPSHOT_DIR.relative_to(ROOT)),
        'groups': {},
        'affectedIds': [],
    }
    total_types = Counter()
    for group, config in GROUPS.items():
        path = config['path']
        items, snapshot_by_id = merge_snapshot_items(path, config.get('snapshot'))
        baseline = baseline_by_id(path)
        old_by_id = dict(baseline)
        old_by_id.update(snapshot_by_id)
        cleaned = []
        affected = []
        group_types = Counter()
        for item in items:
            source_item = item
            if item.get('dataFormat') == 'reading-structured-v1' and not item.get('passageParagraphs'):
                source_item = baseline.get(item.get('_id'), item)
            next_item, detail = structure_reading_item(source_item)
            cleaned.append(next_item)
            if not detail['affected']:
                continue
            pollution = detail['pollution'] or previous_rows.get(item.get('_id'), {}).get('pollution', [])
            group_types.update(pollution)
            total_types.update(pollution)
            affected.append({
                '_id': item['_id'],
                'sourceFile': item.get('sourceFile', ''),
                'pollution': pollution,
                'oldHash': digest(old_by_id.get(item['_id'], item)),
                'newHash': digest(next_item),
                'paragraphCount': detail.get('paragraphCount', 0),
            })
        write_json(path, cleaned)
        js_path = path.with_suffix('.js')
        if js_path.exists():
            js_path.write_text(f'module.exports = {json.dumps(cleaned, ensure_ascii=False, indent=2)};\n', encoding='utf-8')
        report['groups'][group] = {
            'total': len(items),
            'affected': len(affected),
            'pollutionTypes': dict(sorted(group_types.items())),
            'ids': [row['_id'] for row in affected],
        }
        report['affectedIds'].extend(affected)
    report['pollutionTypes'] = dict(sorted(total_types.items()))
    write_json(REPORT_PATH, report)
    print(json.dumps(report['groups'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
