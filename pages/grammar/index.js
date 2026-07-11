const page = require('../../utils/page');
const store = require('../../utils/store');
const completed = require('../../utils/completed');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('grammar', key, undefined, fallback);

const GRAMMAR_TOPIC_SNAPSHOT_KEY = 'grammarTopicSnapshotV1';
const GRAMMAR_HOME_SNAPSHOT_KEY = 'grammarHomeSnapshotV1';
const GRAMMAR_HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function buildThirdPersonPractice(english) {
  const q = (question, a, b, answer, correct, wrong) => ({ question, options: [{ key: 'A', text: a }, { key: 'B', text: b }], answer, correct, wrong });
  return english ? {
    trigger: { extraExample: 'The cat sleeps on the sofa.', extraAnalysis: [{ text: 'The cat', role: 'subject', label: 'Subject' }, { text: 'sleeps', role: 'predicate', label: 'Verb' }, { text: 'on the sofa', role: 'modifier', label: 'Extra detail' }], questions: [q('Mary ___ music every day.', 'like', 'likes', 'B', 'Mary is one third person, so use likes.', 'Mary is one third person.'), q('They ___ after school.', 'runs', 'run', 'B', 'They is plural, so use run.', 'They does not take -s.'), q('The water ___ cold.', 'feels', 'feel', 'A', 'Water is uncountable and treated as singular.', 'Water is treated as singular here.')] },
    subject: { extraExample: 'A box of old photos sits on the desk.', extraAnalysis: [{ text: 'A box', role: 'subject', label: 'Head subject' }, { text: 'of old photos', role: 'modifier', label: 'Extra detail' }, { text: 'sits', role: 'predicate', label: 'Verb' }, { text: 'on the desk', role: 'modifier', label: 'Extra detail' }], questions: [q('The girl with two dogs ___ near here.', 'live', 'lives', 'B', 'The head subject is the girl.', 'Ignore with two dogs.'), q('My parents ___ tea every morning.', 'drinks', 'drink', 'B', 'Parents is plural.', 'Parents means more than one person.'), q('A basket of apples ___ by the door.', 'stands', 'stand', 'A', 'The head subject is a basket.', 'The head word is basket, not apples.')] },
    spelling: { extraExample: 'go → goes　do → does', questions: [q('She ___ English after dinner.', 'studys', 'studies', 'B', 'Consonant + y changes to ies.', 'Change y to ies.'), q('Dad ___ TV at night.', 'watches', 'watchs', 'A', 'watch ends in ch, so add es.', 'After ch, add es.'), q('He ___ a new bike.', 'haves', 'has', 'B', 'have has the special form has.', 'have changes to has.')] },
    sound: { extraExample: 'washes /ɪz/　runs /z/', questions: [q('Which ending does watches use?', '/z/', '/ɪz/', 'B', 'watches ends with /ɪz/.', 'After /tʃ/, use /ɪz/.'), q('Which ending does likes use?', '/s/', '/z/', 'A', 'likes ends with /s/.', 'The ending is voiceless /s/.'), q('Which ending does plays use?', '/s/', '/z/', 'B', 'plays ends with /z/.', 'The ending is voiced /z/.')] },
    does: { extraExample: 'Does Tom play football?', extraAnalysis: [{ text: 'Does', role: 'helper', label: 'Carries the change' }, { text: 'Tom', role: 'subject', label: 'Subject' }, { text: 'play', role: 'predicate', label: 'Base verb' }, { text: 'football', role: 'object', label: 'Object' }], questions: [q('He ___ coffee.', "doesn't likes", "doesn't like", 'B', 'does already carries the change.', 'Use the base verb after does.'), q('___ she walk to school?', 'Does', 'Do', 'A', 'She uses does.', 'A third-person singular subject uses does.'), q('Does Tom ___ football?', 'plays', 'play', 'B', 'After does, use play.', 'The main verb returns to its base form.')] },
    boss: { extraExample: 'Lucy usually studies, but she can rest today.', extraAnalysis: [{ text: 'Lucy', role: 'subject', label: 'Subject' }, { text: 'usually', role: 'modifier', label: 'Adverb' }, { text: 'studies', role: 'predicate', label: 'Verb' }, { text: 'but she can rest today', role: 'modifier', label: 'Contrast' }], questions: [q('My sister ___ early, but she can ___ late today.', 'leaves · stay', 'leave · stays', 'A', 'sister takes leaves; can takes stay.', 'Check sister first, then can.'), q('The boy ___ not ___ milk.', 'does · like', 'do · likes', 'A', 'The boy uses does; like returns to base form.', 'The change belongs on does.'), q('Amy and Ben ___, but Amy ___ faster.', 'run · runs', 'runs · run', 'A', 'The plural subject uses run; Amy uses runs.', 'Compare a plural subject with one person.')] }
  } : {
    trigger: { extraExample: 'The cat sleeps on the sofa.', extraAnalysis: [{ text: 'The cat', role: 'subject', label: '主语' }, { text: 'sleeps', role: 'predicate', label: '谓语' }, { text: 'on the sofa', role: 'modifier', label: '补充成分' }], questions: [q('Mary ___ music every day.', 'like', 'likes', 'B', 'Mary 是一个第三人称，所以用 likes。', 'Mary 表示一个第三人称。'), q('They ___ after school.', 'runs', 'run', 'B', 'They 是复数，所以用 run。', 'They 后面的动词不加 s。'), q('The water ___ cold.', 'feels', 'feel', 'A', 'water 是不可数名词，按单数处理。', '这里的 water 按单数处理。')] },
    subject: { extraExample: 'A box of old photos sits on the desk.', extraAnalysis: [{ text: 'A box', role: 'subject', label: '中心主语' }, { text: 'of old photos', role: 'modifier', label: '补充成分' }, { text: 'sits', role: 'predicate', label: '谓语' }, { text: 'on the desk', role: 'modifier', label: '补充成分' }], questions: [q('The girl with two dogs ___ near here.', 'live', 'lives', 'B', '中心主语是 the girl。', '先忽略 with two dogs。'), q('My parents ___ tea every morning.', 'drinks', 'drink', 'B', 'parents 是复数。', 'parents 表示不止一个人。'), q('A basket of apples ___ by the door.', 'stands', 'stand', 'A', '中心主语是 a basket。', '中心词是 basket，不是 apples。')] },
    spelling: { extraExample: 'go → goes　do → does', questions: [q('She ___ English after dinner.', 'studys', 'studies', 'B', '辅音字母加 y，要变成 ies。', '把 y 变成 ies。'), q('Dad ___ TV at night.', 'watches', 'watchs', 'A', 'watch 以 ch 结尾，所以加 es。', 'ch 后面加 es。'), q('He ___ a new bike.', 'haves', 'has', 'B', 'have 的特殊形式是 has。', 'have 要变成 has。')] },
    sound: { extraExample: 'washes /ɪz/　runs /z/', questions: [q('watches 的词尾读什么？', '/z/', '/ɪz/', 'B', 'watches 的词尾读 /ɪz/。', '/tʃ/ 后面读 /ɪz/。'), q('likes 的词尾读什么？', '/s/', '/z/', 'A', 'likes 的词尾读 /s/。', '这里读清辅音 /s/。'), q('plays 的词尾读什么？', '/s/', '/z/', 'B', 'plays 的词尾读 /z/。', '这里读浊辅音 /z/。')] },
    does: { extraExample: 'Does Tom play football?', extraAnalysis: [{ text: 'Does', role: 'helper', label: '承担变化' }, { text: 'Tom', role: 'subject', label: '主语' }, { text: 'play', role: 'predicate', label: '动词原形' }, { text: 'football', role: 'object', label: '宾语' }], questions: [q('He ___ coffee.', "doesn't likes", "doesn't like", 'B', 'does 已经承担变化。', 'does 后面使用动词原形。'), q('___ she walk to school?', 'Does', 'Do', 'A', 'she 对应 does。', '第三人称单数使用 does。'), q('Does Tom ___ football?', 'plays', 'play', 'B', 'does 后面使用 play。', '实义动词恢复原形。')] },
    boss: { extraExample: 'Lucy usually studies, but she can rest today.', extraAnalysis: [{ text: 'Lucy', role: 'subject', label: '主语' }, { text: 'usually', role: 'modifier', label: '频率副词' }, { text: 'studies', role: 'predicate', label: '谓语' }, { text: 'but she can rest today', role: 'modifier', label: '转折信息' }], questions: [q('My sister ___ early, but she can ___ late today.', 'leaves · stay', 'leave · stays', 'A', 'sister 对应 leaves；can 后用 stay。', '先看 sister，再看 can。'), q('The boy ___ not ___ milk.', 'does · like', 'do · likes', 'A', 'the boy 用 does，后面用 like。', '变化放在 does 上。'), q('Amy and Ben ___, but Amy ___ faster.', 'run · runs', 'runs · run', 'A', '复数主语用 run，Amy 用 runs。', '比较复数主语和单个人。')] }
  };
}

