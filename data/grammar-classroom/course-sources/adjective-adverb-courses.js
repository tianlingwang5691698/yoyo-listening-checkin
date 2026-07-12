const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const BUILD_TARGET = typeof GRAMMAR_TARGET === 'undefined' ? 'all' : GRAMMAR_TARGET;
const part = (english, text, role, zh, en) => ({ text, role, label: pick(english, zh, en) });
const example = (english, parts, mode = '', zhNote = '', enNote = '') => ({
  text: parts.map((item) => item[0]).join(' '),
  analysis: parts.map((item) => part(english, item[0], item[1], item[2], item[3])),
  note: mode ? {
    visible: true,
    mode,
    title: pick(english, mode === 'translation' ? '语序翻译' : '规则观察', mode === 'translation' ? 'Word-order translation' : 'Rule focus'),
    body: pick(english, zhNote, enNote),
    detail: ''
  } : { visible: false, mode: '', title: '', body: '', detail: '' }
});
const question = (english, prompt, a, b, answer, zhWhy, enWhy) => ({
  question: Array.isArray(prompt) ? pick(english, prompt[0], prompt[1]) : prompt,
  options: [{ key: 'A', text: a }, { key: 'B', text: b }],
  answer,
  correct: pick(english, zhWhy, enWhy),
  wrong: pick(english, `再看规则：${zhWhy}`, `Check the rule: ${enWhy}`)
});
const RULE_COVERAGE = INCLUDE_RULE_COVERAGE ? {
  'adjective-essence': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-jobs': [[[0, 1, 2], [0, 1, 2]], [[0, 1, 2], [0, 1, 2]]],
  'adjective-position': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-restrictions': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-complements': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-degree': [[[0, 2], [0, 2]], [[1], [1]]],
  'adjective-comparative-form': [[[0], [4]], [[3], [3]], [[1], [0]], [[2], [1]], [[4], [2]]],
  'adjective-comparison': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'comparative-modifiers': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adjective-superlative': [[[0, 1, 2], [0]], [[0, 1, 2], [1]], [[0, 1, 2], [0]], [[2], [2]]],
  'comparison-boundaries': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'participle-adjectives': [[[0, 2], [0]], [[1, 2], [1, 2]], [[0, 1, 2], [0, 1, 2]]],
  'compound-adjectives': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-order': [[[0, 1, 2, 3], [0, 1, 2, 3]], [[0, 1, 2, 3], [0, 1, 2, 3]]],
  'adjective-nominal': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adverb-jobs': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverb-types': [[[0], [3]], [[0], [0]], [[1], [4]], [[1], [1]], [[2], [2]], [[3], [5]]],
  'adverb-position': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]], [[2], [4]]],
  'adjective-or-adverb': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adverb-comparison': [[[0, 2], [1]], [[1], [0]], [[3], [2]]],
  'degree-patterns': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverb-scope': [[[0, 1], [0]], [[2], [1]], [[3], [3]], [[3], [2]]],
  'adverb-traps': [[[0, 1], [0]], [[1], [1]], [[2, 3], [2, 3]], [[2, 3], [2, 3]]]
} : null;
function lesson(english, id, zhTitle, enTitle, zhMeta, enMeta, examples, rules, questions) {
  const coverage = INCLUDE_RULE_COVERAGE ? RULE_COVERAGE[id] : null;
  return {
    id,
    title: pick(english, zhTitle, enTitle),
    meta: pick(english, zhMeta, enMeta),
    examples: examples.map((item) => item.text),
    analyses: examples.map((item) => item.analysis),
    exampleNotes: examples.map((item) => item.note),
    rules: rules.map((item) => pick(english, item[0], item[1])),
    ruleCoverage: INCLUDE_RULE_COVERAGE ? coverage.map((item) => ({ exampleIndexes: item[0], questionIndexes: item[1] })) : [],
    questions
  };
}
function groupCourse(english, lessons, zhTitle, enTitle, coreCount, sectionDefs) {
  const advancedIds = Array.isArray(coreCount) ? coreCount : null;
  const course = lessons.map((item, index) => Object.assign({}, item, {
    no: String(index + 1).padStart(2, '0'),
    level: advancedIds ? (advancedIds.includes(item.id) ? 'advanced' : 'core') : (index < coreCount ? 'core' : 'advanced')
  }));
  const sections = (sectionDefs || []).map((item) => ({
    id: item[0],
    title: pick(english, item[1], item[2]),
    copy: pick(english, item[3], item[4]),
    lessonIds: item[5].slice(),
    lessonCount: item[5].length
  }));
  const assignedIds = sections.reduce((ids, section) => ids.concat(section.lessonIds), []);
  const courseIds = course.map((lesson) => lesson.id);
  if (assignedIds.length !== courseIds.length
    || new Set(assignedIds).size !== assignedIds.length
    || courseIds.some((id) => !assignedIds.includes(id))) {
    throw new Error(`${enTitle} sections must assign every lesson exactly once`);
  }
  return {
    title: pick(english, `${zhTitle} · ${course.length} 节微课`, `${enTitle} · ${course.length} lessons`),
    copy: pick(english, '先掌握核心规则，再处理复杂语境。', 'Master the core rules, then handle complex contexts.'),
    course,
    sections,
    groups: [
      { id: 'core', title: pick(english, `核心必学 · ${course.filter(item => item.level === 'core').length} 节`, `Core · ${course.filter(item => item.level === 'core').length} essential lessons`), copy: pick(english, '所有学生必须掌握。', 'Complete these first.'), lessons: course.filter(item => item.level === 'core') },
      { id: 'advanced', title: pick(english, `进阶挑战 · ${course.filter(item => item.level === 'advanced').length} 节`, `Advanced · ${course.filter(item => item.level === 'advanced').length} challenge lessons`), copy: pick(english, '特殊结构与综合辨析。', 'Special structures and mixed practice.'), lessons: course.filter(item => item.level === 'advanced') }
    ]
  };
}

function buildAdjectiveCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  const bundle = groupCourse(english, [
    lesson(english, 'adjective-essence', '形容词的定义与本质', 'Definition and core of adjectives', '给人或事物添加性质与状态', 'Add qualities and states to people or things', [
      e([['The', 'attribute', '限定词', 'Determiner'], ['red', 'attribute', '形容词作定语', 'Attributive adjective'], ['ball', 'subject', '主语中心词', 'Subject head'], ['rolled away.', 'predicate', '谓语动词', 'Predicate verb']], 'structure', 'red 给 ball 添加“红色”这一特征，帮助我们识别是哪一个球。', 'red adds the quality “red” to ball and helps identify it.'),
      e([['The ball', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['red.', 'predicative', '形容词作表语', 'Adjective as subject complement']], 'structure', 'red 不再放在名词前，而是通过 is 说明 ball 处于什么性质或状态。', 'red follows is and describes the quality or state of the ball.'),
      e([['They', 'subject', '主语', 'Subject'], ['painted', 'predicate', '谓语动词', 'Predicate verb'], ['the ball', 'object', '宾语', 'Object'], ['red.', 'objectComplement', '形容词作宾语补足语', 'Adjective as object complement']], 'structure', 'red 说明宾语 the ball 被刷成什么状态，和 ball 构成“球是红的”的关系。', 'red gives the resulting state of the ball: the ball is red.')
    ], [
      ['形容词的本质是给名词所指的人或事物添加性质、状态或类别特征。', 'An adjective adds a quality, state or classifying feature to what a noun refers to.'],
      ['形容词既能放在名词短语中修饰名词，也能通过系动词说明主语。', 'An adjective can modify a noun inside a noun phrase or describe the subject through a linking verb.'],
      ['形容词还可补充说明宾语形成的状态，此时作宾语补足语。', 'An adjective can also describe the resulting state of an object as an object complement.']
    ], [
      q(['red 在“the red ball”中说明什么？', 'What does red do in “the red ball”?'], 'It describes the ball.', 'It describes rolled.', 'A', 'red 给 ball 添加颜色特征。', 'red adds a color quality to ball.'),
      q(['red 在“The ball is red.”中是什么成分？', 'What is red in “The ball is red”?'], 'a subject complement', 'an object', 'A', 'red 通过 is 说明主语 ball。', 'red describes the subject through is.'),
      q(['red 在“They painted the ball red.”中说明谁？', 'What does red describe in “They painted the ball red”?'], 'the ball', 'They', 'A', 'red 说明宾语 ball 的结果状态。', 'red describes the resulting state of the object ball.')
    ]),
    lesson(english, 'adjective-jobs', '形容词在句中做什么', 'What adjectives do', '定语 · 表语 · 宾语补足语', 'Attribute · complement · object complement', [
      e([['The', 'attribute', '限定词', 'Determiner'], ['kind', 'attribute', '前置定语', 'Attributive adjective'], ['teacher', 'subject', '主语', 'Subject'], ['helped', 'predicate', '谓语动词', 'Predicate verb'], ['us.', 'object', '宾语', 'Object']]),
      e([['The sky', 'subject', '主语', 'Subject'], ['looks', 'predicate', '系动词', 'Linking verb'], ['blue.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The news', 'subject', '主语', 'Subject'], ['made', 'predicate', '谓语动词', 'Predicate verb'], ['her', 'object', '宾语', 'Object'], ['happy.', 'attribute', '形容词作宾语补足语', 'Adjective object complement']])
    ], [
      ['形容词描述人或事物的性质、状态和特征。', 'Adjectives describe qualities, states and characteristics.'],
      ['形容词可作定语、表语或宾语补足语；作表语时常跟在系动词后。', 'Adjectives can be attributes, subject complements or object complements; complements often follow linking verbs.']
    ], [
      q('The ___ dog is friendly.', 'brown', 'brownly', 'A', 'brown 修饰名词 dog，作定语。', 'brown modifies dog as an adjective.'),
      q('The soup tastes ___.', 'delicious', 'deliciously', 'A', 'taste 是系动词，后接形容词作表语。', 'taste is a linking verb and takes an adjective complement.'),
      q('The joke made everyone ___.', 'happy', 'happily', 'A', 'happy 说明宾语 everyone 的状态。', 'happy describes the object everyone.')
    ]),
    lesson(english, 'adjective-position', '形容词放在哪里', 'Where adjectives go', '前置定语与后置定语', 'Prepositive and postpositive attributes', [
      e([['She', 'subject', '主语', 'Subject'], ['bought', 'predicate', '谓语动词', 'Predicate verb'], ['a', 'attribute', '限定词', 'Determiner'], ['beautiful', 'attribute', '形容词作前置定语', 'Prepositive adjective'], ['dress.', 'object', '宾语中心词', 'Object head']]),
      e([['I', 'subject', '主语', 'Subject'], ['need', 'predicate', '谓语动词', 'Predicate verb'], ['something', 'object', '宾语中心词', 'Object head'], ['useful.', 'attribute', '形容词作后置定语', 'Postpositive adjective'] ], 'translation', '形容词 useful 在英语中放在不定代词 something 后，中文通常前移为“有用的东西”。', 'useful follows the indefinite pronoun in English; Chinese normally moves the modifier before the word meaning “thing”.'),
      e([['The students', 'subject', '主语', 'Subject'], ['present', 'attribute', '形容词作后置定语', 'Postpositive adjective'], ['were', 'predicate', '系动词', 'Linking verb'], ['quiet.', 'object', '形容词作表语', 'Adjective complement']], 'translation', 'present 后置表示“在场的”，中文通常译为“在场的学生”。', 'present follows students meaning “in attendance”; Chinese normally places the equivalent modifier before “students”.')
    ], [
      ['单个形容词作定语通常放在名词前。', 'A single attributive adjective normally comes before its noun.'],
      ['形容词修饰 something、anything、nothing 等不定代词时必须后置。', 'An adjective must follow indefinite pronouns such as something, anything and nothing.'],
      ['部分形容词在特定义项中要求后置，如 the students present 中 present 表示“在场的”。', 'Some adjectives are postpositive in particular senses, as present meaning “in attendance” in the students present.']
    ], [
      q('We saw a ___ bird.', 'small', 'smallly', 'A', '单个形容词 small 放在名词 bird 前。', 'small comes before the noun bird.'),
      q('Is there anything ___?', 'interesting', 'interestingly', 'A', '形容词修饰 anything 时放在其后。', 'An adjective follows anything.'),
      q('The people ___ must sign here.', 'present', 'presently', 'A', 'present 后置表示“在场的”。', 'postpositive present means “in attendance”.')
    ]),
    lesson(english, 'adjective-restrictions', '只作定语或只作表语的形容词', 'Attributive-only and predicative-only adjectives', '位置可能改变可用性或词义', 'Position can affect use and meaning', [
      e([['The', 'attribute', '限定词', 'Determiner'], ['main', 'attribute', '只作定语的形容词', 'Attributive-only adjective'], ['reason', 'subject', '主语中心词', 'Subject head'], ['is cost.', 'predicate', '谓语部分', 'Predicate']], 'structure', 'main 用来限定“主要的原因”，通常只放在名词前，不说 the reason is main。', 'main classifies the reason and normally appears only before the noun.'),
      e([['The child', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['asleep.', 'predicative', '只作表语的形容词', 'Predicative-only adjective']], 'structure', 'asleep 表示孩子处于睡着状态，通常放在系动词后，不直接放在名词前。', 'asleep describes the child’s state and normally follows a linking verb.'),
      e([['The students', 'subject', '主语', 'Subject'], ['concerned', 'attribute', '后置定语：有关的', 'Postmodifier: involved'], ['looked', 'predicate', '系动词', 'Linking verb'], ['concerned.', 'predicative', '表语：担心的', 'Subject complement: worried']], 'structure', '前一个 concerned 后置表示“有关的学生”；后一个作表语表示“感到担心”。', 'The postpositive concerned means “involved”; the complement concerned means “worried”.')
    ], [
      ['main、mere、former 等通常只作前置定语。', 'main, mere and former are normally attributive only.'],
      ['asleep、afraid、alive 等通常作表语；修饰名词时常换用 sleeping、frightened、living 等。', 'asleep, afraid and alive are normally predicative; noun modification often uses sleeping, frightened or living.'],
      ['少数形容词因位置不同而改变意义，必须结合它修饰谁和所在位置判断。', 'Some adjectives change meaning with position; identify what they describe and where they occur.']
    ], [
      q(['选择自然表达。', 'Choose the natural expression.'], 'the main problem', 'the problem is main', 'A', 'main 通常只作前置定语。', 'main is normally attributive only.'),
      q(['选择自然表达。', 'Choose the natural expression.'], 'The baby is asleep.', 'the asleep baby', 'A', 'asleep 通常放在系动词后作表语。', 'asleep normally follows a linking verb.'),
      q(['“the people concerned”通常表示什么？', 'What does “the people concerned” normally mean?'], 'the people involved', 'the worried people only', 'A', 'concerned 后置时常表示“有关的”。', 'Postpositive concerned commonly means “involved”.')
    ]),
    lesson(english, 'adjective-complements', '形容词后面怎样补全意义', 'Complements after adjectives', '介词短语、不定式与从句', 'Prepositional phrase · infinitive · clause', [
      e([['She', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['afraid', 'predicative', '形容词作表语', 'Adjective as subject complement'], ['of dogs.', 'complement', '介词短语补足形容词', 'Prepositional complement of adjective']], 'structure', 'afraid 只说“害怕”还没说明对象；of dogs 补出害怕什么。', 'afraid gives the feeling; of dogs completes it by naming the target.'),
      e([['We', 'subject', '主语', 'Subject'], ['are', 'predicate', '系动词', 'Linking verb'], ['ready', 'predicative', '形容词作表语', 'Adjective as subject complement'], ['to leave.', 'complement', '不定式补足形容词', 'Infinitive complement of adjective']], 'structure', 'ready 表示准备状态，to leave 补充说明准备做什么。', 'ready gives the state, and to leave says what the preparation is for.'),
      e([['I', 'subject', '主语', 'Subject'], ['am', 'predicate', '系动词', 'Linking verb'], ['sure', 'predicative', '形容词作表语', 'Adjective as subject complement'], ['that he is right.', 'complement', '从句补足形容词', 'Clause complement of adjective']], 'structure', 'sure 表示确信，that 从句补出确信的具体内容。', 'sure expresses certainty, and the that-clause supplies its content.')
    ], [
      ['有些形容词用介词短语补出对象或范围，介词由形容词的意义关系决定。', 'Some adjectives take a prepositional phrase to complete a target or domain relation.'],
      ['ready、eager、likely 等可接不定式，补充动作内容。', 'ready, eager and likely can take an infinitive to supply an action.'],
      ['sure、glad、aware 等可接从句，补充判断、感受或认知的内容。', 'sure, glad and aware can take a clause to supply the content of a judgment, feeling or awareness.']
    ], [
      q('She is afraid ___ spiders.', 'of', 'to', 'A', 'of spiders 补出 afraid 的对象。', 'of spiders supplies the target of afraid.'),
      q('They are ready ___ start.', 'to', 'of', 'A', 'ready 后用不定式补充要做的动作。', 'ready takes an infinitive for the intended action.'),
      q('I am sure ___ she knows.', 'that', 'than', 'A', 'that 从句补充 sure 的内容。', 'The that-clause completes the content of sure.')
    ]),
    lesson(english, 'adjective-degree', '形容词有程度差别吗', 'Can adjectives vary in degree?', '可分级与不可分级形容词', 'Gradable and non-gradable adjectives', [
      e([['The room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度状语', 'Degree adverbial'], ['cold.', 'object', '可分级形容词作表语', 'Gradable adjective complement']]),
      e([['The answer', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['absolutely', 'adverbial', '强调程度状语', 'Intensifying degree adverbial'], ['correct.', 'object', '不可分级形容词作表语', 'Non-gradable adjective complement']]),
      e([['This task', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['slightly', 'adverbial', '程度状语', 'Degree adverbial'], ['difficult.', 'object', '可分级形容词作表语', 'Gradable adjective complement']])
    ], [
      ['可分级形容词能表示不同程度，可与 very、slightly、quite 等连用。', 'Gradable adjectives allow degrees and combine with very, slightly and quite.'],
      ['表示极限或绝对状态的形容词通常用 absolutely、completely 等强调，规范表达中避免 very perfect。', 'Extreme or absolute adjectives usually take absolutely or completely; avoid very perfect in careful usage.']
    ], [
      q('The water is ___ warm.', 'slightly', 'absolute', 'A', 'warm 可分级，可用 slightly 修饰。', 'warm is gradable and can take slightly.'),
      q('Your answer is ___ correct.', 'absolutely', 'veryly', 'A', 'correct 表示正确状态，常用 absolutely 强调。', 'absolutely naturally intensifies correct.'),
      q('The film was ___ interesting.', 'very', 'completely', 'A', 'interesting 是典型可分级形容词。', 'interesting is a typical gradable adjective.')
    ]),
    lesson(english, 'adjective-comparative-form', '比较级和最高级怎样变', 'Forming comparatives and superlatives', '规则拼写与不规则变化', 'Regular spelling and irregular forms', [
      e([['This road', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['longer', 'object', '形容词比较级作表语', 'Comparative complement'], ['than that one.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Amy', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['happier', 'object', '形容词比较级作表语', 'Comparative complement'], ['today.', 'adverbial', '时间状语', 'Time adverbial']]),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most useful', 'attribute', '形容词最高级作前置定语', 'Superlative attribute'], ['tool', 'object', '表语中心词', 'Complement head'], ['here.', 'adverbial', '地点状语', 'Place adverbial']]),
      e([['My bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['bigger', 'object', '双写末字母的比较级作表语', 'Comparative with doubled final consonant'], ['than yours.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Today', 'adverbial', '时间状语', 'Time adverbial'], ['is', 'predicate', '系动词', 'Linking verb'], ['better', 'object', '不规则比较级作表语', 'Irregular comparative complement'], ['than yesterday.', 'adverbial', '比较对象', 'Comparison phrase']])
    ], [
      ['一般的单音节形容词直接加 -er/-est。', 'Most one-syllable adjectives add -er/-est.'],
      ['“辅音—元音—辅音”结尾的重读单音节词通常双写末字母，再加 -er/-est。', 'A stressed one-syllable adjective ending consonant–vowel–consonant normally doubles the final consonant before -er/-est.'],
      ['辅音字母+y 结尾时，变 y 为 i，再加 -er/-est。', 'For consonant+y, change y to i before adding -er/-est.'],
      ['多音节形容词通常在前面加 more/most。', 'Longer adjectives normally form comparison with more/most.'],
      ['good–better–best、bad–worse–worst、many/much–more–most 要单独记忆。', 'Memorize good–better–best, bad–worse–worst and many/much–more–most.']
    ], [
      q(['happy 的比较级是 ___。', 'The comparative of happy is ___.'], 'happier', 'more happy', 'A', '辅音字母+y 变 y 为 i，再加 er。', 'Consonant+y changes to i before -er.'),
      q(['useful 的最高级是 ___。', 'The superlative of useful is ___.'], 'the most useful', 'the usefulest', 'A', '多音节形容词通常用 most。', 'A long adjective normally uses most.'),
      q(['good 的比较级是 ___。', 'The comparative of good is ___.'], 'better', 'gooder', 'A', 'good 的比较级是不规则形式 better。', 'better is the irregular comparative of good.'),
      q(['big 的比较级是 ___。', 'The comparative of big is ___.'], 'bigger', 'biger', 'A', 'big 是重读闭音节词，双写 g 再加 er。', 'big doubles its final g before -er.'),
      q(['long 的比较级是 ___。', 'The comparative of long is ___.'], 'longer', 'more long', 'A', '一般单音节形容词 long 直接加 er。', 'The one-syllable adjective long adds -er.')
    ]),
    lesson(english, 'adjective-comparison', '怎样比较两个对象', 'Comparing two things', 'than · as...as · less', 'than · as...as · less', [
      e([['Leo', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['taller', 'object', '形容词比较级作表语', 'Comparative complement'], ['than Max.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['This box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['as', 'adverbial', '同级程度标记', 'Equality degree marker'], ['heavy', 'object', '形容词原级作表语', 'Base adjective complement'], ['as that one.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['The blue route', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['less', 'adverbial', '较低程度标记', 'Lower-degree marker'], ['dangerous', 'object', '形容词原级作表语', 'Base adjective complement'], ['than the red route.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['My bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['heavier', 'object', '形容词比较级作表语', 'Comparative complement'], ['than yours.', 'adverbial', '同类比较对象', 'Like-for-like comparison']])
    ], [
      ['比较级 + than 表示一方程度更高。', 'Comparative + than shows a higher degree.'],
      ['as + 原级 + as 表示程度相同。', 'as + base adjective + as shows equality.'],
      ['less + 原级 + than 表示一方程度较低。', 'less + base adjective + than shows a lower degree.'],
      ['比较对象必须在逻辑上同类，必要时用 yours、that 等替代重复名词。', 'The compared items must be logically equivalent; use forms such as yours or that to avoid repeating a noun.']
    ], [
      q('My room is ___ than yours.', 'larger', 'large', 'A', 'than 前使用比较级 larger。', 'Use the comparative larger before than.'),
      q('Ben is as ___ as Sam.', 'careful', 'more careful', 'A', 'as...as 中使用形容词原级。', 'Use the base adjective inside as...as.'),
      q('This plan is ___ expensive than that one.', 'less', 'least', 'A', 'less...than 表示程度较低。', 'less...than expresses a lower degree.'),
      q('Choose the logical comparison.', 'My bag is heavier than yours.', 'My bag is heavier than you.', 'A', 'bag 应与 bag 比较，yours 相当于 your bag。', 'A bag must be compared with a bag; yours means your bag.')
    ]),
    lesson(english, 'comparative-modifiers', '比较差距怎样说清楚', 'Expressing the size of a difference', 'much、a little、具体数量与渐变', 'much · a little · exact amount · gradual change', [
      e([['This room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['much', 'adverbial', '比较级程度修饰语', 'Comparative degree modifier'], ['larger', 'predicative', '形容词比较级作表语', 'Comparative subject complement'], ['than mine.', 'adverbial', '比较对象', 'Comparison phrase']], 'structure', 'larger 说明更大，much 再说明“大得多”，不能用 very larger。', 'larger marks the comparison, and much shows that the difference is large.'),
      e([['This route', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['a little', 'adverbial', '比较级程度修饰语', 'Comparative degree modifier'], ['shorter.', 'predicative', '形容词比较级作表语', 'Comparative subject complement']], 'structure', 'a little 把 shorter 的差距限定为“小一点”。', 'a little limits the difference expressed by shorter to a small amount.'),
      e([['Tom', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['five centimetres', 'adverbial', '具体差值', 'Exact difference'], ['taller', 'predicative', '形容词比较级作表语', 'Comparative subject complement'], ['than Ben.', 'adverbial', '比较对象', 'Comparison phrase']], 'structure', 'five centimetres 放在 taller 前，直接说明两人的具体身高差。', 'five centimetres before taller gives the exact difference.'),
      e([['The days', 'subject', '主语', 'Subject'], ['are getting', 'predicate', '系动词结构', 'Linking-verb phrase'], ['longer and longer.', 'predicative', '重复比较级作表语', 'Repeated comparative as complement']], 'structure', 'longer and longer 不是比较两个固定对象，而是说明同一事物持续变化。', 'longer and longer shows a continuing change in the same thing.')
    ], [
      ['much、far、a lot 可强调比较差距大；不用 very 直接修饰比较级。', 'much, far and a lot mark a large difference; very does not directly modify a comparative.'],
      ['a little、a bit、slightly 表示比较差距小。', 'a little, a bit and slightly mark a small difference.'],
      ['具体数量可放在比较级前，直接说明差值。', 'An exact measure can precede a comparative to state the difference.'],
      ['比较级 + and + 比较级表示程度持续变化。', 'comparative + and + comparative expresses continuing change.']
    ], [
      q('This bag is ___ heavier than that one.', 'much', 'very', 'A', 'much 可以修饰比较级 heavier。', 'much can modify the comparative heavier.'),
      q('The second task is ___ easier.', 'a little', 'the least', 'A', 'a little 表示差距较小。', 'a little marks a small difference.'),
      q('Amy is ten centimetres ___ than Mia.', 'taller', 'tallest', 'A', '具体差值后接比较级。', 'An exact difference is followed by a comparative.'),
      q('The weather is getting ___.', 'colder and colder', 'coldest and coldest', 'A', '重复比较级表示持续变化。', 'Repeated comparatives express continuing change.')
    ]),
    lesson(english, 'adjective-superlative', '怎样在三者以上选最高', 'Choosing the highest degree', '最高级 · 范围 · 序数词', 'Superlative · range · ordinal', [
      e([['Mia', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the tallest', 'object', '形容词最高级作表语', 'Superlative complement'], ['in her class.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most exciting game', 'object', '最高级修饰表语中心词', 'Superlative modifying complement'], ['of the three.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['The Yellow River', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the second longest river', 'object', '序数词 + 最高级作表语', 'Ordinal + superlative complement'], ['in China.', 'adverbial', '地点兼比较范围', 'Place and comparison range']])
    ], [
      ['三者或以上比较通常用最高级。', 'Use the superlative for three or more.'],
      ['用 in + 地点/群体或 of + 限定数量交代比较范围。', 'Use in + place/group or of + defined set to state the comparison range.'],
      ['形容词最高级前通常有 the。', 'An adjective superlative normally takes the.'],
      ['“第几最……”用序数词 + 最高级。', 'Use ordinal + superlative for a ranking such as “the second longest”.']
    ], [
      q('She is ___ runner on the team.', 'the fastest', 'faster', 'A', '在全队范围内选最高，使用 the fastest。', 'Use the superlative within the whole team.'),
      q('This is the best ___ the four plans.', 'of', 'than', 'A', '有限个体范围通常用 of。', 'Use of for a defined set.'),
      q('It is the ___ largest city.', 'third', 'three', 'A', '排名使用序数词 third。', 'A ranking uses the ordinal third.')
    ]),
    lesson(english, 'comparison-boundaries', '比较范围与特殊结构', 'Comparison ranges and special patterns', '两者选一、排除自身、倍数与最高级转述', 'Two-item choice · self-exclusion · multiples · paraphrase', [
      e([['Leo', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the taller', 'predicative', 'the + 比较级作表语', 'the + comparative as complement'], ['of the two.', 'adverbial', '两者范围', 'Two-item range']], 'structure', '范围只有两人，用比较级 taller；the 表示两者中确定的较高者。', 'With only two people, taller is comparative; the identifies the taller one.'),
      e([['Shanghai', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['larger', 'predicative', '形容词比较级作表语', 'Comparative subject complement'], ['than any other city in China.', 'adverbial', '排除自身的比较范围', 'Comparison range excluding itself']], 'structure', 'Shanghai 属于中国城市，比较时用 any other 排除 Shanghai 自身。', 'Shanghai belongs to the set, so any other excludes Shanghai itself.'),
      e([['This rope', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['twice as long', 'predicative', '倍数同级比较作表语', 'Multiple equality comparison'], ['as that one.', 'adverbial', '比较对象', 'Comparison phrase']], 'structure', 'twice 放在 as...as 前，表示长度是另一条绳子的两倍。', 'twice before as...as makes the length two times that of the other rope.'),
      e([['No other runner', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['faster', 'predicative', '形容词比较级作表语', 'Comparative subject complement'], ['than Mia.', 'adverbial', '比较对象', 'Comparison phrase']], 'structure', '“没有其他人更快”与“Mia 最快”表达同一范围内的最高程度。', '“No other runner is faster” paraphrases Mia as the fastest in the set.')
    ], [
      ['两者中选较高者用 the + 比较级 + of the two。', 'Use the + comparative + of the two to choose the higher of two.'],
      ['同一范围内比较时要排除主语自身，常用 any other + 单数名词。', 'In the same set, exclude the subject itself with any other + singular noun.'],
      ['倍数 + as + 原级 + as 表示倍数关系。', 'multiple + as + base adjective + as expresses a multiple relation.'],
      ['最高级可用 no other...comparative than 或 comparative than any other...转述。', 'A superlative can be paraphrased with no other...comparative than or comparative than any other.']
    ], [
      q('Of the two sisters, Amy is ___.', 'the taller', 'the tallest', 'A', '两者范围用 the + 比较级。', 'Use the + comparative for a two-item set.'),
      q('Beijing is larger than ___ city in China.', 'any other', 'any', 'A', '同一范围比较要排除 Beijing 自身。', 'Exclude Beijing itself with any other.'),
      q('This table is twice as ___ as that one.', 'wide', 'wider', 'A', 'as...as 中使用原级 wide。', 'Use the base adjective inside as...as.'),
      q('No other student is ___ than Leo.', 'taller', 'tallest', 'A', 'no other 后用比较级转述最高级意义。', 'Use a comparative after no other for a superlative meaning.')
    ]),
    lesson(english, 'participle-adjectives', '-ing 与 -ed 形容词', '-ing and -ed adjectives', '引起感受与产生感受', 'Cause and experience of feelings', [
      e([['The lesson', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['interesting.', 'object', '-ing 形容词作表语', '-ing adjective complement']]),
      e([['The students', 'subject', '主语', 'Subject'], ['are', 'predicate', '系动词', 'Linking verb'], ['interested', 'object', '-ed 形容词作表语', '-ed adjective complement'], ['in the lesson.', 'adverbial', '对象状语', 'Target phrase']]),
      e([['The frightening noise', 'subject', '-ing 形容词作前置定语的主语', 'Subject with -ing attribute'], ['made', 'predicate', '谓语动词', 'Predicate verb'], ['the child', 'object', '宾语', 'Object'], ['frightened.', 'attribute', '-ed 形容词作宾语补足语', '-ed object complement']])
    ], [
      ['-ing 形容词通常说明人或事物“令人产生某种感受”。', '-ing adjectives usually describe what causes a feeling.'],
      ['-ed 形容词通常说明感受者“感到……”。', '-ed adjectives usually describe the experiencer.'],
      ['选择形式要看被描述对象的语义角色，不只看它是人还是物。', 'Choose by semantic role, not simply whether the noun is a person or thing.']
    ], [
      q('The film was ___.', 'exciting', 'excited', 'A', '电影带来兴奋感，用 exciting。', 'The film causes excitement, so use exciting.'),
      q('We were ___ by the result.', 'surprised', 'surprising', 'A', 'we 是感受者，用 surprised。', 'We experience the feeling, so use surprised.'),
      q('The ___ audience cheered loudly.', 'excited', 'exciting', 'A', '观众感到兴奋，用 excited。', 'The audience experiences excitement.')
    ]),
    lesson(english, 'compound-adjectives', '复合形容词怎样构成', 'Forming compound adjectives', '连字符、单位单数与整体修饰', 'Hyphens · singular units · one modifier', [
      e([['She', 'subject', '主语', 'Subject'], ['has', 'predicate', '谓语动词', 'Predicate verb'], ['a ten-year-old son.', 'object', '含复合形容词的宾语', 'Object with compound adjective']], 'structure', 'ten-year-old 整体放在 son 前；year 保持单数，并用连字符连成一个修饰单位。', 'ten-year-old is one modifier before son; year stays singular and hyphens join the unit.'),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['a well-known story.', 'predicative', '含复合形容词的表语', 'Complement with compound adjective']], 'structure', 'well-known 由副词和过去分词构成，整体说明 story“广为人知”。', 'well-known combines an adverb and participle into one quality describing story.'),
      e([['We', 'subject', '主语', 'Subject'], ['took', 'predicate', '谓语动词', 'Predicate verb'], ['a two-hour walk.', 'object', '含复合形容词的宾语', 'Object with compound adjective']], 'structure', 'two-hour 在名词前整体表示“两小时的”，hour 不加复数。', 'two-hour acts as one pre-noun modifier meaning “lasting two hours”; hour is singular.')
    ], [
      ['多个词在名词前共同表达一个特征时，常用连字符组成复合形容词。', 'Words that jointly express one pre-noun quality are often hyphenated as a compound adjective.'],
      ['“数词 + 单位名词 + 形容词”作复合定语时，单位名词通常用单数。', 'In number + unit + adjective compounds, the unit noun is normally singular.'],
      ['“数词 + 单位名词”作前置复合定语时，单位名词同样保持单数。', 'A number + unit compound before a noun likewise keeps the unit singular.']
    ], [
      q('She has a ___ daughter.', 'six-year-old', 'six-years-old', 'A', '复合定语中的 year 用单数。', 'The unit year is singular inside the compound.'),
      q('Choose the adjective before story.', 'well-known', 'well knownly', 'A', 'well-known 整体作前置复合形容词。', 'well-known acts as one compound adjective.'),
      q('We had a ___ meeting.', 'three-hour', 'three-hours', 'A', '单位名词 hour 在复合定语中用单数。', 'hour stays singular in the compound modifier.')
    ]),
    lesson(english, 'adjective-order', '多个形容词怎样排序', 'Ordering multiple adjectives', '限定、评价、大小、年龄、颜色、来源、材料、用途', 'Determiner · opinion · size · age · color · origin · material · purpose', [
      e([['She', 'subject', '主语', 'Subject'], ['bought', 'predicate', '谓语动词', 'Predicate verb'], ['a lovely small old house.', 'object', '宾语：评价 + 大小 + 年龄 + 名词', 'Object: opinion + size + age + noun']]),
      e([['He', 'subject', '主语', 'Subject'], ['wears', 'predicate', '谓语动词', 'Predicate verb'], ['a new black Italian coat.', 'object', '宾语：年龄 + 颜色 + 来源 + 名词', 'Object: age + color + origin + noun']]),
      e([['We', 'subject', '主语', 'Subject'], ['sat at', 'predicate', '谓语与介词', 'Predicate and preposition'], ['a beautiful round wooden table.', 'object', '介词宾语：评价 + 形状 + 材料 + 名词', 'Prepositional object: opinion + shape + material + noun']]),
      e([['She', 'subject', '主语', 'Subject'], ['chose', 'predicate', '谓语动词', 'Predicate verb'], ['a lovely old wooden dining table.', 'object', '宾语：评价 + 年龄 + 材料 + 用途 + 名词', 'Object: opinion + age + material + purpose + noun']])
    ], [
      ['常见顺序为：限定词—评价—大小—形状—年龄—颜色—来源—材料—用途—名词。', 'A common order is determiner–opinion–size–shape–age–color–origin–material–purpose–noun.'],
      ['评价词通常靠前，材料和用途通常最靠近中心名词。', 'Opinion adjectives normally come early, while material and purpose stay closest to the head noun.']
    ], [
      q('Choose the natural order.', 'a beautiful old stone bridge', 'a stone old beautiful bridge', 'A', '评价在前，年龄居中，材料靠近名词。', 'Opinion comes first; material stays closest to the noun.'),
      q('Choose the natural order.', 'a small red bag', 'a red small bag', 'A', '大小通常在颜色之前。', 'Size normally precedes color.'),
      q('Choose the natural order.', 'an expensive Japanese camera', 'a Japanese expensive camera', 'A', '评价通常在来源之前。', 'Opinion normally precedes origin.'),
      q('Choose the natural order.', 'a wooden dining table', 'a dining wooden table', 'A', '材料 wooden 通常放在用途 dining 之前。', 'Material wooden normally precedes purpose dining.')
    ]),
    lesson(english, 'adjective-nominal', '形容词的特殊用法', 'Special adjective structures', 'the + 形容词 · 数量表达 · 平行比较', 'the + adjective · measurement · parallel comparison', [
      e([['The rich', 'subject', 'the + 形容词作复数概念主语', 'the + adjective as plural subject'], ['should', 'helper', '情态动词', 'Modal verb'], ['help', 'predicate', '谓语动词', 'Predicate verb'], ['the poor.', 'object', 'the + 形容词作宾语', 'the + adjective as object']]),
      e([['The wall', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['two metres', 'adverbial', '度量状语', 'Measurement adverbial'], ['high.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The more careful', 'object', '前置的比较级表语', 'Fronted comparative complement'], ['you', 'subject', '第一分句主语', 'First-clause subject'], ['are,', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['the fewer mistakes', 'object', '前置的比较级宾语', 'Fronted comparative object'], ['you', 'subject', '第二分句主语', 'Second-clause subject'], ['make.', 'predicate', '第二分句谓语', 'Second-clause predicate']], 'translation', 'the more..., the fewer... 按“越……，越……”理解，两个比较级形成联动关系。', 'the more..., the fewer... expresses a linked “the more..., the less...” relationship.')
    ], [
      ['the + 形容词可表示一类人，通常具有复数意义，如 the elderly。', 'the + adjective can refer to a class of people and normally has plural meaning, as in the elderly.'],
      ['“数量 + 单位 + 形容词”表达尺寸。', 'Measurement + adjective expresses dimensions.'],
      ['the + 比较级..., the + 比较级... 表示联动变化。', 'the + comparative..., the + comparative... expresses linked change.']
    ], [
      q('The elderly ___ special care.', 'need', 'needs', 'A', 'the elderly 表示一类人，谓语用复数。', 'the elderly has plural meaning and takes need.'),
      q('The river is 200 metres ___.', 'wide', 'widely', 'A', '数量短语后用形容词 wide 表尺寸。', 'Use the adjective wide after a measurement.'),
      q('The harder you work, the ___ you become.', 'stronger', 'strongest', 'A', '联动比较结构两部分都用比较级。', 'Both halves of the correlative structure use comparatives.')
    ])
  ], '形容词', 'Adjectives', ['adjective-restrictions','comparison-boundaries','compound-adjectives','adjective-order','adjective-nominal'], [
    ['adjective-foundation', '定义、本质与句中作用', 'Definition, core and sentence roles', '先看形容词给谁添加什么性质，再判断定语、表语或宾语补足语。', 'First identify what quality is added to what, then identify its sentence role.', ['adjective-essence','adjective-jobs']],
    ['adjective-position-function', '位置、限制与后接成分', 'Position, restrictions and complements', '掌握前置、后置、表语限制以及形容词怎样补全意义。', 'Master prepositive, postpositive and predicative restrictions and adjective complementation.', ['adjective-position','adjective-restrictions','adjective-complements']],
    ['adjective-degree-form', '程度与比较形式', 'Degree and comparison forms', '先判断能否分级，再选择比较级和最高级形式。', 'Decide gradability first, then choose comparative and superlative forms.', ['adjective-degree','adjective-comparative-form']],
    ['adjective-comparison-system', '比较关系与范围', 'Comparison relations and ranges', '讲清同级、比较级、最高级、差距、倍数和比较范围。', 'Handle equality, comparatives, superlatives, differences, multiples and ranges.', ['adjective-comparison','comparative-modifiers','adjective-superlative','comparison-boundaries']],
    ['adjective-formation-order', '意义形成与排列', 'Meaning, formation and order', '处理分词形容词、复合形容词和多个形容词的自然顺序。', 'Handle participial adjectives, compounds and natural adjective order.', ['participle-adjectives','compound-adjectives','adjective-order']],
    ['adjective-special', '特殊结构', 'Special structures', '处理 the + 形容词、尺寸表达和联动比较。', 'Handle the + adjective, measurement expressions and linked comparison.', ['adjective-nominal']]
  ]);
  const explanations = {
    'adjective-jobs': [
      ['kind 放在 teacher 前，直接说明老师具有“友善”这一特点。','kind precedes teacher and directly adds the quality of kindness.'],
      ['blue 通过系动词 looks 说明主语 sky 的状态，是表语。','blue describes the sky through looks and is a subject complement.'],
      ['happy 说明宾语 her 受到消息影响后的状态，是宾语补足语。','happy describes the resulting state of her and is an object complement.']
    ],
    'adjective-position': [
      ['beautiful 放在 dress 前作定语，先给出特征，再出现中心名词。','beautiful comes before dress as an attribute, adding the quality before the head noun.'], null, null
    ],
    'adjective-degree': [
      ['cold 有不同程度，very 把寒冷程度提高。','cold allows degrees, and very intensifies it.'],
      ['correct 表示完整的正确状态，absolutely 用来强调这种绝对判断。','correct presents an absolute state, and absolutely emphasizes it.'],
      ['difficult 可以有程度差别，slightly 表示只难一点。','difficult is gradable, and slightly marks a small degree.']
    ],
    'adjective-comparative-form': [
      ['long 是普通单音节词，比较级直接加 -er 变为 longer。','long is a regular one-syllable adjective and adds -er.'],
      ['happy 以辅音字母加 y 结尾，y 变 i 后加 -er。','happy ends in consonant + y, so y changes to i before -er.'],
      ['useful 较长，最高级用 the most useful，不在词尾加 -est。','useful is longer, so it uses the most rather than -est.'],
      ['big 是重读辅元辅结构，双写 g 后加 -er。','big has a stressed CVC ending, so g doubles before -er.'],
      ['good 的比较级是不规则形式 better。','good has the irregular comparative better.']
    ],
    'adjective-comparison': [
      ['taller 与 than 连用，表示 Leo 的身高超过 Max。','taller with than shows that Leo exceeds Max in height.'],
      ['as heavy as 把两个箱子的重量放在同一程度上。','as heavy as places the two boxes at the same degree of weight.'],
      ['less dangerous than 表示蓝色路线的危险程度更低。','less dangerous than marks the blue route as lower in danger.'],
      ['yours 代替 your bag，让 bag 与 bag 比较，避免拿 bag 与人比较。','yours replaces your bag, keeping the compared items equivalent.']
    ],
    'adjective-superlative': [
      ['the tallest 在 her class 的范围内选出身高最高者。','the tallest selects the highest degree within her class.'],
      ['of the three 明确三场比赛的范围，因此用最高级 the most exciting。','of the three defines a three-item set, so the superlative is used.'],
      ['the second longest 表示长度排名第二，不是普通的“第二条长河”。','the second longest gives the second-highest rank in length.']
    ],
    'participle-adjectives': [
      ['lesson 引起兴趣，所以用 interesting 描述“令人感兴趣”。','The lesson causes interest, so interesting describes it.'],
      ['students 是感受者，所以用 interested；in the lesson 补出兴趣对象。','The students experience the feeling, so interested is used; in the lesson gives its target.'],
      ['noise 引起恐惧用 frightening；child 感到恐惧用 frightened。','The noise causes fear, so it is frightening; the child feels it, so is frightened.']
    ],
    'adjective-order': [
      ['lovely 是评价，small 是大小，old 是年龄，按由主观看法到客观特征排列。','lovely is opinion, small size and old age, ordered from evaluation toward inherent detail.'],
      ['new 表年龄，black 表颜色，Italian 表来源，来源更靠近 coat。','new gives age, black color and Italian origin, with origin closer to coat.'],
      ['beautiful 是评价，round 是形状，wooden 是材料，材料最靠近 table。','beautiful is opinion, round shape and wooden material, with material closest to table.'],
      ['wooden 是材料，dining 是用途；用途直接限定 table 的类型，因此最靠近名词。','wooden gives material and dining purpose; purpose stays closest to table.']
    ],
    'adjective-nominal': [
      ['the rich 和 the poor 分别指一类人，整体具有复数意义。','the rich and the poor each refer to a class of people and have plural meaning.'],
      ['two metres 先给出具体尺寸，high 再说明这是高度。','two metres gives the measure, and high identifies the dimension as height.'], null
    ]
  };
  const byId = Object.fromEntries(bundle.course.map(item => [item.id, item]));
  byId['adjective-restrictions'].analyses[0].splice(3, 1,
    { text: 'is', role: 'predicate', label: pick(english, '系动词', 'Linking verb') },
    { text: 'cost.', role: 'predicative', label: pick(english, '名词作表语', 'Noun as subject complement') }
  );
  bundle.course.forEach(item => {
    item.analyses.forEach(analysis => analysis.forEach(unit => {
      if (unit.role === 'object' && /表语|complement/i.test(unit.label)) unit.role = 'predicative';
      if (unit.role === 'attribute' && /宾语补足语|object complement/i.test(unit.label)) unit.role = 'objectComplement';
    }));
    item.exampleNotes.forEach((note, index) => {
      if (note.visible) return;
      const pair = explanations[item.id] && explanations[item.id][index];
      if (!pair) throw new Error(`Missing adjective example explanation: ${item.id}[${index}]`);
      item.exampleNotes[index] = { visible: true, mode: 'structure', title: pick(english, '例句说明', 'Example focus'), body: pick(english, pair[0], pair[1]), detail: '' };
    });
  });
  return bundle;
}

function buildAdverbCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  return groupCourse(english, [
    lesson(english, 'adverb-jobs', '副词在句中做什么', 'What adverbs do', '修饰动词、形容词、副词或全句', 'Modify verbs, adjectives, adverbs or clauses', [
      e([['Mia', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['politely.', 'adverbial', '方式状语：修饰动词', 'Manner adverbial modifying verb']]),
      e([['The water', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度状语：修饰形容词', 'Degree adverbial modifying adjective'], ['cold.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Fortunately,', 'adverbial', '评注性句子副词', 'Comment adverb modifying clause'], ['everyone', 'subject', '主语', 'Subject'], ['arrived', 'predicate', '谓语动词', 'Predicate verb'], ['safely.', 'adverbial', '方式状语', 'Manner adverbial']]),
      e([['He', 'subject', '主语', 'Subject'], ['finished', 'predicate', '谓语动词', 'Predicate verb'], ['the task', 'object', '宾语', 'Object'], ['remarkably', 'adverbial', '程度副词：修饰副词 quickly', 'Degree adverb modifying quickly'], ['quickly.', 'adverbial', '方式副词：修饰动词 finished', 'Manner adverb modifying finished']])
    ], [
      ['副词可以修饰动词，说明动作的方式等信息。', 'An adverb can modify a verb, for example to show manner.'],
      ['程度副词可以修饰形容词。', 'A degree adverb can modify an adjective.'],
      ['程度副词也可以修饰另一个副词。', 'A degree adverb can also modify another adverb.'],
      ['句子副词可以评价或限定整个句子。', 'A sentence adverb can comment on or qualify a whole clause.']
    ], [
      q('She spoke ___.', 'clearly', 'clear', 'A', 'clearly 修饰动词 spoke，作方式状语。', 'clearly modifies the verb spoke.'),
      q('The test is ___ easy.', 'quite', 'quiet', 'A', 'quite 是程度副词，修饰 easy。', 'quite is a degree adverb modifying easy.'),
      q('___, nobody was hurt.', 'Luckily', 'Lucky', 'A', 'Luckily 评价整个句子。', 'Luckily comments on the whole clause.'),
      q('She completed the work extremely ___.', 'carefully', 'careful', 'A', 'extremely 修饰副词 carefully；carefully 再修饰 completed。', 'extremely modifies the adverb carefully, which modifies completed.')
    ]),
    lesson(english, 'adverb-types', '副词有哪些类别', 'Types of adverbs', '时间、地点、方式、频率、程度', 'Time · place · manner · frequency · degree', [
      e([['We', 'subject', '主语', 'Subject'], ['will meet', 'predicate', '谓语动词', 'Predicate verb'], ['outside', 'adverbial', '地点状语', 'Place adverbial'], ['tomorrow.', 'adverbial', '时间状语', 'Time adverbial']], 'translation', '英语常把地点放在时间前；中文更常说“明天在外面见”。', 'English commonly places place before time; Chinese more often puts the time expression before the place expression.'),
      e([['She', 'subject', '主语', 'Subject'], ['often', 'adverbial', '频率状语', 'Frequency adverbial'], ['reads', 'predicate', '谓语动词', 'Predicate verb'], ['quietly', 'adverbial', '方式状语', 'Manner adverbial'], ['here.', 'adverbial', '地点状语', 'Place adverbial']]),
      e([['The bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Fortunately,', 'adverbial', '评注性句子副词', 'Comment adverb'], ['the rain', 'subject', '主语', 'Subject'], ['stopped', 'predicate', '谓语动词', 'Predicate verb'], ['soon.', 'adverbial', '时间状语', 'Time adverbial']])
    ], [
      ['时间副词说明动作发生的时间。', 'Time adverbs say when an action happens.'],
      ['地点副词说明动作发生的地点或方向。', 'Place adverbs say where an action happens or points.'],
      ['方式副词说明动作怎样发生。', 'Manner adverbs say how an action happens.'],
      ['频率副词说明动作发生得多频繁。', 'Frequency adverbs say how often an action happens.'],
      ['程度副词说明性质、状态或动作的程度。', 'Degree adverbs express the degree of a quality, state or action.'],
      ['评注性副词表达说话者对全句的态度或判断。', 'Comment adverbs express the speaker’s attitude or judgment toward a whole clause.']
    ], [
      q('We met ___ yesterday.', 'there', 'very', 'A', 'there 是地点副词。', 'there is a place adverb.'),
      q('He ___ walks to school.', 'usually', 'careful', 'A', 'usually 是频率副词。', 'usually is a frequency adverb.'),
      q('The box is ___ small.', 'quite', 'outside', 'A', 'quite 是程度副词。', 'quite is a degree adverb.'),
      q('We will leave ___.', 'tomorrow', 'carefully', 'A', 'tomorrow 是时间副词。', 'tomorrow is a time adverb.'),
      q('She answered ___.', 'politely', 'yesterday', 'A', 'politely 是方式副词。', 'politely is a manner adverb.'),
      q('___, the key was still there.', 'Luckily', 'Outside', 'A', 'Luckily 是评价全句的评注性副词。', 'Luckily is a comment adverb modifying the whole clause.')
    ]),
    lesson(english, 'adverb-position', '副词放在哪里', 'Where adverbs go', '中位、句尾与句首', 'Mid, end and front positions', [
      e([['Lily', 'subject', '主语', 'Subject'], ['usually', 'adverbial', '频率状语：置于实义动词前', 'Frequency adverbial before main verb'], ['walks', 'predicate', '谓语动词', 'Predicate verb'], ['to school.', 'adverbial', '方向状语', 'Direction adverbial']]),
      e([['Lily', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['always', 'adverbial', '频率状语：置于 be 后', 'Frequency adverbial after be'], ['kind.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Yesterday,', 'adverbial', '时间状语置于句首', 'Fronted time adverbial'], ['we', 'subject', '主语', 'Subject'], ['finished', 'predicate', '谓语动词', 'Predicate verb'], ['the work', 'object', '宾语', 'Object'], ['quickly.', 'adverbial', '方式状语置于句尾', 'End-position manner adverbial']]),
      e([['She', 'subject', '主语', 'Subject'], ['has', 'helper', '助动词', 'Auxiliary verb'], ['never', 'adverbial', '频率状语：置于第一个助动词后', 'Frequency adverbial after first auxiliary'], ['visited', 'predicate', '谓语动词', 'Predicate verb'], ['London.', 'object', '宾语', 'Object']])
    ], [
      ['频率副词通常放在实义动词前。', 'Frequency adverbs normally precede main verbs.'],
      ['频率副词通常放在 be 动词后。', 'Frequency adverbs normally follow be.'],
      ['有助动词时，频率副词通常放在第一个助动词后。', 'With auxiliaries, a frequency adverb normally follows the first auxiliary.'],
      ['方式副词常放在动词及其宾语之后。', 'A manner adverb often follows the verb and its object.'],
      ['时间副词可放句首或句尾；放在句首时常用逗号隔开。', 'A time adverb may come first or last; a fronted time adverb is commonly followed by a comma.']
    ], [
      q('Tom ___ gets up early.', 'often', 'gets often', 'A', 'often 通常放在实义动词 gets 前。', 'often normally comes before the main verb gets.'),
      q('She is ___ late.', 'never', 'late never', 'A', '频率副词置于 be 动词之后。', 'A frequency adverb follows be.'),
      q('He completed the task ___.', 'carefully', 'careful', 'A', '方式副词 carefully 常放在宾语之后。', 'The manner adverb carefully naturally follows the object.'),
      q('She has ___ seen snow.', 'never', 'seen never', 'A', 'never 放在第一个助动词 has 后。', 'never follows the first auxiliary has.'),
      q('Choose the natural time-adverb position.', 'Yesterday, we stayed home.', 'We yesterday stayed home.', 'A', '时间副词可置于句首，并用逗号隔开。', 'A time adverb can be fronted and followed by a comma.')
    ]),
    lesson(english, 'adjective-or-adverb', '形容词还是副词', 'Adjective or adverb?', '系动词、行为动词与同形词', 'Linking verbs, action verbs and flat adverbs', [
      e([['The flowers', 'subject', '主语', 'Subject'], ['smell', 'predicate', '系动词', 'Linking verb'], ['sweet.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The child', 'subject', '主语', 'Subject'], ['smelled', 'predicate', '行为动词', 'Action verb'], ['the flower', 'object', '宾语', 'Object'], ['carefully.', 'adverbial', '方式状语', 'Manner adverbial']]),
      e([['The train', 'subject', '主语', 'Subject'], ['moves', 'predicate', '谓语动词', 'Predicate verb'], ['fast.', 'adverbial', '同形副词作方式状语', 'Flat adverb of manner']]),
      e([['Our new neighbour', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['friendly.', 'object', '以 -ly 结尾的形容词作表语', 'Adjective ending in -ly as complement']])
    ], [
      ['系动词后用形容词说明主语。', 'Use an adjective after a linking verb to describe the subject.'],
      ['行为动词通常由副词修饰。', 'Use an adverb to modify an action verb.'],
      ['fast、hard、late、early 等可直接作副词，不加 -ly。', 'fast, hard, late and early can be adverbs without -ly.'],
      ['friendly、lovely 等虽然以 -ly 结尾，却通常是形容词。', 'friendly and lovely end in -ly but are normally adjectives.']
    ], [
      q('The music sounds ___.', 'beautiful', 'beautifully', 'A', 'sound 作系动词，后用形容词。', 'sound is linking here and takes an adjective.'),
      q('She sings ___.', 'beautifully', 'beautiful', 'A', '副词 beautifully 修饰行为动词 sings。', 'beautifully modifies the action verb sings.'),
      q('He works ___.', 'hard', 'hardly', 'A', 'hard 可直接作副词，表示“努力地”。', 'hard is an adverb here meaning “with effort”.'),
      q('She gave me a ___ smile.', 'friendly', 'friendlily', 'A', 'friendly 是形容词，修饰名词 smile。', 'friendly is an adjective modifying smile.')
    ]),
    lesson(english, 'adverb-comparison', '副词也能比较吗', 'Comparing adverbs', '比较级、最高级与同级比较', 'Comparative, superlative and equality', [
      e([['Amy', 'subject', '主语', 'Subject'], ['runs', 'predicate', '谓语动词', 'Predicate verb'], ['faster', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than Sue.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Ben', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['more carefully', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than I did.', 'adverbial', '比较分句', 'Comparison clause']]),
      e([['Of all the runners,', 'adverbial', '比较范围', 'Comparison range'], ['Leo', 'subject', '主语', 'Subject'], ['ran', 'predicate', '谓语动词', 'Predicate verb'], ['the fastest.', 'adverbial', '方式副词最高级', 'Superlative adverb of manner']]),
      e([['Nora', 'subject', '主语', 'Subject'], ['performed', 'predicate', '谓语动词', 'Predicate verb'], ['better', 'adverbial', '不规则副词比较级', 'Irregular comparative adverb'], ['than before.', 'adverbial', '比较对象', 'Comparison phrase']])
    ], [
      ['短副词常加 -er/-est 构成比较级和最高级。', 'Short adverbs often add -er/-est to form comparatives and superlatives.'],
      ['多数 -ly 副词用 more/most 构成比较级和最高级。', 'Most -ly adverbs form comparison with more/most.'],
      ['well–better–best、badly–worse–worst 等是不规则变化。', 'Forms such as well–better–best and badly–worse–worst are irregular.']
    ], [
      q('Jane speaks ___ than before.', 'more clearly', 'clearlier', 'A', '-ly 副词通常用 more 构成比较级。', 'An -ly adverb normally forms its comparative with more.'),
      q('Tom runs ___ of the three.', 'the fastest', 'faster', 'A', '三者范围使用副词最高级。', 'Use the adverb superlative for a group of three.'),
      q('She did ___ than yesterday.', 'better', 'more well', 'A', 'well 的比较级是不规则形式 better。', 'better is the irregular comparative of well.')
    ]),
    lesson(english, 'degree-patterns', '程度副词怎样搭配', 'Degree adverb patterns', 'enough · too · so · such', 'enough · too · so · such', [
      e([['The room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['warm', 'object', '形容词作表语', 'Adjective complement'], ['enough', 'adverbial', '后置程度状语', 'Postposed degree adverbial'], ['for the baby.', 'adverbial', '对象状语', 'Reference phrase']]),
      e([['The box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy', 'object', '形容词作表语', 'Adjective complement'], ['for me to lift.', 'adverbial', '动作执行者与结果结构', 'Agent and infinitive result']]),
      e([['It', 'subject', '形式主语', 'Dummy subject'], ['was', 'predicate', '系动词', 'Linking verb'], ['such', 'attribute', '程度限定词', 'Degree predeterminer'], ['a', 'attribute', '冠词', 'Article'], ['difficult', 'attribute', '形容词作前置定语', 'Prepositive adjective'], ['question', 'object', '表语中心词', 'Complement head'], ['that nobody answered it.', 'adverbial', '结果状语从句', 'Result clause']]),
      e([['The question', 'subject', '主语', 'Subject'], ['was', 'predicate', '系动词', 'Linking verb'], ['so', 'adverbial', '程度状语', 'Degree adverbial'], ['difficult', 'object', '形容词作表语', 'Adjective complement'], ['that nobody answered it.', 'adverbial', '结果状语从句', 'Result clause']])
    ], [
      ['enough 修饰形容词或副词时放在其后。', 'enough follows the adjective or adverb it modifies.'],
      ['too 放在形容词或副词前，常表示“过于……而不能……”。', 'too precedes an adjective or adverb and often means “excessively...to...”.'],
      ['so 修饰形容词或副词，如 so difficult。', 'so modifies an adjective or adverb, as in so difficult.'],
      ['such 修饰名词短语，如 such a difficult task。', 'such modifies a noun phrase, as in such a difficult task.']
    ], [
      q('She is old ___ to travel alone.', 'enough', 'too', 'A', 'enough 修饰形容词时放在其后。', 'enough follows the adjective it modifies.'),
      q('The water is ___ hot to drink.', 'too', 'enough', 'A', 'too...to 表示过热而不能喝。', 'too...to means excessively hot to drink.'),
      q('It was ___ an exciting match.', 'such', 'so', 'A', 'an exciting match 是名词短语，前用 such。', 'Use such before the noun phrase an exciting match.'),
      q('The film was ___ exciting that we watched it twice.', 'so', 'such', 'A', 'exciting 是形容词，前用 so。', 'exciting is an adjective, so use so.')
    ]),
    lesson(english, 'adverb-scope', '副词修饰范围会改变意思', 'Adverb scope changes meaning', 'only · even · almost · 句子副词', 'only · even · almost · sentence adverbs', [
      e([['Only Mia', 'subject', 'only 限定主语', 'only focusing the subject'], ['solved', 'predicate', '谓语动词', 'Predicate verb'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'Only Mia 表示“只有米娅（别人没有）”，only 的位置决定被限定的信息。', 'Only Mia means Mia and nobody else; the position of only determines its focus.'),
      e([['Mia', 'subject', '主语', 'Subject'], ['only solved', 'predicate', 'only 限定动作', 'only focusing the action'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'only solved 强调“只解出了”，没有做更多事情；与 Only Mia 的焦点不同。', 'only solved focuses on the action and differs from Only Mia.'),
      e([['Frankly,', 'adverbial', '评注性句子副词', 'Comment sentence adverb'], ['the plan', 'subject', '主语', 'Subject'], ['will', 'helper', '助动词', 'Auxiliary verb'], ['probably', 'adverbial', '可能性状语', 'Probability adverbial'], ['fail.', 'predicate', '谓语动词', 'Predicate verb']]),
      e([['Even', 'adverbial', '聚焦副词：强调出乎意料', 'Focusing adverb marking surprise'], ['Ben', 'subject', '主语', 'Subject'], ['almost', 'adverbial', '接近程度副词', 'Approximating adverb'], ['missed', 'predicate', '谓语动词', 'Predicate verb'], ['the bus.', 'object', '宾语', 'Object']])
    ], [
      ['only 应尽量靠近被限定成分，位置变化可能改变句意。', 'only should stand near its focus; a position change can alter meaning.'],
      ['句子副词表达说话者态度、判断或把握程度，作用范围是全句。', 'Sentence adverbs express the speaker’s attitude, judgment or certainty and scope over the clause.'],
      ['even 强调出乎意料的焦点。', 'even marks an unexpected focus.'],
      ['almost 表示某事接近发生但实际没有发生。', 'almost says an event came close to happening but did not.']
    ], [
      q(['哪一句表示“只有李华通过了考试”？', 'Which sentence means that Li Hua—and nobody else—passed the exam?'], 'Only Li Hua passed the exam.', 'Li Hua only passed the exam.', 'A', 'only 紧靠 Li Hua，限定“谁”。', 'only next to Li Hua focuses on who passed.'),
      q('___, I disagree with the decision.', 'Honestly', 'Honest', 'A', 'Honestly 是评注性句子副词。', 'Honestly is a comment adverb modifying the clause.'),
      q('She ___ missed the bus; she arrived just in time.', 'almost', 'always', 'A', 'almost missed 表示“差点错过但没有”。', 'almost missed means it nearly happened but did not.'),
      q('___ Ben understood the difficult puzzle.', 'Even', 'Very', 'A', 'Even 聚焦 Ben，强调结果出乎预料。', 'Even focuses Ben and marks the result as unexpected.')
    ]),
    lesson(english, 'adverb-traps', '易混副词与连接副词', 'Adverb traps and linking adverbs', 'hard/hardly · late/lately · however/therefore', 'hard/hardly · late/lately · however/therefore', [
      e([['He', 'subject', '主语', 'Subject'], ['works', 'predicate', '谓语动词', 'Predicate verb'], ['hard', 'adverbial', '方式状语：努力地', 'Manner adverb: with effort'], ['every day.', 'adverbial', '时间状语', 'Time adverbial']]),
      e([['I', 'subject', '主语', 'Subject'], ['have', 'helper', '助动词', 'Auxiliary verb'], ['hardly', 'adverbial', '近乎否定的频度状语', 'Near-negative frequency adverbial'], ['seen', 'predicate', '谓语动词', 'Predicate verb'], ['her', 'object', '宾语', 'Object'], ['lately.', 'adverbial', '时间状语：最近', 'Time adverb: recently']]),
      e([['The road', 'subject', '第一分句主语', 'First-clause subject'], ['was', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['closed;', 'object', '第一分句表语', 'First-clause complement'], ['therefore,', 'adverbial', '连接副词：表示结果', 'Linking adverb: result'], ['we', 'subject', '第二分句主语', 'Second-clause subject'], ['took', 'predicate', '第二分句谓语', 'Second-clause predicate'], ['another route.', 'object', '第二分句宾语', 'Second-clause object']]),
      e([['The task', 'subject', '第一分句主语', 'First-clause subject'], ['was', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['difficult;', 'object', '第一分句表语', 'First-clause complement'], ['however,', 'adverbial', '连接副词：表示转折', 'Linking adverb: contrast'], ['we', 'subject', '第二分句主语', 'Second-clause subject'], ['finished', 'predicate', '第二分句谓语', 'Second-clause predicate'], ['it.', 'object', '第二分句宾语', 'Second-clause object']])
    ], [
      ['hard 是“努力地/猛烈地”，hardly 是“几乎不”。', 'hard means “with effort/intensely”, while hardly means “almost not”.'],
      ['late 是“迟”，lately 是“最近”。', 'late means “after the expected time”, while lately means “recently”.'],
      ['therefore 表示结果，however 表示转折；它们是连接副词，不是并列连词。', 'therefore marks a result and however a contrast; they are linking adverbs, not coordinating conjunctions.'],
      ['连接副词连接两个独立分句时，前面通常用分号或句号，其后用逗号。', 'When a linking adverb connects independent clauses, it normally follows a semicolon or period and is followed by a comma.']
    ], [
      q('She studies ___.', 'hard', 'hardly', 'A', 'hard 表示“努力地”。', 'hard means “with effort”.'),
      q('Have you seen Tom ___?', 'lately', 'late', 'A', 'lately 表示“最近”。', 'lately means “recently”.'),
      q('The shop was closed; ___, we went home.', 'therefore', 'because', 'A', 'therefore 是表示结果的连接副词。', 'therefore is a linking adverb marking a result.'),
      q('Choose the correctly punctuated contrast.', 'It was raining; however, we left.', 'It was raining, however we left.', 'A', '两个独立分句之间用分号，however 后用逗号。', 'Use a semicolon between the independent clauses and a comma after however.')
    ])
  ], '副词', 'Adverbs', 6, [
    ['adverb-function', '作用、类别与位置', 'Jobs, types and position', '先确定副词修饰范围，再按意义类别判断常见位置。', 'Identify an adverb’s scope, then use its meaning class to judge its usual position.', ['adverb-jobs', 'adverb-types', 'adverb-position']],
    ['adverb-form-degree', '形副辨析与程度比较', 'Adjective–adverb form and degree', '辨清形容词与副词形式，掌握比较和程度结构。', 'Distinguish adjective and adverb forms, then master comparison and degree patterns.', ['adjective-or-adverb', 'adverb-comparison', 'degree-patterns']],
    ['adverb-scope-linking', '范围、语义与连接', 'Scope, meaning and linking', '进阶处理聚焦范围、易混副词和连接副词。', 'Handle focus scope, easily confused adverbs and linking adverbs.', ['adverb-scope', 'adverb-traps']]
  ]);
}

module.exports = BUILD_TARGET === 'adjective' ? { buildAdjectiveCourse }
  : BUILD_TARGET === 'adverb' ? { buildAdverbCourse }
    : { buildAdjectiveCourse, buildAdverbCourse };
