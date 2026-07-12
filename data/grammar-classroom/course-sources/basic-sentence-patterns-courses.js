const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;

const ROLE_LABELS = {
  subject: ['主语', 'Subject'],
  predicate: ['谓语动词', 'Predicate verb'],
  linking: ['系动词', 'Linking verb'],
  object: ['宾语', 'Object'],
  indirectObject: ['间接宾语', 'Indirect object'],
  directObject: ['直接宾语', 'Direct object'],
  subjectComplement: ['主语补语（表语）', 'Subject complement'],
  objectComplement: ['宾语补语', 'Object complement'],
  adverbial: ['状语', 'Adverbial'],
  attribute: ['定语', 'Attribute'],
  auxiliary: ['助动词', 'Auxiliary verb'],
  conjunction: ['连词', 'Conjunction'],
  existential: ['存在句引导词', 'Existential there']
};

function analysis(english, chunks) {
  return chunks.map(([text, role, zhLabel, enLabel]) => {
    const defaults = ROLE_LABELS[role] || ['', ''];
    return { text, role, label: pick(english, zhLabel || defaults[0], enLabel || defaults[1]) };
  });
}

function note(english, mode, zhBody, enBody) {
  if (!mode) return { visible: false, mode: '', title: '', body: '', detail: '' };
  const titles = {
    translation: ['语序翻译', 'Word-order translation'],
    structure: ['结构观察', 'Structure focus'],
    transformation: ['结构转换', 'Transformation focus'],
    boundary: ['边界提醒', 'Boundary note']
  };
  const title = titles[mode] || titles.structure;
  return { visible: true, mode, title: pick(english, title[0], title[1]), body: pick(english, zhBody, enBody), detail: '' };
}

function ex(english, chunks, mode = '', zhBody = '', enBody = '') {
  return {
    text: chunks.map((item) => item[0]).join(' '),
    analysis: analysis(english, chunks),
    note: note(english, mode, zhBody, enBody)
  };
}

function q(english, promptZh, promptEn, options, answer, whyZh, whyEn) {
  const optionEnglish = {
    '一个：can sing': 'One: can sing', '两个：can 和 sing': 'Two: can and sing', '时间状语': 'Time adverbial', '宾语': 'Object',
    '主语补语（表语）': 'Subject complement (predicative)', '间接宾语': 'Indirect object', '宾语补语': 'Object complement',
    '直接宾语': 'Direct object', '主语补语': 'Subject complement', '介词短语作受益者状语': 'Prepositional phrase as beneficiary adverbial',
    '存在句': 'Existential clause', '普通主系表句': 'Ordinary SVC clause', '必要地点状语': 'Obligatory place adverbial',
    '时长状语': 'Duration adverbial', '删去后结构或意义明显不完整': 'The structure or meaning becomes incomplete',
    '是否位于句末': 'Whether it is sentence-final', '系动词': 'Linking verb', '及物动词': 'Transitive verb',
    '检查后两项是传递关系还是说明关系': 'Check whether the final elements show transfer or description',
    '只数动词后的词数': 'Only count the words after the verb', '一个': 'One', '两个': 'Two', '只与 dried': 'Only dried',
    '同时与 washed 和 dried': 'Both washed and dried', '两个直接宾语': 'Two direct objects', '两个谓语': 'Two predicates',
    '主语': 'Subject', '状语': 'Adverbial', '定语从句': 'Relative clause', '新的基本句型': 'A new basic pattern',
    'looked at 整体作谓语，picture 作宾语': 'looked at is the predicate and picture is its object',
    'picture 是地点状语': 'picture is a place adverbial'
  };
  return {
    question: pick(english, promptZh, promptEn),
    options: options.map((text, index) => ({ key: String.fromCharCode(65 + index), text: english ? (optionEnglish[text] || text) : text })),
    answer,
    correct: pick(english, whyZh, whyEn),
    wrong: pick(english, `再看句子骨架：${whyZh}`, `Check the sentence skeleton: ${whyEn}`)
  };
}

function makeLesson(english, spec, index) {
  if (spec.rules.length !== spec.examples.length || spec.rules.length !== spec.questions.length) throw new Error(`Rule coverage mismatch: ${spec.id}`);
  const examples = spec.examples.map((item) => ex(english, item[0], item[1], item[2], item[3]));
  return {
    id: spec.id,
    no: String(index + 1).padStart(2, '0'),
    level: spec.level,
    title: pick(english, spec.title[0], spec.title[1]),
    meta: pick(english, spec.meta[0], spec.meta[1]),
    examples: examples.map((item) => item.text),
    analyses: examples.map((item) => item.analysis),
    exampleNotes: examples.map((item) => item.note),
    rules: spec.rules.map((item) => pick(english, item[0], item[1])),
    ruleCoverage: INCLUDE_RULE_COVERAGE ? spec.rules.map((_, ruleIndex) => ({ exampleIndexes: [ruleIndex], questionIndexes: [ruleIndex] })) : [],
    questions: spec.questions.map((item) => q(english, ...item))
  };
}

