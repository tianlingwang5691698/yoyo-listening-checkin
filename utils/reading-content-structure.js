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
  'sh-em2-2019-a-10-qingpu': 'Griffith Observatory (天文台)'
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
  const source = compact(value);
  const matched = candidates.find((candidate) => source.toLowerCase().indexOf(compact(candidate).toLowerCase()) === 0);
  return matched ? compact(source.slice(matched.length)) : source;
}

function structureLegacyReadingContent(passage) {
  if (!passage) return null;
  if (passage.dataFormat === 'reading-structured-v1') return passage;
  const id = String(passage._id || passage.id || '');
  let value = String(passage.passage || '');
  const shouldStructure = !!ARTICLE_TITLES[id]
    || /(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?/i.test(value)
    || /^\s*(?:Directions\b|answer\b|根据(?:短文|文章|对话|以下)内容|Section\s+[A-D]\b|(?:(?:[IVX]+|[Ⅰ-Ⅹ])\s*[.．]?\s*)?(?:Reading Comprehension|Grammar and Vocabulary)\b|[A-D]\s*[.．、)]\s*(?:Choose|Read|Answer)\b|(?:\d+\s*[.．、]\s*)?[（(][^）)]*分[^）)]*[）)])/i.test(value);
  if (!shouldStructure) return passage;
  let directions = String(passage.directions || '').trim();
  let sectionHeading = String(passage.sectionHeading || '').trim();
  const articleTitle = ARTICLE_TITLES[id] || String(passage.articleTitle || '').trim();
  const articleSubtitle = String(passage.articleSubtitle || '').trim();

  value = value.replace(/(?:\bsmart\s*)?第\s*\d+\s*页\s*(?:[（(]?\s*共\s*\d+\s*页\s*[）)]?)?/gi, ' ');

  const scorePrefix = /^\s*(?:[（(]\s*(?:_+\s*\d+\s*_+|\d+)\s*分\s*[）)]|[（(]\s*每题\s*(?:_+\s*\d+\s*_+|\d+(?:\.\d+)?)\s*分\s*[；;]\s*共\s*\d+\s*分\s*[）)]|\d+\s*[.．、]\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])\s*/i;
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
    const juniorMatch = value.match(
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
  return Object.assign({}, passage, {
    dataFormat: 'reading-structured-v1',
    directions,
    sectionHeading,
    articleTitle,
    articleSubtitle,
    passage: compact(value)
  });
}

module.exports = {
  ARTICLE_TITLES,
  structureLegacyReadingContent
};
