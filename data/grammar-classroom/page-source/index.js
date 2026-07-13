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

function adaptExampleNote(lessonId, index, note, english) {
  const translationNeeded = (lessonId === 'trigger' && index === 2)
    || (lessonId === 'subject' && index > 0)
    || (lessonId === 'boss' && (index === 0 || index === 2));
  if (translationNeeded) return {
    visible: true,
    mode: 'translation',
    title: english ? 'Word-order translation' : '语序翻译',
    body: note.translation,
    detail: note.tip
  };
  if (lessonId === 'spelling') return {
    visible: true,
    mode: 'spelling',
    title: english ? 'Spelling pattern' : '拼写观察',
    body: note.tip,
    detail: ''
  };
  if (lessonId === 'sound') return {
    visible: true,
    mode: 'sound',
    title: english ? 'Sound pattern' : '发音观察',
    body: note.tip,
    detail: ''
  };
  if (lessonId === 'does' || (lessonId === 'boss' && index === 1)) return {
    visible: true,
    mode: 'structure',
    title: english ? 'Structure change' : '结构变化',
    body: note.tip,
    detail: ''
  };
  return { visible: false, mode: '', title: '', body: '', detail: '' };
}

function buildAdditionalThirdPersonLessons(english) {
  const q = (question, a, b, answer, correct, wrong) => ({ question, options: [{ key: 'A', text: a }, { key: 'B', text: b }], answer, correct, wrong });
  const n = (mode, title, body, detail = '') => ({ visible: true, mode, title, body, detail });
  if (english) return {
    specialSubject: { id: 'special-subject', title: 'Special singular subjects', meta: 'Indefinite pronouns · -ing phrases · subject clauses', examples: ['Everyone likes music.', 'Swimming keeps us healthy.', 'What he says sounds true.'], analyses: [[{ text: 'Everyone', role: 'subject', label: 'Indefinite-pronoun subject' }, { text: 'likes', role: 'predicate', label: 'Predicate verb' }, { text: 'music', role: 'object', label: 'Object' }], [{ text: 'Swimming', role: 'subject', label: '-ing phrase as subject' }, { text: 'keeps', role: 'predicate', label: 'Predicate verb' }, { text: 'us', role: 'object', label: 'Object' }, { text: 'healthy', role: 'object', label: 'Object complement' }], [{ text: 'What he says', role: 'subject', label: 'Subject clause' }, { text: 'sounds', role: 'predicate', label: 'Linking verb' }, { text: 'true', role: 'object', label: 'Subject complement' }]], exampleNotes: [n('structure', 'Subject rule', 'everyone, someone, nobody and everything are grammatically singular.'), n('structure', 'Subject rule', 'An -ing phrase used as one activity takes a singular verb.'), n('structure', 'Subject rule', 'A whole subject clause is normally treated as one singular unit.')], rules: ['Indefinite pronouns ending in -one, -body or -thing normally take singular verbs.', '-ing phrases, infinitive phrases and subject clauses are normally treated as singular units.'], questions: [q('Everyone ___ ready.', 'is', 'are', 'A', 'Everyone is grammatically singular.', 'everyone takes a singular verb.'), q('Reading books ___ her relax.', 'help', 'helps', 'B', 'Reading books is one activity.', 'The -ing phrase is one subject.'), q('What he needs ___ more time.', 'is', 'are', 'A', 'The subject clause is treated as one unit.', 'A subject clause normally takes a singular verb.')] },
    specialVerb: { id: 'special-verb', title: 'Special verbs and modal verbs', meta: 'be → is · have → has · do → does · modal + base verb', examples: ['He is happy.', 'She has a new bike.', 'Tom does his homework.', 'Amy can swim.'], analyses: [[{ text: 'He', role: 'subject', label: 'Subject' }, { text: 'is', role: 'predicate', label: 'Linking verb' }, { text: 'happy', role: 'object', label: 'Subject complement' }], [{ text: 'She', role: 'subject', label: 'Subject' }, { text: 'has', role: 'predicate', label: 'Predicate verb' }, { text: 'a new bike', role: 'object', label: 'Object' }], [{ text: 'Tom', role: 'subject', label: 'Subject' }, { text: 'does', role: 'predicate', label: 'Predicate verb' }, { text: 'his homework', role: 'object', label: 'Object' }], [{ text: 'Amy', role: 'subject', label: 'Subject' }, { text: 'can', role: 'helper', label: 'Modal verb' }, { text: 'swim', role: 'predicate', label: 'Base verb' }]], exampleNotes: [n('structure', 'Special form', 'be changes to is with a third-person singular subject.'), n('structure', 'Special form', 'have changes to has.'), n('structure', 'Special form', 'do changes to does when it is the main verb.'), n('structure', 'Modal rule', 'After can, must or should, the next verb always stays in the base form.')], rules: ['Remember the special forms is, has and does.', 'Modal verbs do not add -s; the verb after a modal stays in its base form.'], questions: [q('My father ___ busy.', 'is', 'be', 'A', 'be changes to is.', 'Use is with my father.'), q('Lucy ___ a piano.', 'has', 'haves', 'A', 'have changes to has.', 'The correct special form is has.'), q('Jack ___ his homework after dinner.', 'does', 'dos', 'A', 'do changes to does.', 'The correct special form is does.'), q('She can ___ fast.', 'runs', 'run', 'B', 'Use the base verb after can.', 'Modal + base verb.')] },
    usage: { id: 'usage', title: 'Meaning and frequency', meta: 'Habits · Facts · Timetables · Frequency adverbs', examples: ['Lily often walks to school.', 'The sun rises in the east.', 'The train leaves at seven.'], analyses: [[{ text: 'Lily', role: 'subject', label: 'Subject' }, { text: 'often', role: 'adverbial', label: 'Frequency adverbial' }, { text: 'walks', role: 'predicate', label: 'Predicate verb' }, { text: 'to school', role: 'adverbial', label: 'Place adverbial' }], [{ text: 'The sun', role: 'subject', label: 'Subject' }, { text: 'rises', role: 'predicate', label: 'Predicate verb' }, { text: 'in the east', role: 'adverbial', label: 'Place adverbial' }], [{ text: 'The train', role: 'subject', label: 'Subject' }, { text: 'leaves', role: 'predicate', label: 'Predicate verb' }, { text: 'at seven', role: 'adverbial', label: 'Time adverbial' }]], exampleNotes: [n('structure', 'Habit and word order', 'often normally comes before a main verb; Chinese usually places “经常” there too.'), n('structure', 'General fact', 'Use the simple present for a fact that stays true.'), n('structure', 'Timetable', 'A fixed timetable can use the simple present for a future event.')], rules: ['The simple present describes habits, general facts and fixed timetables.', 'Frequency adverbs usually come before a main verb but after be.'], questions: [q('Ben usually ___ breakfast at home.', 'eats', 'eat', 'A', 'A habit with Ben uses eats.', 'Ben is third-person singular.'), q('Water ___ at 100°C.', 'boil', 'boils', 'B', 'A general fact with water uses boils.', 'Water is uncountable and singular.'), q('The film ___ at eight tonight.', 'starts', 'start', 'A', 'A fixed schedule with the film uses starts.', 'The film is singular.')] }
  };
  return {
    specialSubject: { id: 'special-subject', title: '特殊单数主语', meta: '不定代词 · 动名词短语 · 主语从句', examples: ['Everyone likes music.', 'Swimming keeps us healthy.', 'What he says sounds true.'], analyses: [[{ text: 'Everyone', role: 'subject', label: '不定代词作主语' }, { text: 'likes', role: 'predicate', label: '谓语动词' }, { text: 'music', role: 'object', label: '宾语' }], [{ text: 'Swimming', role: 'subject', label: '动名词短语作主语' }, { text: 'keeps', role: 'predicate', label: '谓语动词' }, { text: 'us', role: 'object', label: '宾语' }, { text: 'healthy', role: 'object', label: '宾语补足语' }], [{ text: 'What he says', role: 'subject', label: '主语从句' }, { text: 'sounds', role: 'predicate', label: '系动词' }, { text: 'true', role: 'object', label: '表语' }]], exampleNotes: [n('structure', '主语判断', 'everyone、someone、nobody、everything 等在语法上按单数处理。'), n('structure', '主语判断', '一个动名词短语表示一件事，谓语按单数处理。'), n('structure', '主语判断', '一个主语从句整体视为一个单数单位。')], rules: ['-one、-body、-thing 结尾的不定代词通常使用单数谓语。', '动名词短语、不定式短语和主语从句通常整体按单数处理。'], questions: [q('Everyone ___ ready.', 'is', 'are', 'A', 'Everyone 在语法上按单数处理。', 'everyone 使用单数谓语。'), q('Reading books ___ her relax.', 'help', 'helps', 'B', 'Reading books 表示一项活动。', '动名词短语整体作一个主语。'), q('What he needs ___ more time.', 'is', 'are', 'A', '主语从句整体按单数处理。', '主语从句通常使用单数谓语。')] },
    specialVerb: { id: 'special-verb', title: '特殊动词与情态例外', meta: 'be → is · have → has · do → does · 情态动词 + 原形', examples: ['He is happy.', 'She has a new bike.', 'Tom does his homework.', 'Amy can swim.'], analyses: [[{ text: 'He', role: 'subject', label: '主语' }, { text: 'is', role: 'predicate', label: '系动词' }, { text: 'happy', role: 'object', label: '表语' }], [{ text: 'She', role: 'subject', label: '主语' }, { text: 'has', role: 'predicate', label: '谓语动词' }, { text: 'a new bike', role: 'object', label: '宾语' }], [{ text: 'Tom', role: 'subject', label: '主语' }, { text: 'does', role: 'predicate', label: '谓语动词' }, { text: 'his homework', role: 'object', label: '宾语' }], [{ text: 'Amy', role: 'subject', label: '主语' }, { text: 'can', role: 'helper', label: '情态动词' }, { text: 'swim', role: 'predicate', label: '动词原形' }]], exampleNotes: [n('structure', '特殊变化', 'be 在第三人称单数主语后变为 is。'), n('structure', '特殊变化', 'have 变为 has。'), n('structure', '特殊变化', 'do 作实义动词时变为 does。'), n('structure', '情态规则', 'can、must、should 后面的动词始终使用原形。')], rules: ['记住 is、has、does 三个特殊形式。', '情态动词本身不加 s，情态动词后的实义动词使用原形。'], questions: [q('My father ___ busy.', 'is', 'be', 'A', 'be 应变为 is。', 'my father 后使用 is。'), q('Lucy ___ a piano.', 'has', 'haves', 'A', 'have 的特殊形式是 has。', '正确形式是 has。'), q('Jack ___ his homework after dinner.', 'does', 'dos', 'A', 'do 的特殊形式是 does。', '正确形式是 does。'), q('She can ___ fast.', 'runs', 'run', 'B', 'can 后面使用动词原形。', '情态动词后接原形。')] },
    usage: { id: 'usage', title: '语境与频率副词', meta: '习惯 · 客观事实 · 时间表 · 频率位置', examples: ['Lily often walks to school.', 'The sun rises in the east.', 'The train leaves at seven.'], analyses: [[{ text: 'Lily', role: 'subject', label: '主语' }, { text: 'often', role: 'adverbial', label: '频率状语' }, { text: 'walks', role: 'predicate', label: '谓语动词' }, { text: 'to school', role: 'adverbial', label: '地点状语' }], [{ text: 'The sun', role: 'subject', label: '主语' }, { text: 'rises', role: 'predicate', label: '谓语动词' }, { text: 'in the east', role: 'adverbial', label: '地点状语' }], [{ text: 'The train', role: 'subject', label: '主语' }, { text: 'leaves', role: 'predicate', label: '谓语动词' }, { text: 'at seven', role: 'adverbial', label: '时间状语' }]], exampleNotes: [n('structure', '习惯与位置', 'often 通常放在实义动词前；中文“经常”一般也放在动作前。'), n('structure', '客观事实', '长期成立的客观事实使用一般现在时。'), n('structure', '固定时间表', '固定班次或时间表可以用一般现在时表达将来。')], rules: ['一般现在时用于习惯、客观事实和固定时间表。', '频率副词通常放在实义动词前、be 动词后。'], questions: [q('Ben usually ___ breakfast at home.', 'eats', 'eat', 'A', 'Ben 的习惯动作使用 eats。', 'Ben 是第三人称单数。'), q('Water ___ at 100°C.', 'boil', 'boils', 'B', '客观事实中 water 按单数使用 boils。', 'water 是不可数名词。'), q('The film ___ at eight tonight.', 'starts', 'start', 'A', '固定时间表中 the film 使用 starts。', 'the film 是单数主语。')] }
  };
}

