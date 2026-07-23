#!/usr/bin/env python3
"""Deterministic reading-content structure cleanup shared by builders."""

from __future__ import annotations

import re


ARTICLE_TITLES = {
    'sh-spring-2017-grammar-vocabulary-a': '“Zootopia” Broke Disney Records',
    'sh-spring-2018-grammar-vocabulary-a': 'My Kid-Free Life',
    'sh-spring-2018-reading-c': 'The Most Important Thing You’re Not Discussing With Your Doctor',
    'sh-spring-2019-grammar-vocabulary-a': 'Start with the end and work backwards',
    'sh-spring-2020-grammar-vocabulary-a': 'The Ball Game of Mesoamerica',
    'sh-spring-2021-grammar-vocabulary-a': 'Why Being in a Band Is Cool',
    'sh-spring-2022-grammar-vocabulary-a': 'The Lights of Aurora',
    'sh-spring-2024-reading-c': 'Why Do Cats Love Boxes So Much?',
    'sh-spring-2026-grammar-vocabulary-a': 'Should You Take Your Shoes off inside the House?',
    'sh-spring-2026-reading-a': 'Passive vs. Active Solar Energy',
    'sh-autumn-2016-grammar-vocabulary-a': 'Bags of Love',
    'sh-autumn-2017-grammar-vocabulary-a': 'In the presence of animals',
    'sh-autumn-2018-reading-c': 'Magazine Articles: More Valuable Than You May Think',
    'sh-autumn-2022-grammar-vocabulary-a': 'How to Start a New Business',
    'sh-autumn-2025-grammar-vocabulary-a': 'She rescued a hare (野兔) and then they bonded',
    'sh-autumn-2025-reading-c': 'How to Save Outdoor Recess',
    'sh-em2-2024-松江-reading-a': 'How to Choose books you’ll love',
    'sh-em2-2019-a-10-qingpu': 'Griffith Observatory (天文台)',
}

ARTICLE_SUBTITLES = {}

LEGACY_TITLE_RESIDUES = {
    'sh-em2-2019-a-10-qingpu': '(天文台)',
}

PAGE_NOISE_RE = re.compile(
    r'(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?',
    re.I,
)

SCORE_PREFIX_RE = re.compile(
    r'^\s*(?:'
    r'[（(]\s*(?:_+\s*\d+\s*_+|\d+)\s*分\s*[）)]|'
    r'[（(]\s*每题\s*(?:_+\s*\d+\s*_+|\d+(?:\.\d+)?)\s*分\s*[；;]\s*共\s*\d+\s*分\s*[）)]|'
    r'\d+\s*[.．、]\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]'
    r')\s*',
    re.I,
)

JUNIOR_DIRECTIONS_RE = re.compile(
    r'^\s*(?:answer\b\s*[.：:]?\s*)?'
    r'(?P<directions>[（(]?\s*根据(?:短文|文章|对话|以下)内容，?\s*选择最恰当的答案\s*[）)]?)?'
    r'\s*(?:[：:]?\s*[（(]\s*(?:共\s*)?\d+\s*分\s*[）)])?\s*',
    re.I,
)

PLAIN_JUNIOR_DIRECTIONS_RE = re.compile(
    r'^\s*(?P<directions>根据(?:短文|文章|对话|以下)内容，?\s*'
    r'(?:选择最恰当的答案|(?:完整)?回答(?:下列)?问题)[.。]?)\s*',
    re.I,
)

CHOICE_HEADING_RE = re.compile(
    r'^\s*(?P<section>[A-D])\s*[.．、)]\s*'
    r'(?P<directions>(?:Choose|Read|Answer)[^（(]{0,220}'
    r'(?:[（(][^）)]*(?:答案|问题)[^）)]*[）)])?)'
    r'\s*(?:[（(]\s*\d+\s*分\s*[）)])?\s*',
    re.I,
)

SECTION_HEADING_RE = re.compile(
    r'^\s*(?P<heading>'
    r'(?:(?:[IVX]+|[Ⅰ-Ⅹ])\s*[.．]?\s*)?(?:Reading Comprehension|Grammar and Vocabulary)'
    r'(?:\s*[（(]\s*\d+\s*分\s*[）)])?'
    r'|Section\s+[A-D]'
    r')\s*',
    re.I,
)

DIRECTIONS_RE = re.compile(
    r'^\s*(?P<directions>Directions\s*[:：]\s*[\s\S]*?'
    r'(?:best\s+fit\s*s?\s+each\s+blank|than\s+you\s+need)\s*[.．]?)\s*',
    re.I,
)

FEWEST_WORDS_RE = re.compile(
    r'^\s*(?P<directions>(?:in\s+)?the\s+fewest\s+possible\s+words\s*[.．]?)\s*',
    re.I,
)


def compact(value: str) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def normalize_title_for_match(value: str) -> str:
    value = compact(value)
    value = value.replace('？', '?').replace('：', ':')
    return value


def strip_known_title(value: str, title: str) -> str:
    if not title:
        return value
    candidates = {
        title,
        title.replace(' vs. ', ' vs.'),
        title.replace(' and then ', '(野兔) and then '),
        title.replace('?', '？'),
    }
    for candidate in sorted(candidates, key=len, reverse=True):
        if normalize_title_for_match(value).lower().startswith(normalize_title_for_match(candidate).lower()):
            return compact(value[len(candidate):])
    return value


