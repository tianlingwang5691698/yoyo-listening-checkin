const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const labels = {
  subject: ['主语','Subject'], auxiliary: ['助动词','Auxiliary'], modal: ['情态动词','Modal'], predicate: ['谓语动词','Predicate verb'],
  nonfinite: ['非谓语动词','Non-finite verb'], object: ['宾语','Object'], predicative: ['表语','Subject complement'],
  attribute: ['定语','Attribute'], clause: ['分句','Clause'], substitute: ['谓语替代','Predicate substitute'], ellipsis: ['省略成分','Ellipsis'], adverbial: ['状语','Adverbial'],
  conjunction: ['连词','Conjunction'], operator: ['操作词','Operator'], negator: ['否定词','Negator']
};
const part = (english, item) => ({ text: item[0], role: item[1], label: pick(english, item[2] || (labels[item[1]] || [item[1],item[1]])[0], item[3] || (labels[item[1]] || [item[1],item[1]])[1]) });
const hidden = () => ({ visible:false, mode:'', title:'', body:'', detail:'' });
const note = (english, data) => data ? ({ visible:true, mode:data[0], title:pick(english,'例句说明','Example explained'), body:pick(english,data[1],data[2]), detail:'' }) : hidden();
const q = (english, data) => ({
  question:pick(english,data[0],data[1]), options:[{key:'A',text:pick(english,data[2],data[3])},{key:'B',text:pick(english,data[4],data[5])}], answer:data[6],
  correct:pick(english,data[7],data[8]), wrong:pick(english,`再看规则：${data[7]}`,`Check the rule: ${data[8]}`)
});
const A = (zhRule,enRule,parts,question,noteData) => ({ zhRule,enRule,parts,question,noteData });
const Q = (...args) => args;
const X = (zh,en) => ['structure',zh,en];

