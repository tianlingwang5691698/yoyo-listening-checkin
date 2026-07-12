const pick=(english,zh,en)=>english?en:zh;
const INCLUDE_RULE_COVERAGE=typeof GRAMMAR_RUNTIME==='undefined'||!GRAMMAR_RUNTIME;
const labels={subject:['主语','Subject'],predicate:['谓语动词','Predicate verb'],object:['宾语','Object'],indirectObject:['间接宾语','Indirect object'],directObject:['直接宾语','Direct object'],subjectComplement:['主语补语（表语）','Subject complement'],objectComplement:['宾语补语','Object complement'],attribute:['定语','Attribute'],adverbial:['状语','Adverbial'],auxiliary:['助动词','Auxiliary'],preposition:['介词','Preposition'],prepositionalObject:['介词宾语','Object of preposition'],dummySubject:['形式主语','Dummy subject'],dummyObject:['形式宾语','Dummy object'],existential:['存在句引导词','Existential there'],conjunction:['连接词','Connector'],focus:['焦点成分','Focus element'],topic:['话题成分','Topic element'],clause:['分句','Clause']};
function analysis(english,chunks){return chunks.map(([text,role,zh,en])=>({text,role,label:pick(english,zh||(labels[role]||['',''])[0],en||(labels[role]||['',''])[1])}));}
function note(english,mode,zh,en){if(!mode)return{visible:false,mode:'',title:'',body:'',detail:''};const titles={order:['语序观察','Order focus'],translation:['中英语序','Chinese–English order'],information:['信息推进','Information flow'],focus:['焦点范围','Focus scope'],boundary:['边界提醒','Boundary note'],rewrite:['改写策略','Rewriting strategy']};return{visible:true,mode,title:pick(english,...(titles[mode]||titles.order)),body:pick(english,zh,en),detail:''};}
const opt=(english,v)=>Array.isArray(v)?pick(english,v[0],v[1]):v;
function question(english,x,index){const reverse=index%2===1&&x[2].length===2,values=reverse?x[2].slice().reverse():x[2],answer=reverse?(x[3]==='A'?'B':x[3]==='B'?'A':x[3]):x[3];return{question:pick(english,x[0],x[1]),options:values.map((v,i)=>({key:String.fromCharCode(65+i),text:opt(english,v)})),answer,correct:pick(english,x[4],x[5]),wrong:pick(english,`再看语序：${x[4]}`,`Check the order: ${x[5]}`)};}
function lesson(english,s,index){if(s.rules.length!==s.examples.length||s.rules.length!==s.questions.length)throw new Error(`Information-order coverage mismatch: ${s.id}`);const examples=s.examples.map(x=>({text:x[0].map(c=>c[0]).join(' '),analysis:analysis(english,x[0]),note:note(english,x[1],x[2],x[3])}));return{id:s.id,no:String(index+1).padStart(2,'0'),level:s.level,title:pick(english,...s.title),meta:pick(english,...s.meta),examples:examples.map(x=>x.text),analyses:examples.map(x=>x.analysis),exampleNotes:examples.map(x=>x.note),rules:s.rules.map(x=>pick(english,...x)),ruleCoverage:INCLUDE_RULE_COVERAGE?s.rules.map((_,i)=>({exampleIndexes:[i],questionIndexes:[i]})):[],questions:s.questions.map((x,i)=>question(english,x,index+i))};}

