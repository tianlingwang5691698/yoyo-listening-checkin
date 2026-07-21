#!/usr/bin/env python3

import csv
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path('/Users/wangtianlong/工作/01_教学与备考/备考/雅思总类/核心资料库/雅思真题/雅思A类全套4-21')
OCR_ROOT = Path('/tmp/ielts-ocr')


BOOKS = {
    16: {
        'year': 2021,
        'pdf': SOURCE_ROOT / '真题4-18/剑16真题.pdf',
        'ocr': OCR_ROOT / 'cambridge-16-ocr.pdf',
        'audio': SOURCE_ROOT / '剑雅听力音频/16音频',
        'audioPattern': r'IELTS16_test([1-4])_audio([1-4])\.mp3$',
        'tests': {
            1: {'listening': (10, 15), 'reading': (16, 28), 'writing': (29, 30), 'speaking': 31, 'transcript': (98, 103), 'answers': (121, 122)},
            2: {'listening': (32, 37), 'reading': (38, 51), 'writing': (52, 53), 'speaking': 54, 'transcript': (104, 109), 'answers': (123, 124)},
            3: {'listening': (55, 60), 'reading': (61, 72), 'writing': (73, 74), 'speaking': 75, 'transcript': (110, 114), 'answers': (125, 126)},
            4: {'listening': (76, 81), 'reading': (82, 94), 'writing': (95, 96), 'speaking': 97, 'transcript': (115, 120), 'answers': (127, 128)},
        },
    },
    17: {
        'year': 2022,
        'pdf': SOURCE_ROOT / '真题4-18/剑17/剑桥雅思17（A类）.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/17音频',
        'audioPattern': r'C17-T([1-4])-P([1-4])\.mp3$',
        'tests': {
            1: {'listening': (10, 15), 'reading': (16, 27), 'writing': (28, 29), 'speaking': 30, 'transcript': (96, 100), 'answers': (119, 120)},
            2: {'listening': (31, 36), 'reading': (37, 49), 'writing': (50, 51), 'speaking': 52, 'transcript': (101, 106), 'answers': (121, 122)},
            3: {'listening': (53, 58), 'reading': (59, 71), 'writing': (72, 73), 'speaking': 74, 'transcript': (107, 112), 'answers': (123, 124)},
            4: {'listening': (75, 80), 'reading': (81, 92), 'writing': (93, 94), 'speaking': 95, 'transcript': (113, 118), 'answers': (125, 126)},
        },
    },
    18: {
        'year': 2023,
        'pdf': SOURCE_ROOT / '真题4-18/剑18+音频/剑桥雅思真题18.pdf',
        'ocr': OCR_ROOT / 'cambridge-18-ocr.pdf',
        'audio': SOURCE_ROOT / '剑雅听力音频/18音频',
        'audioPattern': r'Test ([1-4]) Part ([1-4])\.mp3$',
        'tests': {
            1: {'listening': (12, 17), 'reading': (18, 30), 'writing': (31, 32), 'speaking': 33, 'transcript': (101, 105), 'answers': (121, 122)},
            2: {'listening': (34, 40), 'reading': (41, 53), 'writing': (54, 55), 'speaking': 56, 'transcript': (106, 110), 'answers': (123, 124)},
            3: {'listening': (57, 62), 'reading': (63, 76), 'writing': (77, 78), 'speaking': 79, 'transcript': (111, 115), 'answers': (125, 126)},
            4: {'listening': (80, 85), 'reading': (86, 97), 'writing': (98, 99), 'speaking': 100, 'transcript': (116, 120), 'answers': (127, 128)},
        },
    },
    19: {
        'year': 2024,
        'pdf': SOURCE_ROOT / '剑19/剑19（A类）.pdf',
        'ocr': OCR_ROOT / 'cambridge-19-ocr.pdf',
        'audio': SOURCE_ROOT / '剑19/IELTS 19 Audio',
        'audioPattern': r'Test([1-4]) Part([1-4])\.mp3$',
        'tests': {
            1: {'listening': (12, 17), 'reading': (18, 31), 'writing': (32, 33), 'speaking': 34, 'transcript': (101, 105), 'answers': (122, 123), 'reviewPages': [17, 21]},
            2: {'listening': (35, 41), 'reading': (42, 53), 'writing': (54, 55), 'speaking': 56, 'transcript': (106, 110), 'answers': (124, 125), 'reviewPages': [106]},
            3: {'listening': (57, 63), 'reading': (64, 76), 'writing': (77, 78), 'speaking': 79, 'transcript': (111, 115), 'answers': (126, 127), 'reviewPages': [111]},
            4: {'listening': (80, 85), 'reading': (86, 97), 'writing': (98, 99), 'speaking': 100, 'transcript': (116, 121), 'answers': (128, 129)},
        },
    },
    20: {
        'year': 2025,
        'pdf': SOURCE_ROOT / '剑桥雅思20学术类.pdf',
        'ocr': OCR_ROOT / 'cambridge-20-ocr.pdf',
        'audio': SOURCE_ROOT / 'IELTS 20 Audio',
        'audioPattern': r'T([1-4]) P([1-4])\.mp3$',
        'tests': {
            1: {'listening': (12, 17), 'reading': (18, 30), 'writing': (31, 32), 'speaking': 33, 'transcript': (99, 104), 'answers': (120, 121), 'reviewPages': [22, 27]},
            2: {'listening': (34, 39), 'reading': (40, 51), 'writing': (52, 53), 'speaking': 54, 'transcript': (105, 108), 'answers': (122, 123), 'reviewPages': [105, 109]},
            3: {'listening': (55, 60), 'reading': (61, 73), 'writing': (74, 75), 'speaking': 76, 'transcript': (109, 114), 'answers': (124, 125), 'reviewPages': [65]},
            4: {'listening': (77, 82), 'reading': (83, 95), 'writing': (96, 97), 'speaking': 98, 'transcript': (115, 119), 'answers': (126, 127), 'reviewPages': [83, 87, 115]},
        },
    },
}


