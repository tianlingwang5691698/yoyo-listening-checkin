const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;

const example = (english, pieces, zhNote, enNote) => ({
  text: pieces.map((item) => item[0]).join(' '),
  analysis: pieces.map((item) => ({
    text: item[0],
    role: item[1],
    label: pick(english, item[2], item[3])
  })),
  note: {
    visible: true,
    mode: 'structure',
    title: '',
    body: pick(english, zhNote, enNote),
    detail: ''
  }
});

const question = (english, zhPrompt, enPrompt, a, b, answer, zhWhy, enWhy) => ({
  question: pick(english, zhPrompt, enPrompt),
  options: [
    { key: 'A', text: Array.isArray(a) ? pick(english, a[0], a[1]) : a },
    { key: 'B', text: Array.isArray(b) ? pick(english, b[0], b[1]) : b }
  ],
  answer,
  correct: pick(english, zhWhy, enWhy),
  wrong: pick(english, `再看规则：${zhWhy}`, `Check the rule: ${enWhy}`)
});

function lesson(english, spec) {
  const examples = spec.items.map((item) => example(english, item.pieces, item.zhNote, item.enNote));
  const questions = spec.items.map((item) => question(
    english,
    item.zhPrompt,
    item.enPrompt,
    item.a,
    item.b,
    item.answer,
    item.zhWhy,
    item.enWhy
  ));
  return {
    id: spec.id,
    title: pick(english, spec.zhTitle, spec.enTitle),
    meta: pick(english, spec.zhMeta, spec.enMeta),
    examples: examples.map((item) => item.text),
    analyses: examples.map((item) => item.analysis),
    exampleNotes: examples.map((item) => item.note),
    rules: spec.items.map((item) => pick(english, item.zhRule, item.enRule)),
    questions,
    ruleCoverage: INCLUDE_RULE_COVERAGE ? spec.items.map((item, index) => ({
      exampleIndexes: [index],
      questionIndexes: [index]
    })) : []
  };
}

function grouped(english, lessons, advancedIds, sectionSpecs) {
  const sectionByLessonId = {};
  sectionSpecs.forEach((section) => section[5].forEach((lessonId) => {
    sectionByLessonId[lessonId] = section[0];
  }));
  const course = lessons.map((item, index) => Object.assign({}, item, {
    no: String(index + 1).padStart(2, '0'),
    level: advancedIds.includes(item.id) ? 'advanced' : 'core',
    sectionId: sectionByLessonId[item.id] || ''
  }));
  const sections = sectionSpecs.map((section) => ({
    id: section[0],
    title: pick(english, section[1], section[2]),
    copy: pick(english, section[3], section[4]),
    lessonCount: section[5].length,
    lessonIds: section[5].slice()
  }));
  const coreLessons = course.filter((item) => item.level === 'core');
  const advancedLessons = course.filter((item) => item.level === 'advanced');
  return {
    title: pick(english, `感叹词 · ${course.length} 节微课`, `Interjections · ${course.length} lessons`),
    copy: pick(english, '先看即时反应和句子主干的关系，再结合语境、语气和语域选择表达。', 'First separate the reaction from the clause, then choose by context, tone and register.'),
    course,
    sections,
    groups: [
      {
        id: 'core',
        title: pick(english, `核心必学 · ${coreLessons.length} 节`, `Core · ${coreLessons.length} essential lessons`),
        copy: pick(english, '掌握定义边界、高频功能和基本书写。', 'Master the boundary, frequent functions and basic writing.'),
        lessons: coreLessons
      },
      {
        id: 'advanced',
        title: pick(english, `进阶挑战 · ${advancedLessons.length} 节`, `Advanced · ${advancedLessons.length} challenge lessons`),
        copy: pick(english, '处理语域差异、话语标记和跨词类辨析。', 'Handle register, discourse markers and word-class contrasts.'),
        lessons: advancedLessons
      }
    ]
  };
}