const EXPLANATIONS = {
  'finite-boundary': [
    ['works 是本分句唯一带现在时、并随 Mia 使用三单形式的动词，所以它是限定谓语。','works is the only verb marked for present tense and agreement with Mia, so it is the finite predicate.'],
    ['wants 带现在时，是限定谓语；to leave 没有时态，只整体填入 wants 后的宾语位置。','wants carries present tense and is finite; to leave has no tense and fills the object slot after wants.'],
    ['外层先看 I know，know 是主句限定谓语；that 从句内部另有 she agrees，不能把 agrees 算进主句谓语。','At the outer level, know is the main-clause finite predicate; she agrees has its own predicate inside the that-clause.']
  ],
  'auxiliary-chain': [
    ['may 承担限定性和情态，begin 用原形；may begin 合起来才是完整谓语。','may carries finiteness and modality, while begin stays in the base form; together may begin is the complete predicate.'],
    ['may 是限定情态词，have 建立完成，been waiting 建立进行；四个词按“情态—完成—进行—实义动词”组成一个完整谓语。','may is the finite modal, have builds the perfect, and been waiting builds the progressive; all four words form one complete predicate.'],
    ['may 表可能，have 表完成，been repaired 表被动；它们不是三个谓语，而是一条“情态—完成—被动”助动词链。','may marks possibility, have marks perfect aspect, and been repaired marks passive voice; they form one auxiliary chain, not three predicates.']
  ],
  'operator': [
    ['陈述句中的第一个助动词 has 移到主语 she 前，承担疑问操作；has finished 仍共同表达完成体。','The first auxiliary has moves before she to carry the question operation; has finished still forms the perfect predicate.'],
    ['has 是助动词链中第一个词，因此 not 紧跟 has；has not finished 合起来是否定的完整谓语。','has is first in the auxiliary chain, so not follows it; has not finished is the complete negative predicate.'],
    ['原句 likes 没有助动词，疑问时加入 Does；三单标记转移到 Does，like 恢复原形。','The original likes has no auxiliary, so Does is inserted; agreement moves to Does and like returns to the base form.']
  ],
  'agreement-basic': [
    ['主语中心 boy 是第三人称单数，限定谓语 plays 用 -s 与它一致。','The subject head boy is third-person singular, so finite plays carries -s for agreement.'],
    ['主语 I 在现在时与 be 对应为 am；ready 是描述 I 的表语，不参与一致。','Present-tense be agrees with I as am; ready is the subject complement and does not control agreement.'],
    ['Tom 和 Mia 是两个独立的人，and 把它们组成复数主语，因此限定系动词用 are。','Tom and Mia are two separate people joined as a plural subject, so finite linking be is are.']
  ],
  'agreement-head': [
    ['完整主语是 The box of books，中心词是单数 box；of books 只是后置修饰语，所以用 is。','The full subject is The box of books, but its head is singular box; of books only postmodifies it, so the verb is is.'],
    ['together with her friends 是附加说明，没有像 and 那样增加主语核心；限定谓语仍与 Mia 一致，用 is。','together with her friends is an added modifier, not an and-coordinate subject; the finite verb still agrees with Mia as is.'],
    ['外层主干是 She is one of the students；who 在定语从句中指复数 students，所以从句限定谓语用 work。','The outer core is She is one of the students; inside the relative clause, who refers to plural students, so its finite verb is work.']
  ],
  'agreement-proximity-meaning': [
    ['either...or 连接两个主语时看靠近谓语的一项；boys 离 are 最近且为复数，所以用 are。','With either...or subjects, agreement follows the nearer item; plural boys is nearest, so the verb is are.'],
    ['Ten minutes 形式上有复数 -s，但这里表示一个整体时长，所以限定系动词用单数 is。','Ten minutes is plural in form but denotes one duration here, so finite linking be is singular is.'],
    ['Half of 本身不决定单复数；of 后的 water 是不可数名词，所以限定谓语用 is。','Half of does not decide number by itself; water after of is uncountable, so the finite verb is is.']
  ],
  'tense-viewpoint': [
    ['lives 的一般现在时把观察点放在现在，说明居住状态当前成立；now 只是帮助确认语境。','Present-tense lives locates the viewpoint now and presents the residence as currently true; now only confirms the context.'],
    ['is 承担现在时，reading 展示正在展开的过程；is reading 合起来是一个现在进行体谓语。','is carries present tense and reading presents an unfolding process; together is reading is one present-progressive predicate.'],
    ['have 承担现在时，read 表示先前完成；have read 把读书这件事与现在的结果或经验连接起来。','have carries present tense and read presents a prior event; have read links that event to a result or experience relevant now.']
  ],
  'simple-progressive': [
    ['boils 用一般现在时把“水在 100°C 沸腾”作为普遍规律，而不是某一刻正在发生的过程。','boils uses the present simple to present a general truth, not a process unfolding at one moment.'],
    ['is 承担现在时，staying 展示临时持续；this week 限定了这次暂住的时间范围。','is carries present tense and staying presents a temporary ongoing situation; this week sets its limited time frame.'],
    ['understand 在这里表示认知状态，直接用一般现在时；通常不把这种稳定状态写成正在进行。','understand denotes a cognitive state here, so the present simple is natural rather than a progressive process.']
  ],
  'perfect-system': [
    ['has lost 不只是报告过去“丢过”，还把结果连到现在：她现在没有钥匙或仍受影响。','has lost does more than report a past event; it links the loss to the present result that she lacks the key or is still affected.'],
    ['have lived 把居住状态从过去延续到现在，for five years 给出这段延续的总时长。','have lived extends the residence from the past to now, and for five years gives its duration.'],
    ['has 承担现在时，been 建立完成，raining 建立进行；整条谓语突出雨从较早时间持续到现在。','has carries present tense, been builds the perfect, and raining builds the progressive; the whole predicate highlights a process continuing to now.']
  ],
  'past-sequence': [
    ['rang 用一般过去时，把八点响铃作为过去时间线上的主要事件。','rang uses the past simple to place the bell event on the past timeline at eight.'],
    ['arrived 是过去参照点，had left 把火车离开定位在这个参照点之前。','arrived supplies the past reference point, and had left places the departure before it.'],
    ['was cooking 是当时正在展开的背景过程，called 是插入这个背景的较短事件。','was cooking is the unfolding background process, while called is the shorter event that occurs within it.']
  ],
  'future-system': [
    ['will 是限定情态助动词，answer 用原形；will answer 表示说话当下作出的即时决定。','will is the finite modal auxiliary and answer stays in the base form; will answer expresses a decision made at speaking time.'],
    ['are 承担现在时，meeting 用进行体呈现已安排好的见面，tomorrow 把安排指向未来。','are carries present tense, meeting presents an arranged meeting, and tomorrow locates that arrangement in the future.'],
    ['条件从句用 rains 表达未来条件，主句用 will stay 表达条件成立后的结果；两个分句各有自己的限定谓语。','The condition clause uses rains for the future condition, while the main clause uses will stay for its result; each clause has its own finite predicate.']
  ],
  'voice-focus': [
    ['主动句把原因来源 The storm 放在主语位置，damaged 直接指向承受影响的宾语 the roof。','The active clause puts the cause The storm in subject position, and damaged points to the affected object the roof.'],
    ['被动句把承受影响的 roof 提到主语位置；was 承担过去时，damaged 用过去分词表达被动，by 短语补充施事来源。','The passive promotes affected roof to subject; was carries past tense, damaged marks passive voice, and the by-phrase adds the agent.'],
    ['was stolen 已说明 bike 承受偷窃；不知道偷车者且他不是信息重点，因此无需添加空泛的 by someone。','was stolen already presents bike as affected; the thief is unknown and not the focus, so a vague by someone adds nothing.']
  ],
  'passive-chain': [
    ['is 承担现在时并与 room 一致，cleaned 是过去分词；二者合成一般现在时被动谓语。','is carries present tense and agrees with room, while cleaned is the past participle; together they form a present-simple passive.'],
    ['is 承担现在时，being 建立进行，被动 be 再要求 repaired 用过去分词；整条链表示“正在被修”。','is carries present tense, being builds the progressive, and passive be selects past-participle repaired; the chain means “currently being repaired.”'],
    ['has 承担现在时，been 是被动 be 在完成助动词后的形式，finished 用过去分词；整条链表达已完成的被动结果。','has carries present tense, been is passive be after perfect have, and finished is the past participle; the chain presents a completed passive result.']
  ],
  'modal-system': [
    ['can 是本分句的限定情态词，承担可能/能力意义；swim 必须用原形，二者合成完整谓语。','can is the finite modal expressing ability or possibility; swim stays in the base form, and together they form the complete predicate.'],
    ['must 把说话者的强制立场加到 wear a seat belt 上；wear 用原形，must wear 是完整谓语核心。','must adds strong obligation to wear a seat belt; wear is base form, and must wear forms the complete predicate core.'],
    ['may 表示不确定推测，have missed 把推测指向较早发生的“错过”；整条链判断的是过去事件。','may marks uncertain inference, while have missed directs it to the earlier event of missing the train; the chain evaluates a past event.']
  ],
  'semi-modal-system': [
    ['have to 像实义结构一样需要 Do 来形成一般现在时疑问；限定标记在 Do 上，have 和 leave 都用原形。','have to behaves lexically and needs Do for a present question; finiteness is on Do, while have and leave stay in base form.'],
    ['has 是限定完成助动词，been 是 be 的过去分词，able to solve 是其表语内容；不要把 able 当成助动词。','has is the finite perfect auxiliary, been is the participle of be, and able to solve is its subject complement; able is not an auxiliary.'],
    ['used to 本来表示过去习惯；变疑问后过去标记由 Did 承担，因此 used 恢复为 use。','used to expresses a past habit; once Did carries past tense in the question, used returns to base-form use.']
  ],
  'negation-questions': [
    ['系动词 is 本身是限定操作词，not 直接跟在它后面；ready 是表语，因此不需要 does not be。','Linking is is itself the finite operator, so not follows it directly; ready is the subject complement, and do-support is unnecessary.'],
    ['原句 arrived 没有助动词，疑问时加入 Did 并前移；过去标记转到 Did，arrive 恢复原形。','The original arrived has no auxiliary, so Did is inserted and moved forward; past tense shifts to Did and arrive returns to base form.'],
    ['Who 本身占主语位置，called 仍是一般过去时限定谓语；没有另一个主语需要和操作词倒装。','Who itself fills the subject slot and called remains the finite past predicate; there is no separate subject to invert with an operator.']
  ],
  'emphatic-do': [
    ['肯定句加入 do，不改变“理解”的事件，只加强“我确实理解”的确认或反驳语气。','Adding do to the affirmative does not change the event of understanding; it strengthens confirmation or correction.'],
    ['does 同时承担强调、现在时和三单一致，所以后面的实义动词必须是原形 want。','does carries emphasis, present tense and third-person agreement, so the lexical verb must be base-form want.'],
    ['did 同时承担强调和过去时，所以 call 不再使用过去式；did call 合起来表示“昨天确实打了”。','did carries both emphasis and past tense, so call is not past-marked again; did call means that he really called yesterday.']
  ],
  'short-answers-substitution': [
    ['原问句的第一个助动词是 Has，短答保留同一个操作词，并把主语 Mia 换成 she：Yes, she has。','The question’s first auxiliary is Has, so the short answer retains that operator and replaces Mia with she: Yes, she has.'],
    ['than 分句中的 does 保留现在时和与 Tom 的一致，同时替代前文完整谓语 sings，避免重复。','In the than-clause, does carries present tense and agreement with Tom while substituting for sings to avoid repetition.'],
    ['前句完整谓语是 can swim，so can Tom 保留相同情态操作词 can，并省去重复的 swim。','The preceding complete predicate is can swim; so can Tom retains modal operator can and omits repeated swim.']
  ],
  'predicate-sharing-ellipsis': [
    ['has 同时管 finished 和 sent，可还原为 has finished... and has sent...；两个实义动词并列，共享一个完成助动词。','has scopes over both finished and sent, expandable as has finished... and has sent...; the coordinated lexical verbs share one perfect auxiliary.'],
    ['第二分句保留 can 来表示同样的情态和时态关系，play the piano 可从前句准确恢复，所以省略。','The second clause retains can to preserve the same modal and tense relation; play the piano is omitted because it is fully recoverable.'],
    ['others were not 保留被动操作词 were 和否定 not，accepted 可从前一分句恢复；省略后语态关系仍清楚。','others were not retains passive operator were and negator not; accepted is recoverable from the first clause, so passive meaning remains clear.']
  ],
  'predicate-integration': [
    ['may 是唯一限定操作词，have 建立完成，been closed 建立被动；从左到右是一条完整谓语链。','may is the sole finite operator, have builds the perfect, and been closed builds the passive; from left to right they form one complete predicate chain.'],
    ['must 表说话者判断，have 把事件放在较早时间，been completed 表被动；主语 work 是完成动作的承受者。','must marks the speaker’s judgment, have places the event earlier, and been completed marks passive voice; work receives the action.'],
    ['Does 已承担现在时和三单一致，seem 必须恢复原形；reasonable 是 seem 后说明 plan 状态的表语。','Does already carries present tense and third-person agreement, so seem returns to the base form; reasonable is the subject complement describing plan.']
  ]
};
function lesson(english,id,level,zhTitle,enTitle,zhMeta,enMeta,atoms) {
  if (atoms.length < 3) throw new Error(`Too few predicate atoms: ${id}`);
  const explanations = EXPLANATIONS[id];
  if (!explanations || explanations.length !== atoms.length) throw new Error(`Missing predicate explanations: ${id}`);
  return { id,level,title:pick(english,zhTitle,enTitle),meta:pick(english,zhMeta,enMeta),
    examples:atoms.map(a=>a.parts.map(p=>p[0]).join(' ')), analyses:atoms.map(a=>a.parts.map(p=>part(english,p))), exampleNotes:atoms.map((a,i)=>note(english,a.noteData||['structure',explanations[i][0],explanations[i][1]])),
    rules:atoms.map(a=>pick(english,a.zhRule,a.enRule)), ruleCoverage:INCLUDE_RULE_COVERAGE?atoms.map((_,i)=>({exampleIndexes:[i],questionIndexes:[i]})):[], questions:atoms.map(a=>q(english,a.question)) };
}