VISUAL_RE = re.compile(
    r'\b(label|complete)\s+(?:the\s+)?(?:map|plan|diagram|flow\s*chart)|'
    r'\b(?:map|plan|diagram|flow\s*chart)\s+below\b',
    re.I,
)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha1_file(path):
    digest = hashlib.sha1()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_ocr(book, config):
    if not config.get('ocr'):
        return config['pdf']
    target = config['ocr']
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    ocr_mode = '--force-ocr' if config.get('forceOcr') else '--skip-text'
    subprocess.run([
        'ocrmypdf', ocr_mode, '--deskew', '--rotate-pages', '--jobs', '4',
        '--optimize', '0', '--output-type', 'pdf', str(config['pdf']), str(target),
    ], check=True)
    return target


def clean_page_text(value):
    value = (value or '').replace('\u00a0', ' ').replace('\u0000', '')
    return '\n'.join(line.rstrip() for line in value.splitlines()).strip()


def page_text(reader, page):
    return clean_page_text(reader.pages[page - 1].extract_text() or '')


def pages_text(reader, first, last):
    return '\n\n'.join(f'=== PAGE {page} ===\n{page_text(reader, page)}' for page in range(first, last + 1))


def render_page(pdf, page, dpi, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ielts-page-') as temp_dir:
        prefix = Path(temp_dir) / 'page'
        subprocess.run([
            'pdftoppm', '-f', str(page), '-l', str(page), '-singlefile', '-r', str(dpi),
            '-jpeg', '-jpegopt', 'quality=94', str(pdf), str(prefix),
        ], check=True)
        shutil.copyfile(prefix.with_suffix('.jpg'), target)


def find_task_visual_bounds(image_path, image_height):
    output = subprocess.check_output([
        'tesseract', str(image_path), 'stdout', '-l', 'eng', 'tsv',
    ], text=True, stderr=subprocess.DEVNULL)
    rows = list(csv.DictReader(output.splitlines(), delimiter='\t'))
    lines = {}
    for row in rows:
        text = str(row.get('text') or '').strip()
        if not text:
            continue
        key = (row.get('block_num'), row.get('par_num'), row.get('line_num'))
        lines.setdefault(key, []).append(row)
    start_candidates = []
    footer_candidates = []
    for line_rows in lines.values():
        text = ' '.join(str(row.get('text') or '') for row in line_rows)
        top = min(int(row.get('top') or 0) for row in line_rows)
        if re.search(r'\b150\b', text) and re.search(r'word', text, re.I):
            start_candidates.append(max(int(row.get('top') or 0) + int(row.get('height') or 0) for row in line_rows))
        footer_marker = re.search(r'(?:>|\[[A-Za-z]|\bp\.?).*\d|\d.*(?:>|\[[A-Za-z]|\bp\.?)', text, re.I)
        if top > image_height * 0.74 and footer_marker:
            footer_candidates.append(top)
    return (
        max(start_candidates) if start_candidates else 0,
        min(footer_candidates) if footer_candidates else 0,
    )


def crop_task_visual(source, target):
    image = Image.open(source).convert('RGB')
    width, height = image.size
    detected_start, detected_footer = find_task_visual_bounds(source, height)
    top = min(max(detected_start + 12, int(height * 0.32)), int(height * 0.62)) if detected_start else int(height * 0.42)
    bottom = min(int(height * 0.91), detected_footer - 12) if detected_footer else int(height * 0.91)
    base = image.crop((int(width * 0.035), top, int(width * 0.965), bottom))
    grayscale = base.convert('L')
    mask = grayscale.point(lambda value: 255 if value < 248 else 0)
    bbox = mask.getbbox()
    if bbox:
        left, upper, right, lower = bbox
        pad = max(20, int(width * 0.012))
        left = max(0, left - pad)
        upper = max(0, upper - pad)
        right = min(base.width, right + pad)
        lower = min(base.height, lower + pad)
        base = base.crop((left, upper, right, lower))
    target.parent.mkdir(parents=True, exist_ok=True)
    base.save(target, 'JPEG', quality=94, optimize=True)


def fingerprint_visual(temp_path, output_dir, stem):
    output_dir.mkdir(parents=True, exist_ok=True)
    digest = sha1_file(temp_path)[:10]
    target = output_dir / f'{stem}-{digest}.jpg'
    if not target.exists():
        shutil.copyfile(temp_path, target)
    return target


def discover_audio(config):
    pattern = re.compile(config['audioPattern'], re.I)
    found = {test: {} for test in config['tests']}
    part_map = config.get('audioPartMap', {})
    for audio_path in config['audio'].rglob('*.mp3'):
        match = pattern.search(audio_path.name)
        if match:
            test = int(match.group(1))
            part = int(match.group(2))
            part = int(part_map.get(f'{test}:{part}', part))
            if test in found:
                found[test][part] = audio_path
    for test in config['tests']:
        if sorted(found[test]) != [1, 2, 3, 4]:
            raise RuntimeError(f'missing-audio-parts:book-{config["book"]}:test-{test}:{sorted(found[test])}')
    return found


def probe_audio(path):
    output = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration,size,bit_rate:stream=codec_name,sample_rate,channels,bit_rate',
        '-of', 'json', str(path),
    ], text=True)
    return json.loads(output)