function standardizeSentencePart(part, english) {
  const textValue = part.text;
  const one = (role, zh, en) => [Object.assign({}, part, { role, label: english ? en : zh })];
  if (textValue === 'with his friends' || textValue === 'of old photos') return one('attribute', '介词短语作后置定语', 'Prepositional phrase as postmodifier');
  if (textValue === 'on the sofa' || textValue === 'on the desk') return one('adverbial', '地点状语', 'Place adverbial');
  if (textValue === 'to school by bus') return one('adverbial', '地点、方式状语', 'Place and manner adverbial');
  if (textValue === 'usually') return one('adverbial', '频率状语', 'Frequency adverbial');
  if (textValue === 'but she can rest today') return [
    { text: 'but', role: 'conjunction', label: english ? 'Coordinating conjunction' : '并列连词' },
    { text: 'she', role: 'subject', label: english ? 'Subject' : '主语' },
    { text: 'can', role: 'helper', label: english ? 'Modal verb' : '情态动词' },
    { text: 'rest', role: 'predicate', label: english ? 'Predicate verb' : '谓语动词' },
    { text: 'today', role: 'adverbial', label: english ? 'Time adverbial' : '时间状语' }
  ];
  if (part.role === 'predicate') return one('predicate', '谓语动词', 'Predicate verb');
  return [part];
}

function buildExampleNotes(english) {
  const note = (translation, zhTip, enTip) => ({ translation, tip: english ? enTip : zhTip });
  return {
    trigger: [
      note('汤姆喜欢足球。', '英语和中文都按“谁—做什么—什么”的顺序理解。', 'Both languages follow subject–verb–object here.'),
      note('汤姆和杰克喜欢足球。', 'and 连接两个人，整个主语按复数翻译和理解。', 'and joins two people, so the whole subject is plural.'),
      note('那只猫睡在沙发上。', '地点状语 on the sofa 在英语中放句尾，中文通常译成“在沙发上”，放在动作前。', 'The English place adverbial comes last; Chinese usually moves 在沙发上 before the action.')
    ],
    subject: [
      note('那个男孩踢足球。', 'The boy 整体作主语，按正常主谓宾顺序翻译。', 'The boy is the complete subject, followed by the predicate and object.'),
      note('那个和朋友们在一起的男孩踢足球。', 'with his friends 是后置定语，英语放在 boy 后面；中文要往前翻成“和朋友们在一起的”。', 'The postmodifier follows boy in English but moves before 男孩 in Chinese.'),
      note('一盒旧照片放在桌子上。', 'of old photos 是后置定语，往前翻成“旧照片的”；on the desk 是地点状语，译为“在桌子上”。', 'Move the postmodifier before 盒 in Chinese; translate the final phrase as a place adverbial.')
    ],
    spelling: [
      note('play（玩）→ plays；watch（观看）→ watches', '先理解词义，再观察不同词尾对应的拼写变化。', 'Read the meaning first, then compare the spelling patterns.'),
      note('study（学习）→ studies；have（有）→ has', 'study 属于 y 变 ies；have 属于特殊变化。', 'study changes y to ies; have has an irregular third-person form.'),
      note('go（去）→ goes；do（做）→ does', 'go 和 do 以 o 结尾，第三人称形式加 es。', 'go and do take es in the third-person singular.')
    ],
    sound: [
      note('likes 读 /s/；plays 读 /z/', '中文翻译不受词尾发音影响；这里重点听清第三人称标记。', 'The Chinese meaning stays the same; focus on hearing the agreement ending.'),
      note('watches 读 /ɪz/', '/ɪz/ 会形成额外音节，翻译仍是“观看”。', '/ɪz/ adds a syllable; the lexical meaning remains “观看”.'),
      note('washes 读 /ɪz/；runs 读 /z/', '把词义和词尾声音分开记，避免只会拼写不会听辨。', 'Separate lexical meaning from the sound of the grammatical ending.')
    ],
    does: [
      note('她喜欢音乐。', 'likes 直接承担第三人称变化，按“她—喜欢—音乐”翻译。', 'likes carries agreement directly in the affirmative sentence.'),
      note('她不喜欢音乐。', "doesn't 翻成“不”，like 恢复原形；中文不用重复翻出第三人称标记。", 'does not carries negation and agreement; Chinese translates it simply as 不.'),
      note('汤姆踢足球吗？', 'Does 放句首表示疑问，中文通常把“吗”放句尾；play 仍翻成“踢”。', 'English moves Does to the front; Chinese expresses the question with 吗 at the end.')
    ],
    boss: [
      note('我哥哥乘公交车去学校。', 'to school 表方向，by bus 表方式；中文通常把方式“乘公交车”放在动作前。', 'Chinese usually moves the manner phrase before the verb.'),
      note('他会下国际象棋。', 'can 表能力，译为“会”；后面的 play 使用原形。', 'can expresses ability and is translated as 会.'),
      note('露西通常学习，但她今天可以休息。', 'usually 译为“通常”放谓语前；today 译为“今天”；but 连接两个并列分句。', 'Translate the frequency adverb before the verb, the time adverb naturally, and but as the clause linker.')
    ]
  };
}