const lessonSpecs = [
  {
    id: 'find-predicate-skeleton', level: 'core',
    title: ['先找谓语，再看骨架', 'Find the predicate, then the skeleton'],
    meta: ['一个分句的核心从限定谓语开始', 'A clause skeleton starts with its finite predicate'],
    examples: [
      [[['Birds','subject'],['fly.','predicate']], 'structure', 'fly 是限定谓语；Birds 是它的主语。', 'fly is the finite predicate and Birds is its subject.'],
      [[['She','subject'],['can sing.','predicate','情态动词＋谓语动词','Modal + predicate verb']], 'structure', 'can sing 合起来构成谓语，不把 sing 单独误判成第二个谓语。', 'can sing forms one predicate; sing is not a second predicate.'],
      [[['The boy in blue','subject','带后置定语的主语','Subject with postmodifier'],['is running.','predicate']], 'structure', '先跳过修饰语 in blue，找到核心主语 boy 和谓语 is running。', 'Set aside in blue and find the head subject boy with is running.']
    ],
    rules: [
      ['判断句型先找每个分句的限定谓语，再找与它搭配的主语。','To identify a pattern, first find each clause’s finite predicate and its subject.'],
      ['助动词、情态动词与主要动词共同构成一个谓语动词组。','Auxiliaries or modals and the main verb form one predicate verb phrase.'],
      ['定语和状语可以很长，但不属于基本骨架的核心槽位。','Attributes and adverbials may be long, but they are not core skeleton slots.']
    ],
    questions: [
      ['Birds fly. 的谓语是什么？','What is the predicate in “Birds fly”?',['Birds','fly'],'B','fly 是限定谓语。','fly is the finite predicate.'],
      ['She can sing. 有几个谓语中心？','How many predicate centres are in “She can sing”?',['一个：can sing','两个：can 和 sing'],'A','can sing 是一个谓语动词组。','can sing is one predicate verb phrase.'],
      ['The boy in blue is running. 的核心主语是什么？','What is the head subject in “The boy in blue is running”?',['the boy','blue'],'A','in blue 是后置定语，boy 是中心词。','in blue is a postmodifier; boy is the head.']
    ]
  },
  {
    id: 'pattern-sv', level: 'core', title: ['主谓：SV', 'Subject–verb: SV'], meta: ['动作本身已经完整', 'The action is complete without an object'],
    examples: [
      [[['The baby','subject'],['cried.','predicate']], '', '', ''],
      [[['The train','subject'],['arrived','predicate'],['at noon.','adverbial','时间状语','Time adverbial']], 'structure', 'at noon 说明时间；去掉后 The train arrived 仍完整。', 'at noon adds time; The train arrived remains complete.'],
      [[['My grandparents','subject'],['live','predicate'],['in Suzhou.','adverbial','地点状语','Place adverbial']], 'structure', 'live 在这里不带宾语；in Suzhou 是地点状语。', 'live takes no object here; in Suzhou is a place adverbial.']
    ],
    rules: [
      ['SV 由主语和不及物谓语构成，谓语后不要求宾语或补语。','SV contains a subject and an intransitive predicate; no object or complement is required.'],
      ['时间、地点等可选状语不会把 SV 改成其他基本句型。','Optional time or place adverbials do not change an SV skeleton.'],
      ['介词短语不能因位于动词后就自动判为宾语。','A prepositional phrase is not automatically an object merely because it follows a verb.']
    ],
    questions: [
      ['The baby cried. 属于哪种句型？','Which pattern is “The baby cried”?',['SV','SVO'],'A','cried 不需要宾语，骨架是 SV。','cried needs no object, so the skeleton is SV.'],
      ['The train arrived at noon. 的 at noon 是什么？','What is “at noon” in “The train arrived at noon”?',['时间状语','宾语'],'A','它说明到达时间，不是宾语。','It tells when the train arrived, not what it acted on.'],
      ['My grandparents live in Suzhou. 的骨架是什么？','What is the skeleton of “My grandparents live in Suzhou”?',['SV','SVO'],'A','in Suzhou 是介词短语作地点状语。','in Suzhou is a place adverbial.']
    ]
  },
  {
    id: 'pattern-svc', level: 'core', title: ['主系表：SVC', 'Subject–linking verb–complement: SVC'], meta: ['表语说明主语是谁或怎么样', 'The complement identifies or describes the subject'],
    examples: [
      [[['Mia','subject'],['is','linking'],['a doctor.','subjectComplement']], '', '', ''],
      [[['The soup','subject'],['tastes','linking'],['delicious.','subjectComplement']], 'structure', 'tastes 不表示“品尝某物”，而是连接 soup 与 delicious。', 'tastes links soup to delicious rather than taking an object.'],
      [[['The leaves','subject'],['turned','linking'],['yellow.','subjectComplement']], 'structure', 'turned 表示状态变化，yellow 描述主语。', 'turned marks a change of state and yellow describes the subject.']
    ],
    rules: [
      ['SVC 中系动词连接主语与主语补语（传统教学常称表语）。','In SVC, a linking verb connects the subject with a subject complement.'],
      ['主语补语可以是名词性成分，说明主语的身份。','A noun phrase can be a subject complement identifying the subject.'],
      ['感官或变化动词作系动词时，后接描述主语状态的补语。','Sense or change-of-state linking verbs take a complement describing the subject.']
    ],
    questions: [
      ['Mia is a doctor. 中 a doctor 是什么？','What is “a doctor” in “Mia is a doctor”?',['宾语','主语补语（表语）'],'B','a doctor 说明 Mia 的身份。','a doctor identifies Mia.'],
      ['The soup tastes delicious. 属于哪种句型？','Which pattern is “The soup tastes delicious”?',['SVC','SVO'],'A','tastes 是系动词，delicious 描述 soup。','tastes is linking and delicious describes soup.'],
      ['The leaves turned yellow. 中 yellow 描述谁？','Who or what does “yellow” describe?',['the leaves','turned'],'A','yellow 是主语补语，描述 leaves。','yellow is a subject complement describing the leaves.']
    ]
  },
  {
    id: 'pattern-svo', level: 'core', title: ['主谓宾：SVO', 'Subject–verb–object: SVO'], meta: ['动作指向一个宾语', 'The action is directed at one object'],
    examples: [
      [[['Leo','subject'],['opened','predicate'],['the window.','object']], '', '', ''],
      [[['We','subject'],['enjoy','predicate'],['music.','object']], '', '', ''],
      [[['She','subject'],['understood','predicate'],['the question.','object']], 'structure', 'understood 是及物动词，the question 是它的直接宾语。', 'understood is transitive and the question is its direct object.']
    ],
    rules: [
      ['SVO 的及物谓语后需要一个宾语承受或涉及动作。','In SVO, a transitive predicate takes one object affected or involved in the action.'],
      ['宾语可以表示具体事物，也可以表示抽象内容。','An object may denote a concrete thing or abstract content.'],
      ['宾语可以由名词、代词、非谓语结构或宾语从句等名词性成分充当。','An object may be a noun phrase, pronoun, non-finite structure or object clause.']
    ],
    questions: [
      ['Leo opened the window. 的宾语是什么？','What is the object in “Leo opened the window”?',['Leo','the window'],'B','window 承受 opened 的动作。','the window receives the action of opened.'],
      ['We enjoy music. 属于哪种句型？','Which pattern is “We enjoy music”?',['SVO','SV'],'A','enjoy 后接宾语 music。','enjoy takes the object music.'],
      ['She understood the question. 中 the question 是什么？','What is “the question” in “She understood the question”?',['宾语','时间状语'],'A','the question 是 understood 的直接宾语。','the question is the direct object of understood.']
    ]
  },
  {
    id: 'pattern-svoo', level: 'core', title: ['主谓双宾：SVOO', 'Subject–verb–indirect object–direct object: SVOO'], meta: ['“给谁”加“什么”', 'A recipient plus a thing'],
    examples: [
      [[['Dad','subject'],['gave','predicate'],['me','indirectObject'],['a camera.','directObject']], 'structure', 'me 是接受者，a camera 是被给予的事物。', 'me is the recipient and a camera is the thing transferred.'],
      [[['She','subject'],['taught','predicate'],['us','indirectObject'],['English.','directObject']], '', '', ''],
      [[['I','subject'],['bought','predicate'],['a gift','directObject'],['for my mother.','adverbial','受益者介词短语','Beneficiary prepositional phrase']], 'structure', 'for my mother 是介词短语，不是无介词的间接宾语；可转换为 I bought my mother a gift。', 'for my mother is a prepositional phrase; compare I bought my mother a gift.']
    ],
    rules: [
      ['SVOO 常包含表示接受者的间接宾语和表示事物的直接宾语。','SVOO commonly contains a recipient indirect object and a thing direct object.'],
      ['能进入 SVOO 的动词有限，如 give、send、show、teach、tell、buy。','Only certain verbs allow SVOO, such as give, send, show, teach, tell and buy.'],
      ['“直接宾语＋to/for 介词短语”与双宾结构意义可接近，但成分结构不同。','A direct object plus a to/for phrase may resemble SVOO in meaning but differs structurally.']
    ],
    questions: [
      ['Dad gave me a camera. 中 me 是什么？','What is “me” in “Dad gave me a camera”?',['间接宾语','宾语补语'],'A','me 是 camera 的接受者。','me is the recipient of the camera.'],
      ['She taught us English. 中 English 是什么？','What is “English” in “She taught us English”?',['直接宾语','主语补语'],'A','English 是所教的内容。','English is the content taught.'],
      ['I bought a gift for my mother. 中 for my mother 是什么？','What is “for my mother” in “I bought a gift for my mother”?',['介词短语作受益者状语','间接宾语'],'A','它带介词 for，不是无介词宾语。','It is introduced by for, so it is not a bare indirect object.']
    ]
  },
  {
    id: 'pattern-svoc', level: 'core', title: ['主谓宾补：SVOC', 'Subject–verb–object–complement: SVOC'], meta: ['补语说明宾语是谁、怎么样或做什么', 'The complement identifies, describes or completes the object'],
    examples: [
      [[['They','subject'],['elected','predicate'],['Amy','object'],['captain.','objectComplement']], 'structure', 'captain 说明 Amy 被选成什么。', 'captain identifies what Amy was elected to be.'],
      [[['The news','subject'],['made','predicate'],['him','object'],['happy.','objectComplement']], 'structure', 'happy 描述宾语 him 的状态。', 'happy describes the state of the object him.'],
      [[['I','subject'],['saw','predicate'],['the bird','object'],['fly away.','objectComplement']], 'structure', 'fly away 补充说明 bird 做了什么。', 'fly away tells what the bird did.']
    ],
    rules: [
      ['SVOC 的宾语后还有宾语补语，二者形成“宾语＋说明”的关系。','In SVOC, an object complement follows and says something about the object.'],
      ['名词或形容词可作宾语补语，说明身份或状态。','A noun or adjective can be an object complement of identity or state.'],
      ['非谓语动词可作宾语补语，说明宾语执行或承受的动作。','A non-finite verb can complement the object by showing its action or experience.']
    ],
    questions: [
      ['They elected Amy captain. 中 captain 是什么？','What is “captain” in “They elected Amy captain”?',['宾语补语','直接宾语'],'A','captain 说明 Amy 的新身份。','captain identifies Amy’s new role.'],
      ['The news made him happy. 的宾语是哪一项？','Which item is the object in “The news made him happy”?',['him','happy'],'A','him 是宾语，happy 是宾语补语。','him is the object and happy its complement.'],
      ['I saw the bird fly away. 属于哪种骨架？','Which skeleton fits “I saw the bird fly away”?',['SVOC','SVOO'],'A','fly away 说明 bird 的动作，是宾补。','fly away complements bird by describing its action.']
    ]
  },
  {
    id: 'existential-there-be', level: 'core', title: ['存在句：there be', 'Existential there be'], meta: ['引出“某处有某人或某物”', 'Introducing the existence of someone or something'],
    examples: [
      [[['There','existential'],['is','predicate'],['a book','subject','实义主语','Notional subject'],['on the desk.','adverbial','地点状语','Place adverbial']], 'translation', '英语用 there 先引出存在，中文通常按“地点＋有＋事物”翻译。', 'English uses there to introduce existence; Chinese commonly uses place + 有 + thing.'],
      [[['There','existential'],['are','predicate'],['two students','subject','实义主语','Notional subject'],['outside.','adverbial','地点状语','Place adverbial']], '', '', ''],
      [[['There','existential'],['seems to be','predicate'],['a problem.','subject','实义主语','Notional subject']], 'structure', '存在句不只限于 is/are，也可用 seem to be 等表达。', 'Existential clauses can also use expressions such as seem to be.']
    ],
    rules: [
      ['存在句中的 there 是形式性引导成分，be 后的名词短语是实义主语。','In an existential clause, there is an introductory dummy element and the following noun phrase is the notional subject.'],
      ['be 的单复数通常与其后的名词短语保持一致。','The form of be normally agrees with the following noun phrase.'],
      ['there be 是特殊存在结构，不应机械归入普通 SVC。','there be is a special existential construction, not an ordinary SVC pattern.']
    ],
    questions: [
      ['There is a book on the desk. 的实义主语是什么？','What is the notional subject in “There is a book on the desk”?',['there','a book'],'B','a book 是被引出的存在对象。','a book is the entity whose existence is introduced.'],
      ['There ___ two students outside.','There ___ two students outside.',['is','are'],'B','be 与复数 two students 一致。','be agrees with plural two students.'],
      ['There seems to be a problem. 应归为什么？','How should “There seems to be a problem” be classified?',['存在句','普通主系表句'],'A','there 引出 problem 的存在。','there introduces the existence of a problem.']
    ]
  },
  {
    id: 'obligatory-adverbial', level: 'core', title: ['必要状语型结构', 'Patterns with obligatory adverbials'], meta: ['有些动词后缺少地点等信息就不完整', 'Some verbs need location or similar information to complete the clause'],
    examples: [
      [[['She','subject'],['put','predicate'],['the keys','object'],['on the table.','adverbial','必要地点状语','Obligatory place adverbial']], 'structure', 'put 通常必须说明把东西放到哪里，地点状语不可随意删去。', 'put normally requires a destination; the place adverbial cannot simply be omitted.'],
      [[['The meeting','subject'],['lasted','predicate'],['for two hours.','adverbial','必要时长状语','Obligatory duration adverbial']], 'structure', '此处时长补足 lasted 的意义。', 'The duration completes the meaning of lasted here.'],
      [[['He','subject'],['lives','predicate'],['in Shanghai.','adverbial','语境必要的地点状语','Contextually required place adverbial']], 'structure', '在强调居住地点的语境中，地点信息承担必要补足作用。', 'When residence location is the point, the place information completes the message.']
    ],
    rules: [
      ['部分结构除主语、谓语、宾语外，还要求地点、方向或时长等必要状语。','Some patterns require a place, direction or duration adverbial in addition to subject, verb and object.'],
      ['“必要状语”仍是状语，不应误标为宾语补语。','An obligatory adverbial is still an adverbial, not an object complement.'],
      ['必要性既受动词配价影响，也可能受当前语境表达目标影响。','Obligatoriness may depend on verb valency and on what the context needs to express.']
    ],
    questions: [
      ['She put the keys on the table. 中 on the table 是什么？','What is “on the table” in “She put the keys on the table”?',['必要地点状语','宾语补语'],'A','它补足 put 所需的放置地点。','It supplies the location required by put.'],
      ['The meeting lasted for two hours. 中 for two hours 表示什么？','What does “for two hours” express?',['时长状语','直接宾语'],'A','介词短语说明持续时长。','The prepositional phrase gives duration.'],
      ['必要状语与普通可选状语的主要区别是什么？','What mainly distinguishes an obligatory adverbial from an optional one?',['删去后结构或意义明显不完整','是否位于句末'],'A','关键看它是否补足动词或语境所需信息。','The key is whether it completes information required by the verb or context.']
    ]
  },
  {
    id: 'linking-transitivity', level: 'core', title: ['系动词与及物性辨析', 'Linking verbs and transitivity'], meta: ['同一个词要按句中用法判断', 'Judge a verb by how it functions in context'],
    examples: [
      [[['The flowers','subject'],['smell','linking'],['sweet.','subjectComplement']], 'structure', 'smell 连接 flowers 与 sweet，是系动词。', 'smell links flowers with sweet and is a linking verb.'],
      [[['She','subject'],['smelled','predicate'],['the flowers.','object']], 'structure', 'smelled 表示主动闻，后接宾语，是及物动词。', 'smelled means actively sensed and takes an object.'],
      [[['The door','subject'],['opened.','predicate']], 'structure', 'opened 在此不带宾语，是不及物用法；比较 She opened the door。', 'opened is intransitive here; compare She opened the door.']
    ],
    rules: [
      ['系动词后成分描述或确认主语，不承受动作。','A linking verb is followed by an element describing or identifying the subject, not receiving an action.'],
      ['同一感官动词可作系动词或及物动词，必须看后项与主语的关系。','The same sense verb may be linking or transitive; inspect how the following element relates to the subject.'],
      ['许多动词可兼作及物与不及物动词，句型由当句用法决定。','Many verbs can be transitive or intransitive; the pattern depends on the current use.']
    ],
    questions: [
      ['The flowers smell sweet. 中 smell 是什么动词？','What kind of verb is smell in “The flowers smell sweet”?',['系动词','及物动词'],'A','sweet 描述 flowers。','sweet describes the flowers.'],
      ['She smelled the flowers. 的句型是什么？','What is the pattern of “She smelled the flowers”?',['SVO','SVC'],'A','flowers 是 smelled 的宾语。','the flowers is the object of smelled.'],
      ['The door opened. 的句型是什么？','What is the pattern of “The door opened”?',['SV','SVO'],'A','opened 在此不带宾语。','opened takes no object here.']
    ]
  },
  {
    id: 'svoo-vs-svoc', level: 'core', title: ['双宾语还是宾语补语', 'SVOO or SVOC?'], meta: ['看后两个成分是“传递”还是“说明”', 'Ask whether the last two elements transfer or describe'],
    examples: [
      [[['She','subject'],['sent','predicate'],['me','indirectObject'],['a message.','directObject']], 'structure', 'me 接收 message，属于双宾语。', 'me receives a message, so this is SVOO.'],
      [[['They','subject'],['named','predicate'],['the baby','object'],['Leo.','objectComplement']], 'structure', 'Leo 与 the baby 指同一对象，Leo 是宾语补语。', 'Leo and the baby refer to the same entity, so Leo is an object complement.'],
      [[['We','subject'],['found','predicate'],['the task','object'],['difficult.','objectComplement']], 'structure', 'difficult 描述 task，而不是第二个被传递的事物。', 'difficult describes the task; it is not a second transferred object.']
    ],
    rules: [
      ['SVOO 后两项通常是“接受者＋事物”，可分别回答“给谁”和“什么”。','The last two elements in SVOO are usually recipient plus thing: “to whom” and “what”.'],
      ['SVOC 后两项具有说明、命名或状态关系，常可理解为“宾语＝/成为/怎么样”。','In SVOC, the final element identifies, names or describes the object.'],
      ['不能仅凭动词后有两个成分判断，必须检验两个成分的语义关系。','Do not classify solely because two elements follow the verb; test their semantic relationship.']
    ],
    questions: [
      ['She sent me a message. 属于哪种句型？','Which pattern is “She sent me a message”?',['SVOO','SVOC'],'A','me 是接受者，message 是事物。','me is the recipient and message the thing.'],
      ['They named the baby Leo. 中 Leo 是什么？','What is “Leo” in “They named the baby Leo”?',['宾语补语','直接宾语'],'A','Leo 是对 baby 的命名。','Leo names the baby.'],
      ['判断双宾语和宾补最可靠的方法是什么？','What is the best way to distinguish SVOO and SVOC?',['检查后两项是传递关系还是说明关系','只数动词后的词数'],'A','成分关系比表面数量更可靠。','The relationship is more reliable than the surface word count.']
    ]
  },
  {
    id: 'modifiers-preserve-skeleton', level: 'core', title: ['定语、状语不改变骨架', 'Modifiers do not change the skeleton'], meta: ['先暂时移开修饰语，再判核心句型', 'Temporarily set modifiers aside before classifying'],
    examples: [
      [[['The girl with a red bag','subject','含介词短语后置定语的主语','Subject with postmodifier'],['smiled','predicate'],['warmly.','adverbial','方式状语','Manner adverbial']], 'translation', 'with a red bag 后置修饰 girl，中文通常前移为“背红包的女孩”；骨架仍是 The girl smiled。', 'with a red bag follows girl but moves before 女孩 in Chinese; the skeleton remains The girl smiled.'],
      [[['The book that you lent me','subject','含定语从句的主语','Subject with relative clause'],['is','linking'],['useful.','subjectComplement']], 'translation', 'that you lent me 后置修饰 book，中文译为“你借给我的书”；主句骨架是 The book is useful。', 'that you lent me postmodifies book; the main skeleton is The book is useful.'],
      [[['Yesterday,','adverbial','时间状语','Time adverbial'],['Tom','subject'],['quickly finished','predicate','含方式状语的谓语','Predicate with manner adverbial'],['his homework.','object']], 'structure', 'Yesterday 和 quickly 都是状语；去掉后骨架是 Tom finished his homework。', 'Yesterday and quickly are adverbials; remove them to reveal Tom finished his homework.']
    ],
    rules: [
      ['介词短语后置定语属于名词短语内部，不增加主句核心成分。','A postmodifying prepositional phrase belongs inside a noun phrase and adds no main-clause core slot.'],
      ['定语从句内部有自己的骨架，但整个定语从句在主句中只修饰名词。','A relative clause has its own internal skeleton but functions as a noun modifier in the main clause.'],
      ['时间、方式等状语可移动或删减时，主句基本骨架通常保持不变。','Movable or removable time and manner adverbials normally leave the basic skeleton unchanged.']
    ],
    questions: [
      ['The girl with a red bag smiled warmly. 的主句骨架是什么？','What is the main skeleton of “The girl with a red bag smiled warmly”?',['The girl smiled.','The bag smiled.'],'A','with a red bag 是后置定语，warmly 是状语。','with a red bag is a postmodifier and warmly an adverbial.'],
      ['The book that you lent me is useful. 属于哪种主句句型？','What is the main-clause pattern of “The book that you lent me is useful”?',['SVC','SVOO'],'A','主句骨架是 The book is useful。','The main skeleton is The book is useful.'],
      ['Yesterday, Tom quickly finished his homework. 去掉状语后的骨架是什么？','What remains after removing the adverbials from “Yesterday, Tom quickly finished his homework”?',['Tom finished his homework.','Tom quickly.'],'A','Yesterday 和 quickly 都不占核心槽位。','Yesterday and quickly do not occupy core slots.']
    ]
  },
  {
    id: 'transformations-skeleton', level: 'advanced', title: ['否定、疑问、被动与骨架', 'Negatives, questions, passives and the skeleton'], meta: ['形式会变，论元关系仍可追踪', 'The form changes, but participant relations can still be traced'],
    examples: [
      [[['She','subject'],['does not like','predicate','助动词＋否定＋谓语','Auxiliary + negation + predicate'],['coffee.','object']], 'transformation', '否定加入 does not，核心关系仍是 she—like—coffee。', 'Negation adds does not; the relation she–like–coffee remains.'],
      [[['Did','auxiliary'],['Tom','subject'],['open','predicate'],['the door?','object']], 'transformation', '疑问句发生助动词倒装，恢复陈述顺序可看出 Tom opened the door。', 'Auxiliary inversion forms the question; restore statement order to see Tom opened the door.'],
      [[['The door','subject'],['was opened','predicate','被动谓语','Passive predicate'],['by Tom.','adverbial','施事介词短语','Agent phrase']], 'transformation', '主动句宾语 the door 在被动句中升为主语，by Tom 表示施事。', 'The active object the door becomes the passive subject; by Tom marks the agent.']
    ],
    rules: [
      ['否定式在谓语中加入否定成分，不会把宾语变成补语。','Negation adds a negative element to the predicate; it does not turn an object into a complement.'],
      ['一般疑问句的倒装改变表面语序，判型时可先恢复陈述语序。','Question inversion changes surface order; restore statement order when identifying the skeleton.'],
      ['被动转换改变主宾语法位置，因此应标当前句成分，同时追踪与主动句的语义对应。','Passivisation changes grammatical positions; label the current sentence while tracing semantic links to the active.']
    ],
    questions: [
      ['She does not like coffee. 的宾语是什么？','What is the object in “She does not like coffee”?',['coffee','does not'],'A','否定不改变 coffee 的宾语身份。','Negation does not change coffee’s object role.'],
      ['Did Tom open the door? 恢复陈述顺序后是什么？','What is the statement order behind “Did Tom open the door”?',['Tom opened the door.','The door opened Tom.'],'A','助动词倒装后仍是 Tom 对 door 做动作。','Despite inversion, Tom acts on the door.'],
      ['The door was opened by Tom. 的当前句主语是什么？','What is the grammatical subject of “The door was opened by Tom”?',['The door','Tom'],'A','被动句中 The door 是语法主语。','The door is the grammatical subject of the passive.']
    ]
  },
  {
    id: 'one-verb-many-patterns', level: 'advanced', title: ['一个动词，多种句型', 'One verb, multiple patterns'], meta: ['不要给动词贴永久句型标签', 'Do not assign a verb one permanent pattern'],
    examples: [
      [[['The bell','subject'],['rang.','predicate']], 'structure', 'ring 在此不及物，构成 SV。', 'ring is intransitive here, forming SV.'],
      [[['She','subject'],['rang','predicate'],['the bell.','object']], 'structure', 'ring 在此及物，构成 SVO。', 'ring is transitive here, forming SVO.'],
      [[['The idea','subject'],['sounds','linking'],['reasonable.','subjectComplement']], 'structure', 'sound 在此作系动词，构成 SVC。', 'sound is linking here, forming SVC.']
    ],
    rules: [
      ['同一动词可因意义和搭配不同进入不同句型。','The same verb may enter different patterns because of meaning and complementation.'],
      ['及物性是动词在具体用法中的属性，不能只查一个中文词义判断。','Transitivity belongs to a verb’s specific use and cannot be decided from one Chinese gloss.'],
      ['判型要观察动词后的真实成分及其关系，而不是背“某动词＝某句型”。','Classify by the actual following elements and their relations, not by memorising verb-to-pattern labels.']
    ],
    questions: [
      ['The bell rang. 属于什么句型？','What is the pattern of “The bell rang”?',['SV','SVO'],'A','rang 在此不带宾语。','rang takes no object here.'],
      ['She rang the bell. 属于什么句型？','What is the pattern of “She rang the bell”?',['SVO','SV'],'A','the bell 是 rang 的宾语。','the bell is the object of rang.'],
      ['The idea sounds reasonable. 中 reasonable 是什么？','What is “reasonable” in “The idea sounds reasonable”?',['主语补语（表语）','宾语'],'A','sounds 是系动词，reasonable 描述 idea。','sounds is linking and reasonable describes the idea.']
    ]
  },
  {
    id: 'coordination-sharing', level: 'advanced', title: ['并列谓语与共享成分', 'Coordinated predicates and shared elements'], meta: ['并列不等于出现多个完整分句', 'Coordination does not always create multiple full clauses'],
    examples: [
      [[['Tom','subject'],['opened','predicate'],['the door','object'],['and','conjunction'],['walked in.','predicate']], 'structure', '两个谓语共享主语 Tom；第二个谓语不需要重复主语。', 'The two predicates share Tom as subject; the second need not repeat it.'],
      [[['Mia','subject'],['washed','predicate'],['and','conjunction'],['dried','predicate'],['the dishes.','object']], 'structure', 'washed 和 dried 共享同一宾语 the dishes。', 'washed and dried share the object the dishes.'],
      [[['Leo','subject'],['gave','predicate'],['Amy','indirectObject'],['a pen','directObject'],['and','conjunction'],['a notebook.','directObject']], 'structure', '并列的是两个直接宾语，谓语和间接宾语被共享。', 'Two direct objects are coordinated; the predicate and indirect object are shared.']
    ],
    rules: [
      ['并列谓语可共享同一主语，不能因有两个动词就必然判为两个完整分句。','Coordinated predicates may share one subject; two verbs do not necessarily make two full clauses.'],
      ['并列动词还可共享宾语，应根据连词连接的同级成分判断。','Coordinated verbs may share an object; identify which equal-level elements the conjunction links.'],
      ['宾语内部也能并列；共享成分只标一次，但逻辑上同时受相关动词支配。','Objects themselves may be coordinated; a shared element appears once but relates to each relevant verb.']
    ],
    questions: [
      ['Tom opened the door and walked in. 有几个明示主语？','How many overt subjects are in “Tom opened the door and walked in”?',['一个','两个'],'A','两个谓语共享 Tom。','Both predicates share Tom.'],
      ['Mia washed and dried the dishes. 中 the dishes 与谁搭配？','What does “the dishes” relate to in “Mia washed and dried the dishes”?',['只与 dried','同时与 washed 和 dried'],'B','两个并列动词共享宾语。','Both coordinated verbs share the object.'],
      ['Leo gave Amy a pen and a notebook. 中并列的是什么？','What is coordinated in “Leo gave Amy a pen and a notebook”?',['两个直接宾语','两个谓语'],'A','a pen 与 a notebook 都是直接宾语。','a pen and a notebook are both direct objects.']
    ]
  },
  {
    id: 'integrated-pattern-choice', level: 'advanced', title: ['综合判型：按证据走', 'Integrated pattern identification'], meta: ['先谓语，再必需成分，最后排除修饰语', 'Predicate first, required elements next, modifiers last'],
    examples: [
      [[['The children','subject'],['became','linking'],['quiet','subjectComplement'],['after lunch.','adverbial','时间状语','Time adverbial']], 'structure', 'quiet 描述 children，after lunch 是时间状语，骨架为 SVC。', 'quiet describes the children and after lunch is temporal; the skeleton is SVC.'],
      [[['Our teacher','subject'],['showed','predicate'],['us','indirectObject'],['an interesting video.','directObject']], 'structure', 'us 是接受者，video 是所展示的内容，骨架为 SVOO。', 'us is the recipient and the video the content shown, giving SVOO.'],
      [[['The joke','subject'],['kept','predicate'],['everyone','object'],['awake','objectComplement'],['all night.','adverbial','时长状语','Duration adverbial']], 'structure', 'awake 描述 everyone，all night 是状语，骨架为 SVOC。', 'awake describes everyone and all night is adverbial, giving SVOC.']
    ],
    rules: [
      ['先确定谓语是动作动词还是系动词，再判断后项功能。','First decide whether the predicate is an action verb or linking verb, then identify what follows.'],
      ['只把动词意义和结构要求的成分放入骨架，修饰性成分另标。','Include only elements required by the verb’s meaning and structure in the skeleton; label modifiers separately.'],
      ['用“描述主语、承受动作、接受事物、说明宾语”等关系交叉验证。','Cross-check with relations such as describing the subject, receiving an action, receiving a thing or describing the object.']
    ],
    questions: [
      ['The children became quiet after lunch. 的骨架是什么？','What is the skeleton of “The children became quiet after lunch”?',['SVC','SVO'],'A','became 是系动词，quiet 是主语补语。','became is linking and quiet is a subject complement.'],
      ['Our teacher showed us an interesting video. 的骨架是什么？','What is the skeleton of “Our teacher showed us an interesting video”?',['SVOO','SVOC'],'A','us 接收 video，是双宾关系。','us receives the video, forming two objects.'],
      ['The joke kept everyone awake all night. 中 awake 是什么？','What is “awake” in “The joke kept everyone awake all night”?',['宾语补语','时间状语'],'A','awake 描述宾语 everyone 的状态。','awake describes the object everyone.']
    ]
  },
  {
    id: 'pattern-boundaries', level: 'advanced', title: ['基本句型的边界', 'Boundaries of basic sentence patterns'], meta: ['句型看主句骨架，从句类型另行分析', 'Patterns describe the main skeleton; clause types are analysed separately'],
    examples: [
      [[['I','subject'],['know','predicate'],['that she is right.','object','宾语从句','Object clause']], 'boundary', '主句骨架是 SVO；that she is right 是占据宾语位置的从句，其内部另有 SVC 骨架。', 'The main clause is SVO; the object clause has its own internal SVC skeleton.'],
      [[['What he said','subject','主语从句','Subject clause'],['surprised','predicate'],['me.','object']], 'boundary', '主语从句整体占主语位置；主句骨架仍是 SVO。', 'The subject clause occupies the subject slot as a whole; the main skeleton is still SVO.'],
      [[['The girl who won','subject','含定语从句的主语','Subject containing a relative clause'],['is','linking'],['my sister.','subjectComplement']], 'boundary', 'who won 修饰 girl；它是定语从句，不是第六种基本句型。', 'who won modifies girl; it is a relative clause, not a sixth basic pattern.']
    ],
    rules: [
      ['基本句型描述一个分句的核心成分排列，不等同于简单句、并列句或复合句分类。','A basic pattern describes the core arrangement within a clause; it is not the same as simple, compound or complex sentence classification.'],
      ['名词性从句可整体占主语、宾语或补语槽位，并在内部拥有自己的句型。','A nominal clause can fill a subject, object or complement slot and has its own internal pattern.'],
      ['定语从句和状语从句是修饰性从句类型，不应增列为新的基本句型。','Relative and adverbial clauses are modifying clause types, not additional basic sentence patterns.']
    ],
    questions: [
      ['I know that she is right. 的主句骨架是什么？','What is the main-clause skeleton of “I know that she is right”?',['SVO','SVC'],'A','宾语从句整体作 know 的宾语。','The object clause as a whole is the object of know.'],
      ['What he said surprised me. 中 What he said 整体作什么？','What role does “What he said” play as a whole?',['主语','状语'],'A','主语从句整体占主语槽位。','The subject clause fills the subject slot.'],
      ['who won 在 The girl who won is my sister. 中是什么？','What is “who won” in “The girl who won is my sister”?',['定语从句','新的基本句型'],'A','它后置修饰 girl，不属于基本句型类别。','It postmodifies girl and is not a basic pattern category.']
    ]
  }
];