def packet_duration(path):
    output = subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'a:0',
        '-show_entries', 'packet=duration_time', '-of', 'csv=p=0', str(path),
    ], text=True)
    return sum(float(value.strip().split(',')[0]) for value in output.splitlines() if value.strip())


def build_audio(book, config, output_root):
    config['book'] = book
    sources = discover_audio(config)
    audio_dir = output_root / 'listening/audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    result = {}
    for test in sorted(config['tests']):
        source_paths = [sources[test][part] for part in range(1, 5)]
        source_duration = sum(packet_duration(item) for item in source_paths)
        with tempfile.TemporaryDirectory(prefix=f'ielts-{book}-audio-') as temp_dir:
            temp_audio = Path(temp_dir) / f'cambridge-ielts-{book}-test-{test}.mp3'
            command = ['ffmpeg', '-hide_banner', '-loglevel', 'error']
            for source_path in source_paths:
                command.extend(['-i', str(source_path)])
            filters = ';'.join(f'[{index}:a]asetpts=PTS-STARTPTS[a{index}]' for index in range(4))
            filters += ';' + ''.join(f'[a{index}]' for index in range(4)) + 'concat=n=4:v=0:a=1[outa]'
            command.extend([
                '-filter_complex', filters,
                '-map', '[outa]', '-map_metadata', '-1', '-vn', '-ac', '1', '-ar', '32000',
                '-codec:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '0', '-y', str(temp_audio),
            ])
            subprocess.run(command, check=True)
            digest = sha1_file(temp_audio)[:10]
            name = f'cambridge-ielts-{book}-test-{test}-{digest}-64k-mono.mp3'
            target = audio_dir / name
            if not target.exists():
                shutil.copyfile(temp_audio, target)
        probe = probe_audio(target)
        stream = probe['streams'][0]
        if stream.get('codec_name') != 'mp3' or int(stream.get('sample_rate', 0)) != 32000 or int(stream.get('channels', 0)) != 1:
            raise RuntimeError(f'audio-format:book-{book}:test-{test}')
        duration = packet_duration(target)
        if abs(duration - source_duration) > 0.6:
            raise RuntimeError(f'audio-duration:book-{book}:test-{test}:{source_duration:.2f}:{duration:.2f}')
        result[test] = {
            'localPath': str(target.relative_to(ROOT)),
            'cloudPath': f'_content/ielts-academic/cambridge-{book}/listening/audio/{name}',
            'durationSec': round(duration, 2),
            'sourceDurationSec': round(source_duration, 2),
            'durationDiffSec': round(duration - source_duration, 3),
            'size': int(probe['format']['size']),
            'sources': [str(item) for item in source_paths],
            'probe': probe,
        }
    return result


