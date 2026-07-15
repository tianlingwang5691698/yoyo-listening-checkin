const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const labels = {
  subject: ['主语','Subject'], predicate: ['限定谓语','Finite predicate'], object: ['宾语','Object'],
  complement: ['补语','Complement'], subjectComplement: ['主语补语（表语）','Subject complement'], objectComplement: ['宾语补语','Object complement'],
  attribute: ['定语','Attribute'], adverbial: ['状语','Adverbial'], nonfinite: ['非谓语动词','Non-finite verb'],
  infinitive: ['不定式','Infinitive'], gerund: ['动名词','Gerund'], presentParticiple: ['现在分词','Present participle'],
  pastParticiple: ['过去分词','Past participle'], conjunction: ['连词','Conjunction'], auxiliary: ['助动词','Auxiliary'],
  preposition: ['介词','Preposition'], prepositionalObject: ['介词宾语','Object of preposition']
};
function a(english, chunks) {
  return chunks.map(([text, role, zh, en]) => ({ text, role, label: pick(english, zh || (labels[role] || ['', ''])[0], en || (labels[role] || ['', ''])[1]) }));
}
function n(english, mode, zh, en) {
  if (!mode) return { visible: false, mode: '', title: '', body: '', detail: '' };
  const titles = { structure: ['结构观察','Structure focus'], translation: ['语序翻译','Word-order translation'], meaning: ['意义辨析','Meaning contrast'], boundary: ['边界提醒','Boundary note'], transformation: ['结构转换','Transformation focus'] };
  return { visible: true, mode, title: pick(english, ...(titles[mode] || titles.structure)), body: pick(english, zh, en), detail: '' };
}
function option(english, value) { return Array.isArray(value) ? pick(english, value[0], value[1]) : value; }
function question(english, item) {
  return { question: pick(english, item[0], item[1]), options: item[2].map((value, index) => ({ key: String.fromCharCode(65 + index), text: option(english, value) })), answer: item[3], correct: pick(english, item[4], item[5]), wrong: pick(english, `再看规则：${item[4]}`, `Check the rule: ${item[5]}`) };
}
function makeLesson(english, spec, index) {
  if (spec.rules.length !== spec.examples.length || spec.rules.length !== spec.questions.length) throw new Error(`Non-finite rule coverage mismatch: ${spec.id}`);
  const examples = spec.examples.map((item) => ({ text: item[0].map((chunk) => chunk[0]).join(' '), analysis: a(english, item[0]), note: n(english, item[1], item[2], item[3]) }));
  return { id: spec.id, no: String(index + 1).padStart(2, '0'), level: spec.level, title: pick(english, ...spec.title), meta: pick(english, ...spec.meta), examples: examples.map((item) => item.text), analyses: examples.map((item) => item.analysis), exampleNotes: examples.map((item) => item.note), rules: spec.rules.map((item) => pick(english, ...item)), ruleCoverage: INCLUDE_RULE_COVERAGE ? spec.rules.map((_, i) => ({ exampleIndexes: [i], questionIndexes: [i] })) : [], questions: spec.questions.map((item) => question(english, item)) };
}