function buildClassroomText() {
  const english = i18n.getLanguage() === 'en';
  const classroom = english ? {
    tab: 'Classroom', demo: 'DEMO · LESSON 1', title: 'Why does a verb sometimes end in s?',
    lead: 'Compare the two sentences and spot what changes.', coreLabel: 'The core idea',
    core: 'When one person does something, English often changes the verb with -s to show who is acting.',
    question: 'Your turn: Mary ___ music.', correct: 'Correct! Mary is one person, so we use likes.',
    wrong: 'Look again: Mary is one person, so the verb needs -s.', retry: 'Try again',
    directory: 'Grammar System', directoryCopy: 'Build grammar from words to sentences.', back: '‹ Grammar System', subBack: '‹ Parts of Speech', wordTitle: 'Word Grammar · 10 Parts of Speech', wordCopy: 'Learn what each word does, how it changes, and where it belongs.',
    verbMapTitle: 'Verb Map', verbMapCopy: 'A verb is the engine of a sentence. First identify its job, then learn its form.', verbLessonBack: '‹ Verb Map',
    verbGroups: [
      { id: 'job', title: '1 · By job in meaning', items: [
        { id: 'action', title: 'Main verbs', copy: 'Express an action or state: run, know, like', ready: false },
        { id: 'linking', title: 'Linking verbs', copy: 'Link the subject to a description: be, look, become', ready: false },
        { id: 'auxiliary', title: 'Auxiliary verbs', copy: 'Help build tense, questions or negatives: be, do, have', ready: false },
        { id: 'modal', title: 'Modal verbs', copy: 'Express ability, duty or possibility: can, must, may', ready: false }
      ] },
      { id: 'object', title: '2 · By object', items: [
        { id: 'transitive', title: 'Transitive verbs', copy: 'Take an object: read a book', ready: false },
        { id: 'intransitive', title: 'Intransitive verbs', copy: 'Do not take an object directly: arrive, sleep', ready: false }
      ] },
      { id: 'sentence-role', title: '3 · By sentence role', items: [
        { id: 'finite', title: 'Finite verbs', copy: 'Act as the predicate and change with subject or time', ready: false },
        { id: 'nonfinite', title: 'Non-finite verbs', copy: 'to do, doing and done do not act as the main predicate alone', ready: false }
      ] },
      { id: 'form', title: '4 · By form change', items: [
        { id: 'third-person', title: 'Third-person singular', copy: 'He runs. She likes music.', ready: true },
        { id: 'ing', title: '-ing form', copy: 'doing: running, writing', ready: false },
        { id: 'past', title: 'Past form', copy: 'did: played, went', ready: false },
        { id: 'participle', title: 'Past participle', copy: 'done: played, gone', ready: false }
      ] }
    ],
    thirdPersonTitle: 'Third-person singular · 6 lessons', thirdPersonCopy: 'Learn when it changes, how it changes, and when it returns to the base form.', courseBack: '‹ Verb Map', lessonBack: '‹ Course Map', coreLabel: 'The core idea', translationLabel: 'Chinese meaning', translationTipLabel: 'Translation order', returnCourse: 'Back', nextExercise: 'Next question', nextLesson: 'Continue', finishCourse: 'Finish', answerToContinue: 'Answer correctly to continue',
    thirdPersonCourse: [
      { id: 'trigger', no: '01', title: 'When does the verb change?', meta: 'Present · Affirmative · One third person', examples: ['Tom likes football.', 'Tom and Jack like football.'], analyses: [[{ text: 'Tom', role: 'subject', label: 'Subject' }, { text: 'likes', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }], [{ text: 'Tom and Jack', role: 'subject', label: 'Subject (plural)' }, { text: 'like', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }]], rules: ['Use the change in the simple present affirmative.', 'The subject is he, she, it, one person or one thing.'], question: 'Mary ___ music every day.', options: [{ key: 'A', text: 'like' }, { key: 'B', text: 'likes' }], answer: 'B', correct: 'Mary is one third person, so likes is correct.', wrong: 'Check the subject: Mary means one third person.' },
      { id: 'subject', no: '02', title: 'Find the real subject', meta: 'Names · Singular nouns · Head words', examples: ['The boy plays football.', 'The boy with his friends plays football.'], analyses: [[{ text: 'The boy', role: 'subject', label: 'Subject' }, { text: 'plays', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }], [{ text: 'The boy', role: 'subject', label: 'Head subject' }, { text: 'with his friends', role: 'modifier', label: 'Extra detail' }, { text: 'plays', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }]], rules: ['A name, one person, one thing and an uncountable noun are singular.', 'Extra words after the head subject do not change its number.'], question: 'The girl with two dogs ___ near here.', options: [{ key: 'A', text: 'live' }, { key: 'B', text: 'lives' }], answer: 'B', correct: 'The head subject is the girl, so use lives.', wrong: 'Ignore with two dogs. The head subject is the girl.' },
      { id: 'spelling', no: '03', title: 'Four spelling patterns', meta: '-s · -es · y→ies · special forms', examples: ['play → plays　watch → watches', 'study → studies　have → has'], rules: ['Most verbs add -s.', 'After s, x, ch, sh or o, add -es.', 'Consonant + y changes to -ies; have becomes has.'], question: 'She ___ English after dinner.', options: [{ key: 'A', text: 'studys' }, { key: 'B', text: 'studies' }], answer: 'B', correct: 'study has consonant + y, so it becomes studies.', wrong: 'Consonant + y changes to ies.' },
      { id: 'sound', no: '04', title: 'Hear the ending', meta: '/s/ · /z/ · /ɪz/', examples: ['likes /s/　plays /z/', 'watches /ɪz/'], rules: ['The spelling is visible; the ending sound depends on the final sound before it.', '/ɪz/ adds a clear extra syllable after sibilant sounds.'], question: 'Which ending does watches use?', options: [{ key: 'A', text: '/z/' }, { key: 'B', text: '/ɪz/' }], answer: 'B', correct: 'watches ends with /ɪz/.', wrong: 'After the /tʃ/ sound, -es is pronounced /ɪz/.' },
      { id: 'does', no: '05', title: 'Why does the s disappear?', meta: 'does · does not · base verb', examples: ["She likes music.", "She doesn't like music."], analyses: [[{ text: 'She', role: 'subject', label: 'Subject' }, { text: 'likes', role: 'predicate', label: 'Verb carries -s' }, { text: 'music', role: 'object', label: 'Object' }], [{ text: 'She', role: 'subject', label: 'Subject' }, { text: "doesn't", role: 'helper', label: 'Carries the change' }, { text: 'like', role: 'predicate', label: 'Base verb' }, { text: 'music', role: 'object', label: 'Object' }]], rules: ['In negatives and questions, does carries the third-person change.', 'The main verb therefore returns to its base form.'], question: 'He ___ coffee.', options: [{ key: 'A', text: "doesn't likes" }, { key: 'B', text: "doesn't like" }], answer: 'B', correct: 'does already carries the change, so use like.', wrong: 'Only one verb carries the third-person marker: does.' },
      { id: 'boss', no: '06', title: 'Context Boss', meta: 'Agreement · does · modal verbs', examples: ['My brother goes to school by bus.', 'He can play chess.'], analyses: [[{ text: 'My brother', role: 'subject', label: 'Subject' }, { text: 'goes', role: 'predicate', label: 'Verb' }, { text: 'to school by bus', role: 'modifier', label: 'Extra detail' }], [{ text: 'He', role: 'subject', label: 'Subject' }, { text: 'can', role: 'helper', label: 'Modal' }, { text: 'play', role: 'predicate', label: 'Base verb' }, { text: 'chess', role: 'object', label: 'Object' }]], rules: ['Modal verbs such as can, must and should never add -s.', 'Judge the subject and sentence structure before changing the main verb.'], question: 'My sister ___ early, but she can ___ late today.', options: [{ key: 'A', text: 'leaves · stay' }, { key: 'B', text: 'leave · stays' }], answer: 'A', correct: 'sister takes leaves; after can, stay stays in the base form.', wrong: 'The first verb follows sister; the verb after can uses its base form.' }
    ],
    categories: [
      { id: 'word', title: 'Word Grammar', meta: 'How words work and change', children: [
        { id: 'noun', title: 'Nouns', meta: 'Countability · Plurals · Possessives', ready: false },
        { id: 'pronoun', title: 'Pronouns', meta: 'Person · Case · Reference', ready: false },
        { id: 'numeral', title: 'Numerals', meta: 'Cardinals · Ordinals · Fractions', ready: false },
        { id: 'article', title: 'Articles', meta: 'a/an · the · Zero article', ready: false },
        { id: 'verb', title: 'Verbs', meta: '1 demo lesson', ready: true },
        { id: 'adjective', title: 'Adjectives', meta: 'Position · Comparison · Order', ready: false },
        { id: 'adverb', title: 'Adverbs', meta: 'Types · Position · Comparison', ready: false },
        { id: 'preposition', title: 'Prepositions', meta: 'Time · Place · Direction', ready: false },
        { id: 'conjunction', title: 'Conjunctions', meta: 'Coordination · Subordination', ready: false },
        { id: 'interjection', title: 'Interjections', meta: 'Emotion · Response · Punctuation', ready: false }
      ] },
      { id: 'sentence', title: 'Sentence Grammar', meta: 'How words form sentences', children: [
        { id: 'parts', title: 'Sentence Parts', meta: 'Coming soon', ready: false },
        { id: 'patterns', title: 'Sentence Patterns', meta: 'Coming soon', ready: false },
        { id: 'clauses', title: 'Clauses', meta: 'Coming soon', ready: false },
        { id: 'special', title: 'Special Structures', meta: 'Coming soon', ready: false }
      ] },
      { id: 'use', title: 'Grammar in Use', meta: 'Contrast, correction and challenge', children: [
        { id: 'contrast', title: 'Common Confusions', meta: 'Coming soon', ready: false },
        { id: 'correction', title: 'Error Detective', meta: 'Coming soon', ready: false },
        { id: 'challenge', title: 'Context Challenge', meta: 'Coming soon', ready: false }
      ] }
    ]
  } : {
    tab: '语法课堂', demo: 'DEMO · 第 1 课', title: '动词为什么有时多一个 s？',
    lead: '先观察两句话，看看谁发生了变化。', coreLabel: '语法本质',
    core: '一个人做事时，英语会让动词发生变化，用 -s 提醒我们“是谁在做”。',
    question: '轮到你：Mary ___ music.', correct: '答对了！Mary 是一个人，所以用 likes。',
    wrong: '再看一次：Mary 是一个人，动词需要加 -s。', retry: '再试一次',
    directory: '语法体系', directoryCopy: '从词到句子，一层一层搭建语法。', back: '‹ 语法体系', subBack: '‹ 十大词性', wordTitle: '词法 · 十大词性', wordCopy: '讲清每类词是做什么的、如何变化、放在句子的哪里。',
    verbMapTitle: '动词地图', verbMapCopy: '动词是句子的发动机。先看它负责什么，再看它怎样变化。', verbLessonBack: '‹ 动词地图',
    verbGroups: [
      { id: 'job', title: '一 · 按作用分类', items: [
        { id: 'action', title: '实义动词', copy: '自己表达动作或状态：run、know、like', ready: false },
        { id: 'linking', title: '系动词', copy: '连接主语和说明：be、look、become', ready: false },
        { id: 'auxiliary', title: '助动词', copy: '帮助构成时态、疑问和否定：be、do、have', ready: false },
        { id: 'modal', title: '情态动词', copy: '表达能力、义务或可能：can、must、may', ready: false }
      ] },
      { id: 'object', title: '二 · 按是否带宾语分类', items: [
        { id: 'transitive', title: '及物动词', copy: '后面可以直接接宾语：read a book', ready: false },
        { id: 'intransitive', title: '不及物动词', copy: '后面不能直接接宾语：arrive、sleep', ready: false }
      ] },
      { id: 'sentence-role', title: '三 · 按句中任务分类', items: [
        { id: 'finite', title: '谓语动词', copy: '担当句子谓语，会跟随主语和时间变化', ready: false },
        { id: 'nonfinite', title: '非谓语动词', copy: 'to do、doing、done，不能单独担当主要谓语', ready: false }
      ] },
      { id: 'form', title: '四 · 按形式变化学习', items: [
        { id: 'third-person', title: '第三人称单数', copy: 'He runs. She likes music.', ready: true },
        { id: 'ing', title: '现在分词', copy: 'doing：running、writing', ready: false },
        { id: 'past', title: '过去式', copy: 'did：played、went', ready: false },
        { id: 'participle', title: '过去分词', copy: 'done：played、gone', ready: false }
      ] }
    ],
    thirdPersonTitle: '第三人称单数 · 6 节微课', thirdPersonCopy: '从什么时候变化，到怎样变化，再到什么时候恢复原形。', courseBack: '‹ 动词地图', lessonBack: '‹ 课程地图', coreLabel: '语法本质', translationLabel: '中文翻译', translationTipLabel: '翻译顺序', returnCourse: '返回', nextExercise: '下一题', nextLesson: '继续下一小节', finishCourse: '完成并返回', answerToContinue: '答对后继续',
    thirdPersonCourse: [
      { id: 'trigger', no: '01', title: '什么时候动词要变化？', meta: '一般现在时 · 肯定句 · 第三人称单数', examples: ['Tom likes football.', 'Tom and Jack like football.'], analyses: [[{ text: 'Tom', role: 'subject', label: '主语' }, { text: 'likes', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }], [{ text: 'Tom and Jack', role: 'subject', label: '主语（复数）' }, { text: 'like', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }]], rules: ['只在一般现在时的肯定句中考虑这个变化。', '主语是 he、she、it、一个人或一个事物。'], question: 'Mary ___ music every day.', options: [{ key: 'A', text: 'like' }, { key: 'B', text: 'likes' }], answer: 'B', correct: 'Mary 是一个第三人称，所以用 likes。', wrong: '先看主语：Mary 表示一个第三人称。' },
      { id: 'subject', no: '02', title: '找到真正的主语', meta: '人名 · 单数名词 · 中心词', examples: ['The boy plays football.', 'The boy with his friends plays football.'], analyses: [[{ text: 'The boy', role: 'subject', label: '主语' }, { text: 'plays', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }], [{ text: 'The boy', role: 'subject', label: '中心主语' }, { text: 'with his friends', role: 'modifier', label: '补充成分' }, { text: 'plays', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }]], rules: ['人名、单个人或物、不可数名词都按单数处理。', '主语后面的补充成分不会改变中心词的单复数。'], question: 'The girl with two dogs ___ near here.', options: [{ key: 'A', text: 'live' }, { key: 'B', text: 'lives' }], answer: 'B', correct: '中心主语是 the girl，所以用 lives。', wrong: '先忽略 with two dogs，真正的主语是 the girl。' },
      { id: 'spelling', no: '03', title: '四类拼写变化', meta: '加 s · 加 es · y 变 ies · 特殊变化', examples: ['play → plays　watch → watches', 'study → studies　have → has'], rules: ['大多数动词直接加 -s。', '以 s、x、ch、sh、o 结尾通常加 -es。', '辅音字母加 y 变 -ies；have 变 has。'], question: 'She ___ English after dinner.', options: [{ key: 'A', text: 'studys' }, { key: 'B', text: 'studies' }], answer: 'B', correct: 'study 是辅音字母加 y，所以变成 studies。', wrong: '辅音字母加 y，要把 y 变成 ies。' },
      { id: 'sound', no: '04', title: '听懂词尾发音', meta: '/s/ · /z/ · /ɪz/', examples: ['likes /s/　plays /z/', 'watches /ɪz/'], rules: ['拼写看得见，发音取决于动词原形最后一个音。', '咝音后面的 -es 会多出一个清楚的 /ɪz/ 音节。'], question: 'watches 的词尾读什么？', options: [{ key: 'A', text: '/z/' }, { key: 'B', text: '/ɪz/' }], answer: 'B', correct: 'watches 的词尾读 /ɪz/。', wrong: '/tʃ/ 后面的 -es 读 /ɪz/。' },
      { id: 'does', no: '05', title: '为什么 s 又消失了？', meta: 'does · does not · 动词原形', examples: ['She likes music.', "She doesn't like music."], analyses: [[{ text: 'She', role: 'subject', label: '主语' }, { text: 'likes', role: 'predicate', label: '谓语（带 s）' }, { text: 'music', role: 'object', label: '宾语' }], [{ text: 'She', role: 'subject', label: '主语' }, { text: "doesn't", role: 'helper', label: '承担变化' }, { text: 'like', role: 'predicate', label: '动词原形' }, { text: 'music', role: 'object', label: '宾语' }]], rules: ['否定句和疑问句里，does 已经承担了第三人称变化。', '后面的实义动词因此恢复原形。'], question: 'He ___ coffee.', options: [{ key: 'A', text: "doesn't likes" }, { key: 'B', text: "doesn't like" }], answer: 'B', correct: 'does 已经发生变化，后面使用动词原形 like。', wrong: '第三人称标记只出现一次，已经放在 does 上了。' },
      { id: 'boss', no: '06', title: '情境 Boss 关', meta: '主谓一致 · does · 情态动词', examples: ['My brother goes to school by bus.', 'He can play chess.'], analyses: [[{ text: 'My brother', role: 'subject', label: '主语' }, { text: 'goes', role: 'predicate', label: '谓语' }, { text: 'to school by bus', role: 'modifier', label: '补充成分' }], [{ text: 'He', role: 'subject', label: '主语' }, { text: 'can', role: 'helper', label: '情态动词' }, { text: 'play', role: 'predicate', label: '动词原形' }, { text: 'chess', role: 'object', label: '宾语' }]], rules: ['can、must、should 等情态动词后永远用动词原形。', '先判断主语和句子结构，再决定动词是否变化。'], question: 'My sister ___ early, but she can ___ late today.', options: [{ key: 'A', text: 'leaves · stay' }, { key: 'B', text: 'leave · stays' }], answer: 'A', correct: 'sister 对应 leaves；can 后面使用原形 stay。', wrong: '第一个动词看 sister；can 后面的动词必须用原形。' }
    ],
    categories: [
      { id: 'word', title: '词法', meta: '词怎么用、怎么变化', children: [
        { id: 'noun', title: '名词', meta: '可数 · 单复数 · 所有格', ready: false },
        { id: 'pronoun', title: '代词', meta: '人称 · 格 · 指代', ready: false },
        { id: 'numeral', title: '数词', meta: '基数 · 序数 · 分数', ready: false },
        { id: 'article', title: '冠词', meta: 'a/an · the · 零冠词', ready: false },
        { id: 'verb', title: '动词', meta: '1 节示范课', ready: true },
        { id: 'adjective', title: '形容词', meta: '位置 · 比较级 · 顺序', ready: false },
        { id: 'adverb', title: '副词', meta: '种类 · 位置 · 比较级', ready: false },
        { id: 'preposition', title: '介词', meta: '时间 · 地点 · 方向', ready: false },
        { id: 'conjunction', title: '连词', meta: '并列 · 从属 · 逻辑', ready: false },
        { id: 'interjection', title: '感叹词', meta: '情绪 · 应答 · 标点', ready: false }
      ] },
      { id: 'sentence', title: '句法', meta: '词怎么组合成句子', children: [
        { id: 'parts', title: '句子成分', meta: '即将开放', ready: false },
        { id: 'patterns', title: '基本句型', meta: '即将开放', ready: false },
        { id: 'clauses', title: '从句', meta: '即将开放', ready: false },
        { id: 'special', title: '特殊句式', meta: '即将开放', ready: false }
      ] },
      { id: 'use', title: '综合运用', meta: '辨析、改错与情境挑战', children: [
        { id: 'contrast', title: '易错辨析', meta: '即将开放', ready: false },
        { id: 'correction', title: '错误侦探', meta: '即将开放', ready: false },
        { id: 'challenge', title: '情境挑战', meta: '即将开放', ready: false }
      ] }
    ]
  };
  const practice = buildThirdPersonPractice(english);
  const exampleNotes = buildExampleNotes(english);
  classroom.thirdPersonCourse = classroom.thirdPersonCourse.map((lesson) => {
    const addition = practice[lesson.id] || {};
    const examples = (lesson.examples || []).concat(addition.extraExample ? [addition.extraExample] : []);
    const analyses = (lesson.analyses || []).concat(addition.extraAnalysis ? [addition.extraAnalysis] : [])
      .map((sentence) => sentence.reduce((parts, part) => parts.concat(standardizeSentencePart(part, english)), []));
    const rules = lesson.id === 'subject'
      ? (english
        ? ['A name, one person, one thing and an uncountable noun are singular.', 'A postmodifier belongs inside the subject phrase; agreement follows the head noun.']
        : ['人名、单个人或物、不可数名词都按单数处理。', '后置定语属于主语短语内部；主谓一致由主语中心词决定。'])
      : lesson.rules;
    return Object.assign({}, lesson, addition, { examples, analyses, exampleNotes: exampleNotes[lesson.id] || [], rules, questions: addition.questions || [] });
  });
  return classroom;
}