function auditThirdPersonCourse(course, english) {
  const q = (question, a, b, answer, correct, wrong) => ({ question, options: [{ key: 'A', text: a }, { key: 'B', text: b }], answer, correct, wrong });
  const hidden = () => ({ visible: false, mode: '', title: '', body: '', detail: '' });
  const structureNote = (body) => ({ visible: true, mode: 'structure', title: english ? 'Rule focus' : '规则观察', body, detail: '' });
  const spellingNote = (body) => ({ visible: true, mode: 'spelling', title: english ? 'Spelling pattern' : '拼写观察', body, detail: '' });
  const coverage = (...pairs) => pairs.map((pair) => ({ exampleIndexes: pair[0], questionIndexes: pair[1] }));
  const byId = course.reduce((map, lesson) => {
    map[lesson.id] = Object.assign({}, lesson, {
      examples: (lesson.examples || []).slice(),
      analyses: (lesson.analyses || []).slice(),
      exampleNotes: (lesson.exampleNotes || []).slice(),
      rules: (lesson.rules || []).slice(),
      questions: (lesson.questions || []).slice()
    });
    return map;
  }, {});

  const trigger = byId.trigger;
  trigger.examples.push('Water feels cold.');
  trigger.analyses.push([
    { text: 'Water', role: 'subject', label: english ? 'Uncountable-noun subject' : '不可数名词作主语' },
    { text: 'feels', role: 'predicate', label: english ? 'Linking verb' : '系动词' },
    { text: 'cold', role: 'object', label: english ? 'Subject complement' : '表语' }
  ]);
  trigger.exampleNotes.push(structureNote(english ? 'An uncountable noun is grammatically singular.' : '不可数名词在语法上按单数处理。'));
  trigger.rules = english
    ? ['Use third-person agreement in the simple present affirmative.', 'A singular third-person subject takes the changed verb form.', 'A plural subject takes the base verb form.', 'An uncountable-noun subject is grammatically singular.']
    : ['第三人称变化用于一般现在时的肯定句。', '第三人称单数主语使用变化后的动词形式。', '复数主语使用动词原形。', '不可数名词作主语时在语法上按单数处理。'];
  trigger.ruleCoverage = coverage([[0, 2, 3], [0, 2]], [[0, 2], [0]], [[1], [1]], [[3], [2]]);

  const subject = byId.subject;
  subject.examples.push('My parents drink tea every morning.');
  subject.analyses.push([
    { text: 'My parents', role: 'subject', label: english ? 'Plural head subject' : '复数中心主语' },
    { text: 'drink', role: 'predicate', label: english ? 'Predicate verb' : '谓语动词' },
    { text: 'tea', role: 'object', label: english ? 'Object' : '宾语' },
    { text: 'every morning', role: 'adverbial', label: english ? 'Time adverbial' : '时间状语' }
  ]);
  subject.exampleNotes.push(hidden());
  subject.rules = english
    ? ['A singular head noun takes a singular verb form.', 'A plural head noun takes the base verb form.', 'A postmodifier belongs inside the subject phrase; agreement follows the head noun.']
    : ['单数中心词使用第三人称单数谓语。', '复数中心词使用动词原形。', '后置定语属于主语短语内部；主谓一致由主语中心词决定。'];
  subject.ruleCoverage = coverage([[0], [0]], [[3], [1]], [[1, 2], [0, 2]]);

  const spelling = byId.spelling;
  const spellItems = english ? [
    ['Leo plays chess.', 'Most verbs add -s.'],
    ['The bus passes our school.', 'A verb ending in s adds -es.'],
    ['Dad fixes bikes.', 'A verb ending in x adds -es.'],
    ['Mia watches TV.', 'A verb ending in ch adds -es.'],
    ['Tom washes his hands.', 'A verb ending in sh adds -es.'],
    ['Amy goes home.', 'A verb ending in o normally adds -es.'],
    ['She studies English.', 'Consonant + y changes to -ies.'],
    ['He has a new bike.', 'have changes to has.']
  ] : [
    ['Leo plays chess.', '大多数动词直接加 -s。'],
    ['The bus passes our school.', '以 s 结尾的动词加 -es。'],
    ['Dad fixes bikes.', '以 x 结尾的动词加 -es。'],
    ['Mia watches TV.', '以 ch 结尾的动词加 -es。'],
    ['Tom washes his hands.', '以 sh 结尾的动词加 -es。'],
    ['Amy goes home.', '以 o 结尾的动词通常加 -es。'],
    ['She studies English.', '辅音字母+y 变 y 为 i，再加 -es。'],
    ['He has a new bike.', 'have 的第三人称单数形式是 has。']
  ];
  const spellParts = [
    [['Leo', 'subject'], ['plays', 'predicate'], ['chess.', 'object']],
    [['The bus', 'subject'], ['passes', 'predicate'], ['our school.', 'object']],
    [['Dad', 'subject'], ['fixes', 'predicate'], ['bikes.', 'object']],
    [['Mia', 'subject'], ['watches', 'predicate'], ['TV.', 'object']],
    [['Tom', 'subject'], ['washes', 'predicate'], ['his hands.', 'object']],
    [['Amy', 'subject'], ['goes', 'predicate'], ['home.', 'adverbial']],
    [['She', 'subject'], ['studies', 'predicate'], ['English.', 'object']],
    [['He', 'subject'], ['has', 'predicate'], ['a new bike.', 'object']]
  ];
  const roleLabel = (role) => english
    ? ({ subject: 'Subject', predicate: 'Predicate verb', object: 'Object', adverbial: 'Place adverbial' }[role])
    : ({ subject: '主语', predicate: '谓语动词', object: '宾语', adverbial: '地点状语' }[role]);
  spelling.examples = spellItems.map((item) => item[0]);
  spelling.analyses = spellParts.map((sentence) => sentence.map((part) => ({ text: part[0], role: part[1], label: roleLabel(part[1]) })));
  spelling.exampleNotes = spellItems.map((item) => spellingNote(item[1]));
  spelling.rules = spellItems.map((item) => item[1]);
  spelling.questions = english ? [
    q('Leo ___ chess after school.', 'plays', 'plaies', 'A', 'play normally adds -s.', 'Use plays.'),
    q('The bus ___ our school.', 'passes', 'passs', 'A', 'pass ends in s, so add -es.', 'Use passes.'),
    q('Dad ___ bikes.', 'fixes', 'fixs', 'A', 'fix ends in x, so add -es.', 'Use fixes.'),
    q('Mia ___ TV after dinner.', 'watches', 'watchs', 'A', 'watch ends in ch, so add -es.', 'Use watches.'),
    q('Tom ___ his hands.', 'washes', 'washs', 'A', 'wash ends in sh, so add -es.', 'Use washes.'),
    q('Amy ___ home at five.', 'goes', 'gos', 'A', 'go ends in o, so add -es.', 'Use goes.'),
    q('She ___ English every day.', 'studies', 'studys', 'A', 'Consonant + y changes to -ies.', 'Use studies.'),
    q('He ___ a new bike.', 'has', 'haves', 'A', 'have changes to has.', 'Use has.')
  ] : [
    q('Leo ___ chess after school.', 'plays', 'plaies', 'A', 'play 通常直接加 -s。', '应使用 plays。'),
    q('The bus ___ our school.', 'passes', 'passs', 'A', 'pass 以 s 结尾，加 -es。', '应使用 passes。'),
    q('Dad ___ bikes.', 'fixes', 'fixs', 'A', 'fix 以 x 结尾，加 -es。', '应使用 fixes。'),
    q('Mia ___ TV after dinner.', 'watches', 'watchs', 'A', 'watch 以 ch 结尾，加 -es。', '应使用 watches。'),
    q('Tom ___ his hands.', 'washes', 'washs', 'A', 'wash 以 sh 结尾，加 -es。', '应使用 washes。'),
    q('Amy ___ home at five.', 'goes', 'gos', 'A', 'go 以 o 结尾，加 -es。', '应使用 goes。'),
    q('She ___ English every day.', 'studies', 'studys', 'A', '辅音字母+y 变为 -ies。', '应使用 studies。'),
    q('He ___ a new bike.', 'has', 'haves', 'A', 'have 变为 has。', '应使用 has。')
  ];
  spelling.ruleCoverage = spelling.rules.map((rule, index) => ({ exampleIndexes: [index], questionIndexes: [index] }));

  const specialVerb = byId['special-verb'];
  specialVerb.rules = english
    ? ['be changes to is.', 'have changes to has.', 'do changes to does when it is the main verb.', 'A modal verb takes a base-form verb and does not add -s.']
    : ['be 变为 is。', 'have 变为 has。', 'do 作实义动词时变为 does。', '情态动词后接动词原形，情态动词本身不加 -s。'];
  specialVerb.ruleCoverage = coverage([[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]);

  const sound = byId.sound;
  sound.rules = english
    ? ['After a voiceless non-sibilant sound, the ending is /s/.', 'After a vowel or voiced non-sibilant sound, the ending is /z/.', 'After a sibilant sound, -es forms an extra /ɪz/ syllable.']
    : ['在非咝音的清辅音后，词尾读 /s/。', '在元音或非咝音的浊辅音后，词尾读 /z/。', '在咝音后，-es 构成额外的 /ɪz/ 音节。'];
  sound.ruleCoverage = coverage([[0], [1]], [[0, 2], [2]], [[1, 2], [0]]);

  const does = byId.does;
  does.rules = english
    ? ['In a negative, third-person agreement appears on does, not on the main verb.', 'In a question, third-person agreement appears on sentence-initial Does.', 'After does or does not, the main verb returns to its base form.']
    : ['否定句中由 does not 承担第三人称变化。', '疑问句中 Does 移到主语前并承担第三人称变化。', 'does 或 does not 后面的实义动词恢复原形。'];
  does.ruleCoverage = coverage([[1], [0]], [[2], [1]], [[1, 2], [0, 2]]);

  const usage = byId.usage;
  usage.examples.push('Mia is always kind.');
  usage.analyses.push([
    { text: 'Mia', role: 'subject', label: english ? 'Subject' : '主语' },
    { text: 'is', role: 'predicate', label: english ? 'Linking verb' : '系动词' },
    { text: 'always', role: 'adverbial', label: english ? 'Frequency adverbial after be' : '位于 be 后的频率状语' },
    { text: 'kind', role: 'object', label: english ? 'Subject complement' : '表语' }
  ]);
  usage.exampleNotes.push(structureNote(english ? 'A frequency adverb normally follows be.' : '频率副词通常放在 be 动词之后。'));
  usage.questions.push(q(english ? 'Choose the correct word order.' : '选择正确的语序。', 'Mia is always kind.', 'Mia always is kind.', 'A', english ? 'always normally follows is.' : 'always 通常放在 is 后。', english ? 'Place a frequency adverb after be.' : '频率副词放在 be 后。'));
  usage.rules = english
    ? ['Use the simple present for habits.', 'Use the simple present for general facts.', 'Use the simple present for fixed timetables.', 'A frequency adverb normally comes before a main verb.', 'A frequency adverb normally follows be.']
    : ['一般现在时用于习惯。', '一般现在时用于客观事实。', '一般现在时用于固定时间表。', '频率副词通常放在实义动词前。', '频率副词通常放在 be 动词后。'];
  usage.ruleCoverage = coverage([[0], [0]], [[1], [1]], [[2], [2]], [[0], [0]], [[3], [3]]);

  const specialSubject = byId['special-subject'];
  specialSubject.examples.push('To read every day improves your English.');
  specialSubject.analyses.push([
    { text: 'To read every day', role: 'subject', label: english ? 'Infinitive phrase as subject' : '不定式短语作主语' },
    { text: 'improves', role: 'predicate', label: english ? 'Predicate verb' : '谓语动词' },
    { text: 'your English', role: 'object', label: english ? 'Object' : '宾语' }
  ]);
  specialSubject.exampleNotes.push(structureNote(english ? 'An infinitive phrase naming one activity normally takes a singular verb.' : '一个不定式短语表示一件事时，谓语通常用单数。'));
  specialSubject.questions.push(q('To stay calm ___ practice.', 'require', 'requires', 'B', english ? 'The infinitive phrase is one subject.' : '不定式短语整体是一个主语。', english ? 'Use a singular verb.' : '应使用单数谓语。'));
  specialSubject.rules = english
    ? ['Indefinite pronouns ending in -one, -body or -thing normally take singular verbs.', 'An -ing phrase used as a subject is normally singular.', 'An infinitive phrase used as a subject is normally singular.', 'A subject clause is normally treated as one singular unit.']
    : ['-one、-body、-thing 结尾的不定代词通常使用单数谓语。', '动名词短语作主语时通常按单数处理。', '不定式短语作主语时通常按单数处理。', '主语从句通常整体视为一个单数单位。'];
  specialSubject.ruleCoverage = coverage([[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]);

  const boss = byId.boss;
  boss.rules = english
    ? ['After a modal verb, use the base form.', 'In coordinated clauses, judge the subject and verb structure in each clause separately.']
    : ['情态动词后使用动词原形。', '并列分句中要分别判断每个分句的主语和动词结构。'];
  boss.ruleCoverage = coverage([[1, 2], [0]], [[2], [0, 1, 2]]);
  return course.map((lesson) => byId[lesson.id]);
}

function buildClassroomText(includeVerbCourse = false) {
  const english = i18n.getLanguage() === 'en';
  const classroom = english ? {
    tab: 'Micro-Lessons', demo: 'DEMO · LESSON 1', title: 'Why does a verb sometimes end in s?',
    lead: 'Compare the two sentences and spot what changes.', coreLabel: 'The core idea',
    core: 'When one person does something, English often changes the verb with -s to show who is acting.',
    question: 'Your turn: Mary ___ music.', correct: 'Correct! Mary is one person, so we use likes.',
    wrong: 'Look again: Mary is one person, so the verb needs -s.', retry: 'Try again',
    directory: 'Grammar System', directoryCopy: 'Build grammar from words to sentences.', back: '‹ Grammar System', subBack: '‹ Parts of Speech', wordTitle: 'Word Grammar · 10 Parts of Speech', wordCopy: 'Learn what each word does, how it changes, and where it belongs.',
    verbMapTitle: 'Verb Map', verbMapCopy: 'A verb is the engine of a sentence. First identify its job, then learn its form.', verbLessonBack: '‹ Verb Map',
    verbGroups: [
      { id: 'job', title: '1 · By job in meaning', items: [
        { id: 'complete-verb', title: 'Complete verb course', copy: 'Meaning, objects, forms, tense, voice and non-finite verbs', ready: true },
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
    thirdPersonCourse: includeVerbCourse ? [
      { id: 'trigger', no: '01', title: 'When does the verb change?', meta: 'Present · Affirmative · One third person', examples: ['Tom likes football.', 'Tom and Jack like football.'], analyses: [[{ text: 'Tom', role: 'subject', label: 'Subject' }, { text: 'likes', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }], [{ text: 'Tom and Jack', role: 'subject', label: 'Subject (plural)' }, { text: 'like', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }]], rules: ['Use the change in the simple present affirmative.', 'The subject is he, she, it, one person or one thing.'], question: 'Mary ___ music every day.', options: [{ key: 'A', text: 'like' }, { key: 'B', text: 'likes' }], answer: 'B', correct: 'Mary is one third person, so likes is correct.', wrong: 'Check the subject: Mary means one third person.' },
      { id: 'subject', no: '02', title: 'Find the real subject', meta: 'Names · Singular nouns · Head words', examples: ['The boy plays football.', 'The boy with his friends plays football.'], analyses: [[{ text: 'The boy', role: 'subject', label: 'Subject' }, { text: 'plays', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }], [{ text: 'The boy', role: 'subject', label: 'Head subject' }, { text: 'with his friends', role: 'modifier', label: 'Extra detail' }, { text: 'plays', role: 'predicate', label: 'Verb' }, { text: 'football', role: 'object', label: 'Object' }]], rules: ['A name, one person, one thing and an uncountable noun are singular.', 'Extra words after the head subject do not change its number.'], question: 'The girl with two dogs ___ near here.', options: [{ key: 'A', text: 'live' }, { key: 'B', text: 'lives' }], answer: 'B', correct: 'The head subject is the girl, so use lives.', wrong: 'Ignore with two dogs. The head subject is the girl.' },
      { id: 'spelling', no: '03', title: 'Four spelling patterns', meta: '-s · -es · y→ies · special forms', examples: ['play → plays　watch → watches', 'study → studies　have → has'], rules: ['Most verbs add -s.', 'After s, x, ch, sh or o, add -es.', 'Consonant + y changes to -ies; have becomes has.'], question: 'She ___ English after dinner.', options: [{ key: 'A', text: 'studys' }, { key: 'B', text: 'studies' }], answer: 'B', correct: 'study has consonant + y, so it becomes studies.', wrong: 'Consonant + y changes to ies.' },
      { id: 'sound', no: '04', title: 'Hear the ending', meta: '/s/ · /z/ · /ɪz/', examples: ['likes /s/　plays /z/', 'watches /ɪz/'], rules: ['The spelling is visible; the ending sound depends on the final sound before it.', '/ɪz/ adds a clear extra syllable after sibilant sounds.'], question: 'Which ending does watches use?', options: [{ key: 'A', text: '/z/' }, { key: 'B', text: '/ɪz/' }], answer: 'B', correct: 'watches ends with /ɪz/.', wrong: 'After the /tʃ/ sound, -es is pronounced /ɪz/.' },
      { id: 'does', no: '05', title: 'Why does the s disappear?', meta: 'does · does not · base verb', examples: ["She likes music.", "She doesn't like music."], analyses: [[{ text: 'She', role: 'subject', label: 'Subject' }, { text: 'likes', role: 'predicate', label: 'Verb carries -s' }, { text: 'music', role: 'object', label: 'Object' }], [{ text: 'She', role: 'subject', label: 'Subject' }, { text: "doesn't", role: 'helper', label: 'Carries the change' }, { text: 'like', role: 'predicate', label: 'Base verb' }, { text: 'music', role: 'object', label: 'Object' }]], rules: ['In negatives and questions, does carries the third-person change.', 'The main verb therefore returns to its base form.'], question: 'He ___ coffee.', options: [{ key: 'A', text: "doesn't likes" }, { key: 'B', text: "doesn't like" }], answer: 'B', correct: 'does already carries the change, so use like.', wrong: 'Only one verb carries the third-person marker: does.' },
      { id: 'boss', no: '06', title: 'Context Boss', meta: 'Agreement · does · modal verbs', examples: ['My brother goes to school by bus.', 'He can play chess.'], analyses: [[{ text: 'My brother', role: 'subject', label: 'Subject' }, { text: 'goes', role: 'predicate', label: 'Verb' }, { text: 'to school by bus', role: 'modifier', label: 'Extra detail' }], [{ text: 'He', role: 'subject', label: 'Subject' }, { text: 'can', role: 'helper', label: 'Modal' }, { text: 'play', role: 'predicate', label: 'Base verb' }, { text: 'chess', role: 'object', label: 'Object' }]], rules: ['Modal verbs such as can, must and should never add -s.', 'Judge the subject and sentence structure before changing the main verb.'], question: 'My sister ___ early, but she can ___ late today.', options: [{ key: 'A', text: 'leaves · stay' }, { key: 'B', text: 'leave · stays' }], answer: 'A', correct: 'sister takes leaves; after can, stay stays in the base form.', wrong: 'The first verb follows sister; after can, stay stays in the base form.' }
    ] : [],
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
    tab: '语法微课堂', demo: 'DEMO · 第 1 课', title: '动词为什么有时多一个 s？',
    lead: '先观察两句话，看看谁发生了变化。', coreLabel: '语法本质',
    core: '一个人做事时，英语会让动词发生变化，用 -s 提醒我们“是谁在做”。',
    question: '轮到你：Mary ___ music.', correct: '答对了！Mary 是一个人，所以用 likes。',
    wrong: '再看一次：Mary 是一个人，动词需要加 -s。', retry: '再试一次',
    directory: '语法体系', directoryCopy: '从词到句子，一层一层搭建语法。', back: '‹ 语法体系', subBack: '‹ 十大词性', wordTitle: '词法 · 十大词性', wordCopy: '讲清每类词是做什么的、如何变化、放在句子的哪里。',
    verbMapTitle: '动词地图', verbMapCopy: '动词是句子的发动机。先看它负责什么，再看它怎样变化。', verbLessonBack: '‹ 动词地图',
    verbGroups: [
      { id: 'job', title: '一 · 按作用分类', items: [
        { id: 'complete-verb', title: '动词完整课程', copy: '作用、宾语、形式、时态、语态与非谓语', ready: true },
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
    thirdPersonCourse: includeVerbCourse ? [
      { id: 'trigger', no: '01', title: '什么时候动词要变化？', meta: '一般现在时 · 肯定句 · 第三人称单数', examples: ['Tom likes football.', 'Tom and Jack like football.'], analyses: [[{ text: 'Tom', role: 'subject', label: '主语' }, { text: 'likes', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }], [{ text: 'Tom and Jack', role: 'subject', label: '主语（复数）' }, { text: 'like', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }]], rules: ['只在一般现在时的肯定句中考虑这个变化。', '主语是 he、she、it、一个人或一个事物。'], question: 'Mary ___ music every day.', options: [{ key: 'A', text: 'like' }, { key: 'B', text: 'likes' }], answer: 'B', correct: 'Mary 是一个第三人称，所以用 likes。', wrong: '先看主语：Mary 表示一个第三人称。' },
      { id: 'subject', no: '02', title: '找到真正的主语', meta: '人名 · 单数名词 · 中心词', examples: ['The boy plays football.', 'The boy with his friends plays football.'], analyses: [[{ text: 'The boy', role: 'subject', label: '主语' }, { text: 'plays', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }], [{ text: 'The boy', role: 'subject', label: '中心主语' }, { text: 'with his friends', role: 'modifier', label: '补充成分' }, { text: 'plays', role: 'predicate', label: '谓语' }, { text: 'football', role: 'object', label: '宾语' }]], rules: ['人名、单个人或物、不可数名词都按单数处理。', '主语后面的补充成分不会改变中心词的单复数。'], question: 'The girl with two dogs ___ near here.', options: [{ key: 'A', text: 'live' }, { key: 'B', text: 'lives' }], answer: 'B', correct: '中心主语是 the girl，所以用 lives。', wrong: '先忽略 with two dogs，真正的主语是 the girl。' },
      { id: 'spelling', no: '03', title: '四类拼写变化', meta: '加 s · 加 es · y 变 ies · 特殊变化', examples: ['play → plays　watch → watches', 'study → studies　have → has'], rules: ['大多数动词直接加 -s。', '以 s、x、ch、sh、o 结尾通常加 -es。', '辅音字母加 y 变 -ies；have 变 has。'], question: 'She ___ English after dinner.', options: [{ key: 'A', text: 'studys' }, { key: 'B', text: 'studies' }], answer: 'B', correct: 'study 是辅音字母加 y，所以变成 studies。', wrong: '辅音字母加 y，要把 y 变成 ies。' },
      { id: 'sound', no: '04', title: '听懂词尾发音', meta: '/s/ · /z/ · /ɪz/', examples: ['likes /s/　plays /z/', 'watches /ɪz/'], rules: ['拼写看得见，发音取决于动词原形最后一个音。', '咝音后面的 -es 会多出一个清楚的 /ɪz/ 音节。'], question: 'watches 的词尾读什么？', options: [{ key: 'A', text: '/z/' }, { key: 'B', text: '/ɪz/' }], answer: 'B', correct: 'watches 的词尾读 /ɪz/。', wrong: '/tʃ/ 后面的 -es 读 /ɪz/。' },
      { id: 'does', no: '05', title: '为什么 s 又消失了？', meta: 'does · does not · 动词原形', examples: ['She likes music.', "She doesn't like music."], analyses: [[{ text: 'She', role: 'subject', label: '主语' }, { text: 'likes', role: 'predicate', label: '谓语（带 s）' }, { text: 'music', role: 'object', label: '宾语' }], [{ text: 'She', role: 'subject', label: '主语' }, { text: "doesn't", role: 'helper', label: '承担变化' }, { text: 'like', role: 'predicate', label: '动词原形' }, { text: 'music', role: 'object', label: '宾语' }]], rules: ['否定句和疑问句里，does 已经承担了第三人称变化。', '后面的实义动词因此恢复原形。'], question: 'He ___ coffee.', options: [{ key: 'A', text: "doesn't likes" }, { key: 'B', text: "doesn't like" }], answer: 'B', correct: 'does 已经发生变化，后面使用动词原形 like。', wrong: '第三人称标记只出现一次，已经放在 does 上了。' },
      { id: 'boss', no: '06', title: '情境 Boss 关', meta: '主谓一致 · does · 情态动词', examples: ['My brother goes to school by bus.', 'He can play chess.'], analyses: [[{ text: 'My brother', role: 'subject', label: '主语' }, { text: 'goes', role: 'predicate', label: '谓语' }, { text: 'to school by bus', role: 'modifier', label: '补充成分' }], [{ text: 'He', role: 'subject', label: '主语' }, { text: 'can', role: 'helper', label: '情态动词' }, { text: 'play', role: 'predicate', label: '动词原形' }, { text: 'chess', role: 'object', label: '宾语' }]], rules: ['can、must、should 等情态动词后永远用动词原形。', '先判断主语和句子结构，再决定动词是否变化。'], question: 'My sister ___ early, but she can ___ late today.', options: [{ key: 'A', text: 'leaves · stay' }, { key: 'B', text: 'leave · stays' }], answer: 'A', correct: 'sister 对应 leaves；can 后面使用原形 stay。', wrong: '第一个动词看 sister；can 后面使用原形 stay。' }
    ] : [],
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
  classroom.thirdPersonCourseGroups = [];
  if (includeVerbCourse) {
  const practice = buildThirdPersonPractice(english);
  const exampleNotes = buildExampleNotes(english);
  const originalCourse = classroom.thirdPersonCourse.map((lesson) => {
    const addition = practice[lesson.id] || {};
    const examples = (lesson.examples || []).concat(addition.extraExample ? [addition.extraExample] : []);
    const analyses = (lesson.analyses || []).concat(addition.extraAnalysis ? [addition.extraAnalysis] : [])
      .map((sentence) => sentence.reduce((parts, part) => parts.concat(standardizeSentencePart(part, english)), []));
    const rules = lesson.id === 'subject'
      ? (english
        ? ['A name, one person, one thing and an uncountable noun are singular.', 'A postmodifier belongs inside the subject phrase; agreement follows the head noun.']
        : ['人名、单个人或物、不可数名词都按单数处理。', '后置定语属于主语短语内部；主谓一致由主语中心词决定。'])
      : lesson.rules;
    const adaptiveNotes = (exampleNotes[lesson.id] || []).map((note, index) => adaptExampleNote(lesson.id, index, note, english));
    return Object.assign({}, lesson, addition, { examples, analyses, exampleNotes: adaptiveNotes, rules, questions: addition.questions || [] });
  });
  const originalById = originalCourse.reduce((map, lesson) => {
    map[lesson.id] = lesson;
    return map;
  }, {});
  const additional = buildAdditionalThirdPersonLessons(english);
  classroom.thirdPersonCourse = auditThirdPersonCourse([
    originalById.trigger,
    originalById.subject,
    originalById.spelling,
    additional.specialVerb,
    originalById.sound,
    originalById.does,
    additional.usage,
    additional.specialSubject,
    originalById.boss
  ], english).map((lesson, index) => Object.assign({}, lesson, {
    no: String(index + 1).padStart(2, '0'),
    level: index < 7 ? 'core' : 'advanced'
  }));
  classroom.thirdPersonTitle = english ? 'Third-person singular · 9 lessons' : '第三人称单数 · 9 节微课';
  classroom.thirdPersonCourseGroups = [
    { id: 'core', title: english ? 'Core · 7 essential lessons' : '核心必学 · 7 节', copy: english ? 'Complete these first.' : '规则和高频使用语境必须掌握。', lessons: classroom.thirdPersonCourse.filter((lesson) => lesson.level === 'core') },
    { id: 'advanced', title: english ? 'Advanced · 2 challenge lessons' : '进阶挑战 · 2 节', copy: english ? 'Special subjects and mixed use.' : '特殊主语与综合运用。', lessons: classroom.thirdPersonCourse.filter((lesson) => lesson.level === 'advanced') }
  ];
  }
  const wordCategory = classroom.categories.find((item) => item.id === 'word');
  const lessonCounts = { noun: 9, pronoun: 9, numeral: 7, article: 8, verb: 10, adjective: 9, adverb: 8, preposition: 8, conjunction: 8, interjection: 5 };
  if (wordCategory) wordCategory.children = wordCategory.children.map((item) => Object.assign({}, item, { ready: true, meta: item.id === 'verb' ? (english ? 'Complete course · topic lessons' : '完整体系 · 专题课') : (english ? `${lessonCounts[item.id]} lessons` : `${lessonCounts[item.id]} 节微课`) }));
  return classroom;
}

function getClassroomCourse(classroom, topicId) {
  if (topicId === 'noun' || topicId === 'pronoun') return { course: [], groups: [], title: '', copy: '' };
  const verbClassroom = classroom.thirdPersonCourse && classroom.thirdPersonCourse.length ? classroom : buildClassroomText(true);
  return { course: verbClassroom.thirdPersonCourse, groups: verbClassroom.thirdPersonCourseGroups, title: verbClassroom.thirdPersonTitle, copy: verbClassroom.thirdPersonCopy };
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
    texts: i18n.getPageTexts('grammar'),
    grammarRenderDebug: '',
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
    activeClassroomCourse: [],
    activeClassroomCourseGroups: [],
    activeClassroomCourseTitle: '',
    activeClassroomCourseCopy: '',
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
  onReady() {
    const query = this.createSelectorQuery();
    query.select('.grammar-page').boundingClientRect();
    query.select(this.data.theme === 'library' ? '.library-typecase' : '.grammar-hero').boundingClientRect();
    query.exec((results) => {
      const root = results && results[0];
      const content = results && results[1];
      if (!root || !content) {
        this.setData({ grammarRenderDebug: `DEBUG grammar-render root=${!!root} content=${!!content} theme=${this.data.theme} mode=${this.data.mode}` });
      }
    });
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
    const shouldLoadActiveCourse = this.data.selectedClassroomTopic && (this.data.selectedClassroomTopic !== 'verb' || !!this.data.selectedVerbLesson);
    const activeBundle = shouldLoadActiveCourse
      ? ((this.data.selectedClassroomTopic !== 'verb' || this.data.selectedVerbLesson === 'complete-verb')
        ? { course: this.data.activeClassroomCourse || [], groups: this.data.activeClassroomCourseGroups || [], title: this.data.activeClassroomCourseTitle || '', copy: this.data.activeClassroomCourseCopy || '' }
        : getClassroomCourse(classroom, this.data.selectedClassroomTopic))
      : { course: [], groups: [], title: '', copy: '' };
    const activeClassroomLessonIndex = this.data.selectedThirdPersonLesson
      ? activeBundle.course.findIndex((item) => item.id === this.data.selectedThirdPersonLesson)
      : -1;
    const activeClassroomLesson = activeClassroomLessonIndex >= 0 ? activeBundle.course[activeClassroomLessonIndex] : null;
    const activeClassroomExerciseIndex = activeClassroomLesson
      ? Math.min(this.data.activeClassroomExerciseIndex || 0, activeClassroomLesson.questions.length - 1)
      : 0;
    const activeClassroomQuestion = activeClassroomLesson ? activeClassroomLesson.questions[activeClassroomExerciseIndex] : null;
    this.setData({
      classroom,
      activeClassroomLesson,
      activeClassroomLessonIndex,
      isLastClassroomLesson: activeClassroomLessonIndex === activeBundle.course.length - 1,
      activeClassroomCourse: activeBundle.course,
      activeClassroomCourseGroups: activeBundle.groups,
      activeClassroomCourseTitle: activeBundle.title,
      activeClassroomCourseCopy: activeBundle.copy,
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
    wx.navigateTo({ url: '/grammar-package/pages/classroom/index' });
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
    let bundle = { course: [], groups: [], title: '', copy: '' };
    this.setData({ selectedClassroomTopic: topicId, selectedVerbLesson: topicId === 'verb' ? '' : 'word-course', selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomCourse: bundle.course, activeClassroomCourseGroups: bundle.groups, activeClassroomCourseTitle: bundle.title, activeClassroomCourseCopy: bundle.copy, classroomAnswer: '', classroomResult: '' });
    if (this.wordCourseLoadTimer) clearTimeout(this.wordCourseLoadTimer);
    if (topicId !== 'verb') {
      this.wordCourseLoadStartedAt = Date.now();
      this.wordCourseLoadTimer = setTimeout(() => {
        if (this.data.selectedClassroomTopic === topicId && !(this.data.activeClassroomCourse || []).length) {
          this.setData({ grammarRenderDebug: `DEBUG: pages/grammar.selectClassroomTopic -> grammar-course-loader.ready -> loaded event: missing; topic=${topicId}` });
        }
      }, 1500);
    }
  },
  onWordCourseLoaded(event) {
    const detail = event.detail || {};
    if (detail.topic !== this.data.selectedClassroomTopic || !detail.bundle) return;
    if (this.wordCourseLoadTimer) clearTimeout(this.wordCourseLoadTimer);
    const bundle = detail.bundle;
    this.setData({ activeClassroomCourse: bundle.course || [], activeClassroomCourseGroups: bundle.groups || [], activeClassroomCourseTitle: bundle.title || '', activeClassroomCourseCopy: bundle.copy || '', grammarRenderDebug: '' });
    if (this.grammarPerf && this.wordCourseLoadStartedAt) this.grammarPerf.mark('actionMs', { action: 'openCourseMap', topic: detail.topic, actionDurationMs: Date.now() - this.wordCourseLoadStartedAt });
    this.wordCourseLoadStartedAt = 0;
  },
  onWordCourseLoadError(event) {
    if (this.wordCourseLoadTimer) clearTimeout(this.wordCourseLoadTimer);
    const detail = event.detail || {};
    this.setData({ grammarRenderDebug: `DEBUG: components/grammar-word-loader.load -> wordCourses.${detail.topic || 'unknown'} -> course: ${detail.message || 'missing'}` });
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
    if (lessonId === 'complete-verb') {
      this.wordCourseLoadStartedAt = Date.now();
      this.setData({ selectedVerbLesson: lessonId, selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomCourse: [], activeClassroomCourseGroups: [], activeClassroomCourseTitle: '', activeClassroomCourseCopy: '', classroomAnswer: '', classroomResult: '' });
      if (this.wordCourseLoadTimer) clearTimeout(this.wordCourseLoadTimer);
      this.wordCourseLoadTimer = setTimeout(() => {
        if (this.data.selectedVerbLesson === lessonId && !(this.data.activeClassroomCourse || []).length) this.setData({ grammarRenderDebug: 'DEBUG: pages/grammar.selectVerbLesson -> grammar-vna-loader.ready -> loaded event: missing; topic=verb' });
      }, 1500);
      return;
    }
    if (lessonId !== 'third-person') return;
    const bundle = getClassroomCourse(this.data.classroom, 'verb');
    this.setData({ selectedVerbLesson: lessonId, selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomCourse: bundle.course, activeClassroomCourseGroups: bundle.groups, activeClassroomCourseTitle: bundle.title, activeClassroomCourseCopy: bundle.copy, activeClassroomLessonIndex: -1, isLastClassroomLesson: false, activeClassroomExerciseIndex: 0, activeClassroomQuestion: null, isLastClassroomExercise: false, classroomAnswer: '', classroomResult: '' });
  },
  backToVerbMap() {
    this.setData({ selectedVerbLesson: '', selectedThirdPersonLesson: '', activeClassroomLesson: null, activeClassroomLessonIndex: -1, isLastClassroomLesson: false, classroomAnswer: '', classroomResult: '' });
  },
  backToActiveCourseParent() {
    if (this.data.selectedClassroomTopic === 'verb') this.backToVerbMap();
    else this.backToClassroomTopics();
  },
  selectThirdPersonLesson(event) {
    const startedAt = Date.now();
    const lessonId = String(event.currentTarget.dataset.lessonId || '');
    const course = this.data.activeClassroomCourse || [];
    const lessonIndex = course.findIndex((item) => item.id === lessonId);
    const lesson = lessonIndex >= 0 ? course[lessonIndex] : null;
    if (!lesson) return;
    this.setData({ selectedThirdPersonLesson: lessonId, activeClassroomLesson: lesson, activeClassroomLessonIndex: lessonIndex, isLastClassroomLesson: lessonIndex === course.length - 1, activeClassroomExerciseIndex: 0, activeClassroomQuestion: lesson.questions[0], isLastClassroomExercise: lesson.questions.length === 1, classroomAnswer: '', classroomResult: '' });
    if (this.grammarPerf) this.grammarPerf.mark('actionMs', { action: 'openClassroomLesson', topic: this.data.selectedClassroomTopic, lessonId, actionDurationMs: Date.now() - startedAt });
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
    const course = this.data.activeClassroomCourse || [];
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