const specs=[
  {id:'information-order-essence',level:'core',title:['信息顺序的定义、本质与边界','Definition, core and boundaries of information order'],meta:['语法管结构，信息顺序管读者先看到什么、最后记住什么','Grammar builds the structure; information order guides what readers meet first and retain as focus'],examples:[
    [[['Mia','subject','施事者作为话题','Agent as topic'],['solved','predicate'],['the problem.','object','新信息','New information']],'information','这是中性主动语序：先从 Mia 说起，再把“解决了问题”作为新消息送出。','This is neutral active order: it starts from Mia and presents solving the problem as the new message.'],
    [[['The problem','subject','受事者作为已知话题','Affected entity as given topic'],['was solved','predicate'],['by Mia.','adverbial','施事者介词短语','Agent phrase']],'information','事实仍是 Mia 解决问题，但被动句先承接 the problem，再把施事者 Mia 放到后面。','The fact is unchanged, but the passive first continues the problem as topic and places the agent Mia later.'],
    [[['That the plan failed','subject','真正主语从句','Notional subject clause'],['is','predicate'],['obvious.','subjectComplement']],'boundary','这句语法正确，但长主语在句首较重；普通语境常改为 It is obvious that the plan failed。','This is grammatical, but its long initial subject is heavy; neutral prose often uses It is obvious that the plan failed.'],
    [[['Only then','adverbial','前置限制性焦点状语','Fronted restrictive focus adverbial'],['did','auxiliary','倒装助动词','Inverted auxiliary'],['we','subject'],['understand','predicate','主要谓语动词','Main predicate verb'],['the cause.','object']],'focus','Only then 是前置焦点状语，did 移到主语 we 前，主要动词 understand 保持原形。','Only then is the fronted focus adverbial; did moves before subject we, while main verb understand stays in the base form.']
  ],rules:[
    ['信息顺序是在语法允许的结构中安排话题、已知信息、新信息和焦点；它不改变句子的核心参与关系。','Information order arranges topic, given information, new information and focus within grammatical structures; it does not change the clause’s core participant relations.'],
    ['主动、被动等不同结构可以表达同一基本事实，但会选择不同话题和句尾焦点。','Active, passive and other structures may express the same basic fact while selecting different topics and final focus.'],
    ['“语法正确”只说明结构合法；“信息自然”还要检查上下文承接、成分重量和焦点位置。','Grammatical means structurally well formed; informationally natural also requires suitable cohesion, weight and focus.'],
    ['中性语序适合无强对比的普通陈述；前置、倒装、分裂句等有标记结构必须服务于真实的对比或焦点。','Neutral order suits ordinary statements without strong contrast; marked fronting, inversion and clefts must serve a real contrast or focus.']
  ],questions:[
    ['信息顺序主要安排什么？','What does information order mainly arrange?',[[ '话题、已知信息、新信息和焦点','Topic, given information, new information and focus'],['单词的词性','The parts of speech of individual words']],'A','它在合法结构中安排信息。','It arranges information within grammatical structures.'],
    ['The problem was solved by Mia. 与 Mia solved the problem. 的核心事实关系如何？','How do the core factual relations compare?',[[ '相同，但话题和焦点不同','The same, but topic and focus differ'],['完全相反','Completely opposite']],'A','被动改变信息起点，不改变谁解决问题。','The passive changes the information starting point, not who solved the problem.'],
    ['That the plan failed is obvious. 应如何判断？','How should this sentence be judged?',[[ '语法正确，但普通语境可用形式主语减轻句首','Grammatical, but dummy it can lighten the opening in neutral prose'],['因为从句作主语而语法错误','Ungrammatical because a clause cannot be subject']],'A','要分开语法合法性与信息自然度。','Separate grammaticality from informational naturalness.'],
    ['Only then did we understand the cause. 为什么用倒装？','Why does this sentence use inversion?',[[ '前置 only then 强调时间边界并触发部分倒装','Fronted only then focuses the time boundary and triggers partial inversion'],['only then 前置后仍保持主语—谓语普通顺序','Fronted only then retains ordinary subject–predicate order']],'A','前置限制性状语触发助动词倒装。','A fronted restrictive adverbial triggers auxiliary inversion.']
  ]},
  {id:'skeleton-vs-topic',level:'core',title:['英语主干顺序与中文话题式表达','English skeleton order and Chinese topic-prominent expression'],meta:['先落实主语和谓语，再安排话题','Build subject and predicate before arranging the topic'],examples:[
    [[['This problem,','object','前置宾语（篇章话题）','Fronted object as discourse topic'],['we','subject'],['need to discuss.','predicate']],'boundary','This problem 在句法上仍是 discuss 的宾语，在信息上被前置作话题；若无对比或承接，We need to discuss this problem 更中性。','This problem remains the object of discuss syntactically but is fronted as discourse topic; without contrast or linkage, We need to discuss this problem is more neutral.'],
    [[['We','subject'],['need to discuss','predicate'],['this problem.','object']],'order','英语普通陈述句先建立主语—谓语—宾语主干。','An ordinary English statement first establishes its subject–verb–object skeleton.'],
    [[['As for this problem,','topic','有明确标记的话题','Explicitly marked topic'],['we','subject'],['need to discuss','predicate'],['it further.','object']],'boundary','需要突出话题时，用 as for 等明确标记，并在主句中保持完整指代。','When a topic must be foregrounded, mark it with as for and keep a complete reference in the clause.']
  ],rules:[
    ['英语普通句通常要求显式主语和限定谓语；无标记话题化可以合法，但需要真实的对比或篇章承接语境。','An ordinary English clause normally requires an explicit subject and finite predicate; unmarked topicalization can be grammatical but needs real contrast or discourse linkage.'],
    ['中文“话题＋说明”常需重组为英语主语—谓语—宾语或主系表主干。','A Chinese topic–comment structure often needs restructuring into an English SVO or SVC skeleton.'],
    ['as for、regarding 可显式搭建话题框架，但不是所有前置话题的必需条件；后续主句仍须结构完整。','as for and regarding explicitly frame a topic, but they are not required for every topicalization; the following main clause must still be complete.']
  ],questions:[
    ['无强对比语境时，“这个问题，我们需要讨论”最自然的普通英语是什么？','Without strong contrast, what is the most natural ordinary version?',['We need to discuss this problem.','This problem, we need to discuss.'],'A','两句都可合法，但普通陈述优先中性 SVO。','Both can be grammatical, but a neutral statement normally prefers SVO.'],
    ['英语普通分句最基本需要什么？','What does an ordinary English finite clause basically require?',[['主语和限定谓语','A subject and finite predicate'],['只要话题','Only a topic']],'A','主干不能只靠话题暗示。','The skeleton cannot rely only on an implied topic.'],
    ['as for 或 regarding 引出话题后，主句应怎样？','What should follow a topic framed by as for or regarding?',[['保持结构完整并有清楚指代','A complete clause with clear reference'],['省掉主语和谓语','Omit subject and predicate']],'A','话题框架不替代主句骨架。','A topic frame does not replace the clause skeleton.']
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
    ['首次引入“一个学生”通常用什么？','What normally introduces a student for the first time?',['a student','the student'],'A','无可识别上下文时，新对象通常用不定表达。','Without identifying context, a new entity normally uses an indefinite expression.'],
    ['The main problem is the lack of data. 新信息通常在哪里？','Where is the new information normally located?',['the lack of data','The main problem only'],'A','句尾补语提供新说明。','The final complement supplies the new specification.']
  ]},
  {id:'end-weight-short-long',level:'core',title:['尾重原则与短前长后','End weight and short-before-long order'],meta:['把复杂信息放到读者容易处理的位置','Place complex information where readers can process it easily'],examples:[
    [[['It','dummySubject'],['is','predicate'],['important','subjectComplement'],['that every student understands the rule.','clause','后置长主语从句','Postponed heavy subject clause']],'order','长从句放句尾比 That every student understands the rule is important 更轻快。','The heavy clause is easier to process at the end than in initial position.'],
    [[['She','subject'],['gave','predicate'],['him','indirectObject','短间接宾语','Short indirect object'],['a detailed explanation of the new policy.','directObject','长直接宾语','Long direct object']],'order','较短成分先出现，长而新的信息留在句尾。','The shorter element comes first and the long new information remains final.'],
    [[['We','subject'],['explained','predicate'],['the problem','directObject','较短直接宾语','Shorter direct object'],['to','preposition','引出接收对象的介词','Preposition introducing recipient'],['the students who had just arrived.','prepositionalObject','to 的介词宾语','Object of to']],'order','explain 要求“内容＋to＋接收者”；长接收者留在句尾也符合尾重。','explain takes content + to + recipient; leaving the long recipient final also follows end weight.']
  ],rules:[
    ['尾重原则倾向把长、复杂或信息量大的成分放在句尾。','The end-weight principle tends to place long, complex or information-heavy elements at the end.'],
    ['在语法允许时，较短成分通常先于较长成分，降低即时处理负担。','When grammar permits, shorter elements normally precede longer ones to reduce processing load.'],
    ['双宾或传递结构中，长接收者常改用“事物＋to/for＋接收者”顺序。','In transfer constructions, a long recipient often follows in thing + to/for + recipient order.']
  ],questions:[
    ['普通语境中，哪一句更符合尾重原则？','Which better follows end weight in neutral prose?',['It is important that every student understands the rule.','That every student understands the rule is important.'],'A','两句都合法，但形式主语把长从句留在句尾。','Both are grammatical, but dummy it leaves the heavy clause final.'],
    ['短宾语和长宾语并存时通常如何排列？','How are a short and a long complement normally ordered?',[['短前长后','Short before long'],['长前短后','Long before short']],'A','短前长后更易处理。','Short-before-long is easier to process.'],
    ['接收者很长时，哪种表达更自然？','Which is more natural with a long recipient?',['explain the problem to the students who arrived','explain the students who arrived the problem'],'A','长接收者用 to 短语后置。','A long recipient follows in a to-phrase.']
  ]},
  {id:'dummy-subject',level:'core',title:['形式主语 it 调整信息重量','Dummy subject it and information weight'],meta:['先给判断框架，再给真正内容','Give the evaluation frame before the heavy content'],examples:[
    [[['It','dummySubject'],['is','predicate'],['obvious','subjectComplement'],['that we need more time.','clause','真正主语从句','Notional subject clause']],'information','先呈现评价 obvious，再在句尾展开真正内容。','The evaluation obvious comes first and the actual content unfolds at the end.'],
    [[['It','dummySubject'],['took','predicate'],['us','object','耗时者宾语','Experiencer object'],['two hours','adverbial','时长补足成分','Duration complement'],['to finish the task.','clause','真正主语不定式','Notional infinitive subject']],'order','us 是耗时者宾语，two hours 表时长，不是“间接宾语＋直接宾语”；真正内容由句尾不定式表达。','us is the experiencer object and two hours a duration complement, not an indirect–direct object pair; the final infinitive carries the notional content.'],
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
    ['已知或定指对象通常更适合作普通主语；there be 不是汉语“有”的逐词万能对应。','A given or definite entity is normally better as an ordinary subject; there be is not a universal word-for-word equivalent of the Chinese existence verb.']
  ],questions:[
    ['首次引入“一条消息”更自然的表达是什么？','Which naturally introduces a message for the first time?',['There is a message for you.','The message there has for you.'],'A','存在句把新对象放后。','The existential introduces the new entity postverbally.'],
    ['存在句实义主语常是什么类型？','What kind of notional subject is common in an existential?',[['不定或数量表达','Indefinite or quantified'],['无语境的强定指表达','Strong definite without context']],'A','存在句主要引入新信息。','Existentials mainly introduce new information.'],
    ['已知的 building 是段落话题时，哪句更中性？','Which is more neutral when the building is already the paragraph topic?',[['The building stands near the station.','The building stands near the station.'],['There stands a building near the station.','There stands a building near the station.']],'A','已知对象适合作普通主语，there 结构更像在引入对象。','A given entity naturally serves as ordinary subject; the there-pattern sounds presentational.']
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
    ['表示“她在图书馆轻声说话”，哪一项最中性？','Which is the most neutral order for speaking quietly in the library?',['She spoke quietly in the library.','She spoke in the library quietly.'],'A','方式状语通常靠近 spoke，地点随后。','The manner adverbial normally stays close to spoke, followed by place.'],
    ['不特别强调时，哪句的句尾顺序更中性？','Without special focus, which final order is more neutral?',[['We met at the station yesterday.','We met at the station yesterday.'],['We met yesterday at the station.','We met yesterday at the station.']],'A','普通句尾常用地点—时间。','Neutral final order commonly uses place–time.'],
    ['Yesterday 前置有什么作用？','What does initial Yesterday do?',[['建立时间框架','Sets a time frame'],['充当宾语','Acts as object']],'A','它先告诉读者叙事时间。','It frames the narrative time.']
  ]},
  {id:'frequency-adverbs',level:'core',title:['频率副词的位置','Position of frequency adverbs'],meta:['实义动词前、be 后、首个助动词后','Before lexical verbs, after be, after the first auxiliary'],examples:[
    [[['She','subject'],['usually','adverbial','频率状语','Frequency adverbial'],['reads','predicate'],['at night.','adverbial','时间状语','Time adverbial']],'order','usually 是频率状语，放在实义谓语动词 reads 前。','usually is a frequency adverbial placed before the lexical predicate verb reads.'],
    [[['He','subject'],['is','predicate'],['often','adverbial','频率状语','Frequency adverbial'],['late.','subjectComplement']],'order','is 是限定谓语，often 是状语，通常放在 be 后。','is is the finite predicate and often an adverbial, normally placed after be.'],
    [[['They','subject'],['have','auxiliary','完成体助动词','Perfect auxiliary'],['never','adverbial','频率状语','Frequency adverbial'],['seen','predicate','主要动词','Main verb'],['snow.','object']],'order','never 是状语，位于首个助动词 have 后、主要动词 seen 前。','never is an adverbial placed after the first auxiliary have and before the main verb seen.']
  ],rules:[
    ['always、usually、often、sometimes、never 等中位频率副词通常放在实义动词前。','Mid-position frequency adverbs such as always, usually, often, sometimes and never normally precede a lexical verb.'],
    ['be 作限定谓语时，频率副词通常放在 be 后。','When be is the finite predicate, a frequency adverb normally follows be.'],
    ['有助动词或情态动词时，频率副词通常放在第一个助动词或情态动词后。','With auxiliaries or modals, a frequency adverb normally follows the first auxiliary or modal.']
  ],questions:[
    ['哪一项是频率副词的中性位置？','Which uses the neutral position of the frequency adverb?',['She usually reads at night.','She reads usually at night.'],'A','usually 通常在实义动词 reads 前。','usually normally precedes the lexical verb reads.'],
    ['哪一项的 often 位置中性？','Which uses the neutral position of often?',['He is often late.','He often is late.'],'A','be 作限定谓语时，often 通常在 be 后。','With finite be, often normally follows be.'],
    ['哪一项的 never 位置中性？','Which uses the neutral position of never?',['They have never seen snow.','They never have seen snow.'],'A','never 通常位于首个助动词后。','never normally follows the first auxiliary.']
  ]},
  {id:'multiple-adverbials',level:'core',title:['多个状语的排列','Ordering multiple adverbials'],meta:['先看修饰对象，再用中性顺序','Identify scope first, then apply neutral order'],examples:[
    [[['She','subject'],['worked','predicate'],['carefully','adverbial','方式状语','Manner adverbial'],['in the lab','adverbial','地点状语','Place adverbial'],['all morning.','adverbial','时间状语','Time adverbial']],'order','中性排列为方式—地点—时间。','The neutral order is manner–place–time.'],
    [[['Every morning,','adverbial','频率时间框架','Recurring time frame'],['he','subject'],['quietly','adverbial','方式状语','Manner adverbial'],['reads','predicate'],['in the garden.','adverbial','地点状语','Place adverbial']],'information','Every morning 框定整句时间，quietly 单独作方式状语并靠近 reads。','Every morning frames the whole clause, while quietly is a separate manner adverbial close to reads.'],
    [[['Fortunately,','adverbial','评注性句子状语','Comment sentence adverbial'],['the team','subject'],['arrived','predicate'],['on time.','adverbial','时间状语','Time adverbial']],'order','评注性副词修饰整句，常置于句首并用逗号。','A comment adverbial modifies the whole proposition and is commonly initial with a comma.']
  ],rules:[
    ['多个状语先按修饰范围分层：句子状语、时间框架和动词短语内部状语不能机械混排。','With multiple adverbials, first separate scope: sentence adverbials, time frames and verb-phrase adverbials should not be mechanically mixed.'],
    ['普通句尾状语的常见中性顺序是方式—地点—时间，但焦点和节奏可调整。','A common neutral final order is manner–place–time, though focus and rhythm may alter it.'],
    ['评注性句子状语常置句首并加逗号，表达说话者对整句的评价。','Comment sentence adverbials are commonly initial with a comma and evaluate the whole proposition.']
  ],questions:[
    ['哪一顺序更符合普通句尾的方式—地点—时间？','Which better follows neutral manner–place–time order?',['She worked carefully in the lab all morning.','She worked all morning in the lab carefully.'],'A','两句成分都完整，但前者是常见中性顺序。','Both are structurally complete, but the first follows the common neutral order.'],
    ['Every morning 前置主要做什么？','What does initial Every morning mainly do?',[['建立规律时间框架','Sets a recurring time frame'],['修饰 garden','Modifies garden']],'A','它框定整句发生时间。','It frames the time of the whole clause.'],
    ['Fortunately 为什么常置于句首？','Why is Fortunately commonly initial?',[['它评价整句','It evaluates the whole proposition'],['它是 arrive 的宾语','It is the object of arrive']],'A','这是评注性句子状语。','It is a comment sentence adverbial.']
  ]},
  {id:'modifier-order',level:'core',title:['定语前置、后置与中英翻译','Premodifiers, postmodifiers and Chinese–English order'],meta:['短定语多前置，长结构多后置','Short modifiers often precede; long structures often follow'],examples:[
    [[['The','attribute','限定词','Determiner'],['red','attribute','形容词前置定语','Adjective premodifier'],['car','subject','主语中心词','Subject head'],['is','predicate'],['mine.','subjectComplement']],'translation','主语短语的中心词是 car，red 在它前面作定语；这一点与中文顺序相同。','The subject phrase is headed by car, with red as its premodifier; the Chinese order is the same here.'],
    [[['The','attribute','限定词','Determiner'],['car','subject','主语中心词','Subject head'],['parked outside','attribute','过去分词短语作后置定语','Past-participle phrase as postmodifier'],['is','predicate'],['mine.','subjectComplement']],'translation','主语中心词是 car，parked outside 后置限定哪辆车；中文通常把这个意义块移到“汽车”前。','The subject head is car, and parked outside follows it to identify which car; Chinese normally moves this meaning chunk before the head noun.'],
    [[['The','attribute','限定词','Determiner'],['students','subject','主语中心词','Subject head'],['who arrived late','attribute','定语从句作后置定语','Relative clause as postmodifier'],['missed','predicate'],['the introduction.','object']],'translation','主语中心词是 students，who arrived late 后置筛选学生；中文通常重组为“迟到的学生”。','The subject head is students, and who arrived late follows it to identify the group; Chinese normally moves the relative-clause meaning before the head noun.']
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
    [[['She','subject'],['gave','predicate'],['a book','directObject'],['to','preposition','传递终点介词','Transfer-endpoint preposition'],['the new student from Canada.','prepositionalObject','to 的介词宾语','Object of to']],'order','give 可用“事物＋to＋接收者”补足传递终点；长接收者放后也符合尾重。','give can use thing + to + recipient to complete the transfer relation; a long recipient also fits end weight in final position.'],
    [[['Dad','subject'],['bought','predicate'],['a laptop','directObject'],['for','preposition','引出受益者的介词','Beneficiary preposition'],['me.','prepositionalObject','for 的介词宾语','Object of for']],'contrast','for me 与 bought 一起说明购买的受益对象；to 常标传递终点，不能只按位置互换。','for me completes the beneficiary relation with bought; to commonly marks a transfer endpoint, so the two are not interchangeable by position alone.']
  ],rules:[
    ['可用双宾结构的动词常采用“动词＋间接宾语＋直接宾语”。','Verbs allowing the double-object construction commonly use verb + indirect object + direct object.'],
    ['接收者很长、需要对比或动词不允许双宾时，常用“事物＋to/for＋接收者”。','When the recipient is long or contrastive, or the verb disallows a double object, use thing + to/for + recipient.'],
    ['to 偏向传递终点，for 偏向受益者；选择取决于动词意义，不能互换套用。','to tends to mark transfer endpoint and for beneficiary; choice depends on verb meaning and is not freely interchangeable.']
  ],questions:[
    ['She gave a book ___.','She gave a book ___.',['to me','me'],'A','宾语已放在前面时，接收者用 to me。','When the object comes first, express the recipient with to me.'],
    ['接收者很长时，哪一句更符合尾重？','Which better follows end weight with a long recipient?',['She gave a book to the new student from Canada.','She gave the new student from Canada a book.'],'A','两种 give 结构都可成立，但长接收者用 to 短语后置更易处理。','Both give patterns are possible, but a long recipient is easier to process in a final to-phrase.'],
    ['哪一项正确标出 bought 的受益者？','Which correctly marks the beneficiary of bought?',['Dad bought a laptop for me.','Dad bought a laptop to me.'],'A','buy 的受益对象通常由 for 引出。','The beneficiary of buy is normally introduced by for.']
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
    ['The results will be announced tomorrow. 为什么没写 by 短语？','Why is there no by-phrase?',[['施事不重要或可推知','The agent is unimportant or inferable'],['施事是句子需要强调的新焦点','The agent is the new focus that the sentence needs to emphasize']],'A','信息重点在 results 和公布时间。','The focus is on the results and announcement time.']
  ]},
  {id:'fronting-boundary',level:'advanced',title:['前置：有标记的信息结构','Fronting as marked information structure'],meta:['突出对比或衔接，但不能随意搬动','Highlight contrast or cohesion without arbitrary movement'],examples:[
    [[['This book','object','前置宾语（对比焦点）','Fronted object as contrastive focus'],['I','subject'],['really enjoyed.','predicate']],'focus','This book 在句法上仍是 enjoyed 的宾语，在信息上前置形成对比或承接。','This book remains the object of enjoyed syntactically and is fronted informationally for contrast or cohesion.'],
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
    [[['Never','adverbial','前置否定焦点状语','Fronted negative focus adverbial'],['have','auxiliary','倒装助动词','Inverted auxiliary'],['I','subject'],['seen','predicate','主要谓语动词','Main predicate verb'],['such a view.','object']],'focus','Never 前置后，助动词 have 移到主语 I 前，seen 仍是主要动词。','After Never is fronted, auxiliary have moves before subject I, while seen remains the main verb.'],
    [[['Here','adverbial','前置地点副词','Fronted place adverb'],['comes','predicate'],['the bus.','subject']],'focus','地点倒装常用于引入新主语；代词主语通常写 Here it comes，不倒装为 comes it。','Locative inversion introduces a new subject; pronoun subjects normally use Here it comes.'],
    [[['Had','auxiliary','条件倒装中的前置助动词','Fronted auxiliary in conditional inversion'],['I','subject','条件从句主语','Conditional-clause subject'],['known,','predicate','条件从句主要谓语','Main predicate of the conditional clause'],['I','subject'],['would have acted','predicate'],['differently.','adverbial']],'boundary','Had I known 内部是 Had＋I＋known，相当于 If I had known；前置的是助动词，不是普通疑问。','Had I known contains Had + I + known and corresponds to If I had known; the auxiliary is fronted, but this is not an ordinary question.']
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
    [[['It','dummySubject','分裂句框架主语','Cleft-frame subject'],['was','predicate'],['Mia','subjectComplement','人物焦点表语','Focused person complement'],['who solved the problem.','clause','补全其余信息的分裂分句','Cleft clause completing the remainder']],'focus','Mia 占据 be 后焦点位；who 分句补全剩余事实，这里应整体识别为 it-cleft，不当作普通名词后的定语从句。','Mia occupies the post-be focus slot; the who-clause completes the remaining fact. Analyze the whole structure as an it-cleft, not as an ordinary noun-modifying relative clause.'],
    [[['It','dummySubject','分裂句框架主语','Cleft-frame subject'],['was','predicate'],['yesterday','subjectComplement','时间焦点表语','Focused time complement'],['that we met.','clause','补全其余信息的分裂分句','Cleft clause completing the remainder']],'focus','yesterday 占据焦点位，that we met 保留“我们见面”这一已知框架。','yesterday occupies the focus slot, while that we met retains the given frame that the meeting occurred.'],
    [[['What I need','subject','what 分裂句主语（话题）','Wh-cleft subject and topic'],['is','predicate'],['a quiet room.','subjectComplement','焦点表语','Focused subject complement']],'focus','What I need 在外层是整个句子的主语，同时承载话题；a quiet room 是 be 后的新焦点表语。','What I need is the outer subject and also carries the topic; a quiet room is the new focused subject complement after be.']
  ],rules:[
    ['It-cleft 使用 It is/was + 焦点 + that/who ...，可突出人、时间、地点等成分。','An it-cleft uses It is/was + focus + that/who ... to highlight a person, time, place or other element.'],
    ['强调句改变信息焦点，不应改变原句核心事实关系。','A cleft changes information focus, not the underlying factual relations.'],
    ['what-cleft 常把已知或概括内容放 what 从句，把新焦点放在 be 后。','A wh-cleft commonly puts given/general content in the what-clause and new focus after be.']
  ],questions:[
    ['It was Mia who solved the problem. 强调谁？','Who is focused?',['Mia','the problem'],'A','焦点位于 It was 后。','The focus follows It was.'],
    ['哪句用 it-cleft 专门聚焦 yesterday？','Which uses an it-cleft to focus yesterday?',['It was yesterday that we met.','We met yesterday.'],'A','两句事实相同，但 it-cleft 把 yesterday 放入专门焦点位。','Both express the same event, but the it-cleft places yesterday in a dedicated focus slot.'],
    ['What I need is a quiet room. 哪个成分位于 be 后的新焦点位？','Which element occupies the new-focus position after be?',['a quiet room','What I need'],'A','What I need 是外层主语和话题，a quiet room 是焦点表语。','What I need is the outer subject and topic; a quiet room is the focused complement.']
  ]},
  {id:'focus-particles',level:'core',title:['only、also、even 的常用焦点范围','Common focus scope of only, also and even'],meta:['先找焦点词靠近的成分，再判断排除、添加或意外','Find the nearby focus first, then identify exclusion, addition or unexpectedness'],examples:[
    [[['Only Mia','subject','主语（only 对比焦点）','Subject focused by only'],['solved','predicate'],['the problem.','object']],'focus','Only Mia 整体在句法上是主语，only 让 Mia 成为排他焦点。','Only Mia is syntactically the subject, while only makes Mia the exclusive focus.'],
    [[['Mia','subject'],['only solved','predicate','only 聚焦动作','only focusing action'],['the problem.','object']],'focus','可理解为 Mia 只是解决了问题，没有做更多事；位置改变范围。','Mia merely solved it and did nothing further; position changes scope.'],
    [[['Mia','subject'],['solved','predicate'],['only the first problem.','focus','only 聚焦宾语','only focusing object']],'focus','表示只解决第一题，限制宾语范围。','It means she solved only the first problem, restricting the object.'],
    [[['Mia','subject'],['also solved','predicate','also 添加谓语信息','also adding predicate information'],['the second problem.','object']],'focus','also 说明“解决第二题”是在已有信息上再添加的事实。','also presents solving the second problem as an added fact.'],
    [[['Even Mia','subject','主语（even 意外焦点）','Subject focused as unexpected by even'],['understood','predicate'],['the rule.','object']],'focus','Even Mia 整体是主语，even 只是给主语增加“出乎预期”的信息。','Even Mia is syntactically the subject; even adds an unexpected-focus meaning to it.']
  ],rules:[
    ['only 紧靠主语时主要排除其他人或事物。','only next to the subject mainly excludes other people or things.'],
    ['only 靠近谓语时主要限制动作，可表示没有做更多事。','only near the predicate mainly limits the action and can imply that nothing more was done.'],
    ['only 紧靠宾语或其他成分时，主要限制该成分的范围。','only next to an object or another element mainly restricts that element’s range.'],
    ['also 表示在已有信息上再添加一项，应靠近被添加的焦点。','also adds an item to established information and should stay near the added focus.'],
    ['even 标记出乎预期的焦点；书面语要用位置和上下文明确这个焦点。','even marks an unexpected focus; writing should make that focus clear through position and context.']
  ],questions:[
    ['Only Mia solved the problem. 排除了什么？','What is excluded?',[['其他人解决','Other people solving it'],['Mia 做其他事','Mia doing other things']],'A','only 直接聚焦 Mia。','only directly focuses Mia.'],
    ['Mia only solved the problem. only 主要限制什么？','What does only mainly restrict?',[['解决这一动作','The action of solving'],['problem 的数量','The number of problems']],'A','only 靠近谓语 solved。','only is next to the predicate solved.'],
    ['Mia solved only the first problem. only 限制什么？','What does only restrict?',['the first problem','Mia'],'A','only 靠近宾语。','only is adjacent to the object.'],
    ['Mia also solved the second problem. also 表示什么？','What does also signal in this sentence?',[[ '在已有信息上添加一项','An added fact beyond established information'],['否定解决过问题','A denial that any problem was solved']],'A','also 表添加。','also marks addition.'],
    ['Even Mia understood the rule. even 聚焦谁？','Who is focused by even?',['Mia','the rule'],'A','even 紧靠 Mia，标记出乎预期的人。','even is next to Mia and marks her as unexpected.']
  ]},
  {id:'negation-scope',level:'core',title:['否定词的基础作用范围','Basic scope of negation'],meta:['先找 not 所在的谓语，再区分部分否定','Locate the predicate containing not, then distinguish partial negation'],examples:[
    [[['She','subject'],['did not say','predicate'],['that he lied.','object']],'focus','可能表示“她没有说这句话”，否定主句说话行为。','It may mean she did not make that statement, negating the saying event.'],
    [[['She','subject'],['said','predicate'],['that he did not lie.','object']],'focus','否定落在从句，明确表示她说“他没有撒谎”。','Negation is embedded, clearly reporting that he did not lie.'],
    [[['Not every student','subject','主语（部分否定焦点）','Subject with partial-negation focus'],['passed.','predicate']],'focus','Not every student 整体是主语，not 与 every 组合表示“并非每个都”。','Not every student is the subject as a whole; not with every means not all.']
  ],rules:[
    ['did not say 中 not 位于主句谓语，形式上否定“说”这个主句事件。','In did not say, not belongs to the main-clause predicate and formally negates the saying event.'],
    ['that he did not lie 中 not 位于从句谓语，否定的是“撒谎”这个从句事件。','In that he did not lie, not belongs to the embedded predicate and negates the lying event.'],
    ['not all/every/both 表部分否定，不等于 no/none/neither 的全部否定。','not all/every/both expresses partial negation, unlike total negation with no/none/neither.']
  ],questions:[
    ['She did not say that he lied. 形式否定落在哪里？','Where is the formal negation?',[['主句 say','Main-clause say'],['从句 lied','Embedded lied']],'A','did not 修饰 say。','did not modifies say.'],
    ['She said that he did not lie. 否定落在哪个事件？','Which event is negated?',[[ '从句的 lie','The embedded lying event'],['主句的 say','The main-clause saying event']],'A','did not lie 位于从句。','did not lie is inside the embedded clause.'],
    ['Not every student passed. 表示什么？','What does this mean?',[[ '并非所有学生都通过','Not all students passed'],['没有学生通过','No student passed']],'A','这是部分否定。','It is partial negation.']
  ]},
  {id:'scope-ambiguity',level:'advanced',title:['复杂否定范围与改写','Complex negation scope and rewriting'],meta:['because、不定式和量化成分会让 not 有多种解读','because-clauses, infinitives and quantifiers can create multiple readings of not'],examples:[
    [[['I','subject'],['did not invite','predicate'],['him','object'],['because he was famous.','adverbial','原因状语','Reason adverbial']],'boundary','可能是“因为他有名，所以没邀请”，也可能是“邀请了，但不是因为有名”；需换句式明示范围。','This may mean no invitation because of fame, or an invitation for another reason; rewrite to state the intended scope.'],
    [[['I','subject'],['did not read','predicate'],['every report.','object','含 every 的量化宾语','Quantified object with every']],'boundary','单句可被理解为“一份也没读”或“读了一些，但没读全部”；分别改为 I read none of the reports 与 I read some, but not all, of the reports 即可消歧。','The sentence may mean none were read or that some but not all were read; I read none of the reports and I read some, but not all, of the reports distinguish the readings.'],
    [[['Not all students','subject','主语（明确部分否定）','Subject with explicit partial negation'],['found','predicate'],['the task','object'],['easy.','objectComplement']],'rewrite','Not all students 整体是主语，not all 明确表示“并非所有人”。','Not all students is the subject as a whole, and not all clearly means not every student.']
  ],rules:[
    ['not ... because 可否定主句事件，也可只否定原因关系，必要时应拆句或补出真实原因。','not ... because may negate the main event or only the reason relation; split or restate when necessary.'],
    ['not 与 every 等量化成分共现时，可能在“全部否定”与“并非全部”之间产生范围歧义。','When not occurs with a quantifier such as every, scope may be ambiguous between none and not all.'],
    ['改写否定句时要让 not/no 靠近真正否定中心，并再检查是否仍有第二种合理解读。','When rewriting, place not/no close to the intended target and check whether a second reasonable reading remains.']
  ],questions:[
    ['I did not invite him because he was famous. 为什么应该检查上下文？','Why should context be checked?',[[ '可能否定邀请，也可能只否定原因','It may negate the invitation or only the reason'],['not 只能否定 invite，because 原因不在其范围内','not can only negate invite, never the because-reason']],'A','not ... because 可有不同范围，不能只看 not 的线性位置。','not ... because can have different scopes; linear position alone is insufficient.'],
    ['哪组改写能分清 I did not read every report. 的两种范围？','Which pair distinguishes the two readings of I did not read every report.?',[[ 'I read none ... / I read some, but not all ...','I read none ... / I read some, but not all ...'],['I did not read each report. / I did not read all reports.','I did not read each report. / I did not read all reports.']],'A','none 与 some but not all 明确区分“全无”和“未全”。','none and some but not all clearly distinguish zero from partial completion.'],
    ['哪一句最清楚表示“并非所有学生”？','Which most clearly means not every student?',[[ 'Not all students found the task easy.','Not all students found the task easy.'],['All students did not find the task easy.','All students did not find the task easy.']],'A','not all 直接标出部分否定。','not all directly marks partial negation.']
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
    ['连续谈 library 时，哪个主语更能保持主题？','Which subject better maintains the library topic?',['The library / It','The workshop / It'],'A','The library 或指向它的 It 直接承接主题。','The library or an It referring to it directly maintains the topic.'],
    ['转入子主题时，哪种做法更利于读者跟踪？','Which better helps readers follow a shift to a subtopic?',[[ '用词汇复现或指代建立桥梁','Use lexical repetition or reference as a bridge'],['直接用新名词作主语，不标明与上文的关系','Start with a new noun subject without marking its link to prior context']],'A','桥梁帮助读者识别主题如何推进。','A bridge shows readers how the topic progresses.']
  ]},
  {id:'avoid-chinglish',level:'core',title:['避免悬空话题、头重脚轻与逐词翻译','Avoid hanging topics, top-heavy clauses and word-for-word translation'],meta:['按英语骨架和信息流重组中文意思','Restructure Chinese meaning through English syntax and information flow'],examples:[
    [[['For this book,','adverbial','中式多余介词框架','Unnecessary Chinese-influenced frame'],['I','subject'],['like','predicate'],['it very much.','object']],'rewrite','改为 I like this book very much；不要同时用 for this book 和 it 重复话题。','Rewrite as I like this book very much; do not duplicate the topic with for this book and it.'],
    [[['That every student should learn how to evaluate online information','subject','过长主语','Overly heavy subject'],['is','predicate'],['important.','subjectComplement']],'rewrite','语法可行但头重；普通表达更自然为 It is important that every student ...。','Grammatical but top-heavy; ordinary prose more naturally uses It is important that every student ....'],
    [[['We','subject'],['discussed','predicate'],['the effects of social media on teenagers in modern society.','object','按意义组块的长宾语','Long object organized in meaning chunks']],'translation','先确定主干 We discussed，再按“effects—of social media—on teenagers”组块，不逐词照搬中文顺序。','Establish We discussed, then build chunks effects–of social media–on teenagers rather than copying Chinese word order.']
  ],rules:[
    ['避免没有对比或承接语境的裸话题，也避免话题与主句宾语重复；中性表达优先把 X 放入主句真实成分槽位。','Avoid bare topics without contrast or discourse linkage and avoid duplicating a topic as a main-clause object; neutral expression prefers placing X in its actual clause slot.'],
    ['长主语虽可能合语法，但普通表达常用形式主语或其他重组方式避免头重脚轻。','A long subject may be grammatical, but ordinary prose often uses dummy it or another restructuring to avoid top-heaviness.'],
    ['翻译先确定英语主干和逻辑关系，再按名词短语、介词短语和从句组块表达，不能逐词对位。','In translation, establish the English skeleton and logic first, then express noun, prepositional and clause chunks rather than mapping word by word.']
  ],questions:[
    ['“这本书，我很喜欢”最自然的普通表达是什么？','What is the most natural ordinary version?',['I like this book very much.','For this book, I like it.'],'A','把 book 直接放宾语槽位。','Place book directly in the object slot.'],
    ['普通语境中，哪句更能避免长 that 从句造成头重？','Which better avoids a top-heavy that-clause in neutral prose?',[['It is important that every student learns this skill.','It is important that every student learns this skill.'],['That every student learns this skill is important.','That every student learns this skill is important.']],'A','两句都可合法，但 it 结构把长从句留在句尾。','Both are grammatical, but the it-pattern leaves the heavy clause final.'],
    ['中译英第一步应做什么？','What should come first in Chinese-to-English translation?',[['确定英语主干和逻辑','Establish the English skeleton and logic'],['逐词按原顺序替换','Replace words in original order']],'A','结构先于词语对位。','Structure comes before word substitution.']
  ]},
  {id:'information-rewrite',level:'advanced',title:['信息结构综合改写','Integrated information-structure rewriting'],meta:['保持事实，调整承接、重量、焦点和范围','Preserve facts while adjusting cohesion, weight, focus and scope'],examples:[
    [[['A new sports centre opened last week.','clause','首次引入新对象','First introduces new entity'],['The centre','subject','已知主题','Given topic'],['offers','predicate'],['free classes for teenagers.','object','新信息','New information']],'rewrite','先用不定表达引入，再用定指主语承接，形成段落推进。','Introduce with an indefinite, then continue with a definite subject to create progression.'],
    [[['It','dummySubject'],['was announced','predicate'],['yesterday','adverbial'],['that the school would extend the programme.','clause','后置真正主语从句','Postponed notional subject clause']],'rewrite','被动省略不重要施事，形式主语后移长从句，yesterday 保持靠近 announce 的时间框架。','The passive omits an unimportant agent, dummy it postpones the heavy clause, and yesterday frames the announcement.'],
    [[['Only after the survey ended','adverbial','前置限制性焦点状语','Fronted restrictive focus adverbial'],['did','auxiliary','倒装助动词','Inverted auxiliary'],['the team','subject'],['understand','predicate','主要谓语动词','Main predicate verb'],['the problem.','object']],'rewrite','Only after 状语前置后，did 移到主语 the team 前，understand 保持原形。','After the Only after adverbial is fronted, did moves before subject the team and understand remains in the base form.'],
    [[['Not all students','subject','主语（部分否定焦点）','Subject with partial-negation focus'],['found','predicate'],['the new system','object'],['easy to use.','objectComplement']],'rewrite','Not all students 整体作主语，not all 把范围明确为“并非全部”。','Not all students is the subject as a whole, and not all clearly fixes the scope as not every student.']
  ],rules:[
    ['综合改写先保证事实关系不变，再检查已知—新信息承接。','Integrated rewriting first preserves factual relations, then checks given-to-new progression.'],
    ['利用被动、形式主语/宾语和后置结构调整话题与重量，但不能改变语义角色。','Use passive, dummy elements and postponement to adjust topic and weight without changing semantic roles.'],
    ['前置、倒装和分裂句只在需要强焦点时使用；中性表达优先普通语序。','Use fronting, inversion and clefts only for strong focus; prefer ordinary order for neutral expression.'],
    ['焦点副词和否定词改写后必须重新检查范围，防止产生新歧义。','After moving focus particles or negatives, recheck scope to prevent new ambiguity.']
  ],questions:[
    ['首次引入 a centre 后，哪项自然承接同一对象？','After introducing a centre, which option naturally continues with the same entity?',['The centre offers ...','A different centre offers ...'],'A','the centre 回指刚引入的对象。','the centre refers back to the entity just introduced.'],
    ['中性公告中，哪一项更符合尾重？','Which better follows end weight in a neutral announcement?',['It was announced that the programme would be extended.','That the programme would be extended was announced.'],'A','两句都可合法，但形式主语把长从句留在句尾。','Both can be grammatical, but dummy it leaves the heavy clause final.'],
    ['不需要强强调时，哪项语序更中性？','Which order is more neutral when strong emphasis is unnecessary?',['We had never seen such a view.','Never had we seen such a view.'],'A','否定前置倒装更有标记，普通语序更中性。','Negative fronting is more marked; ordinary order is more neutral.'],
    ['表达“并非所有学生”最清楚的是哪项？','Which most clearly means “not every student”?',['Not all students ...','All students did not ...'],'A','not all 明确部分否定范围。','not all clearly marks partial negation.']
  ]}
];

