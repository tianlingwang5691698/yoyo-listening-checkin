const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;

const roles = {
  subject: ['主语', 'Subject'], predicate: ['谓语动词', 'Predicate verb'], auxiliary: ['助动词', 'Auxiliary'],
  modal: ['情态动词', 'Modal verb'], object: ['宾语', 'Object'], directObject: ['直接宾语', 'Direct object'],
  indirectObject: ['间接宾语', 'Indirect object'], prepObject: ['介词宾语', 'Object of preposition'],
  preposition: ['介词', 'Preposition'],
  predicative: ['表语（主语补足语）', 'Predicative (subject complement)'], objectComplement: ['宾语补足语', 'Object complement'],
  subjectComplement: ['主语补足语', 'Subject complement'], attribute: ['定语', 'Attribute'], adverbial: ['状语', 'Adverbial'],
  apposition: ['同位语', 'Appositive'], conjunction: ['连词', 'Conjunction'], dummy: ['形式成分', 'Dummy element'],
  existential: ['存在句引导词', 'Existential marker'], clause: ['从句', 'Clause'], nonfinite: ['非谓语成分', 'Non-finite element']
};

const part = (english, text, role, zhLabel, enLabel) => ({
  text,
  role,
  label: pick(english, zhLabel || (roles[role] || [role, role])[0], enLabel || (roles[role] || [role, role])[1])
});

const hiddenNote = () => ({ visible: false, mode: '', title: '', body: '', detail: '' });
const note = (english, mode, zh, en) => mode ? {
  visible: true,
  mode,
  title: pick(english, mode === 'translation' ? '语序翻译' : '结构观察', mode === 'translation' ? 'Word-order translation' : 'Structure focus'),
  body: pick(english, zh, en),
  detail: ''
} : hiddenNote();

const question = (english, zhPrompt, enPrompt, aZh, aEn, bZh, bEn, answer, zhWhy, enWhy) => ({
  question: pick(english, zhPrompt, enPrompt),
  options: [
    { key: 'A', text: pick(english, aZh, aEn) },
    { key: 'B', text: pick(english, bZh, bEn) }
  ],
  answer,
  correct: pick(english, zhWhy, enWhy),
  wrong: pick(english, `再看规则：${zhWhy}`, `Check the rule: ${enWhy}`)
});

const atom = (ruleZh, ruleEn, parts, q, noteData) => ({ ruleZh, ruleEn, parts, q, noteData });

function makeLesson(english, id, level, zhTitle, enTitle, zhMeta, enMeta, atoms) {
  if (atoms.length < 3) throw new Error(`Each lesson needs at least three atomic rules: ${id}`);
  const examples = atoms.map((item) => item.parts.map((piece) => piece[0]).join(' '));
  const analyses = atoms.map((item) => item.parts.map((piece) => part(english, piece[0], piece[1], piece[2], piece[3])));
  const questions = atoms.map((item) => question(english, ...item.q));
  const rules = atoms.map((item) => pick(english, item.ruleZh, item.ruleEn));
  return {
    id,
    level,
    title: pick(english, zhTitle, enTitle),
    meta: pick(english, zhMeta, enMeta),
    examples,
    analyses,
    exampleNotes: atoms.map((item) => item.noteData ? note(english, ...item.noteData) : hiddenNote()),
    rules,
    ruleCoverage: INCLUDE_RULE_COVERAGE ? atoms.map((_, index) => ({ exampleIndexes: [index], questionIndexes: [index] })) : [],
    questions
  };
}

const Q = (zhPrompt, enPrompt, aZh, aEn, bZh, bEn, answer, zhWhy, enWhy) => [zhPrompt, enPrompt, aZh, aEn, bZh, bEn, answer, zhWhy, enWhy];
const T = (zh, en) => ['translation', zh, en];
const S = (zh, en) => ['structure', zh, en];