const sectionSpecs = [
  ['skeleton-foundation', '骨架识别基础', 'Skeleton foundations', '先找谓语和必要成分，建立判型步骤。', 'Find predicates and required elements before classifying.', ['find-predicate-skeleton','linking-transitivity']],
  ['five-basic-patterns', '五大基本句型', 'The five basic patterns', '系统掌握 SV、SVC、SVO、SVOO 和 SVOC。', 'Master SV, SVC, SVO, SVOO and SVOC systematically.', ['pattern-sv','pattern-svc','pattern-svo','pattern-svoo','pattern-svoc']],
  ['special-required-patterns', '特殊与必要补足结构', 'Special and required-complement patterns', '处理存在句与必要状语型结构。', 'Handle existential clauses and patterns with obligatory adverbials.', ['existential-there-be','obligatory-adverbial']],
  ['pattern-distinctions', '易混句型辨析', 'Pattern distinctions', '区分双宾、宾补及不同动词用法。', 'Distinguish double objects, object complements and variable verb uses.', ['svoo-vs-svoc','one-verb-many-patterns']],
  ['extensions-transformations', '扩展与结构转换', 'Extensions and transformations', '看清修饰语、否定疑问、被动和共享成分下的不变关系。', 'Trace stable relations through modifiers, transformations and shared elements.', ['modifiers-preserve-skeleton','transformations-skeleton','coordination-sharing']],
  ['integration-boundaries', '综合判断与边界', 'Integration and boundaries', '综合判型，并与从句类型划清边界。', 'Classify integrated examples and separate patterns from clause types.', ['integrated-pattern-choice','pattern-boundaries']]
];