const specs = [
  {
    id: 'finite-nonfinite-boundary', level: 'core', title: ['非谓语的定义与本质','Definition and core of non-finite verbs'], meta: ['自身不承担限定性，但能保留动作意义并进入不同句子位置','They lack finiteness but retain verbal meaning in different sentence slots'],
    examples: [
      [[['She','subject'],['wants','predicate'],['to leave.','infinitive']], 'structure', 'wants 承担一般现在时和第三人称单数；to leave 不承担。', 'wants carries present tense and third-person agreement; to leave does not.'],
      [[['Reading books','gerund','动名词短语作主语','Gerund phrase as subject'],['helps','predicate'],['me.','object']], 'structure', 'Reading 是非谓语；helps 才是全句限定谓语。', 'Reading is non-finite; helps is the finite predicate.'],
      [[['The boy','subject'],['standing by the door','presentParticiple','现在分词短语作后置定语','Present-participle phrase as postmodifier'],['is','predicate'],['Tom.','subjectComplement']], 'translation', 'standing by the door 后置修饰 boy，中文通常前移为“站在门边的男孩”。', 'standing by the door follows boy in English but normally moves before 男孩 in Chinese.']
    ],
    rules: [
      ['限定谓语承担时态、语气或主谓一致；非谓语本身不承担这些限定特征。','A finite predicate carries tense, mood or agreement; a non-finite form does not carry these features by itself.'],
      ['非谓语短语可以整体占据主语、宾语等位置，但仍需另一个限定谓语构成完整分句。','A non-finite phrase may fill a subject or object slot, but a complete clause still needs a finite predicate.'],
      ['一个句子出现多个动词形式，不等于拥有多个限定谓语或多个分句。','Several verb forms in one sentence do not automatically mean several finite predicates or clauses.']
    ],
    questions: [
      ['She wants to leave. 的限定谓语是什么？','What is the finite predicate in “She wants to leave”?',['wants','to leave'],'A','wants 承担时态和一致。','wants carries tense and agreement.'],
      ['Reading books helps me. 中 Reading books 整体作什么？','What role does “Reading books” play in “Reading books helps me”?',[[ '主语','Subject'],['限定谓语','Finite predicate']],'A','动名词短语整体作主语。','The gerund phrase functions as subject.'],
      ['The boy standing by the door is Tom. 有几个限定谓语中心？','How many finite predicate centres are in “The boy standing by the door is Tom”?',[[ '一个','One'],['两个','Two']],'A','standing 是非谓语，is 才是限定谓语。','standing is non-finite; is is the finite predicate.']
    ]
  },
  {
    id: 'infinitive-forms', level: 'core', title: ['不定式的形式系统','The infinitive form system'], meta: ['一般、否定、被动、完成与进行','Simple, negative, passive, perfect and progressive'],
    examples: [
      [[['He','subject'],['decided','predicate'],['not to wait.','infinitive','否定不定式','Negative infinitive']], 'structure', '否定词 not 放在 to 前。', 'not comes before to.'],
      [[['The report','subject'],['needs','predicate'],['to be checked.','infinitive','被动不定式','Passive infinitive']], 'structure', 'report 是 check 的承受者，所以用 to be done。', 'The report receives the action, so use to be done.'],
      [[['She','subject'],['seems','predicate'],['to have finished.','infinitive','完成式不定式','Perfect infinitive']], 'structure', '完成发生在 seems 所表示的判断之前。', 'The finishing happened before the judgment expressed by seems.'],
      [[['He','subject'],['appears','predicate'],['to be sleeping.','infinitive','进行式不定式','Progressive infinitive']], 'structure', '睡觉与 appears 所表示的观察同时正在进行。', 'The sleeping is in progress at the time of the observation.']
    ],
    rules: [
      ['不定式否定式通常为 not to do，not 放在不定式标记 to 前。','The negative infinitive is normally not to do, with not before to.'],
      ['不定式被动式为 to be done，表示其逻辑主语承受动作。','The passive infinitive is to be done and shows that its logical subject receives the action.'],
      ['完成式 to have done 表示非谓语动作早于谓语所指时间。','The perfect infinitive to have done marks an action earlier than the finite-verb time.'],
      ['进行式 to be doing 突出非谓语动作在相关时间正在进行。','The progressive infinitive to be doing presents the non-finite action as ongoing at the relevant time.']
    ],
    questions: [
      ['“决定不等待”应选哪一项？','Which form means “decided not to wait”?',['decided not to wait','decided to not waited'],'A','否定式用 not to wait。','Use not to wait.'],
      ['The report needs ___.','The report needs ___.',['to check','to be checked'],'B','report 承受检查，要用被动不定式。','The report receives the checking, so use the passive infinitive.'],
      ['She seems ___ already.','She seems ___ already.',['to finish','to have finished'],'B','already 和先完成关系对应 to have finished。','The earlier completed action calls for to have finished.'],
      ['He appears ___ now.','He appears ___ now.',['to be sleeping','to have slept'],'A','now 表明动作正在进行。','now indicates an ongoing action.']
    ]
  },
  {
    id: 'infinitive-subject-predicative', level: 'core', title: ['不定式作主语和表语','Infinitives as subjects and subject complements'], meta: ['表达计划、目标或具体行为','Expressing plans, purposes or specific actions'],
    examples: [
      [[['To learn a language','infinitive','不定式短语作主语','Infinitive phrase as subject'],['takes','predicate'],['time.','object']], 'structure', 'To learn a language 整体是 takes 的主语；to learn 虽表示动作，却不承担全句的时态。', 'To learn a language is the whole subject of takes; to learn expresses an action but does not carry the clause tense.'],
      [[['It','subject','形式主语','Dummy subject'],['is','predicate'],['important','subjectComplement'],['to practise daily.','infinitive','真正主语','Notional subject']], 'structure', 'it 先占主语位置，真正内容由句末不定式表达。', 'it occupies the subject position and the final infinitive supplies the notional subject.'],
      [[['Her goal','subject'],['is','predicate'],['to become a doctor.','infinitive','不定式作主语补语','Infinitive as subject complement']], 'structure', 'is 是限定谓语；to become a doctor 放在表语槽位，说明 goal 的具体内容。', 'is is the finite predicate; to become a doctor fills the subject-complement slot and specifies the goal.']
    ],
    rules: [
      ['不定式短语可直接作主语，常表示具体、将来或目的性较强的行为。','An infinitive phrase can be a subject, often presenting a specific, future-oriented or purposeful action.'],
      ['为避免头重脚轻，英语常用形式主语 it，并把真正的不定式主语后移。','To avoid a heavy opening, English often uses dummy it and postpones the notional infinitive subject.'],
      ['不定式可作主语补语（表语），说明主语的目标、计划或任务。','An infinitive can be a subject complement specifying a goal, plan or task.']
    ],
    questions: [
      ['To learn a language takes time. 中 To learn a language 作什么？','What role does “To learn a language” play?',[['主语','Subject'],['宾语','Object']],'A','不定式短语整体作主语。','The infinitive phrase functions as subject.'],
      ['It is important to practise daily. 中真正主语是什么？','What is the notional subject in “It is important to practise daily”?',['it','to practise daily'],'B','it 是形式主语，不定式是真正内容。','it is dummy; the infinitive supplies the content.'],
      ['Her goal is to become a doctor. 中不定式作什么？','What role does the infinitive play in “Her goal is to become a doctor”?',[['主语补语（表语）','Subject complement'],['状语','Adverbial']],'A','它说明 goal 的具体内容。','It specifies the content of the goal.']
    ]
  },
  {
    id: 'infinitive-object-attribute-complement', level: 'core', title: ['不定式作宾语、定语和宾补','Infinitives as objects, attributes and object complements'], meta: ['识别不定式在句中的槽位','Identify the slot filled by the infinitive'],
    examples: [
      [[['We','subject'],['hope','predicate'],['to win.','infinitive','不定式作宾语','Infinitive as object']], 'structure', 'hope 承担时态；to win 回答“希望什么”，整体填入 hope 的宾语槽位。', 'hope carries tense; to win answers what is hoped for and fills the object slot of hope.'],
      [[['I','subject'],['have','predicate'],['some work','object'],['to finish.','infinitive','不定式短语作后置定语','Infinitive phrase as postmodifier']], 'translation', 'to finish 后置修饰 work，中文通常前移为“要完成的工作”。', 'to finish follows work in English but normally moves before 工作 in Chinese.'],
      [[['The teacher','subject'],['asked','predicate'],['us','object'],['to revise.','infinitive','不定式作宾语补语','Infinitive as object complement']], 'structure', 'us 是 asked 的宾语，to revise 补充说明 us 要做的事，两者构成逻辑上的“us revise”。', 'us is the object of asked; to revise tells what us is to do, forming the logical relation us revise.']
    ],
    rules: [
      ['部分动词直接以不定式短语作宾语，如 hope、decide、plan。','Some verbs take an infinitive phrase as object, such as hope, decide and plan.'],
      ['不定式作定语通常后置，可表示将要完成、需要完成或用途关系。','An attributive infinitive normally follows its noun and may express future action, necessity or purpose.'],
      ['“动词＋宾语＋to do”中，不定式说明宾语要执行的动作，作宾语补语。','In verb + object + to do, the infinitive tells what the object is to do and functions as object complement.']
    ],
    questions: [
      ['We hope to win. 中 to win 作什么？','What role does “to win” play in “We hope to win”?',[['宾语','Object'],['定语','Attribute']],'A','to win 是 hope 的内容宾语。','to win is the content object of hope.'],
      ['some work to finish 应如何翻译顺序？','How is “some work to finish” normally reordered in Chinese?',[['要完成的一些工作','The modifier moves before the noun'],['一些工作完成','The noun remains before the modifier']],'A','后置不定式在中文中通常前移。','The postmodifying infinitive normally moves before the noun in Chinese.'],
      ['The teacher asked us to revise. 中 to revise 作什么？','What role does “to revise” play?',[['宾语补语','Object complement'],['限定谓语','Finite predicate']],'A','它说明 us 要执行的动作。','It tells what us is asked to do.']
    ]
  },
  {
    id: 'infinitive-adverbials', level: 'core', title: ['不定式作状语','Infinitives as adverbials'], meta: ['目的、结果与原因或评价依据','Purpose, result, and reason or basis of evaluation'],
    examples: [
      [[['She','subject'],['went','predicate'],['to buy some milk.','infinitive','目的状语','Purpose adverbial']], 'translation', '不定式说明“去”的目的，中文可译为“去买牛奶”。', 'The infinitive gives the purpose of going.'],
      [[['He','subject'],['grew up','predicate'],['to be a scientist.','infinitive','结果状语','Result adverbial']], 'structure', '不定式表示后来出现的结果。', 'The infinitive presents the eventual result.'],
      [[['I','subject'],['am','predicate'],['glad','subjectComplement'],['to meet you.','infinitive','原因或评价依据状语','Reason/basis adverbial']], 'structure', 'to meet you 说明 glad 的原因或评价依据。', 'to meet you gives the reason or basis for glad.']
    ],
    rules: [
      ['目的不定式回答“为了什么”，通常与主句主语存在逻辑主谓关系。','A purpose infinitive answers “for what purpose” and normally has a logical subject related to the main-clause subject.'],
      ['结果不定式说明随后发生或最终形成的结果，常需结合语境判断。','A result infinitive presents a subsequent or eventual result and must be identified from context.'],
      ['不定式可跟在情感或评价形容词后，说明产生该感受或评价的原因、依据。','An infinitive after an emotive or evaluative adjective may give the reason or basis for that feeling or judgment.']
    ],
    questions: [
      ['She went to buy some milk. 中不定式表示什么？','What does the infinitive express in “She went to buy some milk”?',[['目的','Purpose'],['宾语','Object']],'A','它回答“去做什么”。','It answers why she went.'],
      ['He grew up to be a scientist. 中 to be a scientist 表示什么？','What does “to be a scientist” express?',[['结果','Result'],['地点','Place']],'A','它表示后来成为科学家的结果。','It presents the eventual result.'],
      ['I am glad to meet you. 中不定式说明什么？','What does the infinitive explain in “I am glad to meet you”?',[['glad 的原因或依据','The reason/basis for glad'],['I 的宾语','The object of I']],'A','见到你是产生高兴感受的依据。','Meeting you provides the basis for the feeling.']
    ]
  },
  {
    id: 'bare-infinitive', level: 'core', title: ['不带 to 的不定式','Bare infinitives'], meta: ['看前面的助动或补足结构是否要求动词原形','Check whether the preceding auxiliary or complement pattern requires the base form'],
    examples: [
      [[['You','subject'],['must finish','predicate','情态动词＋动词原形','Modal + bare infinitive'],['today.','adverbial']], 'structure', '情态动词 must 后用动词原形 finish。', 'A modal such as must is followed by the bare infinitive finish.'],
      [[['They','subject'],['made','predicate'],['him','object'],['apologize.','infinitive','省略 to 的宾语补语','Bare infinitive as object complement']], 'structure', '主动 make 后的宾补省略 to。', 'Active make takes a bare infinitive object complement.'],
      [[['He','subject'],['was made','predicate'],['to apologize.','infinitive','带 to 的主语补语','To-infinitive complement']], 'transformation', '使役结构变被动后通常恢复 to。', 'The passive causative normally restores to.'],
      [[['She','subject'],['helped','predicate'],['me','object'],['(to) carry the box.','infinitive','可带或省略 to 的宾补','Object complement with optional to']], 'structure', 'help 后的不定式在常见用法中可带 to，也可省略。', 'After help, the infinitive commonly appears with or without to.']
    ],
    rules: [
      ['情态动词后接动词原形，不使用 to。','A modal is followed by the bare infinitive without to.'],
      ['主动语态中 make、let 及部分感官动词后的宾补常省略 to。','In active clauses, make, let and some perception verbs commonly take a bare infinitive object complement.'],
      ['make 或感官动词的宾补结构变被动时，原来的不定式通常恢复 to。','When an object-complement construction with make or a perception verb becomes passive, to is normally restored.'],
      ['help 后可接 to do 或 do，两种形式均常见。','help can be followed by either to do or do; both are common.']
    ],
    questions: [
      ['You must ___ today.','You must ___ today.',['finish','to finish'],'A','情态动词 must 后用动词原形。','A modal takes the bare infinitive.'],
      ['They made him ___.','They made him ___.',['apologize','to apologize'],'A','主动 make 后宾补省略 to。','Active make takes a bare infinitive complement.'],
      ['He was made ___ .','He was made ___ .',['apologize','to apologize'],'B','变为被动后恢复 to。','The passive restores to.'],
      ['She helped me ___ the box. 哪项正确？','Which is correct in “She helped me ___ the box”?',[['carry / to carry 都可以','Both carry and to carry'],['只能 to carrying','Only to carrying']],'A','help 后可用 do 或 to do。','help allows do or to do.']
    ]
  },
  {
    id: 'gerund-form-logical-subject', level: 'core', title: ['动名词的形式与逻辑主语','Gerund forms and logical subjects'], meta: ['doing、being done、having done 与所有格','doing, being done, having done and possessive subjects'],
    examples: [
      [[['Being invited','gerund','被动动名词短语作主语','Passive gerund phrase as subject'],['is','predicate'],['an honour.','subjectComplement']], 'structure', '邀请作用于逻辑主语，因此使用 being done。', 'The logical subject receives the action, so use being done.'],
      [[['He','subject'],['denied','predicate'],['having taken the money.','gerund','完成式动名词作宾语','Perfect gerund as object']], 'structure', '拿钱发生在 denied 之前，用 having done 突出先后。', 'The taking preceded the denial, so having done marks the earlier action.'],
      [[['I','subject'],['appreciate','predicate'],['your helping me.','gerund','带逻辑主语的动名词短语作宾语','Gerund phrase with logical subject as object']], 'structure', 'your 是 helping 的逻辑主语；正式表达常用所有格。', 'your is the logical subject of helping; the possessive is common in formal usage.']
    ],
    rules: [
      ['动名词被动式为 being done，表示逻辑主语承受动作。','The passive gerund is being done and shows its logical subject receiving the action.'],
      ['完成式动名词 having done 强调动作早于谓语动作。','The perfect gerund having done emphasizes an action earlier than the finite verb.'],
      ['需要明示动名词逻辑主语时，正式语体常用名词所有格或形容词性物主形式。','When a gerund’s logical subject is explicit, formal style often uses a noun possessive or possessive determiner.']
    ],
    questions: [
      ['“被邀请是一种荣幸”应选哪一项？','Which form means “Being invited is an honour”?',['Being invited','Inviting'],'A','逻辑主语承受邀请，用被动动名词。','The logical subject receives the invitation, so use the passive gerund.'],
      ['He denied ___ the money earlier.','He denied ___ the money earlier.',['having taken','to take'],'A','先拿钱、后否认，用完成式动名词。','The taking happened before the denial.'],
      ['I appreciate ___ helping me. 正式表达选什么？','Which is the formal choice in “I appreciate ___ helping me”?',['your','you are'],'A','your 是 helping 的逻辑主语。','your is the logical subject of helping.']
    ]
  },
  {
    id: 'gerund-functions', level: 'core', title: ['动名词的句法功能','Syntactic functions of gerunds'], meta: ['作主语、宾语、表语和介词宾语','As subject, object, subject complement and prepositional object'],
    examples: [
      [[['Swimming every day','gerund','动名词短语作主语','Gerund phrase as subject'],['keeps','predicate'],['her','object'],['healthy.','objectComplement']], 'structure', 'Swimming every day 把“每天游泳”当作一项活动，整体作主语；keeps 才承担时态。', 'Swimming every day treats the activity as a whole subject; keeps, not swimming, carries the clause tense.'],
      [[['He','subject'],['enjoys','predicate'],['reading.','gerund','动名词作宾语','Gerund as object']], 'structure', 'enjoys 承担时态；reading 指被享受的活动，整体作 enjoys 的宾语。', 'enjoys carries tense; reading names the enjoyed activity and functions as its object.'],
      [[['Her hobby','subject'],['is','predicate'],['painting.','gerund','动名词作主语补语','Gerund as subject complement']], 'structure', 'is 连接 hobby 和 painting；painting 不是第二个谓语，而是说明爱好的内容。', 'is links hobby to painting; painting is not a second predicate but a subject complement naming the activity.'],
      [[['She','subject'],['is','predicate'],['interested','subjectComplement'],['in','preposition'],['learning languages.','gerund','动名词短语作介词宾语','Gerund phrase as object of preposition']], 'structure', 'in 是介词，learning languages 整体作 in 的宾语；learning 不能独立承担限定谓语。', 'in is a preposition and learning languages is its whole object; learning cannot serve as a finite predicate by itself.']
    ],
    rules: [
      ['动名词短语可作主语，把一个活动作为概念来谈论。','A gerund phrase can be subject, treating an activity as a concept.'],
      ['enjoy、avoid、finish、mind 等动词把后续内容当作活动来表达，因此选择动名词宾语。','Verbs such as enjoy, avoid, finish and mind present the following content as an activity and therefore select a gerund object.'],
      ['动名词可作主语补语，说明主语所指的活动内容。','A gerund can be a subject complement specifying an activity.'],
      ['介词后需要动词意义时，通常使用动名词。','When a verb meaning follows a preposition, the gerund is normally used.']
    ],
    questions: [
      ['Swimming every day keeps her healthy. 中动名词短语作什么？','What role does “Swimming every day” play?',[['主语','Subject'],['宾语','Object']],'A','整个活动作主语。','The activity as a whole is the subject.'],
      ['He enjoys ___.','He enjoys ___.',['reading','to reading'],'A','enjoy 后接动名词。','enjoy takes a gerund.'],
      ['Her hobby is painting. 中 painting 作什么？','What role does painting play in “Her hobby is painting”?',[['主语补语（表语）','Subject complement'],['状语','Adverbial']],'A','它说明 hobby 的内容。','It identifies the activity that is her hobby.'],
      ['She is interested in ___ languages.','She is interested in ___ languages.',['learning','to learn'],'A','介词 in 后接动名词。','The preposition in takes a gerund.']
    ]
  },
  {
    id: 'participle-voice-time', level: 'core', title: ['分词的主动、被动与时间关系','Participle voice and time relations'], meta: ['doing、done、having done 与 having been done','doing, done, having done and having been done'],
    examples: [
      [[['Walking home','presentParticiple','现在分词短语作状语','Present-participle adverbial'],['she','subject'],['called','predicate'],['me.','object']], 'structure', 'walking 与主句动作大致同时，且逻辑主语 she 主动执行。', 'walking is roughly simultaneous and actively performed by she.'],
      [[['Built in 1920','pastParticiple','过去分词短语作状语','Past-participle adverbial'],['the house','subject'],['is','predicate'],['still strong.','subjectComplement']], 'structure', 'house 承受 build，过去分词突出被动或完成。', 'The house receives build; the past participle presents passive or completed meaning.'],
      [[['Having finished the task','presentParticiple','完成式分词短语作状语','Perfect-participle adverbial'],['he','subject'],['went','predicate'],['home.','adverbial']], 'structure', '完成任务早于回家，用 having done。', 'Finishing preceded going home, so use having done.'],
      [[['Having been warned','pastParticiple','完成被动分词短语作状语','Perfect passive participle'],['they','subject'],['became','predicate'],['more careful.','subjectComplement']], 'structure', '他们先受到警告，再变得谨慎。', 'They were warned first and then became more careful.']
    ],
    rules: [
      ['doing 通常表示逻辑主语主动执行，时间常与谓语同时或相近。','doing normally marks active voice, with time simultaneous or close to the finite action.'],
      ['done 通常表示逻辑主语承受动作，或突出动作已经完成后的状态。','done normally marks passive voice or a state resulting from completion.'],
      ['having done 明确表示主动的非谓语动作先于谓语动作。','having done explicitly marks an active non-finite action earlier than the finite action.'],
      ['having been done 同时表达先发生与被动关系。','having been done combines anterior time with passive voice.']
    ],
    questions: [
      ['Walking home, she called me. 中 walking 与 she 是什么关系？','What is the relation between walking and she?',[['主动','Active'],['被动','Passive']],'A','she 主动执行 walking。','she actively performs walking.'],
      ['___ in 1920, the house is still strong.','___ in 1920, the house is still strong.',['Built','Building'],'A','house 承受 build。','The house receives the action.'],
      ['___ the task, he went home.','___ the task, he went home.',['Having finished','Finishing after'],'A','完成任务先于回家。','The finishing happened before going home.'],
      ['___, they became more careful. 表示“受过警告后”。','Which means “after they had been warned”?',['Having been warned','Having warned'],'A','既先发生又被动，用 having been done。','Use having been done for earlier passive action.']
    ]
  },
  {
    id: 'participle-attribute-predicative', level: 'core', title: ['分词作定语和表语','Participles as attributes and subject complements'], meta: ['修饰名词或描述状态与特征','Modifying nouns or describing states and characteristics'],
    examples: [
      [[['The girl','subject'],['wearing glasses','presentParticiple','现在分词短语作后置定语','Present-participle phrase as postmodifier'],['is','predicate'],['my cousin.','subjectComplement']], 'translation', 'wearing glasses 后置修饰 girl，中文通常译为“戴眼镜的女孩”。', 'wearing glasses follows girl but normally moves before 女孩 in Chinese.'],
      [[['The letters','subject'],['written by Amy','pastParticiple','过去分词短语作后置定语','Past-participle phrase as postmodifier'],['are','predicate'],['here.','adverbial']], 'translation', 'letters 承受 write；中文通常译为“艾米写的信”。', 'letters receives write; Chinese normally places the modifier before 信.'],
      [[['The film','subject'],['is','predicate'],['exciting.','presentParticiple','-ing 分词形容词作主语补语','-ing participial adjective as subject complement']], 'meaning', 'exciting 放在 is 后说明 film 具有“令人兴奋”的特征，不是进行时。', 'exciting follows is and describes the film as causing excitement; it is not part of a progressive verb phrase.'],
      [[['The audience','subject'],['was','predicate'],['excited.','pastParticiple','过去分词形容词作表语','Past-participial adjective as complement']], 'meaning', 'exciting 表示引发感受的特征；excited 表示感受到的状态。', 'exciting describes the cause; excited describes the experiencer’s state.']
    ],
    rules: [
      ['现在分词作定语通常与被修饰名词构成主动关系。','A present-participle modifier normally has an active relation with its noun.'],
      ['过去分词作定语通常与被修饰名词构成被动或完成关系。','A past-participle modifier normally has a passive or completed relation with its noun.'],
      ['-ing 分词形容词常描述引发感受的特征。','An -ing participial adjective commonly describes a quality that causes a feeling.'],
      ['-ed 分词形容词常描述人或事物所处的感受、影响状态。','An -ed participial adjective commonly describes the affected or experienced state.']
    ],
    questions: [
      ['the girl ___ glasses','the girl ___ glasses',['wearing','worn'],'A','girl 主动戴眼镜，用 wearing。','The girl actively wears the glasses.'],
      ['the letters ___ by Amy','the letters ___ by Amy',['written','writing'],'A','letters 承受 write，用 written。','The letters receive the writing.'],
      ['The film is ___.','The film is ___.',['exciting','excited'],'A','电影具有引发兴奋的特征。','The film causes excitement.'],
      ['The audience was ___.','The audience was ___.',['excited','exciting'],'A','观众处于感到兴奋的状态。','The audience experiences the feeling.']
    ]
  },
  {
    id: 'participle-adverbials', level: 'core', title: ['分词作状语','Participles as adverbials'], meta: ['时间、原因、条件、让步和伴随','Time, reason, condition, concession and accompanying action'],
    examples: [
      [[['Seeing the teacher','presentParticiple','原因状语','Reason adverbial'],['the students','subject'],['became','predicate'],['quiet.','subjectComplement']], 'transformation', '可理解为 Because they saw the teacher；逻辑主语是 students。', 'It corresponds to Because they saw the teacher; students is the logical subject.'],
      [[['Used carefully','pastParticiple','条件状语','Condition adverbial'],['the machine','subject'],['will last','predicate'],['longer.','adverbial']], 'transformation', '可理解为 If it is used carefully；machine 承受 use。', 'It corresponds to If it is used carefully; the machine receives use.'],
      [[['She','subject'],['sat','predicate'],['by the window','adverbial'],['reading a novel.','presentParticiple','伴随状语','Accompanying adverbial']], 'structure', 'reading 与 sat 同时，由 she 执行。', 'reading accompanies sat and is performed by she.'],
      [[['Although warned of the danger','pastParticiple','让步状语','Concessive adverbial'],['he','subject'],['continued','predicate'],['forward.','adverbial']], 'structure', '连词可保留以明确让步关系，he 承受 warning。', 'The conjunction may remain to clarify concession; he receives the warning.']
    ],
    rules: [
      ['分词短语可压缩原因或时间等状语从句，其逻辑主语通常与主句主语一致。','A participle phrase can reduce a reason or time clause; its logical subject normally matches the main subject.'],
      ['过去分词状语常表示被动条件或已形成状态。','A past-participle adverbial often expresses a passive condition or resulting state.'],
      ['现在分词可表示与谓语同时发生的伴随动作。','A present-participle phrase can express an accompanying action simultaneous with the finite action.'],
      ['为明确条件、让步或时间关系，可在分词前保留 when、if、although 等连词。','To clarify time, condition or concession, a conjunction such as when, if or although may remain before the participle.']
    ],
    questions: [
      ['Seeing the teacher, the students became quiet. 最接近哪一项？','Which is closest to “Seeing the teacher, the students became quiet”?',['Because they saw the teacher, ...','Because the teacher saw them, ...'],'A','students 是 seeing 的逻辑主语。','students is the logical subject of seeing.'],
      ['___ carefully, the machine will last longer.','___ carefully, the machine will last longer.',['Used','Using'],'A','machine 承受 use。','The machine receives the action.'],
      ['She sat by the window reading a novel. 中 reading 表示什么？','What does reading express in this sentence?',[['伴随动作','Accompanying action'],['宾语','Object']],'A','reading 与 sat 同时发生。','reading accompanies sat.'],
      ['___ warned of the danger, he continued forward.','___ warned of the danger, he continued forward.',['Although','Because of'],'A','Although 明确让步关系。','Although marks concession.']
    ]
  },
  {
    id: 'participle-object-complements', level: 'core', title: ['分词作宾语补语','Participles as object complements'], meta: ['看见正在做、保持状态、使事情完成','Seeing an action in progress, maintaining a state, or arranging completion'],
    examples: [
      [[['I','subject'],['saw','predicate'],['him','object'],['crossing the street.','presentParticiple','现在分词作宾补','Present participle as object complement']], 'structure', 'crossing 表示 him 正在执行的动作。', 'crossing presents the action in progress performed by him.'],
      [[['Please','adverbial'],['keep','predicate'],['the door','object'],['closed.','pastParticiple','过去分词作宾补','Past participle as object complement']], 'structure', 'door 承受 close，并保持关闭状态。', 'The door receives close and remains in the closed state.'],
      [[['She','subject'],['had','predicate'],['her hair','object'],['cut.','pastParticiple','过去分词作宾补','Past participle as object complement']], 'structure', '她安排别人剪头发，hair 承受 cut。', 'She arranged for someone to cut her hair; hair receives cut.']
    ],
    rules: [
      ['感官动词后用 doing 作宾补，常突出看到或听到动作正在进行的一段。','After a perception verb, doing as object complement often highlights an action in progress.'],
      ['keep、leave 等后可用 done 作宾补，表示宾语保持某种被动或结果状态。','keep or leave may take done as object complement, showing the object in a passive or resulting state.'],
      ['have/get + 宾语 + done 常表示安排某事被完成，或经历某事。','have/get + object + done commonly means arranging for something to be done or experiencing it.']
    ],
    questions: [
      ['I saw him ___ the street. 强调正在过马路。','I saw him ___ the street, emphasizing action in progress.',['crossing','crossed'],'A','him 主动执行且动作进行中。','him performs the ongoing action.'],
      ['Please keep the door ___.','Please keep the door ___.',['closed','closing'],'A','door 承受 close 并保持结果状态。','The door remains in the resulting state.'],
      ['She had her hair cut. 表示什么？','What does “She had her hair cut” mean?',[['她安排别人剪头发','She arranged for someone to cut her hair'],['她给别人剪头发','She cut someone else’s hair']],'A','her hair 是 cut 的承受者。','her hair receives the action of cut.']
    ]
  },
  {
    id: 'verb-complement-patterns', level: 'core', title: ['动词后的补足结构','Complement patterns after verbs'], meta: ['中心动词决定后面接 doing、to do 还是宾语＋to do','The head verb selects doing, to do, or object + to do'],
    examples: [
      [[['She','subject'],['avoided','predicate'],['answering the question.','gerund','动名词作宾语','Gerund as object']], 'structure', 'avoided 把后面的内容看作要避开的行为，因此 answering the question 用 doing 形式作宾语。', 'avoided presents its complement as the activity being avoided, so answering the question is a gerund object.'],
      [[['They','subject'],['agreed','predicate'],['to leave early.','infinitive','不定式作宾语','Infinitive as object']], 'structure', 'agreed 后的 to leave early 表示同意去实现的行动，整体作 agreed 的内容宾语。', 'to leave early presents the action agreed upon and functions as the content object of agreed.'],
      [[['We','subject'],['started','predicate'],['to work / working.','object','不定式或动名词作宾语','Infinitive or gerund as object']], 'meaning', 'start 在通常语境中两种形式都可，意义差别很小。', 'With start, both forms are normally possible with little difference in meaning.'],
      [[['She','subject'],['reminded','predicate'],['me','object'],['to call Dad.','infinitive','不定式作宾补','Infinitive as object complement']], 'structure', 'remind 不直接接 to do 表示同一主语行动，常用 remind somebody to do。', 'remind normally uses remind somebody to do, with the infinitive complementing the object.']
    ],
    rules: [
      ['avoid、enjoy、finish、mind、suggest 等常接 doing，不接 to do 作同类宾语。','avoid, enjoy, finish, mind and suggest commonly take doing, not to do, as this type of object.'],
      ['agree、decide、hope、plan、refuse 等常接 to do。','agree, decide, hope, plan and refuse commonly take to do.'],
      ['begin、start、continue 等通常可接 doing 或 to do，基本意义接近。','begin, start and continue normally allow doing or to do with similar basic meaning.'],
      ['ask、tell、want、remind 等常用“动词＋宾语＋to do”。','ask, tell, want and remind commonly use verb + object + to do.']
    ],
    questions: [
      ['She avoided ___ the question.','She avoided ___ the question.',['answering','to answer'],'A','avoid 后接 doing。','avoid takes doing.'],
      ['They agreed ___ early.','They agreed ___ early.',['to leave','leaving'],'A','agree 后选择 to do 作内容宾语。','agree selects to do as its content complement.'],
      ['We started ___. 哪项符合通常用法？','Which is normally possible after “We started”?',[['to work / working 都可以','Both to work and working'],['只能 to working','Only to working']],'A','start 可接两种形式。','start allows both forms.'],
      ['She reminded ___ Dad.','She reminded ___ Dad.',['me to call','to call me'],'A','使用 remind somebody to do。','Use remind somebody to do.']
    ]
  },
  {
    id: 'doing-to-do-meaning', level: 'advanced', title: ['doing 与 to do 的意义差异','Meaning contrasts between doing and to do'], meta: ['remember、stop、try、mean 等高频辨析','High-frequency contrasts with remember, stop, try and mean'],
    examples: [
      [[['I','subject'],['remember','predicate'],['locking the door.','gerund','动名词作宾语','Gerund as object']], 'meaning', 'remember doing 表示记得已经做过；比较 remember to lock 表示记得去做。', 'remember doing recalls a past action; remember to do means not forgetting a required action.'],
      [[['He','subject'],['stopped','predicate'],['smoking.','gerund','动名词作宾语','Gerund as object']], 'meaning', 'stop doing 表示停止该行为；stop to smoke 表示停下别的事去抽烟。', 'stop doing ends the activity; stop to do pauses another activity in order to do this one.'],
      [[['Try','predicate'],['restarting the computer.','gerund','动名词作宾语','Gerund as object']], 'meaning', 'try doing 表示试用一种办法；try to restart 表示努力完成重启。', 'try doing tests a method; try to do makes an effort to accomplish it.'],
      [[['This change','subject'],['means','predicate'],['working longer hours.','gerund','动名词作宾语','Gerund as object']], 'meaning', 'mean doing 表示意味着；mean to do 表示打算做。', 'mean doing means entail; mean to do means intend.']
    ],
    rules: [
      ['remember/forget doing 回顾已发生行为；remember/forget to do 指该做的行为是否完成。','remember/forget doing looks back at an action; remember/forget to do concerns whether a required action is performed.'],
      ['stop doing 是停止原行为；stop to do 是停下当前行为，转去做另一件事。','stop doing ends the original activity; stop to do pauses it in order to perform another.'],
      ['try doing 是试用办法；try to do 是努力完成目标。','try doing tests a method; try to do attempts to achieve a goal.'],
      ['mean doing 是“意味着”；mean to do 是“打算”。','mean doing means entail; mean to do means intend.']
    ],
    questions: [
      ['I remember ___ the door. 表示“记得已经锁过”。','I remember ___ the door, meaning I recall the completed action.',['locking','to lock'],'A','回顾已发生动作使用 doing。','Use doing to recall a past action.'],
      ['He stopped ___. 表示“戒烟”。','He stopped ___, meaning he quit the habit.',['smoking','to smoke'],'A','stop doing 表示停止该行为。','stop doing ends the activity.'],
      ['Try ___ the computer. 表示“试试重启这种办法”。','Try ___ the computer, meaning test restarting as a method.',['restarting','to restart'],'A','试用一种办法用 try doing；try to do 表示努力完成。','Use try doing to test a method; try to do means making an effort.'],
      ['This change means ___ longer hours.','This change means ___ longer hours.',['working','to work'],'A','这里 mean 表示“意味着”，选 doing；mean to do 才表示“打算”。','Here mean means entail, so use doing; mean to do means intend.']
    ]
  },
  {
    id: 'perception-causative', level: 'advanced', title: ['感官与使役结构','Perception and causative constructions'], meta: ['do、doing、done 的观察范围和语态关系','do, doing and done for event scope and voice'],
    examples: [
      [[['I','subject'],['saw','predicate'],['him','object'],['cross the road.','infinitive','省略 to 的宾补','Bare-infinitive object complement']], 'meaning', 'see somebody do 常把动作看作完整事件。', 'see somebody do commonly presents the event as a whole.'],
      [[['I','subject'],['saw','predicate'],['him','object'],['crossing the road.','presentParticiple','现在分词作宾补','Present-participle object complement']], 'meaning', 'see somebody doing 突出观察到动作正在进行的一段。', 'see somebody doing highlights the action in progress.'],
      [[['We','subject'],['heard','predicate'],['our names','object'],['called.','pastParticiple','过去分词作宾补','Past-participle object complement']], 'meaning', 'names 承受 call，用 done。', 'our names receives the action, so use done.'],
      [[['The joke','subject'],['made','predicate'],['everyone','object'],['laugh.','infinitive','省略 to 的宾补','Bare-infinitive object complement']], 'structure', '主动使役 make 表示促使宾语做某事，宾补用 do。', 'Active causative make causes the object to act and takes do.']
    ],
    rules: [
      ['感官动词＋宾语＋do 常把动作作为完整事件来感知。','A perception verb + object + do commonly presents the perceived action as a complete event.'],
      ['感官动词＋宾语＋doing 突出动作正在发生或被观察到的一段。','A perception verb + object + doing highlights an action in progress or part of it.'],
      ['感官动词＋宾语＋done 表示宾语承受动作或处于结果状态。','A perception verb + object + done shows the object receiving the action or in a resulting state.'],
      ['make/let/have＋宾语＋do 表示使、允许或安排宾语执行动作。','make/let/have + object + do expresses causing, allowing or arranging for the object to act.']
    ],
    questions: [
      ['I saw him ___ the road. 把过马路看作完整事件。','I saw him ___ the road, viewing the crossing as a whole event.',['cross','crossing'],'A','完整事件用 do；doing 突出动作正在进行的片段。','Use do for the whole event; doing highlights an action in progress.'],
      ['I saw him ___ the road. 强调当时正在进行。','I saw him ___ the road, emphasizing action in progress.',['crossing','crossed'],'A','进行中的片段用 doing。','Use doing for action in progress.'],
      ['We heard our names ___.','We heard our names ___.',['called','calling'],'A','names 承受 call。','our names receives the action.'],
      ['The joke made everyone ___.','The joke made everyone ___.',['laugh','to laugh'],'A','主动 make 后使用省略 to 的不定式。','Active make takes the bare infinitive.']
    ]
  },
  {
    id: 'absolute-with-construction', level: 'advanced', title: ['独立主格与 with 复合结构','Absolute and with-complex constructions'], meta: ['非谓语拥有自己的逻辑主语','A non-finite form with its own logical subject'],
    examples: [
      [[['The weather being fine','adverbial','独立主格作原因状语','Absolute construction as reason adverbial'],['we','subject'],['went','predicate'],['out.','adverbial']], 'transformation', 'weather 是 being 的逻辑主语，与主句主语 we 不同。', 'weather is the logical subject of being and differs from the main subject we.'],
      [[['All the work finished','adverbial','独立主格作时间状语','Absolute construction as time adverbial'],['they','subject'],['went','predicate'],['home.','adverbial']], 'transformation', 'work 承受 finish；整个结构相当于 after all the work was finished。', 'work receives finish; the construction corresponds to after all the work was finished.'],
      [[['She','subject'],['sat','predicate'],['with her eyes closed.','adverbial','with＋宾语＋过去分词作伴随状语','with + object + past participle as accompanying adverbial']], 'structure', 'eyes 是 closed 的逻辑对象，with 结构说明伴随状态。', 'eyes is the logical object of closed; the with construction gives an accompanying state.'],
      [[['He','subject'],['left','predicate'],['with the lights burning.','adverbial','with＋宾语＋现在分词作伴随状语','with + object + present participle as accompanying adverbial']], 'structure', 'lights 主动处于 burning 状态，使用 doing。', 'the lights is in the active burning state, so use doing.']
    ],
    rules: [
      ['独立主格由名词或代词加非谓语等成分构成，拥有不同于主句主语的逻辑主语。','An absolute construction contains a noun or pronoun plus a non-finite element and has its own logical subject.'],
      ['独立主格中 doing 表主动，done 表被动或完成，应按逻辑关系选择。','In an absolute construction, doing marks active meaning and done passive or completed meaning.'],
      ['with＋宾语＋done 可表示宾语所处的被动或结果状态。','with + object + done can express a passive or resulting state of the object.'],
      ['with＋宾语＋doing 可表示宾语主动进行或持续的伴随状态。','with + object + doing can express an active ongoing accompanying state.']
    ],
    questions: [
      ['The weather being fine, we went out. 中 being 的逻辑主语是什么？','What is the logical subject of being?',['the weather','we'],'A','独立主格自带逻辑主语 weather。','The absolute construction has weather as its own subject.'],
      ['All the work ___, they went home.','All the work ___, they went home.',['finished','finishing'],'A','work 承受 finish。','The work receives the action.'],
      ['She sat with her eyes ___.','She sat with her eyes ___.',['closed','closing'],'A','eyes 处于被闭合的结果状态。','The eyes are in the resulting closed state.'],
      ['He left with the lights ___.','He left with the lights ___.',['burning','burned'],'A','lights 与 burn 是主动、持续关系，用 doing。','lights has an active ongoing relation with burn, so use doing.']
    ]
  },
  {
    id: 'dangling-modifiers', level: 'advanced', title: ['避免悬垂非谓语','Avoiding dangling non-finite modifiers'], meta: ['非谓语的逻辑主语必须清楚','The logical subject must be clear'],
    examples: [
      [[['Walking to school','presentParticiple','时间或伴随状语','Time/accompanying adverbial'],['I','subject'],['saw','predicate'],['a rainbow.','object']], 'structure', 'I 同时是 walking 的逻辑主语，关系清楚。', 'I is also the logical subject of walking, so the relation is clear.'],
      [[['Walking to school','presentParticiple','悬垂状语','Dangling adverbial'],['the rain','subject'],['started.','predicate']], 'boundary', '表面上 rain 成了 walking 的执行者，逻辑错误。应改为 While I was walking to school, it started to rain。', 'The rain appears to perform walking. Rewrite with an explicit subject clause.'],
      [[['To improve your English','infinitive','目的状语','Purpose adverbial'],['you','subject'],['should practise','predicate'],['daily.','adverbial']], 'structure', 'you 同时是 improve 和 practise 的逻辑主语。', 'you is the logical subject of both improve and practise.']
    ],
    rules: [
      ['句首分词状语的逻辑主语通常必须与主句主语一致。','The logical subject of an initial participle adverbial normally must match the main-clause subject.'],
      ['若主句主语不可能执行非谓语动作，就形成悬垂修饰，应补出从句主语或改写。','If the main subject cannot perform the non-finite action, the modifier dangles and should be rewritten with an explicit subject.'],
      ['目的不定式的逻辑执行者通常也是主句主语；发布前需检查这一对应。','The understood agent of a purpose infinitive is normally the main subject; check this correspondence.']
    ],
    questions: [
      ['Walking to school, I saw a rainbow. 中谁在 walking？','Who is walking in “Walking to school, I saw a rainbow”?',['I','a rainbow'],'A','非谓语逻辑主语与主句主语 I 一致。','The logical subject matches I.'],
      ['Walking to school, the rain started. 有什么问题？','What is wrong with “Walking to school, the rain started”?',[[ 'rain 被错误地理解为 walking 的执行者','the rain is wrongly read as performing walking'],['rain 缺少宾语','rain lacks an object']],'A','这是悬垂分词。','This is a dangling participle.'],
      ['To improve your English, ___ should practise daily.','To improve your English, ___ should practise daily.',['you','the weather'],'A','主句主语应能执行 improve。','The main subject must be able to perform improve.']
    ]
  },
  {
    id: 'nonfinite-clause-conversion', level: 'advanced', title: ['非谓语与从句转换','Converting between non-finite structures and clauses'], meta: ['看逻辑主语、语态和时间再压缩','Check subject, voice and time before reducing'],
    examples: [
      [[['The man','subject'],['who is talking to Mia','attribute','定语从句','Relative clause'],['is','predicate'],['my uncle.','subjectComplement']], 'transformation', '主动且同时可压缩为 The man talking to Mia ...。', 'An active simultaneous relative clause can reduce to The man talking to Mia ....'],
      [[['The bridge','subject'],['which was built last year','attribute','定语从句','Relative clause'],['is','predicate'],['open.','subjectComplement']], 'transformation', '被动关系可压缩为 The bridge built last year ...。', 'A passive relative clause can reduce to The bridge built last year ....'],
      [[['After she had finished her work','adverbial','时间状语从句','Time clause'],['she','subject'],['went','predicate'],['home.','adverbial']], 'transformation', '从句与主句主语相同且动作先发生，可压缩为 Having finished her work, she went home。', 'With the same subject and earlier action, reduce to Having finished her work, she went home.'],
      [[['Because the weather was fine','adverbial','原因状语从句','Reason clause'],['we','subject'],['went','predicate'],['out.','adverbial']], 'transformation', '从句主语 weather 与主句主语 we 不同，不能直接写 Being fine, we went out；可用独立主格 The weather being fine。', 'Because weather differs from we, do not reduce to Being fine, we went out; use the absolute The weather being fine.']
    ],
    rules: [
      ['主动、同时的定语从句可在条件允许时压缩为 doing 短语。','An active simultaneous relative clause may reduce to a doing phrase when conditions allow.'],
      ['被动定语从句可压缩为 done 短语，但必须保留必要信息。','A passive relative clause may reduce to a done phrase, while necessary information remains.'],
      ['同主语且先发生的主动状语从句可压缩为 having done。','An active adverbial clause with the same subject and earlier action may reduce to having done.'],
      ['从句和主句主语不同时，不能直接省掉从句主语；应保留从句或使用独立主格。','When clause subjects differ, do not simply omit the subordinate subject; retain the clause or use an absolute construction.']
    ],
    questions: [
      ['the man who is talking to Mia 可压缩为什么？','How can “the man who is talking to Mia” be reduced?',['the man talking to Mia','the man talked to Mia'],'A','主动同时关系用 doing。','Use doing for active simultaneous meaning.'],
      ['the bridge which was built last year 可压缩为什么？','How can “the bridge which was built last year” be reduced?',['the bridge built last year','the bridge building last year'],'A','bridge 承受 build，用 done。','The bridge receives build, so use done.'],
      ['After she had finished her work, she went home. 可压缩为什么？','How can this clause be reduced?',['Having finished her work, she went home.','Finishing her work, she went home.'],'A','同主语且明确先发生，用 having done 保留时间关系。','Use having done to preserve the same-subject, earlier-time relation.'],
      ['Because the weather was fine, we went out. 哪种压缩正确？','Which reduction is correct?',['The weather being fine, we went out.','Being fine, we went out.'],'A','主语不同，要保留 weather 构成独立主格。','Different subjects require weather in an absolute construction.']
    ]
  },
  {
    id: 'nonfinite-integrated', level: 'advanced', title: ['非谓语综合辨析','Integrated non-finite analysis'], meta: ['形式、功能、语态、时间和逻辑主语一起判断','Combine form, function, voice, time and logical subject'],
    examples: [
      [[['Having been told the news','pastParticiple','完成被动分词短语作原因状语','Perfect passive participle as reason adverbial'],['she','subject'],['decided','predicate'],['to leave.','infinitive','不定式作宾语','Infinitive as object']], 'structure', 'she 先被告知，再决定离开；一句中两种非谓语承担不同功能。', 'She was told first and then decided to leave; the two non-finite forms have different functions.'],
      [[['The best way','subject'],['to solve the problem','infinitive','不定式短语作后置定语','Infinitive phrase as postmodifier'],['is','predicate'],['to ask for help.','infinitive','不定式作主语补语','Infinitive as subject complement']], 'translation', 'to solve 后置修饰 way，中文通常前移为“解决问题的最好方法”；句末不定式说明方法内容。', 'to solve postmodifies way; the final infinitive identifies the method.'],
      [[['Swimming','gerund','动名词作主语','Gerund as subject'],['is','predicate'],['fun,','subjectComplement'],['but','conjunction'],['the boy swimming nearby','subject','含现在分词后置定语的主语','Subject with present-participle postmodifier'],['is training.','predicate','进行时谓语','Progressive finite predicate']], 'structure', '第一个 Swimming 是动名词；第二个 swimming 是分词定语；is training 整体是进行时谓语。', 'The first Swimming is a gerund, the second swimming is a participial modifier, and is training is a progressive finite predicate.'],
      [[['Not knowing what to do','presentParticiple','否定分词短语作原因状语','Negative participle phrase as reason adverbial'],['Tom','subject'],['asked','predicate'],['for help.','object']], 'structure', 'not 放在 knowing 前；Tom 是 knowing 的逻辑主语。', 'not precedes knowing; Tom is the logical subject.']
    ],
    rules: [
      ['分析复杂句时要分别标出每个非谓语的形式、句法功能、语态与相对时间。','In a complex example, identify each non-finite form, syntactic function, voice and relative time separately.'],
      ['同一句可以出现多个不定式，但它们可能分别作定语、宾语或补语。','Several infinitives may occur in one sentence while serving different roles such as attribute, object or complement.'],
      ['doing 形式必须结合位置和功能区分动名词、现在分词及进行时组成部分。','A doing form must be classified from position and function as gerund, present participle or part of a progressive verb phrase.'],
      ['非谓语否定词通常置于非谓语结构之前，同时仍要核对逻辑主语。','Negation normally precedes the non-finite construction, and its logical subject must still be checked.']
    ],
    questions: [
      ['Having been told the news, she decided to leave. 中 Having been told 表示什么？','What does “Having been told” express?',[['先发生的被动动作','An earlier passive action'],['同时主动动作','A simultaneous active action']],'A','she 先承受 tell，再决定。','She receives tell before deciding.'],
      ['The best way to solve the problem is to ask for help. 中第一个不定式作什么？','What role does the first infinitive play?',[['后置定语','Postmodifier'],['限定谓语','Finite predicate']],'A','它后置修饰 way。','It postmodifies way.'],
      ['判断 Swimming/swimming/training 等 -ing 形式时，不能只看什么？','What must not be the sole basis for classifying Swimming, swimming and training?',[['只看 -ing 外形','The -ing shape alone'],['句法位置和关系','Syntactic position and relation']],'A','相同外形可能分别是动名词、分词或进行时组成部分。','The same shape may be a gerund, participle or part of a progressive predicate.'],
      ['___ what to do, Tom asked for help.','___ what to do, Tom asked for help.',['Not knowing','Knowing not'],'A','非谓语否定通常把 not 放在结构前。','Negation normally precedes the non-finite construction.']
    ]
  }
];

