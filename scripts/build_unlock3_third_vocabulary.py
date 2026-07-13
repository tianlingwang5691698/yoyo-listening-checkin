#!/usr/bin/env python3
"""Build the Unlock 3 third-edition vocabulary OCR candidate files."""

import json
import re
from pathlib import Path

import build_unlock4_third_vocabulary as parser


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tmp/pdfs/unlock3-third-vocab/columns"
OUT = ROOT / "data/unlock-vocabulary/unlock3-third-edition"
SOURCE_PDF = "unlock3词汇册_4.24已转曲.pdf"
SECTIONS = [
    (1, "ls", 4), (1, "rw", 6),
    (2, "ls", 9), (2, "rw", 11),
    (3, "ls", 14), (3, "rw", 16),
    (4, "ls", 19), (4, "rw", 21),
    (5, "ls", 24), (5, "rw", 26),
    (6, "ls", 29), (6, "rw", 31),
    (7, "ls", 34), (7, "rw", 36),
    (8, "ls", 39), (8, "rw", 41),
]
EXPECTED_RAW_COUNTS = {
    (1, "ls"): 55, (1, "rw"): 65,
    (2, "ls"): 57, (2, "rw"): 63,
    (3, "ls"): 48, (3, "rw"): 69,
    (4, "ls"): 44, (4, "rw"): 72,
    (5, "ls"): 59, (5, "rw"): 64,
    (6, "ls"): 64, (6, "rw"): 62,
    (7, "ls"): 57, (7, "rw"): 65,
    (8, "ls"): 48, (8, "rw"): 62,
}

