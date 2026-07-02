#!/usr/bin/env python3
import json
import shutil
from pathlib import Path

import build_shanghai_em2_listening_practice as em2


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = [
    Path('/Users/wangtianlong/工作/未命名文件夹/3. 上海中考英语一模二模（12-24）/一模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/6. 2025年上海一模'),
    Path('/Users/wangtianlong/工作/未命名文件夹/8.2026年上海一模'),
]
TARGETS = {(2025, '宝山'), (2025, '普陀')}
OUT_DIR = ROOT / 'data' / 'listening-em1'
IMAGE_DIR = OUT_DIR / 'images'
AUDIO_DIR = OUT_DIR / 'audio'
PRACTICE_OUT = OUT_DIR / 'listening-practice.json'
REPORT_OUT = OUT_DIR / 'listening-practice.clean-report.json'
REJECTED_OUT = OUT_DIR / 'listening-practice.rejected.json'
MATERIAL_JSON = ROOT / 'data' / 'material-index.json'
MATERIAL_JS = ROOT / 'data' / 'material-index.js'


def is_em1_path(path):
    s = str(path)
    return '一模' in s and '二模' not in s and '英语' in s


def candidate_text_files():
    files = []
    for root in SOURCE_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if path.name.startswith('~$') or not path.is_file():
                continue
            if path.suffix.lower() not in {'.doc', '.docx', '.pdf', '.txt'}:
                continue
            if not is_em1_path(path):
                continue
            if any(bad in str(path) for bad in ['答案纸', '答题纸', '答题卡']):
                continue
            files.append(path)
    return sorted(files)


def candidate_audio_files():
    files = []
    for root in SOURCE_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if path.is_file() and path.suffix.lower() in {'.mp3', '.wav', '.m4a'} and is_em1_path(path):
                files.append(path)
    return sorted(files)


def with_em1_image_dir(fn, *args):
    old_dir = em2.IMAGE_DIR
    try:
        em2.IMAGE_DIR = IMAGE_DIR
        return fn(*args)
    finally:
        em2.IMAGE_DIR = old_dir


def best_sources():
    best = {}
    for path in candidate_text_files():
        key = (em2.year_of(path), em2.district_of(path))
        if key not in TARGETS:
            continue
        text = em2.read_text(path)
        questions = em2.parse_questions(text)
        if len(questions) < 10:
            continue
        score = em2.score_text_source(path, text) + len(questions)
        old = best.get(key)
        if not old or score > old['score']:
            best[key] = {'path': path, 'text': text, 'questions': questions, 'score': score}
    return best


def best_answer_sources():
    best = {}
    for path in candidate_text_files():
        key = (em2.year_of(path), em2.district_of(path))
        if key not in TARGETS:
            continue
        text = em2.read_text(path)
        answers = em2.extract_listening_answers(text)
        if not em2.is_valid_listening_answer_set(answers):
            continue
        score = len(answers) * 10
        if any(token in str(path) for token in ['解析版', '答案', '参考答案', '听力文本']):
            score += 50
        old = best.get(key)
        if not old or score > old['score']:
            best[key] = {'path': path, 'answers': answers, 'score': score}
    return best


def best_transcript_sources():
    best = {}
    for path in candidate_text_files():
        key = (em2.year_of(path), em2.district_of(path))
        if key not in TARGETS:
            continue
        text = em2.read_text(path)
        transcript = em2.extract_listening_transcript(text)
        if not transcript:
            continue
        score = len(transcript)
        if any(token in str(path) for token in ['听力文本', '听力原文', '听力文字', '听力文稿', '原文答案']):
            score += 5000
        old = best.get(key)
        if not old or score > old['score']:
            best[key] = {'path': path, 'transcript': transcript, 'score': score}
    return best