function buildPredicateSystemCourse(english) {
  const L = (...args) => lesson(english,...args);
  const course = [
    L('finite-boundary','core','谓语的定义与限定核心','Definition and finite core of predicates','一个分句先找带时态或情态的谓语核心','Find the tense- or modal-bearing core of each clause',[
      A('限定谓语体现时态或情态，并与主语建立句法关系。','A finite predicate carries tense or modality and has a syntactic relation with its subject.',[['Mia','subject'],['works','predicate'],['here.','adverbial']],Q('哪个词是限定谓语？','Which word is the finite predicate?','works','works','here','here','A','works 带一般现在时并与 Mia 一致。','works carries present tense and agrees with Mia.')),
      A('非谓语形式不能单独构成独立分句的限定谓语。','A non-finite form cannot alone form the finite predicate of an independent clause.',[['Mia','subject'],['wants','predicate'],['to leave.','nonfinite','不定式作宾语','Infinitive as object']],Q('本句限定谓语是什么？','What is the finite predicate?','wants','wants','to leave','to leave','A','to leave 不带时态，限定谓语是 wants。','to leave has no tense; wants is finite.')),
      A('复合句的每个分句各有自己的限定谓语，不能把从句谓语并入主句谓语。','Each clause in a complex sentence has its own finite predicate; do not merge a subordinate predicate into the main predicate.',[['I','subject'],['know','predicate','主句谓语','Main predicate'],['that she agrees.','complement','宾语从句；agrees 为从句谓语','Object clause; agrees is its predicate']],Q('主句谓语是什么？','What is the main-clause predicate?','know','know','agrees','agrees','A','agrees 属于 that 从句，外层谓语是 know。','agrees belongs inside the that-clause; know is the outer predicate.'))
    ]),
    L('auxiliary-chain','core','助动词链的顺序','Order in the auxiliary chain','情态、完成、进行、被动按固定槽位排列','Modal, perfect, progressive and passive occupy fixed slots',[
      A('情态动词位于助动词链最前，后接动词原形。','A modal comes first in the auxiliary chain and takes a base form.',[['The work','subject'],['may','modal'],['begin','predicate'],['soon.','adverbial']],Q('may 后应使用什么？','What follows may?','动词原形','Base verb','过去式','Past form','A','情态动词后接原形 begin。','A modal takes base-form begin.')),
      A('完成体 have 位于情态之后、进行或被动 be 之前。','Perfect have follows a modal and precedes progressive or passive be.',[['She','subject'],['may','modal'],['have','auxiliary','完成助动词','Perfect auxiliary'],['been','auxiliary','进行助动词的过去分词','Participle of progressive be'],['waiting.','predicate']],Q('哪一个顺序正确？','Which order is correct?','may have been waiting','may have been waiting','may been have waiting','may been have waiting','A','顺序是情态＋完成＋进行＋实义动词。','The order is modal + perfect + progressive + lexical verb.')),
      A('完整链条遵循“情态＋have done＋be doing＋be done＋实义动词”的槽位顺序，实际只使用所需槽位。','The full template is modal + perfect + progressive + passive + lexical verb, using only needed slots.',[['The bridge','subject'],['may','modal'],['have','auxiliary','完成助动词','Perfect auxiliary'],['been','auxiliary','被动助动词','Passive auxiliary'],['repaired.','predicate','过去分词','Past participle']],Q('may have been repaired 同时表达什么？','What does may have been repaired combine?','情态、完成和被动','Modal, perfect and passive','进行和主动','Progressive and active','A','may 表情态，have been 表完成被动链。','may marks modality; have been builds a perfect passive.'))
    ]),
    L('operator','core','谓语操作词','The predicate operator','疑问、否定和倒装操作最前面的助动词','The first auxiliary carries question, negation and inversion operations',[
      A('已有助动词时，第一个助动词承担倒装并移到主语前。','When an auxiliary is present, the first auxiliary carries inversion and moves before the subject.',[['Has','operator','操作词（完成助动词）','Operator (perfect auxiliary)'],['she','subject'],['finished?','predicate']],Q('She has finished 的一般疑问句怎样开头？','How does the question from She has finished begin?','Has she','Has she','Does she have','Does she have','A','已有 has，直接把第一个助动词前移。','Move existing first auxiliary has forward.')),
      A('已有助动词时，not 放在第一个助动词之后。','When an auxiliary is present, not follows the first auxiliary.',[['She','subject'],['has','operator'],['not','negator'],['finished.','predicate']],Q('not 应放在哪里？','Where should not go?','has 后','After has','finished 后','After finished','A','第一助动词 has 是否定操作词。','The first auxiliary has carries negation.')),
      A('一般时实义动词没有助动词时，用 do/does/did 提供操作词，实义动词恢复原形。','When a simple-tense lexical verb has no auxiliary, do/does/did supplies the operator and the lexical verb returns to base form.',[['Does','operator'],['Mia','subject'],['like','predicate'],['tea?','object']],Q('哪句正确？','Which is correct?','Does Mia like tea?','Does Mia like tea?','Does Mia likes tea?','Does Mia likes tea?','A','三单标记由 Does 承担，like 用原形。','Does carries agreement; like returns to base form.'),X('陈述 Mia likes tea → 疑问 Does Mia like tea?','Statement Mia likes tea → question Does Mia like tea?'))
    ]),
    L('agreement-basic','core','基础主谓一致','Basic subject–verb agreement','限定谓语与主语的人称和数一致','The finite verb agrees with the subject in person and number',[
      A('一般现在时中，第三人称单数主语使用相应单数谓语。','In the present simple, a third-person singular subject takes the corresponding singular verb.',[['The boy','subject'],['plays','predicate'],['football.','object']],Q('The boy ___ football.','The boy ___ football.','plays','plays','play','play','A','中心主语 boy 是第三人称单数。','The head subject boy is third-person singular.')),
      A('be 的形式直接随主语人称、数和时间变化。','Forms of be directly reflect the subject’s person, number and time.',[['I','subject'],['am','predicate'],['ready.','complement']],Q('I ___ ready.','I ___ ready.','am','am','is','is','A','第一人称单数现在时用 am。','First-person singular present uses am.')),
      A('and 连接两个独立主语通常构成复数主语。','Two independent subjects joined by and normally form a plural subject.',[['Tom and Mia','subject','并列主语','Coordinated subject'],['are','predicate'],['ready.','complement']],Q('Tom and Mia ___ ready.','Tom and Mia ___ ready.','is','is','are','are','B','两个独立主语并列，谓语用复数。','Two coordinated subjects take a plural verb.'))
    ]),
    L('agreement-head','core','复杂主语找中心词','Finding the head in a complex subject','后置修饰语不改变主语中心词的数','Postmodifiers do not change the number of the subject head',[
      A('of、with 等介词短语修饰主语时，谓语与短语前的中心词一致。','When an of- or with-phrase modifies the subject, agreement follows the preceding head.',[['The box','subject','主语中心词','Subject head'],['of books','complement','主语内部后置定语','Postmodifier inside subject'],['is','predicate'],['heavy.','complement']],Q('The box of books ___ heavy.','The box of books ___ heavy.','is','is','are','are','A','中心词 box 是单数。','The head box is singular.')),
      A('together with、as well as、along with 引入附加成分，不构成 and 式复数主语。','together with, as well as and along with introduce additions, not an and-type plural subject.',[['Mia, together with her friends,','subject'],['is','predicate'],['here.','adverbial']],Q('Mia, together with her friends, ___ here.','Mia, together with her friends, ___ here.','is','is','are','are','A','主语中心仍是 Mia。','The subject head remains Mia.')),
      A('关系从句中的谓语与关系词所指的先行词一致。','A verb in a relative clause agrees with the antecedent represented by the relative word.',[['She is one of the students','complement'],['who','subject','关系从句主语，指 students','Relative subject referring to students'],['work hard.','predicate']],Q('who ___ hard 中谓语为何用 work？','Why is work used after who?','who 指复数 students','who refers to plural students','who 指单数 one','who refers to singular one','A','关系词在从句内指向 students。','The relative word refers to students inside the clause.'))
    ]),
    L('agreement-proximity-meaning','advanced','就近一致与意义一致','Proximity and notional agreement','形式规则之外还要看连接方式和整体意义','Beyond form, consider coordination and meaning',[
      A('either...or、neither...nor、not only...but also 连接主语时通常按就近原则。','With either...or, neither...nor and not only...but also subjects, agreement normally follows the nearer subject.',[['Either Mia or the boys','subject'],['are','predicate'],['coming.','complement']],Q('Either Mia or the boys ___ coming.','Either Mia or the boys ___ coming.','is','is','are','are','B','较近主语 boys 是复数。','The nearer subject boys is plural.')),
      A('时间、距离、金额作为一个整体量时通常用单数谓语。','A period, distance or sum treated as one unit normally takes a singular verb.',[['Ten minutes','subject','整体时长作主语','Duration as one unit'],['is','predicate'],['enough.','complement']],Q('Ten minutes ___ enough.','Ten minutes ___ enough.','is','is','are','are','A','十分钟在此被看作一个整体时长。','Ten minutes is treated as one duration.')),
      A('分数、百分数或 some/most/all + of 的一致通常看 of 后名词。','Agreement with fractions, percentages or some/most/all + of normally follows the of-noun.',[['Half of the water','subject'],['is','predicate'],['gone.','complement']],Q('Half of the students ___ ready.','Half of the students ___ ready.','is','is','are','are','B','of 后 students 为复数。','Agreement follows plural students.'))
    ]),
    L('tense-viewpoint','core','时态与体的时间关系','Time relations in tense and aspect','时态定位观察点，体展示事件内部状态','Tense locates the viewpoint; aspect presents the event internally',[
      A('时态首先把观察点定位在现在或过去；时间词只是线索，语境关系才是依据。','Tense first locates the viewpoint in present or past; time words are clues, while context determines the relation.',[['She','subject'],['lives','predicate'],['in Shanghai now.','adverbial']],Q('lives 主要把观察点放在哪里？','Where does lives locate the viewpoint?','现在','Present','过去','Past','A','一般现在时以现在为观察点。','Present simple locates the viewpoint in the present.')),
      A('体不等于时间：进行体显示过程，完成体显示“先发生并与观察点相关”。','Aspect is not time: progressive presents an unfolding process; perfect presents prior occurrence relevant to the viewpoint.',[['She','subject'],['is reading','predicate','现在进行体谓语','Present progressive predicate'],['now.','adverbial']],Q('进行体突出什么？','What does progressive aspect highlight?','动作过程','An unfolding process','动作一定在过去完成','Necessary past completion','A','is reading 把动作呈现为正在展开。','is reading presents the event as unfolding.')),
      A('同一事件可因说话者选择的观察方式不同而使用不同体。','The same event may take different aspect depending on how the speaker chooses to view it.',[['I','subject'],['have read','predicate','现在完成体谓语','Present perfect predicate'],['the book.','object']],Q('have read 最突出什么关系？','What relation does have read highlight?','先前阅读与现在相关','Prior reading relevant now','只说明过去具体时刻','Only a specific past time','A','完成体把先前事件连接到现在观察点。','The perfect links a prior event to the present viewpoint.'))
    ]),
    L('simple-progressive','core','一般体与进行体','Simple and progressive aspect','整体事实与展开过程的对比','Whole facts versus unfolding processes',[
      A('一般现在时常表达习惯、规律、状态或长期事实。','Present simple commonly expresses habits, general truths, states or lasting facts.',[['Water','subject'],['boils','predicate'],['at 100°C.','adverbial']],Q('客观规律通常用什么？','What normally expresses a general truth?','一般现在时','Present simple','现在进行时','Present progressive','A','规律不强调临时展开过程。','A general truth is not presented as a temporary process.')),
      A('进行体表达观察点附近正在展开或临时持续的活动。','Progressive aspect expresses an activity unfolding around the viewpoint or continuing temporarily.',[['Mia','subject'],['is staying','predicate'],['with us this week.','adverbial']],Q('this week 的临时安排为何用 is staying？','Why is is staying used for this week?','突出临时持续','It highlights temporary duration','表示永久事实','It states a permanent fact','A','进行体把住宿看作当前临时过程。','The progressive presents the stay as temporary and current.')),
      A('状态动词通常不用进行体；若使用，往往表示临时行为或意义变化。','Stative verbs normally avoid progressive aspect; when used, they often express temporary behaviour or a changed meaning.',[['I','subject'],['understand','predicate'],['the rule.','object']],Q('哪句通常更自然？','Which is normally more natural?','I understand the rule.','I understand the rule.','I am understanding the rule.','I am understanding the rule.','A','understand 通常表示状态。','understand is normally stative.'))
    ]),
    L('perfect-system','core','完成体与完成进行体','Perfect and perfect progressive','先前事件、当前结果与持续过程','Prior event, current relevance and continuing process',[
      A('现在完成体表示先前发生且与现在有关，不与明确结束的过去时间点连用。','Present perfect expresses a prior event relevant now and does not normally combine with a definite finished past time.',[['She','subject'],['has lost','predicate'],['her key.','object']],Q('has lost 在此暗示什么？','What does has lost imply here?','现在仍受丢钥匙影响','The loss still matters now','只记录昨天时间','It only records yesterday','A','完成体突出当前结果。','The perfect highlights a current result.')),
      A('since 给起点，for 给持续时长；延续性情形可连接过去与现在。','since gives a starting point and for gives duration; continuing situations can link past and present.',[['They','subject'],['have lived','predicate'],['here for five years.','adverbial']],Q('for five years 表示什么？','What does for five years express?','持续时长','Duration','起始时刻','Starting point','A','for 后接一段时间。','for introduces a duration.')),
      A('完成进行体突出从过去延续到观察点的过程或近期反复活动。','Perfect progressive highlights a process continuing to the viewpoint or repeated recently.',[['It','subject'],['has been raining','predicate'],['all morning.','adverbial']],Q('has been raining 最突出什么？','What does has been raining emphasize?','持续的过程','The continuing process','单次完成结果','A single completed result','A','have been doing 把过程延伸到现在。','have been doing extends the process to now.'))
    ]),
    L('past-sequence','advanced','过去时间序列','Sequencing past events','以过去观察点排列先后与持续','Ordering prior events around a past viewpoint',[
      A('一般过去时叙述过去观察点上的主要事件。','Past simple narrates the main event at a past viewpoint.',[['The bell','subject'],['rang','predicate'],['at eight.','adverbial']],Q('明确过去时间 at eight 对应什么？','What fits the definite past time at eight?','rang','rang','has rung','has rung','A','结束的过去时间通常用一般过去时。','A finished past time normally takes past simple.')),
      A('过去完成体表示在另一个过去事件之前已经发生。','Past perfect marks an event completed before another past event.',[['The train','subject'],['had left','predicate'],['before we arrived.','adverbial']],Q('哪个动作更早？','Which event happened earlier?','had left','had left','arrived','arrived','A','过去完成体标记“过去的过去”。','Past perfect marks an earlier past.')),
      A('过去进行体提供过去某时正在展开的背景，常与一般过去时的插入事件对照。','Past progressive provides an unfolding past background, often contrasted with an interrupting past-simple event.',[['I','subject'],['was cooking','predicate'],['when he called.','adverbial']],Q('哪个是背景过程？','Which is the background process?','was cooking','was cooking','called','called','A','过去进行体呈现展开中的背景。','Past progressive presents the unfolding background.'))
    ]),
    L('future-system','core','将来表达与从句时间','Future expressions and clause time','will、be going to、进行时及主将从现','will, be going to, progressive arrangements and present in future clauses',[
      A('will 常表达即时决定、预测、承诺或中性将来。','will commonly expresses a spontaneous decision, prediction, promise or neutral future.',[['I','subject'],['will answer','predicate'],['the phone.','object']],Q('听到电话后即时决定用什么？','What expresses a spontaneous decision on hearing the phone?','will answer','will answer','am answering yesterday','am answering yesterday','A','即时决定常用 will。','will commonly marks a spontaneous decision.')),
      A('be going to 常表达已有计划或有当前证据的预测；现在进行时可表达已安排事项。','be going to commonly expresses a prior plan or evidence-based prediction; present progressive can express a fixed arrangement.',[['We','subject'],['are meeting','predicate'],['the teacher tomorrow.','adverbial']],Q('已约好的明日见面可用什么？','What can express a fixed meeting tomorrow?','are meeting','are meeting','met','met','A','现在进行时可表示已安排将来。','Present progressive can mark a future arrangement.')),
      A('时间、条件和让步从句表达将来时通常用一般现在时，主句再用将来表达。','Future time, condition and concession clauses normally use present simple while the main clause carries future marking.',[['If it rains,','adverbial'],['we','subject'],['will stay','predicate'],['home.','adverbial']],Q('If it ___ tomorrow, we will stay home.','If it ___ tomorrow, we will stay home.','rains','rains','will rain','will rain','A','条件从句表将来时用一般现在时。','Use present simple in the future condition clause.'),X('不是所有“将来意义”都在从句内使用 will。','Not every future meaning uses will inside the subordinate clause.'))
    ]),
    L('voice-focus','core','主动与被动的视角','Active and passive viewpoint','语态改变信息焦点，不改变事件角色','Voice changes information focus, not event roles',[
      A('主动句把施事者置于主语位置，被动句把动作承受者置于主语位置。','Active voice places the agent as subject; passive voice places the affected participant as subject.',[['The storm','subject','施事者作主语','Agent as subject'],['damaged','predicate'],['the roof.','object']],Q('主动句主语 The storm 是什么角色？','What semantic role does The storm have?','施事/原因来源','Agent or cause','动作承受者','Affected participant','A','风暴导致损坏。','The storm causes the damage.')),
      A('被动核心是相应时态的 be＋过去分词，原主动宾语变为主语。','The passive core is the relevant form of be + past participle; the active object becomes subject.',[['The roof','subject'],['was damaged','predicate'],['by the storm.','adverbial','施事者 by 短语','Agent by-phrase']],Q('damaged the roof 转被动后 roof 变为什么？','What does roof become in the passive?','主语','Subject','状语','Adverbial','A','动作承受者提升为被动句主语。','The affected participant becomes passive subject.')),
      A('施事未知、不重要或可由常识推断时，被动句通常省略 by 短语。','The by-phrase is normally omitted when the agent is unknown, unimportant or obvious.',[['My bike','subject'],['was stolen.','predicate']],Q('为什么可不写 by someone？','Why can by someone be omitted?','施事未知且不是信息重点','The agent is unknown and not the focus','被动句不能有施事','Passives can never name an agent','A','被动允许 by 短语，但此处没有信息价值。','A passive permits a by-phrase, but it adds no useful information here.'))
    ]),
    L('passive-chain','core','各时体中的被动链','Passive chains across tense and aspect','改变最前面的限定助动词，保留 been/being 槽位','Change the finite auxiliary while preserving been/being slots',[
      A('一般时被动用相应时态的 be＋过去分词。','A simple passive uses the appropriate tense of be + past participle.',[['The room','subject'],['is cleaned','predicate'],['daily.','adverbial']],Q('一般现在被动结构是什么？','What is the present simple passive pattern?','am/is/are + done','am/is/are + done','have + doing','have + doing','A','be 承担时态，过去分词表达被动。','be carries tense; the participle marks passive voice.')),
      A('进行体被动用 be＋being＋过去分词。','A progressive passive uses be + being + past participle.',[['The road','subject'],['is being repaired','predicate'],['now.','adverbial']],Q('“正在被修”怎样表达？','How is “currently under repair” formed?','is being repaired','is being repaired','is repaired now always','is repaired now always','A','进行槽位 be doing 与被动槽位 be done 组合为 is being repaired。','Progressive be doing plus passive be done yields is being repaired.')),
      A('完成体被动用 have＋been＋过去分词。','A perfect passive uses have + been + past participle.',[['The work','subject'],['has been finished','predicate'],['already.','adverbial']],Q('完成被动结构是什么？','What is the perfect passive pattern?','have/has + been + done','have/has + been + done','be + having + done','be + having + done','A','been 是被动 be 的过去分词，位于完成 have 后。','been is the participle of passive be after perfect have.'))
    ]),
    L('modal-system','core','情态谓语系统','The modal predicate system','情态强度、时间推断与完成情态','Strength, temporal inference and perfect modals',[
      A('情态动词不加三单或时态词尾，后接动词原形。','A modal takes no third-person or tense ending and is followed by a base verb.',[['She','subject'],['can','modal'],['swim.','predicate']],Q('She can ___ .','She can ___ .','swim','swim','swims','swims','A','can 后用原形。','A modal takes a base verb.')),
      A('must、should、may、might 等表达不同强度的义务、可能或判断，选择取决于语境立场。','must, should, may and might express different strengths of obligation, possibility or judgment; context determines the choice.',[['You','subject'],['must','modal'],['wear','predicate'],['a seat belt.','object']],Q('强制义务最适合用什么？','What best expresses strong obligation?','must','must','might','might','A','must 表强义务。','must expresses strong obligation.')),
      A('情态词＋have＋过去分词把判断指向过去事件。','Modal + have + past participle directs the judgment toward a past event.',[['She','subject'],['may','modal'],['have','auxiliary'],['missed','predicate'],['the train.','object']],Q('may have missed 表示什么？','What does may have missed express?','对过去事件的可能推测','Possible inference about a past event','现在正在错过','An event unfolding now','A','have missed 把情态判断指向先前事件。','have missed places the modal judgment on a prior event.'))
    ]),
    L('semi-modal-system','advanced','半情态与边界形式','Semi-modals and boundary forms','have to、be able to、used to 等兼具词汇和助动特征','have to, be able to and used to mix lexical and auxiliary properties',[
      A('have to 表外部义务，疑问否定通常需要 do 支持。','have to often expresses external obligation; its questions and negatives normally require do-support.',[['Do','operator'],['you','subject'],['have to leave?','predicate']],Q('have to 的一般现在疑问句用什么操作词？','Which operator forms a present question with have to?','do/does','do/does','直接把 have 前移总是正确','Always move have directly','A','现代英语通常用 do you have to。','Modern English normally uses do you have to.')),
      A('be able to 可进入更多时态和非谓语位置，be 承担限定变化。','be able to can occur in more tense and non-finite positions; be carries finiteness.',[['She','subject'],['has been','auxiliary'],['able to solve','predicate'],['it.','object']],Q('has been able to 中哪个部分承担完成时？','Which part carries the perfect in has been able to?','has been','has been','able','able','A','have＋been 构成完成链。','have + been forms the perfect chain.')),
      A('used to 表过去习惯或状态；否定和疑问常用 did，used 恢复 use。','used to expresses a past habit or state; questions and negatives commonly use did, with used returning to use.',[['Did','operator'],['you','subject'],['use to live','predicate'],['here?','adverbial']],Q('规范疑问结构是哪一个？','Which is the standard question structure?','Did you use to...?','Did you use to...?','Did you used to...?','Did you used to...?','A','过去标记由 did 承担，use 用原形。','did carries past marking, so use is base form.'))
    ]),
    L('negation-questions','core','否定与疑问的谓语操作','Predicate operations in negatives and questions','操作词承担 not、倒装与答语重复','The operator carries not, inversion and answer repetition',[
      A('be 作限定谓语时直接加 not，不使用 do。','Finite be takes not directly and does not use do-support.',[['Mia','subject'],['is','operator'],['not','negator'],['ready.','complement']],Q('Mia is ready 的否定是什么？','What is the negative of Mia is ready?','Mia is not ready.','Mia is not ready.','Mia does not be ready.','Mia does not be ready.','A','限定 be 自己承担否定。','Finite be itself carries negation.')),
      A('一般疑问句把操作词移到主语前；若无操作词则加入 do。','A yes-no question moves the operator before the subject; if none exists, do is inserted.',[['Did','operator'],['they','subject'],['arrive','predicate'],['on time?','adverbial']],Q('They arrived on time 的疑问句为何用 arrive？','Why does the question use arrive?','过去标记已由 Did 承担','Did already carries past tense','疑问句没有时态','Questions have no tense','A','一个分句的过去限定标记由操作词 did 表达。','Operator did carries the clause’s past finiteness.')),
      A('特殊疑问词若本身作主语，不再进行主语—操作词倒装。','When a wh-word itself is the subject, no subject-operator inversion follows.',[['Who','subject'],['called','predicate'],['you?','object']],Q('哪句询问“谁给你打电话”？','Which asks who called you?','Who called you?','Who called you?','Who did call you?','Who did call you?','A','Who 本身就是主语，通常不用 do。','Who is the subject, so do-support is normally absent.'))
    ]),
    L('emphatic-do','core','强调 do','Emphatic do','在肯定句中加强确认、对比或反驳','Strengthening confirmation, contrast or correction',[
      A('肯定陈述句可用 do/does/did＋原形强调真实性。','An affirmative statement can use do/does/did + base form to emphasize truth.',[['I','subject'],['do','operator','强调助动词','Emphatic auxiliary'],['understand','predicate'],['you.','object']],Q('I do understand 中 do 的作用是什么？','What does do do in I do understand?','强调“确实理解”','Emphasize that understanding is real','构成疑问','Form a question','A','肯定句中的 do 提供强调。','do supplies emphasis in an affirmative statement.')),
      A('强调 do 承担时态和一致，后面的实义动词使用原形。','Emphatic do carries tense and agreement; the lexical verb is base form.',[['She','subject'],['does','operator','强调助动词','Emphatic auxiliary'],['want','predicate'],['to help.','complement']],Q('哪句正确？','Which is correct?','She does want to help.','She does want to help.','She does wants to help.','She does wants to help.','A','三单标记在 does 上，want 用原形。','does carries third-person agreement; want is base form.')),
      A('强调过去事实用 did＋原形，而不是 did＋过去式。','To emphasize a past fact, use did + base form, not did + past form.',[['He','subject'],['did','operator','强调助动词','Emphatic auxiliary'],['call','predicate'],['yesterday.','adverbial']],Q('“他昨天确实打了电话”怎样表达？','How do you say he really called yesterday?','He did call yesterday.','He did call yesterday.','He did called yesterday.','He did called yesterday.','A','过去标记由 did 承担。','did carries past tense.'))
    ]),
    L('short-answers-substitution','core','短答与谓语替代','Short answers and predicate substitution','保留操作词，避免重复整个谓语','Retain the operator instead of repeating the whole predicate',[
      A('一般疑问句短答重复操作词，并与答语主语一致。','A short answer repeats the operator and agrees with its answer subject.',[['Has','operator'],['Mia','subject'],['left?','predicate'],['Yes, she has.','complement','短答','Short answer']],Q('Has Mia left? 的肯定短答是什么？','What is the positive short answer to Has Mia left?','Yes, she has.','Yes, she has.','Yes, she does.','Yes, she does.','A','原问句操作词是 has。','The original operator is has.')),
      A('do/does/did 可替代前文的一般时实义谓语，避免重复。','do/does/did can substitute for a preceding simple-tense lexical predicate.',[['Mia sings better','complement'],['than Tom does.','complement','does 替代 sings','does substitutes for sings']],Q('Tom does 中 does 替代什么？','What does does replace?','sings','sings','better','better','A','does 代替重复谓语 sings。','does replaces repeated predicate sings.')),
      A('so/neither＋操作词＋主语可表达“也如此/也不如此”，操作词取决于前句谓语。','so/neither + operator + subject can mean “so does...” or “neither does...”; the operator follows the preceding predicate.',[['Mia can swim,','complement'],['and so can Tom.','complement','can 替代 can swim','can substitutes for can swim']],Q('Mia can swim. Tom 也会。应说什么？','Mia can swim, and Tom can too. Which structure fits?','So can Tom.','So can Tom.','So does Tom.','So does Tom.','A','前句操作词是 can。','The preceding operator is can.'))
    ]),
    L('predicate-sharing-ellipsis','advanced','谓语共享与省略','Predicate sharing and ellipsis','还原平行项中的共同助动词或谓语','Recover shared auxiliaries or predicates in parallel structures',[
      A('并列谓语可以共享同一个主语和助动词。','Coordinated predicates can share one subject and auxiliary.',[['Mia','subject'],['has','auxiliary'],['finished the report','predicate'],['and','conjunction'],['sent it.','predicate','共享 has 的并列谓语','Coordinated predicate sharing has']],Q('sent it 与哪个助动词共享完成结构？','Which auxiliary does sent it share in the perfect construction?','has','has','and','and','A','可还原为 has finished and has sent。','It expands to has finished and has sent.')),
      A('助动词后的共同实义谓语可在第二并列项中省略，但意义由平行结构恢复。','A shared lexical predicate can be omitted from the second coordinate after an auxiliary and recovered by parallelism.',[['Mia can play the piano,','complement'],['and Tom can, too.','complement','can 后省略 play the piano','play the piano omitted after can']],Q('Tom can, too 中省略什么？','What is omitted in Tom can, too?','play the piano','play the piano','Mia','Mia','A','操作词 can 保留并替代完整谓语。','Operator can remains and stands for the full predicate.')),
      A('省略必须保持时态、语态和情态关系可恢复；不清楚时应保留完整谓语。','Ellipsis must leave tense, voice and modality recoverable; retain the full predicate when recovery is unclear.',[['Some reports were accepted,','complement'],['but others were not.','complement','were not 后省略 accepted','accepted omitted after were not']],Q('others were not 中省略什么？','What is omitted in others were not?','accepted','accepted','reports','reports','A','被动操作词 were 保留，过去分词由前项恢复。','Passive operator were remains; the participle is recovered from the first coordinate.'))
    ]),
    L('predicate-integration','advanced','综合谓语分析','Integrated predicate analysis','按限定性、链条、时体、语态、情态和一致逐层检查','Check finiteness, chain order, tense-aspect, voice, modality and agreement in layers',[
      A('复杂谓语先找第一个限定操作词，再按助动词槽位向右分析。','In a complex predicate, first find the finite operator, then analyse auxiliary slots to the right.',[['The road','subject'],['may','modal','限定操作词','Finite operator'],['have','auxiliary','完成助动词','Perfect auxiliary'],['been','auxiliary','被动助动词','Passive auxiliary'],['closed.','predicate']],Q('may have been closed 的限定操作词是什么？','What is the finite operator in may have been closed?','may','may','closed','closed','A','最前面的情态词承担限定性。','The initial modal carries finiteness.')),
      A('判断谓语意义时分别回答：观察点何时、事件怎样展开、主语是施事还是承受者、说话者态度如何。','To interpret a predicate, separately ask when the viewpoint is, how the event unfolds, whether the subject acts or is affected, and what stance is expressed.',[['The work','subject'],['must','modal'],['have','auxiliary'],['been','auxiliary'],['completed.','predicate']],Q('must have been completed 包含哪些系统？','Which systems occur in must have been completed?','情态＋完成＋被动','Modal + perfect + passive','将来＋进行＋主动','Future + progressive + active','A','must 表判断，have 表完成，been completed 表被动。','must marks stance, have marks perfect, and been completed marks passive.')),
      A('最终检查主语一致和操作规则：限定标记只出现一次，后续动词形式由前一助动词决定。','Finally check agreement and operations: finite marking appears once, and each following verb form is selected by the preceding auxiliary.',[['Does','operator'],['the plan','subject'],['seem','predicate'],['reasonable?','complement']],Q('为什么不能说 Does the plan seems...?','Why is Does the plan seems... incorrect?','三单限定标记已在 Does 上','Third-person finiteness is already on Does','plan 是复数','plan is plural','A','同一分句不能在 Does 和 seems 上重复三单标记。','The clause cannot mark third-person agreement on both Does and seems.'),X('检查顺序：主语 → 限定操作词 → 助动词链 → 实义动词 → 补足成分。','Check in order: subject → finite operator → auxiliary chain → lexical verb → complements.'))
    ])
  ].map((item,index)=>Object.assign({},item,{no:String(index+1).padStart(2,'0')}));

  const byId=Object.fromEntries(course.map(item=>[item.id,item]));
  const relabel=(id,exampleIndex,unitIndex,role,zh,en)=>Object.assign(byId[id].analyses[exampleIndex][unitIndex],{role,label:pick(english,zh,en)});
  relabel('finite-boundary',2,2,'clause','宾语从句','Object clause');
  relabel('agreement-basic',1,2,'predicative','表语','Subject complement');
  relabel('agreement-basic',2,2,'predicative','表语','Subject complement');
  relabel('agreement-head',0,1,'attribute','主语内部后置定语','Postmodifier inside subject');
  relabel('agreement-head',0,3,'predicative','表语','Subject complement');
  relabel('agreement-head',2,0,'clause','主句','Main clause');
  relabel('agreement-proximity-meaning',0,2,'nonfinite','现在分词（与 are 构成谓语）','Present participle in the predicate');
  relabel('agreement-proximity-meaning',1,2,'predicative','表语','Subject complement');
  relabel('agreement-proximity-meaning',2,2,'predicative','表语','Subject complement');
  relabel('negation-questions',0,3,'predicative','表语','Subject complement');
  relabel('emphatic-do',1,3,'nonfinite','不定式作宾语','Infinitive as object');
  relabel('short-answers-substitution',0,3,'substitute','短答中的谓语替代','Predicate substitute in short answer');
  relabel('short-answers-substitution',1,0,'clause','主比较分句','Main comparison clause');
  relabel('short-answers-substitution',1,1,'substitute','does 替代 sings','does substitutes for sings');
  relabel('short-answers-substitution',2,0,'clause','前一分句','Preceding clause');
  relabel('short-answers-substitution',2,1,'substitute','can 替代 can swim','can substitutes for can swim');
  relabel('predicate-sharing-ellipsis',1,0,'clause','完整分句','Complete clause');
  relabel('predicate-sharing-ellipsis',1,1,'ellipsis','省略 play the piano 的分句','Clause omitting play the piano');
  relabel('predicate-sharing-ellipsis',2,0,'clause','完整分句','Complete clause');
  relabel('predicate-sharing-ellipsis',2,1,'ellipsis','省略 accepted 的分句','Clause omitting accepted');
  relabel('predicate-integration',2,3,'predicative','表语','Subject complement');

  const specs = [
    ['predicate-architecture','限定谓语与助动词架构','Finite predicates and auxiliary architecture','建立限定/非谓语边界、固定助动词链和操作词概念。','Build the finite/non-finite boundary, fixed auxiliary order and operator system.',['finite-boundary','auxiliary-chain','operator']],
    ['agreement-system','主谓一致系统','Agreement system','从基础一致、中心词判断到就近和意义一致。','Move from basic agreement and head finding to proximity and notional agreement.',['agreement-basic','agreement-head','agreement-proximity-meaning']],
    ['tense-aspect-system','时间、时态与体','Time, tense and aspect','用观察点理解一般、进行、完成、完成进行、过去序列和将来表达。','Use temporal viewpoints to understand simple, progressive, perfect, perfect progressive, past sequencing and future expression.',['tense-viewpoint','simple-progressive','perfect-system','past-sequence','future-system']],
    ['voice-modality','语态与情态系统','Voice and modality','分析主动被动焦点、跨时体被动链、情态与半情态。','Analyse active-passive focus, passive chains across aspect, modals and semi-modals.',['voice-focus','passive-chain','modal-system','semi-modal-system']],
    ['predicate-operations','否定、疑问、强调与替代','Negation, questions, emphasis and substitution','统一掌握操作词在否定、疑问、强调、短答和替代中的作用。','Master the operator across negation, questions, emphasis, short answers and substitution.',['negation-questions','emphatic-do','short-answers-substitution']],
    ['predicate-complex','共享、省略与综合分析','Sharing, ellipsis and integrated analysis','还原共享谓语与省略结构，并完成多层谓语系统分析。','Recover shared and omitted predicates and complete layered predicate analysis.',['predicate-sharing-ellipsis','predicate-integration']]
  ];
  const sections = specs.map(s=>({id:s[0],title:pick(english,s[1],s[2]),copy:pick(english,s[3],s[4]),lessonIds:s[5].slice(),lessonCount:s[5].length}));
  const ids=course.map(l=>l.id), assigned=sections.flatMap(s=>s.lessonIds);
  if(assigned.length!==ids.length||new Set(assigned).size!==assigned.length||ids.some(id=>!assigned.includes(id))||assigned.some(id=>!ids.includes(id))) throw new Error('Invalid predicate-system section coverage');
  course.forEach(l=>{ if(l.rules.length<3||l.examples.length!==l.rules.length||l.questions.length!==l.rules.length||l.analyses.length!==l.examples.length) throw new Error(`Invalid predicate lesson: ${l.id}`); if(INCLUDE_RULE_COVERAGE)l.ruleCoverage.forEach((c,i)=>{if(c.exampleIndexes[0]!==i||c.questionIndexes[0]!==i)throw new Error(`Invalid predicate coverage: ${l.id}:${i}`);}); });
  const core=course.filter(l=>l.level==='core'), advanced=course.filter(l=>l.level==='advanced');
  return { title:pick(english,`谓语系统 · ${course.length} 节微课`,`Predicate system · ${course.length} lessons`), copy:pick(english,'从限定谓语出发，系统理解一致、时体、语态、情态和句子操作。','Start with finiteness, then build agreement, tense-aspect, voice, modality and clause operations.'), course,sections,groups:[
    {id:'core',title:pick(english,`核心必学 · ${core.length} 节`,`Core · ${core.length} essential lessons`),copy:pick(english,'建立所有句子分析都依赖的谓语框架。','Build the predicate framework required for sentence analysis.'),lessons:core},
    {id:'advanced',title:pick(english,`进阶挑战 · ${advanced.length} 节`,`Advanced · ${advanced.length} challenge lessons`),copy:pick(english,'处理意义一致、过去序列、半情态、共享省略与综合链条。','Handle notional agreement, past sequencing, semi-modals, ellipsis and complex chains.'),lessons:advanced}
  ]};
}
module.exports={buildPredicateSystemCourse};
