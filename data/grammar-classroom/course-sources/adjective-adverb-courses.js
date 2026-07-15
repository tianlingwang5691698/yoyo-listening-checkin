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
  'adverb-essence': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adverb-jobs': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverbial-boundary': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adverb-types': [[[0], [3]], [[0], [0]], [[1], [4]], [[1], [1]], [[2], [2]], [[3], [5]]],
  'adverb-formation': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adverb-position': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]], [[2], [4]]],
  'multiple-adverb-order': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-or-adverb': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adverb-comparison': [[[0, 2], [1]], [[1], [0]], [[3], [2]]],
  'degree-patterns': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverb-scope': [[[0, 1], [0]], [[2], [1]], [[3], [3]], [[3], [2]]],
  'sentence-adverbs': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'interrogative-relative-adverbs': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'negative-limiting-adverbs': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adverb-traps': [[[0, 1], [0]], [[1], [1]]],
  'conjunctive-adverbs': [[[0], [0]], [[1], [1]], [[2], [2]]]
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

const EXTRA_ADJECTIVE_NARRATIONS = {
  'adjective-jobs': {
    id: 'adjective:adjective-jobs', version: 'v1',
    text: `同一个形容词，换个位置，可能就在句子里换一份工作。先看：<#0.4#>The kind teacher helped us。<#0.8#>真正发生的事是 teacher helped us。kind 紧贴在 teacher 前面，先告诉我们是哪一位老师。它在名词短语里修饰 teacher，这份工作叫定语。
再看：<#0.4#>The sky looks blue。<#0.8#>blue 仍然是在说明东西“什么样”，但它没有放在 sky 前。looks 在这里不是“看某物”，而是“看起来”，把 sky 和 blue 连起来。blue 说明天空呈现的状态，这份工作叫表语。<#0.7#>
The news made her happy 里，先抓主干“消息使她……”。her 是受到影响的人，happy 补出她后来变成什么状态。her 和 happy 形成“她处于开心状态”的关系，所以 happy 说明的是宾语 her，叫宾语补足语。它不是第二个宾语，也不修饰 made。
判断时先圈出形容词，再问“谁或什么是这样的”。如果它贴着名词，通常作定语；通过 be、look、feel 等系动词连回主语，作表语；跟在宾语后说明宾语的状态或结果，作宾语补足语。`,
    lengthText: '450 字 · 约 2 分钟'
  },
  'adjective-position': {
    id: 'adjective:adjective-position', version: 'v1',
    text: `你想买一条漂亮的裙子，英语说：<#0.4#>She bought a beautiful dress。<#0.8#>beautiful 只用一个词说明 dress，通常直接放在名词前。这是形容词作定语最常见的位置，先说特征，再说东西。
可是遇到 something，顺序要反过来。<#0.4#>I need something useful。<#0.8#>英语先说“某样东西”something，再补 useful，意思是“某个有用的东西”。something、anything、nothing 这类不定代词已经把“某物”打包成一个整体，修饰它们的形容词要放在后面。<#0.7#>
再看 The students present were quiet。present 放在 students 后，表示“在场的学生”。这个位置既说明它修饰 students，也帮助锁定“在场的”这一词义。
判断位置时，先找形容词说明的中心词。普通名词前的单个形容词，优先放前面；中心词是 something、anything、nothing 等不定代词，形容词放后面；遇到 present、concerned 等会随位置变义的词，要连同整个名词短语和语境一起判断。`,
    lengthText: '460 字 · 约 2 分钟'
  },
  'adjective-restrictions': {
    id: 'adjective:adjective-restrictions', version: 'v1',
    text: `不是每个形容词都能在名词前后自由搬家。比如会议超支了，你说：<#0.4#>The main reason is cost。<#0.8#>main 表示“最主要的”，自然地贴在 reason 前。它在这句里限定原因的地位，而不是通过系动词说明一种状态。像 main、mere、former 这类词，通常只在名词前作定语。
再看熟睡的孩子：<#0.4#>The child is asleep。<#0.8#>asleep 通过 is 说明孩子的状态，通常作表语。它和 afraid、alive 等词一样，常用于系动词后说明主语，而不自由搬到普通名词前。<#0.7#>
还有一种更容易误判。The students concerned looked concerned。第一个 concerned 放在 students 后，表示“有关的学生”；第二个放在 looked 后，表示这些学生“看起来担心”。拼写完全一样，位置和说明关系不同，意思就不同。
遇到这类词，别先套“形容词都放名词前”。先查它在句中说明哪个对象；再看它是在名词前限定身份，还是在系动词后说明状态；最后留意位置是否会改变词义。只作定语或只作表语的限制，需要连同具体词义一起记。`,
    lengthText: '455 字 · 约 2 分钟'
  },
  'adjective-complements': {
    id: 'adjective:adjective-complements', version: 'v1',
    text: `有人说 She is afraid，你知道她害怕，却还会问“怕什么”。补上 of dogs，意思才具体：<#0.4#>She is afraid of dogs。<#0.8#>afraid 先说明她的状态，of dogs 再交代这个害怕指向的对象。这里 of dogs 是跟在形容词后的介词短语。
再看出发前的场景：<#0.4#>We are ready to leave。<#0.8#>ready 表示“准备好了”，to leave 补出准备做的动作。它不是另一个谓语，而是不定式补充形容词的内容。<#0.7#>
I am sure that he is right 中，sure 表示确信，that he is right 把“确信的具体内容”完整说出来，所以用从句。glad、aware 等词也能按意义接相应内容。
这些后接部分统称形容词的补足成分，但形式不是随便选的。判断时先说出形容词留下的问题：是“对谁、关于什么”，常看介词短语；是“准备或可能做什么”，常看不定式；是一个完整判断或事实，就看从句。最后还要核对形容词通常选择哪个介词，不能只按中文逐字配。`,
    lengthText: '410 字 · 约 2 分钟'
  },
  'adjective-degree': {
    id: 'adjective:adjective-degree', version: 'v1',
    text: `冬天走进一个房间，冷可以有一点冷、很冷等不同强弱。页面先说：<#0.4#>The room is very cold。<#0.8#>very 把 cold 的程度明显提高。cold 能放在一条连续刻度上，这种性质叫可分级。
再看答案：<#0.4#>The answer is absolutely correct。<#0.8#>correct 在这里把答案放到“正确”这个明确状态，absolutely 强调完全达到，而不是只把普通程度往上推。表示终点或绝对状态的形容词，常和 absolutely、completely 这一类强调词配合。<#0.7#>
第三句是 This task is slightly difficult。difficult 也有程度差别，slightly 把它压到较低位置，意思是任务只有一点难。它和第一句正好展示同一条程度刻度可以向高处或低处调整。
判断时先问形容词表达的性质能不能自然分成一点、很、更加。能，就按可分级处理，再根据页面语境选择 very 或 slightly 等程度词；如果词义本身像到达一个完整终点，就优先考虑 absolutely、completely 一类表达。最后检查程度词和形容词想表达的刻度是否匹配。`,
    lengthText: '462 字 · 约 2 分钟'
  },
  'adjective-comparative-form': {
    id: 'adjective:adjective-comparative-form', version: 'v1',
    text: `两条路摆在眼前，要说这条更长，long 要先变形。<#0.4#>This road is longer than that one。<#0.8#>long 是普通短词，直接加 er 得到 longer；需要最高级时，同类短词通常加 est。
第二句 Amy is happier today 展示词尾 y 的变化。happy 是辅音字母加 y 结尾，要把 y 变成 i，再加 er。<#0.7#>
第三句 This is the most useful tool here 中，useful 较长，不硬接词尾，而是在前面用 most 构成最高级。<#0.7#>第四句 My bag is bigger than yours 里，big 是重读的“辅音、元音、辅音”短词，要先双写末字母 g，再加 er。
最后看 Today is better than yesterday。better 不能从 good 按普通拼写推出，它属于要单独记住的不规则比较级。
操作时按页面顺序核对五类：普通短词直接加 er 或 est；辅音加 y 先变 i；较长词用 more 或 most；重读短词必要时双写末字母；最后单独检查 good、bad、many、much 等不规则形式。`,
    lengthText: '434 字 · 约 2 分钟'
  },
  'adjective-comparison': {
    id: 'adjective:adjective-comparison', version: 'v1',
    text: `体育课上，Leo 和 Max 站在一起量身高。Leo 更高，可以说：<#0.4#>Leo is taller than Max。<#0.8#>taller 表示程度更高，than 把 Max 放成比较基准。两边比的是同一种性质，也就是身高。
如果两个箱子一样重，就说：<#0.4#>This box is as heavy as that one。<#0.8#>两个 as 像一副括号，把原级 heavy 放在中间，表示程度相同。若蓝色路线危险程度较低，则说 The blue route is less dangerous than the red route，用 less 加原级表示“没那么危险”。<#0.7#>
比较还要防止对象错位。My bag is heavier than yours 中，yours 代表对方的包，让 bag 始终和 bag 比。替代词虽然省掉重复名词，实际指向仍必须与前一方同类。
判断时先圈出比较性质；再找比较的两方，确认它们是同类对象。程度更高用比较级加 than，相同用 as 加原级加 as，程度更低用 less 加原级加 than。最后检查代词或替代词实际代表什么，不能只看句型外壳。`,
    lengthText: '423 字 · 约 2 分钟'
  },
  'comparative-modifiers': {
    id: 'adjective:comparative-modifiers', version: 'v1',
    text: `只说“这个房间更大”，听者还不知道大多少。差很多时可以说：<#0.4#>This room is much larger than mine。<#0.8#>much 放在 larger 前，把差距拉大。far、a lot 也能做类似工作，但不能说 very larger，因为 very 通常修饰原级，不直接修饰比较级。
差一点点就说：<#0.4#>This route is a little shorter。<#0.8#>a little、a bit、slightly 都能把差距缩小。若手里有准确数据，Tom is five centimetres taller than Ben 直接把 five centimetres 放在 taller 前，告诉我们具体高五厘米。<#0.7#>
比较也能表现持续变化。The days are getting longer and longer 不是比较两个固定对象，而是说白天随着时间越来越长。两个 longer 通过 and 连起来，把变化过程连续推进。
操作时先确认已经有比较级；再问差距是大、小、精确数值，还是持续变化。大用 much、far、a lot，小用 a little、a bit、slightly，精确差值直接放比较级前，渐变用比较级加 and 加比较级。最后删掉误放在比较级前的 very。`,
    lengthText: '487 字 · 约 2 分钟'
  },
  'adjective-superlative': {
    id: 'adjective:adjective-superlative', version: 'v1',
    text: `两个人比高，只能说谁更高；全班一起比，才会出现“最高”。比如：<#0.4#>Mia is the tallest in her class。<#0.8#>tallest 把 Mia 放到全班身高的顶端，in her class 画出比较范围。三者或以上选程度最高的一项，通常用形容词最高级。
再看：<#0.4#>This is the most exciting game of the three。<#0.8#>exciting 较长，用 most exciting；of the three 明确是三场比赛中比较。常见区别是，in 后多接地点或群体，of 后多接明确的一组对象。最高级前通常有 the，因为说的是这个范围内可以认出的最高项。<#0.7#>
The Yellow River is the second longest river in China 不是“最长”，而是“第二长”。序数词 second 放在最高级前，给排名加位置。
判断时先数比较对象：只有两者不用最高级，三者以上才进入最高级；再写 the 加 est 形式或 most 加原级；接着用 in 或 of 交代范围；若表达第几高、第几大，就把序数词放在最高级前。`,
    lengthText: '433 字 · 约 2 分钟'
  },
  'comparison-boundaries': {
    id: 'adjective:comparison-boundaries', version: 'v2',
    text: `桌上只有两支笔，想选较长的那支，不能因为“选最高”就用最高级。英语说：<#0.4#>Leo is the taller of the two。<#0.8#>范围只有两个，所以用比较级 taller；the 表示两者中可以确定的那一个。
范围里还要排除自己。<#0.4#>Shanghai is larger than any other city in China。<#0.8#>Shanghai 本身也是中国城市，other 把它从比较对象中拿出去。若少了 other，就像在说上海比包括上海自己的每座城市都大，逻辑冲突。<#0.7#>
This rope is twice as long as that one 用 twice 放在 as long as 前，表示长度是两倍。最高级也能换一种说法：No other runner is faster than Mia，意思是没有别的选手比 Mia 更快，也就是 Mia 最快。
判断特殊比较时先画范围：两个对象用带定冠词的比较级，并明确两者范围；同一群体内一对多比较，要用 other 排除自身；说倍数时把倍数放在同级结构前；看到 no other 加比较级，尝试还原成最高级，核对意思是否相同。`,
    lengthText: '439 字 · 约 2 分钟'
  },
  'participle-adjectives': {
    id: 'adjective:participle-adjectives', version: 'v1',
    text: `一节课很有趣，学生也觉得有趣，中文都能说“有趣”，英语却要分两边。<#0.4#>The lesson is interesting。<#0.8#>lesson 是带来感受的事物，interesting 表示它“让人产生兴趣”。
再看学生：<#0.4#>The students are interested in the lesson。<#0.8#>students 是感受到兴趣的人，所以用 interested，表示“感到有兴趣”。常见的 ing 形容词写引发感受的一方，ed 形容词写接收到感受的一方。<#0.7#>
但不能背成“物用 ing，人用 ed”。The frightening noise made the child frightened 里，noise 是引起害怕的一方，用 frightening；child 是感到害怕的一方，用 frightened。同一句已经说明，真正标准是引发感受还是承受感受，而不是对象属于人还是物。
选择时先找感受是什么；再问被说明的对象是在制造这种感受，还是在承受这种感受。制造、引起的一方通常用 ing，感受到的一方通常用 ed；最后把形容词放回句子，确认它真正说明的是谁，而不是按人和物机械分配。`,
    lengthText: '458 字 · 约 2 分钟'
  },
  'compound-adjectives': {
    id: 'adjective:compound-adjectives', version: 'v1',
    text: `“一个十岁的儿子”里，ten、year、old 三个词要一起说明 son。英语写成：<#0.4#>She has a ten-year-old son。<#0.8#>连字符像订书钉，把三个词装成一块前置形容词，让读者知道它们共同修饰后面的 son。ten-year-old 已经作为一个整体特征出现，内部的单位 year 保持单数。
第二句是：<#0.4#>This is a well-known story。<#0.8#>well 和 known 共同表达“广为人知”，连字符让读者在看到 story 前，就把两词作为同一个特征处理。<#0.7#>
第三句 We took a two-hour walk 中，two-hour 整体说明 walk 持续多久，hour 同样保持单数。这里数词和单位不在独立报告时长，而是在名词前共同做定语。
判断时先看名词前是不是有两三个词共同回答“什么样”；如果它们必须成组理解，就用连字符连接。遇到“数词加单位”作前置定语，单位名词保持单数；把这组词移到表语位置后，再按普通数量结构处理复数。最后检查连字符只连接共同修饰名词的那一组。`,
    lengthText: '420 字 · 约 2 分钟'
  },
  'adjective-order': {
    id: 'adjective:adjective-order', version: 'v1',
    text: `一件东西同时有大小、年龄、颜色等特征时，形容词不能完全随手排。先看：<#0.4#>She bought a lovely small old house。<#0.8#>lovely 是主观评价，small 说大小，old 说年龄。评价先出现，越客观、越贴近房子本身的特征越靠近 house。
第二句 He wears a new black Italian coat 按新旧、颜色、来源排列。<#0.7#>第三句 We sat at a beautiful round wooden table 中，beautiful 是评价，round 是形状，wooden 是材料；材料最靠近中心名词 table。<#0.7#>
最后看 She chose a lovely old wooden dining table。lovely 说评价，old 说年龄，wooden 说材料，dining 说用途。用途和材料都直接帮助界定桌子的类别，所以贴近 table。<#0.7#>
常见路线是：限定、评价、大小、形状、年龄、颜色、来源、材料、用途，最后才到名词。这是帮助自然表达的顺序，不是让你每次把所有格子填满。
操作时先圈出中心名词；再给每个修饰词贴上评价、大小、年龄、颜色、来源、材料或用途标签；按从主观到客观、从一般特征到贴近名词的类别排列。若拿不准，就把材料和用途放近名词，评价词放远一些，再用自然语感或词典例句校验。`,
    lengthText: '524 字 · 约 2 分钟'
  },
  'adjective-nominal': {
    id: 'adjective:adjective-nominal', version: 'v1',
    text: `形容词平时说明名词，但有些结构会让它承担更大的任务。比如：<#0.4#>The rich should help the poor。<#0.8#>rich 和 poor 后面没有写 people，the rich 整体表示“富人这一类”，the poor 表示“穷人这一类”。它们通常按复数群体理解，所以谓语用 should help，而不是把 rich 当一个人的名字。
形容词还能接在尺寸后。<#0.4#>The wall is two metres high。<#0.8#>two metres 给出具体数值，high 说明测量的是高度。数量、单位和 high 合作，先交代数值，再交代测量维度。<#0.7#>
再看联动变化：The more careful you are, the fewer mistakes you make。前半句说“越仔细”，后半句说“错误越少”。两个 the 加比较级不是最高级，而是把两种变化绑在一起。
判断时看到 the 加形容词，先问它是否代表一类人，并按复数理解；看到数量、单位和形容词，确认是在表达高、长、宽等尺寸；看到两个 the 加比较级，分别找出两条变化，再判断它们是否构成“越……越……”的关系。`,
    lengthText: '445 字 · 约 2 分钟'
  }
};

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
  bundle.course.forEach((item) => {
    if (EXTRA_ADJECTIVE_NARRATIONS[item.id]) item.narration = EXTRA_ADJECTIVE_NARRATIONS[item.id];
  });
  bundle.course[0].narration = {
    id: 'adjective:adjective-essence',
    version: 'v2',
    text: `桌上有好几个球，只说 ball，对方不知道你要哪个；加上 red，就能锁定红色的那个。red 给 ball 添了一条特征。像 red、tall、happy 这样，专门告诉我们“什么样”的词，叫形容词。找形容词时，第一件事不是看它放哪儿，而是找它在说明谁。<#0.8#>
先听。<#0.4#>The red ball rolled away。<#0.8#>事情的主干是“球滚走了”。red 贴在 ball 前面，告诉我们是哪一种球。形容词这样放在名词旁边做说明，语法上叫作定语。<#0.8#>
再听。<#0.4#>The ball is red。<#0.8#>red 还是在说明 ball，只是它没有贴在名词前，而是通过 is 连回 ball，告诉我们球处于什么样的状态。这份工作叫表语。位置变了，被说明的对象没有变。<#0.8#>
再想一句。<#0.4#>They painted the ball red。<#0.8#>是谁变红了？不是 They，而是 the ball。red 补上刷完以后球变成什么样，这份工作叫宾语补足语。<#0.7#>
三个 red 都在说明同一个对象，却用三种方式进入句子。判断时只做三步：先找表示“什么样”的词；再顺着意思问“谁或什么是这样的”；最后看它是贴在名词旁、通过系动词连接，还是补充动作后的结果。先找说明对象，再判断术语，最不容易错。`,
    lengthText: '481 字 · 约 2 分钟'
  };
  return bundle;
}

