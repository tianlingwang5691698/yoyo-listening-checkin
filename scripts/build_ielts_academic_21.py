#!/usr/bin/env python3

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path('/Users/wangtianlong/工作/01_教学与备考/备考/雅思总类/核心资料库/雅思真题/雅思A类全套4-21')
PDF_PATH = SOURCE_ROOT / '剑桥雅思21（A类）.pdf'
AUDIO_ROOT = SOURCE_ROOT / 'C21音频'
OUTPUT_ROOT = ROOT / 'data/ielts-academic/cambridge-21'
ASSET_DIR = OUTPUT_ROOT / 'assets/pages'
AUDIO_DIR = OUTPUT_ROOT / 'listening/audio'
CLOUD_ROOT = '_content/ielts-academic/cambridge-21'


TESTS = {
    1: {'listening': range(11, 17), 'reading': range(17, 30), 'writing': (30, 31), 'speaking': 32},
    2: {'listening': range(33, 39), 'reading': range(39, 52), 'writing': (52, 53), 'speaking': 54},
    3: {'listening': range(55, 61), 'reading': range(61, 73), 'writing': (73, 74), 'speaking': 75},
    4: {'listening': range(76, 82), 'reading': range(82, 95), 'writing': (95, 96), 'speaking': 97},
}

LISTENING_PAGE_STARTS = {
    1: {11: 1, 12: 11, 13: 17, 14: 21, 15: 25, 16: 31},
    2: {33: 1, 34: 11, 35: 15, 36: 21, 37: 27, 38: 31},
    3: {55: 1, 56: 11, 57: 15, 58: 21, 59: 25, 60: 31},
    4: {76: 1, 77: 11, 78: 15, 79: 21, 80: 24, 81: 31},
}

READING_LAYOUT = {
    1: [
        {'pages': [17, 18], 'questionPages': {19: 1, 20: 8}, 'range': (1, 13)},
        {'pages': [21, 22], 'questionPages': {23: 14, 24: 18, 25: 22}, 'range': (14, 26)},
        {'pages': [26, 27], 'questionPages': {28: 27, 29: 31}, 'range': (27, 40)},
    ],
    2: [
        {'pages': [39, 40], 'questionPages': {41: 1, 42: 6}, 'range': (1, 13)},
        {'pages': [43, 44], 'questionPages': {45: 14, 46: 22}, 'range': (14, 26)},
        {'pages': [47, 48], 'questionPages': {49: 27, 50: 30, 51: 36}, 'range': (27, 40)},
    ],
    3: [
        {'pages': [61, 62], 'questionPages': {63: 1, 64: 8}, 'range': (1, 13)},
        {'pages': [65, 66], 'questionPages': {67: 14, 68: 19}, 'range': (14, 26)},
        {'pages': [69, 70], 'questionPages': {71: 27, 72: 35}, 'range': (27, 40)},
    ],
    4: [
        {'pages': [82, 83], 'questionPages': {84: 1, 85: 8}, 'range': (1, 13)},
        {'pages': [86, 87], 'questionPages': {88: 14, 89: 24}, 'range': (14, 26)},
        {'pages': [90, 91], 'questionPages': {92: 27, 93: 33, 94: 37}, 'range': (27, 40)},
    ],
}