const NONFINITE_NARRATION_FRAMES = {
  'infinitive-forms': ['不定式不只有 to do 一种样子。动作要否定、要表达被动，或者要说明它比谓语动作更早、当时正在进行，都会在 to 后面增加不同层次。', '先确定不定式动作的否定、主动被动和时间关系，再从左到右搭形式。不要看到多个动词就分开翻，它们共同组成一个不定式结构。'],
  'infinitive-subject-predicative': ['把“学一门语言”“成为医生”当成一件事，它们就能像名词一样站在主语或表语的位置。不定式的动作意思还在，但外层工作变了。', '先找限定谓语，再看不定式整块放在哪个槽位。句首太长时可用 it 占位，把真正的不定式主语放到后面。'],
  'infinitive-object-attribute-complement': ['同样是 to do，放在不同位置会回答不同问题：想做什么、有什么事情要做，或者要求谁做什么。先看它依靠哪个中心词。', '判断时不要只标“不定式”。要继续问它补充动词、修饰名词，还是说明宾语要执行的动作；槽位不同，逻辑关系也不同。'],
  'infinitive-adverbials': ['有时 to do 不填主语或宾语，而是给前面的动作补一层原因：为什么去、最后发展成什么结果，或者为什么产生某种感受。', '先把句子主干读完整，再问不定式是在回答目的、结果还是评价原因。能准确回答这个问题，状语意义就不会混。'],
  'bare-infinitive': ['动词原形前不一定都要加 to。情态动词、某些使役结构和 help 会决定后面直接出现原形；结构改成被动时，to 还可能重新出现。', '先找前面的触发词，再决定用 do 还是 to do。主动改被动时要重新检查整个补足结构，不能只交换主语和宾语。'],
  'gerund-form-logical-subject': ['动名词可以把动作打包成“一件事”，同时仍能表达被动、完成以及动作是谁做的。重点不是只认 doing，而是看整块内部关系。', '先判断动作主动还是被动、是否早于谓语，再找它的逻辑主语。所有格放在 doing 前时，表示“某人做这件事”。'],
  'gerund-functions': ['动名词像一个带动作味道的名词短语，可以做主语、宾语、表语，也能放在介词后。判断它时先看外层位置，不要只看中文翻译。', '先找限定谓语和介词边界，再看 doing 整块占据哪个槽位。同样的 -ing 外形，只有结合位置才能确定是动名词。'],
  'participle-voice-time': ['分词常把一个附加动作压缩进句子。要读懂它，先问动作是谁做的、主语是主动还是承受，再比较它与谓语动作的先后。', 'doing 常见主动或同时，done 常见被动或结果，having done 强调更早完成；形式选择必须同时满足语态和时间。'],
  'participle-attribute-predicative': ['分词可以跟在名词后说明“哪一个”，也可以放在系动词后描述特征或感受。位置相似时，先看它在修饰谁。', '修饰名词时判断主动或被动；放在表语位置时再区分引发感受的特征和受到影响后的状态。不要把所有 be 加 -ing 都看成进行时。'],
  'participle-adverbials': ['分词短语放在句首或句尾，常把原因、条件、伴随或让步压缩成更紧凑的说明。省掉的主语必须能从主句里找到。', '先找主句主语，把它代回分词动作，再判断主动被动和逻辑关系。需要明确让步或条件时，连词可以保留。'],
  'participle-object-complements': ['有些分词不是修饰名词，而是跟在宾语后说明宾语正在做什么、处于什么状态，或被安排完成什么事情。', '先圈出宾语，再看宾语与分词动作的关系：主动进行常用 doing，被动或结果状态常用 done。'],
  'verb-complement-patterns': ['一个动词后面接 doing 还是 to do，常由前面的中心动词决定。与其背孤立中文，不如把中心动词和后面的结构一起观察。', '先找中心动词，再确认它允许的补足结构和意义。能两种都接时还要比较意思；需要宾语时，也不能把“谁去做”省掉。'],
  'doing-to-do-meaning': ['有些动词后接 doing 和 to do 都合语法，但意思会改变。差别通常来自把动作看成已经发生的经历，还是接下来要做的目标。', '先确定前一个动词在当前语境中的意思，再判断后面动作是已发生、停止的活动、尝试方法，还是计划目标。不要只背一个中文释义。'],
  'perception-causative': ['感官和使役结构会用 do、doing、done 展示不同画面：看到完整过程、看到正在进行的一段，或看到宾语承受动作。', '先找宾语和后面动作的关系，再看观察范围。主动完整用原形，主动进行用 doing，被动承受用 done；使役动词还决定是否带 to。'],
  'absolute-with-construction': ['普通分词状语借用主句主语；独立主格和 with 结构则自己带一个逻辑主语，像在主句旁边放了一幅独立小画面。', '先圈出结构内部的名词，再看它和 doing、done 或状态词的关系。它不抢主句谓语，只补充背景、状态或伴随情况。'],
  'dangling-modifiers': ['句首非谓语最怕“动作找错人”。读者会默认主句主语就是它的逻辑主语，如果两者对不上，就会出现悬垂修饰。', '检查时把主句主语放回非谓语动作里试读。意思不合理，就补出真正主语或改写主句，不能只靠中文语感放过。'],
  'nonfinite-clause-conversion': ['从句可以压缩成非谓语，让表达更紧凑，但前提是主语、主动被动和时间关系都能被准确恢复。不是见到 who 或 after 就直接删除。', '转换前先标从句主语和谓语；转换后再检查逻辑主语、语态与先后是否保留。任何一项不清楚，都应保留完整从句。'],
  'nonfinite-integrated': ['综合题里，to do、doing 和 done 不能只按外形分类。要把形式、句中位置、逻辑主语、主动被动和时间先后一起看。', '固定顺序是：先找限定谓语，再定非谓语边界；接着判断句中功能、逻辑主语、语态和时间。逐层回答，比直接翻译可靠。']
};

