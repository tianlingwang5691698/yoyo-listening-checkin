#!/usr/bin/env python3
"""Source-faithful structure extraction for Shanghai senior Summary Writing."""

from __future__ import annotations

import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


WORD_NAMESPACE = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

ARTICLE_TITLES = {
    'sh-spring-2017-summary-writing': 'Shyness',
    'sh-spring-2018-summary-writing': 'To Laugh Is Human',
    'sh-spring-2019-summary-writing': 'Where are the bees?',
    'sh-spring-2020-summary-writing': 'Global Cooperation',
    'sh-spring-2023-summary-writing': 'Fiction Reading',
    'sh-spring-2024-summary-writing': 'How to Stay Healthy in Autumn',
    'sh-spring-2025-summary-writing': 'Obstacles to the correct decision',
    'sh-spring-2026-summary-writing': 'I Want to Be a Content Creator',
    'sh-autumn-2017-summary-writing': 'Learning by Rote in the Digital Age',
    'sh-autumn-2018-summary-writing': 'Becoming an attractive employee',
    'sh-autumn-2020-summary-writing': 'Scientists Discover Animal Language',
    'sh-autumn-2023-summary-writing': 'Teenagers should be pulled of the sofa',
    'sh-autumn-2024-summary-writing': 'Obstacles to the correct decision',
    'sh-autumn-2025-summary-writing': 'Art Gallery Visits',
}


def clean_paragraph(value: str) -> str:
    value = str(value or '')
    value = value.replace('\ufeff', '').replace('\u200f', '').replace('\u200e', '')
    value = value.replace('\u00a0', ' ').replace('\u3000', ' ').replace('\f', ' ')
    value = value.replace('\ufe63', '-').replace('\uff0d', '-').replace('\u2011', '-')
    value = value.replace('\u2013', '-').replace('\u2014', '-')
    value = re.sub(r'第\s*\d+\s*页\s*[（(]?\s*共\s*\d+\s*页\s*[）)]?', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def document_paragraphs(path: Path) -> list[str]:
    path = Path(path)
    if path.suffix.lower() == '.docx':
        with zipfile.ZipFile(path) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
        return [
            clean_paragraph(''.join(node.text or '' for node in paragraph.findall('.//w:t', WORD_NAMESPACE)))
            for paragraph in root.findall('.//w:p', WORD_NAMESPACE)
        ]
    result = subprocess.run(
        ['textutil', '-convert', 'txt', '-stdout', str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
        check=False,
    )
    return [clean_paragraph(line) for line in result.stdout.decode('utf-8', errors='ignore').splitlines()]


def extract_summary_source(path: Path, item_id: str) -> dict:
    paragraphs = document_paragraphs(path)
    start = next(
        (index for index, value in enumerate(paragraphs) if re.search(r'Summary Writing', value, re.I)),
        -1,
    )
    if start < 0:
        raise ValueError(f'summary-heading-missing:{path.name}')
    end = next(
        (
            index for index, value in enumerate(paragraphs[start + 1:], start + 1)
            if re.search(r'Translation|Guided Writing', value, re.I)
        ),
        len(paragraphs),
    )
    title = ARTICLE_TITLES.get(item_id, '')
    body = []
    for value in paragraphs[start + 1:end]:
        value = clean_paragraph(value)
        if not value:
            continue
        if re.search(r'Directions\s*[:：]', value, re.I):
            directions_end = re.search(r'possible[.．]', value, re.I)
            if not directions_end:
                continue
            value = clean_paragraph(value[directions_end.end():])
            if not value:
                continue
        value = re.sub(r'^\s*\d{1,3}\s*[.．]\s*[（(]\s*\d+\s*分\s*[）)]\s*', '', value)
        value = re.sub(r'^\s*[（(]?\s*https?://\S+\s*', '', value, flags=re.I)
        value = clean_paragraph(value)
        if title and value == title:
            continue
        if title and title in value:
            value = clean_paragraph(value.split(title, 1)[1])
        if re.fullmatch(r'\d{1,3}\s*[.．]?\s*', value):
            continue
        if re.fullmatch(r'(?:\d{1,3}\s*[.．]?\s*)?(?:[_＿-]+\s*)+', value):
            continue
        value = re.sub(r'\s+(?:\d{1,3}\s*[.．]\s*)?(?:[_＿-]{2,}\s*)+$', '', value)
        if value:
            body.append(value)
    merged = []
    for value in body:
        if merged and value[:1].islower():
            merged[-1] = clean_paragraph(f'{merged[-1]} {value}')
        else:
            merged.append(value)
    if not merged or any(re.search(r'https?://|_{3,}|第\s*\d+\s*页', value) for value in merged):
        raise ValueError(f'summary-body-polluted:{item_id}')
    return {'articleTitle': title, 'articleParagraphs': merged}


def paragraph_anchor(value: str, word_count: int = 8) -> str:
    words = re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", value)
    return ' '.join(words[:word_count])