def split_sentence_ranges(source: str) -> list[tuple[int, int]]:
    ranges = []
    start = 0
    for index, char in enumerate(source):
        if char not in '.．!?。！？\n':
            continue
        if char == '.' and index and index + 1 < len(source) and source[index - 1].isalpha() and source[index + 1].isalpha():
            continue
        end = index + 1
        while end < len(source) and source[end].isspace():
            end += 1
        if source[start:end].strip():
            ranges.append((start, end))
        start = end
    if source[start:].strip():
        ranges.append((start, len(source)))
    return ranges or [(0, len(source))]


def split_paragraphs(source: str) -> list[str]:
    source = str(source or '').strip()
    blank_blocks = [compact(item) for item in re.split(r'\n\s*\n+', source) if compact(item)]
    if len(blank_blocks) > 1:
        return blank_blocks
    line_blocks = [compact(item) for item in source.splitlines() if compact(item)]
    if 1 < len(line_blocks) <= 30 and sum(map(len, line_blocks)) / len(line_blocks) >= 90:
        return line_blocks
    flat = compact(source)
    sentences = split_sentence_ranges(flat)
    paragraphs = []
    start = sentences[0][0]
    sentence_count = 0
    for index, (_, end) in enumerate(sentences):
        sentence_count += 1
        length = end - start
        next_range = sentences[index + 1] if index + 1 < len(sentences) else None
        next_length = next_range[1] - start if next_range else 0
        if not next_range or (length >= 300 and (sentence_count >= 3 or next_length > 520)) or length >= 520:
            paragraphs.append(compact(flat[start:end]))
            if next_range:
                start = next_range[0]
            sentence_count = 0
    if len(paragraphs) > 1 and len(paragraphs[-1]) < 140:
        paragraphs[-2] = compact(f'{paragraphs[-2]} {paragraphs[-1]}')
        paragraphs.pop()
    return [item for item in paragraphs if item]


def structure_reading_item(item: dict) -> tuple[dict, dict]:
    next_item = dict(item)
    item_id = str(item.get('_id') or item.get('id') or '')
    original = str(item.get('passage') or '')
    value = original
    pollution = []
    directions = compact(item.get('directions'))
    section_heading = compact(item.get('sectionHeading'))
    article_title = ARTICLE_TITLES.get(item_id, '') or compact(item.get('articleTitle'))
    article_subtitle = ARTICLE_SUBTITLES.get(item_id, '') or compact(item.get('articleSubtitle'))

    if PAGE_NOISE_RE.search(value):
        pollution.append('page-watermark')
        value = PAGE_NOISE_RE.sub(' ', value)

    score_match = SCORE_PREFIX_RE.match(value)
    if score_match:
        pollution.append('score-prefix')
        value = value[score_match.end():]

    choice_heading_match = CHOICE_HEADING_RE.match(value)
    if choice_heading_match:
        section_heading = choice_heading_match.group('section').upper()
        directions = compact(choice_heading_match.group('directions'))
        pollution.extend(['section-heading', 'question-directions'])
        value = value[choice_heading_match.end():]

    heading_match = SECTION_HEADING_RE.match(value)
    if heading_match:
        section_heading = compact(heading_match.group('heading'))
        pollution.append('section-heading')
        value = value[heading_match.end():]

    directions_match = DIRECTIONS_RE.match(value)
    if directions_match:
        directions = compact(directions_match.group('directions'))
        pollution.append('directions')
        value = value[directions_match.end():]
    elif item_id.startswith(('sh-em1-', 'sh-em2-')):
        junior_match = PLAIN_JUNIOR_DIRECTIONS_RE.match(value) or JUNIOR_DIRECTIONS_RE.match(value)
        if junior_match and junior_match.end() > 0:
            extracted = compact(junior_match.groupdict().get('directions'))
            if extracted:
                directions = extracted.strip('()（） ')
            if junior_match.end() or re.match(r'^\s*answer\b', value, re.I):
                pollution.append('question-directions')
                value = value[junior_match.end():]

    fewest_match = FEWEST_WORDS_RE.match(value)
    if fewest_match:
        directions = compact(fewest_match.group('directions'))
        pollution.append('directions')
        value = value[fewest_match.end():]

    score_match = SCORE_PREFIX_RE.match(value)
    if score_match:
        pollution.append('score-prefix')
        value = value[score_match.end():]

    before_title = value
    residue = LEGACY_TITLE_RESIDUES.get(item_id, '')
    if residue and compact(value).startswith(residue):
        value = compact(value)[len(residue):].lstrip()
    value = strip_known_title(value, article_title)
    if value != before_title:
        pollution.append('article-title')

    value = compact(value)
    paragraphs = split_paragraphs(value)
    passage = '\n\n'.join(paragraphs)
    was_structured = any(key in item for key in ('directions', 'sectionHeading', 'articleTitle', 'articleSubtitle', 'passageParagraphs'))
    affected = bool(pollution or was_structured)
    if not affected:
        return next_item, {'affected': False, 'pollution': []}

    next_item.update({
        'dataFormat': 'reading-structured-v1',
        'directions': directions,
        'sectionHeading': section_heading,
        'articleTitle': article_title,
        'articleSubtitle': article_subtitle,
        'passageParagraphs': paragraphs,
        'passage': passage,
    })
    if item_id.startswith(('sh-spring-', 'sh-autumn-')):
        next_item['contentRevision'] = max(3, int(item.get('contentRevision') or 0))
    return next_item, {
        'affected': True,
        'pollution': sorted(set(pollution)),
        'paragraphCount': len(paragraphs),
    }