LISTENING_ANSWERS = {
    1: ['10|ten', 'weather', 'safety', 'discount', 'dictionary', 'certificate', 'towel', 'cafe|café', 'videos', 'lockers', 'A', 'B', 'A', 'A', 'A', 'C', 'C', 'A', 'B', 'C', 'B', 'D', 'C', 'E', 'G', 'B', 'F', 'H', 'A', 'E', 'metal|metals', 'slow', 'demand', 'equator', 'recycle', 'fungus', 'weather', 'strong', 'roots', 'soil'],
    2: ['the 13th of January|13th January|13 January|13.01|13.1', '48|forty-eight|forty eight', 'pizza', 'India', 'mirror', 'the 6th of April|6th April|6 April|06.04|6.4', 'natural', '67.50|sixty-seven fifty|sixty seven fifty', 'shirt', 'hammer', 'B', 'E', 'C', 'D', 'F', 'B', 'D', 'A', 'H', 'E', 'B', 'E', 'C', 'D', 'A', 'C', 'C', 'D', 'F', 'A', 'pollution', 'tax', 'chocolate', 'timing', 'cost', 'rules', 'diving', 'vegan', 'wifi|wi-fi', 'videos'],
    3: ['Northern', 'week', '250|two hundred and fifty', 'voucher', 'window', 'books', 'blanket', 'dolphins', 'Drum', 'Italian', 'C', 'E', 'B', 'E', 'B', 'C', 'F', 'A', 'B', 'D', 'B', 'D', 'D', 'E', 'G', 'B', 'F', 'A', 'H', 'D', 'disease', 'ecosystem', 'holiday|holidays', 'pets', 'sugar', 'light', 'virus', 'behaviour|behavior', 'database', 'photograph'],
    4: ['Leigh', 'motorbike', 'hairdresser', 'suit', 'laptop', 'Monday', 'coffee', 'books', 'plants', 'cinema', 'C', 'E', 'A', 'B', 'C', 'G', 'D', 'A', 'F', 'B', 'B', 'A', 'B', 'B', 'E', 'I', 'A', 'D', 'H', 'G', 'routine', 'trials', 'calming', 'pillows', 'anxiety', 'medication', 'awake', 'distraction', 'nature', 'volume'],
}

READING_ANSWERS = {
    1: ['mining', 'education', 'notes', 'journals', 'Venice', 'canteen', 'friends', 'TRUE', 'NOT GIVEN', 'FALSE', 'NOT GIVEN', 'TRUE', 'TRUE', 'C', 'B', 'A', 'G', 'breath', 'questionnaire', 'wellbeing', 'depression', 'C', 'A', 'B', 'D', 'C', 'B', 'A', 'C', 'A', 'H', 'E', 'I', 'A', 'G', 'C', 'YES', 'NOT GIVEN', 'NO', 'YES'],
    2: ['rats', 'visual', 'half', 'temperature', 'vivid', 'TRUE', 'FALSE', 'NOT GIVEN', 'FALSE', 'TRUE', 'FALSE', 'NOT GIVEN', 'NOT GIVEN', 'E', 'G', 'C', 'D', 'B', 'A', 'B', 'D', 'prosperity', 'whistles', 'bodies', 'ancestors', 'jewellery|jewelry', 'B', 'A', 'C', 'F', 'G', 'I', 'C', 'A', 'D', 'NO', 'NOT GIVEN', 'NO', 'YES', 'B'],
    3: ['dust', 'blood', 'coat', 'horns', 'habitat', 'routes', 'streams', 'FALSE', 'FALSE', 'TRUE', 'NOT GIVEN', 'TRUE', 'NOT GIVEN', 'NOT GIVEN', 'FALSE', 'NOT GIVEN', 'TRUE', 'FALSE', 'lanes', 'boarding', 'wheelchairs', 'fuel', 'flood', 'smartcards', 'gates', 'queues', 'A', 'A', 'D', 'A', 'E', 'F', 'D', 'B', 'NO', 'NOT GIVEN', 'NOT GIVEN', 'YES', 'YES', 'NO'],
    4: ['TRUE', 'FALSE', 'TRUE', 'NOT GIVEN', 'NOT GIVEN', 'FALSE', 'TRUE', 'cow dung', 'fermentation|fermentation process', 'pipes', 'time', 'money', 'price', 'I', 'J', 'H', 'B', 'E', 'F', 'NO', 'NOT GIVEN', 'YES', 'NO', 'C', 'D', 'D', 'G', 'J', 'I', 'C', 'A', 'E', 'NO', 'NOT GIVEN', 'NOT GIVEN', 'YES', 'B', 'C', 'D', 'A'],
}

