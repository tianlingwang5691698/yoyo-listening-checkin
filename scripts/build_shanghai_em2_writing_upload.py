#!/usr/bin/env python3
import json
import re
from pathlib import Path

from build_shanghai_em1_reading_upload import DISTRICTS, clean, read_text
from build_shanghai_em1_writing_upload import normalize_prompt, valid_prompt, writing_section


ROOTS = [
    Path('/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/二模（12年无音频）'),
    Path('/Users/wangtianlong/工作/未命名文件夹/7. 2025年上海二模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/9.2026年上海二模'),
]
COMBINED_2025 = Path('/Users/wangtianlong/工作/未命名文件夹/7. 2025年上海二模/英语/2025上海初三英语二模16区试卷.pdf')
FORMAL_OUT = Path('data/imports/shanghai-em2-2012-2026/formal')
UPLOAD_OUT = Path('data/writing-em2')


def year_of(path):
    m = re.search(r'(20\d{2}|201\d)', str(path))
    return int(m.group(1)) if m else None


def district_of(path):
    text = str(path)
    for d in DISTRICTS:
        if d in text:
            return {'浦东新区': '浦东', '黄埔': '黄浦'}.get(d, d)
    return ''


def is_english_em2(path):
    s = str(path)
    return '英语' in s and '二模' in s and year_of(path) in range(2012, 2027) and district_of(path)


def is_paper_candidate(path):
    s = str(path)
    name = path.name
    if path.suffix.lower() not in {'.docx', '.doc', '.pdf'} or not is_english_em2(path):
        return False
    if any(x in s for x in ['语文', '数学', '物理', '化学', '道法', '历史', '跨学科', '答题卡', 'MP3', 'mp3']):
        return False
    if '英语二模各区听力' in s or '听力文本' in s or '听力文字' in s or re.search(r'二模英语听力\.(?:docx?|pdf)$', name):
        return False
    if any(x in s for x in ['分类汇编', '专题', '押题']):
        return False
    if '同学分享' in name or '仅供参考' in name:
        return False
    if ('答案' in name or '参考' in name) and not any(x in name for x in ['试题及答案', '试卷及答案', '解析版', '官方解析', '独家解析']):
        return False
    return True


def file_score(path):
    s = str(path)
    score = 0
    if path.suffix.lower() == '.docx':
        score += 30
    if '解析版' in s or '官方解析' in s or '独家解析' in s:
        score += 25
    if '官方' in s or '试卷' in s or '试题' in s or '真题卷' in s:
        score += 12
    if '原卷' in s:
        score -= 5
    if '总结分析' in s or '分析总结' in s:
        score -= 10
    if path.suffix.lower() == '.pdf':
        score -= 12
    return score


def collect_files():
    best = {}
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if not path.is_file() or not is_paper_candidate(path):
                continue
            key = (year_of(path), district_of(path))
            if key not in best or file_score(path) > file_score(best[key]):
                best[key] = path
    return best


def split_combined_2025(text):
    matches = list(re.finditer(r'(宝山区|崇明区|奉贤区|虹口区|黄浦区|嘉定区|金山区|静安区|闵行区|浦东新区|普陀区|青浦区|松江区|徐汇区|杨浦区|长宁区)\s+2024', text))
    blocks = []
    for index, match in enumerate(matches):
        district = match.group(1).replace('浦东新区', '浦东').replace('区', '')
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((district, text[start:end]))
    return blocks


def build_item(year, district, path, prompt):
    return {
        '_id': f'sh-em2-{year}-{district}-writing',
        'title': f'{year} 上海{district}二模作文',
        'year': year,
        'city': '上海',
        'district': district,
        'examType': '二模',
        'stage': '初中',
        'section': 'writing',
        'category': '初中作文',
        'sourceType': 'shanghai-mock',
        'sourceFile': path.name,
        'prompt': prompt,
        'minWords': 60,
        'score': 20,
    }


def main():
    papers = collect_files()
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
            items.append(build_item(year, district, path, prompt))
        except Exception as exc:
            report.append({'year': year, 'district': district, 'ok': False, 'error': str(exc), 'sourceFile': str(path)})

    if COMBINED_2025.exists():
        try:
            combined_text = read_text(COMBINED_2025)
            existing = {item['_id'] for item in items}
            for district, block in split_combined_2025(combined_text):
                prompt = normalize_prompt(writing_section(block))
                ok = valid_prompt(prompt)
                item_id = f'sh-em2-2025-{district}-writing'
                report.append({
                    'year': 2025,
                    'district': district,
                    'ok': ok,
                    'chars': len(prompt),
                    'sourceFile': str(COMBINED_2025),
                    'combined': True,
                })
                if ok and item_id not in existing:
                    items.append(build_item(2025, district, COMBINED_2025, prompt))
                    existing.add(item_id)
        except Exception as exc:
            report.append({'year': 2025, 'district': 'combined', 'ok': False, 'error': str(exc), 'sourceFile': str(COMBINED_2025)})

    FORMAL_OUT.mkdir(parents=True, exist_ok=True)
    UPLOAD_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(items, ensure_ascii=False, indent=2)
    (FORMAL_OUT / 'writing-prompts.formal.json').write_text(text, encoding='utf-8')
    (FORMAL_OUT / 'writing-clean-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (UPLOAD_OUT / 'writing-prompts.json').write_text(text, encoding='utf-8')
    (UPLOAD_OUT / 'writing-prompts.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    (UPLOAD_OUT / 'README.md').write_text(
        '# 二模写作上传目录\n\n上传 `writing-prompts.json` 到云存储 `_content/writing-em2/writing-prompts.json`，用于写作/初中作文板块。\n',
        encoding='utf-8',
    )
    print(json.dumps({
        'papers': len(papers),
        'writingPrompts': len(items),
        'outFile': str(UPLOAD_OUT / 'writing-prompts.json'),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