function canUseDictionaryVoice(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 60 || /[.!?;:]/.test(value)) return false;
  const words = value.split(' ').filter(Boolean);
  return words.length >= 1
    && words.length <= 6
    && words.every((word) => /^[A-Za-z][A-Za-z'-]{0,30}$/.test(word));
}

function buildDictionaryVoiceUrl(text) {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

function buildTopics(grammarData) {
  const source = grammarData || {};
  const questionsByTopic = (source.byTopic || []).reduce((map, group) => {
    map[group.topicId] = group.questions || [];
    return map;
  }, {});
  return (source.topicTypes || []).map((topic) => ({
    topicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: (topic.children || []).map((child) => ({
      topicId: child.topicId,
      topic: child.topic,
      count: child.count,
      questions: questionsByTopic[child.topicId] || []
    })),
    questions: questionsByTopic[topic.topicId] || []
  }));
}

function buildWrongTopics(wrongData) {
  return ((wrongData && wrongData.topicTypes) || []).map((topic) => ({
    topicId: `wrong:${topic.topicId}`,
    sourceTopicId: topic.topicId,
    topic: topic.topic,
    count: topic.count,
    children: (topic.children || []).map((child) => ({
      topicId: `wrong:${child.topicId}`,
      sourceTopicId: child.topicId,
      topic: child.topic,
      count: child.count,
      questions: child.questions || []
    }))
  }));
}

function buildExams(em2Topics, em1Topics) {
  em2Topics = em2Topics || [];
  em1Topics = em1Topics || [];
  const em2Count = em2Topics.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const em1Count = em1Topics.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return [
    {
      examId: 'em2',
      exam: text('em2', '二模'),
      count: em2Count,
      topics: em2Topics
    },
    {
      examId: 'em1',
      exam: text('em1', '一模'),
      count: em1Count,
      topics: em1Topics
    }
  ];
}

function buildStages(em2Topics, em1Topics) {
  em2Topics = em2Topics || [];
  em1Topics = em1Topics || [];
  const juniorCount = em2Topics.concat(em1Topics).reduce((sum, item) => sum + Number(item.count || 0), 0);
  return [
    {
      stageId: 'junior',
      stage: text('junior', '初中'),
      count: juniorCount,
      exams: buildExams(em2Topics, em1Topics)
    },
    {
      stageId: 'senior',
      stage: text('senior', '高中'),
      count: 0,
      exams: []
    }
  ];
}

function buildQuestion(item, index) {
  const answer = String(item.answer || '').trim().toUpperCase();
  const optionsList = ['A', 'B', 'C', 'D'].filter((key) => item.options && item.options[key]).map((key) => ({
    key,
    text: item.options[key],
    tokens: tokenizeText(item.options[key]),
    selected: false,
    correct: false,
    wrong: false
  }));
  return Object.assign({}, item, {
    answer,
    sequenceNumber: Number(index || 0) + 1,
    promptTokens: tokenizeText(item.prompt || ''),
    selectedAnswer: '',
    isAnswered: false,
    isCorrect: false,
    explaining: false,
    explanationError: '',
    explanation: null,
    optionsList
  });
}

function tokenizeText(text) {
  return String(text || '').split(/([A-Za-z][A-Za-z'-]*)/g).filter((part) => part !== '').map((part, index) => ({
    id: index,
    text: part,
    word: /^[A-Za-z][A-Za-z'-]*$/.test(part) ? part : ''
  }));
}

function serializeAnsweredQuestions(questions) {
  return (questions || []).filter((question) => question.isAnswered).map((question) => ({
    _id: question._id || '',
    number: question.sequenceNumber || question.number || 0,
    selectedAnswer: question.selectedAnswer || '',
    answer: question.answer || '',
    isCorrect: !!question.isCorrect,
    explanation: question.explanation || null
  }));
}

function restoreAnsweredQuestions(questions, savedQuestions) {
  const savedById = (savedQuestions || []).reduce((map, question) => {
    const key = String(question && question._id || '');
    if (key) map[key] = question;
    return map;
  }, {});
  return (questions || []).map((question) => {
    const saved = savedById[String(question._id || '')];
    if (!saved) return question;
    const selectedAnswer = String(saved.selectedAnswer || '').toUpperCase();
    const answer = String(saved.answer || question.answer || '').toUpperCase();
    return Object.assign({}, question, {
      selectedAnswer,
      answer,
      isAnswered: true,
      isCorrect: saved.isCorrect === true || (!!selectedAnswer && selectedAnswer === answer),
      explanation: saved.explanation || null,
      optionsList: (question.optionsList || []).map((entry) => Object.assign({}, entry, {
        selected: entry.key === selectedAnswer,
        correct: entry.key === answer,
        wrong: entry.key === selectedAnswer && selectedAnswer !== answer
      }))
    });
  });
}

function recordGrammarCompleted(state, answeredCount) {
  const topic = state.selectedTopic || state.selectedCategory || state.selectedExam || {};
  const topicId = state.selectedTopicId || state.selectedCategoryId || state.selectedExamId || '';
  if (!topicId) return;
  const answeredQuestions = (state.selectedQuestions || []).filter((question) => question.isAnswered).map((question) => ({
    _id: question._id || '',
    number: question.sequenceNumber || question.number || 0,
    prompt: question.prompt || question.question || '',
    options: question.options || {},
    selectedAnswer: question.selectedAnswer || '',
    answer: question.answer || '',
    isCorrect: !!question.isCorrect,
    explanation: question.explanation || null
  }));
  const item = {
    id: `grammar:${state.selectedExamId || 'grammar'}:${topicId}`,
    type: 'grammar',
    targetId: topicId,
    title: `${text('navTitle', '语法')}: ${topic.topic || topic.exam || text('topics', '练习')}`,
    meta: state.selectedExam ? state.selectedExam.exam : text('navTitle', '语法'),
    topicId,
    progressText: `${answeredCount || 1}${text('questionUnit', ' 题')}`,
    latestAttempt: {
      answeredCount: answeredCount || answeredQuestions.length,
      totalCount: (state.selectedQuestions || []).length,
      questions: answeredQuestions
    }
  };
  completed.addCompletedItem(item);
  store.recordStudyCompletion(item);
}

Page({
  data: page.createCloudPageData({
    stages: [],
    topics: [],
    selectedStageId: '',
    selectedStage: null,
    exams: [],
    selectedExamId: '',
    selectedExam: null,
    selectedCategoryId: '',
    selectedCategory: null,
    selectedTopicId: '',
    selectedTopic: null,
    selectedQuestions: [],
    selectedTopicOffset: 0,
    wrongTopics: [],
    em2Topics: [],
    em1Topics: [],
    em1Loaded: false,
    em1Loading: false,
    mode: 'topics',
    classroomAnswer: '',
    classroomResult: '',
    selectedClassroomTopic: '',
    selectedClassroomCategory: '',
    selectedVerbLesson: '',
    selectedThirdPersonLesson: '',
    activeClassroomLesson: null,
    activeClassroomLessonIndex: -1,
    isLastClassroomLesson: false,
    activeClassroomExerciseIndex: 0,
    activeClassroomQuestion: null,
    isLastClassroomExercise: false,
    classroom: buildClassroomText(),
    expandedQuestionId: '',
    answeredCount: 0,
    dictionaryVisible: false,
    dictionaryLoading: false,
    dictionaryAudioLoading: false,
    dictionaryAdding: false,
    dictionaryWord: '',
    dictionaryEntry: null
  }),
  onUnload() {
    if (this.grammarProgressTimer) {
      clearTimeout(this.grammarProgressTimer);
      this.grammarProgressTimer = null;
    }
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    if (this.grammarAudioContext) {
      this.grammarAudioContext.destroy();
      this.grammarAudioContext = null;
    }
  },
  flushGrammarCompletion() {
    if (!this.data.selectedTopicId || !this.data.answeredCount) return;
    recordGrammarCompleted(this.data, this.data.answeredCount);
  },
  flushGrammarProgress() {
    if (this.grammarProgressTimer) {
      clearTimeout(this.grammarProgressTimer);
      this.grammarProgressTimer = null;
    }
    const progress = this.pendingGrammarProgress || null;
    if (!progress || !progress.topicId) return;
    this.pendingGrammarProgress = null;
    store.recordGrammarProgress(progress.topicId, progress.nextIndex, progress.answeredQuestions).catch(() => {});
  },
  queueGrammarProgress(topicId, nextIndex, answeredQuestions) {
    if (!topicId) return;
    this.pendingGrammarProgress = { topicId, nextIndex, answeredQuestions };
    if (this.grammarProgressTimer) clearTimeout(this.grammarProgressTimer);
    this.grammarProgressTimer = setTimeout(() => this.flushGrammarProgress(), 600);
  },
  queueCurrentGrammarProgress() {
    if (this.data.mode === 'wrong') return;
    const questions = this.data.selectedQuestions || [];
    let lastAnsweredIndex = -1;
    questions.forEach((question, index) => {
      if (question.isAnswered) lastAnsweredIndex = index;
    });
    if (lastAnsweredIndex < 0) return;
    const reference = questions[lastAnsweredIndex] || {};
    this.queueGrammarProgress(
      `${this.data.selectedExamId}:${reference.subtopicId || this.data.selectedTopicId}`,
      lastAnsweredIndex + 1,
      serializeAnsweredQuestions(questions)
    );
  },
  scrollToResumeQuestion(index) {
    if (!index || index < 0) return;
    setTimeout(() => {
      wx.pageScrollTo({
        selector: `#grammar-question-${index}`,
        offsetTop: -80,
        duration: 280
      });
    }, 120);
  },
  async onLoad() {
    this.grammarPerf = page.startPagePerf('grammar');
    const snapshot = snapshotStore.read(GRAMMAR_HOME_SNAPSHOT_KEY, {
      id: 'home',
      maxAgeMs: GRAMMAR_HOME_SNAPSHOT_MAX_AGE_MS
    });
    let em2Topics = [];
    let em1Topics = [];
    let readyReported = false;
    const reportReady = (source) => {
      if (readyReported || !this.grammarPerf) return;
      readyReported = true;
      this.grammarPerf.ready('pageReady', {
        source,
        cacheHit: source === 'snapshot' || source.endsWith('-cache'),
        stages: (this.data.stages || []).length
      });
    };
    const applyHomeTopics = (source) => {
      const stages = buildStages(em2Topics, em1Topics);
      if (stages.length) {
        snapshotStore.write(GRAMMAR_HOME_SNAPSHOT_KEY, 'home', {
          stages,
          em2Topics,
          em1Topics
        }, { source: 'grammar-home' });
      }
      const selectedStage = this.data.selectedStageId
        ? stages.find((item) => item.stageId === this.data.selectedStageId) || null
        : this.data.selectedStage;
      this.setData({
        stages,
        em2Topics,
        em1Topics,
        em1Loaded: !!em1Topics.length,
        em1Loading: false,
        selectedStage,
        exams: selectedStage ? (selectedStage.exams || []) : this.data.exams
      });
      reportReady(source);
    };
    if (snapshot && Array.isArray(snapshot.stages)) {
      em2Topics = snapshot.em2Topics || [];
      em1Topics = snapshot.em1Topics || [];
      this.setData({
        stages: snapshot.stages,
        em2Topics,
        em1Topics,
        em1Loaded: true,
        em1Loading: false
      });
      reportReady('snapshot');
    } else {
      await new Promise((resolve) => wx.nextTick(resolve));
      reportReady('fallback');
    }
    Promise.all([
      store.getGrammarHome({ examId: 'em2' }, (fresh) => {
        em2Topics = buildTopics(fresh);
        applyHomeTopics('em2-refresh');
        if (this.grammarPerf) {
          this.grammarPerf.mark('cloudRefresh', { examId: 'em2', topics: em2Topics.length });
        }
      }).then((data) => {
        em2Topics = buildTopics(data);
        applyHomeTopics(data && data.__cacheHit ? 'em2-cache' : 'em2-cloud');
      }).catch(() => {}),
      store.getGrammarHome({ examId: 'em1' }, (fresh) => {
        em1Topics = buildTopics(fresh);
        applyHomeTopics('em1-refresh');
        if (this.grammarPerf) {
          this.grammarPerf.mark('cloudRefresh', { examId: 'em1', topics: em1Topics.length });
        }
      }).then((data) => {
        em1Topics = buildTopics(data);
        applyHomeTopics(data && data.__cacheHit ? 'em1-cache' : 'em1-cloud');
      }).catch(() => {})
    ]).then(() => reportReady('empty')).catch(() => reportReady('empty'));
  },
  onShow() {
    page.syncTheme(this);
    const classroom = buildClassroomText();
    const activeClassroomLessonIndex = this.data.selectedThirdPersonLesson
      ? classroom.thirdPersonCourse.findIndex((item) => item.id === this.data.selectedThirdPersonLesson)
      : -1;
    const activeClassroomLesson = activeClassroomLessonIndex >= 0 ? classroom.thirdPersonCourse[activeClassroomLessonIndex] : null;
    const activeClassroomExerciseIndex = activeClassroomLesson
      ? Math.min(this.data.activeClassroomExerciseIndex || 0, activeClassroomLesson.questions.length - 1)
      : 0;
    const activeClassroomQuestion = activeClassroomLesson ? activeClassroomLesson.questions[activeClassroomExerciseIndex] : null;
    this.setData({
      classroom,
      activeClassroomLesson,
      activeClassroomLessonIndex,
      isLastClassroomLesson: activeClassroomLessonIndex === classroom.thirdPersonCourse.length - 1,
      activeClassroomExerciseIndex,
      activeClassroomQuestion,
      isLastClassroomExercise: !!activeClassroomLesson && activeClassroomExerciseIndex === activeClassroomLesson.questions.length - 1,
      stages: (this.data.stages || []).map((item) => Object.assign({}, item, {
        stage: item.stageId === 'senior' ? text('senior', '高中') : text('junior', '初中')
      })),
      stageCategories: (this.data.stageCategories || []).map((item) => Object.assign({}, item, {
        exam: item.examId === 'em1' ? text('em1', '一模') : text('em2', '二模')
      }))
    });
  },
  openPracticeHistory() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    wx.navigateTo({
      url: '/pages/practice-history/index?type=grammar'
    });
  },
  openGrammarClassroom() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      mode: 'classroom',
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      classroomAnswer: '',
      classroomResult: '',
      selectedClassroomTopic: '',
      selectedClassroomCategory: 'word',
      selectedVerbLesson: '',
      selectedThirdPersonLesson: '',
      activeClassroomLesson: null,
      activeClassroomLessonIndex: -1,
      isLastClassroomLesson: false,
      activeClassroomExerciseIndex: 0,
      activeClassroomQuestion: null,
      isLastClassroomExercise: false
    });
  },
  selectClassroomAnswer(event) {
    if (this.data.classroomAnswer) return;
    const answer = String(event.currentTarget.dataset.answer || '');
    this.setData({
      classroomAnswer: answer,
      classroomResult: answer === ((this.data.activeClassroomQuestion && this.data.activeClassroomQuestion.answer) || 'B') ? 'correct' : 'wrong'
    });
  },
  retryClassroomPractice() {
    this.setData({ classroomAnswer: '', classroomResult: '' });
  },
  selectClassroomTopic(event) {
    const topicId = String(event.currentTarget.dataset.topicId || '');
    const category = (this.data.classroom.categories || []).find((item) => item.id === this.data.selectedClassroomCategory);
    const topic = ((category && category.children) || []).find((item) => item.id === topicId);
    if (!topic || !topic.ready) return;
    this.setData({ selectedClassroomTopic: topicId, selectedVerbLesson: '', selectedThirdPersonLesson: '', activeClassroomLesson: null, classroomAnswer: '', classroomResult: '' });
  },
  selectClassroomCategory(event) {
    this.setData({ selectedClassroomCategory: String(event.currentTarget.dataset.categoryId || '') });
  },
  backToClassroomCategories() {
    this.setData({ selectedClassroomCategory: '' });
  },
  backToClassroomTopics() {
    this.setData({ selectedClassroomTopic: '', selectedVerbLesson: '', selectedThirdPersonLesson: '', activeClassroomLesson: null, classroomAnswer: '', classroomResult: '' });
  },
  selectVerbLesson(event) {
    const lessonId = String(event.currentTarget.dataset.lessonId || '');
    if (lessonId !== 'third-person') return;
    this.setData({ selectedVerbLesson: lessonId, selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomLessonIndex: -1, isLastClassroomLesson: false, activeClassroomExerciseIndex: 0, activeClassroomQuestion: null, isLastClassroomExercise: false, classroomAnswer: '', classroomResult: '' });
  },
  backToVerbMap() {
    this.setData({ selectedVerbLesson: '', selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomLessonIndex: -1, isLastClassroomLesson: false, classroomAnswer: '', classroomResult: '' });
  },
  selectThirdPersonLesson(event) {
    const lessonId = String(event.currentTarget.dataset.lessonId || '');
    const course = this.data.classroom.thirdPersonCourse || [];
    const lessonIndex = course.findIndex((item) => item.id === lessonId);
    const lesson = lessonIndex >= 0 ? course[lessonIndex] : null;
    if (!lesson) return;
    this.setData({ selectedThirdPersonLesson: lessonId, activeClassroomLesson: lesson, activeClassroomLessonIndex: lessonIndex, isLastClassroomLesson: lessonIndex === course.length - 1, activeClassroomExerciseIndex: 0, activeClassroomQuestion: lesson.questions[0], isLastClassroomExercise: lesson.questions.length === 1, classroomAnswer: '', classroomResult: '' });
  },
  backToThirdPersonCourse() {
    this.setData({ selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomLessonIndex: -1, isLastClassroomLesson: false, activeClassroomExerciseIndex: 0, activeClassroomQuestion: null, isLastClassroomExercise: false, classroomAnswer: '', classroomResult: '' });
  },
  continueThirdPersonLesson() {
    if (this.data.classroomResult !== 'correct') return;
    const questions = (this.data.activeClassroomLesson && this.data.activeClassroomLesson.questions) || [];
    if (!this.data.isLastClassroomExercise) {
      const exerciseIndex = this.data.activeClassroomExerciseIndex + 1;
      this.setData({ activeClassroomExerciseIndex: exerciseIndex, activeClassroomQuestion: questions[exerciseIndex], isLastClassroomExercise: exerciseIndex === questions.length - 1, classroomAnswer: '', classroomResult: '' });
      return;
    }
    if (this.data.isLastClassroomLesson) {
      this.backToThirdPersonCourse();
      return;
    }
    const course = this.data.classroom.thirdPersonCourse || [];
    const lessonIndex = this.data.activeClassroomLessonIndex + 1;
    const lesson = course[lessonIndex];
    if (!lesson) return;
    this.setData({ selectedThirdPersonLesson: lesson.id, activeClassroomLesson: lesson, activeClassroomLessonIndex: lessonIndex, isLastClassroomLesson: lessonIndex === course.length - 1, activeClassroomExerciseIndex: 0, activeClassroomQuestion: lesson.questions[0], isLastClassroomExercise: lesson.questions.length === 1, classroomAnswer: '', classroomResult: '' });
    wx.pageScrollTo({ selector: this.data.theme === 'library' ? '.library-classroom-card' : '.classroom-card', offsetTop: -24, duration: 260 });
  },
  async openWrongBook() {
    let wrongTopics = [];
    try {
      wrongTopics = buildWrongTopics(await store.getGrammarWrongBook());
    } catch (error) {
      wrongTopics = [];
    }
    this.setData({
      mode: 'wrong',
      stages: buildStages(wrongTopics, []),
      topics: [],
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async openTopicBook() {
    let em2Topics = this.data.em2Topics || [];
    if (!em2Topics.length) {
      const em2Data = await store.getGrammarHome({ examId: 'em2' });
      em2Topics = buildTopics(em2Data);
    }
    this.setData({
      mode: 'topics',
      stages: buildStages(em2Topics, this.data.em1Topics || []),
      em2Topics,
      topics: [],
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async ensureExamLoaded(examId) {
    if (examId !== 'em1' || this.data.em1Loaded || this.data.em1Loading) {
      return;
    }
    this.setData({ em1Loading: true });
    try {
      const em1Data = await store.getGrammarHome({ examId: 'em1' });
      const em1Topics = buildTopics(em1Data);
      const stages = buildStages(this.data.em2Topics || [], em1Topics);
      const selectedStage = stages.find((item) => item.stageId === this.data.selectedStageId) || null;
      this.setData({
        stages,
        em1Topics,
        em1Loaded: true,
        em1Loading: false,
        selectedStage,
        exams: selectedStage ? (selectedStage.exams || []) : []
      });
    } catch (error) {
      this.setData({ em1Loading: false });
      wx.showToast({ title: text('em1Failed', '一模语法加载失败'), icon: 'none' });
    }
  },
  selectStage(event) {
    const stageId = event.currentTarget.dataset.stageId;
    const selectedStage = (this.data.stages || []).find((item) => item.stageId === stageId) || null;
    this.setData({
      selectedStageId: stageId,
      selectedStage,
      exams: selectedStage ? (selectedStage.exams || []) : [],
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectExam(event) {
    const examId = event.currentTarget.dataset.examId;
    await this.ensureExamLoaded(examId);
    const selectedExam = (this.data.exams || []).find((item) => item.examId === examId) || null;
    this.setData({
      selectedExamId: examId,
      selectedExam,
      topics: selectedExam ? (selectedExam.topics || []) : [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectTopic(event) {
    const topicPerf = page.startPagePerf('grammar-topic');
    const topicId = event.currentTarget.dataset.topicId;
    const selectedTopic = ((this.data.selectedCategory && this.data.selectedCategory.children) || this.data.topics)
      .find((item) => item.topicId === topicId) || null;
    if (selectedTopic && selectedTopic.children && selectedTopic.children.length) {
      this.setData({
        selectedCategoryId: topicId,
        selectedCategory: selectedTopic,
        selectedTopicId: '',
        selectedTopic: null,
        selectedQuestions: [],
        selectedTopicOffset: 0,
        expandedQuestionId: '',
        answeredCount: 0
      });
      return;
    }
    let topicQuestions = selectedTopic ? (selectedTopic.questions || []) : [];
    const sourceTopicId = selectedTopic ? (selectedTopic.sourceTopicId || topicId) : topicId;
    const snapshotId = `${this.data.selectedExamId || 'grammar'}:${sourceTopicId}`;
    const topicSnapshot = !topicQuestions.length ? snapshotStore.read(GRAMMAR_TOPIC_SNAPSHOT_KEY, {
      id: snapshotId,
      maxAgeMs: 10 * 60 * 1000
    }) : null;
    if (!topicQuestions.length && topicSnapshot && Array.isArray(topicSnapshot.questions)) {
      topicQuestions = topicSnapshot.questions;
    }
    const shouldLoadRemote = selectedTopic && !topicQuestions.length && this.data.mode !== 'wrong';
    const shouldLoadProgress = selectedTopic && this.data.mode !== 'wrong';
    if (topicQuestions.length) {
      this.setData({
        selectedTopicId: topicId,
        selectedTopic,
        selectedQuestions: topicQuestions.map((item, index) => buildQuestion(item, index)),
        selectedTopicOffset: 0,
        expandedQuestionId: '',
        answeredCount: 0
      });
    }
    const [topicResult, progressResult] = await Promise.all([
      shouldLoadRemote
        ? store.getGrammarTopic(sourceTopicId, { examId: this.data.selectedExamId }).catch(() => null)
        : Promise.resolve(null),
      shouldLoadProgress
        ? store.getGrammarProgress(`${this.data.selectedExamId}:${sourceTopicId}`).catch(() => null)
        : Promise.resolve(null)
    ]);
    if (topicResult) {
      topicQuestions = topicResult.questions || [];
      snapshotStore.write(GRAMMAR_TOPIC_SNAPSHOT_KEY, snapshotId, {
        questions: topicQuestions
      }, { source: 'grammar-topic' });
    }
    let nextIndex = 0;
    if (progressResult) {
      nextIndex = Math.min(Math.max(Number(progressResult.nextIndex || 0), 0), topicQuestions.length);
    }
    const restoredQuestions = restoreAnsweredQuestions(
      topicQuestions.map((item, index) => buildQuestion(item, index)),
      (progressResult && progressResult.answeredQuestions) || []
    );
    const answeredCount = restoredQuestions.filter((question) => question.isAnswered).length;
    const firstUnansweredIndex = restoredQuestions.findIndex((question) => !question.isAnswered);
    const resumeCandidate = answeredCount > 0 && firstUnansweredIndex >= 0 ? firstUnansweredIndex : nextIndex;
    const resumeIndex = resumeCandidate > 0 && resumeCandidate < restoredQuestions.length ? resumeCandidate : 0;
    this.setData({
      selectedTopicId: topicId,
      selectedTopic,
      selectedQuestions: restoredQuestions,
      selectedTopicOffset: resumeIndex,
      expandedQuestionId: '',
      answeredCount
    }, () => {
      if (resumeIndex > 0) this.scrollToResumeQuestion(resumeIndex);
    });
    topicPerf.ready('topicReady', {
      remote: !!topicResult,
      progress: !!progressResult,
      questions: restoredQuestions.length,
      resumedAt: resumeIndex,
      restoredAnswers: answeredCount
    });
  },
  backToTopics() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToStageCategories() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedExamId: '',
      selectedExam: null,
      topics: [],
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToExamCategories() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedCategoryId: '',
      selectedCategory: null,
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  backToCategory() {
    this.flushGrammarCompletion();
    this.flushGrammarProgress();
    this.setData({
      selectedTopicId: '',
      selectedTopic: null,
      selectedQuestions: [],
      selectedTopicOffset: 0,
      expandedQuestionId: '',
      answeredCount: 0
    });
  },
  async selectOption(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const option = String(event.currentTarget.dataset.option || '').toUpperCase();
    const currentQuestion = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!currentQuestion || currentQuestion.isAnswered) {
      return;
    }
    const answeredCount = (this.data.selectedQuestions || []).filter((item) => item.isAnswered).length + 1;
    const nextQuestions = (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
      selectedAnswer: item._id === questionId ? option : item.selectedAnswer,
      isAnswered: item._id === questionId ? true : item.isAnswered,
      isCorrect: item._id === questionId && item.answer ? option === item.answer : item.isCorrect,
      explaining: item._id === questionId ? false : item.explaining,
      optionsList: (item.optionsList || []).map((entry) => Object.assign({}, entry, {
        selected: item._id === questionId ? entry.key === option : entry.selected,
        correct: item._id === questionId ? entry.key === item.answer : entry.correct,
        wrong: item._id === questionId ? entry.key === option && option !== item.answer : entry.wrong
      }))
    }));
    this.setData({
      expandedQuestionId: questionId,
      selectedQuestions: nextQuestions
    }, () => {
      this.setData({ answeredCount });
      recordGrammarCompleted(this.data, answeredCount);
      this.loadExplanationById(questionId);
    });
    try {
      const questionIndex = nextQuestions.findIndex((item) => item._id === questionId);
      const nextIndex = questionIndex + 1;
      if (this.data.mode !== 'wrong') {
        this.queueGrammarProgress(
          `${this.data.selectedExamId}:${currentQuestion.subtopicId || this.data.selectedTopicId}`,
          nextIndex,
          serializeAnsweredQuestions(nextQuestions)
        );
      }
      if (currentQuestion && currentQuestion.answer && option !== currentQuestion.answer) {
        store.recordGrammarWrong(currentQuestion, option);
      }
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanation: item._id === questionId ? {
            answer: currentQuestion.answer || '',
            topic: currentQuestion.topic || currentQuestion.subtopic || '语法',
            explanation: text('explainUnavailable', '讲解暂不可用，请稍后再试。'),
            elimination: ''
          } : item.explanation
        }))
      });
    }
  }
  ,
  loadExplanation(event) {
    const questionId = event && event.currentTarget ? event.currentTarget.dataset.questionId : '';
    return this.loadExplanationById(questionId);
  },
  async loadExplanationById(questionId, options = {}) {
    const force = !!options.force;
    const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
    if (!question || question.explaining || (!force && question.explanation)) {
      return;
    }
    this.setData({
      selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
        explaining: item._id === questionId ? true : item.explaining,
        explanationError: item._id === questionId ? '' : item.explanationError
      }))
    });
    try {
      const result = await store.explainGrammarQuestion(question, {
        force,
        personalOnly: !!options.personalOnly
      });
      const explanation = result && result.explanation;
      const source = String((result && result.source) || (explanation && explanation.source) || '');
      if (!explanation || !String(explanation.explanation || '').trim() || source === 'fallback' || (result && (result.error || result.cloudError))) {
        throw new Error((result && result.error) || (result && result.cloudError && result.cloudError.message) || 'grammar-explanation-unavailable');
      }
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanationError: item._id === questionId ? '' : item.explanationError,
          explanation: item._id === questionId ? explanation : item.explanation
        }))
      }, () => {
        recordGrammarCompleted(this.data, this.data.answeredCount);
        this.queueCurrentGrammarProgress();
      });
    } catch (error) {
      this.setData({
        selectedQuestions: (this.data.selectedQuestions || []).map((item) => Object.assign({}, item, {
          explaining: item._id === questionId ? false : item.explaining,
          explanationError: item._id === questionId ? text('explainUnavailable', '讲解暂不可用，请稍后再试。') : item.explanationError
        }))
      });
    }
  },
  regenerateExplanation(event) {
    const questionId = event && event.currentTarget ? event.currentTarget.dataset.questionId : '';
    return this.loadExplanationById(questionId, { force: true, personalOnly: true });
  },
  async openDictionaryWord(event) {
    const word = String(event.currentTarget.dataset.word || '').trim();
    const questionId = String(event.currentTarget.dataset.questionId || '');
    if (questionId) {
      const question = (this.data.selectedQuestions || []).find((item) => item._id === questionId);
      if (!question || !question.isAnswered) return;
    }
    if (!word) return;
    this.setData({
      dictionaryVisible: true,
      dictionaryLoading: true,
      dictionaryWord: word,
      dictionaryEntry: null
    });
    try {
      const entry = await store.lookupWord(word);
      this.setData({
        dictionaryLoading: false,
        dictionaryEntry: entry || { word, definitions: [] }
      });
    } catch (error) {
      this.setData({
        dictionaryLoading: false,
        dictionaryEntry: { word, definitions: [] }
      });
      wx.showToast({ title: text('dictionaryUnavailable', '词典暂不可用'), icon: 'none' });
    }
  },
  closeDictionary() {
    this.setData({ dictionaryVisible: false, dictionaryLoading: false, dictionaryAudioLoading: false });
  },
  async addDictionaryWordToLibrary() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    if (!word || this.data.dictionaryAdding) return;
    this.setData({ dictionaryAdding: true });
    try {
      await store.addDictionaryWord(Object.assign({}, entry, { word }));
      wx.showToast({ title: text('addSuccess', '已加入词库'), icon: 'none' });
    } catch (error) {
      wx.showToast({ title: text('addFailed', '加入失败'), icon: 'none' });
    } finally {
      this.setData({ dictionaryAdding: false });
    }
  },
  async playDictionaryWord() {
    const entry = this.data.dictionaryEntry || {};
    const word = entry.word || this.data.dictionaryWord || '';
    if (!word || this.data.dictionaryAudioLoading) return;
    const playUrl = (url) => {
      if (!this.grammarAudioContext) {
        this.grammarAudioContext = wx.createInnerAudioContext();
        this.grammarAudioContext.obeyMuteSwitch = false;
        this.grammarAudioContext.onEnded(() => {
          this.setData({ dictionaryAudioLoading: false });
        });
        this.grammarAudioContext.onError(() => {
          this.setData({ dictionaryAudioLoading: false });
          wx.showToast({ title: text('playbackFailed', '播放失败，稍后再试'), icon: 'none' });
        });
      }
      this.grammarAudioContext.stop();
      this.grammarAudioContext.src = url;
      this.setData({ dictionaryAudioLoading: true });
      this.grammarAudioContext.play();
    };
    try {
      let url = canUseDictionaryVoice(word) ? buildDictionaryVoiceUrl(word) : '';
      if (!url) {
        url = entry.audioUrl || '';
      }
      if (!url && entry.audioFileId) {
        url = await store.getTempFileURL(entry.audioFileId);
        if (url) {
          this.setData({ dictionaryEntry: Object.assign({}, entry, { audioUrl: url }) });
        }
      }
      if (!url) {
        url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
      }
      playUrl(url);
    } catch (error) {
      this.setData({ dictionaryAudioLoading: false });
      if (canUseDictionaryVoice(word)) {
        playUrl(buildDictionaryVoiceUrl(word));
      }
    }
  }
});