SPEAKING = {
    1: {
        'part1': ['Where do you go to get a haircut?', 'Have you changed your hairstyle recently?', 'Would you ever change the colour of your hair?', 'Do you enjoy going to the hairdresser/barber?'],
        'part2': ['Describe a time when you used information for tourists, for example from a guidebook or online. You should say: where you got this information; what place this information was about; what information you got; and explain whether this information was very helpful for you.'],
        'part3': ['What are the most popular kinds of holidays for people from your country to go on?', 'Do you think most people prefer to have a holiday abroad rather than in their own country?', 'Why do some people want to do absolutely nothing when they go away on holiday?', 'What are the kinds of tourist attraction that visitors to your country like to see?', 'Do you think tourist attractions such as museums should be free for local people to visit?', 'What can make a tourist attraction disappointing for visitors?'],
    },
    2: {
        'part1': ['How well do you know the capital city of your country?', 'Do you think cities are exciting places to live?', 'Why do some people dislike living in a city?', 'If you could visit any city in the world, where would you go?'],
        'part2': ['Describe a time when you read or heard something that you thought was not true. You should say: where you read/heard this; what you read/heard; why you thought it was not true; and explain how you felt about reading/hearing this thing that you thought was not true.'],
        'part3': ["Do you think children are more honest than adults?", "Why do adults tell children it's important to be honest?", 'Do you think there are sometimes good reasons for adults not to tell children the truth?', 'Are there any claims in advertisements that are sometimes not true?', "Why do people still buy things even when they know advertisements aren't completely accurate?", 'Do you think advertisements that are dishonest should be banned?'],
    },
    3: {
        'part1': ['When you go shopping, do you usually pay for things by cash or by card?', 'Are you generally careful about how much money you spend?', "Have you ever spent money on something you didn't need?", 'How important is it to you to save money for the future?'],
        'part2': ['Describe an interesting garden or park you have seen. You should say: where this garden or park is; how big it is; what you saw in this garden/park; and explain why you think this garden/park is interesting.'],
        'part3': ['What are the advantages of having a home with a garden?', 'How could people living in apartment blocks grow plants and vegetables?', 'How interested are people in your country in TV shows and magazines about gardens?', 'Do you think that gardening is a hobby mainly for older people?', 'What are the benefits for people of gardening as a hobby?', 'Will gardening be a more popular hobby in the future?'],
    },
    4: {
        'part1': ['When do you usually eat bread?', 'How important is bread in your culture?', 'Have you tried any kinds of bread from other countries?', 'Would you be interested in learning how to make bread?'],
        'part2': ['Describe a person you know who is very competitive. You should say: who this person is; what this person is competitive about; how successful this person is; and explain why you think this person is so competitive.'],
        'part3': ['What kinds of competitions do people like to enter in your country?', 'What do you think is the best kind of prize to win in a competition?', 'Why do people like watching quiz shows and other competitions on TV?', 'How important is it to be very competitive at sport?', 'Do you think sportspeople perform better when they play against competitors who are stronger than they are?', 'Why do some people think that taking part in sport is more important than winning?'],
    },
}


def sha1_bytes(data):
    return hashlib.sha1(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def run(command):
    subprocess.run(command, check=True)


def page_text(reader, page_number):
    return (reader.pages[page_number - 1].extract_text() or '').replace('\u00a0', ' ')


def clean_text(value):
    lines = []
    for line in value.replace('\r', '\n').splitlines():
        line = re.sub(r'[ \t]+', ' ', line).strip()
        if not line or line in {'Audioscripts', 'Listening', 'Reading', 'Writing', 'Speaking'}:
            continue
        if re.fullmatch(r'(?:Test|TEST) [1-4]|\d+', line):
            continue
        line = re.sub(r'\s+0(?=\d{2}\b)', ' ', line)
        lines.append(line)
    return '\n'.join(lines).strip()


def render_pages():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    images = {}
    with tempfile.TemporaryDirectory(prefix='ielts21-pages-') as temp_dir:
        for page in range(11, 98):
            prefix = Path(temp_dir) / f'page-{page:03d}'
            run([
                'pdftoppm', '-f', str(page), '-l', str(page), '-singlefile',
                '-r', '130', '-jpeg', '-jpegopt', 'quality=88', str(PDF_PATH), str(prefix)
            ])
            rendered = prefix.with_suffix('.jpg')
            body = rendered.read_bytes()
            name = f'c21-page-{page:03d}-{sha1_bytes(body)[:10]}.jpg'
            target = ASSET_DIR / name
            if not target.exists():
                shutil.copyfile(rendered, target)
            images[page] = {
                'cloudPath': f'{CLOUD_ROOT}/assets/pages/{name}',
                'localPath': str(target.relative_to(ROOT)),
                'alt': f'Cambridge IELTS 21 original page {page}'
            }
    return images


def discover_audio():
    found = {test: [] for test in TESTS}
    pattern = re.compile(r'C21T([1-4])P([1-4])(?:\.([12]))?\.mp3$', re.I)
    for path in AUDIO_ROOT.rglob('*.mp3'):
        match = pattern.search(path.name)
        if not match:
            continue
        test, part, segment = (int(match.group(1)), int(match.group(2)), int(match.group(3) or 0))
        found[test].append((part, segment, path))
    for test, rows in found.items():
        rows.sort(key=lambda row: (row[0], row[1]))
        if not rows:
            raise RuntimeError(f'missing-audio-test-{test}')
    return found


def build_audio():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    result = {}
    source_map = discover_audio()
    with tempfile.TemporaryDirectory(prefix='ielts21-audio-') as temp_dir:
        for test, rows in source_map.items():
            temp_mp3 = Path(temp_dir) / f'cambridge-ielts-21-test-{test}.mp3'
            inputs = []
            filters = []
            for index, (_, _, path) in enumerate(rows):
                inputs.extend(['-i', str(path)])
                filters.append(f'[{index}:a]')
            concat_filter = ''.join(filters) + f'concat=n={len(rows)}:v=0:a=1[a]'
            run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error', *inputs,
                '-filter_complex', concat_filter, '-map', '[a]', '-map_metadata', '-1', '-vn', '-ac', '1', '-ar', '32000',
                '-codec:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '0', '-y', str(temp_mp3)
            ])
            body = temp_mp3.read_bytes()
            name = f'cambridge-ielts-21-test-{test}-{sha1_bytes(body)[:10]}-64k-mono.mp3'
            target = AUDIO_DIR / name
            if not target.exists():
                shutil.copyfile(temp_mp3, target)
            probe = subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_entries',
                'format=duration,size,bit_rate:stream=codec_name,sample_rate,channels,bit_rate',
                '-of', 'json', str(target)
            ], text=True)
            meta = json.loads(probe)
            duration = round(float(meta['format']['duration']), 2)
            result[test] = {
                'localPath': str(target.relative_to(ROOT)),
                'cloudPath': f'{CLOUD_ROOT}/listening/audio/{name}',
                'durationSec': duration,
                'probe': meta,
                'sources': [str(path) for _, _, path in rows]
            }
    return result


