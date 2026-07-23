#!/usr/bin/env python3
"""Shared cleaning rules for grammar question display fields."""

import re


SOURCE_WATERMARK_RE = re.compile(
    r'[\[【（(]\s*来源\s*[:：]?\s*[^\]】）)]*[\]】）)]',
    re.IGNORECASE,
)
UNCLOSED_SOURCE_WATERMARK_RE = re.compile(
    r'[\[【（(]\s*来源\s*[:：]?\s*[^]】）)]*$',
    re.IGNORECASE,
)


def strip_source_watermarks(value):
    text = str(value or '')
    cleaned = SOURCE_WATERMARK_RE.sub('', text)
    cleaned = UNCLOSED_SOURCE_WATERMARK_RE.sub('', cleaned)
    if cleaned == text:
        return text
    return re.sub(r'\s+', ' ', cleaned).strip()


def clean_question_source_watermarks(question):
    changes = []
    prompt = question.get('prompt')
    cleaned_prompt = strip_source_watermarks(prompt)
    if cleaned_prompt != prompt:
        changes.append({
            'field': 'prompt',
            'oldValue': prompt,
            'newValue': cleaned_prompt,
        })
        question['prompt'] = cleaned_prompt

    options = question.get('options')
    if isinstance(options, dict):
        for key in ('A', 'B', 'C', 'D'):
            old_value = options.get(key)
            cleaned_value = strip_source_watermarks(old_value)
            if cleaned_value == old_value:
                continue
            changes.append({
                'field': f'options.{key}',
                'oldValue': old_value,
                'newValue': cleaned_value,
            })
            options[key] = cleaned_value
    return changes
