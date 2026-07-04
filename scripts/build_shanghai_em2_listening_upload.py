#!/usr/bin/env python3
import json
import os
import re
import shutil
from pathlib import Path

from build_shanghai_em1_reading_upload import DISTRICTS, clean, read_text


DEFAULT_ROOTS = [
    Path('/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）'),
    Path('/Users/wangtianlong/工作/未命名文件夹/7. 2025年上海二模/英语'),
    Path('/Users/wangtianlong/工作/未命名文件夹/9.2026年上海二模'),
]
ROOTS = [
    Path(p)
    for p in os.environ.get('SH_EM2_LISTENING_SOURCE_ROOTS', '').split(':')
    if p
] or DEFAULT_ROOTS
FORMAL_OUT = Path('data/imports/shanghai-em2-2012-2026/formal')
UPLOAD_OUT = Path('data/listening-em2')
AUDIO_OUT = UPLOAD_OUT / 'audio'
CLOUD_AUDIO_DIR = '_content/listening-em2/audio'


def is_em2_path(path):
    parts = [str(part) for part in Path(path).parts]
    if not any('二模' in part for part in parts):
        return False
    return not any(('一模' in part and '二模' not in part) for part in parts)


def year_of(path):
    m = re.search(r'(20\d{2}|201\d)', str(path))
    return int(m.group(1)) if m else None


def district_of(path):
    text = str(path)
    for d in DISTRICTS:
        if d in text:
            return {'浦东新区': '浦东', '黄埔': '黄浦'}.get(d, d)
    return ''


def is_audio(path):
    return path.suffix.lower() in {'.mp3', '.m4a', '.wav'}


def is_text_candidate(path):
    if path.suffix.lower() not in {'.docx', '.doc', '.pdf'}:
        return False
    s = str(path)
    return any(x in s for x in ['听力文本', '听力文字', '听力文稿', '听力与答案', '听力及参考答案', '二模英语听力'])


def audio_score(path):
    s = str(path)
    name = path.name
    score = 0
    if '英语二模各区听力' in s:
        score += 50
    if '听力mp3' in s or '听力音频' in name or '试卷听力' in name:
        score += 30
    if re.fullmatch(r'\d+\.(mp3|m4a|wav)', name, re.I):
        score -= 80
    if path.suffix.lower() == '.mp3':
        score += 8
    if path.suffix.lower() == '.m4a':
        score += 4
    return score


def collect_sources():
    audio_best = {}
    transcript_best = {}
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if not path.is_file():
                continue
            year = year_of(path)
            district = district_of(path)
            if not year or not district or not 2012 <= year <= 2026:
                continue
            key = (year, district)
            if is_audio(path) and is_em2_path(path) and ('英语' in str(path) or '听力' in str(path) or '二模' in str(path)):
                if key not in audio_best or audio_score(path) > audio_score(audio_best[key]):
                    audio_best[key] = path
            elif is_em2_path(path) and is_text_candidate(path):
                if key not in transcript_best or len(str(path)) < len(str(transcript_best[key])):
                    transcript_best[key] = path
    return audio_best, transcript_best


def normalize_transcript(text):
    source = clean(text)
    if not source:
        return ''
    start = re.search(r'(?:听力文字|听力文本|听力文稿|Part\s*1\s*Listening|Listening Comprehension|I\.\s*Listening)', source, re.I)
    if start:
        source = source[start.start():]
    end = re.search(r'(?:Part\s*2\s*Grammar|第二部分|II\.\s*Choose|Reading and Writing|Writing\s*[（(]作文)', source, re.I)
    if end:
        source = source[:end.start()]
    source = re.sub(r'参考答案[\s\S]*$', '', source).strip()
    return source[:12000]


def safe_link_or_copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def main():
    audio_best, transcript_best = collect_sources()
    AUDIO_OUT.mkdir(parents=True, exist_ok=True)
    for stale in AUDIO_OUT.glob('*'):
        if stale.is_file():
            stale.unlink()

    items = []
    keys = sorted(audio_best)
    for year, district in keys:
        audio = audio_best.get((year, district))
        transcript_path = transcript_best.get((year, district))
        audio_name = ''
        audio_cloud_path = ''
        audio_local_path = ''
        if audio:
            audio_name = f"sh-em2-{year}-{district}-listening{audio.suffix.lower()}"
            dst = AUDIO_OUT / audio_name
            safe_link_or_copy(audio, dst)
            audio_local_path = str(dst)
            audio_cloud_path = f"{CLOUD_AUDIO_DIR}/{audio_name}"
        transcript = ''
        if transcript_path:
            transcript = normalize_transcript(read_text(transcript_path))
        items.append({
            '_id': f'sh-em2-{year}-{district}-listening',
            'title': f'{year} 上海{district}二模听力',
            'year': year,
            'city': '上海',
            'district': district,
            'examType': '二模',
            'stage': '初中',
            'section': 'listening',
            'category': '中考听力',
            'sourceType': 'shanghai-mock',
            'audioFile': audio_name,
            'audioCloudPath': audio_cloud_path,
            'audioLocalPath': audio_local_path,
            'audioSourceFile': audio.name if audio else '',
            'transcriptSourceFile': transcript_path.name if transcript_path else '',
            'transcript': transcript,
            'hasAudio': bool(audio),
            'hasTranscript': bool(transcript),
        })

    FORMAL_OUT.mkdir(parents=True, exist_ok=True)
    UPLOAD_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(items, ensure_ascii=False, indent=2)
    (FORMAL_OUT / 'listening-sets.formal.json').write_text(text, encoding='utf-8')
    (UPLOAD_OUT / 'listening-sets.json').write_text(text, encoding='utf-8')
    (UPLOAD_OUT / 'listening-sets.js').write_text(f'module.exports = {text};\n', encoding='utf-8')
    (UPLOAD_OUT / 'README.md').write_text(
        '# 二模听力上传目录\n\n'
        '上传 `listening-sets.json` 到云存储 `_content/listening-em2/listening-sets.json`。\n'
        '上传 `audio/` 目录内文件到云存储 `_content/listening-em2/audio/`。\n',
        encoding='utf-8',
    )
    print(json.dumps({
        'listeningSets': len(items),
        'withAudio': sum(1 for item in items if item['hasAudio']),
        'withTranscript': sum(1 for item in items if item['hasTranscript']),
        'outFile': str(UPLOAD_OUT / 'listening-sets.json'),
        'audioDir': str(AUDIO_OUT),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