def best_image_sources(keys):
    best = {}
    probe_dir = IMAGE_DIR / '_probe'
    probe_dir.mkdir(parents=True, exist_ok=True)
    for path in candidate_text_files():
        if path.suffix.lower() != '.docx':
            continue
        key = (em2.year_of(path), em2.district_of(path))
        if key not in keys:
            continue
        old_dir = em2.IMAGE_DIR
        try:
            em2.IMAGE_DIR = probe_dir
            images = em2.extract_images(path, f'probe-{key[0]}-{key[1]}')
        finally:
            em2.IMAGE_DIR = old_dir
        image_count = len(images)
        for image in images:
            local = Path(image['localPath'])
            if local.exists():
                local.unlink()
        if image_count < 5:
            continue
        score = em2.score_image_source(path, image_count)
        old = best.get(key)
        if not old or score > old['score']:
            best[key] = {'path': path, 'imageCount': image_count, 'score': score}
    for stale in probe_dir.glob('*'):
        if stale.is_file():
            stale.unlink()
    return best


def best_audio_sources():
    best = {}
    for path in candidate_audio_files():
        key = (em2.year_of(path), em2.district_of(path))
        if key in TARGETS and key not in best:
            best[key] = path
    return best


def local_cloud_path(item_id, path):
    ext = path.suffix.lower() or '.mp3'
    local = AUDIO_DIR / f'{item_id}{ext}'
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, local)
    return str(local.relative_to(ROOT)), f'_content/listening-em1/audio/{local.name}'


def rewrite_image_paths(images):
    for image in images:
        local = Path(image['localPath'])
        image['localPath'] = str(local.relative_to(ROOT))
        image['cloudPath'] = f'_content/listening-em1/images/{local.name}'
    return images


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
        'answerSourceFile': item.get('answerSourceFile', ''),
        'imageSourceFile': item.get('imageSourceFile', ''),
        'images': item.get('images', []),
        'questions': item.get('questions', []),
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for folder in [IMAGE_DIR, AUDIO_DIR]:
        for stale in folder.glob('*'):
            if stale.is_file():
                stale.unlink()

    sources = best_sources()
    answer_sources = best_answer_sources()
    transcript_sources = best_transcript_sources()
    image_sources = best_image_sources(set(sources) | set(answer_sources))
    audio_sources = best_audio_sources()

    items = []
    candidates = sorted(TARGETS)
    for year, district in candidates:
        key = (year, district)
        source = sources.get(key)
        answer_source = answer_sources.get(key)
        image_source = image_sources.get(key)
        audio_source = audio_sources.get(key)
        if not (source and answer_source and image_source and audio_source):
            continue
        item_id = f'sh-em1-{year}-{district}-listening'
        audio_local, audio_cloud = local_cloud_path(item_id, audio_source)
        questions = source['questions']
        answers = answer_source['answers']
        for question in questions:
            if question.get('number') in answers:
                question['answer'] = answers[question['number']]
        images = rewrite_image_paths(with_em1_image_dir(em2.extract_images, image_source['path'], item_id))
        questions = em2.picture_questions() + [q for q in questions if q.get('number', 0) > 5]
        for question in questions:
            if question.get('number') in answers:
                question['answer'] = answers[question['number']]
        transcript_source = transcript_sources.get(key)
        items.append({
            '_id': item_id,
            'title': f'{year} 上海{district}一模听力',
            'year': year,
            'sourceYear': year,
            'city': '上海',
            'district': district,
            'examType': '一模',
            'stage': '初中',
            'audioLocalPath': audio_local,
            'audioCloudPath': audio_cloud,
            'hasAudio': True,
            'transcript': transcript_source['transcript'] if transcript_source else '',
            'hasTranscript': bool(transcript_source),
            'transcriptSourceFile': transcript_source['path'].name if transcript_source else '',
            'questionSourceFile': source['path'].name,
            'answerSourceFile': answer_source['path'].name,
            'imageSourceFile': image_source['path'].name,
            'images': images,
            'questions': sorted(questions, key=lambda q: q['number']),
        })

    PRACTICE_OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    material = json.loads(MATERIAL_JSON.read_text(encoding='utf-8'))
    material['listeningEm1'] = [slim_item(item) for item in items]
    MATERIAL_JSON.write_text(json.dumps(material, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    MATERIAL_JS.write_text('module.exports = ' + json.dumps(material, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(json.dumps({'practiceSets': len(items), 'out': str(PRACTICE_OUT.relative_to(ROOT))}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