def build_visuals(book, config, reader, output_root):
    visual_dir = output_root / 'assets/question-visuals-v1'
    task_dir = output_root / 'writing/visuals-v3'
    speaking_dir = output_root / 'speaking/source-pages-v1'
    visual_assets = {}
    writing_assets = {}
    speaking_assets = {}
    for test, layout in config['tests'].items():
        visual_pages = []
        for section in ('listening', 'reading'):
            first, last = layout[section]
            for page in range(first, last + 1):
                if VISUAL_RE.search(page_text(reader, page)):
                    visual_pages.append(page)
        for page in sorted(set(visual_pages)):
            with tempfile.TemporaryDirectory(prefix='ielts-visual-') as temp_dir:
                temp_path = Path(temp_dir) / 'page.jpg'
                render_page(config['pdf'], page, 180, temp_path)
                target = fingerprint_visual(temp_path, visual_dir, f'test-{test}-page-{page}')
            visual_assets[str(page)] = {
                'localPath': str(target.relative_to(ROOT)),
                'cloudPath': f'_content/ielts-academic/cambridge-{book}/assets/question-visuals-v1/{target.name}',
                'alt': f'Cambridge IELTS {book} Test {test} original question visual',
            }
        task_page = layout['writing'][0]
        with tempfile.TemporaryDirectory(prefix='ielts-task-visual-') as temp_dir:
            rendered = Path(temp_dir) / 'task-page.jpg'
            cropped = Path(temp_dir) / 'task-visual.jpg'
            render_page(config.get('ocr') or config['pdf'], task_page, 300, rendered)
            crop_task_visual(rendered, cropped)
            target = fingerprint_visual(cropped, task_dir, f'test-{test}-task-1-visual')
        writing_assets[str(test)] = {
            'localPath': str(target.relative_to(ROOT)),
            'cloudPath': f'_content/ielts-academic/cambridge-{book}/writing/visuals-v3/{target.name}',
            'alt': f'Cambridge IELTS {book} Test {test} Writing Task 1 visual',
        }
        speaking_page = layout['speaking']
        with tempfile.TemporaryDirectory(prefix='ielts-speaking-page-') as temp_dir:
            rendered = Path(temp_dir) / 'speaking.jpg'
            render_page(config['pdf'], speaking_page, 160, rendered)
            target = fingerprint_visual(rendered, speaking_dir, f'test-{test}-speaking')
        speaking_assets[str(test)] = {
            'localPath': str(target.relative_to(ROOT)),
            'cloudPath': f'_content/ielts-academic/cambridge-{book}/speaking/source-pages-v1/{target.name}',
            'alt': f'Cambridge IELTS {book} Test {test} Speaking original page',
        }
    return visual_assets, writing_assets, speaking_assets