const exampleExplanations = {
  'element-levels': [
    ['Birds 是 fly 所陈述的对象，所以在本句作主语；“名词”只说明它属于什么词类。','Birds is what fly is about, so it is the subject here; “noun” only names its word class.'],
    ['不是 The、tall、boy 各占一个主语位置，而是整个 The tall boy 一起回答“谁笑了”。','The, tall and boy do not fill three subject slots; the whole phrase The tall boy answers “who smiled”.'],
    ['先把 What he said 框成一个从句；它整体位于 surprised 前，承担主语这一外层任务。','First bracket What he said as a clause; the whole clause precedes surprised and fills the outer subject slot.']
  ],
  subject: [
    ['虽然窗户不是“打破”动作的执行者，The window 仍是 was broken 所陈述的对象，因此是主语。','Although the window does not perform the breaking, The window is what was broken is about, so it is the subject.'],
    ['Reading aloud 表示“朗读这件事”，整段放在 helps 前作主语；aloud 只在短语内部说明 reading 的方式。','Reading aloud names an activity and the whole phrase is subject before helps; aloud only describes reading inside the phrase.'],
    ['主语名词短语的中心是单数 box；of old books 只回答“什么样的箱子”，所以谓语用 is。','The head of the subject noun phrase is singular box; of old books only identifies the box, so the verb is is.']
  ],
  'predicate-boundary': [
    ['has 承担现在时和完成体，finished 提供“完成”的实义；两者组成谓语动词组，her work 是它支配的宾语。','has carries present tense and perfect aspect, while finished supplies the lexical meaning; together they form the verb phrase, which governs her work.'],
    ['must 表示必要性，leave 表示动作；must leave 才是完整的谓语动词组，now 是另加的时间状语。','must expresses necessity and leave names the action; must leave is the full verb phrase, while now is a separate time adverbial.'],
    ['standing 不带本句时态，只后置修饰 girl；真正带现在时并连接主语与表语的是 is。','standing does not carry the clause tense and only modifies girl; is carries present tense and links the subject to its predicative.']
  ],
  'direct-object': [
    ['opened 表示一个作用到事物上的动作，the door 直接回答“打开了什么”，所以是直接宾语。','opened acts on something, and the door directly answers “opened what”, so it is the direct object.'],
    ['praised 后需要说明“表扬谁”，him 填入这个宾语位置，因此用宾格而不是 he。','praised needs an answer to “praised whom”; him fills that object slot, so the object form is required.'],
    ['enjoy 后面接的是“读故事这件事”；reading stories 内部有动作和宾语，整体却作 enjoy 的宾语。','enjoy takes the activity “reading stories”; the phrase has its own verb-object relation inside, but the whole phrase is the object of enjoy.']
  ],
  'indirect-object': [
    ['gave 建立“把物给人”的关系：me 是接收者，作间接宾语；a key 是被给予的事物，作直接宾语。','gave creates a transfer relation: me is the recipient and indirect object; a key is the transferred thing and direct object.'],
    ['a key 仍是 gave 的直接宾语；to 指向接收者，me 只在介词 to 后作介词宾语，不再是间接宾语。','a key remains the direct object of gave; to points to the recipient, and me is now the object of the preposition, not an indirect object.'],
    ['made 表示“为某人做某物”：us 是受益者，lunch 是做出来的事物，因此形成间接宾语加直接宾语。','made means “make something for someone”: us is the beneficiary and lunch is the thing made, forming indirect plus direct objects.']
  ],
  'preposition-object': [
    ['beside 建立位置关系，me 是这个关系的参照对象，因此作 beside 的介词宾语；beside me 整体作地点状语。','beside sets up a spatial relation and me is its reference point, so me is the prepositional object; beside me as a whole is a place adverbial.'],
    ['without 是介词，后面的 saying goodbye 整体作介词宾语；without saying goodbye 再整体说明 left 的伴随方式。','without is a preposition taking saying goodbye as its object; the whole phrase without saying goodbye then describes how he left.'],
    ['on 支配的不是一个词，而是完整从句 what you need；这个从句作介词宾语，on what you need 整体补足 depends。','on governs the whole clause what you need rather than one word; the clause is its object, and on what you need completes depends.']
  ],
  predicative: [
    ['is 不表示 Amy 做了什么，而是把 Amy 与身份 a doctor 连接起来，所以 a doctor 是表语。','is does not express an action by Amy; it links Amy with the identity a doctor, making a doctor the predicative.'],
    ['tastes 在这里表示“尝起来”，delicious 描写 soup 的性质；它回指主语，不是承受动作的宾语。','tastes means “has a taste” here, and delicious describes soup; it refers back to the subject rather than receiving an action.'],
    ['that we lack time 整体说明 problem 的具体内容，放在系动词 is 后占据表语位置。','The whole clause that we lack time states what the problem is and fills the predicative slot after is.']
  ],
  'object-complement': [
    ['elected 的宾语是 Mia，captain 再给 Mia 一个身份；可还原为“Mia 是 captain”，所以 captain 是宾补。','Mia is the object of elected, and captain gives Mia an identity; since “Mia is captain”, captain is the object complement.'],
    ['made 先作用于 us，happy 再说明 us 产生的状态；happy 补充的是宾语，不是动作方式。','made first affects us, and happy states the resulting state of us; it complements the object rather than describing the action’s manner.'],
    ['him 是 saw 的宾语，同时也是 cross 的逻辑主语；cross the road 说明 him 做了什么，因此作宾补。','him is the object of saw and the understood subject of cross; cross the road states what he did, so it is an object complement.']
  ],
  attributes: [
    ['bus 是主语名词短语的中心；The 限定范围，red 和 school 分别说明颜色和用途，都在中心词前作定语。','bus is the head of the subject noun phrase; The limits reference, while red and school describe colour and purpose before the head.'],
    ['with a red scarf 紧跟 girl 并回答“哪个女孩”，所以作后置定语；整个 The girl with a red scarf 才是主语。','with a red scarf follows girl and answers “which girl”, so it is a postmodifier; the whole noun phrase is the subject.'],
    ['that you lent me 跟在 book 后限定是哪一本书，整体作后置定语；从句内部 that 又是 lent 的直接宾语。','that you lent me follows book to identify which book and is a postmodifier as a whole; inside the clause, that is also the direct object of lent.']
  ],
  'adverbial-time-place-frequency': [
    ['主干 We met 已完整，after class 只补充“什么时候见面”，因此是时间状语。','The skeleton We met is complete; after class only adds when the meeting happened, so it is a time adverbial.'],
    ['football 是 play 的宾语，in the park 不回答“踢什么”，而回答“在哪里踢”，所以是地点状语。','football is the object of play; in the park answers “where”, not “what”, so it is a place adverbial.'],
    ['has visited 是谓语动词组，often 插在第一助动词 has 后，说明 visited 发生的频率。','has visited is the verb phrase; often appears after the first auxiliary has and states how frequently the visiting happens.']
  ],
  'adverbial-manner-degree': [
    ['the question 是 answered 的宾语，carefully 回答“怎样回答”，所以单独作方式状语。','the question is the object of answered, while carefully answers “how” and functions separately as a manner adverbial.'],
    ['cold 是说明 water 状态的表语，very 紧靠 cold 并调高其程度，所以是程度状语。','cold is the predicative describing water; very sits next to cold and raises its degree, so it is a degree adverbial.'],
    ['only 的位置把范围锁在 Mia：意思是“只有 Mia”，因此 Only Mia 整体占主语位置，only 在内部限定 Mia。','The position of only gives it scope over Mia: it means “Mia alone”, so Only Mia fills the subject slot while only focuses Mia internally.']
  ],
  'adverbial-cause-purpose-result': [
    ['the match stopped 是主干，Because of the rain 回答“为什么停”，所以整个介词短语作原因状语。','the match stopped is the skeleton; Because of the rain answers why it stopped, so the whole prepositional phrase is a cause adverbial.'],
    ['left 是谓语，early 是时间状语；to catch the bus 说明“早离开想达到什么目标”，因此另作目的状语。','left is the predicate verb and early is a time adverbial; to catch the bus states the intended goal and is a separate purpose adverbial.'],
    ['so tired 表示达到的程度，that he fell asleep 说出实际后果；整个 that 从句作结果状语。','so tired gives the degree, and that he fell asleep states the actual consequence; the whole that-clause is a result adverbial.']
  ],
  'adverbial-condition-concession-comment': [
    ['If you hurry 先给出 can catch the train 成立的条件，因此整个 if 从句作条件状语。','If you hurry supplies the condition under which can catch the train is true, so the whole if-clause is a condition adverbial.'],
    ['Although it was cold 承认“天气冷”，但主句仍说他们游泳了；这个反预期关系使 although 从句成为让步状语。','Although it was cold concedes the cold, yet the main clause says they still swam; this counter-expectation makes it a concession adverbial.'],
    ['everyone arrived safely 是事件本身，Fortunately 是说话者对整个事件的评价，因此是句子层面的评注状语。','everyone arrived safely states the event; Fortunately evaluates the whole event, so it is a sentence-level comment adverbial.']
  ],
  apposition: [
    ['Mr Li 与 our English teacher 指同一个人；后者不是另一个主语，而是给前者换一种说法的同位语。','Mr Li and our English teacher refer to the same person; the latter is not another subject but an appositive renaming the former.'],
    ['Paris 与 the capital of France 指同一地点，逗号表明后者只是附加解释，不负责限定是哪一个 Paris。','Paris and the capital of France name the same place; commas show that the latter adds information rather than identifying which Paris.'],
    ['that we won 说明 news 的具体内容，整体与 news 构成同位说明；that 在从句内部不充当主语或宾语。','that we won supplies the content of news and stands in apposition to it; that has no subject or object role inside the clause.']
  ],
  'dummy-it-subject': [
    ['真正被评价为 important 的是 to sleep well；it 只先占主语位置，让较长的不定式留在句尾。','What is important is to sleep well; it merely fills the subject slot so the longer infinitive can remain at the end.'],
    ['clear 评价的是 that he agrees 这件事；it 是形式主语，that 从句才承载真正内容。','clear evaluates the proposition that he agrees; it is the dummy subject, while the that-clause carries the real content.'],
    ['it 先占主语位置，to finish 表示真正耗时的事情；me 是经历者，an hour 是所需时长。','it fills the subject slot, while to finish names the activity that took time; me is the experiencer and an hour the duration.']
  ],
  'dummy-it-object': [
    ['find 先用 it 占宾语位置，useful 补充评价 it，句末 to review daily 才说明真正被评价的事情。','find uses it to fill the object slot, useful evaluates it, and to review daily at the end supplies the real content.'],
    ['made 后的 it 是形式宾语，clear 是宾补；that she disagreed 后置说明究竟什么被讲清楚。','it after made is the dummy object and clear is its complement; that she disagreed is postponed to state what was made clear.'],
    ['consider 后先放 it，再接宾补 necessary，最后用 that 从句给出真正宾语，避免长从句隔开动词与宾补。','consider places it before the complement necessary, then gives the real object in the that-clause, keeping the verb and complement together.']
  ],
  'existential-there': [
    ['There 只开启“有……”结构，a book 才是被介绍的后置主语，on the desk 才回答地点。','There only opens the existential construction; a book is the entity introduced as postposed subject, and on the desk gives the place.'],
    ['are 不与 there 一致，而与后置主语中心 reasons 一致；two reasons 是复数，所以用 are。','are does not agree with there but with the head reasons of the postposed subject; two reasons is plural, so are is used.'],
    ['这里 there 能具体回答“包在哪里”，有真实地点意义；它不是句首的存在句引导词。','Here there can answer “where is the bag” and has real locative meaning; it is not the clause-initial existential marker.']
  ],
  'subject-complement-passive': [
    ['主动说 They elected Mia captain 时 captain 补充 Mia；变成被动后 Mia 成为主语，captain 就转为主语补足语。','In active They elected Mia captain, captain complements Mia; once Mia becomes the passive subject, captain becomes a subject complement.'],
    ['主动句可说 someone saw him enter；him 变成被动主语 He 后，enter 前恢复 to，整个不定式作主语补足语。','The active can be someone saw him enter; when him becomes passive subject He, to returns before enter and the infinitive is a subject complement.'],
    ['was painted 是被动谓语，red 不表示另一动作，而说明主语 door 被漆后的结果状态，所以作主语补足语。','was painted is the passive predicate; red states the resulting state of subject door rather than another action, so it is a subject complement.']
  ],
  'nonfinite-elements': [
    ['to finish tonight 紧跟 report，说明“哪一份报告”，因此整体作后置定语；tonight 只在不定式内部修饰 finish。','to finish tonight follows report and identifies which report, so the whole phrase is a postmodifier; tonight modifies finish inside it.'],
    ['Learning a language 内部是“学习＋语言”，但整体表示一项活动，并位于 takes 前作主语。','Learning a language contains a verb-object relation internally, but the whole phrase names an activity and serves as subject before takes.'],
    ['Seen from above 的逻辑承受者是 the city，表示“从上方看时”；整个分词短语修饰主句，作视角状语。','The understood receiver of Seen from above is the city, meaning “when viewed from above”; the whole participle phrase is a viewpoint adverbial.']
  ],
  'clauses-as-elements': [
    ['why he left 表面含“为什么”，但它回答的是“我知道什么”，所以整个从句作 know 的宾语。','Although why he left contains “why”, it answers “what do I know”, so the whole clause is the object of know.'],
    ['who answered first 整体限定 student，作后置定语；进入从句内部，who 又是 answered 的主语。','who answered first as a whole modifies student; inside the clause, who is also the subject of answered.'],
    ['主句 We will start 已有主干，when everyone arrives 只说明开始的时间，因此整个从句作时间状语。','The main clause We will start already has its skeleton; when everyone arrives only states the starting time, so it is a time adverbial clause.']
  ],
  'coordination-sharing-ellipsis': [
    ['and 两边的 books 与 magazines 都回答“买了什么”，因此是同层级的并列直接宾语。','books and magazines on both sides of and each answer “bought what”, so they are coordinated direct objects at the same level.'],
    ['Tom and Mia 共同作两个动作：opened 和 checked 共享这个主语；两个谓语各自还有宾语 the box 和 it。','Tom and Mia jointly perform both actions, so opened and checked share the subject; each predicate has its own object, the box and it.'],
    ['分号两边结构平行，第二分句可补成 Tom likes coffee；Tom 是主语，coffee 是省略谓语 likes 的宾语。','The clauses are parallel, so the second expands to Tom likes coffee; Tom is subject and coffee is the object of the omitted likes.']
  ],
  'nested-analysis': [
    ['先看外层：The teacher—said—宾语从句；从句内部另有 the test—was—easy，不能把 was 当主句谓语。','At the outer level, the pattern is The teacher—said—object clause; inside it is the test—was—easy, so was is not the main predicate.'],
    ['The book that you recommended 整体作主语；在这个大成分内部，that you recommended 只后置修饰中心词 book。','The book that you recommended is the whole subject; inside that larger element, that you recommended only postmodifies head book.'],
    ['in the library 紧跟 students 并限定“哪些学生”，所以作后置定语；quietly 才直接说明 read 的方式。','in the library follows students and identifies which students, so it is a postmodifier; quietly directly describes the manner of read.']
  ],
  'integrated-analysis': [
    ['先取主干 My brother Tom—sent—me—a photo，再把 Tom 看作 brother 的同位说明，把 yesterday 挂到 sent 上作时间状语。','First take the skeleton My brother Tom—sent—me—a photo; then read Tom as apposition to brother and attach yesterday to sent as a time adverbial.'],
    ['explained 直接支配 the result；to 引出接收解释的人 us，clearly 说明解释的方式，三个部分不能合并成一个宾语。','explained directly governs the result; to introduces recipient us, and clearly gives the manner, so the three parts must not be merged as one object.'],
    ['with a telescope 可跟 man 组成宾语内部的后置定语，也可单独修饰 saw 表示工具；没有语境时应保留两种层级分析。','with a telescope may form a postmodifier inside the object with man, or separately modify saw as an instrument; without context, both analyses remain possible.']
  ]
};

