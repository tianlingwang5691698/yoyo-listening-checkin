#!/usr/bin/env python3

import json
from pathlib import Path

from prepare_ielts_academic_16_20 import SOURCE_ROOT, prepare_book


BOOKS = {
    10: {
        'year': 2015,
        'pdf': SOURCE_ROOT / '真题4-18/剑10真题.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/【10】剑桥雅思10听力音频',
        'audioPattern': r'IELTS10_Test([1-4])\.Section([1-4])\.mp3$',
        'tests': {
            1: {'listening': (3, 9), 'reading': (10, 22), 'writing': (23, 24), 'speaking': 25, 'transcript': (123, 127), 'answers': (144, 145)},
            2: {'listening': (26, 33), 'reading': (34, 46), 'writing': (47, 48), 'speaking': 49, 'transcript': (128, 132), 'answers': (146, 147)},
            3: {'listening': (50, 56), 'reading': (57, 69), 'writing': (70, 71), 'speaking': 72, 'transcript': (133, 138), 'answers': (148, 149)},
            4: {'listening': (73, 80), 'reading': (81, 93), 'writing': (94, 95), 'speaking': 96, 'transcript': (138, 143), 'answers': (150, 153)},
        },
    },
    11: {
        'year': 2016,
        'pdf': SOURCE_ROOT / '真题4-18/剑11真题.pdf',
        'ocr': Path('/tmp/ielts-ocr/cambridge-11-force-ocr.pdf'),
        'forceOcr': True,
        'audio': SOURCE_ROOT / '剑雅听力音频/【11】剑桥雅思11听力音频',
        'audioPattern': r'IELTS11_Test([1-4])\.Section([1-4])\.mp3$',
        'tests': {
            1: {'listening': (9, 16), 'reading': (17, 28), 'writing': (29, 30), 'speaking': 31, 'transcript': (102, 107), 'answers': (123, 124)},
            2: {'listening': (32, 39), 'reading': (40, 52), 'writing': (53, 54), 'speaking': 55, 'transcript': (108, 112), 'answers': (125, 126)},
            3: {'listening': (56, 63), 'reading': (64, 75), 'writing': (76, 77), 'speaking': 78, 'transcript': (113, 117), 'answers': (127, 128)},
            4: {'listening': (79, 85), 'reading': (86, 98), 'writing': (99, 100), 'speaking': 101, 'transcript': (118, 122), 'answers': (129, 130)},
        },
    },
    12: {
        'year': 2017,
        'pdf': SOURCE_ROOT / '真题4-18/剑12真题.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/【12】剑桥雅思12听力音频',
        'audioPattern': r'IELTS12_Test([5-8])\.Section([1-4])\.mp3$',
        'officialListeningPdf': SOURCE_ROOT / '真题4-18/【真题12】剑桥雅思真题12.pdf',
        'officialListeningTranscripts': {6: (108, 113), 8: (118, 123)},
        'tests': {
            5: {'listening': (11, 16), 'reading': (17, 27), 'writing': (28, 29), 'speaking': 30, 'transcript': (96, 100), 'answers': (117, 118)},
            6: {'listening': (31, 36), 'reading': (37, 50), 'writing': (51, 52), 'speaking': 53, 'transcript': (101, 105), 'answers': (119, 120)},
            7: {'listening': (54, 59), 'reading': (60, 71), 'writing': (72, 73), 'speaking': 74, 'transcript': (106, 111), 'answers': (121, 122)},
            8: {'listening': (75, 80), 'reading': (81, 92), 'writing': (93, 94), 'speaking': 95, 'transcript': (112, 116), 'answers': (123, 124)},
        },
    },
    13: {
        'year': 2018,
        'pdf': SOURCE_ROOT / '真题4-18/剑13真题.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/【13】剑桥雅思13听力音频',
        'audioPattern': r'IELTS13_Test([1-4])\.Section([1-5])\.mp3$',
        'audioPartMap': {'4:5': 4},
        'officialListeningPdf': SOURCE_ROOT / '真题4-18/【真题13】剑桥雅思真题13.pdf',
        'officialListeningTests': {1: (3, 8), 2: (24, 29), 4: (68, 73)},
        'officialListeningAnswers': {1: (110, 110), 2: (112, 112), 4: (116, 116)},
        'officialListeningVisualPageMap': {1: {5: 13, 7: 15}},
        'tests': {
            1: {'listening': (11, 16), 'reading': (17, 29), 'writing': (30, 31), 'speaking': 32, 'transcript': (98, 102), 'answers': (119, 121)},
            2: {'listening': (33, 38), 'reading': (39, 51), 'writing': (52, 53), 'speaking': 54, 'transcript': (103, 108), 'answers': (122, 123)},
            3: {'listening': (55, 60), 'reading': (61, 73), 'writing': (74, 75), 'speaking': 76, 'transcript': (109, 113), 'answers': (124, 124)},
            4: {'listening': (77, 82), 'reading': (83, 94), 'writing': (95, 96), 'speaking': 97, 'transcript': (114, 118), 'answers': (125, 126)},
        },
    },
    14: {
        'year': 2019,
        'pdf': SOURCE_ROOT / '真题4-18/剑14真题.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/【14】剑桥雅思14听力音频',
        'audioPattern': r'IELTS14_Test ([1-4])-([1-4])\.mp3$',
        'tests': {
            1: {'listening': (11, 16), 'reading': (17, 29), 'writing': (30, 31), 'speaking': 32, 'transcript': (98, 102), 'answers': (120, 121)},
            2: {'listening': (33, 38), 'reading': (39, 50), 'writing': (51, 52), 'speaking': 53, 'transcript': (103, 108), 'answers': (122, 123)},
            3: {'listening': (54, 60), 'reading': (61, 72), 'writing': (73, 74), 'speaking': 75, 'transcript': (109, 113), 'answers': (124, 125)},
            4: {'listening': (76, 82), 'reading': (83, 94), 'writing': (95, 96), 'speaking': 97, 'transcript': (114, 119), 'answers': (126, 127)},
        },
    },
    15: {
        'year': 2020,
        'pdf': SOURCE_ROOT / '真题4-18/剑15真题.pdf',
        'ocr': None,
        'audio': SOURCE_ROOT / '剑雅听力音频/剑桥15',
        'audioPattern': r'IELTS15_test([1-4])_audio([1-4])\.mp3$',
        'tests': {
            1: {'listening': (11, 16), 'reading': (17, 28), 'writing': (29, 30), 'speaking': 31, 'transcript': (97, 101), 'answers': (120, 121)},
            2: {'listening': (32, 37), 'reading': (38, 49), 'writing': (50, 51), 'speaking': 52, 'transcript': (102, 107), 'answers': (122, 123)},
            3: {'listening': (53, 58), 'reading': (59, 71), 'writing': (72, 73), 'speaking': 74, 'transcript': (108, 113), 'answers': (124, 125)},
            4: {'listening': (75, 80), 'reading': (81, 93), 'writing': (94, 95), 'speaking': 96, 'transcript': (114, 119), 'answers': (126, 127)},
        },
    },
}


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
