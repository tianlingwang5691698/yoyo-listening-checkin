#!/bin/sh
set -eu

for source in data/grammar-classroom/course-sources/*-courses.js; do
  [ "$(basename "$source")" = "word-courses.js" ] && continue
  [ "$(basename "$source")" = "verb-numeral-article-courses.js" ] && continue
  [ "$(basename "$source")" = "adjective-adverb-courses.js" ] && continue
  [ "$(basename "$source")" = "preposition-conjunction-interjection-courses.js" ] && continue
  target="grammar-package/domain/grammar-classroom/$(basename "$source")"
  npx --yes terser "$source" --define GRAMMAR_RUNTIME=true --compress toplevel=true,passes=3 --mangle --toplevel --output "$target"
done

npx --yes terser data/grammar-classroom/course-sources/word-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_NOUN_ONLY=true --define GRAMMAR_PRONOUN_ONLY=false --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/noun-courses.js
npx --yes terser data/grammar-classroom/course-sources/word-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_NOUN_ONLY=false --define GRAMMAR_PRONOUN_ONLY=true --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/pronoun-courses.js
npx --yes terser data/grammar-classroom/course-sources/verb-numeral-article-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"verb"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/verb-courses.js
npx --yes terser data/grammar-classroom/course-sources/verb-numeral-article-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"numeral"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/numeral-courses.js
npx --yes terser data/grammar-classroom/course-sources/verb-numeral-article-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"article"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/article-courses.js
npx --yes terser data/grammar-classroom/course-sources/adjective-adverb-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"adjective"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/adjective-courses.js
npx --yes terser data/grammar-classroom/course-sources/adjective-adverb-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"adverb"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/adverb-courses.js
npx --yes terser data/grammar-classroom/course-sources/preposition-conjunction-interjection-courses.js --define GRAMMAR_RUNTIME=true --define GRAMMAR_TARGET='"preposition"' --compress toplevel=true,passes=3 --mangle --toplevel --output grammar-package/domain/grammar-classroom/preposition-courses.js

rm -f grammar-package/domain/grammar-classroom/adjective-adverb-courses.js
rm -f grammar-package/domain/grammar-classroom/preposition-conjunction-interjection-courses.js

npx --yes terser data/grammar-classroom/page-source/index.js --compress passes=3 --mangle --output pages/grammar/index.js