const NONFINITE_NARRATION_REPLACEMENTS = {
  'to be done': '“to be 加过去分词”',
  '可理解为 Because they saw the teacher': '可以还原成“学生看见老师后变得安静”，这里压缩的是原因关系',
  '可理解为 If it is used carefully': '可以还原成“机器如果被小心使用，就会更耐用”，这里压缩的是条件关系',
  'remind somebody to do': 'remind 后接宾语再接不定式',
  'remember to lock': '另一种 remember 结构',
  'stop to smoke': '另一种 stop 结构',
  'try to restart': '另一种 try 结构',
  'mean to do': '另一种 mean 结构',
  'see somebody do': '感官动词后接宾语和原形',
  'see somebody doing': '感官动词后接宾语和现在分词',
  'after all the work was finished': '对应的完整从句',
  'While I was walking to school': '补出真正主语后的时间从句',
  'it started to rain': '把 rain 改为真正主语后的表达',
  'The man talking to Mia': '压缩后的名词短语',
  'The bridge built last year': '压缩后的被动修饰结构',
  'Having finished her work': '压缩后的完成式分词结构',
  'The weather being fine': '带独立逻辑主语的结构'
};

const NONFINITE_NARRATION_NOTE_OVERRIDES = {
  '主动且同时可压缩为 The man talking to Mia ...。': 'who 引导的定语从句说明 man 主动交谈，而且动作与主句同时发生，因此可以缩成 doing 短语。',
  '被动关系可压缩为 The bridge built last year ...。': 'bridge 承受 build 这个动作，因此定语从句可以缩成过去分词短语。',
  '从句与主句主语相同且动作先发生，可压缩为 Having finished her work, she went home。': '从句和主句都是 she 做动作，而且完成工作更早发生，因此可用 having done 保留先后关系。',
  '从句主语 weather 与主句主语 we 不同，不能直接写 Being fine, we went out；可用独立主格 The weather being fine。': '从句主语是 weather，主句主语是 we，两者不同；压缩时必须保留 weather，组成独立主格，不能让 we 被误解为天气晴朗。'
};