function buildSentenceElementsCourse(english) {
  const L = (...args) => makeLesson(english, ...args);
  const lessons = [
    L('element-levels','core','句子成分的定义与本质','Definition and core of sentence elements','语言单位在具体句子中承担什么任务','What job a unit performs in a particular sentence',[
      atom('句子成分是词、短语或从句在具体句子中承担的任务；词性只说明词本身是什么。','A sentence element is the job a word, phrase or clause performs in a particular sentence; word class only says what the word itself is.',[['Birds','subject'],['fly.','predicate']],Q('Birds 在句中是什么成分？','What element is Birds?','主语','Subject','名词词性','Noun word class','A','题目问句中任务，应答主语。','The question asks for its sentence role: subject.')),
      atom('一个短语可以整体充当一个成分，分析时先划出完整边界。','A phrase can fill one element; identify its full boundary first.',[['The tall boy','subject','名词短语作主语','Noun phrase as subject'],['smiled.','predicate']],Q('The tall boy 应整体分析为什么？','How should The tall boy be analysed?','主语','Subject','三个独立主语','Three separate subjects','A','整个名词短语共同作主语。','The whole noun phrase is the subject.')),
      atom('一个从句也可以整体充当主语、宾语、表语、定语或状语。','A clause can function as subject, object, predicative, attribute or adverbial.',[['What he said','clause','主语从句','Subject clause'],['surprised','predicate'],['me.','directObject']],Q('What he said 整体是什么成分？','What element is What he said as a whole?','主语','Subject','宾语','Object','A','该从句位于谓语 surprised 前并触发动作。','The clause precedes surprised and functions as its subject.'))
    ]),
    L('subject','core','找到真正的主语','Finding the true subject','谁或什么是谓语陈述的对象','What the predicate is about',[
      atom('主语是谓语所陈述的对象，不一定表示动作执行者。','The subject is what the predicate is about; it is not always an agent.',[['The window','subject'],['was','auxiliary','被动助动词','Passive auxiliary'],['broken.','predicate','谓语动词（过去分词）','Lexical verb (past participle)']],Q('The window 在被动句中仍是什么？','What is The window in the passive sentence?','主语','Subject','宾语','Object','A','主语由句法位置和谓语关系判断，不只看施事。','Subjecthood depends on syntax, not only agency.')),
      atom('主语可以是名词短语、代词、非谓语结构或从句。','A subject may be a noun phrase, pronoun, non-finite structure or clause.',[['Reading aloud','nonfinite','动名词短语作主语','Gerund phrase as subject'],['helps.','predicate']],Q('Reading aloud 整体是什么成分？','What is Reading aloud as a whole?','主语','Subject','时间状语','Time adverbial','A','动名词短语在谓语前作主语。','The gerund phrase is the subject before the predicate.')),
      atom('主语内部的定语不改变中心词的单复数判断。','A modifier inside the subject does not change the number of its head.',[['The box','subject','主语中心部分','Subject head'],['of old books','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','predicate','系动词','Linking verb'],['heavy.','predicative']],Q('决定 is 的主语中心词是什么？','Which subject head controls is?','box','box','books','books','A','of old books 修饰 box，中心词仍是单数 box。','of old books modifies box; the head remains singular box.'),T('英语后置的 of old books 中文通常前移为“装旧书的箱子”。','The postmodifier of old books normally moves before 箱子 in Chinese.'))
    ]),
    L('predicate-boundary','core','谓语动词与完整谓语','Predicate verb and complete predicate','先找限定动词，再看谓语范围','Find the finite verb, then the full predicate',[
      atom('谓语动词组以带时态或情态的限定成分为核心；完整谓语还可包含宾语、补足语和状语。','The predicate verb phrase centres on a finite or modal element; the full predicate may also contain objects, complements and adverbials.',[['Mia','subject'],['has','auxiliary'],['finished','predicate','谓语动词（过去分词）','Lexical verb (past participle)'],['her work.','directObject']],Q('has finished 中承担完成体结构的是哪一整体？','Which whole forms the perfect construction?','has finished','has finished','finished 单独','finished alone','A','完整谓语动词组包含助动词 has 和实义动词 finished。','The verb phrase contains auxiliary has and lexical verb finished.')),
      atom('情态动词与后面的动词原形共同构成谓语动词组。','A modal and following base verb form the predicate verb phrase together.',[['You','subject'],['must','modal'],['leave','predicate'],['now.','adverbial','时间状语','Time adverbial']],Q('完整谓语动词组是什么？','What is the complete predicate verb phrase?','must leave','must leave','leave now','leave now','A','must 是情态动词，和 leave 共同构成谓语核心。','must and leave form the verbal core.')),
      atom('非谓语形式本身不能独立充当句子的限定谓语。','A non-finite form cannot by itself serve as the finite predicate of an independent clause.',[['The girl','subject'],['standing by the door','attribute','现在分词短语作后置定语','Present-participle phrase as postmodifier'],['is','predicate','系动词','Linking verb'],['my sister.','predicative']],Q('本句的限定谓语动词是什么？','What is the finite predicate verb?','standing','standing','is','is','B','standing 是后置定语，is 才带时态。','standing is a postmodifier; is carries tense.'),T('standing by the door 后置修饰 girl，中文通常前移为“站在门边的女孩”。','standing by the door follows girl but normally moves before 女孩 in Chinese.'))
    ]),
    L('direct-object','core','直接宾语','Direct objects','动作直接涉及的人或事物','The person or thing directly affected',[
      atom('及物动词后直接承受动作的名词短语通常作直接宾语。','A noun phrase directly affected by a transitive verb normally serves as direct object.',[['Leo','subject'],['opened','predicate'],['the door.','directObject']],Q('the door 是什么成分？','What element is the door?','直接宾语','Direct object','表语','Predicative','A','它直接承受 opened 的动作。','It is directly affected by opened.')),
      atom('代词作宾语时使用宾格形式。','Use the object form of a personal pronoun as object.',[['The teacher','subject'],['praised','predicate'],['him.','directObject']],Q('The teacher praised ___ .','The teacher praised ___ .','he','he','him','him','B','praised 后作宾语用宾格 him。','Use object-form him after praised.')),
      atom('宾语可以由非谓语结构或宾语从句充当。','A non-finite structure or object clause can function as object.',[['We','subject'],['enjoy','predicate'],['reading stories.','nonfinite','动名词短语作宾语','Gerund phrase as object']],Q('reading stories 整体是什么成分？','What is reading stories as a whole?','宾语','Object','谓语','Predicate','A','它是 enjoy 的宾语。','It is the object of enjoy.'))
    ]),
    L('indirect-object','core','间接宾语与双宾语','Indirect and double objects','接收者与事物的双重关系','Recipient and transferred thing',[
      atom('双宾语结构通常是“动词＋间接宾语（人）＋直接宾语（物）”。','The double-object pattern is normally verb + indirect object (recipient) + direct object (thing).',[['Dad','subject'],['gave','predicate'],['me','indirectObject'],['a key.','directObject']],Q('me 是什么成分？','What element is me?','间接宾语','Indirect object','直接宾语','Direct object','A','me 是接收钥匙的人。','me is the recipient of the key.')),
      atom('give/send/show 等常可改为“物＋to＋人”。','With give, send, show and similar verbs, the alternative is often thing + to + recipient.',[['Dad','subject'],['gave','predicate'],['a key','directObject'],['to','preposition'],['me.','prepObject']],Q('give me a key 可改为什么？','Which restates give me a key?','give a key to me','give a key to me','give to me a key','give to me a key','A','直接宾语先出现时，接收者用 to 引出。','With the thing first, to introduces the recipient.')),
      atom('buy/make/cook 等表示“为某人”时，转换结构通常用 for。','With buy, make and cook meaning “for someone”, the alternative normally uses for.',[['Mum','subject'],['made','predicate'],['us','indirectObject'],['lunch.','directObject']],Q('made us lunch 可改为什么？','Which restates made us lunch?','made lunch for us','made lunch for us','made lunch to us','made lunch to us','A','受益者用 for 引出。','for introduces the beneficiary.'))
    ]),
    L('preposition-object','core','介词宾语','Objects of prepositions','介词后面的完整支配成分','The full complement governed by a preposition',[
      atom('介词后面的名词短语或代词是介词宾语，介词与宾语共同构成介词短语。','A noun phrase or pronoun after a preposition is its object; together they form a prepositional phrase.',[['She','subject'],['sat','predicate'],['beside','preposition'],['me.','prepObject']],Q('beside me 中 me 是什么？','What is me in beside me?','介词宾语','Object of preposition','间接宾语','Indirect object','A','me 受介词 beside 支配。','me is governed by beside.')),
      atom('介词宾语可以是动名词短语。','A gerund phrase can serve as object of a preposition.',[['He','subject'],['left','predicate'],['without','preposition'],['saying goodbye.','prepObject','动名词短语作介词宾语','Gerund phrase as object of preposition']],Q('without 后为什么用 saying？','Why is saying used after without?','介词后用动名词形式','A gerund follows a preposition','它是限定谓语','It is a finite predicate','A','without 是介词，后接动名词短语。','without is a preposition taking a gerund phrase.')),
      atom('介词宾语也可以是疑问词引导的从句。','An interrogative clause can also be the object of a preposition.',[['The choice','subject'],['depends','predicate'],['on','preposition'],['what you need.','prepObject','从句作介词宾语','Clause as object of preposition']],Q('what you need 在 on 后整体是什么？','What is what you need after on?','介词宾语','Object of preposition','主语','Subject','A','整个从句受介词 on 支配。','The whole clause is governed by on.'))
    ]),
    L('predicative','core','表语','Predicatives','说明主语身份、性质或状态','Identifying or describing the subject',[
      atom('表语位于系动词后，说明主语“是什么”或“怎么样”。','A predicative follows a linking verb and identifies or describes the subject.',[['Amy','subject'],['is','predicate','系动词','Linking verb'],['a doctor.','predicative']],Q('a doctor 是什么成分？','What element is a doctor?','表语','Predicative','宾语','Object','A','is 在此连接主语与身份，不表示动作。','is links the subject to its identity rather than expressing an action.')),
      atom('感官或变化系动词后也接表语，不接动作宾语。','Sensory and change-of-state linking verbs also take predicatives, not action objects.',[['The soup','subject'],['tastes','predicate','系动词','Linking verb'],['delicious.','predicative']],Q('delicious 为什么不是宾语？','Why is delicious not an object?','它说明主语状态','It describes the subject','它承受动作','It receives an action','A','tastes 是系动词，delicious 回指并说明 soup。','tastes is linking; delicious describes soup.')),
      atom('名词、形容词、介词短语、非谓语结构或从句都可作表语。','A noun, adjective, prepositional phrase, non-finite structure or clause may serve as predicative.',[['The problem','subject'],['is','predicate','系动词','Linking verb'],['that we lack time.','clause','表语从句','Predicative clause']],Q('that we lack time 整体是什么？','What is that we lack time as a whole?','表语','Predicative','定语','Attribute','A','它位于 is 后说明 problem 的具体内容。','It follows is and states what the problem is.'))
    ]),
    L('object-complement','core','宾语补足语','Object complements','补充说明宾语的身份或状态','Completing the description of the object',[
      atom('宾语补足语与宾语构成“宾语＋是什么/怎么样”的关系。','An object complement forms an object + identity/state relation with the object.',[['They','subject'],['elected','predicate'],['Mia','directObject'],['captain.','objectComplement']],Q('captain 补充说明谁？','Whom does captain describe?','Mia','Mia','They','They','A','Mia = captain，因此 captain 是宾补。','Mia = captain, so captain is an object complement.')),
      atom('形容词可作宾补，描述动作造成或发现的宾语状态。','An adjective can be an object complement describing the object’s resulting or perceived state.',[['The news','subject'],['made','predicate'],['us','directObject'],['happy.','objectComplement']],Q('happy 是什么成分？','What element is happy?','宾语补足语','Object complement','方式状语','Manner adverbial','A','happy 说明 us 的状态。','happy describes the state of us.')),
      atom('不定式或分词可作宾补，说明宾语所做或承受的动作。','An infinitive or participle can be an object complement describing an action done or undergone by the object.',[['I','subject'],['saw','predicate'],['him','directObject'],['cross the road.','objectComplement','省略 to 的不定式作宾补','Bare infinitive as object complement']],Q('cross the road 与 him 是什么关系？','How does cross the road relate to him?','说明 him 做的动作','It states the action done by him','修饰 saw 的方式','It modifies the manner of saw','A','him 是 cross 的逻辑主语。','him is the understood subject of cross.'))
    ]),
    L('attributes','core','前置与后置定语','Pre- and postmodifiers','定语修饰名词，位置取决于结构长度','Modifiers describe nouns; position depends on structure',[
      atom('单个形容词、限定词或名词作定语时通常位于中心名词前。','A single adjective, determiner or noun modifier normally precedes the head noun.',[['The','attribute','限定词作前置定语','Determiner as premodifier'],['red','attribute','形容词作前置定语','Adjective as premodifier'],['school','attribute','名词作前置定语','Noun as premodifier'],['bus','subject','主语中心词','Subject head'],['stopped.','predicate']],Q('red 在 red school bus 中是什么？','What is red in red school bus?','前置定语','Premodifier','表语','Predicative','A','red 位于中心名词前修饰 bus。','red precedes and modifies the head bus.')),
      atom('介词短语和较长的非谓语短语作定语时通常位于中心名词后。','A prepositional phrase or longer non-finite modifier normally follows the head noun.',[['The girl','subject'],['with a red scarf','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','predicate'],['Mia.','predicative']],Q('with a red scarf 修饰什么？','What does with a red scarf modify?','girl','girl','is','is','A','它紧跟 girl 并回答“哪个女孩”。','It follows girl and answers “which girl”.'),T('英语说“女孩＋戴红围巾的”，中文通常前移为“戴红围巾的女孩”。','English places with a red scarf after girl; Chinese normally places the modifier before 女孩.')),
      atom('关系从句作定语时位于先行词后，并在从句内部承担成分。','A relative clause follows its antecedent, and the relative word has a role inside the clause.',[['The book','subject'],['that you lent me','attribute','定语从句','Relative clause'],['is','predicate'],['useful.','predicative']],Q('that you lent me 整体是什么成分？','What is that you lent me as a whole?','后置定语','Postmodifier','宾语','Object','A','整个关系从句修饰 book。','The whole relative clause modifies book.'),T('英语定语从句后置，中文通常译为“你借给我的书”。','The English relative clause follows book; Chinese normally moves it before 书.'))
    ]),
    L('adverbial-time-place-frequency','core','时间、地点与频率状语','Time, place and frequency adverbials','说明何时、何地和多常发生','When, where and how often',[
      atom('时间状语说明动作发生的时间、时段或持续长度，位置较灵活。','A time adverbial gives a point, period or duration and has relatively flexible position.',[['We','subject'],['met','predicate'],['after class.','adverbial','时间状语','Time adverbial']],Q('after class 回答什么问题？','What question does after class answer?','什么时候','When','在哪里','Where','A','它说明 met 的时间。','It gives the time of met.')),
      atom('地点状语说明动作发生或状态存在的位置，常置于谓语及宾语之后。','A place adverbial gives the location of an action or state and often follows the verb and object.',[['They','subject'],['play','predicate'],['football','directObject'],['in the park.','adverbial','地点状语','Place adverbial']],Q('in the park 是什么？','What is in the park?','地点状语','Place adverbial','后置定语','Postmodifier','A','它修饰 play，说明踢球地点。','It modifies play and gives its location.')),
      atom('一般频率副词常位于实义动词前、be 动词后、第一助动词后。','Frequency adverbs normally precede a lexical verb, follow be, or follow the first auxiliary.',[['She','subject'],['has','auxiliary'],['often','adverbial','频率状语','Frequency adverbial'],['visited','predicate'],['us.','directObject']],Q('often 在完成时结构中通常放在哪里？','Where does often normally go in a perfect construction?','has 后、visited 前','After has and before visited','句末只能放','Only at the end','A','频率副词通常位于第一助动词后。','A frequency adverb normally follows the first auxiliary.'),S('频率副词的位置受谓语结构影响，不机械照搬中文位置。','The position of a frequency adverb depends on the verb phrase, not mechanical Chinese order.'))
    ]),
    L('adverbial-manner-degree','core','方式、程度与范围状语','Manner, degree and scope adverbials','说明怎样、到什么程度、影响哪一部分','How, to what degree and over what scope',[
      atom('方式状语说明动作怎样进行，通常位于动词宾语之后。','A manner adverbial says how an action happens and normally follows the verb’s object.',[['Mia','subject'],['answered','predicate'],['the question','directObject'],['carefully.','adverbial','方式状语','Manner adverbial']],Q('carefully 最直接修饰什么？','What does carefully most directly modify?','answered','answered','question','question','A','它说明回答的方式。','It gives the manner of answering.')),
      atom('程度状语修饰形容词、副词或某些动词，通常紧靠被修饰项。','A degree adverbial modifies an adjective, adverb or certain verb and normally stays close to it.',[['The water','subject'],['is','predicate'],['very','adverbial','程度状语；修饰形容词','Degree adverbial modifying adjective'],['cold.','predicative']],Q('very 修饰什么？','What does very modify?','cold','cold','is','is','A','very 表示 cold 的程度。','very gives the degree of cold.')),
      atom('only、also、even 等焦点状语的位置会改变其作用范围和句意。','The position of focus adverbials such as only, also and even changes their scope and meaning.',[['Only Mia','subject','only 限定主语 Mia','Subject focused by only'],['solved','predicate'],['the problem.','directObject']],Q('Only Mia solved the problem 强调什么？','What does Only Mia solved the problem emphasize?','只有 Mia 做到了','Mia alone did it','Mia 只解决而没检查','Mia only solved rather than checked','A','only 紧靠 Mia，作用范围是主语。','only is adjacent to Mia, so its scope is the subject.'))
    ]),
    L('adverbial-cause-purpose-result','core','原因、目的与结果状语','Cause, purpose and result adverbials','区分为什么做、为了什么做、最终怎样','Why, for what aim, and with what result',[
      atom('原因状语回答“为什么”，可由介词短语、非谓语结构或从句表达。','A cause adverbial answers why and may be a phrase, non-finite structure or clause.',[['Because of the rain,','adverbial','原因状语','Cause adverbial'],['the match','subject'],['stopped.','predicate']],Q('Because of the rain 表示什么逻辑？','What relation does Because of the rain express?','原因','Cause','目的','Purpose','A','它说明比赛停止的原因。','It states why the match stopped.')),
      atom('目的状语说明做某事想达到的目标，常用 to do、in order to 或 so that 从句。','A purpose adverbial states an intended goal, often with to do, in order to or a so that clause.',[['She','subject'],['left','predicate'],['early','adverbial','时间状语','Time adverbial'],['to catch the bus.','adverbial','目的状语','Purpose adverbial']],Q('to catch the bus 是什么状语？','What kind of adverbial is to catch the bus?','目的状语','Purpose adverbial','结果状语','Result adverbial','A','它说明提前离开的目标。','It states the intended goal of leaving early.')),
      atom('结果状语说明实际产生的后果，常见 so...that、such...that 或 only to do。','A result adverbial states an actual consequence, often with so...that, such...that or only to do.',[['He','subject'],['was','predicate','系动词','Linking verb'],['so','adverbial','程度状语','Degree adverbial'],['tired','predicative'],['that he fell asleep.','adverbial','结果状语从句','Result adverbial clause']],Q('that he fell asleep 表示什么？','What does that he fell asleep express?','实际结果','Actual result','预期目的','Intended purpose','A','入睡是疲惫造成的结果。','Falling asleep is the consequence of being tired.'))
    ]),
    L('adverbial-condition-concession-comment','core','条件、让步与评注状语','Condition, concession and comment adverbials','建立条件、反预期和说话者态度','Condition, counter-expectation and speaker stance',[
      atom('条件状语说明主句成立所依赖的条件。','A condition adverbial states what the main clause depends on.',[['If you hurry,','adverbial','条件状语从句','Condition adverbial clause'],['you','subject'],['can','modal'],['catch','predicate'],['the train.','directObject']],Q('If you hurry 与主句是什么关系？','How does If you hurry relate to the main clause?','条件','Condition','原因','Cause','A','赶快是赶上火车的条件。','Hurrying is the condition for catching the train.')),
      atom('让步状语承认一个事实，但主句结果与通常预期相反。','A concession adverbial acknowledges a fact while the main result counters expectation.',[['Although it was cold,','adverbial','让步状语从句','Concession adverbial clause'],['they','subject'],['swam.','predicate']],Q('Although it was cold 表示什么？','What does Although it was cold express?','让步','Concession','目的','Purpose','A','寒冷通常阻止游泳，但实际仍去，形成反预期。','Cold would normally prevent swimming, yet they went.')),
      atom('评注性状语表达说话者对整句内容的判断或态度。','A comment adverbial expresses the speaker’s judgment or attitude toward the whole clause.',[['Fortunately,','adverbial','评注性句子状语','Comment sentence adverbial'],['everyone','subject'],['arrived','predicate'],['safely.','adverbial','方式状语','Manner adverbial']],Q('Fortunately 修饰的范围是什么？','What is the scope of Fortunately?','整个句子','The whole clause','只修饰 arrived','Only arrived','A','它评价“大家安全到达”这一整体事实。','It evaluates the whole proposition that everyone arrived safely.'))
    ]),
    L('apposition','core','同位语','Apposition','用另一名称解释同一个人或事物','A second expression identifying the same referent',[
      atom('同位语与前面的名词指向同一对象，用来重命名或解释。','An appositive refers to the same entity as the preceding noun and renames or explains it.',[['Mr Li,','subject'],['our English teacher,','apposition'],['is','auxiliary'],['speaking.','predicate']],Q('our English teacher 与 Mr Li 是什么关系？','How does our English teacher relate to Mr Li?','同位关系','Apposition','主谓关系','Subject-predicate relation','A','两者指同一个人。','Both expressions refer to the same person.')),
      atom('非限制性同位语是附加说明，书写时通常用逗号隔开。','A non-restrictive appositive adds extra information and is normally set off by commas.',[['Paris,','subject'],['the capital of France,','apposition'],['attracts','predicate'],['tourists.','directObject']],Q('为什么 the capital of France 两边用逗号？','Why is the capital of France set off by commas?','它是附加同位说明','It is extra appositive information','它是必要宾语','It is a required object','A','删去后主干 Paris attracts tourists 仍完整。','The core Paris attracts tourists remains complete without it.')),
      atom('that 引导的同位语从句说明抽象名词的具体内容，不在从句内充当成分。','An appositive that-clause gives the content of an abstract noun; that has no role inside it.',[['The news','subject'],['that we won','apposition','同位语从句','Appositive clause'],['is','predicate','系动词','Linking verb'],['true.','predicative']],Q('that we won 说明什么？','What does that we won specify?','news 的具体内容','The content of news','news 的地点','The location of news','A','从句说明“消息是什么”。','The clause states what the news is.'))
    ]),
    L('dummy-it-subject','core','形式主语 it','Dummy subject it','把较长的真正主语后移','Postponing a heavy notional subject',[
      atom('it 可作形式主语，真正主语是不定式，常见 It is + adjective + to do。','it can be a dummy subject with an infinitive as the postponed notional subject.',[['It','dummy','形式主语','Dummy subject'],['is','predicate'],['important','predicative'],['to sleep well.','subject','真正主语（不定式）','Notional subject (infinitive)']],Q('to sleep well 在意义上是什么？','What is to sleep well semantically?','真正主语','Notional subject','宾语','Object','A','important 评价的是“睡好觉”这件事。','important evaluates the act of sleeping well.')),
      atom('it 可后移 that 主语从句，使句首更轻。','it can postpone a that subject clause to keep the opening lighter.',[['It','dummy','形式主语','Dummy subject'],['is','predicate'],['clear','predicative'],['that he agrees.','subject','真正主语（that 从句）','Notional subject (that-clause)']],Q('that he agrees 是什么从句功能？','What function does that he agrees have?','真正主语','Notional subject','定语','Attribute','A','clear 所判断的内容由该从句给出。','The clause supplies what is clear.')),
      atom('It takes + 人 + 时间 + to do 中，it 是形式主语，不定式是真正主语。','In It takes + person + time + to do, it is dummy and the infinitive is the notional subject.',[['It','dummy','形式主语','Dummy subject'],['took','predicate'],['me','indirectObject','经历者','Experiencer'],['an hour','directObject','时长','Duration'],['to finish.','subject','真正主语（不定式）','Notional subject (infinitive)']],Q('It took me an hour to finish 中真正主语是什么？','What is the notional subject in It took me an hour to finish?','It','It','to finish','to finish','B','it 只占主语位置，to finish 表示真正事项。','it fills the position; to finish names the actual event.'))
    ]),
    L('dummy-it-object','core','形式宾语 it','Dummy object it','宾语过长时先用 it 占位','Using it before a heavy object',[
      atom('find/think/consider + it + 形容词 + to do 中，it 是形式宾语。','In find/think/consider + it + adjective + to do, it is a dummy object.',[['I','subject'],['find','predicate'],['it','dummy','形式宾语','Dummy object'],['useful','objectComplement'],['to review daily.','object','真正宾语（不定式）','Notional object (infinitive)']],Q('it 在本句中指具体事物吗？','Does it refer to a specific thing here?','不指，只占宾语位置','No; it fills the object position','指 daily','Yes; it refers to daily','A','真正被评价为 useful 的是 to review daily。','What is judged useful is to review daily.')),
      atom('make it clear that... 中 it 可后移 that 宾语从句。','In make it clear that..., it can postpone a that object clause.',[['She','subject'],['made','predicate'],['it','dummy','形式宾语','Dummy object'],['clear','objectComplement'],['that she disagreed.','object','真正宾语（that 从句）','Notional object (that-clause)']],Q('that she disagreed 是什么？','What is that she disagreed?','真正宾语','Notional object','主语补足语','Subject complement','A','clear 所说明的实际内容是该从句。','The clause gives the actual content made clear.')),
      atom('形式宾语结构避免把长宾语夹在动词和宾补之间。','The dummy-object pattern avoids placing a heavy object between the verb and its object complement.',[['We','subject'],['consider','predicate'],['it','dummy','形式宾语','Dummy object'],['necessary','objectComplement'],['that everyone attend.','object','真正宾语从句','Notional object clause']],Q('为什么使用 it？','Why is it used?','保持 consider + 宾补结构清晰','To keep the verb-complement frame clear','代替 everyone','To replace everyone','A','长从句后移，it 先占据宾语位置。','The heavy clause is postponed while it fills the object slot.'))
    ]),
    L('existential-there','core','there 存在句的成分','Elements in existential there clauses','区分引导词、存在谓语与后置主语','Marker, existential verb and postposed subject',[
      atom('存在句中的 there 是无实义引导词，不是地点状语。','Existential there is a semantically empty marker, not a place adverbial.',[['There','existential'],['is','predicate','存在谓语','Existential verb'],['a book','subject','后置主语','Postposed subject'],['on the desk.','adverbial','地点状语','Place adverbial']],Q('真正表示地点的是哪一部分？','Which part actually expresses place?','There','There','on the desk','on the desk','B','there 只引导存在句，on the desk 才是地点状语。','there is the marker; on the desk is the place adverbial.')),
      atom('be 的单复数通常与后置主语的中心词保持一致。','The form of be normally agrees with the head of the postposed subject.',[['There','existential'],['are','predicate','存在谓语','Existential verb'],['two reasons.','subject','后置主语','Postposed subject']],Q('There ___ two reasons.','There ___ two reasons.','is','is','are','are','B','后置主语 two reasons 是复数。','The postposed subject two reasons is plural.')),
      atom('存在句介绍新出现的人或物；地点 there 则有实际指向并可重读。','Existential there introduces a new entity; locative there has real reference and can be stressed.',[['Your bag','subject'],['is','predicate'],['there.','adverbial','地点状语','Place adverbial']],Q('Your bag is there 中 there 是什么？','What is there in Your bag is there?','地点状语','Place adverbial','存在句引导词','Existential marker','A','它实际指“在那里”。','It has the locative meaning “in that place”.'))
    ]),
    L('subject-complement-passive','advanced','被动句中的主语补足语','Subject complements in passives','主动宾补转为被动主补','Object complements becoming subject complements',[
      atom('主动句的宾语变为被动句主语后，原宾补转为主语补足语。','When an active object becomes a passive subject, its object complement becomes a subject complement.',[['Mia','subject'],['was','auxiliary','被动助动词','Passive auxiliary'],['elected','predicate','谓语动词（过去分词）','Lexical verb (past participle)'],['captain.','subjectComplement']],Q('captain 在 Mia was elected captain 中是什么？','What is captain in Mia was elected captain?','主语补足语','Subject complement','直接宾语','Direct object','A','主动结构 elect Mia captain 中 captain 原为宾补。','In active elect Mia captain, captain is the object complement.')),
      atom('感官动词被动后，主动句中省略的 to 通常恢复。','After a perception verb becomes passive, omitted infinitival to is normally restored.',[['He','subject'],['was','auxiliary','被动助动词','Passive auxiliary'],['seen','predicate','谓语动词（过去分词）','Lexical verb (past participle)'],['to enter the room.','subjectComplement','不定式作主语补足语','Infinitive as subject complement']],Q('He was seen ___ the room.','He was seen ___ the room.','enter','enter','to enter','to enter','B','see 的被动结构恢复不定式标记 to。','The passive of see restores infinitival to.')),
      atom('分词或形容词也可在被动结构后补充说明主语状态。','A participle or adjective can also complete the subject’s state after a passive verb.',[['The door','subject'],['was','auxiliary','被动助动词','Passive auxiliary'],['painted','predicate','谓语动词（过去分词）','Lexical verb (past participle)'],['red.','subjectComplement']],Q('red 补充说明什么？','What does red describe?','door 的结果状态','The resulting state of door','painted 的方式','The manner of painted','A','red 描述门被漆后的状态。','red describes the door’s resulting state.'))
    ]),
    L('nonfinite-elements','advanced','非谓语结构充当成分','Non-finite structures as elements','先看整体功能，再分析内部关系','Identify the whole function before internal structure',[
      atom('不定式可作主语、宾语、表语、定语、补足语或状语，功能由位置和搭配决定。','An infinitive can be subject, object, predicative, modifier, complement or adverbial; position and pattern determine its role.',[['She','subject'],['has','predicate'],['a report','object'],['to finish tonight.','attribute','不定式短语作后置定语','Infinitive phrase as postmodifier']],Q('to finish tonight 修饰什么？','What does to finish tonight modify?','report','report','has','has','A','它说明“需要完成的报告”。','It identifies the report to be finished.'),T('英语不定式后置，中文通常前移为“今晚要完成的报告”。','The infinitive follows report in English but normally moves before 报告 in Chinese.')),
      atom('动名词保留动词特征但整体具有名词功能，可作主语、宾语、表语或介词宾语。','A gerund retains verbal properties but has a noun-like function as subject, object, predicative or prepositional object.',[['Learning a language','nonfinite','动名词短语作主语','Gerund phrase as subject'],['takes','predicate'],['time.','object']],Q('Learning a language 整体是什么？','What is Learning a language as a whole?','主语','Subject','时间状语','Time adverbial','A','它位于谓语 takes 前，表示一件事。','It precedes takes and names an activity.')),
      atom('分词短语可作定语、状语或补足语；要找其逻辑主语并判断主动或被动关系。','A participle phrase can be modifier, adverbial or complement; identify its understood subject and voice relation.',[['Seen from above,','adverbial','过去分词短语作视角状语','Past-participle phrase as viewpoint adverbial'],['the city','subject'],['looks','predicate','系动词','Linking verb'],['beautiful.','predicative']],Q('Seen 的逻辑承受者是谁？','Who is understood as being seen?','the city','the city','说话者','the speaker','A','城市是“被从上方看”的对象。','The city is what is seen from above.'))
    ]),
    L('clauses-as-elements','advanced','从句充当句子成分','Clauses as sentence elements','先框出从句，再判断整体任务','Bracket the clause, then identify its whole role',[
      atom('名词性从句可整体作主语、宾语、表语或同位语。','A nominal clause can function as subject, object, predicative or appositive.',[['I','subject'],['know','predicate'],['why he left.','clause','宾语从句','Object clause']],Q('why he left 整体是什么？','What is why he left as a whole?','宾语从句','Object clause','原因状语从句','Cause adverbial clause','A','它是 know 的内容宾语，不是说明 know 的原因。','It supplies what I know, not why I know it.')),
      atom('关系从句整体作定语；关系词同时在从句内部承担主语、宾语等成分。','A relative clause functions as modifier, while the relative word also has a role inside it.',[['The student','subject'],['who answered first','attribute','定语从句；who 在从句内作主语','Relative clause; who is its subject'],['won.','predicate']],Q('who 在从句内部是什么成分？','What role does who have inside the clause?','主语','Subject','连词且不作成分','A conjunction with no role','A','who 既连接从句又作 answered 的主语。','who links the clause and is the subject of answered.')),
      atom('状语从句整体修饰主句谓语或整个主句，表达时间、原因、条件、让步等逻辑。','An adverbial clause modifies the main predicate or whole clause and expresses time, cause, condition, concession and other relations.',[['We','subject'],['will','modal'],['start','predicate'],['when everyone arrives.','adverbial','时间状语从句','Time adverbial clause']],Q('when everyone arrives 整体是什么？','What is when everyone arrives as a whole?','时间状语从句','Time adverbial clause','宾语从句','Object clause','A','它说明 will start 的时间。','It states when we will start.'))
    ]),
    L('coordination-sharing-ellipsis','advanced','并列、共享与省略','Coordination, sharing and ellipsis','还原平行结构，避免错分成分','Recover parallel structure before assigning roles',[
      atom('并列连词连接语法地位相同的词、短语或分句；两端应按同一层级分析。','A coordinator joins words, phrases or clauses of equal status; analyse both sides at the same level.',[['Mia','subject'],['bought','predicate'],['books','directObject'],['and','conjunction'],['magazines.','directObject']],Q('books 和 magazines 是什么关系？','How are books and magazines related?','并列直接宾语','Coordinated direct objects','主语和宾语','Subject and object','A','and 连接两个同层级宾语。','and joins two objects at the same level.')),
      atom('多个并列主语可以共享一个谓语，多个并列谓语也可以共享一个主语。','Coordinated subjects may share a predicate, and coordinated predicates may share a subject.',[['Tom and Mia','subject','并列主语','Coordinated subject'],['opened','predicate'],['the box','directObject'],['and','conjunction'],['checked','predicate','共享主语的并列谓语动词','Coordinated predicate verb sharing subject'],['it.','directObject']],Q('checked it 的主语是谁？','Who is the subject of checked it?','Tom and Mia','Tom and Mia','the box','the box','A','第二个谓语省略重复主语，但与 opened 共享主语。','The second predicate omits the repeated subject and shares it with opened.')),
      atom('省略结构必须根据平行项补回共同成分，再判断每一项的句法功能。','In ellipsis, recover the shared material from the parallel item before assigning functions.',[['Mia likes tea;','clause','完整分句一','Complete first clause'],['Tom, coffee.','clause','省略 likes 的并列分句','Parallel clause with likes omitted']],Q('Tom, coffee 中省略了什么？','What is omitted in Tom, coffee?','likes','likes','tea','tea','A','根据平行结构可还原为 Tom likes coffee。','Parallelism recovers Tom likes coffee.'))
    ]),
    L('nested-analysis','advanced','嵌套层级分析','Nested constituent analysis','先外层后内层，不把不同层级并列','Work outside-in and keep levels separate',[
      atom('分析复杂句先找主句限定谓语，再确定它支配的主语、宾语或表语。','In a complex sentence, first locate the main finite verb, then its subject, object or predicative.',[['The teacher','subject'],['said','predicate','主句谓语','Main-clause predicate'],['that the test was easy.','clause','宾语从句','Object clause']],Q('主句谓语是什么？','What is the main-clause predicate verb?','said','said','was','was','A','was 位于宾语从句内部，外层谓语是 said。','was is inside the object clause; said is the outer predicate.')),
      atom('一个大成分内部还可包含更小成分；外层功能和内层功能必须分别标注。','A large constituent may contain smaller ones; label its outer and inner functions separately.',[['The book that you recommended','subject','含定语从句的名词短语作主语','Noun phrase with relative clause as subject'],['is','predicate'],['useful.','predicative']],Q('整段 The book that you recommended 外层是什么？','What is the outer role of The book that you recommended?','主语','Subject','定语','Attribute','A','内部 that 从句修饰 book，但整个名词短语作主语。','The internal that-clause modifies book, while the whole noun phrase is subject.')),
      atom('介词短语紧跟名词时先检查是否修饰名词；若修饰动作或整句，才分析为状语。','When a prepositional phrase follows a noun, first test whether it modifies that noun; otherwise it may be an adverbial.',[['The students','subject'],['in the library','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['read','predicate'],['quietly.','adverbial','方式状语','Manner adverbial']],Q('in the library 为什么是定语？','Why is in the library a modifier?','它限定哪些 students','It identifies which students','它说明 read 的方式','It gives the manner of reading','A','它紧跟并限定 students；quietly 才说明 read 的方式。','It immediately identifies students; quietly gives the manner of read.'),T('中文通常说“图书馆里的学生”，把后置短语前移。','Chinese normally moves the postmodifier before 学生: “图书馆里的学生”.'))
    ]),
    L('integrated-analysis','advanced','综合成分分析','Integrated constituent analysis','用边界、关系和替换三步验证','Verify by boundaries, relations and substitution',[
      atom('先划主干，再把定语、状语和同位语逐层挂回中心词或谓语。','Identify the clause skeleton first, then attach modifiers, adverbials and appositives to their heads.',[['My brother Tom','subject','含同位语的主语','Subject with appositive'],['sent','predicate'],['me','indirectObject'],['a photo','directObject'],['yesterday.','adverbial','时间状语','Time adverbial']],Q('本句主干最完整的结构是什么？','Which is the complete clause skeleton?','主语＋谓语＋间接宾语＋直接宾语','Subject + predicate + indirect object + direct object','主语＋系动词＋表语','Subject + linking verb + predicative','A','send 在此使用双宾语结构。','send uses the double-object pattern here.')),
      atom('用提问和替换验证成分：谁/什么、做什么、对谁/什么、何时何地怎样。','Use questions and substitution to test elements: who/what, does what, to whom/what, when, where and how.',[['The young scientist','subject'],['explained','predicate'],['the result','directObject'],['to','preposition'],['us','prepObject'],['clearly.','adverbial','方式状语','Manner adverbial']],Q('clearly 回答哪个问题？','Which question does clearly answer?','怎样解释','How the explanation was given','向谁解释','To whom it was explained','A','clearly 修饰 explained 的方式。','clearly modifies the manner of explained.')),
      atom('遇到歧义时，用语义关系和停顿判断介词短语究竟修饰名词还是动词。','For ambiguity, use meaning and phrasing to decide whether a prepositional phrase modifies a noun or verb.',[['She','subject'],['saw','predicate'],['the man with a telescope.','object','含可能歧义后置短语的宾语','Object with a potentially ambiguous postmodifier']],Q('with a telescope 为什么可能有两种分析？','Why can with a telescope have two analyses?','可修饰 man，也可说明 saw 的工具','It may modify man or give the instrument of saw','只能作时间状语','It can only be a time adverbial','A','语境决定是“拿望远镜的人”还是“用望远镜看见”。','Context decides between “the man who had it” and “saw by means of it”.'),S('成分分析必须服从具体语境；无法消除的歧义应明确保留两种结构。','Constituent analysis follows context; genuine ambiguity should retain both structures.'))
    ])
  ];

  for (const lesson of lessons) {
    const explanations = exampleExplanations[lesson.id];
    if (!explanations || explanations.length !== lesson.examples.length) throw new Error(`Missing sentence-element example explanations: ${lesson.id}`);
    lesson.exampleNotes = explanations.map((pair) => note(english, 'structure', pair[0], pair[1]));
  }

  const course = lessons.map((item, index) => Object.assign({}, item, { no: String(index + 1).padStart(2, '0') }));
  const sectionSpecs = [
    ['elements-foundation','成分基础与句子主干','Foundations and clause skeleton','区分词性、短语、从句和句子成分，并准确找到主语与谓语边界。','Distinguish word classes, phrases, clauses and elements, then locate subjects and predicate boundaries.',['element-levels','subject','predicate-boundary']],
    ['objects-complements','宾语、表语与补足语','Objects, predicatives and complements','系统区分直接宾语、间接宾语、介词宾语、表语和宾语补足语。','Distinguish direct, indirect and prepositional objects, predicatives and object complements.',['direct-object','indirect-object','preposition-object','predicative','object-complement']],
    ['modifiers-adverbials','定语与状语系统','Modifiers and adverbials','建立定语位置与时间、地点、频率、方式、程度及逻辑状语体系。','Build a system for modifier position and time, place, frequency, manner, degree and logical adverbials.',['attributes','adverbial-time-place-frequency','adverbial-manner-degree','adverbial-cause-purpose-result','adverbial-condition-concession-comment']],
    ['apposition-special','同位语与特殊占位结构','Apposition and special placeholder structures','掌握同位说明、形式主语、形式宾语和 there 存在句。','Master apposition, dummy subjects, dummy objects and existential there.',['apposition','dummy-it-subject','dummy-it-object','existential-there']],
    ['passive-complement','被动后的主语补足','Subject complements after passives','追踪主动宾补转为被动主补的结构变化。','Trace how an active object complement becomes a passive subject complement.',['subject-complement-passive']],
    ['nonfinite-clauses','非谓语与从句作成分','Non-finite structures and clauses as elements','按整体位置判断非谓语结构和各类从句承担的句法功能。','Identify the syntactic roles of non-finite structures and clauses by their overall position.',['nonfinite-elements','clauses-as-elements']],
    ['complex-analysis','并列、省略与多层综合','Coordination, ellipsis and layered analysis','处理共享、省略、嵌套、歧义和完整复杂句分析。','Handle sharing, ellipsis, nesting, ambiguity and complete complex-sentence analysis.',['coordination-sharing-ellipsis','nested-analysis','integrated-analysis']]
  ];
  const sections = sectionSpecs.map((section) => ({
    id: section[0], title: pick(english, section[1], section[2]), copy: pick(english, section[3], section[4]),
    lessonIds: section[5].slice(), lessonCount: section[5].length
  }));
  const ids = course.map((item) => item.id);
  const assigned = sections.flatMap((section) => section.lessonIds);
  if (assigned.length !== ids.length || new Set(assigned).size !== assigned.length || ids.some((id) => !assigned.includes(id)) || assigned.some((id) => !ids.includes(id))) throw new Error('Invalid sentence-elements section coverage');
  for (const item of course) {
    if (item.examples.length < 3 || item.questions.length < 3 || item.rules.length !== item.ruleCoverage.length && INCLUDE_RULE_COVERAGE) throw new Error(`Invalid sentence-elements lesson: ${item.id}`);
    if (INCLUDE_RULE_COVERAGE) item.ruleCoverage.forEach((coverage, index) => {
      if (!coverage.exampleIndexes.length || !coverage.questionIndexes.length || coverage.exampleIndexes.some((i) => i < 0 || i >= item.examples.length) || coverage.questionIndexes.some((i) => i < 0 || i >= item.questions.length)) throw new Error(`Invalid rule coverage: ${item.id}:${index}`);
    });
  }
  const core = course.filter((item) => item.level === 'core');
  const advanced = course.filter((item) => item.level === 'advanced');
  return {
    title: pick(english, `句子成分 · ${course.length} 节微课`, `Sentence elements · ${course.length} lessons`),
    copy: pick(english, '先看成分边界与句子主干，再处理补足、修饰和复杂嵌套。', 'Start with boundaries and the clause skeleton, then handle complementation, modification and complex nesting.'),
    course,
    sections,
    groups: [
      { id: 'core', title: pick(english, `核心必学 · ${core.length} 节`, `Core · ${core.length} essential lessons`), copy: pick(english, '建立基础句子分析能力。', 'Build essential sentence-analysis skills.'), lessons: core },
      { id: 'advanced', title: pick(english, `进阶挑战 · ${advanced.length} 节`, `Advanced · ${advanced.length} challenge lessons`), copy: pick(english, '处理被动补足、从句、非谓语与多层结构。', 'Handle passive complements, clauses, non-finite forms and layered structures.'), lessons: advanced }
    ]
  };
}

module.exports = { buildSentenceElementsCourse };