def prepare_book(book, config):
    if not config['tests']:
        raise RuntimeError(f'page-map-missing:book-{book}')
    if not config['pdf'].exists():
        raise FileNotFoundError(config['pdf'])
    text_pdf = ensure_ocr(book, config)
    reader = PdfReader(str(text_pdf))
    official_listening_pdf = config.get('officialListeningPdf')
    official_listening_reader = PdfReader(str(official_listening_pdf)) if official_listening_pdf else None
    output_root = ROOT / f'data/ielts-academic/cambridge-{book}'
    extraction_dir = output_root / 'source-extraction'
    audio = build_audio(book, config, output_root)
    visual_assets, writing_assets, speaking_assets = build_visuals(book, config, reader, output_root)
    tests = {}
    for test, layout in config['tests'].items():
        listening_override = (config.get('officialListeningTests') or {}).get(test)
        listening_text = pages_text(official_listening_reader, *listening_override) if listening_override else pages_text(reader, *layout['listening'])
        reading_text = pages_text(reader, *layout['reading'])
        writing_text = pages_text(reader, *layout['writing'])
        speaking_text = pages_text(reader, layout['speaking'], layout['speaking'])
        transcript_override = (config.get('officialListeningTranscripts') or {}).get(test)
        transcript_text = pages_text(official_listening_reader, *transcript_override) if transcript_override else pages_text(reader, *layout['transcript'])
        answer_text = pages_text(reader, *layout['answers'])
        listening_answer_pages = (config.get('officialListeningAnswers') or {}).get(test)
        if listening_answer_pages:
            answer_text += '\n\n=== OFFICIAL LISTENING ANSWER SUPPLEMENT ===\n' + pages_text(official_listening_reader, *listening_answer_pages)
        supplement_dir = output_root / 'source-supplements'
        supplement_files = sorted(supplement_dir.glob(f'test-{test}-part-*.txt'))
        audio_transcript_text = '\n\n'.join(
            f'=== {item.name} ===\n{item.read_text(encoding="utf-8").strip()}'
            for item in supplement_files
        )
        visual_pages = sorted({
            page for page in range(layout['listening'][0], layout['reading'][1] + 1)
            if VISUAL_RE.search(page_text(reader, page))
        })
        test_visual_assets = {str(page): visual_assets[str(page)] for page in visual_pages if str(page) in visual_assets}
        for official_page, original_page in ((config.get('officialListeningVisualPageMap') or {}).get(test) or {}).items():
            asset = visual_assets.get(str(original_page))
            if asset:
                test_visual_assets[str(official_page)] = asset
        item = {
            'bookNumber': book,
            'year': config['year'],
            'sourceFile': config['pdf'].name,
            'sourcePdf': str(config['pdf']),
            'textPdf': str(text_pdf),
            'officialListeningPdf': str(official_listening_pdf) if (listening_override or transcript_override or listening_answer_pages) else '',
            'testNumber': test,
            'layout': layout,
            'visualPages': visual_pages,
            'listeningText': listening_text,
            'readingText': reading_text,
            'writingText': writing_text,
            'speakingText': speaking_text,
            'transcriptText': transcript_text,
            'audioTranscriptText': audio_transcript_text,
            'answerText': answer_text,
            'reviewPages': layout.get('reviewPages', []),
            'audio': audio[test],
            'writingVisual': writing_assets[str(test)],
            'speakingPage': speaking_assets[str(test)],
            'visualAssets': test_visual_assets,
        }
        write_json(extraction_dir / f'test-{test}.json', item)
        tests[str(test)] = {
            'layout': layout,
            'visualPages': visual_pages,
            'audio': audio[test],
            'writingVisual': writing_assets[str(test)],
            'speakingPage': speaking_assets[str(test)],
        }
    report = {
        'bookNumber': book,
        'year': config['year'],
        'sourcePdf': str(config['pdf']),
        'textPdf': str(text_pdf),
        'audioRoot': str(config['audio']),
        'tests': tests,
        'errors': [],
    }
    write_json(output_root / 'source-preparation-report.json', report)
    return report


def main():
    selected = [int(value) for value in __import__('sys').argv[1:] if value.isdigit()] or sorted(BOOKS)
    reports = []
    for book in selected:
        if book not in BOOKS:
            raise RuntimeError(f'unsupported-book:{book}')
        reports.append(prepare_book(book, BOOKS[book]))
    print(json.dumps({
        'books': selected,
        'tests': sum(len(report['tests']) for report in reports),
        'errors': [error for report in reports for error in report['errors']],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