function cleanNonfiniteNarrationNote(value) {
  if (NONFINITE_NARRATION_NOTE_OVERRIDES[value]) return NONFINITE_NARRATION_NOTE_OVERRIDES[value];
  return Object.keys(NONFINITE_NARRATION_REPLACEMENTS).reduce((text, source) => text.split(source).join(NONFINITE_NARRATION_REPLACEMENTS[source]), String(value || ''));
}

function attachNonfiniteNarrations(course) {
  const connectors = ['先看', '再看', '接着看', '最后看'];
  course.slice(1).forEach((item, courseIndex) => {
    const spec = specs[courseIndex + 1];
    const frame = NONFINITE_NARRATION_FRAMES[item.id];
    if (!spec || !frame || spec.examples.length !== item.examples.length) throw new Error(`Missing non-finite narration: ${item.id}`);
    const exampleText = item.examples.map((example, index) => `${connectors[index] || '接着看'}，${example}<#0.7#>${cleanNonfiniteNarrationNote(spec.examples[index][2])}`).join('<#0.8#>\n');
    const text = `${frame[0]}<#0.9#>\n${exampleText}<#0.9#>\n判断时不要只认 to、doing 或 done 的外形。先找全句限定谓语，再看这块内容放在哪个位置、动作由谁完成、主动还是被动，以及它和谓语动作谁先谁后。<#0.8#>\n${frame[1]}`;
    item.narration = {
      id: `nonfinite-system:${item.id}`,
      version: 'v1',
      text,
      lengthText: `${text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '').length} 字 · 约 2 分钟`
    };
  });
}

