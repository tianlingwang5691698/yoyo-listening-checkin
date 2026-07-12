const pick=(english,zh,en)=>english?en:zh;
const INCLUDE_RULE_COVERAGE=typeof GRAMMAR_RUNTIME==='undefined'||!GRAMMAR_RUNTIME;
const labels={subject:['主语','Subject'],predicate:['谓语动词','Predicate verb'],object:['宾语','Object'],indirectObject:['间接宾语','Indirect object'],directObject:['直接宾语','Direct object'],subjectComplement:['主语补语（表语）','Subject complement'],objectComplement:['宾语补语','Object complement'],attribute:['定语','Attribute'],adverbial:['状语','Adverbial'],dummySubject:['形式主语','Dummy subject'],dummyObject:['形式宾语','Dummy object'],existential:['存在句引导词','Existential there'],conjunction:['连接词','Connector'],focus:['焦点成分','Focus element'],topic:['话题成分','Topic element'],clause:['分句','Clause']};
function analysis(english,chunks){return chunks.map(([text,role,zh,en])=>({text,role,label:pick(english,zh||(labels[role]||['',''])[0],en||(labels[role]||['',''])[1])}));}
function note(english,mode,zh,en){if(!mode)return{visible:false,mode:'',title:'',body:'',detail:''};const titles={order:['语序观察','Order focus'],translation:['中英语序','Chinese–English order'],information:['信息推进','Information flow'],focus:['焦点范围','Focus scope'],boundary:['边界提醒','Boundary note'],rewrite:['改写策略','Rewriting strategy']};return{visible:true,mode,title:pick(english,...(titles[mode]||titles.order)),body:pick(english,zh,en),detail:''};}
const opt=(english,v)=>Array.isArray(v)?pick(english,v[0],v[1]):v;
function question(english,x){return{question:pick(english,x[0],x[1]),options:x[2].map((v,i)=>({key:String.fromCharCode(65+i),text:opt(english,v)})),answer:x[3],correct:pick(english,x[4],x[5]),wrong:pick(english,`再看语序：${x[4]}`,`Check the order: ${x[5]}`)};}
function lesson(english,s,index){if(s.rules.length!==s.examples.length||s.rules.length!==s.questions.length)throw new Error(`Information-order coverage mismatch: ${s.id}`);const examples=s.examples.map(x=>({text:x[0].map(c=>c[0]).join(' '),analysis:analysis(english,x[0]),note:note(english,x[1],x[2],x[3])}));return{id:s.id,no:String(index+1).padStart(2,'0'),level:s.level,title:pick(english,...s.title),meta:pick(english,...s.meta),examples:examples.map(x=>x.text),analyses:examples.map(x=>x.analysis),exampleNotes:examples.map(x=>x.note),rules:s.rules.map(x=>pick(english,...x)),ruleCoverage:INCLUDE_RULE_COVERAGE?s.rules.map((_,i)=>({exampleIndexes:[i],questionIndexes:[i]})):[],questions:s.questions.map(x=>question(english,x))};}

