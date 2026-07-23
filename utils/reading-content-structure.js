const ARTICLE_TITLES = {
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
  'sh-em1-2020-普陀-reading-b': 'FINDING FRIENDS ONLINE',
  'sh-em1-2020-虹口-reading-b': 'When is the best time to ...',
  'sh-em1-2020-静安-reading-b': 'Thing to know before you go out in the cold',
  'sh-em1-2024-浦东-reading-b': 'Company Creates First 3D-Printed Fish'
};

const CROSS_SECTION_PREFIXES = {
  'sh-em1-2022-长宁-reading-d': /^[\s\S]*?\bD\s*[.．、)]\s*(Answer\s+the\s+questions\s*[.．]?)(?:\s*[（(][^）)]*回答问题[^）)]*[）)])?(?:\s*[（(]\s*\d+\s*分\s*[）)])?\s*/i,
  'sh-em1-2026-金山-reading-d': /^[\s\S]*?\bD\s*[.．、)]\s*(Answer\s+the\s+questions\s*[.．]?)(?:\s*[（(][^）)]*回答问题[^）)]*[）)])?(?:\s*[（(]\s*\d+\s*分\s*[）)])?\s*/i
};

const CROSS_SECTION_SUFFIXES = {
  'sh-em1-2022-虹口-reading-c': /\s*\bD\s*[.．、)]\s*Answer\s+the\s+questions[\s\S]*$/i,
  'sh-em2-2012-宝山嘉定-reading-c': /\s*\bD\s*[.．、)]\s*Answer\s+the\s+questions[\s\S]*$/i
};

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripKnownTitle(value, title) {
  if (!title) return value;
  const candidates = [
    title,
    title.replace(' vs. ', ' vs.'),
    title.replace(' (野兔) ', '(野兔) '),
    title.replace('?', '？')
  ].sort((left, right) => right.length - left.length);
  const original = String(value || '');
  const source = compact(original);
  const matched = candidates.find((candidate) => source.toLowerCase().indexOf(compact(candidate).toLowerCase()) === 0);
  return matched ? compact(source.slice(matched.length)) : original;
}

function splitSentenceRanges(source) {
  const ranges = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (!'.．!?。！？\n'.includes(char)) continue;
    if (char === '.' && /[A-Za-z]/.test(source[index - 1] || '') && /[A-Za-z]/.test(source[index + 1] || '')) continue;
    let end = index + 1;
    while (end < source.length && /\s/.test(source[end])) end += 1;
    if (source.slice(start, end).trim()) ranges.push([start, end]);
    start = end;
  }
  if (source.slice(start).trim()) ranges.push([start, source.length]);
  return ranges.length ? ranges : [[0, source.length]];
}

function splitParagraphs(value) {
  const source = String(value || '').trim();
  const blankBlocks = source.split(/\n\s*\n+/).map(compact).filter(Boolean);
  if (blankBlocks.length > 1) return blankBlocks;
  const lineBlocks = source.split(/\n+/).map(compact).filter(Boolean);
  const averageLength = lineBlocks.length
    ? lineBlocks.reduce((sum, item) => sum + item.length, 0) / lineBlocks.length
    : 0;
  if (lineBlocks.length > 1 && lineBlocks.length <= 30 && averageLength >= 90) return lineBlocks;
  const flat = compact(source);
  const sentences = splitSentenceRanges(flat);
  const paragraphs = [];
  let start = sentences[0][0];
  let sentenceCount = 0;
  sentences.forEach((range, index) => {
    sentenceCount += 1;
    const end = range[1];
    const length = end - start;
    const next = sentences[index + 1];
    const nextLength = next ? next[1] - start : 0;
    if (!next || (length >= 300 && (sentenceCount >= 3 || nextLength > 520)) || length >= 520) {
      paragraphs.push(compact(flat.slice(start, end)));
      if (next) start = next[0];
      sentenceCount = 0;
    }
  });
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length < 140) {
    paragraphs[paragraphs.length - 2] = compact(`${paragraphs[paragraphs.length - 2]} ${paragraphs.pop()}`);
  }
  return paragraphs.filter(Boolean);
}