const EXTRA_ADVERB_NARRATIONS = {
  'adverb-jobs': {
    id: 'adverb:adverb-jobs', version: 'v1',
    text: `同样是副词，作用目标可能完全不同。先听：<#0.4#>Mia answered politely。<#0.8#>主干 Mia answered 已经说明她回答了，politely 只补充“怎样回答”，直接修饰动词 answered。
再听：<#0.4#>The water is very cold。<#0.8#>very 不说明 water，也不说明 is，它只把 cold 的程度提高，所以修饰形容词。<#0.7#>
Fortunately, everyone arrived safely 里有两个副词。safely 只说明 arrived 的方式；Fortunately 表示说话人觉得“幸好大家安全到达”，评价的是整件事。把 Fortunately 去掉，事件仍在，只是说话人的态度没了。He finished the task remarkably quickly 中，quickly 说明完成得怎样，remarkably 再加强 quickly，形成“非常快地”。一个副词也能修饰另一个副词。
判断副词的工作，先别只找 ly。给副词画一根箭头：指向动作，就是修饰动词；指向性质词，就是修饰形容词；指向另一个方式或程度词，就是修饰副词；若它在评价整句话的可能性、幸运与否或说话态度，就按句子副词处理。`,
    lengthText: '482 字 · 约 2 分钟'
  },
  'adverbial-boundary': {
    id: 'adverb:adverbial-boundary', version: 'v1',
    text: `老师问“softly 是副词还是状语”，答案可能是：两个说法都对，但回答的不是同一个问题。<#0.4#>She spoke softly。<#0.8#>softly 这个单词属于副词；它在句中回答“怎样说话”，承担的工作叫方式状语。副词是词的类别，状语是句子里的职位。
这个职位不只给副词坐。<#0.4#>She spoke in a soft voice。<#0.8#>in a soft voice 是介词短语，不是一个副词，但整块仍回答“怎样说话”，所以也作方式状语。<#0.7#>
She spoke when the room became quiet 中，when the room became quiet 里面有自己的主语和谓语，是一个从句；它整体回答“什么时候说话”，作时间状语。名词短语、非谓语短语也可能承担状语工作。
区分时分两层检查：先看形式，一个词是什么词类，一组词是介词短语、名词短语还是从句；再看功能，它对主句补充时间、地点、方式、原因还是条件。看到副词可以判断它常作状语，但看到状语绝不能反推它一定是副词。`,
    lengthText: '406 字 · 约 2 分钟'
  },
  'adverb-types': {
    id: 'adverb:adverb-types', version: 'v1',
    text: `一句话里可能同时塞进好几种背景。<#0.4#>We will meet outside tomorrow。<#0.8#>outside 回答“在哪里见”，是地点副词；tomorrow 回答“什么时候见”，是时间副词。分类不是看它们站在句尾，而是看各自补了什么信息。
再听：<#0.4#>She often reads quietly here。<#0.8#>often 说明阅读发生得多频繁，是频率副词；quietly 回答“怎样读”，是方式副词；here 指出地点。三个词都和 reads 有关，却各自回答不同问题。<#0.7#>
The bag is too heavy 中，too 不说明时间地点，而是把 heavy 推到“过于重”的程度，叫程度副词。Fortunately, the rain stopped soon 里，soon 给 stopped 加时间；Fortunately 则评价“雨停了”整件事，表达说话人的态度。
分类时先找副词的作用对象，再逐个提问：何时是时间，何地是地点，怎样是方式，多常是频率，到什么程度是程度；若它表达对整件事的幸运、意外或把握，就归入评注性句子副词。一个句子可以同时出现多类，不必只选一个。`,
    lengthText: '450 字 · 约 2 分钟'
  },
  'adverb-formation': {
    id: 'adverb:adverb-formation', version: 'v1',
    text: `想把 quick 变成“快速地”，最常见的办法是加 ly：<#0.4#>quick → quickly。<#0.8#>但不能只在每个形容词后面随手粘 ly，拼写和词义都要检查。
第二组是 happy → happily。happy 结尾是辅音字母加 y，变副词时先把 y 改成 i，再加 ly。<#0.7#>第三组 true → truly，要去掉结尾的 e，再加 ly。这些变化说明构词还要处理原词拼写。<#0.7#>
最后看 He runs fast。fast 没有 ly，却直接修饰 runs，说明动作怎样发生。不是所有副词都以 ly 结尾，也不是所有形容词都必须加 ly 才能承担副词功能。
构词时先确认句中真的需要副词；普通方式词可尝试加 ly；遇到辅音加 y、true、full 等词先处理拼写；最后检查这个词是否本来就能同形作副词，以及 ly 形式有没有产生新意思。不能用“有 ly 就是副词、没 ly 就不是”来判断。`,
    lengthText: '347 字 · 约 2 分钟'
  },
  'adverb-position': {
    id: 'adverb:adverb-position', version: 'v1',
    text: `你想说 Lily 通常走路上学，usually 放哪儿？英语说：<#0.4#>Lily usually walks to school。<#0.8#>walks 是实义动词，频率副词通常站在它前面。
换成 be，位置就换了：<#0.4#>Lily is always kind。<#0.8#>always 放在 is 后。第三句 Yesterday, we finished the work quickly 把时间提到句首作背景，让方式副词 quickly 放在动词和宾语之后。<#0.7#>
最后看 She has never visited London。句中有助动词 has，never 放在第一个助动词后、主要动词 visited 前。可以把频率副词想成靠近谓语核心的中间位置，但具体落点要看前面是 be 还是助动词。
操作时先给副词分类。频率词遇到实义动词放前，遇到 be 放后，有助动词放第一个助动词后；方式词通常放动词和宾语之后；时间词可放句首或句尾，句首背景后常加逗号。最后再按想强调的信息作小幅调整。`,
    lengthText: '385 字 · 约 2 分钟'
  },
  'multiple-adverb-order': {
    id: 'adverb:multiple-adverb-order', version: 'v1',
    text: `一句话同时有“唱得很美、在舞台上、昨晚”，怎样排才不挤？中性说法是：<#0.4#>She sang beautifully on stage last night。<#0.8#>先交代方式 beautifully，再说地点 on stage，最后放时间 last night。这是多个句尾状语常见的“方式、地点、时间”顺序。
顺序不是铁板一块。<#0.4#>Yesterday, we worked quietly in the library。<#0.8#>Yesterday 被提到句首，先搭起昨天这个背景，后面再说怎样工作、在哪里工作。前置的时间或地点状语常与主句用逗号分开。<#0.7#>
She carefully opened the box 把 carefully 放在动词前，让“动作很小心”更早进入听者注意。这个页面位置强调的是方式，而前两句主要展示多个状语在句首和句尾怎样排布。
排列时先把每个状语标成方式、地点或时间；都放句尾时先试方式、地点、时间；若某个信息要承接上文或搭背景，就把它前置并加逗号；最后朗读检查，避免把方式副词硬塞到动词与宾语之间。`,
    lengthText: '423 字 · 约 2 分钟'
  },
  'adjective-or-adverb': {
    id: 'adverb:adjective-or-adverb', version: 'v1',
    text: `闻到花香时，英语说：<#0.4#>The flowers smell sweet。<#0.8#>这里 smell 是“闻起来”，像一座桥把 flowers 和 sweet 连起来。sweet 说明花本身的性质，所以在这里是形容词。
如果孩子主动去闻花，句子变成：<#0.4#>The child smelled the flower carefully。<#0.8#>smelled 现在是行为动作，carefully 回答孩子“怎样闻”，所以用副词。判断形式前，要先分清动词是在连接主语状态，还是在表示真实动作。<#0.7#>
词尾也会骗人。The train moves fast 里，fast 没有 ly，却直接说明 moves 的方式。Our new neighbour is friendly 中，friendly 虽然以 ly 结尾，却通过 is 说明 neighbour，所以是形容词。
选择时先问被说明的是人或物的状态，还是动作发生的方式。系动词后说明主语，用形容词；行为动词旁说明动作，通常用副词。接着检查页面中的 fast 和 friendly 这类形式，不能只靠 ly 词尾下结论。`,
    lengthText: '422 字 · 约 2 分钟'
  },
  'adverb-comparison': {
    id: 'adverb:adverb-comparison', version: 'v1',
    text: `比赛时不只比较谁更高，还会比较谁跑得更快。<#0.4#>Amy runs faster than Sue。<#0.8#>faster 说明动作 runs 的速度更高。fast 是短副词，比较级直接加 er，最高级加 est。
若副词以 ly 结尾，通常不把词拉得更长。<#0.4#>Ben answered more carefully than I did。<#0.8#>carefully 前加 more 表示更仔细；三者以上可用 most carefully。Of all the runners, Leo ran the fastest 画出多人范围，用 fastest 选出速度最高者。<#0.7#>
还有不规则形式。Nora performed better than before 中，better 是 well 的比较级；well、better、best 要整体记。badly 则变 worse、worst。
操作时先确认比较的是动作方式或程度，而不是人或物的性质；再看副词形式。短副词常加 er 或 est，多数 ly 副词用 more 或 most；最后检查 well、badly 等不规则变化，并用 than 或范围短语说清比较基准。`,
    lengthText: '434 字 · 约 2 分钟'
  },
  'degree-patterns': {
    id: 'adverb:degree-patterns', version: 'v2',
    text: `同样是“很暖”，几个程度词站的位置不一样。宝宝待在房间里刚好合适，可以说：<#0.4#>The room is warm enough for the baby。<#0.8#>enough 放在形容词 warm 后，表示程度已经足够。
箱子重到我抬不动，就说：<#0.4#>The box is too heavy for me to lift。<#0.8#>too 放在 heavy 前，表示程度超过合适范围，后面的 for me to lift 说明对谁、做什么来说太重。<#0.7#>
第三句 It was such a difficult question that nobody answered it 中，such 抓住整个名词短语 a difficult question。第四句 The question was so difficult that nobody answered it 里，so 直接修饰形容词 difficult。两句结果相同，程度词后面的结构不同。
选择时先看程度词后面的中心。修饰形容词或副词，enough 放后面，too 和 so 放前面；修饰带冠词和名词的整块，用 such。若后面还有 that 从句，再判断前面突出的是性质程度，还是包含冠词、形容词和名词的完整名词短语。`,
    lengthText: '461 字 · 约 2 分钟'
  },
  'adverb-scope': {
    id: 'adverb:adverb-scope', version: 'v1',
    text: `一句话只挪动 only，重点就可能换人。<#0.4#>Only Mia solved the puzzle。<#0.8#>only 靠近 Mia，排除的是其他人：只有米娅解开了。第二句 Mia only solved the puzzle 中，only 靠近 solved，更容易表示她只是解开了，没有做别的。副词影响哪一块内容，叫作用范围；位置常在帮我们标范围。<#0.7#>
最后看 Even Ben almost missed the bus。even 把 Ben 标成出乎意料的人，暗示连他都差点误车；almost 修饰 missed，表示事情接近发生，但最后没有真的错过。两个副词在同一句里，各有自己的焦点。<#0.7#>
判断时给 only、even、almost 各画一条括号，圈住它最直接限定的成分；再用排除、意外或接近发生来改述意思。若一句话可能圈出两种范围，就把副词挪到目标成分旁边，或改写句子，让焦点唯一。`,
    lengthText: '356 字 · 约 2 分钟'
  },
  'sentence-adverbs': {
    id: 'adverb:sentence-adverbs', version: 'v1',
    text: `同一句 Mia is right，前面换一个副词，说话人的态度就变了。<#0.4#>Perhaps, Mia is right。<#0.8#>perhaps 表示“可能”，不是说明 Mia 怎样做事，而是降低说话人对整件判断的把握。
再看：<#0.4#>Fortunately, nobody was hurt。<#0.8#>nobody was hurt 是事实内容；Fortunately 表示说话人认为这个结果很幸运。这类词不是描写某一个动作，而是在评价整件事。<#0.7#>
Frankly, I disagree 里的 Frankly 也不是说“不同意得很坦率”，而是说明接下来这句话是坦率地讲出来。honestly、briefly 等还能提示说话方式或组织话语。
识别时先把句首副词拿掉，看剩下的主干事实是否完整；再问它表达的是对事实真假的把握、对结果的评价，还是讲话方式。perhaps、probably 属于把握程度，fortunately、sadly 属于评价，frankly、briefly 属于话语态度。别把它们误当成只修饰紧邻的主语。`,
    lengthText: '416 字 · 约 2 分钟'
  },
  'interrogative-relative-adverbs': {
    id: 'adverb:interrogative-relative-adverbs', version: 'v1',
    text: `why、where、how 都能出现在句首，但它们做的事不总一样。直接问离开的原因：<#0.4#>Why did you leave?<#0.8#>Why 是疑问副词，在疑问句中留下“因为什么”的空位，并触发主句疑问语序。
再看地点：<#0.4#>This is the place where we met。<#0.8#>where 不在提问，而是把 we met 接到先行词 place 上，并在从句里表示见面的地点。它既连接名词和定语从句，又在从句内作地点状语，所以叫关系副词。<#0.7#>
Tell me how you solved it 里，how 保留“怎样”的意义，引出一整块“你怎样解决它”的内容，整体作 tell 的宾语。这是疑问副词引导名词性从句，内部要用 you solved 的陈述语序。
判断时先看整句是不是直接提问；是，就按疑问副词处理。若前面有 time、place、reason 等先行词，后面从句在修饰它，就看关系副词；若从句整体回答“告诉、知道、询问什么”，就按名词性从句处理。最后检查它在从句内表示时间、地点、原因还是方式。`,
    lengthText: '414 字 · 约 2 分钟'
  },
  'negative-limiting-adverbs': {
    id: 'adverb:negative-limiting-adverbs', version: 'v1',
    text: `hardly 看起来像 hard 加 ly，意思却不是“努力地”。<#0.4#>I hardly know him。<#0.8#>hardly 表示“几乎不”，句子已经接近否定，不能再随手加 not 变成重复否定。
再听：<#0.4#>She rarely complains。<#0.8#>rarely 表示抱怨发生得很少，和 seldom 一样带低频限制。它们不是完全的 no，但已把发生频率压得很低，普通标准英语通常不再和 not 叠用。<#0.7#>
把否定或限制词推到句首，语序还会变化。Never have I seen such a view 先强调“从来没有”，随后把助动词 have 放到主语 I 前，形成部分倒装。这个倒装是句首否定范围带来的正式结构。
操作时先识别 hardly、scarcely、barely、rarely、seldom、never 自带的否定或限制强度；再圈出它们否定的是动作、频率还是范围；若它们位于句首，检查是否需要“助动词加主语加主要动词”的部分倒装。最后删掉没有特殊语境支撑的重复 not。`,
    lengthText: '400 字 · 约 2 分钟'
  },
  'conjunctive-adverbs': {
    id: 'adverb:conjunctive-adverbs', version: 'v1',
    text: `道路封闭，我们换了路线，两件事之间是结果关系。英语可以写：<#0.4#>The road was closed; therefore, we took another route。<#0.8#>therefore 告诉读者后句是前句的结果，但它不是 and、so 那样的并列连词，不能只靠一个逗号把两个完整分句粘起来。这里先用分号结束第一层句界，therefore 后再加逗号。
转折也一样：<#0.4#>The task was difficult; however, we finished it。<#0.8#>however 标出“虽然困难，仍然完成”的反向关系。前面也可以直接用句号，写成两个句子。<#0.7#>
连接副词还能组织顺序。First, check the data; then, write the report 中，First 和 then 帮读者按步骤推进，不是连接两个词或短语。
判断时先看前后是不是各自完整的分句；再辨认副词标的是结果、转折还是顺序。如果用 therefore、however 等连接两个独立分句，前面选分号或句号，后面通常加逗号；不要写成“完整句，however 完整句”的逗号拼接。`,
    lengthText: '444 字 · 约 2 分钟'
  },
  'adverb-traps': {
    id: 'adverb:adverb-traps', version: 'v1',
    text: `有些副词只差两个字母，意思却拐到另一条路。<#0.4#>He works hard every day。<#0.8#>hard 修饰 works，表示“努力地”。如果换成 hardly，句子就变成“他几乎不工作”，不是“更努力”。
再听：<#0.4#>I have hardly seen her lately。<#0.8#>hardly 表示“几乎没见过”，lately 表示“最近”。这里两个 ly 形式都不能从 hard 和 late 的表面意思直接推出来。<#0.7#>
页面第二句同时放入 hardly 和 lately，正好展示 ly 形式可能形成独立词义。lately 只谈最近一段时间，不能按 late 的“迟”直接推导。类似词必须把整组意义分开存，而不是把 ly 当作普通构词尾。
遇到 hard 或 hardly，先问句子要表达努力，还是几乎不；遇到 late 或 lately，先问是某次到得迟，还是最近这段时间。选完后把中文意思完整代回原句检查，若逻辑突然反转，就说明掉进了同形近形词陷阱。`,
    lengthText: '383 字 · 约 2 分钟'
  }
};

function buildAdverbCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  const bundle = groupCourse(english, [
    lesson(english, 'adverb-essence', '副词的定义与本质', 'Definition and core of adverbs', '给动作、性质或整句增加背景与范围', 'Add circumstances or scope to actions, qualities or clauses', [
      e([['Mia', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['calmly.', 'adverbial', '方式副词：修饰 answered', 'Manner adverb modifying answered']], 'structure', 'calmly 不改变“回答”这件事，而是补充回答以什么方式发生。', 'calmly does not change the event of answering; it adds how the event happens.'),
      e([['The water', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度副词：修饰 cold', 'Degree adverb modifying cold'], ['cold.', 'predicative', '形容词作表语', 'Adjective as subject complement']], 'structure', 'very 不直接说明 water，而是把形容词 cold 的程度提高。', 'very does not describe the water directly; it raises the degree of cold.'),
      e([['Probably,', 'adverbial', '句子副词：限定全句', 'Sentence adverb scoping over clause'], ['the train', 'subject', '主语', 'Subject'], ['will arrive', 'predicate', '谓语动词', 'Predicate verb'], ['soon.', 'adverbial', '时间副词', 'Time adverb']], 'structure', 'Probably 不是修饰某一个词，而是表示说话人对整件事发生可能性的判断。', 'Probably does not modify one word; it marks the speaker’s judgment about the whole event.')
    ], [
      ['副词的本质是给动作、性质、另一个副词或整句话增加时间、地点、方式、程度、频率、态度或范围。', 'An adverb adds time, place, manner, degree, frequency, stance or scope to an action, quality, another adverb or clause.'],
      ['判断副词不能只看 -ly；关键是看它在修饰谁、增加什么信息。', 'Do not identify an adverb by -ly alone; identify what it modifies and what information it adds.'],
      ['副词的位置常提示作用范围：离哪个成分更近，通常更直接限定哪个成分。', 'Position often signals scope: an adverb normally relates most directly to the element it stands near.']
    ], [
      q(['calmly 在“Mia answered calmly.”中补充什么？', 'What does calmly add in “Mia answered calmly”?'], 'how she answered', 'what she answered', 'A', 'calmly 说明回答的方式。', 'calmly gives the manner of answering.'),
      q(['very 在“very cold”中修饰什么？', 'What does very modify in “very cold”?'], 'cold', 'water', 'A', 'very 直接限定 cold 的程度。', 'very directly modifies the degree of cold.'),
      q(['Probably 在句首通常限定什么？', 'What does initial Probably normally scope over?'], 'the whole clause', 'only the next noun', 'A', 'Probably 表示对整件事可能性的判断。', 'Probably marks probability for the whole clause.')
    ]),
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
    lesson(english, 'adverbial-boundary', '副词与状语有什么区别', 'Adverbs versus adverbials', '词类不等于句子成分', 'A word class is not a sentence role', [
      e([['She', 'subject', '主语', 'Subject'], ['spoke', 'predicate', '谓语动词', 'Predicate verb'], ['softly.', 'adverbial', '副词作方式状语', 'Adverb as manner adverbial']], 'structure', 'softly 既是副词这一词类，在句中又承担方式状语这一功能。', 'softly is an adverb by word class and a manner adverbial by sentence function.'),
      e([['She', 'subject', '主语', 'Subject'], ['spoke', 'predicate', '谓语动词', 'Predicate verb'], ['in a soft voice.', 'adverbial', '介词短语作方式状语', 'Prepositional phrase as manner adverbial']], 'structure', 'in a soft voice 整体是状语，但它是介词短语，不是一个副词。', 'in a soft voice is an adverbial, but its form is a prepositional phrase, not an adverb.'),
      e([['She', 'subject', '主语', 'Subject'], ['spoke', 'predicate', '谓语动词', 'Predicate verb'], ['when the room became quiet.', 'adverbial', '时间状语从句', 'Time adverbial clause']], 'structure', 'when 从句说明说话时间，整体作状语；不能把整条从句叫作副词。', 'The when-clause gives the time and functions as an adverbial; the clause itself is not an adverb.')
    ], [
      ['副词是词类；状语是句子成分，二者不能画等号。', 'An adverb is a word class; an adverbial is a sentence function.'],
      ['副词可以作状语，但介词短语、名词短语和非谓语短语也能作状语。', 'Adverbs can be adverbials, but prepositional, noun and non-finite phrases can also fill that function.'],
      ['从句也能作状语，表示时间、原因、条件、让步等关系。', 'A clause can function as an adverbial of time, reason, condition, concession and more.']
    ], [
      q(['softly 是什么词类？', 'What word class is softly?'], 'an adverb', 'a prepositional phrase', 'A', 'softly 是副词，在句中可作状语。', 'softly is an adverb and can function as an adverbial.'),
      q(['in the morning 是副词吗？', 'Is “in the morning” an adverb?'], 'No; it is a prepositional phrase.', 'Yes; every adverbial is an adverb.', 'A', '它能作状语，但形式是介词短语。', 'It functions as an adverbial but is a prepositional phrase in form.'),
      q(['when he arrived 整体是什么？', 'What is “when he arrived” as a whole?'], 'an adverbial clause', 'one adverb', 'A', '它是从句，整体承担状语功能。', 'It is a clause functioning as an adverbial.')
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
    lesson(english, 'adverb-formation', '副词怎样构成', 'Forming adverbs', '-ly 拼写、同形副词与意义变化', '-ly spelling · flat adverbs · meaning changes', [
      e([['quick', 'attribute', '形容词', 'Adjective'], ['→', 'conjunction', '形式变化', 'Form change'], ['quickly', 'adverbial', '方式副词', 'Manner adverb']], 'spelling', '大多数方式副词在形容词后加 -ly：quick 变 quickly。', 'Many manner adverbs add -ly to an adjective: quick becomes quickly.'),
      e([['happy', 'attribute', '形容词', 'Adjective'], ['→', 'conjunction', '形式变化', 'Form change'], ['happily', 'adverbial', '方式副词', 'Manner adverb']], 'spelling', '辅音字母加 y 结尾时，通常把 y 变 i 再加 -ly。', 'After consonant + y, normally change y to i before adding -ly.'),
      e([['true', 'attribute', '形容词', 'Adjective'], ['→', 'conjunction', '形式变化', 'Form change'], ['truly', 'adverbial', '副词', 'Adverb']], 'spelling', 'true 变 truly 时去掉 e；whole 变 wholly 也需单独注意。', 'true drops e in truly; whole to wholly is another spelling to note.'),
      e([['He', 'subject', '主语', 'Subject'], ['runs', 'predicate', '谓语动词', 'Predicate verb'], ['fast.', 'adverbial', '同形副词', 'Flat adverb']], 'structure', 'fast 不加 -ly 也能作副词；不是所有副词都以 -ly 结尾。', 'fast functions as an adverb without -ly; not all adverbs end in -ly.')
    ], [
      ['许多方式副词由形容词加 -ly 构成。', 'Many manner adverbs are formed by adding -ly to adjectives.'],
      ['辅音字母 + y 常变 y 为 i 再加 -ly。', 'Consonant + y normally changes y to i before -ly.'],
      ['部分词有特殊拼写，如 true–truly、whole–wholly、full–fully。', 'Some forms have special spelling, such as true–truly, whole–wholly and full–fully.'],
      ['fast、hard、late、early 等可直接作副词；加 -ly 后有时意义会改变。', 'fast, hard, late and early can be flat adverbs; an -ly form may have a different meaning.']
    ], [
      q(['careful 的副词是？', 'What is the adverb from careful?'], 'carefully', 'carefuly', 'A', 'careful 加 -ly 形成 carefully。', 'careful adds -ly to form carefully.'),
      q(['happy 的副词是？', 'What is the adverb from happy?'], 'happily', 'happyly', 'A', 'y 变 i 再加 -ly。', 'Change y to i before -ly.'),
      q(['true 的副词是？', 'What is the adverb from true?'], 'truly', 'truely', 'A', 'true 去 e 变 truly。', 'true drops e to form truly.'),
      q('He works ___.', 'hard', 'hardly', 'A', 'hard 表示“努力地”；hardly 表示“几乎不”。', 'hard means “with effort”; hardly means “almost not”.')
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
    lesson(english, 'multiple-adverb-order', '多个状语怎样排列', 'Ordering multiple adverbials', '方式、地点、时间与强调位置', 'Manner · place · time · emphasis', [
      e([['She', 'subject', '主语', 'Subject'], ['sang', 'predicate', '谓语动词', 'Predicate verb'], ['beautifully', 'adverbial', '方式状语', 'Manner adverbial'], ['on stage', 'adverbial', '地点状语', 'Place adverbial'], ['last night.', 'adverbial', '时间状语', 'Time adverbial']], 'translation', '英语句尾常按“方式—地点—时间”排列；中文通常先交代时间和地点。', 'English end position often follows manner–place–time; Chinese commonly gives time and place earlier.'),
      e([['Yesterday,', 'adverbial', '前置时间状语', 'Fronted time adverbial'], ['we', 'subject', '主语', 'Subject'], ['worked', 'predicate', '谓语动词', 'Predicate verb'], ['quietly', 'adverbial', '方式状语', 'Manner adverbial'], ['in the library.', 'adverbial', '地点状语', 'Place adverbial']], 'structure', '时间可移到句首作为背景；句尾仍让方式靠近动作、地点随后。', 'Time moves first as the setting; manner stays close to the action and place follows.'),
      e([['She', 'subject', '主语', 'Subject'], ['carefully', 'adverbial', '强调的方式状语', 'Focused manner adverbial'], ['opened', 'predicate', '谓语动词', 'Predicate verb'], ['the box.', 'object', '宾语', 'Object']], 'structure', 'carefully 放在动词前可突出动作方式；放句尾也自然，但焦点较平。', 'carefully before the verb gives manner more focus; end position is also natural but less marked.')
    ], [
      ['多个句尾状语的常见顺序是方式—地点—时间，但语境和信息焦点可以调整。', 'A common end order is manner–place–time, though context and focus can change it.'],
      ['时间或地点状语可前置建立背景，前置后通常与主句用逗号隔开。', 'A time or place adverbial can be fronted as a setting and is normally followed by a comma.'],
      ['方式副词可放动词前或句尾；位置变化常改变强调重点，而非简单对错。', 'A manner adverb can occur before the verb or at the end; the position often changes focus rather than grammaticality.']
    ], [
      q('Choose the neutral end order.', 'She spoke softly at home yesterday.', 'She spoke yesterday softly at home.', 'A', '中性句尾常按方式—地点—时间。', 'Neutral end order commonly follows manner–place–time.'),
      q('Choose the natural background setting.', 'Last week, we met in Shanghai.', 'We last week met in Shanghai.', 'A', '时间状语可置于句首建立背景。', 'A fronted time adverbial establishes the setting.'),
      q(['哪一句更突出“仔细地”这一方式？', 'Which sentence gives more focus to carefully?'], 'She carefully checked the answer.', 'She checked the answer carefully.', 'A', '动词前位置更突出 carefully；两句都合语法。', 'Preverbal position gives carefully more focus; both are grammatical.')
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
    lesson(english, 'sentence-adverbs', '句子副词表达什么态度', 'What sentence adverbs express', '把握程度、评价与说话方式', 'Certainty · evaluation · speaking stance', [
      e([['Perhaps,', 'adverbial', '可能性句子副词', 'Possibility sentence adverb'], ['Mia', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['right.', 'predicative', '形容词作表语', 'Adjective as subject complement']], 'structure', 'Perhaps 限定整句的真实性，表示说话人不完全确定。', 'Perhaps scopes over the whole claim and shows uncertainty.'),
      e([['Fortunately,', 'adverbial', '评价性句子副词', 'Evaluative sentence adverb'], ['nobody', 'subject', '主语', 'Subject'], ['was hurt.', 'predicate', '谓语动词', 'Predicate verb']], 'structure', 'Fortunately 不是说明“受伤得幸运”，而是评价“无人受伤”这件事是幸运的。', 'Fortunately does not describe how anyone was hurt; it evaluates the whole outcome as fortunate.'),
      e([['Frankly,', 'adverbial', '说话方式句子副词', 'Speaking-stance adverb'], ['I', 'subject', '主语', 'Subject'], ['disagree.', 'predicate', '谓语动词', 'Predicate verb']], 'structure', 'Frankly 表示“坦率地说”，说明说话人以什么态度表达整句话。', 'Frankly means “speaking frankly” and frames the speaker’s stance toward the statement.')
    ], [
      ['perhaps、probably、certainly 等表示说话人对整句话真实性的把握程度。', 'perhaps, probably and certainly mark the speaker’s degree of certainty about a clause.'],
      ['fortunately、surprisingly、sadly 等评价整件事。', 'fortunately, surprisingly and sadly evaluate the whole event.'],
      ['frankly、honestly、briefly 等可说明说话方式或组织话语。', 'frankly, honestly and briefly can frame the manner of speaking or discourse organization.']
    ], [
      q('___, the train may be late.', 'Perhaps', 'Slowly', 'A', 'Perhaps 表示对整句的可能性判断。', 'Perhaps marks possibility for the whole clause.'),
      q('___, everyone escaped safely.', 'Fortunately', 'Carefully', 'A', 'Fortunately 评价整件事的结果。', 'Fortunately evaluates the outcome.'),
      q('___, I do not support the plan.', 'Frankly', 'Friendly', 'A', 'Frankly 表示“坦率地说”。', 'Frankly frames the statement as frank speech.')
    ]),
    lesson(english, 'interrogative-relative-adverbs', '疑问副词与关系副词', 'Interrogative and relative adverbs', '询问或连接时间、地点、原因与方式', 'Ask or link time, place, reason and manner', [
      e([['Why', 'adverbial', '疑问原因副词', 'Interrogative reason adverb'], ['did', 'helper', '助动词', 'Auxiliary verb'], ['you', 'subject', '主语', 'Subject'], ['leave?', 'predicate', '谓语动词', 'Predicate verb']], 'structure', 'Why 在句中询问 leave 的原因，不代替主语或宾语。', 'Why asks for the reason for leaving; it does not replace a subject or object.'),
      e([['This is', 'predicate', '主句谓语', 'Main predicate'], ['the place', 'predicative', '表语中心词', 'Complement head'], ['where we met.', 'attribute', '关系副词引导的定语从句', 'Relative clause introduced by adverb']], 'translation', 'where 在从句中表示“在这个地方”，连接 place 和 we met；中文通常译为“我们见面的地方”。', 'where means “at this place” in the clause and links it to place.'),
      e([['Tell me', 'predicate', '谓语与宾语', 'Predicate and object'], ['how you solved it.', 'object', 'how 引导的宾语从句', 'Object clause introduced by how']], 'structure', 'how 在从句中询问 solved 的方式，整个 how 从句作 tell 的直接宾语。', 'how asks for the manner of solving; the whole how-clause is the direct object of tell.')
    ], [
      ['when、where、why、how 可作疑问副词，询问时间、地点、原因或方式。', 'when, where, why and how can be interrogative adverbs asking about time, place, reason or manner.'],
      ['when、where、why 可作关系副词，在从句中承担状语功能并连接先行词。', 'when, where and why can be relative adverbs functioning adverbially while linking an antecedent.'],
      ['疑问副词也可引导名词性从句；此时整个从句占主语、宾语或表语位置。', 'An interrogative adverb can introduce a nominal clause that fills a subject, object or complement slot.']
    ], [
      q('___ did the meeting end?', 'When', 'Which', 'A', 'When 询问结束时间。', 'When asks about the time of ending.'),
      q('I remember the day ___ we met.', 'when', 'which place', 'A', 'when 在从句中作时间状语并连接 day。', 'when functions as a time adverb and links day.'),
      q('Do you know ___ he left?', 'why', 'because', 'A', 'why 引导宾语从句并询问原因。', 'why introduces an object clause asking for the reason.')
    ]),
    lesson(english, 'negative-limiting-adverbs', '否定与限制副词', 'Negative and limiting adverbs', '否定强度、范围与倒装', 'Negative force · scope · inversion', [
      e([['I', 'subject', '主语', 'Subject'], ['hardly', 'adverbial', '近乎否定副词', 'Near-negative adverb'], ['know', 'predicate', '谓语动词', 'Predicate verb'], ['him.', 'object', '宾语', 'Object']], 'structure', 'hardly 不是“努力地”，而是把 know 限定为“几乎不了解”，带近乎否定意义。', 'hardly does not mean “with effort”; it makes know nearly negative.'),
      e([['She', 'subject', '主语', 'Subject'], ['rarely', 'adverbial', '低频近否定副词', 'Low-frequency near-negative adverb'], ['complains.', 'predicate', '谓语动词', 'Predicate verb']], 'structure', 'rarely 表示事情发生频率极低，语义接近否定，但句中不再加 not。', 'rarely gives an extremely low frequency and is near-negative, so no extra not is used.'),
      e([['Never', 'adverbial', '前置否定副词', 'Fronted negative adverb'], ['have', 'helper', '助动词倒装', 'Inverted auxiliary'], ['I', 'subject', '主语', 'Subject'], ['seen', 'predicate', '谓语动词', 'Predicate verb'], ['such a view.', 'object', '宾语', 'Object']], 'structure', 'Never 前置加强否定后，助动词 have 移到主语 I 前形成部分倒装。', 'Fronted Never triggers partial inversion, moving have before I.')
    ], [
      ['hardly、scarcely、barely 表示“几乎不”，本身带近乎否定意义。', 'hardly, scarcely and barely mean “almost not” and carry near-negative force.'],
      ['rarely、seldom 表示低频，通常不再与 not 重复否定。', 'rarely and seldom mark low frequency and normally do not combine with an extra not.'],
      ['否定或限制副词置于句首时，正式语体中常触发助动词与主语部分倒装。', 'A fronted negative or limiting adverb often triggers subject–auxiliary inversion in formal style.']
    ], [
      q('I can ___ hear you.', 'hardly', 'hard', 'A', 'hardly 表示“几乎听不见”。', 'hardly means “can almost not hear”.'),
      q('She ___ eats fast food.', 'rarely', 'not rarely', 'A', 'rarely 已表示低频近否定。', 'rarely already carries low-frequency negative meaning.'),
      q('Never ___ such a view.', 'have I seen', 'I have seen', 'A', 'Never 前置触发助动词倒装。', 'Fronted Never triggers subject–auxiliary inversion.')
    ]),
    lesson(english, 'conjunctive-adverbs', '连接副词怎样连接分句', 'How conjunctive adverbs link clauses', '逻辑关系与标点边界', 'Logical relations and punctuation boundaries', [
      e([['The road was closed;', 'predicate', '第一独立分句', 'First independent clause'], ['therefore,', 'adverbial', '结果连接副词', 'Result conjunctive adverb'], ['we took another route.', 'predicate', '第二独立分句', 'Second independent clause']], 'structure', 'therefore 表示前因后果，但不能像 so 一样只用逗号连接两个独立分句。', 'therefore marks result but cannot join two independent clauses with only a comma as so can.'),
      e([['The task was difficult;', 'predicate', '第一独立分句', 'First independent clause'], ['however,', 'adverbial', '转折连接副词', 'Contrast conjunctive adverb'], ['we finished it.', 'predicate', '第二独立分句', 'Second independent clause']], 'structure', 'however 表示转折；前面用分号结束第一分句，后面用逗号隔开连接副词。', 'however marks contrast; a semicolon closes the first clause and a comma follows the adverb.'),
      e([['First,', 'adverbial', '顺序连接副词', 'Sequence conjunctive adverb'], ['check the data;', 'predicate', '第一分句', 'First clause'], ['then,', 'adverbial', '顺序连接副词', 'Sequence conjunctive adverb'], ['write the report.', 'predicate', '第二分句', 'Second clause']], 'structure', 'First 和 then 组织步骤顺序，连接的是信息推进关系。', 'First and then organize the sequence and progression of information.')
    ], [
      ['therefore、thus、consequently 表示结果；however、nevertheless 表示转折。', 'therefore, thus and consequently mark result; however and nevertheless mark contrast.'],
      ['连接副词不是并列连词；连接两个独立分句时，前面通常用分号或句号，后面常用逗号。', 'A conjunctive adverb is not a coordinator; between independent clauses it normally follows a semicolon or period and is followed by a comma.'],
      ['first、then、meanwhile、finally 等可组织顺序和信息推进。', 'first, then, meanwhile and finally organize sequence and information flow.']
    ], [
      q('The shop was closed; ___, we went home.', 'therefore', 'because', 'A', 'therefore 表示前句原因带来的结果。', 'therefore marks the result of the first clause.'),
      q('Choose the correct punctuation.', 'It rained; however, we left.', 'It rained, however we left.', 'A', '两个独立分句间用分号，however 后用逗号。', 'Use a semicolon between the clauses and a comma after however.'),
      q('___, read the question; then answer it.', 'First', 'Hardly', 'A', 'First 和 then 组织步骤顺序。', 'First and then organize sequence.')
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
  ], '副词', 'Adverbs', ['multiple-adverb-order','sentence-adverbs','interrogative-relative-adverbs','negative-limiting-adverbs','conjunctive-adverbs'], [
    ['adverb-foundation', '定义、本质与成分边界', 'Definition, core and functional boundary', '先看副词修饰谁，再区分副词词类与状语成分。', 'Identify what an adverb modifies, then distinguish word class from adverbial function.', ['adverb-essence','adverb-jobs','adverbial-boundary']],
    ['adverb-types-forms', '意义类别与形式边界', 'Meaning types and form boundaries', '掌握主要意义类别、构词规则及形容词副词辨析。', 'Master meaning classes, formation and adjective–adverb boundaries.', ['adverb-types','adverb-formation','adjective-or-adverb']],
    ['adverb-position-order', '位置与多个状语顺序', 'Position and adverbial order', '根据修饰对象、动词结构和信息焦点确定位置。', 'Choose position from the modified element, verb structure and information focus.', ['adverb-position','multiple-adverb-order']],
    ['adverb-degree-comparison', '程度结构与比较', 'Degree patterns and comparison', '掌握副词比较级、最高级和 enough、too、so、such。', 'Master adverb comparison and enough, too, so and such patterns.', ['adverb-comparison','degree-patterns']],
    ['adverb-scope-stance', '范围、态度与否定', 'Scope, stance and negation', '处理聚焦范围、说话者态度、近乎否定和倒装。', 'Handle focus scope, speaker stance, near-negation and inversion.', ['adverb-scope','sentence-adverbs','negative-limiting-adverbs']],
    ['adverb-linking', '疑问、关系与语篇连接', 'Question, relation and discourse linking', '处理疑问关系副词、易混词义和连接副词标点。', 'Handle interrogative/relative adverbs, confusing meanings and conjunctive punctuation.', ['interrogative-relative-adverbs','adverb-traps','conjunctive-adverbs']]
  ]);
  const byId = Object.fromEntries(bundle.course.map(item => [item.id, item]));
  byId['adverb-formation'].analyses.forEach(analysis => {
    if (analysis[1] && analysis[1].text === '→') Object.assign(analysis[1], { role: 'word', label: pick(english, '形式变化', 'Form change') });
  });
  byId['interrogative-relative-adverbs'].analyses[1] = [
    { text: 'This', role: 'subject', label: pick(english, '主语', 'Subject') },
    { text: 'is', role: 'predicate', label: pick(english, '系动词', 'Linking verb') },
    { text: 'the place', role: 'predicative', label: pick(english, '表语中心词', 'Complement head') },
    { text: 'where we met.', role: 'attribute', label: pick(english, '关系副词引导的定语从句', 'Relative clause introduced by adverb') }
  ];
  byId['interrogative-relative-adverbs'].analyses[2] = [
    { text: 'Tell', role: 'predicate', label: pick(english, '谓语动词', 'Predicate verb') },
    { text: 'me', role: 'indirectObject', label: pick(english, '间接宾语', 'Indirect object') },
    { text: 'how you solved it.', role: 'directObject', label: pick(english, 'how 引导的宾语从句', 'Object clause introduced by how') }
  ];
  byId['conjunctive-adverbs'].analyses.slice(0, 2).forEach(analysis => {
    analysis[0].role = 'independent';
    analysis[2].role = 'independent';
  });
  const scope = byId['adverb-scope'];
  scope.examples.splice(2, 1); scope.analyses.splice(2, 1); scope.exampleNotes.splice(2, 1);
  scope.rules.splice(1, 1); scope.questions.splice(1, 1);
  scope.ruleCoverage = INCLUDE_RULE_COVERAGE ? [
    { exampleIndexes: [0, 1], questionIndexes: [0] },
    { exampleIndexes: [2], questionIndexes: [2] },
    { exampleIndexes: [2], questionIndexes: [1] }
  ] : [];
  const traps = byId['adverb-traps'];
  traps.title = pick(english, '易混副词', 'Easily confused adverbs');
  traps.meta = 'hard/hardly · late/lately';
  traps.examples.splice(2); traps.analyses.splice(2); traps.exampleNotes.splice(2);
  traps.rules.splice(2); traps.questions.splice(2); traps.ruleCoverage.splice(2);
  const explanations = {
    'adverb-jobs': [
      ['politely 直接修饰 answered，说明回答采用什么方式。','politely directly modifies answered and gives the manner of answering.'],
      ['very 修饰形容词 cold，只改变寒冷的程度。','very modifies the adjective cold and changes only its degree.'],
      ['Fortunately 评价“所有人安全到达”整件事；safely 则说明 arrived 的方式。','Fortunately evaluates the whole event, while safely gives the manner of arriving.'],
      ['remarkably 修饰 quickly，quickly 再修饰 finished，形成两层修饰关系。','remarkably modifies quickly, which in turn modifies finished.']
    ],
    'adverb-types': [null,
      ['often 说明频率，quietly 说明方式，here 说明地点；三个副词各回答不同问题。','often gives frequency, quietly manner and here place; each answers a different question.'],
      ['too 说明 heavy 的程度已经超过合适范围。','too marks the degree of heavy as beyond an acceptable limit.'],
      ['Fortunately 评价整件事，soon 则说明 stopped 发生的时间。','Fortunately evaluates the event, while soon gives the time of stopping.']
    ],
    'adverb-position': [
      ['usually 放在实义动词 walks 前，表示走路上学的通常频率。','usually precedes the main verb walks and gives its frequency.'],
      ['be 动词 is 在前，频率副词 always 放在 is 后、表语 kind 前。','With be, always follows is and precedes the complement kind.'],
      ['Yesterday 前置建立时间背景；quickly 放句尾说明完成工作的方式。','Yesterday sets the time first; quickly at the end gives the manner of finishing.'],
      ['never 放在第一个助动词 has 后、主要动词 visited 前。','never follows the first auxiliary has and precedes the main verb visited.']
    ],
    'adjective-or-adverb': [
      ['smell 是系动词，sweet 说明 flowers 的性质，所以用形容词。','smell is linking, so sweet describes the flowers as an adjective.'],
      ['smelled 表示闻的动作，carefully 说明动作方式，所以用副词。','smelled is an action, and carefully gives its manner as an adverb.'],
      ['fast 形式不变，但在这里修饰 moves，因此是副词。','fast keeps the same form but modifies moves here, so it is an adverb.'],
      ['friendly 虽以 -ly 结尾，却说明 neighbour 的性质，是形容词表语。','friendly ends in -ly but describes neighbour, so it is an adjective complement.']
    ],
    'adverb-comparison': [
      ['faster 比较 Amy 和 Sue 跑步的速度，修饰 runs。','faster compares the manner or speed of running and modifies runs.'],
      ['carefully 是 -ly 副词，比较级在前面加 more。','carefully is an -ly adverb, so its comparative uses more.'],
      ['of all the runners 给出三者以上范围，因此用副词最高级 the fastest。','of all the runners defines a group of three or more, so the adverb superlative is used.'],
      ['better 是 well 的不规则比较级，说明表现比以前更好。','better is the irregular comparative of well and compares the performance with before.']
    ],
    'degree-patterns': [
      ['enough 放在 warm 后，表示温暖程度达到婴儿所需标准。','enough follows warm and marks the degree as sufficient for the baby.'],
      ['too 放在 heavy 前，表示重量超过“我能抬起”的限度。','too precedes heavy and marks a degree beyond what I can lift.'],
      ['such 修饰整个名词短语 a difficult question，that 从句说明结果。','such modifies the noun phrase a difficult question, and the that-clause gives the result.'],
      ['so 直接修饰形容词 difficult，that 从句说明困难造成的结果。','so directly modifies difficult, and the that-clause gives the result.']
    ],
    'adverb-scope': [null, null,
      ['Even 聚焦 Ben，强调他能理解出乎意料；almost 修饰 missed，表示差点错过但实际没有。','Even focuses Ben as unexpected; almost modifies missed and means the event nearly happened.']
    ],
    'adverb-traps': [
      ['hard 修饰 works，表示“努力地”，与 hardly“几乎不”不是程度变化。','hard modifies works meaning “with effort”; hardly means “almost not”.'],
      ['hardly 表示几乎没见过；lately 表示最近，不能分别理解成 hard 和 late 的普通 -ly 形式。','hardly means almost never seen; lately means recently, not ordinary -ly forms of hard and late.']
    ]
  };
  bundle.course.forEach(item => {
    item.analyses.forEach(analysis => analysis.forEach(unit => {
      if (unit.role === 'object' && /表语|complement/i.test(unit.label)) unit.role = 'predicative';
    }));
    item.exampleNotes.forEach((note, index) => {
      if (note.visible) return;
      const pair = explanations[item.id] && explanations[item.id][index];
      if (!pair) throw new Error(`Missing adverb example explanation: ${item.id}[${index}]`);
      item.exampleNotes[index] = { visible: true, mode: 'structure', title: pick(english, '例句说明', 'Example focus'), body: pick(english, pair[0], pair[1]), detail: '' };
    });
  });
  bundle.course.forEach((item) => {
    if (EXTRA_ADVERB_NARRATIONS[item.id]) item.narration = EXTRA_ADVERB_NARRATIONS[item.id];
  });
  bundle.course[0].narration = {
    id: 'adverb:adverb-essence',
    version: 'v2',
    text: `只说“米娅回答了”，事情已经完整；如果加上“平静地”，我们就知道她是怎么回答的。这个后来补上的词，不负责说人或东西“什么样”，而是在给动作加细节。这样的词常常叫副词。副词还能给一个性质加程度，甚至表达说话人对整件事的态度。<#0.8#>
先听。<#0.4#>Mia answered calmly。<#0.8#>主干只是 Mia answered。calmly 回答“怎么回答”，给动作 answered 加上方式。在句子里，这份补充方式的工作叫状语。<#0.8#>
再听。<#0.4#>The water is very cold。<#0.8#>very 不是在说明 water，也不是在说明 is，它只把 cold 的程度往上推，变成“非常冷”。所以副词不只跟动作，也可以跟形容词。<#0.8#>
再听一句。<#0.4#>Probably, the train will arrive soon。<#0.8#>soon 只告诉我们什么时候到；Probably 管的是整件事，表示说话人觉得“可能会到”。两个词都属于副词，管的范围却不一样。去掉 Probably，火车到达这件事还在，只是说话人的把握没有说出来。<#0.7#>
判断时别看到 ly 就直接下结论，因为 friendly 不是这里说的副词，fast 也没有 ly。先问这个词在给哪个动作、哪种性质或哪件事加信息；再问加的是时间、方式、程度还是态度；最后用整句意思检查它到底管到哪里。`,
    lengthText: '520 字 · 约 2 分钟'
  };
  return bundle;
}

module.exports = BUILD_TARGET === 'adjective' ? { buildAdjectiveCourse }
  : BUILD_TARGET === 'adverb' ? { buildAdverbCourse }
    : { buildAdjectiveCourse, buildAdverbCourse };
