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
  modal: ['情态动词', 'Modal verb'],
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
    title: ['基本句型的本质：分句骨架', 'The core of basic patterns: clause skeletons'],
    meta: ['先找限定谓语，再看它需要哪些核心成分', 'Find the finite predicate, then the core elements it requires'],
    examples: [
      [[['Birds','subject'],['fly.','predicate']], 'structure', 'fly 是限定谓语；Birds 是它的主语。', 'fly is the finite predicate and Birds is its subject.'],
      [[['She','subject'],['can','modal'],['sing.','predicate']], 'structure', 'can 和 sing 共同组成一个完整谓语；can 承担限定作用，sing 表示具体动作。', 'can and sing form one full predicate: can is finite and sing carries the lexical meaning.'],
      [[['The boy','subject'],['in blue','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','auxiliary'],['running.','predicate']], 'structure', 'in blue 在主语短语内部修饰 boy；is 和 running 组成完整谓语，主干是 The boy is running。', 'in blue modifies boy inside the subject phrase; is and running form the full predicate in The boy is running.']
    ],
    rules: [
      ['基本句型是一个分句的核心骨架；先找限定谓语，再找与它搭配的主语。','A basic pattern is the core skeleton of one clause; first find its finite predicate and subject.'],
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
      [[['The baby','subject'],['cried.','predicate']], 'structure', 'cried 后不需要宾语或补语，The baby cried 已经表达完整，骨架是 SV。', 'cried needs no object or complement; The baby cried is complete, so the skeleton is SV.'],
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
      [[['Mia','subject'],['is','linking'],['a doctor.','subjectComplement']], 'structure', 'is 不把动作传给 a doctor，而是把 Mia 和她的身份 a doctor 连接起来。', 'is transfers no action to a doctor; it links Mia with the identity a doctor.'],
      [[['The soup','subject'],['tastes','linking'],['delicious.','subjectComplement']], 'structure', 'tastes 不表示“品尝某物”，而是连接 soup 与 delicious。', 'tastes links soup to delicious rather than taking an object.'],
      [[['The leaves','subject'],['turned','linking'],['yellow.','subjectComplement']], 'structure', 'turned 表示状态变化，yellow 描述主语。', 'turned marks a change of state and yellow describes the subject.']
    ],
    rules: [
      ['名词性主语补语说明主语的身份，系动词把二者连接起来。','A nominal subject complement identifies the subject, and the linking verb connects them.'],
      ['感官动词作系动词时，后面的主语补语描述主语呈现的状态。','A sense verb used as a linking verb takes a subject complement describing the subject.'],
      ['变化动词作系动词时，主语补语说明主语变化后的状态。','A change-of-state linking verb takes a complement showing the subject’s resulting state.']
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
      [[['Leo','subject'],['opened','predicate'],['the window.','object']], 'structure', 'opened 把动作指向 the window；the window 是直接宾语，骨架是 SVO。', 'opened directs the action at the window; the window is the direct object, giving SVO.'],
      [[['We','subject'],['enjoy','predicate'],['music.','object']], 'structure', 'music 不是具体承受动作的物体，但它是 enjoy 所涉及的内容，仍然是宾语。', 'music is not physically affected, but it is the content involved in enjoy and is still the object.'],
      [[['She','subject'],['understood','predicate'],['the question.','object']], 'structure', 'understood 是及物动词，the question 是它的直接宾语。', 'understood is transitive and the question is its direct object.']
    ],
    rules: [
      ['SVO 的及物谓语后需要一个宾语承受或涉及动作。','In SVO, a transitive predicate takes one object affected or involved in the action.'],
      ['宾语可以表示具体事物，也可以表示抽象内容。','An object may denote a concrete thing or abstract content.'],
      ['判断 SVO 要确认谓语是及物用法，后面的名词性成分直接受它支配。','To identify SVO, confirm that the verb is transitive and directly governs the following nominal element.']
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
      [[['She','subject'],['taught','predicate'],['us','indirectObject'],['English.','directObject']], 'structure', 'teach 可以直接接“学习者＋所教内容”：us 是间接宾语，English 是直接宾语。', 'teach can take learner plus content directly: us is the indirect object and English the direct object.'],
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
      [[['There','existential'],['is','predicate'],['a book','subject','实义主语','Notional subject'],['on the desk.','adverbial','地点状语','Place adverbial']], 'translation', 'there 只负责引出“存在”，真正被引出的主语是 a book；中文通常按“地点＋有＋事物”表达。', 'there introduces existence, while a book is the notional subject; Chinese commonly puts the place before an existential verb and the thing.'],
      [[['There','existential'],['are','predicate'],['two students','subject','实义主语','Notional subject'],['outside.','adverbial','地点状语','Place adverbial']], 'structure', '真正被引出的主语 two students 是复数，所以谓语用 are；outside 只说明地点。', 'The notional subject two students is plural, so the verb is are; outside only gives the location.'],
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
      ['put 表示“把某物放到某处”时，除宾语外还要求地点或方向状语。','When put means placing something somewhere, it requires a place or direction adverbial after the object.'],
      ['时长介词短语补足持续意义时仍是状语，不是直接宾语。','A duration prepositional phrase that completes a durative meaning is still an adverbial, not a direct object.'],
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
      [[['The girl','subject'],['with a red bag','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['smiled','predicate'],['warmly.','adverbial','方式状语','Manner adverbial']], 'translation', 'with a red bag 后置修饰 girl，中文通常前移为“背红包的女孩”；warmly 说明微笑方式，骨架仍是 The girl smiled。', 'with a red bag postmodifies girl and warmly gives manner; neither changes the skeleton The girl smiled.'],
      [[['The book','subject'],['that you lent me','attribute','定语从句','Relative clause'],['is','linking'],['useful.','subjectComplement']], 'translation', 'that you lent me 整体后置修饰 book，内部有 you—lent—me 的骨架；主句仍是 The book is useful。', 'that you lent me as a whole postmodifies book and has its own internal skeleton; the main clause remains The book is useful.'],
      [[['Yesterday,','adverbial','时间状语','Time adverbial'],['Tom','subject'],['quickly','adverbial','方式状语','Manner adverbial'],['finished','predicate'],['his homework.','object']], 'structure', 'Yesterday 和 quickly 分别说明时间和方式；移开它们，SVO 骨架 Tom finished his homework 不变。', 'Yesterday and quickly add time and manner; removing them leaves the SVO skeleton Tom finished his homework.']
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
      [[['She','subject'],['does','auxiliary'],['not','adverbial','否定词','Negative marker'],['like','predicate'],['coffee.','object']], 'transformation', 'does 承担限定作用，not 构成否定，实义动词 like 仍支配宾语 coffee。', 'does carries finiteness, not marks negation, and the lexical verb like still governs coffee.'],
      [[['Did','auxiliary'],['Tom','subject'],['open','predicate'],['the door?','object']], 'transformation', '疑问句发生助动词倒装，恢复陈述顺序可看出 Tom opened the door。', 'Auxiliary inversion forms the question; restore statement order to see Tom opened the door.'],
      [[['The door','subject'],['was','auxiliary'],['opened','predicate','过去分词','Past participle'],['by Tom.','adverbial','施事介词短语','Agent phrase']], 'transformation', 'was 和 opened 组成被动谓语；主动句宾语 the door 变为当前句主语，by Tom 表示施事。', 'was and opened form the passive predicate; the active object becomes the current subject and by Tom marks the agent.']
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
      ['ring 不带宾语、表示“铃响”时是不及物用法，形成 SV。','ring is intransitive and forms SV when it means that a bell sounds with no object.'],
      ['ring 直接支配宾语、表示“按响某物”时是及物用法，形成 SVO。','ring is transitive and forms SVO when it directly governs the thing caused to ring.'],
      ['sound 后接描述主语的成分时作系动词，形成 SVC。','sound is a linking verb and forms SVC when followed by an element describing the subject.']
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
      ['两个动词后成分若是“接受者＋事物”，就构成间接宾语和直接宾语。','When two postverbal elements mean recipient plus thing, they form indirect and direct objects.'],
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
      [[['The girl','subject'],['who won','attribute','定语从句','Relative clause'],['is','linking'],['my sister.','subjectComplement']], 'boundary', 'who won 内部是 SV 骨架，整体只后置修饰 girl；主句骨架是 The girl is my sister。', 'who won has an internal SV skeleton but as a whole only postmodifies girl; the main skeleton is The girl is my sister.']
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

const FIVE_PATTERN_NARRATIONS = {
  'pattern-sv': {
    id: 'basic-sentence-patterns:pattern-sv',
    version: 'v2',
    text: `The baby cried。<#0.7#>先看谁，The baby，也就是这个宝宝。再看他怎么了，cried，哭了。说到这里，意思已经完整：宝宝哭了。后面不需要再补“哭了谁”或者“哭了什么”。这种只有“谁，加上做了什么”的骨架，叫主谓结构，也就是 SV。<#0.8#>
再看 The train arrived at noon。<#0.7#>at noon 只告诉我们什么时候到。把这段时间信息暂时遮住，火车到达这件事仍然完整，所以 at noon 不会把主谓结构变成别的句型。<#0.8#>
My grandparents live in Suzhou 也是一样。<#0.6#>in Suzhou 补充爷爷奶奶住在哪里。就算暂时不说地点，“爷爷奶奶居住”这个核心意思也已经成立。而且地点前有介词 in，不能因为它放在动词后面，就把 Suzhou 当成宾语。
判断 SV，可以做两步。先找“谁”和“怎么了”；再把时间、地点、方式这些补充信息暂时遮住。如果剩下的意思已经站得住，而且动词后不需要一个对象，这个动词在这里就是不及物用法，句子骨架就是 SV。`,
    lengthText: '413 字 · 约 2 分钟'
  },
  'pattern-svc': {
    id: 'basic-sentence-patterns:pattern-svc',
    version: 'v1',
    text: `Mia is a doctor。<#0.7#>这句话不是说 Mia 做了一个叫 is 的动作，而是在说 Mia 是谁。is 像一座桥，把 Mia 和 a doctor 连在一起。桥后面的 a doctor 说明 Mia 的身份。这样的骨架叫主系表，也就是 SVC。<#0.8#>
再看 The soup tastes delicious。<#0.7#>这里不是“汤正在品尝美味的东西”。真正的意思是，这个汤尝起来很美味。delicious 描写的是前面的 soup，tastes 仍然只负责把两边连起来。<#0.8#>
The leaves turned yellow 说的是树叶变黄了。<#0.6#>yellow 说明树叶变化后的样子，turned 在这里表示“变得”，所以它也是连接作用。
判断 SVC，不要一看到动词就找动作对象。先问后面的内容是在回答“主语是谁”还是“主语怎么样”。如果答案是，而且中间的动词只是在连接身份、状态或变化，这个动词就叫系动词，后面说明主语的部分叫表语，也叫主语补语。可以把句子理解成“主语，等于或呈现出，后面的身份和状态”。这条关系成立，骨架就是 SVC。`,
    lengthText: '423 字 · 约 2 分钟'
  },
  'pattern-svo': {
    id: 'basic-sentence-patterns:pattern-svo',
    version: 'v3',
    text: `有些动词说完以后，意思还没结束。Leo opened the window。<#0.6#>先找到动作 opened，再问：打开了什么？答案是 the window。如果没有这个对象，听者会自然追问。the window 是 opened 直接指向的东西，语法上叫直接宾语。整个骨架是主谓宾，也就是 SVO。<#0.8#>
宾语不一定真的被碰到。We enjoy music。<#0.6#>music 没有承受一个看得见的动作，但它是 enjoy 所指向的内容，所以仍然是宾语。She understood the question 也一样，理解的内容是 the question。<#0.8#>
这三个例句里，宾语都直接跟在动词后面，中间没有介词。判断时不能只看位置，还要确认它是不是动作、想法或感受直接指向的内容。
判断 SVO，先找到动词，再问：这个动作、想法或感受直接指向谁，或者什么？如果不说出这个对象，意思会明显缺一块，而且对象直接由动词带出，中间没有介词，它就是直接宾语。主语、动词、这一个宾语合起来，就是 SVO。`,
    lengthText: '409 字 · 约 2 分钟'
  },
  'pattern-svoo': {
    id: 'basic-sentence-patterns:pattern-svoo',
    version: 'v2',
    text: `Dad gave me a camera。<#0.7#>先别急着数动词后有几个词，先看发生了什么：爸爸给出一台相机，相机到了我这里。给的是什么？a camera。给了谁？me。一个是被传递的东西，一个是接收的人，所以句子有两个宾语，骨架叫主谓双宾，也就是 SVOO。<#0.8#>
在这个结构里，a camera 是动作直接涉及的东西，叫直接宾语；me 是接收者，叫间接宾语。虽然 me 排在前面，但“间接”和“直接”不是按前后顺序随便命名，而是看它们和动作的关系。<#0.8#>
She taught us English 也能这样看。教的内容是 English，学习这些内容的人是 us。
再看 I bought a gift for my mother。<#0.6#>这里 a gift 是直接宾语，for my mother 前面有 for，是一个介词短语。它仍然说明受益的人，却不是无介词连接的间接宾语，所以这句不算双宾结构。
判断 SVOO，就问两个问题：传递的是什么？接收者是谁？如果动词能够直接带出“接收者，加上事物或内容”，没有 to 或 for 隔开，这通常就是双宾结构。`,
    lengthText: '428 字 · 约 2 分钟'
  },
  'pattern-svoc': {
    id: 'basic-sentence-patterns:pattern-svoc',
    version: 'v2',
    text: `They elected Amy captain。<#0.7#>动作指向 Amy，所以 Amy 是宾语。可句子还想告诉我们：Amy 被选成了什么？答案是 captain。captain 不是第二个被选出来的东西，而是在说明 Amy 的新身份。这样的骨架叫主谓宾补，也就是 SVOC。<#0.8#>
再看 The news made him happy。<#0.7#>him 是消息影响的人，happy 说明他后来是什么状态。him 和 happy 之间可以理解成“他变得开心”。后面的 happy 就是在补充说明宾语。<#0.8#>
I saw the bird fly away 也是同一条关系。<#0.6#>看到的是 the bird，而 fly away 告诉我们鸟做了什么。这里不是两个宾语。
最容易混的是把最后两部分都当成宾语。其实这里的后半部分不是另一个对象，而是在补充宾语的身份、状态或动作。两部分之间有说明与被说明的关系。<#0.8#>
判断 SVOC，可以把宾语和最后一部分看成一组小关系：最后一部分是否在说明这个宾语是谁、怎么样或做了什么？如果是，它就叫宾语补语，整个骨架就是 SVOC。`,
    lengthText: '421 字 · 约 2 分钟'
  }
};

const REMAINING_PATTERN_NARRATIONS = {
  'existential-there-be': {
    id: 'basic-sentence-patterns:existential-there-be', version: 'v1',
    text: `走进一间屋子，想告诉别人桌上有一本书，英语会先把“有东西存在”这件事引出来。<#0.5#>There is a book on the desk。<#0.8#>开头的 There 不是“那里”的地点意思，它像一个开场提示：接下来要出现某样东西。真正被介绍出来的是 a book，所以它才是实义主语；on the desk 只补充书在哪里。<#0.8#>再看 There are two students outside。<#0.6#>这次出现的是 two students，数量是复数，因此前面的 be 动词用 are。outside 告诉我们人在什么地方，不负责决定单复数。判断时不要让最前面的 There 迷惑，要把目光移到 be 后面的名词短语。<#0.8#>There seems to be a problem 又多了一层语气。<#0.6#>它不是直接断定“有问题”，而是说“似乎有一个问题”。可见存在句不只会出现 is 或 are，也能用 seems to be 表达说话人的判断。<#0.8#>这类句子可以抓住三步：先认出 There 只是引出存在；再找 be 后真正出现的人或物；最后把地点放回去。中文常把地点放前面说“某处有某物”，英语则先用 There 打开这个存在画面。`, lengthText: '450 字 · 约 2 分钟'
  },
  'obligatory-adverbial': {
    id: 'basic-sentence-patterns:obligatory-adverbial', version: 'v1',
    text: `有些地点、时长信息只是锦上添花，有些却是动词把意思说完整时少不了的一块。<#0.6#>She put the keys on the table。<#0.8#>put 表示把东西放到某处。the keys 说明放了什么，on the table 说明放到哪里。只听到“她把钥匙放了”，你会自然追问放在哪儿，所以这个地点信息在当前用法里是必需的。<#0.8#>The meeting lasted for two hours。<#0.6#>for two hours 给出会议持续的时长。这里不是动作指向一个宾语，而是 lasted 需要时长信息把“持续多久”交代清楚。<#0.8#>再看 He lives in Shanghai。<#0.6#>in Shanghai 说明居住地点。live 在这里表达“居住”，地点和动词的意义紧密相连；它虽然形式上是介词短语，却不能只因为带介词就随手删掉。<#0.8#>判断必要状语，不能只看它在句末，也不能只看它是不是介词短语。先找谓语，再暂时拿走后面的地点或时长信息。如果拿走后，听者一定会追问“放哪儿、持续多久、住哪儿”，这部分就是骨架所需的必要状语。`, lengthText: '419 字 · 约 2 分钟'
  },
  'linking-transitivity': {
    id: 'basic-sentence-patterns:linking-transitivity', version: 'v1',
    text: `同一个动词长得一样，在不同句子里却可能承担完全不同的任务，不能给它贴一张永久标签。<#0.6#>The flowers smell sweet。<#0.8#>这里不是花朵主动去闻什么，sweet 描写的是 flowers 的气味状态。smell 只把主语和这种状态连起来，所以它是系动词，句子是主系表。<#0.8#>再看 She smelled the flowers。<#0.6#>这次 She 做出“闻”的动作，动作直接指向 the flowers。smelled 成了及物动词，the flowers 是宾语，骨架也变成主谓宾。<#0.8#>The door opened。<#0.6#>opened 后面没有宾语，却已经说清“门开了”。门是发生变化的对象，但在句子结构里它是主语；opened 在这里是不及物用法，骨架是主谓。<#0.8#>所以判句型要从当前句子取证。先问动词是在连接主语的状态，还是在表达动作；如果是动作，再问它有没有直接指向的对象。关系变了，句型也会跟着变。`, lengthText: '372 字 · 约 2 分钟'
  },
  'svoo-vs-svoc': {
    id: 'basic-sentence-patterns:svoo-vs-svoc', version: 'v1',
    text: `动词后面连续出现两块内容，不代表一定是双宾语。真正要看的是：后两块是在完成一次传递，还是后一块在说明前一块。<#0.6#>She sent me a message。<#0.8#>sent 表示传递。a message 是被发送的内容，me 是接收的人。“给谁，加上什么”组成双宾语，所以骨架是主谓双宾。<#0.8#>They named the baby Leo。<#0.6#>这里没有两样东西被命名。the baby 是动作指向的宾语，Leo 说明这个宝宝被取了什么名字。Leo 和 the baby 是说明与被说明的关系，因此 Leo 是宾语补语，骨架是主谓宾补。<#0.8#>We found the task difficult。<#0.6#>the task 是发现所涉及的对象，difficult 描写这个任务呈现出的状态。它也不是接收者和事物，而是“宾语怎么样”。<#0.8#>判断时别数词，直接测试关系。能问“给谁、给什么”，后两项彼此独立，是双宾语；后一项在说明这个宾语是谁或怎么样，就是宾补。`, lengthText: '380 字 · 约 2 分钟'
  },
  'modifiers-preserve-skeleton': {
    id: 'basic-sentence-patterns:modifiers-preserve-skeleton', version: 'v1',
    text: `句子一长，最容易把所有词都算进基本句型。更稳的办法，是先把修饰信息轻轻拿开，看看核心关系还剩什么。<#0.6#>The girl with a red bag smiled warmly。<#0.8#>with a red bag 帮我们认出是哪一个 girl，warmly 说明笑的方式。真正的骨架只有 girl 和 smiled，是主谓结构；定语、状语再长，也不增加新的核心槽位。<#0.8#>The book that you lent me is useful。<#0.6#>that you lent me 整体跟在 book 后面，限定是哪本书。主句真正说的是这本书“是有用的”，is 连接主语和 useful，所以外层骨架是主系表。<#0.8#>Yesterday, Tom quickly finished his homework。<#0.6#>Yesterday 是时间，quickly 是方式；它们都在补充 finished。his homework 才是动作直接指向的宾语，核心骨架是主谓宾。<#0.8#>操作时按顺序做：先找完整谓语；再圈出它必需的主语、宾语或补语；最后把时间、地点、方式和名词旁的修饰语挂回去。修饰语让画面更具体，却不会凭空创造新句型。`, lengthText: ''
  },
  'transformations-skeleton': {
    id: 'basic-sentence-patterns:transformations-skeleton', version: 'v1',
    text: `句子变成否定、疑问或被动以后，单词位置和动词形式会变化，但谁和谁发生关系，仍然能追踪。<#0.6#>She does not like coffee。<#0.8#>does 和 not 帮助构成否定，真正表达“喜欢”的是 like，coffee 仍是这个动作直接涉及的宾语。因此加入否定，没有把主谓宾骨架变掉。<#0.8#>Did Tom open the door？<#0.6#>Did 被提前，用来发问；open 还原成原形。判断时要把 Did 和 open 合起来看成完整谓语，Tom 仍是主语，the door 仍是宾语。疑问语序不能把三个关系打乱。<#0.8#>The door was opened by Tom。<#0.6#>被动句把承受动作的 the door 放到主语位置，was opened 是完整谓语；by Tom 补出动作执行者。这里要按句子当前结构判断，而不是只看中文里谁做事。<#0.8#>遇到转换句，先找助动词和主要动词组成的完整谓语，再追问当前主语是谁、动作指向谁。形式变化是外壳，核心关系才是判型证据。`, lengthText: ''
  },
  'one-verb-many-patterns': {
    id: 'basic-sentence-patterns:one-verb-many-patterns', version: 'v1',
    text: `查到一个动词时，不能顺手在旁边写上“它永远属于某个句型”。句型属于整个句子，不属于一个孤零零的单词。<#0.6#>The bell rang。<#0.8#>rang 表示铃响了，后面不需要对象，意思已经完整，所以这里是不及物用法，骨架是主谓。<#0.8#>She rang the bell。<#0.6#>这次是她按响或摇响了铃。动作直接指向 the bell，rang 变成及物用法，the bell 是宾语，骨架是主谓宾。词形几乎没变，搭配关系已经变了。<#0.8#>The idea sounds reasonable。<#0.6#>sounds 不是“发出声音给某个对象”，而是把 The idea 和 reasonable 连起来，说明这个想法听起来合理。reasonable 描写主语，因此 sounds 在这里是系动词，骨架是主系表。<#0.8#>判断时每次都从零开始：先看动词在当前语境表达动作还是连接状态；再看后面是否有动作直接指向的对象。句内关系才是答案。`, lengthText: ''
  },
  'coordination-sharing': {
    id: 'basic-sentence-patterns:coordination-sharing', version: 'v2',
    text: `看到句子里有 and 和两个动词，不要马上宣布“这里有两个完整分句”。并列成分常常会共用前面已经出现的信息。<#0.6#>Tom opened the door and walked in。<#0.8#>opened 和 walked in 都由 Tom 发出，第二个动作没有再写一个主语。这里是同一个主语带两个并列谓语，不是两个各自写全主语的分句。<#0.8#>Mia washed and dried the dishes。<#0.6#>washed 和 dried 不但共用主语 Mia，还共用后面的 the dishes。碗碟同时是“洗”和“擦干”所涉及的对象，不能只把它连给离得最近的 dried。<#0.8#>Leo gave Amy a pen and a notebook。<#0.6#>这次 and 连接的不是两个谓语，而是 a pen 和 a notebook 两个直接宾语。它们共用 gave 和接收者 Amy。<#0.8#>判断并列时，先看 and 两边形式相当的是什么，再把省略信息补到脑中。连词连接哪一级，句子就在哪一级并列；动词多，不等于分句一定多。`, lengthText: ''
  },
  'integrated-pattern-choice': {
    id: 'basic-sentence-patterns:integrated-pattern-choice', version: 'v1',
    text: `综合判型时，不靠“看起来像”，而是沿着固定路线找证据：先谓语，再必需成分，最后排除修饰语。<#0.6#>The children became quiet after lunch。<#0.8#>became 表示状态变化，quiet 描写 children 变得怎么样；after lunch 只交代时间。因此核心是主语、系动词和表语，也就是 SVC。<#0.8#>Our teacher showed us an interesting video。<#0.6#>showed 表示展示，an interesting video 是展示的内容，us 是接收内容的人。“给谁看什么”形成两个宾语，所以骨架是 SVOO。<#0.8#>The joke kept everyone awake all night。<#0.6#>everyone 是 kept 直接涉及的对象，awake 说明 everyone 保持什么状态；all night 只补充持续时长。后两项是“宾语怎么样”，所以 awake 是宾补，骨架是 SVOC。<#0.8#>三句表面都在动词后带了不止一块内容，但关系不同。先拿走时间等状语，再问后面的成分是在说明主语、完成传递，还是说明宾语。`, lengthText: ''
  },
  'pattern-boundaries': {
    id: 'basic-sentence-patterns:pattern-boundaries', version: 'v1',
    text: `基本句型只描述一个分句的核心骨架，并不等于把整句贴成“简单句、复合句”这些类别。句子里有从句时，要先看它整体占什么位置，再进到内部分析。<#0.6#>I know that she is right。<#0.8#>主句里 I 是主语，know 是谓语，that she is right 整体回答“知道什么”，占宾语位置，所以主句骨架是 SVO。从句内部还有自己的结构，但不能和外层混着数。<#0.8#>What he said surprised me。<#0.6#>What he said 虽然内部有多个词，却整体站在 surprised 前，承担主语；me 是宾语。外层仍是 SVO。先框出从句边界，比逐词抢位置更重要。<#0.8#>The girl who won is my sister。<#0.6#>who won 跟在 girl 后面，帮助确定是哪位女孩，整体作后置定语。主句中 is 连接 The girl 和 my sister，所以外层是 SVC。<#0.8#>遇到复杂句，先用括号把从句当成一个大块，判断它在外层是主语、宾语还是修饰语；完成主句判型后，再进入从句内部。这是两张不同的地图。`, lengthText: ''
  }
};

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
  course[0].narration = {
    id: 'basic-sentence-patterns:find-predicate-skeleton',
    version: 'v3',
    text: `句子有长有短，先别数单词。把修饰和补充信息暂时放到一边，留下能撑住意思的部分，就是句子的骨架；不同骨架，就是不同的基本句型。<#0.8#>
Birds fly。<#0.8#>谁在飞？Birds。发生了什么？fly。说到这里意思已经完整，fly 后面不缺动作对象，所以骨架只有主语和谓语，叫主谓结构，简写为 SV。<#0.8#>
She can sing。<#0.8#>句子里虽然有 can 和 sing 两个动词形式，却不能算成两个谓语。can 表示“能”，sing 说出具体动作，两部分合起来才是完整的谓语动词组。主语仍是 She，骨架仍然是 SV。<#0.8#>
The boy in blue is running。<#0.8#>先找谁在跑，答案是 The boy。in blue 只是帮助我们认出“穿蓝衣服的那个男孩”，它在主语内部修饰 boy。is running 要合起来看，表示正在跑。暂时拿开 in blue，核心关系没有改变。<#0.8#>
判断基本句型时，先找到完整的谓语动词组；再问“谁怎么了”，以及谓语后面是否还必须补什么；最后把时间、地点、方式和名词旁的修饰信息暂时移开。剩下的必需成分，才决定句型。`,
    lengthText: '433 字 · 约 2 分钟'
  };
  Object.entries(FIVE_PATTERN_NARRATIONS).forEach(([lessonId, narration]) => {
    const lesson = course.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`Missing narrated basic pattern lesson: ${lessonId}`);
    lesson.narration = Object.assign({}, narration);
  });
  Object.entries(REMAINING_PATTERN_NARRATIONS).forEach(([lessonId, narration]) => {
    const lesson = course.find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`Missing narrated basic pattern lesson: ${lessonId}`);
    const narrationCopy = Object.assign({}, narration);
    if (!narrationCopy.lengthText) {
      const spokenLength = Array.from(narrationCopy.text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '')).length;
      narrationCopy.lengthText = `${spokenLength} 字 · 约 2 分钟`;
    }
    lesson.narration = narrationCopy;
  });
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