const specs=[
  {id:'skeleton-vs-topic',level:'core',title:['英语主干顺序与中文话题式表达','English skeleton order and Chinese topic-prominent expression'],meta:['先落实主语和谓语，再安排话题','Build subject and predicate before arranging the topic'],examples:[
    [[['This problem,','topic','中文式悬空话题','Chinese-style hanging topic'],['we','subject'],['need to discuss','predicate']],'boundary','直接照搬“这个问题，我们需要讨论”会产生逗号拼接式话题；标准英语通常写 We need to discuss this problem。','A word-for-word topic frame is awkward; standard English normally uses We need to discuss this problem.'],
    [[['We','subject'],['need to discuss','predicate'],['this problem.','object']],'order','英语普通陈述句先建立主语—谓语—宾语主干。','An ordinary English statement first establishes its subject–verb–object skeleton.'],
    [[['As for this problem,','topic','有明确标记的话题','Explicitly marked topic'],['we','subject'],['need to discuss','predicate'],['it further.','object']],'boundary','需要突出话题时，用 as for 等明确标记，并在主句中保持完整指代。','When a topic must be foregrounded, mark it with as for and keep a complete reference in the clause.']
  ],rules:[
    ['英语普通句通常要求显式主语和限定谓语，不能只靠语境悬空话题。','An ordinary English clause normally requires an explicit subject and finite predicate; context alone cannot support a hanging topic.'],
    ['中文“话题＋说明”常需重组为英语主语—谓语—宾语或主系表主干。','A Chinese topic–comment structure often needs restructuring into an English SVO or SVC skeleton.'],
    ['确需前置话题时，应使用 as for、regarding 等标记，并保证后续主句结构完整。','If a topic is fronted, mark it with as for or regarding and keep the following clause structurally complete.']
  ],questions:[
    ['“这个问题，我们需要讨论”最自然的普通英语是什么？','What is the most natural ordinary English version?',['We need to discuss this problem.','This problem, we need discuss.'],'A','英语先建立完整 SVO 主干。','English first builds a complete SVO skeleton.'],
    ['英语普通分句最基本需要什么？','What does an ordinary English finite clause basically require?',[['主语和限定谓语','A subject and finite predicate'],['只要话题','Only a topic']],'A','主干不能只靠话题暗示。','The skeleton cannot rely only on an implied topic.'],
    ['前置话题后，主句应怎样？','What should follow a fronted marked topic?',[['保持结构完整并有清楚指代','A complete clause with clear reference'],['省掉主语和谓语','Omit subject and predicate']],'A','话题标记不替代主句骨架。','Topic marking does not replace the clause skeleton.']
  ]},
  {id:'given-new-flow',level:'core',title:['已知信息到新信息','Given information to new information'],meta:['让读者从熟悉内容走向重点','Lead readers from familiar material to the focal information'],examples:[
    [[['I bought a new camera yesterday.','clause','首次引入新信息','First introduction of new information'],['The camera','subject','已知信息作主语','Given information as subject'],['takes','predicate'],['excellent photos.','object','新信息','New information']],'information','第二句用 The camera 承接第一句的新对象，再把新评价放后面。','The second sentence picks up the camera as given and places the new evaluation later.'],
    [[['A student','subject','新信息','New information'],['was waiting','predicate'],['outside.','adverbial']], 'information','首次出现用 a student；后续再用 the student 或代词承接。','Use a student on first mention, then the student or a pronoun to continue it.'],
    [[['The main problem','subject','已知话题','Given topic'],['is','predicate'],['the lack of reliable data.','subjectComplement','新信息焦点','New-information focus']],'information','系动词后位置常承载对已知话题的新说明。','The post-copular position commonly carries new information about a given topic.']
  ],rules:[
    ['中性语序通常把已知、可预测信息放在前部，把新信息和焦点放在后部。','Neutral order commonly places given or predictable information earlier and new/focal information later.'],
    ['首次引入对象常用不定表达，后续用定指名词或代词承接。','A first-mentioned entity commonly uses an indefinite expression; later references use a definite noun phrase or pronoun.'],
    ['主语常承接话题，宾语、补语或句尾成分常提供新信息，但这不是绝对机械规则。','Subjects often carry the topic and objects/complements or final elements carry new information, though this is not mechanical.']
  ],questions:[
    ['I bought a camera. 下一句如何自然承接？','How can the next sentence naturally continue?',['The camera takes excellent photos.','A camera, it excellent photos.'],'A','用 The camera 承接已知对象。','The camera picks up the given entity.'],
    ['首次引入“一个学生”通常用什么？','What normally introduces a student for the first time?',['a student','the student without context'],'A','新对象通常使用不定表达。','A new entity normally uses an indefinite expression.'],
    ['The main problem is the lack of data. 新信息通常在哪里？','Where is the new information normally located?',['the lack of data','The main problem only'],'A','句尾补语提供新说明。','The final complement supplies the new specification.']
  ]},
  {id:'end-weight-short-long',level:'core',title:['尾重原则与短前长后','End weight and short-before-long order'],meta:['把复杂信息放到读者容易处理的位置','Place complex information where readers can process it easily'],examples:[
    [[['It','dummySubject'],['is','predicate'],['important','subjectComplement'],['that every student understands the rule.','clause','后置长主语从句','Postponed heavy subject clause']],'order','长从句放句尾比 That every student understands the rule is important 更轻快。','The heavy clause is easier to process at the end than in initial position.'],
    [[['She','subject'],['gave','predicate'],['him','indirectObject','短间接宾语','Short indirect object'],['a detailed explanation of the new policy.','directObject','长直接宾语','Long direct object']],'order','较短成分先出现，长而新的信息留在句尾。','The shorter element comes first and the long new information remains final.'],
    [[['We','subject'],['explained','predicate'],['the problem','directObject','较短直接宾语','Shorter direct object'],['to the students who had just arrived.','adverbial','较长接收者介词短语','Longer recipient phrase']],'order','长接收者短语用 to 结构放后，避免中间过重。','A long recipient phrase uses the to-pattern and stays final.']
  ],rules:[
    ['尾重原则倾向把长、复杂或信息量大的成分放在句尾。','The end-weight principle tends to place long, complex or information-heavy elements at the end.'],
    ['在语法允许时，较短成分通常先于较长成分，降低即时处理负担。','When grammar permits, shorter elements normally precede longer ones to reduce processing load.'],
    ['双宾或传递结构中，长接收者常改用“事物＋to/for＋接收者”顺序。','In transfer constructions, a long recipient often follows in thing + to/for + recipient order.']
  ],questions:[
    ['哪一句更符合尾重原则？','Which better follows end weight?',['It is important that every student understands the rule.','That every student understands the rule is important in every ordinary context.'],'A','形式主语把长从句后移。','Dummy it postpones the heavy clause.'],
    ['短宾语和长宾语并存时通常如何排列？','How are a short and a long complement normally ordered?',[['短前长后','Short before long'],['长前短后','Long before short']],'A','短前长后更易处理。','Short-before-long is easier to process.'],
    ['接收者很长时，哪种表达更自然？','Which is more natural with a long recipient?',['explain the problem to the students who arrived','explain the students who arrived the problem'],'A','长接收者用 to 短语后置。','A long recipient follows in a to-phrase.']
  ]},
  {id:'dummy-subject',level:'core',title:['形式主语 it 调整信息重量','Dummy subject it and information weight'],meta:['先给判断框架，再给真正内容','Give the evaluation frame before the heavy content'],examples:[
    [[['It','dummySubject'],['is','predicate'],['obvious','subjectComplement'],['that we need more time.','clause','真正主语从句','Notional subject clause']],'information','先呈现评价 obvious，再在句尾展开真正内容。','The evaluation obvious comes first and the actual content unfolds at the end.'],
    [[['It','dummySubject'],['took','predicate'],['us','indirectObject','受事者成分','Affected participant'],['two hours','directObject','时长成分','Duration complement'],['to finish the task.','clause','真正主语不定式','Notional infinitive subject']],'order','不定式后置，避免 To finish the task took us two hours 的句首重量。','The infinitive is postponed, avoiding a heavy initial subject.'],
    [[['It','dummySubject'],['seems','predicate'],['that the plan will work.','clause','后置主语从句','Postponed subject clause']],'boundary','it 不指代具体事物，只承担句法主语位置。','it refers to no concrete entity and merely fills the grammatical subject position.']
  ],rules:[
    ['形式主语 it 先占主语位置，把 that/wh- 从句或不定式真正主语后移。','Dummy it occupies subject position and postpones a that/wh-clause or infinitive notional subject.'],
    ['这种结构符合尾重原则，并让评价、耗时等主句框架更早出现。','This structure follows end weight and presents the evaluation or duration frame earlier.'],
    ['形式主语 it 没有具体指代，不能按普通代词寻找先行词。','Dummy it has no concrete referent and should not be assigned an antecedent like an ordinary pronoun.']
  ],questions:[
    ['It is obvious that we need more time. 中真正主语是什么？','What is the notional subject?',['that we need more time','it'],'A','it 是形式主语。','it is the dummy subject.'],
    ['It took us two hours to finish. 为什么不定式后置？','Why is the infinitive postponed?',[['避免头重并突出耗时框架','To avoid a heavy opening and foreground duration'],['因为不定式是宾语','Because it is an object']],'A','后置符合尾重原则。','Postponement follows end weight.'],
    ['形式主语 it 是否指某个具体事物？','Does dummy it refer to a concrete entity?',[['不指代','No'],['一定指前文名词','Always']],'A','它只占句法位置。','It only fills a grammatical slot.']
  ]},
  {id:'dummy-object',level:'core',title:['形式宾语 it 调整宾补与长宾语','Dummy object it and postponed heavy objects'],meta:['让宾补紧跟宾语，再展开从句内容','Keep the object complement close and postpone clause content'],examples:[
    [[['We','subject'],['find','predicate'],['it','dummyObject'],['difficult','objectComplement'],['to solve the problem.','clause','真正宾语不定式','Notional infinitive object']],'order','it 先占宾语位置，使 difficult 紧跟宾语，长不定式后置。','it fills the object slot, allowing difficult to follow and the heavy infinitive to remain final.'],
    [[['She','subject'],['made','predicate'],['it','dummyObject'],['clear','objectComplement'],['that she would leave.','clause','真正宾语从句','Notional object clause']],'information','评价 clear 先出现，具体内容在句尾展开。','The evaluation clear appears before the detailed content unfolds.'],
    [[['I','subject'],['consider','predicate'],['it','dummyObject'],['a mistake','objectComplement'],['to ignore the warning.','clause','真正宾语不定式','Notional infinitive object']],'boundary','不能随意删掉 it 写成 consider a mistake to ignore ...，否则槽位关系改变。','Do not freely omit it; doing so changes the complement structure.']
  ],rules:[
    ['“动词＋it＋宾补＋从句/不定式”用 it 作形式宾语，真正宾语后置。','Verb + it + object complement + clause/infinitive uses dummy it and postpones the notional object.'],
    ['该结构让宾语补语靠近形式宾语，同时把长内容留在句尾。','The construction keeps the object complement close to dummy it and the heavy content final.'],
    ['find/think/consider/make it + 形容词或名词 + to do/that ... 是固定高频骨架。','find/think/consider/make it + adjective or noun + to do/that ... is a high-frequency pattern.']
  ],questions:[
    ['We find it difficult to solve the problem. 中真正宾语是什么？','What is the notional object?',['to solve the problem','difficult'],'A','it 是形式宾语，不定式承载内容。','it is dummy and the infinitive carries the content.'],
    ['形式宾语结构为什么把从句放后？','Why is the clause postponed in a dummy-object construction?',[['让宾补靠近宾语并实现尾重','To keep the complement close and achieve end weight'],['为了形成疑问句','To form a question']],'A','这是结构与信息重量共同作用。','Both syntax and information weight motivate it.'],
    ['哪一项正确？','Which is correct?',['I consider it a mistake to ignore the warning.','I consider a mistake it ignore the warning.'],'A','使用 consider it + 名词宾补 + 不定式。','Use consider it + noun complement + infinitive.']
  ]},
  {id:'existential-new-information',level:'core',title:['存在句引入新信息','Existential clauses introduce new information'],meta:['先定位场景，再引出新对象','Set the scene and then introduce a new entity'],examples:[
    [[['There','existential'],['is','predicate'],['a message','subject','实义主语：新信息','Notional subject: new information'],['for you.','adverbial']],'information','there 先搭建存在结构，新对象 a message 放在谓语后引入。','there sets up existence and introduces the new entity a message after the verb.'],
    [[['There','existential'],['are','predicate'],['two problems','subject','实义主语：新信息','Notional subject: new information'],['with this plan.','attribute','介词短语后置定语','Prepositional postmodifier']],'information','新信息通常使用不定或数量表达，而非无语境的 the problems。','New information normally uses an indefinite or quantity expression rather than contextless the problems.'],
    [[['A tall building','subject','已知或作为话题的对象','Given/topical entity'],['stands','predicate'],['near the station.','adverbial']],'contrast','若对象已是话题，普通主谓句往往比 there be 更自然。','When the entity is already topical, an ordinary subject–verb clause is often more natural than there be.']
  ],rules:[
    ['there be/存在句把新出现的人或事物放在谓语后，符合新信息后置倾向。','An existential construction places a newly introduced entity after the verb, matching the tendency for new information to come later.'],
    ['存在句实义主语常用不定名词短语、数量词或其他非定指表达。','The notional subject of an existential commonly uses an indefinite noun phrase, quantity or other non-definite expression.'],
    ['已知或定指对象通常更适合作普通主语；there be 不是汉语“有”的逐词万能对应。','A given or definite entity is normally better as an ordinary subject; there be is not a universal word-for-word equivalent of Chinese 有.']
  ],questions:[
    ['首次引入“一条消息”更自然的表达是什么？','Which naturally introduces a message for the first time?',['There is a message for you.','The message there has for you.'],'A','存在句把新对象放后。','The existential introduces the new entity postverbally.'],
    ['存在句实义主语常是什么类型？','What kind of notional subject is common in an existential?',[['不定或数量表达','Indefinite or quantified'],['无语境的强定指表达','Strong definite without context']],'A','存在句主要引入新信息。','Existentials mainly introduce new information.'],
    ['对象已经是段落话题时通常优先什么？','What is normally preferred when the entity is already topical?',[['普通主谓句','An ordinary subject–verb clause'],['任何情况都用 there be','there be in every case']],'A','已知对象适合作主语。','A given entity naturally serves as subject.']
  ]},
  {id:'basic-adverbial-position',level:'core',title:['时间、地点、方式状语的位置','Positions of time, place and manner adverbials'],meta:['中性位置与信息需要共同决定','Neutral position interacts with information needs'],examples:[
    [[['She','subject'],['spoke','predicate'],['quietly','adverbial','方式状语','Manner adverbial'],['in the library.','adverbial','地点状语','Place adverbial']],'order','方式通常靠近动词或宾语，地点随后。','Manner normally stays close to the verb or object, followed by place.'],
    [[['We','subject'],['met','predicate'],['at the station','adverbial','地点状语','Place adverbial'],['yesterday.','adverbial','时间状语','Time adverbial']],'order','中性句尾常见地点在前、时间在后。','Neutral final order commonly places place before time.'],
    [[['Yesterday,','adverbial','前置时间状语','Initial time adverbial'],['we','subject'],['met','predicate'],['at the station.','adverbial','地点状语','Place adverbial']],'information','时间可前置建立叙事框架，前置后通常加逗号。','Time may be fronted to frame the narrative and is normally followed by a comma.']
  ],rules:[
    ['方式状语通常放在动词或宾语之后，并尽量靠近所修饰动作。','A manner adverbial normally follows the verb or object and stays close to the action it modifies.'],
    ['多个普通句尾状语中，常见中性顺序为方式—地点—时间。','Among ordinary final adverbials, a common neutral order is manner–place–time.'],
    ['时间或地点状语可前置建立场景；前置长状语通常用逗号分隔。','A time or place adverbial may be fronted to set the scene; a long initial adverbial is normally comma-separated.']
  ],questions:[
    ['She spoke ___ in the library.','She spoke ___ in the library.',['quietly','yesterdayly'],'A','方式状语靠近 spoke。','The manner adverbial stays close to spoke.'],
    ['中性句尾地点和时间通常如何排列？','What is the common neutral final order of place and time?',[['地点—时间','Place–time'],['时间—地点永远固定','Time–place always']],'A','常见顺序是 place before time。','The common order is place before time.'],
    ['Yesterday 前置有什么作用？','What does initial Yesterday do?',[['建立时间框架','Sets a time frame'],['充当宾语','Acts as object']],'A','它先告诉读者叙事时间。','It frames the narrative time.']
  ]},
  {id:'frequency-adverbs',level:'core',title:['频率副词的位置','Position of frequency adverbs'],meta:['实义动词前、be 后、首个助动词后','Before lexical verbs, after be, after the first auxiliary'],examples:[
    [[['She','subject'],['usually reads','predicate','频率副词在实义动词前','Frequency adverb before lexical verb'],['at night.','adverbial']],'order','usually 放在实义动词 reads 前。','usually comes before the lexical verb reads.'],
    [[['He','subject'],['is often','predicate','频率副词在 be 后','Frequency adverb after be'],['late.','subjectComplement']],'order','be 作限定谓语时，often 通常放在 be 后。','When be is the finite verb, often normally follows it.'],
    [[['They','subject'],['have never seen','predicate','频率副词在首个助动词后','Frequency adverb after first auxiliary'],['snow.','object']],'order','never 位于首个助动词 have 后、主要动词 seen 前。','never follows the first auxiliary have and precedes the main verb seen.']
  ],rules:[
    ['always、usually、often、sometimes、never 等中位频率副词通常放在实义动词前。','Mid-position frequency adverbs such as always, usually, often, sometimes and never normally precede a lexical verb.'],
    ['be 作限定谓语时，频率副词通常放在 be 后。','When be is the finite predicate, a frequency adverb normally follows be.'],
    ['有助动词或情态动词时，频率副词通常放在第一个助动词或情态动词后。','With auxiliaries or modals, a frequency adverb normally follows the first auxiliary or modal.']
  ],questions:[
    ['She ___ reads at night.','She ___ reads at night.',['usually','is usually without be'],'A','实义动词前用 usually。','usually precedes the lexical verb.'],
    ['He is ___ late.','He is ___ late.',['often','before is only'],'A','频率副词在 be 后。','The frequency adverb follows be.'],
    ['They have ___ seen snow.','They have ___ seen snow.',['never','seen never'],'A','never 位于首个助动词后。','never follows the first auxiliary.']
  ]},
  {id:'multiple-adverbials',level:'core',title:['多个状语的排列','Ordering multiple adverbials'],meta:['先看修饰对象，再用中性顺序','Identify scope first, then apply neutral order'],examples:[
    [[['She','subject'],['worked','predicate'],['carefully','adverbial','方式状语','Manner adverbial'],['in the lab','adverbial','地点状语','Place adverbial'],['all morning.','adverbial','时间状语','Time adverbial']],'order','中性排列为方式—地点—时间。','The neutral order is manner–place–time.'],
    [[['Every morning,','adverbial','频率时间框架','Recurring time frame'],['he','subject'],['quietly reads','predicate','方式状语靠近动词','Manner adverbial near verb'],['in the garden.','adverbial','地点状语','Place adverbial']],'information','前置时间建立规律框架，其余状语仍靠近所修饰成分。','Initial time sets a recurring frame; other adverbials stay close to what they modify.'],
    [[['Fortunately,','adverbial','评注性句子状语','Comment sentence adverbial'],['the team','subject'],['arrived','predicate'],['on time.','adverbial','时间状语','Time adverbial']],'order','评注性副词修饰整句，常置于句首并用逗号。','A comment adverbial modifies the whole proposition and is commonly initial with a comma.']
  ],rules:[
    ['多个状语先按修饰范围分层：句子状语、时间框架和动词短语内部状语不能机械混排。','With multiple adverbials, first separate scope: sentence adverbials, time frames and verb-phrase adverbials should not be mechanically mixed.'],
    ['普通句尾状语的常见中性顺序是方式—地点—时间，但焦点和节奏可调整。','A common neutral final order is manner–place–time, though focus and rhythm may alter it.'],
    ['评注性句子状语常置句首并加逗号，表达说话者对整句的评价。','Comment sentence adverbials are commonly initial with a comma and evaluate the whole proposition.']
  ],questions:[
    ['哪一顺序最中性？','Which order is most neutral?',['carefully in the lab all morning','all morning carefully in the lab always'],'A','方式—地点—时间是常见中性顺序。','Manner–place–time is a common neutral order.'],
    ['Every morning 前置主要做什么？','What does initial Every morning mainly do?',[['建立规律时间框架','Sets a recurring time frame'],['修饰 garden','Modifies garden']],'A','它框定整句发生时间。','It frames the time of the whole clause.'],
    ['Fortunately 为什么常置于句首？','Why is Fortunately commonly initial?',[['它评价整句','It evaluates the whole proposition'],['它是 arrive 的宾语','It is the object of arrive']],'A','这是评注性句子状语。','It is a comment sentence adverbial.']
  ]},
  {id:'modifier-order',level:'core',title:['定语前置、后置与中英翻译','Premodifiers, postmodifiers and Chinese–English order'],meta:['短定语多前置，长结构多后置','Short modifiers often precede; long structures often follow'],examples:[
    [[['The red car','subject','形容词前置定语＋中心词','Adjective premodifier + head'],['is','predicate'],['mine.','subjectComplement']],'translation','单个形容词通常放名词前，对应中文“红色的汽车”。','A single adjective normally precedes the noun, matching Chinese order here.'],
    [[['The car parked outside','subject','过去分词短语作后置定语','Past-participle phrase as postmodifier'],['is','predicate'],['mine.','subjectComplement']],'translation','parked outside 后置修饰 car，中文通常前移为“停在外面的汽车”。','parked outside follows car in English but normally moves before 汽车 in Chinese.'],
    [[['The students who arrived late','subject','定语从句作后置定语','Relative clause as postmodifier'],['missed','predicate'],['the introduction.','object']],'translation','who arrived late 后置，中文通常译为“迟到的学生”。','who arrived late follows students but normally moves before 学生 in Chinese.']
  ],rules:[
    ['单个形容词、名词修饰语等较短定语通常放在中心名词前。','Short modifiers such as single adjectives or noun modifiers normally precede the head noun.'],
    ['介词短语、分词短语等较长定语通常放在中心名词后，符合尾重原则。','Longer modifiers such as prepositional or participial phrases normally follow the head noun, following end weight.'],
    ['英语后置定语译成中文时通常前移，但应按意义组块翻译，不能逐词倒序。','English postmodifiers normally move before the noun in Chinese translation, but should be translated in meaning chunks rather than word-by-word reversal.']
  ],questions:[
    ['“红色汽车”对应什么？','Which has the standard adjective–noun order?',['the red car','the car red'],'A','单个形容词前置。','A single adjective precedes the noun.'],
    ['the car parked outside 中 parked outside 作什么？','What role does parked outside play?',[['后置定语','Postmodifier'],['主句谓语','Main predicate']],'A','它后置修饰 car。','It postmodifies car.'],
    ['英语后置定语翻译时应怎样？','How should an English postmodifier normally be translated into Chinese?',[['按意义组块前移','Move it before the noun in meaning chunks'],['逐词倒序','Reverse every word mechanically']],'A','翻译应重组结构而非逐词倒放。','Translation restructures chunks rather than reversing words.']
  ]},
  {id:'double-object-order',level:'core',title:['直接宾语与间接宾语顺序','Order of direct and indirect objects'],meta:['接收者＋事物与事物＋to/for＋接收者','Recipient + thing and thing + to/for + recipient'],examples:[
    [[['She','subject'],['gave','predicate'],['me','indirectObject'],['a book.','directObject']],'order','无介词双宾结构通常是短接收者在前、事物在后。','The double-object construction normally places a short recipient before the thing.'],
    [[['She','subject'],['gave','predicate'],['a book','directObject'],['to the new student from Canada.','adverbial','长接收者 to 短语','Long recipient to-phrase']],'order','接收者较长或需要焦点时，用事物＋to＋接收者。','When the recipient is long or focal, use thing + to + recipient.'],
    [[['Dad','subject'],['bought','predicate'],['a laptop','directObject'],['for me.','adverbial','受益者 for 短语','Beneficiary for-phrase']],'contrast','to 常表示传递方向，for 常表示为某人取得或完成。','to commonly marks transfer direction; for commonly marks beneficiary.']
  ],rules:[
    ['可用双宾结构的动词常采用“动词＋间接宾语＋直接宾语”。','Verbs allowing the double-object construction commonly use verb + indirect object + direct object.'],
    ['接收者很长、需要对比或动词不允许双宾时，常用“事物＋to/for＋接收者”。','When the recipient is long or contrastive, or the verb disallows a double object, use thing + to/for + recipient.'],
    ['to 偏向传递终点，for 偏向受益者；选择取决于动词意义，不能互换套用。','to tends to mark transfer endpoint and for beneficiary; choice depends on verb meaning and is not freely interchangeable.']
  ],questions:[
    ['She gave ___ a book.','She gave ___ a book.',['me','to me in this double-object slot'],'A','双宾结构间接宾语不带介词。','The indirect object is bare in the double-object construction.'],
    ['接收者很长时哪一句更自然？','Which is more natural with a long recipient?',['She gave a book to the new student from Canada.','She gave the new student from Canada a book in every context.'],'A','长成分后置符合尾重。','The long element stays final under end weight.'],
    ['Dad bought a laptop ___ me.','Dad bought a laptop ___ me.',['for','to always'],'A','buy 表示为受益者取得，用 for。','buy commonly takes for for the beneficiary.']
  ]},
  {id:'passive-focus',level:'core',title:['被动语态调整话题与焦点','Passive voice adjusts topic and focus'],meta:['把承受者放到主语位置','Place the affected participant in subject position'],examples:[
    [[['The storm','subject'],['damaged','predicate'],['the bridge.','object']],'information','主动句以施事 storm 为话题。','The active clause takes the agent storm as topic.'],
    [[['The bridge','subject'],['was damaged','predicate'],['by the storm.','adverbial','施事介词短语','Agent phrase']],'information','被动句让 bridge 承接前文话题，施事可后置。','The passive lets bridge continue the discourse topic and postpones the agent.'],
    [[['The results','subject'],['will be announced','predicate'],['tomorrow.','adverbial']],'information','施事不重要、未知或显而易见时可不写 by 短语。','The by-agent is omitted when unimportant, unknown or obvious.']
  ],rules:[
    ['被动语态把主动句宾语提升为主语，可用于承接已知话题。','The passive promotes the active object to subject and can maintain a given topic.'],
    ['施事若是新焦点可放在 by 短语中，通常位于句后。','If the agent is new focus, it may appear in a usually final by-phrase.'],
    ['施事未知、不重要或可推知时，被动句常省略 by 短语。','When the agent is unknown, unimportant or inferable, the passive commonly omits the by-phrase.']
  ],questions:[
    ['要让 bridge 承接前文话题，应选哪句？','Which sentence keeps bridge as the discourse topic?',['The bridge was damaged by the storm.','The storm damaged the bridge.'],'A','被动把 bridge 放主语位置。','The passive places bridge in subject position.'],
    ['被动句的新施事焦点通常放在哪里？','Where is a new agent focus normally placed?',[['句尾 by 短语','A final by-phrase'],['形式主语 it 后','After dummy it']],'A','by 短语通常后置。','The by-phrase is normally final.'],
    ['The results will be announced tomorrow. 为什么可省施事？','Why can the agent be omitted?',[['施事不重要或可推知','It is unimportant or inferable'],['被动永远不能写施事','Passives can never state an agent']],'A','信息重点在 results 和时间。','The focus is on the results and time.']
  ]},
  {id:'fronting-boundary',level:'advanced',title:['前置：有标记的信息结构','Fronting as marked information structure'],meta:['突出对比或衔接，但不能随意搬动','Highlight contrast or cohesion without arbitrary movement'],examples:[
    [[['This book','focus','前置对比宾语','Fronted contrastive object'],['I','subject'],['really enjoyed.','predicate']],'focus','宾语前置带强对比或承接效果，不是普通中性语序。','Object fronting creates strong contrast or cohesion and is not neutral order.'],
    [[['On the wall','adverbial','前置地点状语','Fronted place adverbial'],['hung','predicate'],['a large painting.','subject']],'focus','地点前置并伴随倒装，可营造场景并把新主语 painting 留在句尾。','Fronted place with inversion sets the scene and leaves new subject painting final.'],
    [[['Regarding the budget,','topic','标记话题','Marked topic'],['we','subject'],['need','predicate'],['more data.','object']],'boundary','有标记话题比直接写 The budget, we need more data 更规范清楚。','A marked topic is clearer and more standard than a bare hanging topic.']
  ],rules:[
    ['宾语或补语前置属于有标记语序，通常表达对比、纠正或篇章衔接。','Object or complement fronting is marked order, commonly expressing contrast, correction or discourse linkage.'],
    ['地点成分前置可与倒装结合，把较新、较重主语留在句尾。','A fronted place element may combine with inversion to leave a newer, heavier subject final.'],
    ['正式说明话题时优先使用 regarding/as for 等标记，避免中式裸话题。','For explicit topic framing, prefer regarding/as for and avoid a Chinese-style bare topic.']
  ],questions:[
    ['This book I really enjoyed. 是什么语序？','What kind of order is this?',[['有标记宾语前置','Marked object fronting'],['普通中性语序','Neutral order']],'A','前置表达对比或衔接。','Fronting marks contrast or linkage.'],
    ['On the wall hung a painting. 为什么 painting 在后？','Why is painting final?',[['作为新信息并符合尾重','It is new information and follows end weight'],['因为 painting 是宾语','Because painting is object']],'A','倒装把新主语留在句尾。','Inversion leaves the new subject final.'],
    ['正式引出 budget 话题应选什么？','Which formally introduces the budget topic?',['Regarding the budget, ...','The budget, we ...'],'A','regarding 明确标记话题关系。','regarding explicitly marks the topic relation.']
  ]},
  {id:'inversion-focus',level:'advanced',title:['倒装的信息效果与语法边界','Information effects and boundaries of inversion'],meta:['否定前置、地点倒装与条件倒装','Negative fronting, locative inversion and conditional inversion'],examples:[
    [[['Never','focus','前置否定副词','Fronted negative adverbial'],['have I seen','predicate','助动词倒装谓语','Auxiliary-inverted predicate'],['such a view.','object']],'focus','否定成分前置触发部分倒装，形成强强调。','Fronted negative triggers partial inversion and strong emphasis.'],
    [[['Here','adverbial','前置地点副词','Fronted place adverb'],['comes','predicate'],['the bus.','subject']],'focus','地点倒装常用于引入新主语；代词主语通常写 Here it comes，不倒装为 comes it。','Locative inversion introduces a new subject; pronoun subjects normally use Here it comes.'],
    [[['Had I known,','adverbial','省略 if 的条件倒装','Conditional inversion without if'],['I','subject'],['would have acted','predicate'],['differently.','adverbial']],'boundary','Had I known 等正式条件倒装不能与普通疑问句混淆。','Formal conditional inversion such as Had I known is not an ordinary question.']
  ],rules:[
    ['never、rarely、only then 等限制或否定成分前置时，主句常发生助动词部分倒装。','When restrictive or negative elements such as never, rarely or only then are fronted, the clause commonly uses auxiliary inversion.'],
    ['地点倒装常把新名词主语留在句尾；代词主语通常保持正常顺序。','Locative inversion commonly leaves a new noun subject final; a pronoun subject normally retains regular order.'],
    ['had/were/should 条件倒装可省略 if，属于正式条件结构而非疑问句。','Conditional inversion with had/were/should may omit if and is a formal condition, not a question.']
  ],questions:[
    ['Never ___ such a view.','Never ___ such a view.',['have I seen','I have seen'],'A','否定前置触发部分倒装。','Fronted negative triggers inversion.'],
    ['代词主语时哪项正确？','Which is correct with a pronoun subject?',['Here it comes.','Here comes it.'],'A','代词通常不参与地点完全倒装。','Pronouns normally do not undergo full locative inversion.'],
    ['Had I known 最接近什么？','What is “Had I known” closest to?',['If I had known','Did I know?'],'A','这是省略 if 的条件倒装。','It is conditional inversion without if.']
  ]},
  {id:'cleft-focus',level:'advanced',title:['强调句与分裂句焦点','Cleft constructions and focus'],meta:['用固定框架突出一个成分','Use a fixed frame to focus one element'],examples:[
    [[['It was Mia','focus','强调人物焦点','Focused person'],['who solved the problem.','clause','关系分句','Cleft relative clause']],'focus','It was X who/that ... 把焦点放在 Mia。','It was X who/that ... places focus on Mia.'],
    [[['It was yesterday','focus','强调时间焦点','Focused time'],['that we met.','clause','关系分句','Cleft relative clause']],'focus','强调时间可用 that，引导部分保留其余信息。','A time element may be focused with that, while the following clause retains the rest.'],
    [[['What I need','topic','what 分裂句话题部分','Wh-cleft topic'],['is','predicate'],['a quiet room.','focus','焦点补语','Focused complement']],'focus','what-cleft 把焦点放在系动词后的新信息。','A wh-cleft places focus on the post-copular new information.']
  ],rules:[
    ['It-cleft 使用 It is/was + 焦点 + that/who ...，可突出人、时间、地点等成分。','An it-cleft uses It is/was + focus + that/who ... to highlight a person, time, place or other element.'],
    ['强调句改变信息焦点，不应改变原句核心事实关系。','A cleft changes information focus, not the underlying factual relations.'],
    ['what-cleft 常把已知或概括内容放 what 从句，把新焦点放在 be 后。','A wh-cleft commonly puts given/general content in the what-clause and new focus after be.']
  ],questions:[
    ['It was Mia who solved the problem. 强调谁？','Who is focused?',['Mia','the problem'],'A','焦点位于 It was 后。','The focus follows It was.'],
    ['强调 yesterday 可用什么？','Which can focus yesterday?',['It was yesterday that we met.','Yesterday it was we meet.'],'A','使用 it-cleft 固定框架。','Use the fixed it-cleft frame.'],
    ['What I need is a quiet room. 新焦点是什么？','What is the new focus?',['a quiet room','What I need only'],'A','what-cleft 的焦点常在 be 后。','The wh-cleft focus commonly follows be.']
  ]},
  {id:'focus-particles',level:'advanced',title:['only、also、even 的焦点范围','Focus scope of only, also and even'],meta:['靠近谁就优先限制或补充谁','Position helps identify the focused element'],examples:[
    [[['Only Mia','focus','only 聚焦主语','only focusing subject'],['solved','predicate'],['the problem.','object']],'focus','意思是只有 Mia 解决了，排除其他人。','Only Mia solved it, excluding other people.'],
    [[['Mia','subject'],['only solved','predicate','only 聚焦动作','only focusing action'],['the problem.','object']],'focus','可理解为 Mia 只是解决了问题，没有做更多事；位置改变范围。','Mia merely solved it and did nothing further; position changes scope.'],
    [[['Mia','subject'],['solved','predicate'],['only the first problem.','focus','only 聚焦宾语','only focusing object']],'focus','表示只解决第一题，限制宾语范围。','It means she solved only the first problem, restricting the object.'],
    [[['Even Mia','focus','even 聚焦出乎预期的主语','even focusing unexpected subject'],['also understood','predicate','also 补充动作信息','also adding predicate information'],['the rule.','object']],'focus','even 标记最出乎预期项；also 表示在已有事实之外再增加。','even marks the least expected item; also adds to an existing proposition.']
  ],rules:[
    ['only 的位置影响焦点范围，应尽量靠近被限制成分。','The position of only affects scope; place it close to the restricted element.'],
    ['only 位于主语、谓语或宾语附近可产生不同排除含义。','only near the subject, predicate or object can create different exclusions.'],
    ['also 表添加，even 表出乎预期；二者也应靠近其焦点，避免范围含糊。','also marks addition and even unexpectedness; both should stay close to their focus to avoid ambiguity.'],
    ['口语语调可协助焦点，但书面语更需依靠位置和上下文明确范围。','Speech intonation can help focus, but writing relies more on position and context.']
  ],questions:[
    ['Only Mia solved the problem. 排除了什么？','What is excluded?',[['其他人解决','Other people solving it'],['Mia 做其他事','Mia doing other things']],'A','only 直接聚焦 Mia。','only directly focuses Mia.'],
    ['Mia solved only the first problem. only 限制什么？','What does only restrict?',['the first problem','Mia'],'A','only 靠近宾语。','only is adjacent to the object.'],
    ['also 和 even 的基本区别是什么？','What is the basic difference between also and even?',[['also 表添加，even 表出乎预期','also adds; even marks unexpectedness'],['两者完全相同','They are identical']],'A','两者焦点意义不同。','They carry different focus meanings.'],
    ['书面语如何减少焦点范围歧义？','How can writing reduce focus-scope ambiguity?',[['把焦点副词靠近被修饰成分','Place the focus particle close to its target'],['随机放句中','Place it randomly']],'A','邻近位置帮助读者识别范围。','Adjacency helps readers identify scope.']
  ]},
  {id:'negation-scope',level:'advanced',title:['否定词位置与范围歧义','Negation position and scope ambiguity'],meta:['否定整句还是只否定一个成分','Negating the proposition or one element'],examples:[
    [[['She','subject'],['did not say','predicate'],['that he lied.','object']],'focus','可能表示“她没有说这句话”，否定主句说话行为。','It may mean she did not make that statement, negating the saying event.'],
    [[['She','subject'],['said','predicate'],['that he did not lie.','object']],'focus','否定落在从句，明确表示她说“他没有撒谎”。','Negation is embedded, clearly reporting that he did not lie.'],
    [[['Not every student','focus','部分否定主语','Partially negated subject'],['passed.','predicate']],'focus','not every 表示“并非每个都”，不等于 No student passed。','not every means not all, not No student passed.'],
    [[['I','subject'],['did not invite','predicate'],['him','object'],['because he was famous.','adverbial','原因状语','Reason adverbial']],'boundary','可能歧义：是“没邀请，原因是他有名”，还是“邀请了，但不是因为有名”。需改写明确否定范围。','This is ambiguous: no invitation because of fame, or an invitation for another reason. Rewrite to clarify scope.']
  ],rules:[
    ['否定助动词通常否定其所在谓语范围；主句否定与从句否定表达不同事实。','Auxiliary negation normally scopes over its predicate; main-clause and embedded negation express different facts.'],
    ['not all/every/both 表部分否定，不等于 no/none/neither 的全部否定。','not all/every/both expresses partial negation, unlike total negation with no/none/neither.'],
    ['否定与 because、to do、only 等成分组合时可能产生范围歧义，应通过重排或补充说明消除。','Negation combined with because, infinitives or only may create scope ambiguity; reorder or explain to remove it.'],
    ['书面表达应让 not 靠近实际否定中心，同时检查是否产生意外的宽范围解释。','In writing, place not close to its intended target and check for unintended wide-scope readings.']
  ],questions:[
    ['She did not say that he lied. 形式否定落在哪里？','Where is the formal negation?',[['主句 say','Main-clause say'],['从句 lied','Embedded lied']],'A','did not 修饰 say。','did not modifies say.'],
    ['Not every student passed. 表示什么？','What does this mean?',[['并非所有学生都通过','Not all students passed'],['没有学生通过','No student passed']],'A','这是部分否定。','It is partial negation.'],
    ['not ... because 为什么可能需要改写？','Why may not ... because need rewriting?',[['否定范围可能歧义','Negation scope may be ambiguous'],['because 不能引导从句','because cannot introduce a clause']],'A','读者可能不确定否定主句还是原因。','Readers may not know whether the event or reason is negated.'],
    ['书面语中 not 应如何放置？','How should not be positioned in writing?',[['尽量靠近实际否定中心','As close as possible to its intended target'],['永远放句首','Always initially']],'A','邻近有助于明确范围。','Proximity clarifies scope.']
  ]},
  {id:'paragraph-progression',level:'core',title:['段落中的主题推进','Thematic progression across a paragraph'],meta:['重复承接、线性推进与稳定主题','Constant topic, linear progression and controlled shifts'],examples:[
    [[['Our school opened a new library.','clause','引入主题与新对象','Introduces topic and new entity'],['The library','subject','承接上一句新信息','Picks up previous new information'],['has','predicate'],['three reading rooms.','object']],'information','上一句句尾 library 成为下一句句首已知主题。','The previous final library becomes the next initial given topic.'],
    [[['The library has three reading rooms.','clause','稳定主题句','Constant-topic sentence'],['It','subject','代词保持主题','Pronoun maintaining topic'],['also offers','predicate'],['free workshops.','object']],'information','连续句使用 The library/It 保持主题稳定。','Successive sentences use The library/It to maintain a stable topic.'],
    [[['One workshop teaches research skills.','clause','子主题推进','Subtopic progression'],['These skills','subject','承接前句新信息','Picks up previous new information'],['help','predicate'],['students evaluate sources.','object']],'information','research skills 变成 These skills，形成线性推进。','research skills becomes These skills, creating linear progression.']
  ],rules:[
    ['线性推进常把前一句新信息转为下一句已知主题。','Linear progression commonly turns one sentence’s new information into the next sentence’s given topic.'],
    ['稳定主题推进用同一名词、代词或同义表达连续承接，减少无故跳跃。','Constant-topic progression uses the same noun, pronoun or synonymous expression to avoid unmotivated shifts.'],
    ['段落可从总主题进入子主题，但转换点必须有清楚的词汇或指代桥梁。','A paragraph may move from a general topic to a subtopic, but the transition needs a clear lexical or referential bridge.']
  ],questions:[
    ['A new library 出现后，下一句如何承接最自然？','How can the next sentence most naturally continue after a new library is introduced?',['The library has three rooms.','A completely unrelated topic starts.'],'A','把新信息转为已知主题。','Turn the new information into the given topic.'],
    ['连续谈 library 可用什么保持主题？','What can maintain the library topic?',['The library / It',['随机更换无指代主语','Random unrelated subjects']],'A','名词或代词提供连续性。','A noun or pronoun provides continuity.'],
    ['转入子主题时需要什么？','What is needed when moving to a subtopic?',[['清楚的词汇或指代桥梁','A clear lexical or referential bridge'],['完全省略联系','No connection']],'A','桥梁帮助读者跟踪推进。','A bridge helps readers follow the progression.']
  ]},
  {id:'avoid-chinglish',level:'core',title:['避免悬空话题、头重脚轻与逐词翻译','Avoid hanging topics, top-heavy clauses and word-for-word translation'],meta:['按英语骨架和信息流重组中文意思','Restructure Chinese meaning through English syntax and information flow'],examples:[
    [[['For this book,','adverbial','中式多余介词框架','Unnecessary Chinese-influenced frame'],['I','subject'],['like','predicate'],['it very much.','object']],'rewrite','改为 I like this book very much；不要同时用 for this book 和 it 重复话题。','Rewrite as I like this book very much; do not duplicate the topic with for this book and it.'],
    [[['That every student should learn how to evaluate online information','subject','过长主语','Overly heavy subject'],['is','predicate'],['important.','subjectComplement']],'rewrite','语法可行但头重；普通表达更自然为 It is important that every student ...。','Grammatical but top-heavy; ordinary prose more naturally uses It is important that every student ....'],
    [[['We','subject'],['discussed','predicate'],['the effects of social media on teenagers in modern society.','object','按意义组块的长宾语','Long object organized in meaning chunks']],'translation','先确定主干 We discussed，再按“effects—of social media—on teenagers”组块，不逐词照搬中文顺序。','Establish We discussed, then build chunks effects–of social media–on teenagers rather than copying Chinese word order.']
  ],rules:[
    ['避免“关于 X，我……”式无标记或重复话题，优先把 X 放入主句真实成分槽位。','Avoid unmarked or duplicated “As for X, I ...” patterns; place X in its actual main-clause slot.'],
    ['长主语虽可能合语法，但普通表达常用形式主语或其他重组方式避免头重脚轻。','A long subject may be grammatical, but ordinary prose often uses dummy it or another restructuring to avoid top-heaviness.'],
    ['翻译先确定英语主干和逻辑关系，再按名词短语、介词短语和从句组块表达，不能逐词对位。','In translation, establish the English skeleton and logic first, then express noun, prepositional and clause chunks rather than mapping word by word.']
  ],questions:[
    ['“这本书，我很喜欢”最自然的普通表达是什么？','What is the most natural ordinary version?',['I like this book very much.','For this book, I like it.'],'A','把 book 直接放宾语槽位。','Place book directly in the object slot.'],
    ['长 that 主语导致头重时可怎样？','What can reduce a top-heavy initial that-clause?',[[ '使用形式主语 it 后移从句','Use dummy it and postpone the clause'],['删掉所有主语','Delete every subject']],'A','it 结构保留内容并改善重量。','Dummy it preserves content and improves weight.'],
    ['中译英第一步应做什么？','What should come first in Chinese-to-English translation?',[['确定英语主干和逻辑','Establish the English skeleton and logic'],['逐词按原顺序替换','Replace words in original order']],'A','结构先于词语对位。','Structure comes before word substitution.']
  ]},
  {id:'information-rewrite',level:'advanced',title:['信息结构综合改写','Integrated information-structure rewriting'],meta:['保持事实，调整承接、重量、焦点和范围','Preserve facts while adjusting cohesion, weight, focus and scope'],examples:[
    [[['A new sports centre opened last week.','clause','首次引入新对象','First introduces new entity'],['The centre','subject','已知主题','Given topic'],['offers','predicate'],['free classes for teenagers.','object','新信息','New information']],'rewrite','先用不定表达引入，再用定指主语承接，形成段落推进。','Introduce with an indefinite, then continue with a definite subject to create progression.'],
    [[['It','dummySubject'],['was announced','predicate'],['yesterday','adverbial'],['that the school would extend the programme.','clause','后置真正主语从句','Postponed notional subject clause']],'rewrite','被动省略不重要施事，形式主语后移长从句，yesterday 保持靠近 announce 的时间框架。','The passive omits an unimportant agent, dummy it postpones the heavy clause, and yesterday frames the announcement.'],
    [[['Only after the survey ended','focus','前置限制状语','Fronted restrictive adverbial'],['did the team understand','predicate','部分倒装','Partial inversion'],['the problem.','object']],'rewrite','only 前置聚焦时间边界并触发倒装；若无需强强调，应改回 The team understood ... only after ...。','Fronted only focuses the time boundary and triggers inversion; without strong emphasis, use neutral order.'],
    [[['Not all students','focus','部分否定主语','Partially negated subject'],['found','predicate'],['the new system','object'],['easy to use.','objectComplement']],'rewrite','not all 明确“并非全部”，避免写成 All students did not ... 的范围歧义。','not all clearly means not every student, avoiding the scope ambiguity of All students did not ....']
  ],rules:[
    ['综合改写先保证事实关系不变，再检查已知—新信息承接。','Integrated rewriting first preserves factual relations, then checks given-to-new progression.'],
    ['利用被动、形式主语/宾语和后置结构调整话题与重量，但不能改变语义角色。','Use passive, dummy elements and postponement to adjust topic and weight without changing semantic roles.'],
    ['前置、倒装和分裂句只在需要强焦点时使用；中性表达优先普通语序。','Use fronting, inversion and clefts only for strong focus; prefer ordinary order for neutral expression.'],
    ['焦点副词和否定词改写后必须重新检查范围，防止产生新歧义。','After moving focus particles or negatives, recheck scope to prevent new ambiguity.']
  ],questions:[
    ['首次引入 centre 后如何推进？','How should the paragraph progress after introducing a centre?',['The centre offers ...','Another unrelated noun without link ...'],'A','定指主语承接新对象。','A definite subject picks up the new entity.'],
    ['长公告内容如何避免头重？','How can a long announcement clause avoid top-heaviness?',['It was announced that ...','That ... was announced only as the default always'],'A','形式主语后移长从句。','Dummy it postpones the heavy clause.'],
    ['不需要强强调时应优先什么？','What is preferred without strong focus?',[['普通中性语序','Neutral ordinary order'],['强制 only 前置倒装','Mandatory fronted-only inversion']],'A','有标记结构应服务真实焦点。','Marked structure should serve genuine focus.'],
    ['表达“并非所有学生”最清楚的是哪项？','Which most clearly means “not every student”?',['Not all students ...','All students did not ...'],'A','not all 明确部分否定范围。','not all clearly marks partial negation.']
  ]}
];

