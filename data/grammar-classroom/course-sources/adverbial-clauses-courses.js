const pick=(english,zh,en)=>english?en:zh;
const INCLUDE_RULE_COVERAGE=typeof GRAMMAR_RUNTIME==='undefined'||!GRAMMAR_RUNTIME;
const roleLabels={subject:['主语','Subject'],predicate:['谓语动词','Predicate verb'],object:['宾语','Object'],subjectComplement:['主语补语（表语）','Subject complement'],adverbial:['状语','Adverbial'],adverbialClause:['状语从句','Adverbial clause'],clause:['分句','Clause'],conjunction:['连接词','Connector'],attribute:['定语','Attribute'],nonfinite:['非谓语动词','Non-finite verb'],existential:['存在句引导词','Existential there']};
function analysis(english,chunks){return chunks.map(([text,role,zh,en])=>({text,role,label:pick(english,zh||(roleLabels[role]||['',''])[0],en||(roleLabels[role]||['',''])[1])}));}
function note(english,mode,zh,en){if(!mode)return{visible:false,mode:'',title:'',body:'',detail:''};const t={logic:['逻辑关系','Logical relation'],order:['位置与标点','Position and punctuation'],contrast:['易混辨析','Contrast'],tense:['时态观察','Tense focus'],transformation:['结构转换','Transformation'],translation:['语序翻译','Word-order translation'],boundary:['边界提醒','Boundary note']};return{visible:true,mode,title:pick(english,...(t[mode]||t.logic)),body:pick(english,zh,en),detail:''};}
const opt=(english,v)=>Array.isArray(v)?pick(english,v[0],v[1]):v;
function question(english,x){return{question:pick(english,x[0],x[1]),options:x[2].map((v,i)=>({key:String.fromCharCode(65+i),text:opt(english,v)})),answer:x[3],correct:pick(english,x[4],x[5]),wrong:pick(english,`再看逻辑：${x[4]}`,`Check the logic: ${x[5]}`)};}
function lesson(english,spec,index){if(spec.rules.length!==spec.examples.length||spec.rules.length!==spec.questions.length)throw new Error(`Adverbial-clause coverage mismatch: ${spec.id}`);const examples=spec.examples.map(x=>({text:x[0].map(c=>c[0]).join(' '),analysis:analysis(english,x[0]),note:note(english,x[1],x[2],x[3])}));return{id:spec.id,no:String(index+1).padStart(2,'0'),level:spec.level,title:pick(english,...spec.title),meta:pick(english,...spec.meta),examples:examples.map(x=>x.text),analyses:examples.map(x=>x.analysis),exampleNotes:examples.map(x=>x.note),rules:spec.rules.map(x=>pick(english,...x)),ruleCoverage:INCLUDE_RULE_COVERAGE?spec.rules.map((_,i)=>({exampleIndexes:[i],questionIndexes:[i]})):[],questions:spec.questions.map(x=>question(english,x))};}