def answer_fields(raw):
    accepted = [part.strip() for part in str(raw).split('|') if part.strip()]
    return accepted[0], accepted


def image_with_alt(images, page, alt):
    return dict(images[page], alt=alt)


def build_transcripts(reader):
    combined = '\n\n'.join(page_text(reader, page) for page in range(98, 118))
    starts = {}
    for test in TESTS:
        match = re.search(rf'\bTEST\s+{test}\b', combined, re.I)
        if not match:
            raise RuntimeError(f'missing-audioscript-test-{test}')
        starts[test] = match.start()
    transcripts = {}
    for test in TESTS:
        end = starts.get(test + 1, len(combined))
        text = combined[starts[test]:end]
        text = re.sub(rf'^.*?\bTEST\s+{test}\b', '', text, count=1, flags=re.I | re.S)
        transcripts[test] = clean_text(text)
    return transcripts


def build_listening(images, audio, transcripts):
    items = []
    for test in TESTS:
        questions = []
        source_at = {number: page for page, number in LISTENING_PAGE_STARTS[test].items()}
        for number, raw_answer in enumerate(LISTENING_ANSWERS[test], start=1):
            answer, accepted = answer_fields(raw_answer)
            part = 1 if number <= 10 else 2 if number <= 20 else 3 if number <= 30 else 4
            question = {
                'number': number,
                'prompt': f'Complete Question {number} using the original paper page above.',
                'questionType': 'blank',
                'sectionKey': f'PART {part}',
                'sectionTitle': f'PART {part} · Questions {(part - 1) * 10 + 1}-{part * 10}',
                'answer': answer,
                'acceptedAnswers': accepted,
            }
            if number in source_at:
                page = source_at[number]
                question['sourceImages'] = [image_with_alt(images, page, f'Cambridge IELTS 21 Test {test} Listening page {page}')]
            questions.append(question)
        item_id = f'ielts-academic-21-test-{test}-listening'
        items.append({
            '_id': item_id,
            'id': item_id,
            'title': f'Cambridge IELTS 21 Test {test} Listening',
            'year': 2026,
            'sourceYear': 2026,
            'city': 'Cambridge',
            'district': f'Test {test}',
            'examType': 'IELTS Academic',
            'stage': '雅思',
            'sourceType': 'cambridge-ielts-academic',
            'sourceFile': PDF_PATH.name,
            'book': 'Cambridge IELTS 21 Academic',
            'testNumber': test,
            'audioCloudPath': audio[test]['cloudPath'],
            'audioLocalPath': audio[test]['localPath'],
            'durationSec': audio[test]['durationSec'],
            'hasAudio': True,
            'hasTranscript': True,
            'transcript': transcripts[test],
            'questions': questions,
            'questionCount': 40,
            'contentRevision': 1,
            'status': 'published-candidate',
        })
    write_json(OUTPUT_ROOT / 'listening/index.json', items)
    item_dir = OUTPUT_ROOT / 'listening/items-v1'
    for item in items:
        write_json(item_dir / f"{sha1_bytes(item['_id'].encode())}.json", item)
    return items