# Rows with a leading source asterisk, or rows whose word column OCR was blank.
# sourceRow is the printed row number in the PDF, not a generated sequence.
MISSING_SOURCE_ROWS = {
    (1, "rw"): [
        (38, 7, "take actions", "/teɪk ˈækʃənz/", "phr.", "采取行动"),
        (39, 7, "take steps", "/teɪk steps/", "phr.", "采取措施"),
    ],
    (2, "rw"): [
        (16, 12, "mangrove forest", "/ˈmæŋɡrəʊv ˈfɒrɪst/", "n.", "红树林"),
        (17, 12, "coral reef", "/ˈkɒrəl riːf/", "n.", "珊瑚礁"),
        (28, 12, "hydroelectric", "/ˌhaɪdrəʊɪˈlektrɪk/", "adj.", "水力发电的"),
    ],
    (4, "rw"): [
        (52, 23, "World Heritage Site", "/ˌwɜːld ˈherɪtɪdʒ saɪt/", "n.", "世界遗产"),
        (54, 23, "the Great Reef", "/ðə ɡreɪt riːf/", "n.", "大堡礁"),
        (69, 23, "generalization", "/ˌdʒenrəlaɪˈzeɪʃən/", "n.", "概括；泛化"),
    ],
    (5, "rw"): [
        (40, 28, "carbohydrates", "/ˌkɑːbəʊˈhaɪdreɪts/", "n.", "碳水化合物"),
        (44, 28, "saturated fat", "/ˌsætʃəreɪtɪd ˈfæt/", "n.", "饱和脂肪"),
        (48, 28, "cholesterol", "/kəˈlestərɒl/", "n.", "胆固醇"),
    ],
    (6, "rw"): [
        (26, 32, "spider", "/ˈspaɪdə(r)/", "n.", "蜘蛛"),
    ],
    (7, "rw"): [
        (37, 38, "Cambodia", "/kæmˈbəʊdiə/", "n.", "柬埔寨"),
        (38, 38, "Bangladesh", "/ˌbæŋɡləˈdeʃ/", "n.", "孟加拉国"),
    ],
    (8, "rw"): [
        (16, 42, "Ferrari", "/fəˈrɑːri/", "n.", "法拉利汽车"),
        (17, 42, "Mercedes-Benz", "/mɜːˈseɪdiːz benz/", "n.", "梅赛德斯奔驰汽车"),
        (18, 42, "Aston Martin", "/ˌæstən ˈmɑːtɪn/", "n.", "阿斯顿·马丁汽车"),
    ],
}
WORD_CORRECTIONS = {
    "fluctucate considerably": "fluctuate considerably",
}
DEFINITION_CORRECTIONS = {
    "protect...from": "phr. 保护……免受……",
    "be native to": "phr. (动植物等)原产于；源于",
    "affect": "v. 影响",
    "neither...nor": "conj. 既不……也不……",
    "system": "n. 系统",
    "access": "n./v. 获取；使用；接近的权利或机会",
    "unexpected": "adj. 意想不到的；意外的",
    "uphill": "adj./adv. 上坡的；向上",
    "attract": "v. 吸引",
    "obligation": "n. 义务；职责；责任",
    "specialize": "v. 专门研究；专攻",
    "celebrity": "n. (尤指娱乐界的)名人",
    "market": "n./v. 市场；销售",
    "volume of sales": "n. 销售量",
    "thrifting": "n. 购买二手物品",
    "follower": "n. 追随者；粉丝",
    "ashamed": "adj. 羞愧的",
    "internet influencer": "n. 网络红人",
    "second-hand clothing": "n. 二手服装",
    "attractive": "adj. 有吸引力的",
    "item": "n. 物品；商品",
    "figure": "n. 数字；人物",
    "popularity": "n. 流行；受欢迎",
    "ship": "v. 运送",
    "throw away": "phr. 扔掉",
    "sustainable": "adj. 可持续的",
    "sustainability strategy": "n. 可持续发展策略",
    "wardrobe": "n. 衣柜；衣物",
    "import": "v. 进口",
    "multinational": "adj./n. 跨国的；跨国公司",
    "offshore": "adj./adv. 海外的；在海外",
    "outsource": "v. 外包",
    "textile": "n. 纺织品",
    "wage": "n. 工资",
    "working conditions": "n. 工作条件",
    "the european union": "n. 欧洲联盟",
    "hand-finished": "adj. 手工完成的",
    "developed country": "n. 发达国家",
    "developing country": "n. 发展中国家",
    "invest": "v. 投资",
    "fluctuate considerably": "phr. 大幅波动；显著起伏",
    "cut down on": "phr. 减少，削减",
    "fuel duty": "n. 燃油税",
}
PHONETIC_CORRECTIONS = {
    "climate change": "/ˈklaɪmət tʃeɪndʒ/",
    "solar energy": "/ˈsəʊlə ˈenədʒi/",
    "fossil fuel": "/ˈfɒsl ˈfjuːəl/",
    "nuclear energy": "/ˈnjuːkliə ˈenədʒi/",
    "alternative": "/ɔːlˈtɜːnətɪv/",
    "face-to-face": "/ˌfeɪs tə ˈfeɪs/",
    "overseas": "/ˌəʊvəˈsiːz/",
    "debt": "/dɛt/",
    "seed": "/siːd/",
    "hook": "/hʊk/",
    "loop": "/luːp/",
    "initially": "/ɪˈnɪʃəli/",
    "mussel": "/ˈmʌsl/",
    "budget": "/ˈbʌdʒɪt/",
    "afford": "/əˈfɔːd/",
    "relationship": "/rɪˈleɪʃnʃɪp/",
    "otherwise": "/ˈʌðəwaɪz/",
    "in some cases": "/ɪn sʌm ˈkeɪsɪz/",
    "although": "/ɔːlˈðəʊ/",
    "responsibly": "/rɪˈspɒnsəbli/",
    "will probably": "/wɪl ˈprɒbəbli/",
}


def phonetic_is_corrupt(value):
    value = str(value or "")
    return bool(
        re.search(r"[0-9A-Z|ıõỗ“”\"]", value)
        or re.fullmatch(r"/?(?:adj|adv|phr|prep|conj|n|v)[./]*/?", value.strip(), re.I)
    )


def configure_parser():
    parser.OCR = OCR
    parser.OUT = OUT
    parser.SOURCE_PDF = SOURCE_PDF
    parser.SECTIONS = SECTIONS
    parser.MANUAL_WORDS = {}
    parser.MANUAL_MEANINGS = {}
    parser.MANUAL_POS = {}
    parser.WORD_CORRECTIONS = {}


def parse_page(page, unit, section, min_y=None, max_y=None):
    rows = parser.parse_page(page, unit, section, min_y=min_y, max_y=max_y)
    for row in rows:
        corrected_word = WORD_CORRECTIONS.get(row["wordLower"])
        if corrected_word:
            row["word"] = corrected_word
            row["wordLower"] = corrected_word.lower()
        row["level"] = f"unlock3-{section}"
        row["unlockLevel"] = 3
        if row["wordLower"] in DEFINITION_CORRECTIONS:
            row["definitions"] = [DEFINITION_CORRECTIONS[row["wordLower"]]]
            row["cleaningNote"] = "source-definition-or-pos-corrected"
        if row["wordLower"] in PHONETIC_CORRECTIONS:
            row["phonetic"] = PHONETIC_CORRECTIONS[row["wordLower"]]
            row["phoneticSource"] = "manual-source-audit"
        elif phonetic_is_corrupt(row.get("phonetic")):
            row["phonetic"] = ""
            row["phoneticSource"] = "removed-ocr-corruption"
    return rows