function hasIeltsLabelledBodyAfterLead(paragraphs) {
  const labels = paragraphs.slice(1).map((paragraph) => {
    const match = String(paragraph || '').match(/^\s*([A-Z])(?:[.、：:]?\s+)/);
    return match ? match[1] : '';
  }).filter(Boolean);
  const start = labels.indexOf('A');
  if (start < 0) return false;
  let expected = 'A'.charCodeAt(0);
  let matched = 0;
  labels.slice(start).forEach((label) => {
    if (label.charCodeAt(0) === expected) {
      matched += 1;
      expected += 1;
    }
  });
  return matched >= 2;
}

function mergeIeltsStandaloneLabels(paragraphs) {
  const merged = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if (/^[A-Z]$/.test(paragraph) && paragraphs[index + 1]) {
      merged.push(compact(`${paragraph} ${paragraphs[index + 1]}`));
      index += 1;
    } else {
      merged.push(paragraph);
    }
  }
  return merged;
}

function splitIeltsSubtitle(paragraphs) {
  paragraphs = mergeIeltsStandaloneLabels(paragraphs);
  if (paragraphs.length < 2) return { subtitle: '', paragraphs };
  const first = paragraphs[0];
  const hasLabelledBody = hasIeltsLabelledBodyAfterLead(paragraphs);
  const isShortUnlabelledLead = first.length <= 180 && !/[.!?。！？]["'”’)]*$/.test(first);
  return (hasLabelledBody && first.length <= 220) || isShortUnlabelledLead
    ? { subtitle: first, paragraphs: paragraphs.slice(1) }
    : { subtitle: '', paragraphs };
}

function structureLegacyReadingContent(passage) {
  if (!passage) return null;
  if (passage.dataFormat === 'reading-structured-v1') return passage;
  const id = String(passage._id || passage.id || '');
  const isIelts = id.indexOf('ielts-') === 0;
  let value = String(passage.passage || '');
  const shouldStructure = isIelts
    || !!ARTICLE_TITLES[id]
    || !!CROSS_SECTION_PREFIXES[id]
    || !!CROSS_SECTION_SUFFIXES[id]
    || /(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?/i.test(value)
    || /^\s*(?:HYPERLINK\s+"https?:\/\/|Directions\b|answer\b|and\s+complete\s+the\s+passage\b|Read\s+the\s+passage\s+and\s+fill\b|选择最恰当的选项完成短文|在短文的空格内填入适当的词|根据(?:短文|文章|对话|以下)内容|Section\s+[A-D]\b|(?:(?:[IVX]+|[Ⅰ-Ⅹ])\s*[.．]?\s*)?(?:Reading Comprehension|Grammar and Vocabulary)\b|[A-D]\s*[.．、)]\s*(?:Choose|Read|Answer)\b|(?:[）)]\s*)?(?:\d+\s*[.．、]\s*)?[（(][^）)]*分[^）)]*[）)])/i.test(value);
  if (!shouldStructure) return passage;
  let directions = String(passage.directions || '').trim();
  let sectionHeading = String(passage.sectionHeading || '').trim();
  const ieltsTitleParts = isIelts ? String(passage.title || '').split(/\r?\n/).map(compact).filter(Boolean) : [];
  const articleTitle = ARTICLE_TITLES[id] || String(passage.articleTitle || '').trim() || (ieltsTitleParts[0] || '');
  let articleSubtitle = String(passage.articleSubtitle || '').trim();
  if (isIelts && !articleSubtitle && ieltsTitleParts.length > 1) {
    articleSubtitle = ieltsTitleParts.slice(1).join(' ');
  }

  const crossSectionPrefix = CROSS_SECTION_PREFIXES[id];
  const crossSectionMatch = crossSectionPrefix && value.match(crossSectionPrefix);
  if (crossSectionMatch) {
    sectionHeading = String(passage.section || 'D').toUpperCase();
    directions = compact(crossSectionMatch[1]);
    value = value.slice(crossSectionMatch[0].length);
  }
  const crossSectionSuffix = CROSS_SECTION_SUFFIXES[id];
  if (crossSectionSuffix) value = value.replace(crossSectionSuffix, '');

  value = value.replace(/(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?/gi, ' ');
  value = value.replace(/^\s*HYPERLINK\s+"https?:\/\/[^"]+"\s*/i, '');

  const scorePrefix = /^\s*(?:[）)]\s*[（(]\s*\d+\s*分\s*[）)]|[（(]\s*(?:_+\s*\d+\s*_+|\d+)\s*分\s*[）)]|[（(]\s*每题\s*(?:_+\s*\d+\s*_+|\d+(?:\.\d+)?)\s*分\s*[；;]\s*共\s*\d+\s*分\s*[）)]|\d+\s*[.．、]\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])\s*/i;
  value = value.replace(scorePrefix, '');

  const choiceHeading = value.match(
    /^\s*([A-D])\s*[.．、)]\s*((?:Choose|Read|Answer)[^（(]{0,220}(?:[（(][^）)]*(?:答案|问题)[^）)]*[）)])?)\s*(?:[（(]\s*\d+\s*分\s*[）)])?\s*/i
  );
  if (choiceHeading) {
    sectionHeading = choiceHeading[1].toUpperCase();
    directions = compact(choiceHeading[2]);
    value = value.slice(choiceHeading[0].length);
  }

  const heading = value.match(
    /^\s*((?:(?:[IVX]+|[Ⅰ-Ⅹ])\s*[.．]?\s*)?(?:Reading Comprehension|Grammar and Vocabulary)(?:\s*[（(]\s*\d+\s*分\s*[）)])?|Section\s+[A-D])\s*/i
  );
  if (heading) {
    sectionHeading = compact(heading[1]);
    value = value.slice(heading[0].length);
  }

  const directionMatch = value.match(
    /^\s*(Directions\s*[:：]\s*[\s\S]*?(?:best\s+fit\s*s?\s+each\s+blank|than\s+you\s+need)\s*[.．]?)\s*/i
  );
  if (directionMatch) {
    directions = compact(directionMatch[1]);
    value = value.slice(directionMatch[0].length);
  } else if (id.indexOf('sh-em1-') === 0 || id.indexOf('sh-em2-') === 0) {
    const truncatedClozeMatch = value.match(
      /^\s*(?:answer\s+)?and\s+complete\s+the\s+passage\s*([（(]\s*选择最恰当的选项完成短文\s*[）)])\s*/i
    );
    const fillMatch = value.match(
      /^\s*(Read\s+the\s+passage\s+and\s+fill\s+in\s+the\s+blanks\s+with\s+proper\s+words\s*[（(][^）)]*首字母已给[^）)]*[）)])\s*/i
    );
    const chineseMatch = value.match(
      /^\s*(选择最恰当的选项完成短文[.。]?|在短文的空格内填入适当的词\s*[,，]?\s*使其内容通顺[.。,，]?\s*每空格限填(?:一词|一次)\s*[,，]?\s*首字母已给[.。]?)\s*/i
    );
    const juniorMatch = truncatedClozeMatch || fillMatch || chineseMatch || value.match(
      /^\s*(?:answer\b\s*[.：:]?\s*)?([（(]?\s*根据(?:短文|文章|对话|以下)内容，?\s*(?:选择最恰当的答案|(?:完整)?回答(?:下列)?问题)[.。]?\s*[）)]?)?\s*(?:[：:]?\s*[（(]\s*(?:共\s*)?\d+\s*分\s*[）)])?\s*/i
    );
    if (juniorMatch && (juniorMatch[0].length || /^\s*answer\b/i.test(value))) {
      if (compact(juniorMatch[1])) directions = compact(juniorMatch[1]).replace(/^[（(]|[）)]$/g, '').trim();
      value = value.slice(juniorMatch[0].length);
    }
  }

  const fewest = value.match(/^\s*((?:in\s+)?the\s+fewest\s+possible\s+words\s*[.．]?)\s*/i);
  if (fewest) {
    directions = compact(fewest[1]);
    value = value.slice(fewest[0].length);
  }

  value = value.replace(scorePrefix, '');
  value = stripKnownTitle(value, articleTitle);
  let passageParagraphs = splitParagraphs(value);
  if (isIelts && !articleSubtitle) {
    const ieltsStructure = splitIeltsSubtitle(passageParagraphs);
    articleSubtitle = ieltsStructure.subtitle;
    passageParagraphs = ieltsStructure.paragraphs;
  }
  return Object.assign({}, passage, {
    dataFormat: 'reading-structured-v1',
    directions,
    sectionHeading,
    articleTitle,
    articleSubtitle,
    passageParagraphs,
    passage: passageParagraphs.join('\n\n')
  });
}

module.exports = {
  ARTICLE_TITLES,
  structureLegacyReadingContent
};