const sectionSpecs = [
  ['nonfinite-foundation','非谓语基础与形式','Foundations and forms','区分限定谓语，建立不定式、动名词和分词的形式系统。','Separate finite predicates and build the infinitive, gerund and participle form systems.',['finite-nonfinite-boundary','infinitive-forms','gerund-form-logical-subject','participle-voice-time']],
  ['infinitive-functions','不定式的句法功能','Infinitive functions','系统掌握不定式作主语、表语、宾语、定语、状语和宾补。','Master infinitives as subjects, complements, objects, attributes, adverbials and object complements.',['infinitive-subject-predicative','infinitive-object-attribute-complement','infinitive-adverbials','bare-infinitive']],
  ['gerund-participle-functions','动名词与分词的句法功能','Gerund and participle functions','覆盖动名词和分词在句中的主要位置。','Cover the major syntactic positions of gerunds and participles.',['gerund-functions','participle-attribute-predicative','participle-adverbials','participle-object-complements']],
  ['complementation-meaning','动词搭配与意义差异','Verb complementation and meaning','区分 doing、to do、do、done 的搭配限制和意义。','Distinguish the complementation and meanings of doing, to do, do and done.',['verb-complement-patterns','doing-to-do-meaning','perception-causative']],
  ['advanced-structures','复杂非谓语结构','Advanced non-finite structures','处理独立主格、with 复合结构和悬垂修饰。','Handle absolute constructions, with-complexes and dangling modifiers.',['absolute-with-construction','dangling-modifiers']],
  ['conversion-integration','从句转换与综合辨析','Clause reduction and integration','在边界条件下进行从句压缩并综合判断。','Reduce clauses under valid conditions and integrate all distinctions.',['nonfinite-clause-conversion','nonfinite-integrated']]
];