function validateSections(course) {
  const courseIds = course.map((item) => item.id);
  const sectionIds = sectionSpecs.flatMap((item) => item[5]);
  if (sectionIds.length !== courseIds.length || new Set(sectionIds).size !== sectionIds.length || courseIds.some((id) => !sectionIds.includes(id)) || sectionIds.some((id) => !courseIds.includes(id))) throw new Error('Invalid basic-sentence-pattern section coverage');
}

function buildBasicSentencePatternsCourse(english) {
  const course = lessonSpecs.map((spec, index) => makeLesson(english, spec, index));
  validateSections(course);
  const sections = sectionSpecs.map((item) => ({
    id: item[0],
    title: pick(english, item[1], item[2]),
    copy: pick(english, item[3], item[4]),
    lessonIds: item[5].slice(),
    lessonCount: item[5].length
  }));
  const core = course.filter((item) => item.level === 'core');
  const advanced = course.filter((item) => item.level === 'advanced');
  return {
    title: pick(english, `基本句型 · ${course.length} 节微课`, `Basic sentence patterns · ${course.length} lessons`),
    copy: pick(english, '从谓语和必要成分出发，看懂五大句型、特殊结构、转换与边界。', 'Start from predicates and required elements to master the five patterns, special structures, transformations and boundaries.'),
    course,
    sections,
    groups: [
      { id: 'core', title: pick(english, `核心必学 · ${core.length} 节`, `Core · ${core.length} essential lessons`), copy: pick(english, '判型必需的骨架、五大句型和高频辨析。', 'Essential skeletons, five patterns and high-frequency distinctions.'), lessons: core },
      { id: 'advanced', title: pick(english, `进阶挑战 · ${advanced.length} 节`, `Advanced · ${advanced.length} challenge lessons`), copy: pick(english, '结构转换、共享成分、综合判断与知识边界。', 'Transformations, shared elements, integrated classification and boundaries.'), lessons: advanced }
    ]
  };
}

module.exports = { buildBasicSentencePatternsCourse };