def build_reading(images):
    passages = []
    for test in TESTS:
        answers = READING_ANSWERS[test]
        for passage_index, layout in enumerate(READING_LAYOUT[test], start=1):
            first, last = layout['range']
            source_at = {number: page for page, number in layout['questionPages'].items()}
            questions = []
            for number in range(first, last + 1):
                answer, accepted = answer_fields(answers[number - 1])
                question = {
                    'number': number,
                    'prompt': f'Complete Question {number} using the original paper page above.',
                    'answer': answer,
                    'acceptedAnswers': accepted,
                    'questionType': 'blank',
                }
                if number in source_at:
                    page = source_at[number]
                    question['sourceImages'] = [image_with_alt(images, page, f'Cambridge IELTS 21 Test {test} Reading question page {page}')]
                questions.append(question)
            passage_id = f'ielts-academic-21-test-{test}-reading-passage-{passage_index}'
            passages.append({
                '_id': passage_id,
                'id': passage_id,
                'title': f'Reading Passage {passage_index}',
                'year': 2026,
                'district': f'Test {test}',
                'examType': 'IELTS Academic',
                'stage': '雅思',
                'section': f'Passage {passage_index}',
                'sectionLabel': f'READING PASSAGE {passage_index}',
                'paperId': f'ielts-academic-21-test-{test}',
                'paperTitle': f'Cambridge IELTS 21 Test {test}',
                'paperOrder': passage_index,
                'sourceType': 'cambridge-ielts-academic',
                'sourceFile': PDF_PATH.name,
                'passage': '',
                'images': [image_with_alt(images, page, f'Cambridge IELTS 21 Test {test} Reading Passage {passage_index} page {page}') for page in layout['pages']],
                'questions': questions,
                'questionCount': len(questions),
                'status': 'published-candidate',
            })
    write_json(OUTPUT_ROOT / 'reading/reading-passages.json', passages)
    return passages


def extract_writing_prompt(reader, page):
    text = clean_text(page_text(reader, page))
    text = re.sub(r'^.*?WRITING\s+TASK\s+[12]', '', text, count=1, flags=re.I | re.S).strip()
    text = re.sub(r'\n\s*\d+\s*$', '', text).strip()
    return text


def build_writing(reader, images):
    items = []
    for test, config in TESTS.items():
        for task_number, page in enumerate(config['writing'], start=1):
            item_id = f'ielts-academic-21-test-{test}-writing-task-{task_number}'
            items.append({
                '_id': item_id,
                'id': item_id,
                'title': f'Cambridge IELTS 21 Test {test} Writing Task {task_number}',
                'year': 2026,
                'city': 'Cambridge',
                'district': f'Test {test}',
                'examType': 'IELTS Academic',
                'stage': '雅思',
                'section': f'Writing Task {task_number}',
                'category': 'IELTS Academic Writing',
                'contentType': f'ielts-writing-task-{task_number}',
                'contentRevision': 1,
                'paperId': f'ielts-academic-21-test-{test}',
                'paperOrder': task_number,
                'sourceType': 'cambridge-ielts-academic',
                'sourceFile': PDF_PATH.name,
                'book': 'Cambridge IELTS 21 Academic',
                'testNumber': test,
                'prompt': extract_writing_prompt(reader, page),
                'directions': f'WRITING TASK {task_number}',
                'images': [image_with_alt(images, page, f'Cambridge IELTS 21 Test {test} Writing Task {task_number} original page')],
                'minWords': 150 if task_number == 1 else 250,
                'score': 9,
                'status': 'published-candidate',
            })
    write_json(OUTPUT_ROOT / 'writing/index.json', items)
    item_dir = OUTPUT_ROOT / 'writing/items-v1'
    for item in items:
        write_json(item_dir / f"{sha1_bytes(item['_id'].encode())}.json", item)
    return items