function buildNonfiniteSystemCourse(english) {
  const course = specs.map((spec, index) => makeLesson(english, spec, index));
  const ids = course.map((item) => item.id);
  const assigned = sectionSpecs.flatMap((item) => item[5]);
  if (ids.length !== assigned.length || new Set(assigned).size !== assigned.length || ids.some((id) => !assigned.includes(id)) || assigned.some((id) => !ids.includes(id))) throw new Error('Invalid non-finite section coverage');
  const sections = sectionSpecs.map((item) => ({ id: item[0], title: pick(english, item[1], item[2]), copy: pick(english, item[3], item[4]), lessonIds: item[5].slice(), lessonCount: item[5].length }));
  course[0].narration = {
    id: 'nonfinite-system:finite-nonfinite-boundary',
    version: 'v3',
    text: `一句话可以同时提到几个动作，但不能让每个动作都抢着管时间。通常只有一个动词负责告诉我们“现在还是过去”，其他动作会被打包成“一件事”或“一段说明”，放进句子的某个位置。这些被打包的动作，就叫非谓语。<#0.8#>
She wants to leave。<#0.8#>真正负责这句话时间的是 wants；如果时间改变，变化也落在 wants 上。to leave 只回答“她想做什么”，自己不负责设置主句时间。这种 to 加动词原形的样子，叫不定式。<#0.9#>
再看 Reading books helps me。<#0.8#>这句真正会随时间变化的是 helps。Reading books 表面上有动作，实际上整块在说“读书这件事”，它放在句首，做的是主语的工作。动作还在，但在外层句子里换了一份工作。<#0.9#>
The boy standing by the door is Tom。<#0.8#>这里的 standing by the door 是在告诉我们“哪个男孩”，所以它整体在修饰 boy。standing 这个动作是 boy 做的，boy 就是它意思上的执行者，准确术语叫逻辑主语。
判断时，先找出每个小句里真正负责时间的谓语；再圈出剩下的 to do、doing 或 done；最后问三件事：这整块在句中当什么，动作是谁做的，它和谓语动作谁先谁后。不要只数动词，要看每个动词正在做哪份工作。`,
    lengthText: '524 字 · 约 2 分钟'
  };
  attachNonfiniteNarrations(course);
  const core = course.filter((item) => item.level === 'core');
  const advanced = course.filter((item) => item.level === 'advanced');
  return {
    title: pick(english, `非谓语动词系统 · ${course.length} 节微课`, `Non-finite verb system · ${course.length} lessons`),
    copy: pick(english, '从形式和逻辑主语出发，系统掌握不定式、动名词、分词及复杂结构。', 'Start from form and logical subject to master infinitives, gerunds, participles and advanced constructions.'),
    course, sections,
    groups: [
      { id: 'core', title: pick(english, `核心必学 · ${core.length} 节`, `Core · ${core.length} essential lessons`), copy: pick(english, '非谓语的形式、主要功能和高频搭配。', 'Forms, major functions and high-frequency complementation.'), lessons: core },
      { id: 'advanced', title: pick(english, `进阶挑战 · ${advanced.length} 节`, `Advanced · ${advanced.length} challenge lessons`), copy: pick(english, '意义差异、复杂结构、错误边界和综合转换。', 'Meaning contrasts, advanced constructions, error boundaries and transformations.'), lessons: advanced }
    ]
  };
}

module.exports = { buildNonfiniteSystemCourse };
