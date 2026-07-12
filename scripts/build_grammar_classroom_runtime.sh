#!/bin/sh
set -eu

for source in data/grammar-classroom/course-sources/*-courses.js; do
  target="grammar-package/domain/grammar-classroom/$(basename "$source")"
  npx --yes terser "$source" --define GRAMMAR_RUNTIME=true --compress toplevel=true,passes=3 --mangle --toplevel --output "$target"
done

npx --yes terser data/grammar-classroom/page-source/index.js --compress passes=3 --mangle --output pages/grammar/index.js