const specs=[
  {id:'adverbial-function-position',level:'core',title:['状语从句的整体功能、位置与标点','Function, position and punctuation of adverbial clauses'],meta:['从句整体修饰主句事件或判断','The whole clause modifies the main event or proposition'],examples:[
    [[['When the bell rang,','adverbialClause','时间状语从句','Time adverbial clause'],['the students','subject'],['left.','predicate']],'order','状语从句在主句前，通常用逗号分隔。','An initial adverbial clause is normally followed by a comma.'],
    [[['The students','subject'],['left','predicate'],['when the bell rang.','adverbialClause','时间状语从句','Time adverbial clause']],'order','状语从句在主句后且联系紧密时，通常不加逗号。','A closely integrated final adverbial clause normally has no comma.'],
    [[['Although it was raining,','adverbialClause','让步状语从句','Concessive adverbial clause'],['we','subject'],['continued','predicate'],['the game.','object']],'logic','从句表达让步背景，主句表达仍然成立的结果。','The clause gives a concession; the main clause states the result that still holds.']
  ],rules:[
    ['状语从句整体修饰主句谓语或整句，表达时间、原因、条件、让步等逻辑。','An adverbial clause modifies the main predicate or proposition and expresses time, reason, condition, concession and other relations.'],
    ['状语从句前置时通常在从句末加逗号。','An initial adverbial clause is normally followed by a comma.'],
    ['后置状语从句与主句联系紧密时通常不用逗号；标点也可反映信息附加程度。','A closely integrated final adverbial clause normally takes no comma; punctuation may also reflect how supplementary it is.']
  ],questions:[
    ['When the bell rang, the students left. 中从句整体作什么？','What does the clause function as?',[['时间状语','Time adverbial'],['宾语','Object']],'A','它说明离开的时间。','It gives the time of leaving.'],
    ['状语从句前置时通常如何标点？','How is an initial adverbial clause normally punctuated?',[['从句后加逗号','Comma after the clause'],['不允许逗号','No comma allowed']],'A','前置从句通常以逗号和主句分隔。','An initial clause is normally separated by a comma.'],
    ['The students left when the bell rang. 通常是否需要逗号？','Does this final integrated clause normally need a comma?',[['不需要','No'],['必须有','Yes, always']],'A','紧密后置从句通常不用逗号。','A closely integrated final clause normally has no comma.']
  ]},
  {id:'time-when-while-as',level:'core',title:['时间：when、while、as','Time: when, while and as'],meta:['时间点、持续过程与同步变化','Point, duration and simultaneous development'],examples:[
    [[['When the phone rang,','adverbialClause','when 时间从句','when-time clause'],['I','subject'],['answered','predicate'],['it.','object']],'tense','when 可引出某个时间点发生的事件。','when can introduce an event at a particular point.'],
    [[['While I was studying,','adverbialClause','while 时间从句','while-time clause'],['my brother','subject'],['was sleeping.','predicate']],'tense','while 突出两个持续动作在一段时间内重叠。','while emphasizes overlapping durative actions.'],
    [[['As the sun rose,','adverbialClause','as 时间从句','as-time clause'],['the sky','subject'],['grew','predicate'],['brighter.','subjectComplement']],'tense','as 常表示两个过程同步发展。','as commonly presents two processes developing together.']
  ],rules:[
    ['when 可用于时间点或时间段，适用范围最广。','when can refer to a point or period and has the broadest time use.'],
    ['while 常突出持续动作或状态的时间重叠。','while commonly emphasizes overlap between durative actions or states.'],
    ['as 常表示“随着”或两个动作同步发生、发展。','as commonly means as/while, showing simultaneous actions or development.']
  ],questions:[
    ['___ the phone rang, I answered it.','___ the phone rang, I answered it.',['When','Unless'],'A','时间点事件用 when。','Use when for the point event.'],
    ['___ I was studying, my brother was sleeping.','___ I was studying, my brother was sleeping.',['While','Because of'],'A','两个持续动作重叠，用 while。','while shows overlapping durative actions.'],
    ['___ the sun rose, the sky grew brighter. 强调同步变化。','___ the sun rose, the sky grew brighter, emphasizing simultaneous change.',['As','Until not'],'A','as 可表示“随着”。','as can mean as the process develops.']
  ]},
  {id:'time-before-after',level:'core',title:['时间：before 与 after','Time: before and after'],meta:['明确事件先后关系','Making event order explicit'],examples:[
    [[['Wash','predicate'],['your hands','object'],['before you eat.','adverbialClause','before 时间从句','before-time clause']],'logic','主句动作发生在从句动作之前。','The main action occurs before the subordinate action.'],
    [[['After she finished the report,','adverbialClause','after 时间从句','after-time clause'],['she','subject'],['sent','predicate'],['it.','object']],'logic','从句事件先完成，主句事件随后发生。','The subordinate event finishes first and the main event follows.'],
    [[['After she had finished the report,','adverbialClause','过去完成时 after 从句','after-clause with past perfect'],['she','subject'],['sent','predicate'],['it.','object']],'tense','先后已由 after 明确时，过去完成时可用于额外突出“先完成”，但并非总是必需。','When after already makes order clear, past perfect may emphasize prior completion but is not always required.']
  ],rules:[
    ['before 从句表示其事件晚于主句事件。','A before-clause presents an event later than the main event.'],
    ['after 从句表示其事件早于主句事件。','An after-clause presents an event earlier than the main event.'],
    ['before/after 已明确先后时，可根据强调和语境选择一般过去时或过去完成时。','When before/after makes order clear, simple past or past perfect may be chosen according to emphasis and context.']
  ],questions:[
    ['Wash your hands ___ you eat.','Wash your hands ___ you eat.',['before','after only'],'A','洗手应先于吃饭。','Washing comes before eating.'],
    ['___ she finished the report, she sent it.','___ she finished the report, she sent it.',['After','Until'],'A','完成报告后再发送。','Finishing precedes sending.'],
    ['After she ___ the report, she sent it. 哪项可突出先完成？','Which form emphasizes earlier completion?',['had finished','will finish'],'A','过去完成时突出先于 sent。','Past perfect emphasizes completion before sent.']
  ]},
  {id:'time-until-since',level:'core',title:['时间：until 与 since','Time: until and since'],meta:['截止点与起始点','Endpoint and starting point'],examples:[
    [[['We','subject'],['waited','predicate'],['until the bus arrived.','adverbialClause','until 时间从句','until-time clause']],'logic','wait 延续到公交车到达这一截止点。','The waiting continues up to the bus arrival endpoint.'],
    [[['She','subject'],['did not leave','predicate'],['until the meeting ended.','adverbialClause','not until 时间从句','not-until time clause']],'logic','not ... until 表示主句动作到截止点才开始。','not ... until means the main action begins only at the endpoint.'],
    [[['I','subject'],['have lived','predicate'],['here','adverbial'],['since I graduated.','adverbialClause','since 时间从句','since-time clause']],'tense','since 从句给出过去起点，主句常用现在完成时表示延续至今。','The since-clause gives a past starting point; present perfect commonly shows continuation to now.']
  ],rules:[
    ['肯定句中，延续性动作可持续到 until 所引出的截止点。','In an affirmative clause, a durative action may continue until the stated endpoint.'],
    ['not ... until 表示主句动作直到某一时间才发生。','not ... until means the main action does not happen before the stated time.'],
    ['since 时间从句表示起点；主句常用完成时，从句常用一般过去时。','A since-clause marks a starting point; the main clause commonly uses a perfect tense and the since-clause simple past.']
  ],questions:[
    ['We waited ___ the bus arrived.','We waited ___ the bus arrived.',['until','because of'],'A','等待持续到公交到达。','The waiting lasts to the arrival.'],
    ['She did not leave ___ the meeting ended.','She did not leave ___ the meeting ended.',['until','as soon as before'],'A','not until 表示会议结束才离开。','not until means she left only when it ended.'],
    ['I ___ here since I graduated.','I ___ here since I graduated.',['have lived','will live'],'A','过去起点延续至今用现在完成时。','Use present perfect for continuation from a past point to now.']
  ]},
  {id:'time-immediate-once',level:'core',title:['时间：as soon as 与 once','Time: as soon as and once'],meta:['紧接发生与条件一旦成立','Immediate sequence and once a condition is met'],examples:[
    [[['Call','predicate'],['me','object'],['as soon as you arrive.','adverbialClause','as soon as 时间从句','as-soon-as time clause']],'logic','从句事件一发生，主句动作紧接着发生。','The main action follows immediately when the subordinate event occurs.'],
    [[['Once you understand the rule,','adverbialClause','once 时间或条件从句','once time/condition clause'],['the task','subject'],['becomes','predicate'],['easier.','subjectComplement']],'logic','once 表示“一旦”，兼有时间先后和条件成立意味。','once means once, combining time sequence with a condition being met.'],
    [[['I','subject'],['will tell','predicate'],['you','object'],['as soon as I know.','adverbialClause','将来时间从句用一般现在时','Future-time clause using present simple']],'tense','主句用 will，从句表达将来但用一般现在时 know。','The main clause uses will; the future-time clause uses present simple know.']
  ],rules:[
    ['as soon as 表示一个事件发生后另一个事件立即发生。','as soon as shows one event following immediately after another.'],
    ['once 表示“一旦”，常兼有时间和条件色彩。','once means once and often combines temporal and conditional meaning.'],
    ['谈将来时，as soon as/once 从句通常用一般现在时，不用 will 表单纯将来。','For future reference, as soon as/once clauses normally use present simple, not will for plain futurity.']
  ],questions:[
    ['Call me ___ you arrive.','Call me ___ you arrive.',['as soon as','although'],'A','表示一到就打电话。','It means call immediately upon arrival.'],
    ['___ you understand the rule, the task becomes easier.','___ you understand the rule, the task becomes easier.',['Once','Because of'],'A','once 表示“一旦”。','once means once the condition is met.'],
    ['I will tell you as soon as I ___.','I will tell you as soon as I ___.',['know','will know'],'A','将来时间从句用一般现在时。','Use present simple in the future-time clause.']
  ]},
  {id:'place-where-wherever',level:'core',title:['地点：where 与 wherever','Place: where and wherever'],meta:['在……的地方与无论哪里','Where and wherever'],examples:[
    [[['Stay','predicate'],['where you are.','adverbialClause','地点状语从句','Place adverbial clause']],'translation','where you are 表示“在你所在的地方”，整体修饰 stay。','where you are means in the place where you are and modifies stay.'],
    [[['Where there is water,','adverbialClause','地点状语从句','Place adverbial clause'],['life','subject'],['can exist.','predicate']],'logic','从句概括“有水的地方”。','The clause generalizes over places where water exists.'],
    [[['Wherever you go,','adverbialClause','泛指地点状语从句','Free-choice place clause'],['I','subject'],['will follow','predicate'],['you.','object']],'logic','wherever 表示“无论去哪里”，范围不限。','wherever means no matter where, with unrestricted place.']
  ],rules:[
    ['where 地点状语从句整体说明主句动作发生的位置。','A where place clause gives the location of the main action.'],
    ['句首 where 从句可概括“在……的地方”，后接主句结果。','An initial where-clause may generalize as in places where, followed by the main result.'],
    ['wherever 表示任意地点或“无论哪里”，语义范围比 where 更开放。','wherever expresses any place or no matter where and is less restricted than where.']
  ],questions:[
    ['Stay ___ you are.','Stay ___ you are.',['where','because'],'A','从句说明 stay 的地点。','The clause gives the location of stay.'],
    ['___ there is water, life can exist.','___ there is water, life can exist.',['Where','Whether'],'A','表示“有水的地方”。','It means in places where water exists.'],
    ['___ you go, I will follow you.','___ you go, I will follow you.',['Wherever','Until'],'A','表示无论去哪里。','wherever means no matter where.']
  ]},
  {id:'reason-because-since-as',level:'core',title:['原因：because、since、as','Reason: because, since and as'],meta:['直接原因与已知背景','Direct reason and shared background'],examples:[
    [[['We','subject'],['stayed','predicate'],['inside','adverbial'],['because it was raining.','adverbialClause','because 原因从句','because-reason clause']],'logic','because 直接回答为什么，原因焦点较强。','because directly answers why and strongly focuses the reason.'],
    [[['Since everyone is here,','adverbialClause','since 原因从句','since-reason clause'],['we','subject'],['can begin.','predicate']],'logic','since 常把双方已知或容易接受的原因作为背景。','since often presents a known or readily accepted reason as background.'],
    [[['As it was getting late,','adverbialClause','as 原因从句','as-reason clause'],['we','subject'],['went','predicate'],['home.','adverbial']],'logic','as 原因从句常前置，原因语气较弱、偏背景。','An as-reason clause is often initial and backgrounded.']
  ],rules:[
    ['because 表达直接、重点原因，最自然地回答 why。','because expresses a direct focused reason and naturally answers why.'],
    ['since 表原因时常表示对方已知、显然或作为推理前提的背景。','Causal since commonly presents a known, obvious or assumed reason.'],
    ['as 表原因时语气通常较弱，常用于句首提供背景。','Causal as is usually weaker and often supplies initial background.']
  ],questions:[
    ['Why did you stay inside? — ___ it was raining.','Why did you stay inside? — ___ it was raining.',['Because','Although'],'A','直接回答 why 使用 because。','because directly answers why.'],
    ['___ everyone is here, we can begin. 表示已知前提。','___ everyone is here, we can begin, presenting a shared premise.',['Since','Until'],'A','since 可提供已知原因背景。','since supplies a known reason.'],
    ['___ it was getting late, we went home. 表示背景原因。','___ it was getting late, we went home, giving a background reason.',['As','Unless'],'A','as 可弱化原因并前置。','as presents a backgrounded reason.']
  ]},
  {id:'purpose-clauses',level:'core',title:['目的：so that 与 in order that','Purpose: so that and in order that'],meta:['为了让某事能够发生','So that an intended outcome can happen'],examples:[
    [[['Speak','predicate'],['slowly','adverbial'],['so that everyone can understand.','adverbialClause','目的状语从句','Purpose adverbial clause']],'logic','从句说明慢慢说的目的，常含 can/may。','The clause gives the purpose of speaking slowly and commonly contains can/may.'],
    [[['She','subject'],['left','predicate'],['early','adverbial'],['so that she could catch the bus.','adverbialClause','过去语境目的从句','Past-context purpose clause']],'tense','过去语境常用 could/might/would 表示预期目的。','Past contexts commonly use could/might/would for the intended result.'],
    [[['In order that no one would notice,','adverbialClause','正式目的状语从句','Formal purpose clause'],['he','subject'],['entered','predicate'],['quietly.','adverbial']],'logic','in order that 较正式，常用于明确目的并可前置。','in order that is more formal, explicitly marks purpose and can be initial.']
  ],rules:[
    ['so that 引导目的从句时常与 can/could、may/might、will/would 等情态形式搭配。','Purpose so that commonly combines with can/could, may/might or will/would.'],
    ['主句为过去语境时，目的从句常使用 could、might 或 would。','With a past main context, a purpose clause commonly uses could, might or would.'],
    ['in order that 比 so that 更正式、更明确地标示目的，并可前置。','in order that is more formal and explicit than so that and may be initial.']
  ],questions:[
    ['Speak slowly ___ everyone can understand.','Speak slowly ___ everyone can understand.',['so that','such that only'],'A','从句说明说慢的目的。','The clause gives the purpose.'],
    ['She left early so that she ___ catch the bus.','She left early so that she ___ catch the bus.',['could','can yesterday'],'A','过去语境使用 could。','Use could in the past context.'],
    ['哪一连接词更正式地表示目的？','Which connector marks purpose more formally?',['in order that','because'],'A','in order that 是正式目的连接语。','in order that is the formal purpose connector.']
  ]},
  {id:'result-so-such',level:'core',title:['结果：so...that 与 such...that','Result: so...that and such...that'],meta:['程度达到某种结果','A degree leading to a result'],examples:[
    [[['The box','subject'],['was','predicate'],['so heavy','subjectComplement'],['that I could not lift it.','adverbialClause','结果状语从句','Result adverbial clause']],'logic','so 修饰形容词 heavy，that 从句说明结果。','so modifies the adjective heavy and the that-clause gives the result.'],
    [[['It','subject'],['was','predicate'],['such a difficult question','subjectComplement'],['that nobody answered it.','adverbialClause','结果状语从句','Result adverbial clause']],'logic','such 修饰“a＋形容词＋名词”短语。','such modifies an a + adjective + noun phrase.'],
    [[['There','existential'],['were','predicate'],['so many people','subject','实义主语','Notional subject'],['that we could not enter.','adverbialClause','结果状语从句','Result adverbial clause']],'logic','many/much/few/little 前通常用 so。','Use so before many/much/few/little.']
  ],rules:[
    ['so + 形容词/副词 + that 表示程度导致的结果。','so + adjective/adverb + that expresses a degree producing a result.'],
    ['such + (a/an) + 形容词 + 名词 + that 表示某类事物造成的结果。','such + (a/an) + adjective + noun + that expresses a thing or situation producing a result.'],
    ['many、much、few、little 表数量时通常使用 so ... that。','many, much, few and little as quantity words normally use so ... that.']
  ],questions:[
    ['The box was ___ heavy that I could not lift it.','The box was ___ heavy that I could not lift it.',['so','such'],'A','heavy 是形容词，使用 so。','Use so before the adjective heavy.'],
    ['It was ___ difficult question that nobody answered it.','It was ___ difficult question that nobody answered it.',['such a','so a'],'A','名词短语使用 such a。','Use such a before the noun phrase.'],
    ['There were ___ many people that we could not enter.','There were ___ many people that we could not enter.',['so','such'],'A','many 前用 so。','Use so before many.']
  ]},
  {id:'condition-if',level:'core',title:['条件：if','Condition: if'],meta:['真实可能、假设条件与命令建议','Real possibility, hypothesis and instructions'],examples:[
    [[['If it rains tomorrow,','adverbialClause','真实条件从句','Real condition clause'],['we','subject'],['will stay','predicate'],['home.','adverbial']],'tense','将来真实条件从句用一般现在时 rains，主句可用 will。','A future real condition uses present simple rains in the if-clause and may use will in the main clause.'],
    [[['If you heat ice,','adverbialClause','普遍条件从句','General condition clause'],['it','subject'],['melts.','predicate']],'logic','普遍事实常用“if＋一般现在时，主句一般现在时”。','General truths commonly use present simple in both clauses.'],
    [[['If you need help,','adverbialClause','条件从句','Condition clause'],['call','predicate'],['me.','object']],'logic','主句可用祈使句表达条件成立后的指令。','The main clause may be imperative, giving an instruction if the condition holds.']
  ],rules:[
    ['真实条件 if 从句提出可能成立的条件，主句说明结果。','A real if-clause presents a possible condition and the main clause its result.'],
    ['普遍规律可用 if 加一般现在时，主句也用一般现在时。','General truths may use present simple in both the if-clause and main clause.'],
    ['条件句主句不只可用 will，也可使用情态动词或祈使句。','The main clause of a condition need not use will; it may use another modal or an imperative.']
  ],questions:[
    ['If it ___ tomorrow, we will stay home.','If it ___ tomorrow, we will stay home.',['rains','will rain'],'A','将来条件从句用一般现在时。','Use present simple in the future condition.'],
    ['If you heat ice, it ___.','If you heat ice, it ___.',['melts','will always melted'],'A','普遍事实两边可用一般现在时。','A general truth can use present simple in both clauses.'],
    ['If you need help, ___ me.','If you need help, ___ me.',['call','will calling'],'A','主句可用祈使句。','The main clause can be imperative.']
  ]},
  {id:'condition-unless-provided',level:'core',title:['条件：unless、as long as、provided that','Condition: unless, as long as and provided that'],meta:['除非、只要与前提条件','Unless, as long as and provided that'],examples:[
    [[['Unless you hurry,','adverbialClause','unless 条件从句','unless-condition clause'],['you','subject'],['will miss','predicate'],['the bus.','object']],'logic','unless 相当于 if ... not；从句通常不再重复 not。','unless is equivalent to if ... not; the clause normally does not repeat not.'],
    [[['You','subject'],['may stay','predicate'],['as long as you are quiet.','adverbialClause','as long as 条件从句','as-long-as condition clause']],'logic','as long as 表示“只要”某条件持续满足。','as long as means provided that a condition continues to hold.'],
    [[['We','subject'],['will go','predicate'],['provided that the weather is safe.','adverbialClause','provided that 条件从句','provided-that condition clause']],'logic','provided/providing that 明确表示“前提是”。','provided/providing that explicitly means on condition that.']
  ],rules:[
    ['unless 表示 if ... not；除特殊语义外，通常不与 not 重复。','unless means if ... not; except for special meanings, it normally does not repeat not.'],
    ['as long as 表条件时表示“只要”，不要与表示时间长度的本义混淆。','Conditional as long as means provided that and should be distinguished from duration.'],
    ['provided/providing that 表示明确前提，语气较正式。','provided/providing that states an explicit condition and is relatively formal.']
  ],questions:[
    ['___ you hurry, you will miss the bus.','___ you hurry, you will miss the bus.',['Unless','Because'],'A','unless 表示 if you do not hurry。','unless means if you do not hurry.'],
    ['You may stay ___ you are quiet.','You may stay ___ you are quiet.',['as long as','so that result'],'A','表示“只要保持安静”。','It means provided that you are quiet.'],
    ['We will go ___ the weather is safe.','We will go ___ the weather is safe.',['provided that','although'],'A','provided that 表明确条件。','provided that states the condition.']
  ]},
  {id:'concession-although-even',level:'core',title:['让步：although、though、even though','Concession: although, though and even though'],meta:['尽管条件存在，主句结果仍成立','The main result holds despite the condition'],examples:[
    [[['Although it was cold,','adverbialClause','although 让步从句','although-concessive clause'],['we','subject'],['went','predicate'],['out.','adverbial']],'logic','寒冷本应阻碍外出，但主句结果仍发生。','The cold might prevent going out, yet the main result still occurs.'],
    [[['Though he was tired,','adverbialClause','though 让步从句','though-concessive clause'],['he','subject'],['kept working.','predicate']],'logic','though 通常比 although 稍口语，基本意义相近。','though is often slightly less formal than although, with similar basic meaning.'],
    [[['Even though she knew the risk,','adverbialClause','even though 强让步从句','even-though concessive clause'],['she','subject'],['continued.','predicate']],'logic','even though 强调让步事实出乎预期。','even though emphasizes a particularly unexpected contrast.']
  ],rules:[
    ['although 引导事实性让步，表示主句结果与通常预期相反。','although introduces factual concession, with a main result contrary to expectation.'],
    ['though 与 although 基本意义相近，though 常更口语、位置更灵活。','though is close to although, often less formal and more positionally flexible.'],
    ['even though 强调“即使事实如此仍然”，让步力度更强。','even though emphasizes that the main result holds despite a strong factual obstacle.']
  ],questions:[
    ['___ it was cold, we went out.','___ it was cold, we went out.',['Although','Because of'],'A','前后是让步关系。','The relation is concessive.'],
    ['哪一词通常比 although 稍口语？','Which word is often slightly less formal than although?',['though','until'],'A','though 基本意义相同但更口语。','though is similar but often less formal.'],
    ['哪一项让步强调更强？','Which marks stronger concession?',['even though','after'],'A','even 增强出乎预期的对比。','even strengthens the unexpected contrast.']
  ]},
  {id:'concession-while-no-matter',level:'advanced',title:['让步：while、no matter 与 wh-ever','Concession: while, no matter and wh-ever'],meta:['对比让步与无条件让步','Contrastive and unconditional concession'],examples:[
    [[['While I understand your point,','adverbialClause','while 对比让步从句','while contrastive-concessive clause'],['I','subject'],['disagree.','predicate']],'logic','while 表“虽然/尽管”时突出两种看法的对比。','Concessive while highlights contrast between two positions.'],
    [[['No matter what happens,','adverbialClause','no matter what 让步从句','no-matter-what concessive clause'],['stay','predicate'],['calm.','subjectComplement']],'logic','表示无论发生什么，主句都成立。','Whatever happens, the main instruction holds.'],
    [[['Wherever she goes,','adverbialClause','wherever 让步状语从句','wherever concessive adverbial clause'],['she','subject'],['makes','predicate'],['friends.','object']],'logic','wherever 相当于 no matter where，在此表达无条件让步。','wherever equals no matter where here and expresses unconditional concession.'],
    [[['Whoever calls,','adverbialClause','whoever 让步状语从句','whoever concessive adverbial clause'],['do not answer','predicate']],'boundary','wh-ever 在此作让步状语；no matter + wh- 不能替代名词性主宾语功能，本课不展开名词性用法。','wh-ever is concessive here; no matter + wh- cannot replace nominal subject/object uses, which are outside this lesson.']
  ],rules:[
    ['while 可表示对比性让步，通常位于句首，意为“虽然”。','while can mark contrastive concession, commonly initially, meaning although.'],
    ['no matter + wh- 表示无论哪种情况，主句结论均不改变。','no matter + wh- means the main result is unchanged under any alternative.'],
    ['wh-ever 可相当于 no matter + wh- 引导让步状语从句。','A wh-ever form can equal no matter + wh- in a concessive adverbial clause.'],
    ['判断 wh-ever 时必须看整体功能；本课只处理其状语让步用法。','Classify wh-ever by the clause’s overall function; this lesson covers only concessive adverbial use.']
  ],questions:[
    ['___ I understand your point, I disagree. 表对比让步。','___ I understand your point, I disagree, marking contrastive concession.',['While','Because'],'A','while 可表示“虽然”。','while can mean although.'],
    ['___ what happens, stay calm.','___ what happens, stay calm.',['No matter','Because of'],'A','no matter what 表无条件让步。','no matter what expresses unconditional concession.'],
    ['Wherever she goes 最接近什么？','What is closest to “Wherever she goes”?',['No matter where she goes','Because she goes somewhere'],'A','wherever 可等于 no matter where。','wherever can equal no matter where.'],
    ['判断 wh-ever 从句类型应先看什么？','What should be checked first to classify a wh-ever clause?',[['整句中的功能','Its function in the whole sentence'],['只看词尾 ever','Only the ending ever']],'A','相同形式可承担不同从句功能。','The same form may serve different clause functions.']
  ]},
  {id:'comparison-clauses',level:'advanced',title:['比较：than 与 as...as','Comparison: than and as...as'],meta:['比较级差异与同等比较','Comparative difference and equality'],examples:[
    [[['Mia','subject'],['runs','predicate'],['faster than I do.','adverbialClause','than 比较从句','than-comparison clause']],'logic','do 代替 runs，避免重复完整谓语。','do substitutes for runs to avoid repeating the predicate.'],
    [[['This room','subject'],['is','predicate'],['as bright as that one is.','adverbialClause','as 比较从句','as-comparison clause']],'logic','as ... as 表同等程度，第二个 as 引出比较从句。','as ... as expresses equal degree; the second as introduces the comparison clause.'],
    [[['She','subject'],['is','predicate'],['taller than me / than I am.','adverbialClause','正式度不同的比较表达','Comparison forms differing in formality']],'contrast','than me 在日常英语常见；than I am 明示从句结构，更正式。','than me is common in everyday English; than I am makes the clause explicit and is more formal.']
  ],rules:[
    ['than 引导比较基准，从句中重复成分常用助动词替代或省略。','than introduces the comparison standard; repeated material is often replaced by an auxiliary or omitted.'],
    ['as + 形容词/副词 + as 表示同等程度，第二个 as 可引出比较从句。','as + adjective/adverb + as expresses equality, with the second as introducing a comparison clause.'],
    ['than 后代词在实际英语中有宾格短语和完整主格从句两种常见形式，正式度不同。','After than, both an object-form phrase and a full nominative clause occur, with different formality.']
  ],questions:[
    ['Mia runs faster than I ___.','Mia runs faster than I ___.',['do','am running fastly'],'A','do 替代 runs。','do substitutes for runs.'],
    ['This room is ___ bright ___ that one is.','This room is ___ bright ___ that one is.',['as ... as','so ... that'],'A','同等比较使用 as ... as。','Use as ... as for equality.'],
    ['哪一项更明确地显示完整比较从句？','Which more clearly shows a full comparison clause?',['than I am','than me'],'A','than I am 明示主语和谓语。','than I am overtly contains subject and predicate.']
  ]},
  {id:'manner-as-as-if',level:'advanced',title:['方式：as 与 as if/as though','Manner: as and as if/as though'],meta:['按照某方式与仿佛情形','Following a manner and presenting an apparent situation'],examples:[
    [[['Do','predicate'],['as I showed you.','adverbialClause','as 方式从句','as-manner clause']],'logic','as 表示“按照……的方式”。','as means in the way that.'],
    [[['He','subject'],['speaks','predicate'],['as if he knows everything.','adverbialClause','as if 方式从句','as-if manner clause']],'logic','一般现在时可表示说话者认为这种可能性真实或开放。','Present tense may leave the apparent situation open or plausible.'],
    [[['He','subject'],['talks','predicate'],['as if he knew everything.','adverbialClause','虚拟色彩的 as if 从句','Remoter as-if clause']],'contrast','过去式 knew 可表达与当前事实距离较远或说话者不相信。','Past knew can mark remoteness from current fact or speaker disbelief.']
  ],rules:[
    ['as 引导方式从句，表示“按照……的样子/方式”。','as introduces a manner clause meaning in the way that.'],
    ['as if/as though 后可用普通陈述时态，表示看起来可能真实。','as if/as though may use ordinary indicative tense when the appearance is potentially real.'],
    ['as if/as though 后用过去式或 were 可表达与当前事实相反或距离感。','Past forms or were after as if/as though can mark present unreality or remoteness.']
  ],questions:[
    ['Do ___ I showed you.','Do ___ I showed you.',['as','unless'],'A','as 表示按所示方式。','as means in the way shown.'],
    ['看起来可能真实时，as if 后可用什么？','What may follow as if when the situation seems plausibly real?',[['普通陈述时态','Ordinary indicative tense'],['只能过去完成时','Past perfect only']],'A','真实可能使用普通时态。','Indicative tense is possible for a plausible situation.'],
    ['He talks as if he ___ everything. 表示说话者不相信。','He talks as if he ___ everything, implying disbelief.',['knew','will know'],'A','过去式表达距离或非真实。','Past tense marks remoteness or unreality.']
  ]},
  {id:'future-present-rule',level:'core',title:['将来时间和条件从句不用普通 will','Future time and condition clauses use present forms'],meta:['主将从现及其准确边界','The present-in-subordinate rule and its limits'],examples:[
    [[['When she arrives,','adverbialClause','将来时间从句用一般现在时','Future-time clause with present simple'],['we','subject'],['will start.','predicate']],'tense','arrives 表将来时间，但从句不用 will arrive。','arrives has future reference, but the clause does not use will arrive.'],
    [[['If he calls,','adverbialClause','将来条件从句用一般现在时','Future-condition clause with present simple'],['tell','predicate'],['me.','object']],'tense','if 从句表达未来可能条件，用 calls。','The if-clause expresses a future possible condition with calls.'],
    [[['Once you have finished,','adverbialClause','将来从句用现在完成时','Future clause with present perfect'],['you','subject'],['may leave.','predicate']],'tense','现在完成时可突出从句动作先完成，再发生主句动作。','Present perfect can emphasize completion before the main action.'],
    [[['I','subject'],['do not know','predicate'],['whether he will come.','object','宾语从句','Object clause']],'boundary','这里 whether 引导宾语从句，不是条件状语从句，因此可用 will；不要把规则扩大到所有含 if/whether 的从句。','Here whether introduces an object clause, not a condition clause, so will is possible; do not overgeneralize the rule.']
  ],rules:[
    ['when、before、after、until、as soon as 等将来时间从句通常用一般现在时表达将来。','Future-time clauses with when, before, after, until or as soon as normally use present simple.'],
    ['真实将来条件 if/unless/as long as 从句通常用一般现在时表达将来。','Real future condition clauses with if, unless or as long as normally use present simple.'],
    ['现在完成时可在将来时间或条件从句中突出动作完成。','Present perfect may emphasize completion in a future time or condition clause.'],
    ['“主将从现”只适用于相应时间/条件状语从句，不适用于所有宾语从句。','The present-in-subordinate rule applies to relevant time/condition adverbial clauses, not every object clause.']
  ],questions:[
    ['When she ___, we will start.','When she ___, we will start.',['arrives','will arrive'],'A','将来时间从句用一般现在时。','Use present simple in the future-time clause.'],
    ['If he ___, tell me.','If he ___, tell me.',['calls','will call'],'A','将来条件从句用一般现在时。','Use present simple in the future condition.'],
    ['Once you ___, you may leave. 强调先完成。','Once you ___, you may leave, emphasizing prior completion.',['have finished','will have finish'],'A','从句可用现在完成时。','Present perfect is possible in the clause.'],
    ['I do not know whether he ___ come.','I do not know whether he ___ come.',['will',['省略所有将来形式','omit every future form']],'A','这是宾语从句，可使用 will。','This is an object clause, so will is possible.']
  ]},
  {id:'tense-relations',level:'advanced',title:['时间从句的时态关系','Tense relations in time clauses'],meta:['同时、打断、先后与延续','Simultaneity, interruption, sequence and duration'],examples:[
    [[['While I was cooking,','adverbialClause','过去进行时背景从句','Past-progressive background clause'],['the phone','subject'],['rang.','predicate']],'tense','持续背景用过去进行时，短暂打断事件用一般过去时。','Past progressive gives the ongoing background; simple past gives the interrupting event.'],
    [[['When I arrived,','adverbialClause','一般过去时时间从句','Simple-past time clause'],['they','subject'],['were eating.','predicate']],'tense','arrived 是时间点，were eating 是当时正在进行。','arrived is the point event; were eating is ongoing at that time.'],
    [[['By the time we arrived,','adverbialClause','截止时间从句','By-the-time clause'],['the film','subject'],['had started.','predicate']],'tense','电影开始早于到达，用过去完成时突出先发生。','The film started before arrival, so past perfect marks the earlier event.']
  ],rules:[
    ['持续背景动作常用过去进行时，打断它的短暂动作常用一般过去时。','An ongoing background commonly uses past progressive and the interrupting short event simple past.'],
    ['when 可定位一个时间点，与主句进行时搭配表达“当时正在”。','when can locate a point in time while a main progressive shows what was ongoing then.'],
    ['by the time 强调截止点，较早完成的过去动作常用过去完成时。','by the time emphasizes an endpoint; an earlier completed past action commonly uses past perfect.']
  ],questions:[
    ['While I ___, the phone rang.','While I ___, the phone rang.',['was cooking','cooked once only'],'A','持续背景用过去进行时。','Use past progressive for the ongoing background.'],
    ['When I arrived, they ___.','When I arrived, they ___.',['were eating','will eat yesterday'],'A','表示到达时正在吃。','It means eating was in progress at arrival.'],
    ['By the time we arrived, the film ___.','By the time we arrived, the film ___.',['had started','starts tomorrow'],'A','电影开始早于到达。','The film started before arrival.']
  ]},
  {id:'paired-conjunction-boundaries',level:'core',title:['because–so 与 although–but 的边界','The because–so and although–but boundary'],meta:['英语从属连词与主句连接不重复','Do not duplicate subordination and coordination'],examples:[
    [[['Because it rained,','adverbialClause','原因状语从句','Reason adverbial clause'],['we','subject'],['stayed','predicate'],['home.','adverbial']],'boundary','标准句中 because 已连接原因从句，主句前不再加 so。','In a standard sentence, because already subordinates the reason clause, so the main clause does not add so.'],
    [[['It rained,','clause','原因分句','Cause clause'],['so','conjunction','并列连词','Coordinating conjunction'],['we stayed home.','clause','结果分句','Result clause']],'contrast','也可用 so 连接两个分句，但此时不用 because。','Alternatively so may coordinate the clauses, but then because is not used.'],
    [[['Although she was tired,','adverbialClause','让步状语从句','Concessive adverbial clause'],['she','subject'],['continued.','predicate']],'boundary','although 已表达让步，标准结构中主句前不再加 but。','although already marks concession, so standard structure does not add but before the main clause.']
  ],rules:[
    ['标准英语通常不用 because ... so ... 同时连接同一组原因和结果分句。','Standard English normally does not use because ... so ... together for the same cause-result pair.'],
    ['可选择 because 从属结构，或选择 so 并列结果结构，视信息重点而定。','Choose either because-subordination or so-coordination according to information focus.'],
    ['标准英语通常不用 although/though ... but ... 同时连接同一让步关系。','Standard English normally does not combine although/though ... but ... for the same concession.']
  ],questions:[
    ['Because it rained, ___ we stayed home.','Because it rained, ___ we stayed home.',[[ '不加 so','no so'],['必须加 so','must add so']],'A','because 已建立原因关系。','because already marks the relation.'],
    ['It rained, ___ we stayed home.','It rained, ___ we stayed home.',['so','because so'],'A','不用 because 时可用 so 并列结果。','so can coordinate the result without because.'],
    ['Although she was tired, ___ she continued.','Although she was tired, ___ she continued.',[[ '不加 but','no but'],['必须加 but','must add but']],'A','although 已表达让步。','although already marks concession.']
  ]},
  {id:'ellipsis-participle',level:'advanced',title:['状语从句的省略与分词转换','Ellipsis and participle reduction in adverbial clauses'],meta:['主语一致、be 省略与主动被动关系','Same subject, omitted be, and active/passive relations'],examples:[
    [[['When (she was) young,','adverbialClause','省略主语和 be 的时间从句','Time clause with subject and be omitted'],['she','subject'],['lived','predicate'],['abroad.','adverbial']],'transformation','从句主语与主句主语相同且谓语含 be 时，可省略从句主语和 be。','When subjects match and the subordinate predicate contains be, the subject and be may be omitted.'],
    [[['If necessary,','adverbialClause','省略式条件从句','Reduced condition clause'],['call','predicate'],['me.','object']],'transformation','If necessary 相当于 If it is necessary，是固定简洁表达。','If necessary corresponds to If it is necessary and is a conventional reduction.'],
    [[['Walking home,','nonfinite','现在分词作时间或伴随状语','Present-participle time/accompanying adverbial'],['I','subject'],['met','predicate'],['Mia.','object']],'transformation','可对应 While I was walking home；逻辑主语必须是 I。','It can correspond to While I was walking home; the logical subject must be I.'],
    [[['Although invited,','nonfinite','过去分词作让步状语','Past-participle concessive adverbial'],['he','subject'],['did not attend.','predicate']],'transformation','he 承受 invite，保留 although 可明确让步关系。','he receives invite; retaining although makes concession explicit.']
  ],rules:[
    ['当状语从句主语与主句主语一致且从句含 be 时，常可省略从句主语和 be。','When the subordinate and main subjects match and the subordinate clause contains be, the subject and be may often be omitted.'],
    ['if necessary/possible 等是常见的“连词＋形容词”省略结构。','if necessary/possible and similar forms are common conjunction + adjective reductions.'],
    ['主动关系可用 doing 压缩，但非谓语逻辑主语必须与主句主语一致。','An active relation may reduce to doing, but its logical subject must match the main subject.'],
    ['被动关系可用 done 压缩；when/if/although 等连词可保留以明确逻辑。','A passive relation may reduce to done; a connector such as when, if or although may remain to clarify the relation.']
  ],questions:[
    ['When young, she lived abroad. 省略了什么？','What is omitted in “When young, she lived abroad”?',['she was','she did'],'A','同主语且含 be，可省略 she was。','Same subject plus be allows omission of she was.'],
    ['If necessary 最接近什么？','What is closest to “If necessary”?',['If it is necessary','If it necessary is'],'A','这是固定省略结构。','It is a conventional reduction.'],
    ['Walking home, I met Mia. 中谁在 walking？','Who is walking?',['I','Mia'],'A','分词逻辑主语与主句主语一致。','The participle’s logical subject matches I.'],
    ['Although ___, he did not attend. 表示“虽然被邀请”。','Although ___, he did not attend, meaning despite being invited.',['invited','inviting'],'A','he 承受 invite，使用 done。','he receives invite, so use done.']
  ]},
  {id:'adverbial-integration',level:'advanced',title:['状语从句综合逻辑辨析','Integrated adverbial-clause logic'],meta:['根据真实逻辑选择连接词，而非只看中文词面','Choose connectors from the actual logic, not a surface translation'],examples:[
    [[['Because the road was closed,','adverbialClause','原因从句','Reason clause'],['we','subject'],['took','predicate'],['another route.','object']],'logic','道路关闭是改道的真实原因，不是时间或让步。','The closure is the actual reason for taking another route, not time or concession.'],
    [[['Although the road was closed,','adverbialClause','让步从句','Concessive clause'],['the race','subject'],['continued.','predicate']],'contrast','同一事实若与主句形成反预期关系，应选择让步连接词。','The same fact calls for concession when the main result is contrary to expectation.'],
    [[['If the road is closed,','adverbialClause','条件从句','Condition clause'],['we','subject'],['will take','predicate'],['another route.','object']],'contrast','道路是否关闭尚未确定，只是假设条件。','Whether the road is closed is unresolved; it is a condition.'],
    [[['When the road is closed,','adverbialClause','时间或规律从句','Time/general clause'],['traffic','subject'],['moves','predicate'],['slowly.','adverbial']],'contrast','这里表示每逢道路关闭时出现的规律性结果。','This gives a regular result whenever the road is closed.']
  ],rules:[
    ['原因从句陈述主句事件发生的理由或依据。','A reason clause gives the cause or basis of the main event.'],
    ['让步从句提供本应阻碍主句但未能阻碍的事实。','A concessive clause gives a fact expected to prevent the main result but failing to do so.'],
    ['条件从句提出尚待满足或假设的前提。','A condition clause presents a pending or hypothetical requirement.'],
    ['时间从句定位事件发生时间，也可表达反复出现的时间规律。','A time clause locates an event and may also express a recurring temporal pattern.']
  ],questions:[
    ['道路关闭导致改道，应选择什么？','Which relation fits when road closure causes a route change?',['because','although'],'A','这是直接原因。','It is a direct reason.'],
    ['道路关闭但比赛仍继续，应选择什么？','Which relation fits when the road is closed but the race continues?',['although','so that'],'A','结果反预期，是让步。','The unexpected result calls for concession.'],
    ['道路可能关闭，若关闭就改道，应选择什么？','Which relation fits a possible closure leading to a route change?',['if','since as known fact'],'A','这是未确定的条件。','It is an unresolved condition.'],
    ['每逢道路关闭，交通都变慢，应选择什么？','Which relation fits a recurring time pattern?',['when','in order that'],'A','when 表示反复发生的时间情境。','when expresses the recurring temporal situation.']
  ]}
];

