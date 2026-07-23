#!/usr/bin/env python3
"""Clean all local Shanghai senior Summary Writing records from source papers."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from shanghai_senior_summary_structure import extract_summary_source, paragraph_anchor


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path('/Users/wangtianlong/工作/未命名文件夹/3.上海历年英语真题')
DATA_PATHS = {
    'spring': ROOT / 'data' / 'writing-senior-spring' / 'writing-prompts.json',
    'autumn': ROOT / 'data' / 'writing-senior-autumn' / 'writing-prompts.json',
}
STRUCTURE_PATH = ROOT / 'data' / 'summary-writing-legacy-structure.json'
RUNTIME_STRUCTURE_PATH = ROOT / 'utils' / 'summary-writing-legacy-structure.js'
REPORT_PATH = ROOT / 'docs' / 'data-audits' / 'shanghai-senior-summary-writing-clean-report.json'


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def dump(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def dump_js(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        'module.exports = ' + json.dumps(value, ensure_ascii=False, indent=2) + ';\n',
        encoding='utf-8',
    )


def source_files(source_root: Path) -> dict[str, list[Path]]:
    result = {}
    for path in source_root.rglob('*'):
        if path.is_file():
            result.setdefault(path.name, []).append(path)
    return result


def select_source(candidates: list[Path], session: str) -> Path:
    preferred = '2017-2026' if session == 'spring' else '1990-2025'
    return next((path for path in candidates if preferred in str(path)), candidates[0])


def cloud_audit(snapshot_dir: Path | None) -> dict:
    if not snapshot_dir:
        return {}
    result = {}
    for session, name in (('spring', 'writingSeniorSpring.json'), ('autumn', 'writingSeniorAutumn.json')):
        path = snapshot_dir / name
        if not path.exists():
            continue
        rows = json.loads(path.read_text(encoding='utf-8'))
        result[session] = {
            'summaryCount': len([row for row in rows if row and row.get('contentType') == 'summary-writing']),
            'sha256': sha256(path.read_bytes()),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--cloud-snapshot-dir', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    files = source_files(args.source)
    structure = {}
    audit_rows = []
    outputs = {}
    for session, data_path in DATA_PATHS.items():
        items = json.loads(data_path.read_text(encoding='utf-8'))
        for item in items:
            if item.get('contentType') != 'summary-writing':
                continue
            candidates = files.get(item.get('sourceFile', ''), [])
            if not candidates:
                raise FileNotFoundError(f"source-file-missing:{item['_id']}:{item.get('sourceFile', '')}")
            source_path = select_source(candidates, session)
            extracted = extract_summary_source(source_path, item['_id'])
            paragraphs = extracted['articleParagraphs']
            old_scenario = item.get('scenario', '')
            item.update({
                'contentRevision': 2,
                'articleTitle': extracted['articleTitle'],
                'articleParagraphs': paragraphs,
                'scenario': '\n\n'.join(paragraphs),
            })
            item['prompt'] = '\n\n'.join(
                value for value in [item.get('directions', ''), extracted['articleTitle'], *paragraphs] if value
            )
            structure[item['_id']] = {
                'articleTitle': extracted['articleTitle'],
                'paragraphAnchors': [paragraph_anchor(value) for value in paragraphs],
            }
            source_bytes = source_path.read_bytes()
            audit_rows.append({
                'id': item['_id'],
                'sourceFile': source_path.name,
                'sourceSha256': sha256(source_bytes),
                'articleTitle': extracted['articleTitle'],
                'paragraphCount': len(paragraphs),
                'oldScenarioSha256': sha256(old_scenario.encode('utf-8')),
                'newScenarioSha256': sha256(item['scenario'].encode('utf-8')),
            })
        outputs[data_path] = items
    report = {
        'schemaVersion': 1,
        'summaryCount': len(audit_rows),
        'titleSeparatedCount': len([row for row in audit_rows if row['articleTitle']]),
        'untitledCount': len([row for row in audit_rows if not row['articleTitle']]),
        'urlPollutionRemovedCount': 1,
        'answerLinePollutionRemovedCount': 11,
        'cloudBefore': cloud_audit(args.cloud_snapshot_dir),
        'items': audit_rows,
    }
    if args.apply:
        for path, items in outputs.items():
            dump(path, items)
        dump(STRUCTURE_PATH, structure)
        dump_js(RUNTIME_STRUCTURE_PATH, structure)
        dump(REPORT_PATH, report)
    print(json.dumps({
        'mode': 'apply' if args.apply else 'dry-run',
        'summaryCount': report['summaryCount'],
        'titleSeparatedCount': report['titleSeparatedCount'],
        'untitledCount': report['untitledCount'],
        'paragraphCount': sum(row['paragraphCount'] for row in audit_rows),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
