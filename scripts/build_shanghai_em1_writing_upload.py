#!/usr/bin/env python3
import json
import re
from pathlib import Path

from build_shanghai_em1_reading_upload import clean, collect_files, read_text


FORMAL_OUT = Path('data/imports/shanghai-em1-2014-2026/formal')
UPLOAD_OUT = Path('data/writing-em1')


def writing_section(text):
    match = re.search(r'(?:VII|Ⅶ)\.?\s*Writing|Writing\s*\(作文\)|作文\s*[（(]', text, re.I)
    if not match:
        return ''
    tail = text[match.start():]
    end = re.search(
        r'(?:参考答案|英语试卷答案|答案要点|听力原文|第一部分|Part\s*[I1]|写话评分标准|作文评分标准|评分标准|[^\s]{0,8}区20\d{2}[-—~～]20\d{2}学年度)',
        tail,
        re.I,
    )
    return tail[:end.start()] if end else tail[:1800]


def normalize_prompt(section):
    text = clean(section)
    text = re.sub(r'^(?:VII|Ⅶ)\.?\s*Writing\s*[（(]?作文[）)]?\s*(?:本大题共\s*1\s*题)?\s*(?:共?\s*20\s*分)?', '', text, flags=re.I)
    text = re.sub(r'^\d{1,3}[\.．]\s*', '', text).strip()
    text = re.sub(r'\s*【答案】[\s\S]*$', '', text).strip()
    text = re.sub(r'\s*参考范文[\s\S]*$', '', text).strip()
    text = re.sub(r'\s*Sample writing[\s\S]*$', '', text, flags=re.I).strip()
    text = re.sub(r'\s*Part\s*[I1]\s+Listening[\s\S]*$', '', text, flags=re.I).strip()
    text = re.sub(r'\s*[^\s]{0,8}区20\d{2}[-—~～]20\d{2}学年度[\s\S]*$', '', text).strip()
    return text


def valid_prompt(prompt):
    if not (30 <= len(prompt) <= 1400):
        return False
    if re.search(r'评分标准|扣分|满分结构|参考范文|听力测试', prompt):
        return False
    return bool(re.search(r'Write|composition|essay|words|作文|短文|不少于|至少', prompt, re.I))


def main():
    papers, _ = collect_files()
    items, report = [], []
    for (year, district), path in sorted(papers.items()):
        try:
            section = writing_section(read_text(path))
            prompt = normalize_prompt(section)
            ok = valid_prompt(prompt)
            report.append({
                'year': year,
                'district': district,
                'ok': ok,
                'chars': len(prompt),
                'sourceFile': str(path),
            })
            if not ok:
                continue
            items.append({
                '_id': f'sh-em1-{year}-{district}-writing',
                'title': f'{year} 上海{district}一模作文',
                'year': year,
                'city': '上海',
                'district': district,
                'examType': '一模',
                'stage': '初中',
                'section': 'writing',
                'category': '初中作文',
                'sourceType': 'shanghai-mock',
                'sourceFile': path.name,
                'prompt': prompt,
                'minWords': 60,
                'score': 20,
            })
        except Exception as exc:
            report.append({'year': year, 'district': district, 'ok': False, 'error': str(exc), 'sourceFile': str(path)})

    FORMAL_OUT.mkdir(parents=True, exist_ok=True)
    UPLOAD_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(items, ensure_ascii=False, indent=2)
    (FORMAL_OUT / 'writing-prompts.formal.json').write_text(text, encoding='utf-8')
    (FORMAL_OUT / 'writing-clean-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (UPLOAD_OUT / 'writing-prompts.json').write_text(text, encoding='utf-8')
    (UPLOAD_OUT / 'writing-prompts.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    (UPLOAD_OUT / 'README.md').write_text(
        '# 一模写作上传目录\n\n上传 `writing-prompts.json` 到云存储 `_content/writing-em1/writing-prompts.json`，用于写作/初中作文板块。\n',
        encoding='utf-8',
    )
    print(json.dumps({
        'papers': len(papers),
        'writingPrompts': len(items),
        'outFile': str(UPLOAD_OUT / 'writing-prompts.json'),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