def build_speaking(images):
    items = []
    for test, config in TESTS.items():
        exercises = []
        for part_key, prompts in SPEAKING[test].items():
            part_number = int(part_key[-1])
            duration = 45 if part_number == 1 else 120 if part_number == 2 else 60
            for index, prompt in enumerate(prompts, start=1):
                exercises.append({
                    'id': f'ielts-academic-21-test-{test}-speaking-part-{part_number}-{index}',
                    'part': part_number,
                    'title': f'Part {part_number} · {index}',
                    'meta': f'{duration} 秒',
                    'prompt': prompt,
                    'maxDurationSec': duration,
                })
        item_id = f'ielts-academic-21-test-{test}-speaking'
        items.append({
            '_id': item_id,
            'id': item_id,
            'title': f'Cambridge IELTS 21 Test {test} Speaking',
            'year': 2026,
            'city': 'Cambridge',
            'district': f'Test {test}',
            'examType': 'IELTS Academic',
            'stage': '雅思',
            'sourceType': 'cambridge-ielts-academic',
            'sourceFile': PDF_PATH.name,
            'book': 'Cambridge IELTS 21 Academic',
            'testNumber': test,
            'images': [image_with_alt(images, config['speaking'], f'Cambridge IELTS 21 Test {test} Speaking original page')],
            'exercises': exercises,
            'questionCount': len(exercises),
            'contentRevision': 1,
            'status': 'published-candidate',
        })
    write_json(OUTPUT_ROOT / 'speaking/index.json', items)
    item_dir = OUTPUT_ROOT / 'speaking/items-v1'
    for item in items:
        write_json(item_dir / f"{sha1_bytes(item['_id'].encode())}.json", item)
    return items


def audit(listening, reading, writing, speaking, audio):
    errors = []
    for test in TESTS:
        listening_item = next(item for item in listening if item['testNumber'] == test)
        test_reading = [item for item in reading if item['paperId'].endswith(f'test-{test}')]
        test_writing = [item for item in writing if item['testNumber'] == test]
        speaking_item = next(item for item in speaking if item['testNumber'] == test)
        if len(listening_item['questions']) != 40:
            errors.append(f'test-{test}-listening-count')
        if sum(len(item['questions']) for item in test_reading) != 40:
            errors.append(f'test-{test}-reading-count')
        if len(test_writing) != 2:
            errors.append(f'test-{test}-writing-count')
        if set(item['part'] for item in speaking_item['exercises']) != {1, 2, 3}:
            errors.append(f'test-{test}-speaking-parts')
        stream = audio[test]['probe']['streams'][0]
        if stream.get('codec_name') != 'mp3' or int(stream.get('channels', 0)) != 1 or int(stream.get('sample_rate', 0)) != 32000:
            errors.append(f'test-{test}-audio-format')
    all_ids = [item['_id'] for item in listening + reading + writing + speaking]
    if len(all_ids) != len(set(all_ids)):
        errors.append('duplicate-id')
    report = {
        'sourcePdf': str(PDF_PATH),
        'sourceAudioRoot': str(AUDIO_ROOT),
        'listeningTests': len(listening),
        'listeningQuestions': sum(len(item['questions']) for item in listening),
        'readingPassages': len(reading),
        'readingQuestions': sum(len(item['questions']) for item in reading),
        'writingTasks': len(writing),
        'speakingTests': len(speaking),
        'speakingExercises': sum(len(item['exercises']) for item in speaking),
        'audio': audio,
        'sampleWritingAnswersImported': False,
        'errors': errors,
    }
    write_json(OUTPUT_ROOT / 'clean-report.json', report)
    if errors:
        raise RuntimeError(','.join(errors))
    return report


def main():
    if not PDF_PATH.exists():
        raise FileNotFoundError(PDF_PATH)
    reader = PdfReader(str(PDF_PATH))
    images = render_pages()
    audio = build_audio()
    transcripts = build_transcripts(reader)
    listening = build_listening(images, audio, transcripts)
    reading = build_reading(images)
    writing = build_writing(reader, images)
    speaking = build_speaking(images)
    report = audit(listening, reading, writing, speaking, audio)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