const sectionSpecs=[
  ['foundation','功能、位置与时间基础','Function, position and time foundations','建立状语从句整体功能、标点和主要时间连接词。','Build overall function, punctuation and core time connectors.',['adverbial-function-position','time-when-while-as','time-before-after','time-until-since','time-immediate-once']],
  ['place-reason-purpose-result','地点、原因、目的与结果','Place, reason, purpose and result','区分四类高频逻辑关系及结构。','Distinguish four high-frequency logical relations and structures.',['place-where-wherever','reason-because-since-as','purpose-clauses','result-so-such']],
  ['condition','条件从句系统','Condition clauses','掌握 if、unless、as long as 和 provided that。','Master if, unless, as long as and provided that.',['condition-if','condition-unless-provided']],
  ['concession','让步从句系统','Concession clauses','覆盖事实让步、对比让步和无条件让步。','Cover factual, contrastive and unconditional concession.',['concession-although-even','concession-while-no-matter']],
  ['comparison-manner','比较与方式','Comparison and manner','处理 than、as...as、as 和 as if。','Handle than, as...as, as and as if.',['comparison-clauses','manner-as-as-if']],
  ['tense-boundaries','时态与连接边界','Tense and connector boundaries','掌握将来从现、时态关系及中式重复连接错误。','Master future present forms, tense relations and duplicated connector errors.',['future-present-rule','tense-relations','paired-conjunction-boundaries']],
  ['reduction-integration','省略、转换与综合','Reduction, transformation and integration','在主语和逻辑一致前提下转换并综合辨析。','Reduce under valid subject/logic conditions and integrate all relations.',['ellipsis-participle','adverbial-integration']]
];
function buildAdverbialClausesCourse(english){const course=specs.map((s,i)=>lesson(english,s,i));const ids=course.map(x=>x.id),assigned=sectionSpecs.flatMap(x=>x[5]);if(ids.length!==assigned.length||new Set(assigned).size!==assigned.length||ids.some(id=>!assigned.includes(id))||assigned.some(id=>!ids.includes(id)))throw new Error('Invalid adverbial-clause section coverage');const sections=sectionSpecs.map(x=>({id:x[0],title:pick(english,x[1],x[2]),copy:pick(english,x[3],x[4]),lessonIds:x[5].slice(),lessonCount:x[5].length}));const core=course.filter(x=>x.level==='core'),advanced=course.filter(x=>x.level==='advanced');return{title:pick(english,`状语从句 · ${course.length} 节微课`,`Adverbial clauses · ${course.length} lessons`),copy:pick(english,'按时间、地点、原因、目的、结果、条件、让步、比较和方式建立完整逻辑系统。','Build a complete logic system of time, place, reason, purpose, result, condition, concession, comparison and manner.'),course,sections,groups:[{id:'core',title:pick(english,`核心必学 · ${core.length} 节`,`Core · ${core.length} essential lessons`),copy:pick(english,'高频逻辑、连接词、时态和标准结构。','High-frequency relations, connectors, tense and standard structures.'),lessons:core},{id:'advanced',title:pick(english,`进阶挑战 · ${advanced.length} 节`,`Advanced · ${advanced.length} challenge lessons`),copy:pick(english,'细微意义、比较方式、省略转换和综合边界。','Fine meaning contrasts, comparison/manner, reduction and integrated boundaries.'),lessons:advanced}]};}
module.exports={buildAdverbialClausesCourse};