def source_row(unit, section, number, page, word, phonetic, pos, meaning):
    return {
        "word": word,
        "wordLower": word.lower(),
        "level": f"unlock3-{section}",
        "unlockLevel": 3,
        "section": section.upper(),
        "units": [unit],
        "phonetic": phonetic,
        "definitions": [f"{pos} {meaning}"],
        "example": "",
        "exampleMeaning": "",
        "source": "unlock-third-edition",
        "sourceFiles": [SOURCE_PDF],
        "sourcePage": page,
        "sourceRow": number,
        "phoneticSource": "manual-source-audit",
        "cleaningNote": "source-asterisk-removed-or-ocr-word-restored",
    }


def main():
    configure_parser()
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "source": SOURCE_PDF,
        "edition": 3,
        "unlockLevel": 3,
        "sections": [],
        "total": 0,
        "rejected": [],
    }
    all_raw_rows = []
    for index, (unit, section, start_page) in enumerate(SECTIONS):
        own_title_y = parser.title_y(start_page, unit, section)
        next_item = SECTIONS[index + 1] if index + 1 < len(SECTIONS) else None
        end_page = next_item[2] if next_item else 43
        pages = range(start_page, end_page + 1)
        rows = []
        for page in pages:
            min_y = parser.title_y(end_page, next_item[0], next_item[1]) if next_item and page == end_page else None
            max_y = own_title_y if page == start_page else None
            rows.extend(parse_page(page, unit, section, min_y=min_y, max_y=max_y))

        expected_raw = EXPECTED_RAW_COUNTS[(unit, section)]
        for missing in MISSING_SOURCE_ROWS.get((unit, section), []):
            number = missing[0]
            rows.insert(number - 1, source_row(unit, section, *missing))
        for printed_number, row in enumerate(rows, 1):
            row["sourceRow"] = printed_number
        all_raw_rows.extend(rows)

        merged = {}
        for row in rows:
            key = row["wordLower"]
            if key not in merged:
                merged[key] = row
                continue
            current = merged[key]
            for definition in row["definitions"]:
                if definition not in current["definitions"]:
                    current["definitions"].append(definition)
            report["rejected"].append({
                "reason": "duplicate-merged",
                "unit": unit,
                "section": section.upper(),
                "word": row["word"],
                "sourcePage": row["sourcePage"],
            })

        deduped = list(merged.values())
        target = OUT / f"unit-{unit}-{section}.json"
        target.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["sections"].append({
            "unit": unit,
            "section": section.upper(),
            "pages": list(pages),
            "count": len(deduped),
            "rawCount": len(rows),
            "expectedNumberedRows": expected_raw,
            "numberedRows": [row["sourceRow"] for row in rows],
            "missingSourceRows": [] if len(rows) == expected_raw else list(range(len(rows) + 1, expected_raw + 1)),
            "sequenceComplete": len(rows) == expected_raw,
            "file": str(target.relative_to(ROOT)),
        })
        report["total"] += len(deduped)

    report["rawTotal"] = len(all_raw_rows)
    report["allNumberedRowsComplete"] = all(item["sequenceComplete"] for item in report["sections"])
    report["visualAudit"] = {
        "contactSheets": [
            "tmp/pdfs/unlock3-third-vocab/contact/pages-1-15.jpg",
            "tmp/pdfs/unlock3-third-vocab/contact/pages-16-30.jpg",
            "tmp/pdfs/unlock3-third-vocab/contact/pages-31-45.jpg",
        ],
        "inspectedPages": [3, 4, 6, 11, 21, 37, 43],
        "checks": [
            "catalogue-and-all-16-section-starts",
            "first-and-last-numbered-row-per-section",
            "word-phonetic-pos-meaning-column-alignment",
            "page-37-source-pos-and-meaning-mismatch-corrected-and-recorded",
        ],
    }
    report["sourceCorrections"] = [
        {
            "unit": row["units"][0],
            "section": row["section"],
            "sourcePage": row["sourcePage"],
            "sourceRow": row["sourceRow"],
            "word": row["word"],
            "reason": row["cleaningNote"],
        }
        for row in all_raw_rows if row.get("cleaningNote")
    ]
    (OUT / "ocr-draft.json").write_text(json.dumps(all_raw_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["rejectedCount"] = len(report["rejected"])
    (OUT / "rejected.json").write_text(json.dumps(report["rejected"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "clean-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