const sectionSpecs=[
  ['foundation-flow','主干与信息推进','Skeleton and information flow','从英语主干、已知新信息和尾重原则建立基础。','Build foundations from English skeletons, given/new flow and end weight.',['skeleton-vs-topic','given-new-flow','end-weight-short-long']],
  ['weight-constructions','重量调整结构','Weight-management constructions','用形式主宾语和存在句安排长信息与新信息。','Use dummy elements and existentials to arrange heavy and new information.',['dummy-subject','dummy-object','existential-new-information']],
  ['adverbial-modifier-order','状语与定语位置','Adverbial and modifier position','掌握基本状语、多状语、频率副词和定语顺序。','Master basic adverbials, multiple adverbials, frequency adverbs and modifier order.',['basic-adverbial-position','frequency-adverbs','multiple-adverbials','modifier-order']],
  ['object-passive-focus','宾语顺序与被动焦点','Object order and passive focus','处理传递结构，并用被动调整话题。','Handle transfer constructions and use passive to adjust topic.',['double-object-order','passive-focus']],
  ['marked-focus','有标记焦点结构','Marked focus structures','区分前置、倒装和分裂句的使用边界。','Distinguish the boundaries of fronting, inversion and clefts.',['fronting-boundary','inversion-focus','cleft-focus']],
  ['scope','焦点与否定范围','Focus and negation scope','明确 only/also/even 与否定词的作用域。','Clarify the scope of only/also/even and negation.',['focus-particles','negation-scope']],
  ['discourse-rewrite','段落推进与综合改写','Discourse progression and integrated rewriting','避免中式语序，建立跨句承接并综合改写。','Avoid Chinese-influenced order, build cohesion and rewrite integratively.',['paragraph-progression','avoid-chinglish','information-rewrite']]
];
function buildInformationOrderCourse(english){const course=specs.map((s,i)=>lesson(english,s,i));const ids=course.map(x=>x.id),assigned=sectionSpecs.flatMap(x=>x[5]);if(ids.length!==assigned.length||new Set(assigned).size!==assigned.length||ids.some(id=>!assigned.includes(id))||assigned.some(id=>!ids.includes(id)))throw new Error('Invalid information-order section coverage');const sections=sectionSpecs.map(x=>({id:x[0],title:pick(english,x[1],x[2]),copy:pick(english,x[3],x[4]),lessonIds:x[5].slice(),lessonCount:x[5].length}));const core=course.filter(x=>x.level==='core'),advanced=course.filter(x=>x.level==='advanced');return{title:pick(english,`信息结构与语序 · ${course.length} 节微课`,`Information structure and word order · ${course.length} lessons`),copy:pick(english,'从主干、信息重量和焦点范围出发，写出自然清楚而非逐词翻译的英语。','Use skeleton, information weight and focus scope to produce natural, clear English rather than word-for-word translation.'),course,sections,groups:[{id:'core',title:pick(english,`核心必学 · ${core.length} 节`,`Core · ${core.length} essential lessons`),copy:pick(english,'主干、已知新信息、尾重、常规语序和篇章承接。','Skeletons, given/new flow, end weight, neutral order and cohesion.'),lessons:core},{id:'advanced',title:pick(english,`进阶挑战 · ${advanced.length} 节`,`Advanced · ${advanced.length} challenge lessons`),copy:pick(english,'前置倒装、强调、焦点范围和综合改写。','Fronting, inversion, clefts, scope and integrated rewriting.'),lessons:advanced}]};}
module.exports={buildInformationOrderCourse};