function buildInterjectionCourse(english) {
  const specs = [
    {
      id: 'interj-essence',
      zhTitle: '感叹词的定义与本质', enTitle: 'Definition and core of interjections',
      zhMeta: '把即时反应放在句子主干之外', enMeta: 'An immediate reaction outside the clause core',
      items: [
        {
          pieces: [['Wow!','interjection','感叹词：惊叹','Interjection: amazement'],['That view','subject','主语','Subject'],['is','predicate','系动词','Linking verb'],['amazing.','predicative','表语','Predicative']],
          zhNote: '先看主干 That view is amazing。Wow 不参与主谓结构，只把说话人的惊叹直接放在整句话前。',
          enNote: 'The clause core is “That view is amazing.” Wow does not enter its subject-predicate structure; it adds the speaker’s immediate amazement.',
          zhRule: '感叹词通常独立于句子主干，直接表达说话人的即时反应。',
          enRule: 'An interjection normally stands outside the clause core and directly expresses an immediate reaction.',
          zhPrompt: 'Wow 在本句中承担什么作用？', enPrompt: 'What does Wow do in this sentence?',
          a: ['表达说话人的惊叹','Expresses the speaker’s amazement'], b: ['充当句子主语','Acts as the subject'], answer: 'A',
          zhWhy: '主干已经完整，Wow 独立表达惊叹。', enWhy: 'The clause is already complete; Wow independently expresses amazement.'
        },
        {
          pieces: [['Ouch!','interjection','感叹词：疼痛反应','Interjection: pain reaction'],['That','subject','主语','Subject'],['hurt.','predicate','谓语动词','Predicate verb']],
          zhNote: 'Ouch 直接发出疼痛反应；删去它，That hurt 仍是完整句子，所以 Ouch 不是主语、谓语或宾语。',
          enNote: 'Ouch voices pain directly. “That hurt” remains a complete clause without it, so Ouch is not a subject, predicate or object.',
          zhRule: '判断感叹词时可先移去它：若句子主干仍完整，它通常是主干外的独立成分。',
          enRule: 'A useful test is removal: if the clause core stays complete, the item is likely an independent interjection.',
          zhPrompt: '删去 Ouch 后，That hurt 是否仍是完整句子？', enPrompt: 'After removing Ouch, is “That hurt” still a complete clause?',
          a: ['是','Yes'], b: ['不是','No'], answer: 'A',
          zhWhy: 'That 是主语，hurt 是谓语，主干完整。', enWhy: 'That is the subject and hurt is the predicate, so the core is complete.'
        }
      ]
    },
    {
      id: 'interj-independence-position',
      zhTitle: '独立性与位置', enTitle: 'Independence and position',
      zhMeta: '句首最常见，也可单独出现或插入句中', enMeta: 'Common initially, but also standalone or parenthetical',
      items: [
        {
          pieces: [['Oh,','interjection','感叹词：领悟','Interjection: realization'],['I','subject','主语','Subject'],['understand','predicate','谓语动词','Predicate verb'],['now.','adverbial','时间状语','Time adverbial']],
          zhNote: 'Oh 放在句首，先表示“我现在明白了”的即时领悟，再由后面的完整句子说明内容。',
          enNote: 'Initial Oh first signals sudden realization; the complete clause that follows states what the speaker now understands.',
          zhRule: '感叹词常位于句首，与后面的完整句子松散连接。',
          enRule: 'An interjection commonly occurs initially and is loosely attached to the complete clause that follows.',
          zhPrompt: '本句的主干从哪里开始？', enPrompt: 'Where does the clause core begin?',
          a: 'Oh', b: 'I', answer: 'B',
          zhWhy: 'I understand 构成主谓主干，Oh 在主干之外。', enWhy: 'I understand forms the subject-predicate core; Oh stands outside it.'
        },
        {
          pieces: [['Aha!','interjection','独立感叹词：发现','Standalone interjection: discovery']],
          zhNote: 'Aha 可以单独成为一次完整话语：说话人不造句，也能让听者知道“我发现了”或“我明白了”。',
          enNote: 'Aha can form a complete utterance by itself: without a clause, it tells the listener that the speaker has discovered or understood something.',
          zhRule: '感叹词可以独立构成话语，不必具备主语和谓语。',
          enRule: 'An interjection can form a complete utterance without a subject or predicate.',
          zhPrompt: 'Aha! 单独使用时是否必须补出主语和谓语？', enPrompt: 'Must standalone “Aha!” be supplied with a subject and predicate?',
          a: ['必须','Yes'], b: ['不必','No'], answer: 'B',
          zhWhy: '感叹词本身可以构成一次完整回应。', enWhy: 'An interjection can itself form a complete response.'
        },
        {
          pieces: [['The answer,','subject','主语','Subject'],['alas,','interjection','插入感叹词：遗憾','Parenthetical interjection: regret'],['was','predicate','系动词','Linking verb'],['wrong.','predicative','表语','Predicative']],
          zhNote: 'alas 插在主语和谓语之间，表达遗憾，却不改变 The answer was wrong 的主干；两边用逗号隔开。',
          enNote: 'alas is inserted between subject and predicate to express regret, but it does not alter the core “The answer was wrong”; commas set it off.',
          zhRule: '感叹词插入句中时仍在主干之外，通常用逗号与主干隔开。',
          enRule: 'A medial interjection remains outside the clause core and is normally set off with commas.',
          zhPrompt: '去掉 alas 后，本句主干是什么？', enPrompt: 'What is the clause core after removing alas?',
          a: 'The answer was wrong.', b: 'The answer alas.', answer: 'A',
          zhWhy: 'alas 只是插入的态度反应。', enWhy: 'alas is only a parenthetical reaction.'
        }
      ]
    },
    {
      id: 'interj-vs-exclamative',
      zhTitle: '感叹词与感叹句', enTitle: 'Interjections and exclamative sentences',
      zhMeta: '一种是词类，一种是句型', enMeta: 'A word class versus a sentence type',
      items: [
        {
          pieces: [['Wow!','interjection','感叹词','Interjection'],['What a beautiful day!','exclamative','what 感叹句','what-exclamative']],
          zhNote: 'Wow 是感叹词；What a beautiful day 是完整的感叹句结构。两者都能表达强烈感情，但语法身份不同。',
          enNote: 'Wow is an interjection; “What a beautiful day” is an exclamative sentence pattern. Both express strong feeling, but their grammar differs.',
          zhRule: '感叹词是词类；what/how 感叹句是句型，二者不能混为一类。',
          enRule: 'An interjection is a word class; a what/how exclamative is a sentence pattern, so they are not the same category.',
          zhPrompt: 'What a beautiful day! 属于什么？', enPrompt: 'What is “What a beautiful day!”?',
          a: ['感叹句','An exclamative sentence'], b: ['单个感叹词','A single interjection'], answer: 'A',
          zhWhy: '它使用 What + 名词短语的感叹句结构。', enWhy: 'It uses the What + noun phrase exclamative pattern.'
        },
        {
          pieces: [['How','exclamative','感叹句标记','Exclamative marker'],['fast','predicative','被强调的形容词','Focused adjective'],['she','subject','主语','Subject'],['runs!','predicate','谓语动词','Predicate verb']],
          zhNote: 'How 把 fast 提到句首突出“多么快”，后面仍保留 she runs 的主谓关系；这里不是独立感叹词。',
          enNote: 'How fronts fast to highlight the degree, while she runs retains its subject-predicate relation; How is not an independent interjection here.',
          zhRule: 'how 感叹句强调形容词或副词的程度，内部仍有可分析的句法结构。',
          enRule: 'A how-exclamative focuses the degree of an adjective or adverb and retains analyzable internal syntax.',
          zhPrompt: 'How fast she runs! 中被突出的是哪个成分？', enPrompt: 'What is focused in “How fast she runs!”?',
          a: 'fast', b: 'she', answer: 'A',
          zhWhy: 'How + fast 突出跑得多么快。', enWhy: 'How + fast highlights the degree of speed.'
        }
      ]
    },
    {
      id: 'interj-emotions',
      zhTitle: '表达不同即时情绪', enTitle: 'Expressing immediate emotions',
      zhMeta: '惊喜、遗憾、厌恶与疼痛', enMeta: 'Surprise, regret, disgust and pain',
      items: [
        {
          pieces: [['Hooray!','interjection','感叹词：喜悦','Interjection: joy'],['We','subject','主语','Subject'],['won!','predicate','谓语动词','Predicate verb']],
          zhNote: 'Hooray 把“获胜”带来的喜悦直接喊出来，后面的 We won 说明喜悦的原因。',
          enNote: 'Hooray directly voices the joy caused by winning; “We won” supplies the reason for that joy.',
          zhRule: 'hooray 常表达庆祝、喜悦或成功后的欢呼。',
          enRule: 'hooray commonly expresses celebration, joy or a cheer after success.',
          zhPrompt: '得知球队获胜后，哪项最能表达欢呼？', enPrompt: 'Which best expresses a cheer after the team wins?',
          a: 'Hooray!', b: 'Ouch!', answer: 'A',
          zhWhy: 'Hooray 表达喜悦和庆祝。', enWhy: 'Hooray expresses joy and celebration.'
        },
        {
          pieces: [['Oh no!','interjection','感叹词组：担忧/懊恼','Interjection phrase: alarm/dismay'],['I','subject','主语','Subject'],['missed','predicate','谓语动词','Predicate verb'],['the bus.','object','宾语','Object']],
          zhNote: 'Oh no 不是逐词翻译，而是对“错过公交车”作出的担忧或懊恼反应。',
          enNote: 'Oh no is not interpreted word by word; it reacts with alarm or dismay to missing the bus.',
          zhRule: 'oh no 常对坏消息、失误或危险表达担忧、失望或懊恼。',
          enRule: 'oh no commonly expresses alarm, disappointment or dismay at bad news, mistakes or danger.',
          zhPrompt: '发现自己错过公交车，哪项反应合适？', enPrompt: 'Which reaction suits discovering that you missed the bus?',
          a: 'Oh no!', b: 'Hooray!', answer: 'A',
          zhWhy: 'Oh no 符合失误后的懊恼语境。', enWhy: 'Oh no fits the dismay caused by a mistake.'
        },
        {
          pieces: [['Yuck!','interjection','感叹词：厌恶','Interjection: disgust'],['This milk','subject','主语','Subject'],['tastes','predicate','系动词','Linking verb'],['awful.','predicative','表语','Predicative']],
          zhNote: 'Yuck 先表达厌恶，This milk tastes awful 再说明厌恶来自牛奶难喝。',
          enNote: 'Yuck first expresses disgust; “This milk tastes awful” then identifies the unpleasant source.',
          zhRule: 'yuck 常表达对味道、气味或事物的厌恶，属于明显的非正式表达。',
          enRule: 'yuck commonly expresses disgust at a taste, smell or thing and is distinctly informal.',
          zhPrompt: '对难闻的食物表示厌恶可用什么？', enPrompt: 'What can express disgust at unpleasant food?',
          a: 'Yuck!', b: 'Bravo!', answer: 'A',
          zhWhy: 'Yuck 表示厌恶。', enWhy: 'Yuck expresses disgust.'
        }
      ]
    },
    {
      id: 'interj-context-tone',
      zhTitle: '语境和语调决定具体态度', enTitle: 'Context and tone shape meaning',
      zhMeta: '同一个词不等于固定的一句中文', enMeta: 'One form does not equal one fixed translation',
      items: [
        {
          pieces: [['Oh!','interjection','感叹词：惊喜','Interjection: pleased surprise'],['You','subject','主语','Subject'],['came!','predicate','谓语动词','Predicate verb']],
          zhNote: '在期待对方出现的场景中，升调和笑容可让 Oh 表达惊喜；意义来自词、语调和场景共同作用。',
          enNote: 'When the speaker hoped for the person’s arrival, rising intonation and a smile can make Oh express pleased surprise; form, tone and context work together.',
          zhRule: '同一感叹词的具体态度必须结合上下文和语调判断。',
          enRule: 'The specific attitude of an interjection must be interpreted through context and intonation.',
          zhPrompt: '判断 Oh! 的具体态度，最先需要结合什么？', enPrompt: 'What is needed first to interpret the precise attitude of Oh!?',
          a: ['上下文和语调','Context and intonation'], b: ['主谓一致','Subject-verb agreement'], answer: 'A',
          zhWhy: 'Oh 可以表达多种态度，语境和语调帮助确定本次含义。', enWhy: 'Oh can express several attitudes; context and tone identify the intended one.'
        },
        {
          pieces: [['Oh.','interjection','感叹词：失望/冷淡','Interjection: disappointment/detachment'],['The trip','subject','主语','Subject'],['is cancelled.','predicate','被动谓语','Passive predicate']],
          zhNote: '短促、下降的 Oh 配合“旅行取消”更可能表达失望或冷淡；句号也让语气比感叹号弱。',
          enNote: 'A short falling Oh with “The trip is cancelled” is more likely to show disappointment or detachment; the full stop also weakens the force.',
          zhRule: '语调、停顿和标点会改变感叹词的力度，但不能脱离场景机械判断。',
          enRule: 'Intonation, pause and punctuation affect an interjection’s force, but they must not be interpreted without context.',
          zhPrompt: 'Oh. 与 Oh! 相比，句号通常传递怎样的力度？', enPrompt: 'Compared with Oh!, what force does the full stop in Oh. usually suggest?',
          a: ['较弱或较克制','Weaker or more restrained'], b: ['必然更强烈','Necessarily stronger'], answer: 'A',
          zhWhy: '句号通常减弱书面语气，但最终仍要结合场景。', enWhy: 'A full stop generally weakens written force, though context remains decisive.'
        }
      ]
    },
    {
      id: 'interj-interaction',
      zhTitle: '管理交际与回应', enTitle: 'Managing interaction and responses',
      zhMeta: '招呼、提醒、赞赏与安静请求', enMeta: 'Attention, warning, praise and requests for silence',
      items: [
        {
          pieces: [['Hey!','interjection','感叹词：引起注意','Interjection: attention'],['Wait','predicate','祈使谓语','Imperative predicate'],['for me.','adverbial','对象介词短语','Target phrase']],
          zhNote: 'Hey 先把听者的注意力拉过来，再由 Wait for me 发出请求；对朋友自然，对正式对象可能过于随意。',
          enNote: 'Hey first attracts the listener’s attention, then “Wait for me” gives the request; it is natural with friends but may be too casual in formal interaction.',
          zhRule: 'hey 可非正式地招呼或引起注意，使用时要考虑双方关系。',
          enRule: 'hey can greet or attract attention informally, so the relationship between speakers matters.',
          zhPrompt: '在正式会议中直接用 Hey! 打断陌生人通常怎样？', enPrompt: 'How is Hey! usually perceived when interrupting a stranger in a formal meeting?',
          a: ['可能过于随意','Possibly too casual'], b: ['一定最正式','Always most formal'], answer: 'A',
          zhWhy: 'Hey 带明显的非正式语体。', enWhy: 'Hey has a distinctly informal register.'
        },
        {
          pieces: [['Bravo!','interjection','感叹词：赞赏','Interjection: approval'],['That','subject','主语','Subject'],['was','predicate','系动词','Linking verb'],['excellent.','predicative','表语','Predicative']],
          zhNote: 'Bravo 是对表演或成果的直接喝彩，后句 That was excellent 说明赞赏的判断。',
          enNote: 'Bravo directly applauds a performance or achievement; “That was excellent” states the positive evaluation.',
          zhRule: 'bravo 用于公开赞赏或喝彩，不是一般的同意回答。',
          enRule: 'bravo gives open praise or applause; it is not an ordinary answer of agreement.',
          zhPrompt: '为精彩演出喝彩，哪项最合适？', enPrompt: 'Which best applauds an excellent performance?',
          a: 'Bravo!', b: 'Shh!', answer: 'A',
          zhWhy: 'Bravo 直接表达赞赏。', enWhy: 'Bravo directly expresses approval.'
        },
        {
          pieces: [['Shh!','interjection','感叹词：要求安静','Interjection: request for silence'],['The baby','subject','主语','Subject'],['is sleeping.','predicate','谓语动词','Predicate verb']],
          zhNote: 'Shh 不描述声音，而是要求听者降低声音；后句说明要安静的原因。',
          enNote: 'Shh does not describe a sound; it asks the listener to lower their voice, and the following clause explains why.',
          zhRule: 'shh 直接管理听者行为，表示“请安静”，其功能不同于模仿声音。',
          enRule: 'shh directly manages the listener’s behaviour by requesting silence; it does not merely imitate a sound.',
          zhPrompt: '图书馆里提醒同伴安静可用什么？', enPrompt: 'What can quietly remind a friend to be silent in a library?',
          a: 'Shh!', b: 'Hooray!', answer: 'A',
          zhWhy: 'Shh 用于要求安静。', enWhy: 'Shh requests silence.'
        }
      ]
    },
    {
      id: 'interj-discourse-markers',
      zhTitle: '感叹词与话语标记', enTitle: 'Interjections and discourse markers',
      zhMeta: '表达反应，也能组织接下来的话', enMeta: 'Reacting and organizing what follows',
      items: [
        {
          pieces: [['Well,','discourseMarker','话语标记：思考/缓冲','Discourse marker: deliberation'],['I','subject','主语','Subject'],['need','predicate','谓语动词','Predicate verb'],['more time.','object','宾语','Object']],
          zhNote: 'Well 没有表示“好地”，也不修饰 need；它给说话人留出思考时间，让后面的回答更缓和。',
          enNote: 'Well does not mean “in a good way” or modify need; it gives the speaker thinking time and softens the answer that follows.',
          zhRule: '句首 Well, 常作话语标记，表示思考、缓冲或转折，而不是方式副词。',
          enRule: 'Initial Well, often acts as a discourse marker for deliberation, softening or a shift, not as a manner adverb.',
          zhPrompt: 'Well, I need more time. 中 Well 的作用是什么？', enPrompt: 'What does Well do in “Well, I need more time”?',
          a: ['组织并缓和回答','Organizes and softens the reply'], b: ['修饰 need 的方式','Modifies the manner of need'], answer: 'A',
          zhWhy: 'Well 位于主干外，为接下来的回答作缓冲。', enWhy: 'Well stands outside the core and prepares a softened reply.'
        },
        {
          pieces: [['Oh,','discourseMarker','话语标记：领悟','Discourse marker: realization'],['now','adverbial','时间状语','Time adverbial'],['I','subject','主语','Subject'],['see.','predicate','谓语动词','Predicate verb']],
          zhNote: 'Oh 标记说话人刚刚发生的认知变化，now I see 则把“现在明白”说完整。',
          enNote: 'Oh marks a new change in the speaker’s understanding; “now I see” states that understanding as a clause.',
          zhRule: 'oh 可在对话中标记领悟、回应或话题状态变化，具体功能仍由语境决定。',
          enRule: 'oh can mark realization, response or a change in discourse state; context still determines its precise function.',
          zhPrompt: 'Oh, now I see. 中 Oh 最可能标记什么？', enPrompt: 'What does Oh most likely mark in “Oh, now I see”?',
          a: ['刚刚领悟','New realization'], b: ['动作方式','Manner of action'], answer: 'A',
          zhWhy: 'now I see 显示说话人刚刚明白。', enWhy: 'now I see shows that the speaker has just understood.'
        }
      ]
    },
    {
      id: 'interj-punctuation',
      zhTitle: '标点、大小写与位置', enTitle: 'Punctuation, capitalization and position',
      zhMeta: '用标点表示独立程度和语气强弱', enMeta: 'Punctuation marks independence and force',
      items: [
        {
          pieces: [['Ouch!','interjection','强烈独立反应','Strong independent reaction'],['That','subject','主语','Subject'],['really hurt.','predicate','谓语与程度状语','Predicate and degree adverbial']],
          zhNote: 'Ouch 独立且反应强烈，所以用感叹号结束；后面的 That really hurt 另起一个句子。',
          enNote: 'Ouch is independent and forceful, so an exclamation mark closes it; “That really hurt” begins a separate sentence.',
          zhRule: '强烈且独立的感叹词常用感叹号，后接句子时要明确句界。',
          enRule: 'A strong independent interjection commonly takes an exclamation mark, and any following sentence needs a clear boundary.',
          zhPrompt: '表达突然剧痛，哪种书写更合适？', enPrompt: 'Which writing best conveys sudden strong pain?',
          a: 'Ouch!', b: 'ouch,', answer: 'A',
          zhWhy: '句首要大写，强烈独立反应用感叹号。', enWhy: 'Capitalize initially and use an exclamation mark for the strong independent reaction.'
        },
        {
          pieces: [['Well,','discourseMarker','较弱话语标记','Mild discourse marker'],['we','subject','主语','Subject'],['should begin.','predicate','谓语动词','Predicate verb']],
          zhNote: 'Well 与后句联系较紧、语气较弱，逗号表示短暂停顿，不把后句切成新的强烈感叹。',
          enNote: 'Well is mildly and closely linked to what follows; the comma marks a brief pause rather than a separate forceful exclamation.',
          zhRule: '较弱的句首感叹词或话语标记通常用逗号与后句隔开。',
          enRule: 'A mild initial interjection or discourse marker is normally separated from the following clause by a comma.',
          zhPrompt: '表示轻微犹豫后继续说话，哪项标点更自然？', enPrompt: 'Which punctuation is more natural for mild hesitation before continuing?',
          a: 'Well, I am not sure.', b: 'Well! I am not sure.', answer: 'A',
          zhWhy: '轻微停顿通常用逗号。', enWhy: 'A comma normally marks the mild pause.'
        },
        {
          pieces: [['Oh,','interjection','句首感叹词','Sentence-initial interjection'],['I','subject','主语','Subject'],['forgot.','predicate','谓语动词','Predicate verb']],
          zhNote: 'Oh 位于句首，因此首字母大写；逗号把它与 I forgot 的主干隔开。',
          enNote: 'Oh begins the sentence, so it is capitalized; the comma separates it from the clause core “I forgot.”',
          zhRule: '感叹词位于句首时首字母大写；大小写规则不因它很短而取消。',
          enRule: 'Capitalize an interjection at the beginning of a sentence; its short length does not remove that rule.',
          zhPrompt: '选择规范的句首写法。', enPrompt: 'Choose the correctly capitalized sentence.',
          a: 'oh, I forgot.', b: 'Oh, I forgot.', answer: 'B',
          zhWhy: '句首 Oh 的首字母应大写。', enWhy: 'Sentence-initial Oh must be capitalized.'
        }
      ]
    },
    {
      id: 'interj-register-politeness',
      zhTitle: '语域、礼貌与使用分寸', enTitle: 'Register, politeness and appropriacy',
      zhMeta: '自然不只取决于语法正确', enMeta: 'Appropriacy goes beyond grammatical form',
      items: [
        {
          pieces: [['Hey,','interjection','非正式招呼','Informal attention signal'],['Mia,','vocative','呼语','Vocative'],['look at this.','predicate','祈使谓语与宾语','Imperative predicate and object']],
          zhNote: '朋友之间用 Hey 引起注意很自然；Mia 是呼语，不是句子主语，祈使句省略的主语是 you。',
          enNote: 'Hey naturally gets a friend’s attention; Mia is a vocative, not the clause subject, while the imperative has an understood you.',
          zhRule: '非正式感叹词是否得体取决于关系、场合和说话目的。',
          enRule: 'The appropriacy of an informal interjection depends on relationship, setting and communicative purpose.',
          zhPrompt: 'Hey, Mia 最适合哪种场景？', enPrompt: 'Which setting best suits “Hey, Mia”?',
          a: ['朋友间招呼','Greeting a friend'], b: ['正式致辞开场','Opening a formal address'], answer: 'A',
          zhWhy: 'Hey 是明显的非正式招呼。', enWhy: 'Hey is a clearly informal attention signal.'
        },
        {
          pieces: [['Well,','discourseMarker','缓和语气的话语标记','Softening discourse marker'],['I','subject','主语','Subject'],['see','predicate','谓语动词','Predicate verb'],['your point.','object','宾语','Object']],
          zhNote: 'Well 让不同意见不显得突然，但礼貌仍来自整句话、语调和场景，不能认为加一个 Well 就一定礼貌。',
          enNote: 'Well can make disagreement less abrupt, but politeness still comes from the whole sentence, tone and context; Well alone cannot guarantee it.',
          zhRule: '感叹词和话语标记可以调节语气，却不能单独决定一句话是否礼貌。',
          enRule: 'Interjections and discourse markers can adjust tone, but cannot alone determine whether an utterance is polite.',
          zhPrompt: '加入 Well 是否能保证后面的话一定礼貌？', enPrompt: 'Does adding Well guarantee that what follows is polite?',
          a: ['不能，还要看整句和语境','No; the whole utterance and context matter'], b: ['能，任何场景都礼貌','Yes, in every setting'], answer: 'A',
          zhWhy: '礼貌由措辞、语调、关系和场景共同决定。', enWhy: 'Wording, tone, relationship and setting jointly create politeness.'
        }
      ]
    },
    {
      id: 'interj-wordclass-sounds',
      zhTitle: '感叹词、其他词类与拟声表达', enTitle: 'Interjections, other word classes and sound words',
      zhMeta: '不要只看单词外形，要看句中功能', enMeta: 'Classify by function, not form alone',
      items: [
        {
          pieces: [['Well,','discourseMarker','话语标记','Discourse marker'],['we','subject','主语','Subject'],['should leave.','predicate','谓语动词','Predicate verb']],
          zhNote: '这里 Well 不修饰 leave，而是在主干前组织话语，因此是话语标记。',
          enNote: 'Here Well does not modify leave; it organizes the discourse before the clause core, so it is a discourse marker.',
          zhRule: '同一形式可能承担不同功能，词类判断必须结合它与句子主干的关系。',
          enRule: 'The same form can serve different functions, so classification must use its relation to the clause core.',
          zhPrompt: 'Well, we should leave. 中 Well 是什么？', enPrompt: 'What is Well in “Well, we should leave”?',
          a: ['话语标记','A discourse marker'], b: ['方式副词','A manner adverb'], answer: 'A',
          zhWhy: '它在主干外组织接下来的话。', enWhy: 'It organizes what follows outside the clause core.'
        },
        {
          pieces: [['She','subject','主语','Subject'],['sings','predicate','谓语动词','Predicate verb'],['well.','adverbial','方式状语：副词','Manner adverbial: adverb']],
          zhNote: '这里 well 回答“唱得怎么样”，直接修饰 sings，所以是副词，不是感叹词。',
          enNote: 'Here well answers “How does she sing?” and directly modifies sings, so it is an adverb, not an interjection.',
          zhRule: 'well 修饰动作方式时是副词；独立组织话语时才可能作话语标记。',
          enRule: 'well is an adverb when it modifies manner; it can be a discourse marker when it independently organizes speech.',
          zhPrompt: 'She sings well. 中 well 是什么？', enPrompt: 'What is well in “She sings well”?',
          a: ['方式副词','A manner adverb'], b: ['感叹词','An interjection'], answer: 'A',
          zhWhy: 'well 直接修饰谓语动词 sings。', enWhy: 'well directly modifies the predicate verb sings.'
        },
        {
          pieces: [['Bang!','soundWord','拟声性独立表达','Independent sound word'],['The door','subject','主语','Subject'],['slammed shut.','predicate','谓语与补足成分','Predicate and complement']],
          zhNote: 'Bang 模仿突然的撞击声；独立放在话语中时具有感叹词式功能，但“拟声”描述的是声音来源，“感叹词功能”描述的是用法。',
          enNote: 'Bang imitates a sudden impact. Used independently, it has an interjection-like function, but “sound word” describes its source while “interjectional” describes its use.',
          zhRule: '拟声词模仿声音；它独立用于话语时可具有感叹词功能，但两个概念并不完全相同。',
          enRule: 'A sound word imitates a sound and may function interjectionally when independent, but the two concepts are not identical.',
          zhPrompt: 'Bang! 最直接模仿什么？', enPrompt: 'What does Bang! most directly imitate?',
          a: ['突然撞击声','A sudden impact sound'], b: ['时间关系','A time relation'], answer: 'A',
          zhWhy: 'Bang 是拟声性表达。', enWhy: 'Bang is sound-imitative.'
        }
      ]
    }
  ];

  const lessons = specs.map((spec) => lesson(english, spec));
  lessons[0].narration = {
    id: 'interjection:interj-essence',
    version: 'v1',
    text: `感叹词的本质，是把说话人的即时反应直接放进话语中，但通常不进入句子的主谓骨架。它可以表达惊喜、疼痛、犹豫、赞同或提醒，具体态度还要结合语调和语境判断。<#0.6#>
Wow! That view is amazing。<#0.7#>先看句子主干 That view is amazing，主语、系动词和表语都完整。Wow 不充当主语、谓语或宾语，只在主干外直接表达看到景色时的惊叹。去掉 Wow，句子仍然成立；保留它，说话人的即时情绪更鲜明。<#0.8#>
再看 Ouch! That hurt。<#0.7#>Ouch 是疼痛发生时的直接反应，That hurt 才是说明情况的完整句子。即使不补出主语和谓语，Ouch 也能单独成为一次完整回应。<#0.8#>
感叹词和感叹句不是一回事。Wow 是一个词类，而 What a beautiful view! 是一种句型。可以想一想：一个普通陈述句前加 Oh，句子主干改变了吗？没有，变化的是说话人的态度和交际效果。<#0.8#>
判断感叹词，可以先把它暂时移开。如果剩下部分仍有完整主干，它通常是主干外的独立成分。再结合停顿、标点和语调，判断它表达哪一种即时反应。`,
    lengthText: '437 字 · 约 2 分钟'
  };
  return grouped(english, lessons, ['interj-register-politeness', 'interj-wordclass-sounds'], [
    ['interj-foundation', '定义、本质与边界', 'Definition, essence and boundaries', '理解感叹词为何位于句子主干之外，并区分感叹词与感叹句。', 'Understand why interjections stand outside the clause core and distinguish them from exclamative sentences.', ['interj-essence', 'interj-independence-position', 'interj-vs-exclamative']],
    ['interj-meaning-system', '即时情绪与语境意义', 'Emotion and contextual meaning', '认识高频情绪表达，并依据上下文、语调和标点判断具体态度。', 'Recognize frequent emotional reactions and interpret attitude through context, intonation and punctuation.', ['interj-emotions', 'interj-context-tone']],
    ['interj-interaction-system', '交际功能与话语组织', 'Interaction and discourse', '用感叹词管理回应、注意与交际，再区分即时反应和话语组织功能。', 'Use interjections to manage responses and attention, then distinguish reaction from discourse organization.', ['interj-interaction', 'interj-discourse-markers']],
    ['interj-writing-system', '书写规范与使用分寸', 'Writing and appropriacy', '根据独立程度、语气强弱、关系和场合选择标点与表达。', 'Choose punctuation and expression according to independence, force, relationship and setting.', ['interj-punctuation', 'interj-register-politeness']],
    ['interj-boundary-system', '跨词类综合辨析', 'Word-class contrasts', '按句中功能区分感叹词、话语标记、副词和拟声表达。', 'Distinguish interjections, discourse markers, adverbs and sound words by function.', ['interj-wordclass-sounds']]
  ]);
}

module.exports = { buildInterjectionCourse };