const sectionSpecs=[
  ['foundation-flow','定义、主干与信息推进','Definition, skeleton and information flow','先分清语法正确与信息自然，再建立主干、已知—新信息和尾重原则。','Separate grammaticality from natural information flow, then build skeleton, given–new flow and end weight.',['information-order-essence','skeleton-vs-topic','given-new-flow','end-weight-short-long']],
  ['weight-constructions','重量调整结构','Weight-management constructions','用形式主宾语和存在句安排长信息与新信息。','Use dummy elements and existentials to arrange heavy and new information.',['dummy-subject','dummy-object','existential-new-information']],
  ['adverbial-modifier-order','状语与定语位置','Adverbial and modifier position','掌握基本状语、多状语、频率副词和定语顺序。','Master basic adverbials, multiple adverbials, frequency adverbs and modifier order.',['basic-adverbial-position','frequency-adverbs','multiple-adverbials','modifier-order']],
  ['object-passive-focus','宾语顺序与被动焦点','Object order and passive focus','处理传递结构，并用被动调整话题。','Handle transfer constructions and use passive to adjust topic.',['double-object-order','passive-focus']],
  ['marked-focus','有标记焦点结构','Marked focus structures','区分前置、倒装和分裂句的使用边界。','Distinguish the boundaries of fronting, inversion and clefts.',['fronting-boundary','inversion-focus','cleft-focus']],
  ['scope','焦点与否定范围','Focus and negation scope','核心掌握 only/also/even 与基础否定范围，进阶处理复杂歧义。','Master only/also/even and basic negation scope, then resolve complex ambiguity.',['focus-particles','negation-scope','scope-ambiguity']],
  ['discourse-rewrite','段落推进与综合改写','Discourse progression and integrated rewriting','避免中式语序，建立跨句承接并综合改写。','Avoid Chinese-influenced order, build cohesion and rewrite integratively.',['paragraph-progression','avoid-chinglish','information-rewrite']]
];
function buildInformationOrderCourse(english){const course=specs.map((s,i)=>lesson(english,s,i));const ids=course.map(x=>x.id),assigned=sectionSpecs.flatMap(x=>x[5]);if(ids.length!==assigned.length||new Set(assigned).size!==assigned.length||ids.some(id=>!assigned.includes(id))||assigned.some(id=>!ids.includes(id)))throw new Error('Invalid information-order section coverage');const sections=sectionSpecs.map(x=>({id:x[0],title:pick(english,x[1],x[2]),copy:pick(english,x[3],x[4]),lessonIds:x[5].slice(),lessonCount:x[5].length}));const core=course.filter(x=>x.level==='core'),advanced=course.filter(x=>x.level==='advanced');return{title:pick(english,`信息结构与语序 · ${course.length} 节微课`,`Information structure and word order · ${course.length} lessons`),copy:pick(english,'从主干、信息重量和焦点范围出发，写出自然清楚而非逐词翻译的英语。','Use skeleton, information weight and focus scope to produce natural, clear English rather than word-for-word translation.'),course,sections,groups:[{id:'core',title:pick(english,`核心必学 · ${core.length} 节`,`Core · ${core.length} essential lessons`),copy:pick(english,'主干、已知新信息、尾重、常规语序和篇章承接。','Skeletons, given/new flow, end weight, neutral order and cohesion.'),lessons:core},{id:'advanced',title:pick(english,`进阶挑战 · ${advanced.length} 节`,`Advanced · ${advanced.length} challenge lessons`),copy:pick(english,'前置倒装、强调、焦点范围和综合改写。','Fronting, inversion, clefts, scope and integrated rewriting.'),lessons:advanced}]};}
module.exports={buildInformationOrderCourse};
