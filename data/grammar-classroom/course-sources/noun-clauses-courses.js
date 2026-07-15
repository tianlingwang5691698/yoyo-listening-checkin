const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const roleLabels = { subject:['主语','Subject'], predicate:['完整谓语','Complete predicate'], auxiliary:['助动词','Auxiliary'], object:['宾语','Object'], directObject:['直接宾语','Direct object'], indirectObject:['间接宾语','Indirect object'], prepObject:['介词宾语','Prepositional object'], subjectComplement:['主语补语（表语）','Subject complement'], objectComplement:['宾语补语','Object complement'], attribute:['定语','Attribute'], adverbial:['状语','Adverbial'], conjunction:['连接词','Connector'], nounClause:['名词性从句','Noun clause'], dummySubject:['形式主语','Dummy subject'], dummyObject:['形式宾语','Dummy object'], preposition:['介词','Preposition'] };
function analysis(english, chunks) { return chunks.map(([text, role, zh, en]) => ({ text, role, label: pick(english, zh || (roleLabels[role] || ['', ''])[0], en || (roleLabels[role] || ['', ''])[1]) })); }
function note(english, mode, zh, en) {
  if (!mode) return { visible:false, mode:'', title:'', body:'', detail:'' };
  const titles = { structure:['结构观察','Structure focus'], order:['语序观察','Word-order focus'], translation:['语序翻译','Word-order translation'], contrast:['易混辨析','Contrast'], boundary:['边界提醒','Boundary note'], transformation:['结构转换','Transformation focus'] };
  return { visible:true, mode, title:pick(english, ...(titles[mode] || titles.structure)), body:pick(english, zh, en), detail:'' };
}
const opt = (english, value) => Array.isArray(value) ? pick(english, value[0], value[1]) : value;
function question(english, item) { return { question:pick(english,item[0],item[1]), options:item[2].map((v,i)=>({key:String.fromCharCode(65+i),text:opt(english,v)})), answer:item[3], correct:pick(english,item[4],item[5]), wrong:pick(english,`再看规则：${item[4]}`,`Check the rule: ${item[5]}`) }; }
const NOUN_CLAUSE_ESSENCE_NARRATION={
 id:'noun-clauses:clause-as-noun-slot',version:'v3',
 text:`朋友刚说完一句话，你听后很意外。英语可以直接说：<#0.4#>What she said surprised me。<#0.8#>先把开头整块盖住，只看后面 surprised me，也就是“让什么人吃惊”。现在缺的是“什么让人吃惊”，答案不是一个单词，而是 What she said 这一整件事。所以它整体站在主语的位置。
再把这块打开看。里面的 she 是说话的人，said 是动作，what 表示“说了什么”。也就是说，它外面像一个名词，里面却自带一套“谁做什么”的小句子。这样的结构就叫名词性从句。<#0.8#>
再听：<#0.4#>I know that she is honest。<#0.7#>主干 I know 听到一半会让人追问“知道什么”。that she is honest 整体补上知道的内容，作宾语。这里 that 只是把这段内容接进来；从句内部的主语是 she，that 不顶替任何人或事物。
The question is whether we should leave 里，question 已经是主语，whether we should leave 放在 is 后，说明问题的具体内容，也就是“我们是否该离开”。它整体作表语。<#0.8#>
判断时先找外层主干，看句子缺的是“谁、什么”或“具体内容”；再把整个从句当成一块放进主语、宾语、表语或同位说明的位置；最后进入里面，另找一次主语、谓语，并检查连接词有没有承担成分。`,
 lengthText:'539 字 · 约 2 分钟'
};
const nounNarration=(id,text)=>({id:`noun-clauses:${id}`,version:'v4',text,lengthText:`${text.replace(/<#[\d.]+#>/g,'').replace(/\s/g,'').length} 字 · 约 2 分钟`});
const NOUN_CLAUSE_NARRATIONS={
  'clause-as-noun-slot':NOUN_CLAUSE_ESSENCE_NARRATION,
  'connector-system':nounNarration('connector-system',`先看 I believe that he is right。主干是 I believe，后面整段说明“相信的内容”。这里 that 像一个接口，只负责把内容接进来，在从句内部不当主语，也不当宾语。<#0.7#>We do not know whether he will come 里的 whether 多了一层“来还是不来”的选择，但它同样不代替 he，也不代替 come 后面的成分。<#0.8#>
再看 Tell me what you need。外层先抓 Tell me，what you need 是要告诉我的内容；进入从句，you 是主语，need 后面缺“需要什么”，what 正好补上这个宾语。所以 what 既负责连接，也在里面做事。I remember where we met 中，we met 的主谓已经完整，where 补的是见面的地点，因此它是地点状语。<#0.8#>
判断连接词不要只背名单。先问这段内容是陈述、是否选择，还是缺少人、事物、时间、地点、原因、方式；再进入从句找缺口。that 只接陈述内容，whether 或 if 表示“是否”，what 等连接代词要填主语、宾语或定语，where 等连接副词补状语。这样选择连接词，是看它在句子里承担什么，不是凭中文随手翻。`),
  'declarative-order':nounNarration('declarative-order',`I wonder where he lives 说的是“我想知道他住在哪里”。重点不在翻译，而在从句里的顺序：where 后面保持主语 he 再接 lives，不能把助动词提前到主语前。因为这个从句已经被装进 wonder 后面，成为一个句子成分；它虽然带疑问意思，结构上却不再是一句独立提问。<#0.8#>
再看 Do you know what she wants? 整句确实在提问，所以外层用了 Do you know；但进入宾语从句，仍然是 she wants 的陈述顺序。The issue is whether they are ready 也一样，whether 后保留 they are ready，不能把 are 提到 they 前面。<#0.8#>
最后看 I know who called。这里不要误以为 who 后面少了一个人。who 本身就是 called 的主语，所以直接接 called，不需要再加 do，也不需要另放主语。实用判断是：先把外层问题和内层从句分开；进入名词性从句后，通常按“连接词、主语、谓语”排列。若连接词自己就是主语，就直接接谓语。疑问的是意思，不等于里面还要使用疑问倒装。`),
  'subject-clauses':nounNarration('subject-clauses',`That he apologized surprised everyone 先不要从 that 开始逐词翻。先找外层谓语 surprised，再问“什么让所有人吃惊”。答案是 That he apologized 这一整件事，所以整段从句站在主语位置；里面 he 是道歉的人，apologized 是动作。<#0.8#>
Whether we can finish today depends on the weather 也是同样的外层结构。depends on 前面需要一个“取决于什么”的主语，Whether we can finish today 整体填进去，表达“今天能不能完成”这件事。whether 只标出两种可能，从句内部仍是 we can finish。<#0.8#>
What you said makes sense 中，What you said 整体作主语；再进入里面看，you 是主语，said 后缺说的内容，what 同时填补宾语。判断主语从句时，先找主句真正的限定谓语，再看它前面的整块内容能否回答“什么事情产生了这个结果”。不要把从句中的 he、we、you 误当成外层主语。整段从句在外层按一个单位处理，内部再单独分析自己的主谓和连接词功能。`),
  'object-clauses':nounNarration('object-clauses',`She said that she was tired 先抓主干 She said。said 会让人追问“说了什么”，that she was tired 就是说出的内容，整段作宾语。进入里面，she 是主语，was tired 说明状态；that 只负责引出内容，不占内部成分。<#0.8#>
I wonder whether he knows 中，wonder 后面接的是一个不确定的问题：他是否知道。whether 表示“是或不是”，但从句仍用 he knows 的陈述顺序。Please tell me why the train is late 里，me 是接收信息的人，why the train is late 才是要告诉我的内容；内部 the train is late 已完整，why 补原因。<#0.8#>
所以找宾语从句，先看外层动词是不是在表达说、想、知道、询问一类内容，再问“说什么、知道什么、想知道什么”。能回答这个问题的整段从句，就是内容宾语。然后再进入从句检查：连接词是只连接，还是还承担宾语、原因等功能。不要把 tell 后的 me 和后面的内容从句混成同一种宾语。`),
  'predicative-clauses':nounNarration('predicative-clauses',`The truth is that nobody called 中，主语 The truth 只告诉我们“真相”，内容还没说清。is 后面的 that nobody called 把真相具体化：没有人来电话。整段放在系动词后，说明主语的内容，这就是表语从句。that 只引出陈述，内部主干是 nobody called。<#0.8#>
The question is whether we can afford it 里，question 指向一个未确定的问题，whether we can afford it 给出“我们是否负担得起”这项选择。whether 保留“是还是不是”的意味，内部仍按 we can afford it 排列。<#0.8#>
This is why I left 中，why I left 不是修饰 This，而是在 is 后说明“这就是我离开的原因”。内部 I left 已有主谓，why 提供原因。判断表语从句，先圈出系动词，再看后面的整块是否在解释主语“到底是什么、具体内容是什么或原因是什么”。不要一看到 is 后有从句，就只记名称；真正要看的是前面主语的信息是否需要由后面补完整。`),
  'appositive-clauses':nounNarration('appositive-clauses',`The news that we won spread quickly 中，拿掉中间的内容说明，主句仍在表达“消息迅速传开”。that we won 没有占 spread 的宾语位置，而是紧跟 news，告诉我们“消息的具体内容”是我们赢了。这种从句叫同位语从句，常跟在 news、idea、question 这类需要展开内容的抽象名词后面。<#0.8#>
I have no idea whether he will return 里，外层是 I have no idea，whether he will return 说明 idea 的内容是“他是否回来”。The question who should lead remains unanswered 中，拿掉内容说明后，主句仍表示“这个问题没有答案”；who should lead 展开这个问题：谁应该带领。who 在内部还是 should lead 的主语。<#0.8#>
判断时先把从句暂时拿掉，看前面的名词和主句骨架是否仍成立；再问从句是在回答“这个消息、想法、问题的内容是什么”，还是在筛选“哪一个名词”。前一种是同位说明。它不替主句新增主语或宾语槽位，而是把抽象名词里的内容打开给你看。`),
  'dummy-it-subject':nounNarration('dummy-it-subject',`It is clear that she understands 如果把每个词都当实义翻译，会误以为 it 指某个东西。其实先看后面 that she understands，这才是“很清楚”的真正内容。英语为了不让长从句顶在句首，先放一个 it 占住主语位置，再把真正主语移到后面。<#0.8#>
It does not matter whether he agrees 也是如此。表面主语是 it，真正“不重要”的事情是 whether he agrees，也就是他同不同意。It is said that the team will change 里，it 不指代球队；that the team will change 是被说的内容，整个结构用来表达“据说”。<#0.8#>
识别形式主语时，不要问 it 翻成“它”是什么，而要看后面是否有一整段 that 或 whether 从句，能够回答“什么很清楚、什么不重要、什么被说”。如果能，it 只是把句子头部撑起来，真正承载意义的是后置从句。分析时先标 it 为形式主语，再把后面的从句标成真正主语，不能把它误判成普通宾语。`),
  'dummy-it-object':nounNarration('dummy-it-object',`We find it strange that he left early 中，find 后面看似已经有 it，但 it 并不指某件东西。真正被认为 strange 的内容，是 that he left early。英语先把短小的 it 放在宾语位置，让 strange 紧跟在后面，再把较长的真正宾语从句放到句尾。<#0.8#>
She made it clear that she disagreed 里，made it clear 先搭出“把某事说明白”的框架，that she disagreed 才是被说明白的具体内容。I think it important that everyone should attend 同样先出现 it 和宾语补语 important，最后用 that 从句交代真正认为重要的事情。<#0.8#>
判断形式宾语，先看动词后是否出现 it，再看 it 后面有没有 strange、clear、important 这类对内容作评价的补语，句尾是否还有能回答“究竟什么很奇怪、清楚或重要”的从句。三部分都能对上时，it 只占位置，后面的 that 从句才是真正宾语。不要把 that 从句误当成随意补充的原因。`),
  'preposition-noun-clauses':nounNarration('preposition-noun-clauses',`Everything depends on whether we agree 先抓 depends on。介词 on 后需要一个对象，这个对象不是单个名词，而是 whether we agree 整段“我们是否同意”的内容，所以它整体作介词宾语。whether 在这里合适，因为表达两种可能。<#0.8#>
We talked about what happened 中，about 后接 what happened。进入从句看，what 本身就是 happened 的主语，因此不需要再放一个主语。She is worried about how he will react 里，about 后面是 how he will react，内部 he 是主语，will react 是谓语，how 说明反应的方式。<#0.8#>
判断时先找介词，不要只盯最后一个单词；再看介词后面是否是一整套带主谓的内容。如果是，就把整个从句框成介词宾语。连接词的选择还要看内部缺口：whether 表示是否，what 可作主语或宾语，how 作方式状语。普通 that 从句不能像名词一样直接跟在多数介词后，不能因为中文能说“关于这件事”就机械套 that。`),
  'that-omission':nounNarration('that-omission',`I think that she is right 里，that 只标出宾语从句的起点，不在内部作成分。口语中主干清楚时，可以省去这个连接词，直接接“她是对的”这条陈述，意思和内部结构都没有改变，所以这里 that 常能省。<#0.8#>
但 That she is right is obvious 不一样。整个 that 从句位于句首作主语，that 清楚标出长主语的边界；若直接从 she 开始，听者容易先把它当主句，因此通常要保留。He said he was tired and that he would leave 里有两个并列内容，第二个 that 把新从句边界重新标出来，也避免把后半段误接到前一句。<#0.8#>
所以“that 能不能省”不能只背“宾语从句可省”。先看从句的位置：普通动词后的单个宾语从句最容易省；句首主语从句通常保留；多个并列从句或边界可能混乱时也应保留。that 虽然不承担内部成分，却承担结构路标的作用。省略的前提，是听者仍能迅速看清从句从哪里开始、和谁并列。`),
  'whether-if-boundaries':nounNarration('whether-if-boundaries',`I do not know 后面可以用 whether，也可以用 if，再接 he will come；两者都能表达“他是否会来”，放在普通动词后的宾语从句里通常都可以。区别要从位置和结构边界看，而不是把两个词当成永远互换。<#0.8#>
Whether he will come is unclear 中，整个从句放在句首作主语，这里用 whether，不用 if。We discussed whether to wait 里，连接词后直接接 to wait，也只能用 whether。I wonder whether or not she agrees 把 or not 紧跟在连接词后，同样选择 whether，结构最清楚。<#0.8#>
实用判断可以分两步：先看是不是普通动词后的完整宾语从句，如果是，whether 和 if 往往都能用；再检查是否位于句首、是否接不定式、是否紧跟 or not，遇到这些边界就用 whether。whether 更明确地摆出两个选择，适用范围也更宽。不要只按中文“是否”随手选 if，也不要反过来认为所有宾语从句都必须用 whether。`),
  'connector-pronouns':nounNarration('connector-pronouns',`I know who called 中，who 不只是把从句接到 know 后面，它自己就是 called 的主语，意思是“谁打来了电话”。因此 who 后直接接 called，不再加另一个主语。<#0.8#>
She asked whom we had invited 里，从句主语是 we，had invited 后缺被邀请的人，whom 填宾语位置。Tell me whose bag this is 中，whose 和 bag 绑在一起，说明“谁的包”，它在从句内作 bag 的限定成分。We must decide which route is safer 里，which 选择的是 route，which route 整体作从句主语。<#0.8#>
连接代词的关键，是一边连接，一边填从句内部的空位。分析时把它换成一个未知项：谁 called，we invited 谁，谁的 bag，哪条 route。这样就能看出它作主语、宾语还是定语。不要看到 who、what、which 就只翻中文疑问词；要继续检查它和后面的名词是否组成一块，以及从句的主谓宾还缺哪一项。`),
  'connector-adverbs':nounNarration('connector-adverbs',`I remember when we first met 中，we first met 已有完整主谓，when 不是主语或宾语，而是补“什么时候见面”，所以作时间状语。<#0.8#>Show me where the key is 里，the key is 的内容需要一个地点，where 回答钥匙在哪里，作地点状语。
Nobody knows why he left 中，he left 已经完整，why 补离开的原因。Please explain how this machine works 里，this machine works 也有主谓，how 说明机器以什么方式运转。<#0.8#>
这四类词都不去占主语或宾语槽位，而是给内部动作或状态加时间、地点、原因、方式。判断时先把连接副词暂时拿掉，如果剩下的从句主谓结构仍完整，就看缺的是哪种背景信息：when 对时间，where 对地点，why 对原因，how 对方式。同时别忘了，它们引导的是嵌入从句，后面保持陈述语序。表达“钥匙在哪里”时，也不要把内部结构倒装成独立问句的顺序。`),
  'what-vs-that':nounNarration('what-vs-that',`I understand what you mean 中，先进入从句看：you 是主语，mean 后缺“你的意思是什么”，what 正好作 mean 的宾语。所以 what 不只连接，还带着“所……的内容”，整个 what you mean 作 understand 的宾语。<#0.8#>
I understand that you are worried 里，从句 you are worried 自身已经完整，that 只是把这条陈述接到 understand 后面，不在内部承担成分。What he needs is time 再次说明 what 自带缺口：he needs 后缺宾语，what 填进去；同时整个 What he needs 又作主句主语。<#0.8#>
区分时别先翻成“什么”或“这件事”。先检查连接词后面的从句是否完整。若主语、谓语和必要宾语都齐全，只需一个连接标记，用 that；若从句内部还缺人或事物，并且这个缺口就是要表达的内容，用 what。简单说，that 后面接一条完整陈述，what 自己要在陈述里面占一个位置。`),
  'appositive-vs-relative':nounNarration('appositive-vs-relative',`The news that we won is true 中，从句内部 we won 已经完整，that 不填任何缺口；that we won 直接告诉我们 news 的内容是什么，所以是同位语从句。<#0.8#>
The news that surprised us was true 表面也有 news that，但进入从句会发现 surprised us 前缺主语，that 代表 news，正好执行 surprised。这个从句不是展开消息内容，而是在筛选“让我们吃惊的那条消息”，所以是定语从句。The idea that we should leave early seems sensible 中，we should leave early 完整，从句说明 idea 的具体内容。<#0.8#>
判断不能只看前面是不是 news、idea，也不能只看有没有 that。先进入从句检查缺口：结构完整、that 只连接，并回答“这个抽象名词的内容是什么”，就是同位语从句；若内部缺主语或宾语，that 代回前面的名词，整段回答“哪一个、什么样的”，就是定语从句。看功能和缺口，比记词表可靠。`),
  'wh-ever-nominal':nounNarration('wh-ever-nominal',`Whoever arrives first will get a prize 中，不要把 whoever 拆成普通的 who 加强调词。Whoever arrives first 整体表示“无论谁先到，也就是任何先到的人”，整段作主句主语；在内部，whoever 又是 arrives 的主语。<#0.8#>
Choose whatever you like 里，whatever you like 是 choose 的宾语，内部 you like 后缺对象，whatever 填进去，范围是“你喜欢的任何东西”。Take whichever seat is free 中，whichever 和 seat 一起表示可选座位中的任何一个，整个 whichever seat is free 作 take 的宾语。<#0.8#>
Whoever wants to join may come 再看主语功能：整段作 may come 的主语，whoever 同时作 wants 的主语。判断 wh-ever 名词性结构，要同时看两层：外层整段占主语或宾语槽位，内层 whoever、whatever、whichever 还要填人、事物或选择范围。它不是单纯让语气更强，而是把“无论哪一个”整体名词化。`),
  'tense-sequence-facts':nounNarration('tense-sequence-facts',`She said that she was tired 中，主句 said 把报告放在过去，从句 was tired 也回到她当时疲惫的状态，所以用过去时很自然。这是时态跟着报告时间调整，不是看到 said 就机械替换所有动词。<#0.8#>
The teacher said that the earth moves around the sun 说的是客观事实，地球现在仍这样运动，因此保留一般现在时 moves。He told me that he is living in Shanghai now 中，now 明确指说话此刻，而且这项居住状态仍在继续，is living 可以保留现在进行时。<#0.8#>
判断时先建立时间线：主句的“说”发生在什么时候，从句内容是只在当时成立，还是现在仍成立，或本来就是普遍事实。只在过去语境中的状态通常和过去报告时间呼应；客观事实不必后移；说话时仍真实的当前情况也可保留现在时。时态不是形式配对，而是让听者知道内容相对于哪个时间有效。`),
  'negative-raising':nounNarration('negative-raising',`I do not think he is right 表面上 not 放在 think 前，实际否定的重点通常是“我认为他不对”。英语在 think、believe 这类表达判断的动词前，常把后面内容中的否定提前到主句，这叫否定转移。<#0.8#>
She does not believe they will win 也是如此，更自然的理解通常是“她认为他们不会赢”，而不是强调“她没有进行相信这个动作”。但 I do not know why he left 不同，not 真正否定 know：我不知道原因。why he left 本身没有被改成“他没有离开”。<#0.8#>
判断时看外层动词的意义。think、believe 表达个人判断时，主句的 not 常把对后面内容的否定提前；know 表示是否掌握信息，not 通常直接否定“知道”。还要结合语境，不能看见 not think 就永远机械改译。分析结构时仍要分清：语法上的否定在主句，理解上的否定焦点可能落在宾语从句内容。`),
  'subject-clause-agreement':nounNarration('subject-clause-agreement',`What he needs is more time 中，What he needs 虽然包含多个词，外层表达的是“一件需要的东西或一个需求”，整体当单数主语，所以用 is。不要按从句有几个词来决定谓语。<#0.8#>
Whether she comes or not does not matter 里，前后摆出“来还是不来”两种可能，但合起来仍是“她来不来这件事”，主句谓语用 does。What he says and what he does are different 则明显并列了两件内容：他说的和他做的，二者相比较，因此用 are。<#0.8#>
判断主语从句的一致，先把每个从句框成一个意义单位。单个事实、问题或内容通常按单数；即使内部出现复数名词，也不直接控制主句谓语。若 and 明确并列两个彼此独立的从句内容，主语变成多个单位，通常用复数。关键看外层究竟在谈一件事还是两件事，而不是只找离谓语最近的词。`),
  'reported-speech-boundary':nounNarration('reported-speech-boundary',`先看直接说法 Mia said, “I am busy.” 引号里的 I 是 Mia 当时亲口使用的词。改成 Mia said that she was busy 后，引号内容被装进 said 后面作宾语从句，I 要按报告者视角改成 she；was 表示她当时的状态。<#0.8#>
Tom asked where I lived 不是把原问题原样塞进去。asked 后接 where 引导的宾语从句，进入从句后用 I lived 的陈述语序，不能保留独立问句的倒装形式。<#0.8#>
这一课只抓进入宾语从句时必须做的三件事：去掉引号，让内容成为 said 或 asked 的宾语；按现在的说话者调整人称；把疑问内容改为连接词加陈述语序。时态是否后移，要看报告时间和事实是否仍成立，不能全部机械改变。完整的命令、请求和各种时空词变化属于更大的直接与间接引语系统，这里先守住宾语从句的结构边界。`),
  'noun-clause-integration':nounNarration('noun-clause-integration',`It is uncertain whether what he said is true 先分外层：it 是形式主语，真正主语是 whether what he said is true。再进入这块，what he said 又是更小的主语从句，what 在里面作 said 的宾语。分析复杂句要一层层开盒子，不能把所有连接词放在同一层。<#0.8#>
The fact that she knows what we need is helpful 的主干是在说“这个事实有帮助”。that 从句说明 fact 的内容；在这个从句里，what we need 又作 knows 的宾语。What matters is how we solve the problem 中，What matters 整体作主语，how we solve the problem 在 is 后作表语。<#0.8#>
I do not think that whether he comes matters 里，that 从句整体作 think 的宾语，而 whether he comes 在这段内部又作 matters 的主语。综合判断固定四步：先找最外层限定谓语和槽位；把名词性从句整体框出；再进入每一层找自己的主谓和连接词功能；最后核对陈述语序与边界。每次只处理一层，嵌套就不会乱。`)
};
function lesson(english, spec, index) {
  if (spec.rules.length !== spec.examples.length || spec.rules.length !== spec.questions.length) throw new Error(`Noun-clause coverage mismatch: ${spec.id}`);
  const examples = spec.examples.map((item)=>({text:item[0].map((c)=>c[0]).join(' '),analysis:analysis(english,item[0]),note:note(english,item[1],item[2],item[3])}));
  const result={ id:spec.id, no:String(index+1).padStart(2,'0'), level:spec.level, title:pick(english,...spec.title), meta:pick(english,...spec.meta), examples:examples.map(x=>x.text), analyses:examples.map(x=>x.analysis), exampleNotes:examples.map(x=>x.note), rules:spec.rules.map(x=>pick(english,...x)), ruleCoverage:INCLUDE_RULE_COVERAGE?spec.rules.map((_,i)=>({exampleIndexes:[i],questionIndexes:[i]})):[], questions:spec.questions.map(x=>question(english,x)) };
  if(NOUN_CLAUSE_NARRATIONS[spec.id])result.narration=NOUN_CLAUSE_NARRATIONS[spec.id];
  return result;
}

const specs = [
  {
    id:'clause-as-noun-slot',level:'core',title:['名词性从句的定义、本质与边界','Definition, core and boundary of noun clauses'],meta:['整个从句占一个名词槽位，内部另有主谓骨架','A whole clause fills one noun slot while keeping its own inner skeleton'],
    examples:[
      [[['What','nounClause','主语从句整体为 What she said；what 作内部宾语','Whole subject clause: What she said; what as inner object'],['she','subject','从句内部主语','Inner subject'],['said','predicate','从句内部谓语','Inner predicate'],['surprised','predicate','主句谓语','Main-clause predicate'],['me.','object','主句宾语','Main-clause object']],'structure','外层骨架是“What she said＋surprised＋me”；从句内部还原为 she said what，what 作 said 的宾语。','The outer skeleton is What she said + surprised + me; internally it expands to she said what, with what as the object of said.'],
      [[['I','subject'],['know','predicate'],['that','conjunction','引导整个作 know 宾语的从句；不作内部成分','Introduces the whole object clause of know; no inner role'],['she','subject','从句内部主语','Inner subject'],['is','predicate','从句内部谓语','Inner predicate'],['honest.','subjectComplement','从句内部主语补语','Inner subject complement']],'structure','外层的宾语是整个 that she is honest；内部是 she is honest，that 只标出内容从句的起点。','The outer object is the whole that she is honest; internally it is she is honest, while that only marks the start of the content clause.'],
      [[['The question','subject'],['is','predicate'],['whether','conjunction','引导整个作主语补语的从句；表“是否”','Introduces the whole subject-complement clause; means whether'],['we','subject','从句内部主语','Inner subject'],['should leave.','predicate','从句内部谓语','Inner predicate']],'structure','整个 whether we should leave 说明 question 的内容；内部是 we should leave 的陈述语序。','The whole whether we should leave specifies the question; internally it keeps statement order we should leave.'],
      [[['The fact','subject'],['that','conjunction','引导说明 fact 内容的同位语从句；不作内部成分','Introduces the appositive clause giving fact’s content; no inner role'],['the door','subject','从句内部主语','Inner subject'],['was unlocked','predicate','从句内部谓语','Inner predicate'],['worried','predicate','主句谓语','Main-clause predicate'],['us.','object','主句宾语','Main-clause object']],'structure','整个 that the door was unlocked 说明 fact 的具体内容；内部 the door was unlocked 是完整的陈述骨架。','The whole that the door was unlocked gives the content of fact; internally, the door was unlocked is a complete statement skeleton.']
    ],
    rules:[
      ['名词性从句内部有主谓骨架，但整体可当一个名词单位作主句主语。','A noun clause has its own inner skeleton but can act as one nominal unit in the main-clause subject slot.'],
      ['名词性从句可整体填入动词的内容宾语槽位；分析时再进入从句检查主谓和连接词。','A noun clause can fill a verb’s content-object slot as a whole; then inspect its own subject, predicate and connector internally.'],
      ['名词性从句可位于系动词后作主语补语（表语），说明主语的具体内容。','A noun clause can follow a linking verb as subject complement and specify the subject’s content.']
      ,['同位语从句不是主句的新槽位，而是说明前面抽象名词的具体内容。','An appositive clause does not open a new main-clause slot; it gives the content of the preceding abstract noun.']
    ],
    questions:[
      ['What she said surprised me. 中 What she said 整体作什么？','What role does “What she said” play as a whole?',[['主语','Subject'],['宾语','Object']],'A','整个从句占主语槽位。','The whole clause fills the subject slot.'],
      ['I know that she is honest. 中从句内部主语是谁？','Who is the internal subject of the clause?',['she','I'],'A','that 不作成分，she 是从句主语。','that has no internal role; she is the clause subject.'],
      ['The question is whether we should leave. 中从句整体作什么？','What role does the clause play?',[['主语补语（表语）','Subject complement'],['定语','Attribute']],'A','它说明 question 的内容。','It specifies the content of the question.']
      ,['The fact that the door was unlocked worried us. 中 that 从句与 fact 是什么关系？','What is the relation between the that-clause and fact?',[['从句说明 fact 的内容','The clause gives the content of fact'],['从句作 worried 的宾语','The clause is the object of worried']],'A','它是同位说明；主句宾语是 us。','It is appositive content; the main-clause object is us.']
    ]
  },
  {
    id:'connector-system',level:'core',title:['连接词系统总览','The connector system'],meta:['that、whether/if、连接代词与连接副词','that, whether/if, interrogative pronouns and adverbs'],
    examples:[
      [[['I','subject'],['believe','predicate'],['that he is right.','nounClause','that 引导的宾语从句','that-object clause']],'structure','that 只连接，不在从句中作成分，也没有实义疑问。','that only connects; it fills no internal role and carries no interrogative meaning.'],
      [[['We','subject'],['do not know','predicate'],['whether he will come.','nounClause','whether 引导的宾语从句','whether-object clause']],'structure','whether 表示“是否”，不充当 come 的主宾语。','whether means whether and is not a subject or object of come.'],
      [[['Tell','predicate'],['me','indirectObject'],['what you need.','directObject','what 从句整体作内容直接宾语','what-clause as content direct object']],'structure','外层 me 是接收信息的间接宾语，what you need 是 tell 的内容直接宾语；内部 what 又作 need 的宾语。','At the outer level, me is the recipient indirect object and what you need is tell’s content direct object; internally, what is also the object of need.'],
      [[['I','subject'],['remember','predicate'],['where we met.','nounClause','where 引导的宾语从句','where-object clause']],'structure','where 在从句中表示地点状语。','where functions as a place adverbial inside the clause.']
    ],
    rules:[
      ['that 引导陈述内容，本身不在从句中充当成分。','that introduces stated content and fills no role inside the clause.'],
      ['whether/if 表示“是否”，通常不充当从句主语、宾语或状语。','whether/if means whether and normally fills no subject, object or adverbial role.'],
      ['who、what、which 等连接代词既连接，又在从句中作主语、宾语或定语。','Connector pronouns such as who, what and which both link and serve as subject, object or determiner internally.'],
      ['when、where、why、how 等连接副词在从句中作相应状语。','Connector adverbs such as when, where, why and how function as corresponding adverbials internally.']
    ],
    questions:[
      ['I believe that he is right. 中 that 作从句成分吗？','Does that fill a role inside the clause?',[['不作成分','No'],['作主语','It is the subject']],'A','that 只起连接作用。','that only links.'],
      ['whether 的基本含义是什么？','What is the basic meaning of whether?',[['是否','whether'],['什么','what']],'A','whether 引出不确定的两种可能。','whether introduces alternatives.'],
      ['Tell me what you need. 中 what 在从句内作什么？','What role does what play inside the clause?',[['need 的宾语','Object of need'],['时间状语','Time adverbial']],'A','you need what，what 是宾语。','You need what: what is the object.'],
      ['I remember where we met. 中 where 作什么？','What role does where play internally?',[['地点状语','Place adverbial'],['主语','Subject']],'A','where 表示见面的地点。','where gives the place of meeting.']
    ]
  },
  {
    id:'declarative-order',level:'core',title:['从句必须用陈述语序','Noun clauses use statement order'],meta:['疑问意义不等于疑问倒装','Interrogative meaning does not trigger question inversion'],
    examples:[
      [[['I','subject'],['wonder','predicate'],['where he lives.','nounClause','宾语从句：陈述语序','Object clause: statement order']],'order','从句用 he lives，不用 where does he live。','Use he lives inside the clause, not where does he live.'],
      [[['Do','auxiliary'],['you','subject'],['know','predicate'],['what she wants?','nounClause','宾语从句整体作 know 的宾语','Object clause as the object of know']],'order','主句用 Do you know 的疑问语序，但进入宾语从句后仍是 she wants；what 作 wants 的宾语。','The main clause uses question order Do you know, but the object clause keeps she wants; what is the object of wants.'],
      [[['The issue','subject'],['is','predicate'],['whether they are ready.','nounClause','表语从句：陈述语序','Predicative clause: statement order']],'order','whether 后是 they are ready，不倒装为 are they ready。','After whether use they are ready, not are they ready.']
      ,[[['I','subject'],['know','predicate'],['who called.','nounClause','宾语从句整体作 know 的宾语；who 作内部主语','Object clause as object of know; who as inner subject']],'order','who 本身就是 called 的主语，所以直接用 who called，不再另加主语或 do。','who itself is the subject of called, so use who called directly without another subject or do.']
    ],
    rules:[
      ['名词性从句内部通常使用“连接词＋主语＋谓语”的陈述语序。','A noun clause normally uses connector + subject + predicate statement order.'],
      ['即使主句为疑问句，嵌入的名词性从句也不使用一般疑问句倒装。','Even when the main clause is a question, the embedded noun clause does not use question inversion.'],
      ['whether/if 从句同样使用陈述语序。','whether/if clauses likewise use statement order.']
      ,['连接代词本身作从句主语时，直接接谓语，不再另加主语或助动词。','When the connector pronoun is the clause subject, it is followed directly by the predicate without another subject or auxiliary.']
    ],
    questions:[
      ['I wonder ___.','I wonder ___.',['where he lives','where does he live'],'A','宾语从句用陈述语序。','The object clause uses statement order.'],
      ['Do you know __?','Do you know __?',['what she wants','what does she want'],'A','主句疑问不改变从句语序。','A main question does not change embedded order.'],
      ['The issue is ___.','The issue is ___.',['whether they are ready','whether are they ready'],'A','whether 后仍是陈述语序。','whether is followed by statement order.']
      ,['I know ___.','I know ___.',['who called','who did call'],'A','who 作主语时直接接 called。','Subject who is followed directly by called.']
    ]
  },
  {
    id:'subject-clauses',level:'core',title:['主语从句','Subject clauses'],meta:['整个从句充当句子主语','The whole clause functions as subject'],
    examples:[
      [[['That he apologized','nounClause','that 主语从句整体作主语','that-subject clause as a whole'],['surprised','predicate'],['everyone.','object']],'structure','外层主语是整个 That he apologized；内部 he 作主语、apologized 作谓语，that 只连接。','The whole That he apologized is the outer subject; internally, he is subject, apologized is predicate, and that only links.'],
      [[['Whether we can finish today','nounClause','whether 主语从句整体作主语','whether-subject clause as a whole'],['depends','predicate'],['on','preposition'],['the weather.','prepObject']],'structure','整个 whether 从句作 depends 的主语；内部是 we can finish today 的陈述语序。on 是介词，the weather 是它的宾语。','The whole whether-clause is the subject of depends and internally keeps statement order we can finish today. on is a preposition and the weather is its object.'],
      [[['What you said','nounClause','what 主语从句','what-subject clause'],['makes','predicate'],['sense.','object']], 'structure','what 在从句内部作 said 的宾语；整个从句作主句主语。','what is the object of said internally; the whole clause is the main subject.']
    ],
    rules:[
      ['主语从句整体位于主句谓语之前并充当主语。','A subject clause as a whole precedes the main predicate and functions as subject.'],
      ['句首“是否”主语从句标准表达通常用 whether，不用 if。','An initial whether-subject clause normally uses whether, not if, in standard usage.'],
      ['连接代词引导主语从句时，还必须在从句内部承担相应成分。','When a connector pronoun introduces a subject clause, it also fills an internal role.']
    ],
    questions:[
      ['That he apologized surprised everyone. 的主语是什么？','What is the subject of this sentence?',['That he apologized','everyone'],'A','整个 that 从句作主语。','The whole that-clause is the subject.'],
      ['___ we can finish today depends on the weather.','___ we can finish today depends on the weather.',['Whether','If only'],'A','句首主语从句使用 whether。','Use whether for an initial subject clause.'],
      ['What you said makes sense. 中 what 在从句内作什么？','What role does what play inside the clause?',[['said 的宾语','Object of said'],['主句谓语','Main predicate']],'A','you said what。','You said what.']
    ]
  },
  {
    id:'dummy-it-subject',level:'core',title:['形式主语 it','Dummy subject it'],meta:['把较长主语从句后移','Postponing a heavy subject clause'],
    examples:[
      [[['It','dummySubject'],['is','predicate'],['clear','subjectComplement'],['that she understands.','nounClause','后置真正主语从句','Postponed notional subject clause']],'structure','it 只占位置，that 从句才是判断的真正内容。','it occupies the slot; the that-clause supplies the actual content.'],
      [[['It','dummySubject'],['does not matter','predicate'],['whether he agrees.','nounClause','后置真正主语从句','Postponed notional subject clause']],'structure','whether 从句后移，避免句首过重。','The whether-clause is postponed to avoid a heavy opening.'],
      [[['It','dummySubject'],['is said','predicate'],['that the team will change.','nounClause','后置主语从句','Postponed subject clause']],'structure','被动报告结构常用 It is said that ...。','Passive reporting commonly uses It is said that ....']
    ],
    rules:[
      ['it 可作形式主语，把较长的 that 主语从句后移。','it can be a dummy subject that postpones a long that-subject clause.'],
      ['whether/wh- 主语从句也可在适当结构中后移到句末。','whether and wh- subject clauses may also be postponed in suitable constructions.'],
      ['It is said/reported/believed that ... 是常见的被动报告结构。','It is said/reported/believed that ... is a common passive reporting construction.']
    ],
    questions:[
      ['It is clear that she understands. 中 it 是什么？','What is it in “It is clear that she understands”?',[['形式主语','Dummy subject'],['that 从句的宾语','Object of the that-clause']],'A','真正内容在句末 that 从句。','The actual content is in the final that-clause.'],
      ['It does not matter whether he agrees. 的真正主语是什么？','What is the notional subject?',['whether he agrees','it'],'A','whether 从句承载真正内容。','The whether-clause carries the content.'],
      ['“据说球队将调整”常用哪一结构？','Which structure commonly means “It is said that the team will change”?',['It is said that the team will change.','It says the team changing.'],'A','使用被动报告结构。','Use the passive reporting construction.']
    ]
  },
  {
    id:'object-clauses',level:'core',title:['宾语从句','Object clauses'],meta:['跟在动词后表达所知、所想、所问','Following a verb to express known, thought or questioned content'],
    examples:[
      [[['She','subject'],['said','predicate'],['that she was tired.','nounClause','that 宾语从句整体作 said 的宾语','that-clause as the object of said']],'structure','外层 said 后的内容槽位由整个 that 从句填入；内部 she was tired 成分完整，that 不作成分。','The whole that-clause fills the content-object slot after said; internally, she was tired is complete and that fills no role.'],
      [[['I','subject'],['wonder','predicate'],['whether he knows.','nounClause','whether 宾语从句整体作 wonder 的宾语','whether-clause as the object of wonder']],'structure','整个从句表示 wonder 的未知内容；内部用 he knows 的陈述语序，whether 不作主语或宾语。','The whole clause gives the unknown content of wonder; internally it uses statement order he knows, and whether is neither subject nor object.'],
      [[['Please tell','predicate'],['me','indirectObject'],['why the train is late.','directObject','why 从句整体作内容直接宾语','why-clause as content direct object']],'order','外层 me 是间接宾语，why 从句是 tell 的内容直接宾语；内部用 the train is late，why 作原因状语。','At the outer level, me is indirect object and the why-clause is tell’s content direct object; internally use the train is late, with why as reason adverbial.']
    ],
    rules:[
      ['宾语从句整体作及物动词的内容宾语。','An object clause as a whole serves as the content object of a transitive verb.'],
      ['是否类宾语从句可由 whether 或 if 引导，但存在用法限制。','An embedded whether-question may use whether or if, subject to usage restrictions.'],
      ['wh- 宾语从句既表达未知信息，连接词还在从句内部作成分。','A wh-object clause expresses unknown information, and its connector also fills an internal role.']
    ],
    questions:[
      ['She said that she was tired. 中 that 从句作什么？','What role does the that-clause play?',[['宾语','Object'],['主语','Subject']],'A','它是 said 的内容。','It is the content of said.'],
      ['I wonder ___ he knows.','I wonder ___ he knows.',['whether / if','that only'],'A','这里表达“是否”。','The clause expresses whether.'],
      ['Please tell me why the train is late. 中 why 作什么？','What role does why play internally?',[['原因状语','Reason adverbial'],['宾语','Object']],'A','why 表示火车晚点的原因。','why gives the reason for the delay.']
    ]
  },
  {
    id:'dummy-it-object',level:'core',title:['形式宾语 it','Dummy object it'],meta:['宾语补语在前，真正宾语从句后移','An object complement precedes the postponed content clause'],
    examples:[
      [[['We','subject'],['find','predicate'],['it','dummyObject'],['strange','objectComplement'],['that he left early.','nounClause','后置真正宾语从句','Postponed notional object clause']],'structure','it 是形式宾语，strange 是宾补，that 从句是真正宾语。','it is dummy object, strange is object complement, and the that-clause is the notional object.'],
      [[['She','subject'],['made','predicate'],['it','dummyObject'],['clear','objectComplement'],['that she disagreed.','nounClause','后置真正宾语从句','Postponed notional object clause']],'structure','固定骨架为 make it clear that ...。','The construction is make it clear that ....'],
      [[['I','subject'],['think','predicate'],['it','dummyObject'],['important','objectComplement'],['that everyone should attend.','nounClause','后置真正宾语从句','Postponed notional object clause']],'structure','长从句后移，使宾补紧跟形式宾语。','The heavy clause is postponed so the complement follows the dummy object.']
    ],
    rules:[
      ['“动词＋it＋宾补＋that/wh- 从句”中，it 可作形式宾语。','In verb + it + object complement + that/wh-clause, it may be a dummy object.'],
      ['真正宾语是后置从句，形容词或名词成分是对 it 所代内容的补充评价。','The postponed clause is the notional object; the adjective or noun evaluates its content.'],
      ['find/make/think/consider it + 形容词 + 从句是不应漏掉 it 的常见结构。','find/make/think/consider it + adjective + clause is a common construction in which it should not be omitted.']
    ],
    questions:[
      ['We find it strange that he left early. 中真正宾语是什么？','What is the notional object?',['that he left early','strange'],'A','that 从句承载 find 的内容。','The that-clause carries the content of find.'],
      ['She made it clear that she disagreed. 中 clear 作什么？','What role does clear play?',[['宾语补语','Object complement'],['主语','Subject']],'A','clear 评价 it 所代的从句内容。','clear evaluates the content represented by it.'],
      ['哪一项结构正确？','Which construction is correct?',['I think it important that everyone attend.','I think important that everyone attend it.'],'A','形式宾语 it 位于 think 后。','Dummy it follows think.']
    ]
  },
  {
    id:'predicative-clauses',level:'core',title:['表语从句','Predicative clauses'],meta:['说明主语的内容、原因或结果','Specifying the subject’s content, reason or result'],
    examples:[
      [[['The truth','subject'],['is','predicate'],['that nobody called.','nounClause','that 表语从句整体作主语补语','that-clause as subject complement']],'structure','is 后的整个 that 从句说明 truth 的内容；内部 nobody called 完整，that 只连接。','The whole that-clause after is specifies the truth; internally, nobody called is complete and that only links.'],
      [[['The question','subject'],['is','predicate'],['whether we can afford it.','nounClause','whether 表语从句整体作主语补语','whether-clause as subject complement']],'structure','整个 whether 从句说明 question 所问的内容；内部用 we can afford it，不用疑问倒装。','The whole whether-clause states what the question is; internally it uses we can afford it without question inversion.'],
      [[['This','subject'],['is','predicate'],['why I left.','nounClause','why 表语从句','why-predicative clause']],'structure','why 在从句内部作原因状语，整个从句说明 this 的内容。','why is a reason adverbial internally; the whole clause specifies this.']
    ],
    rules:[
      ['表语从句位于系动词后，整体充当主语补语。','A predicative clause follows a linking verb and functions as subject complement.'],
      ['whether 可引导表语从句；标准表达通常不用 if 替代。','whether can introduce a predicative clause; standard usage normally does not replace it with if.'],
      ['连接副词引导表语从句时，同时在从句内部作状语。','A connector adverb introducing a predicative clause also functions as an adverbial internally.']
    ],
    questions:[
      ['The truth is that nobody called. 中从句整体作什么？','What role does the clause play?',[['主语补语（表语）','Subject complement'],['宾语','Object']],'A','它说明 truth 的内容。','It specifies the truth.'],
      ['The question is ___ we can afford it.','The question is ___ we can afford it.',['whether','if only'],'A','表语从句用 whether。','Use whether in a predicative clause.'],
      ['This is why I left. 中 why 作什么？','What role does why play internally?',[['原因状语','Reason adverbial'],['主语','Subject']],'A','why 表示离开的原因。','why gives the reason for leaving.']
    ]
  },
  {
    id:'appositive-clauses',level:'core',title:['同位语从句','Appositive clauses'],meta:['解释抽象名词的具体内容','Explaining the content of an abstract noun'],
    examples:[
      [[['The news','subject'],['that we won','nounClause','同位语从句','Appositive clause'],['spread','predicate'],['quickly.','adverbial']],'translation','that we won 说明 news 的内容，中文可译为“我们获胜的消息”。','that we won gives the content of the news; Chinese normally places it before 消息.'],
      [[['I','subject'],['have','predicate'],['no idea','object'],['whether he will return.','nounClause','同位语从句','Appositive clause']],'structure','whether 从句解释 idea 的具体内容。','The whether-clause explains the content of idea.'],
      [[['The question','subject'],['who should lead','nounClause','同位语从句','Appositive clause'],['remains','predicate'],['unanswered.','subjectComplement']],'structure','who 在从句内部作主语，同时整个从句解释 question。','who is the internal subject while the whole clause explains question.']
    ],
    rules:[
      ['同位语从句常跟在 fact、news、idea、hope、question 等抽象名词后解释其内容。','An appositive clause commonly follows abstract nouns such as fact, news, idea, hope and question to explain their content.'],
      ['同位语从句与前面名词是“内容＝从句”的同位说明关系。','An appositive clause stands in a content-equals-clause relation with its noun.'],
      ['连接代词或副词引导同位语从句时，仍在从句内部承担成分。','A connector pronoun or adverb in an appositive clause still fills an internal role.']
    ],
    questions:[
      ['The news that we won spread quickly. 中 that 从句说明什么？','What does the that-clause explain?',[['news 的内容','The content of news'],['news 的地点','The place of the news']],'A','从句说明消息是什么。','The clause says what the news is.'],
      ['I have no idea whether he will return. 中 whether 从句是什么？','What is the whether-clause?',[['同位语从句','Appositive clause'],['地点状语','Place adverbial']],'A','它解释 idea 的内容。','It explains the content of idea.'],
      ['The question who should lead remains unanswered. 中 who 作什么？','What role does who play internally?',[['从句主语','Clause subject'],['主句宾语','Main object']],'A','who 执行 should lead。','who is the subject of should lead.']
    ]
  },
  {
    id:'preposition-noun-clauses',level:'core',title:['介词后的名词性从句','Noun clauses after prepositions'],meta:['介词宾语可以是 wh- 或 whether 从句','A prepositional object can be a wh- or whether clause'],
    examples:[
      [[['Everything','subject'],['depends','predicate'],['on','preposition'],['whether we agree.','nounClause','whether 从句整体作 on 的介词宾语','whether-clause as the object of on']],'structure','on 先建立 depends 与条件内容的关系，整个 whether we agree 作 on 的宾语；内部是 we agree 的陈述语序。','on relates depends to the condition, and the whole whether we agree is its object; internally, the clause uses statement order we agree.'],
      [[['We','subject'],['talked','predicate'],['about','preposition'],['what happened.','nounClause','what 从句整体作 about 的介词宾语','what-clause as the object of about']],'structure','整个 what happened 作 about 的宾语；内部 what 本身作 happened 的主语，所以后面不再另加主语。','The whole what happened is the object of about; internally, what itself is the subject of happened, so no extra subject follows.'],
      [[['She','subject'],['is worried','predicate'],['about','preposition'],['how he will react.','nounClause','how 从句整体作 about 的介词宾语','how-clause as the object of about']],'structure','整个 how 从句作 about 的宾语；内部 he will react 主谓完整，how 表示反应的方式。','The whole how-clause is the object of about; internally, he will react is complete and how gives the manner of the reaction.']
    ],
    rules:[
      ['介词后可接 whether 从句作介词宾语，标准表达通常不用 if。','A preposition can take a whether-clause as object; standard usage normally does not use if there.'],
      ['介词后可接 what/who 等连接代词引导的从句。','A preposition can take a clause introduced by connector pronouns such as what or who.'],
      ['介词后也可接 how/when/where 等连接副词引导的从句。','A preposition can also take a clause introduced by connector adverbs such as how, when or where.']
    ],
    questions:[
      ['Everything depends on ___ we agree.','Everything depends on ___ we agree.',['whether','if in formal standard usage'],'A','介词 on 后使用 whether。','Use whether after a preposition.'],
      ['We talked about what happened. 中 what 在从句内作什么？','What role does what play internally?',[['主语','Subject'],['宾语','Object']],'A','what happened 中 what 是主语。','what is the subject of happened.'],
      ['She is worried about ___ he will react.','She is worried about ___ he will react.',['how','that how'],'A','how 引导从句并作方式状语。','how introduces the clause and functions as manner adverbial.']
    ]
  },
  {
    id:'that-omission',level:'core',title:['that 的省略与保留','Omitting and retaining that'],meta:['宾语从句常可省，其他位置通常保留','Often optional in object clauses, normally retained elsewhere'],
    examples:[
      [[['I','subject'],['think','predicate'],['(that) she is right.','nounClause','可省 that 的宾语从句','Object clause with optional that']], 'structure','口语和一般书面语中，单个宾语从句的 that 常可省略。','In conversation and ordinary prose, that is often optional in a single object clause.'],
      [[['That she is right','nounClause','不可省 that 的主语从句','Subject clause requiring that'],['is','predicate'],['obvious.','subjectComplement']], 'boundary','句首主语从句不能直接删去 that。','Do not simply omit that from an initial subject clause.'],
      [[['He','subject'],['said','predicate'],['he was tired','nounClause','第一并列宾语从句','First coordinated object clause'],['and','conjunction'],['that he would leave.','nounClause','第二并列宾语从句保留 that','Second coordinated object clause retaining that']],'boundary','并列多个 that 宾语从句时，后一个 that 通常保留以明确边界。','With coordinated that-object clauses, later that is normally retained to mark the boundary clearly.']
    ],
    rules:[
      ['动词后的单个 that 宾语从句中，that 常可省略，尤其在口语中。','In a single that-object clause after a verb, that is often optional, especially in speech.'],
      ['that 引导主语从句、表语从句和同位语从句时通常不能随意省略。','that is normally not freely omitted from subject, predicative or appositive clauses.'],
      ['并列多个宾语从句时，后续从句的 that 通常保留，以避免结构歧义。','With coordinated object clauses, that is normally retained before later clauses to avoid ambiguity.']
    ],
    questions:[
      ['I think ___ she is right. 哪项可以？','Which is possible in “I think ___ she is right”?',[[ 'that 或省略','that or zero'],['只能 whether','whether only']],'A','单个宾语从句的 that 常可省。','that is often optional in a single object clause.'],
      ['___ she is right is obvious.','___ she is right is obvious.',['That',['省略所有连接词','omit every connector']],'A','句首主语从句需保留 that。','Retain that in an initial subject clause.'],
      ['He said he was tired and ___ he would leave.','He said he was tired and ___ he would leave.',['that',['必须省略','must be omitted']],'A','第二个并列从句保留 that 更清楚。','Retaining that clearly marks the second coordinated clause.']
    ]
  },
  {
    id:'whether-if-boundaries',level:'core',title:['whether 与 if 的限制','Restrictions on whether and if'],meta:['哪些位置只能或优先使用 whether','Where whether is required or preferred'],
    examples:[
      [[['I','subject'],['do not know','predicate'],['whether/if he will come.','nounClause','“是否”宾语从句整体作 know 的宾语','Embedded whether-question as the object of know']],'contrast','这个普通动词宾语槽位中，whether 和 if 都可表示“是否”；内部都用 he will come 的陈述语序。','In this ordinary object slot after a verb, both whether and if can mean whether; either is followed by statement order he will come.'],
      [[['Whether he will come','nounClause','句首主语从句','Initial subject clause'],['is','predicate'],['unclear.','subjectComplement']], 'boundary','句首主语从句使用 whether，不用 if。','Use whether, not if, in an initial subject clause.'],
      [[['We','subject'],['discussed','predicate'],['whether to wait.','nounClause','whether＋不定式作宾语','whether + infinitive as object']], 'boundary','whether 可直接接 to do；if 不能构成 if to do。','whether can be followed by to do; if cannot form if to do.'],
      [[['I','subject'],['wonder','predicate'],['whether or not she agrees.','nounClause','whether or not 宾语从句','whether-or-not object clause']], 'boundary','or not 紧跟连接词时使用 whether or not。','When or not immediately follows the connector, use whether or not.']
    ],
    rules:[
      ['普通动词后的“是否”宾语从句中，whether 和 if 常都可用。','In an ordinary embedded whether-question after a verb, whether and if are often both possible.'],
      ['句首主语从句、表语从句及介词后标准用法通常使用 whether。','Initial subject clauses, predicative clauses and clauses after prepositions normally use whether in standard usage.'],
      ['whether 可接 to do，if 不可直接接不定式。','whether can be followed by to do; if cannot directly precede an infinitive.'],
      ['whether or not 可连用；if or not 通常不能以相同方式把 or not 紧接在 if 后。','whether or not is possible; if or not normally cannot place or not immediately after if in the same way.']
    ],
    questions:[
      ['I do not know ___ he will come.','I do not know ___ he will come.',['whether / if','what only'],'A','普通宾语从句两者常可。','Both are often possible in an ordinary object clause.'],
      ['___ he will come is unclear.','___ he will come is unclear.',['Whether','If'],'A','句首主语从句用 whether。','Use whether initially.'],
      ['We discussed ___ to wait.','We discussed ___ to wait.',['whether','if'],'A','whether 可接不定式。','whether can precede an infinitive.'],
      ['I wonder ___ she agrees.','I wonder ___ she agrees.',['whether or not','if or not'],'A','or not 紧跟时使用 whether。','Use whether before immediate or not.']
    ]
  },
  {
    id:'connector-pronouns',level:'core',title:['连接代词：who、whom、whose、what、which','Connector pronouns: who, whom, whose, what and which'],meta:['连接同时承担主语、宾语或定语功能','Connecting while serving as subject, object or determiner'],
    examples:[
      [[['I','subject'],['know','predicate'],['who called.','nounClause','宾语从句整体作 know 的宾语；who 作内部主语','Object clause as object of know; who as inner subject']],'structure','外层 who called 整体作 know 的宾语；内部 who 就是 called 的主语，因此直接接 called。','The whole who called is the object of know; internally, who itself is the subject of called, so called follows directly.'],
      [[['She','subject'],['asked','predicate'],['whom we had invited.','nounClause','whom 作从句宾语','whom as clause object']],'structure','正式语体中 whom 可作宾语；日常英语常用 who。','whom can be an object in formal style; everyday English often uses who.'],
      [[['Tell','predicate'],['me','indirectObject'],['whose bag this is.','directObject','whose 从句整体作内容直接宾语；whose 作内部定语','whose-clause as content direct object; whose as inner determiner']],'order','外层 me 是间接宾语，whose 从句是直接宾语；内部 whose 修饰 bag，仍用 this is 的陈述语序。','At the outer level, me is indirect object and the whose-clause is direct object; internally, whose determines bag and the clause keeps statement order this is.'],
      [[['We','subject'],['must decide','predicate'],['which route is safer.','nounClause','which 作限定词','which as determiner']], 'structure','which 在限定范围中修饰 route。','which determines route within a limited choice.']
    ],
    rules:[
      ['who 可在从句中作主语，后面直接接谓语。','who can be the subject inside a clause and is followed directly by the predicate.'],
      ['whom 在正式语体中作宾语；非正式语体常由 who 替代。','whom functions as object in formal style; who often replaces it informally.'],
      ['whose 表所属并修饰后面的名词，在从句中作定语。','whose marks possession and determines the following noun inside the clause.'],
      ['what 表无先行词的“所……的事物”；which 通常在明确范围中选择。','what means the thing(s) that without an antecedent; which normally selects from a defined set.']
    ],
    questions:[
      ['I know who called. 中 who 作什么？','What role does who play?',[['从句主语','Clause subject'],['从句宾语','Clause object']],'A','who 执行 called。','who performs called.'],
      ['正式表达 whom we invited 中 whom 作什么？','What role does whom play in formal “whom we invited”?',[['宾语','Object'],['主语','Subject']],'A','we invited whom。','We invited whom.'],
      ['Tell me whose bag this is. 中 whose 作什么？','What role does whose play?',[['修饰 bag 的定语','Determiner of bag'],['谓语','Predicate']],'A','whose 表示 bag 的所属。','whose marks possession of bag.'],
      ['在两条已知路线中选择，通常用什么？','Which connector normally selects between two known routes?',['which','what without a set'],'A','明确范围选择使用 which。','Use which for a defined set.']
    ]
  },
  {
    id:'connector-adverbs',level:'core',title:['连接副词：when、where、why、how','Connector adverbs: when, where, why and how'],meta:['分别充当时间、地点、原因和方式状语','Serving as time, place, reason and manner adverbials'],
    examples:[
      [[['I','subject'],['remember','predicate'],['when we first met.','nounClause','宾语从句整体作 remember 的宾语；when 作内部时间状语','Object clause as object of remember; when as inner time adverbial']],'structure','整个 when 从句作 remember 的宾语；内部 we met 主谓完整，when 只补充“何时”。','The whole when-clause is the object of remember; internally, we met is complete and when only supplies the time.'],
      [[['Show','predicate'],['me','indirectObject'],['where the key is.','directObject','where 从句整体作内容直接宾语；where 作内部地点状语','where-clause as content direct object; where as inner place adverbial']],'order','外层 me 是间接宾语，where 从句是直接宾语；内部用 the key is，不用 where is the key。','At the outer level, me is indirect object and the where-clause is direct object; internally use the key is, not where is the key.'],
      [[['Nobody','subject'],['knows','predicate'],['why he left.','nounClause','宾语从句整体作 knows 的宾语；why 作内部原因状语','Object clause as object of knows; why as inner reason adverbial']],'structure','整个 why 从句作 knows 的宾语；内部 he left 已完整，why 问的是 left 的原因，不再与 because 重复。','The whole why-clause is the object of knows; internally, he left is complete and why asks for the reason for leaving, so because is not repeated.'],
      [[['Please explain','predicate'],['how this machine works.','nounClause','宾语从句整体作 explain 的宾语；how 作内部方式状语','Object clause as object of explain; how as inner manner adverbial']],'structure','整个 how 从句作 explain 的内容宾语；内部用 this machine works 的陈述语序，how 表示运作方式。','The whole how-clause is the content object of explain; internally it uses statement order this machine works, and how gives the manner of operation.']
    ],
    rules:[
      ['when 在从句中作时间状语，表示事情发生的时间。','when functions as time adverbial inside the clause.'],
      ['where 在从句中作地点状语，且从句仍保持陈述语序。','where functions as place adverbial, and the clause retains statement order.'],
      ['why 在从句中作原因状语，不能与 because 无意义重复。','why functions as reason adverbial and should not be redundantly paired with because.'],
      ['how 表方式或程度；how ... works 等结构中从句仍为陈述语序。','how expresses manner or degree; clauses such as how ... works retain statement order.']
    ],
    questions:[
      ['I remember when we first met. 中 when 作什么？','What role does when play?',[['时间状语','Time adverbial'],['宾语','Object']],'A','when 表示初次见面的时间。','when gives the time of meeting.'],
      ['Show me ___.','Show me ___.',['where the key is','where is the key'],'A','从句使用陈述语序。','The clause uses statement order.'],
      ['Nobody knows why he left. 中 why 作什么？','What role does why play?',[['原因状语','Reason adverbial'],['主语','Subject']],'A','why 表示离开的原因。','why gives the reason for leaving.'],
      ['Please explain ___.','Please explain ___.',['how this machine works','how does this machine work'],'A','how 从句使用陈述语序。','The how-clause uses statement order.']
    ]
  },
  {
    id:'what-vs-that',level:'core',title:['what 与 that 辨析','Distinguishing what and that'],meta:['一个作成分，一个只连接','One fills a role; the other only connects'],
    examples:[
      [[['I','subject'],['understand','predicate'],['what you mean.','nounClause','what 宾语从句','what-object clause']],'contrast','what 相当于 the thing that，在从句中作 mean 的宾语。','what means the thing that and is the object of mean.'],
      [[['I','subject'],['understand','predicate'],['that you are worried.','nounClause','that 宾语从句','that-object clause']],'contrast','that 只连接完整的 you are worried，不作成分。','that only connects the complete clause you are worried and fills no role.'],
      [[['What he needs','nounClause','what 主语从句','what-subject clause'],['is','predicate'],['time.','subjectComplement']], 'boundary','what 已包含“所需要的东西”，前面不能再加 the thing 作重复先行词。','what already contains the meaning the thing that, so do not add a redundant antecedent.']
    ],
    rules:[
      ['what 在名词性从句中承担成分，常相当于“the thing(s) that”。','what fills an internal role in a noun clause and often means the thing(s) that.'],
      ['that 不承担从句成分，因此 that 后的从句自身必须成分完整。','that fills no internal role, so the clause after it must be structurally complete.'],
      ['what 本身包含先行意义，标准结构中不再另加先行词。','what contains its own antecedent meaning, so standard structure does not add a separate antecedent.']
    ],
    questions:[
      ['I understand ___ you mean.','I understand ___ you mean.',['what','that'],'A','mean 缺宾语，what 补足该位置。','mean lacks an object, which what supplies.'],
      ['I understand ___ you are worried.','I understand ___ you are worried.',['that','what'],'A','you are worried 已完整，用 that 连接。','you are worried is complete, so use that.'],
      ['___ he needs is time.','___ he needs is time.',['What','The thing what'],'A','what 已含先行意义。','what already contains antecedent meaning.']
    ]
  },
  {
    id:'appositive-vs-relative',level:'advanced',title:['同位语从句与定语从句辨析','Appositive clauses versus relative clauses'],meta:['解释内容还是修饰名词','Content explanation or noun modification'],
    examples:[
      [[['The news','subject'],['that we won','nounClause','同位语从句','Appositive clause'],['is','predicate'],['true.','subjectComplement']],'contrast','that 不作成分，从句说明 news 的内容。','that fills no role; the clause gives the content of the news.'],
      [[['The news','subject'],['that surprised us','attribute','定语从句','Relative clause'],['was','predicate'],['true.','subjectComplement']],'contrast','that 在从句中作 surprised 的主语，修饰是哪条 news。','that is the subject of surprised and identifies which news.'],
      [[['The idea','subject'],['that we should leave early','nounClause','同位语从句','Appositive clause'],['seems','predicate'],['sensible.','subjectComplement']],'contrast','可检验“idea 的内容＝we should leave early”；这是同位说明。','The content of the idea equals we should leave early, indicating apposition.']
    ],
    rules:[
      ['同位语从句解释抽象名词的内容；that 通常不在从句中作成分。','An appositive clause explains an abstract noun’s content; that normally fills no internal role.'],
      ['定语从句限定或描述名词；关系词在从句中承担成分。','A relative clause identifies or describes a noun; its relative word fills an internal role.'],
      ['可用“名词内容是否等于从句内容”和“从句是否缺成分”双重检验。','Test both whether the noun’s content equals the clause and whether the clause has a missing internal role.']
    ],
    questions:[
      ['The news that we won is true. 中 that 从句是什么？','What is the that-clause?',[['同位语从句','Appositive clause'],['定语从句','Relative clause']],'A','从句说明 news 的内容，that 不作成分。','It gives the content and that fills no role.'],
      ['The news that surprised us was true. 中 that 作什么？','What role does that play?',[['surprised 的主语','Subject of surprised'],['不作成分','No role']],'A','that surprised us 中 that 是主语。','that is the subject of surprised us.'],
      ['辨析两类从句应检查什么？','What should be checked to distinguish the two clause types?',[['内容关系和内部缺失成分','Content relation and missing internal role'],['只看 that 前的名词','Only the noun before that']],'A','要同时看语义关系和句法功能。','Check both meaning and syntax.']
    ]
  },
  {
    id:'tense-sequence-facts',level:'advanced',title:['主句过去时与从句时态','Past reporting verbs and embedded tense'],meta:['时态呼应不是机械全部变过去','Backshift is not a mechanical change of every tense'],
    examples:[
      [[['She','subject'],['said','predicate'],['that she was tired.','nounClause','过去时宾语从句','Past-tense object clause']],'structure','疲倦与过去说话时间相关，常使用过去时呼应。','The tiredness relates to the past reporting time, so past tense is natural.'],
      [[['The teacher','subject'],['said','predicate'],['that the earth moves around the sun.','nounClause','客观事实宾语从句','Object clause stating a general truth']],'boundary','客观事实仍用一般现在时，不机械变为 moved。','A general truth remains in the present; do not mechanically change it to moved.'],
      [[['He','subject'],['told','predicate'],['me','indirectObject'],['that he is living in Shanghai now.','directObject','that 从句整体作内容直接宾语','that-clause as content direct object']],'boundary','外层 me 是 told 的间接宾语，that 从句是内容直接宾语。若信息现在仍成立并强调 now，可保留现在时。','At the outer level, me is told’s indirect object and the that-clause is its content direct object. If the information is still true now and now is emphasized, present tense may remain.']
    ],
    rules:[
      ['主句报告动词为过去时时，从句叙述与过去相关的状态或事件常发生时态后移。','After a past reporting verb, an embedded state or event related to that past time commonly backshifts.'],
      ['客观事实、科学真理和稳定规律通常保留一般现在时。','General truths, scientific facts and stable laws normally retain the present tense.'],
      ['若从句内容在当前仍真实或刻意从当前视角表达，可根据语境保留现在时。','If embedded content is still true now or deliberately presented from the current viewpoint, present tense may remain according to context.']
    ],
    questions:[
      ['She said that she ___ tired.','She said that she ___ tired.',['was','is always required'],'A','与过去说话时间相关，常用 was。','The state relates to the past reporting time.'],
      ['The teacher said that the earth ___ around the sun.','The teacher said that the earth ___ around the sun.',['moves','moved only'],'A','客观事实保留一般现在时。','A general truth retains present tense.'],
      ['He told me that he ___ in Shanghai now. 信息仍然成立时可选什么？','What may be used if the information is still true now?',['is living',['必须 had lived','must use had lived']],'A','仍成立的当前事实可保留现在时。','A still-current fact may retain present tense.']
    ]
  },
  {
    id:'negative-raising',level:'advanced',title:['否定转移','Negative raising'],meta:['think、believe 等结构中的否定位置','Position of negation with think, believe and similar verbs'],
    examples:[
      [[['I','subject'],['do not think','predicate'],['he is right.','nounClause','宾语从句','Object clause']],'translation','英语常把从句语义否定移到主句 think 前；中文通常理解为“我认为他不对”。','English commonly places the semantic negation before think; Chinese interprets it as “I think he is not right.”'],
      [[['She','subject'],['does not believe','predicate'],['they will win.','nounClause','宾语从句','Object clause']],'structure','否定落在主句 believe 上，但语义通常否定从句判断。','Negation is attached to believe but commonly scopes over the embedded proposition.'],
      [[['I','subject'],['do not know','predicate'],['why he left.','nounClause','宾语从句','Object clause']],'boundary','know 通常不按同样方式解释为“我知道他为什么没走”；不能见主句否定就一律判否定转移。','know does not yield the same raised interpretation; not every negative main verb is negative raising.']
    ],
    rules:[
      ['I/We think、believe、suppose、expect 等表达中，从句语义否定常转移到主句谓语。','With I/We think, believe, suppose or expect, semantic negation of the embedded proposition is often raised to the main predicate.'],
      ['否定转移后，形式上主句谓语是否定式，从句通常保持肯定形式。','After negative raising, the main predicate is formally negative and the embedded clause normally remains affirmative.'],
      ['否定转移只适用于特定认知判断动词和语境，不能推广到所有宾语从句。','Negative raising is limited to certain cognition/judgment verbs and contexts; it does not apply to every object clause.']
    ],
    questions:[
      ['“我认为他不对”更自然的英语是什么？','Which is the more natural English for “I think he is not right”?',['I do not think he is right.','I think not he is right.'],'A','think 常使用否定转移。','think commonly allows negative raising.'],
      ['She does not believe they will win. 形式上的否定在哪里？','Where is the formal negation?',[['主句谓语 believe','Main predicate believe'],['从句 will win 内','Inside will win']],'A','does not 修饰 believe。','does not modifies believe.'],
      ['I do not know why he left. 是否必然属于否定转移？','Is this necessarily negative raising?',[['不是','No'],['是，所有主句否定都是','Yes, every negative main clause is']],'A','know 不自动产生同类解释。','know does not automatically produce that interpretation.']
    ]
  },
  {
    id:'subject-clause-agreement',level:'core',title:['主语从句与主谓一致','Subject-clause agreement'],meta:['一个事实通常按单数，多个并列内容看意义','One proposition is normally singular; coordinated contents depend on meaning'],
    examples:[
      [[['What he needs','nounClause','主语从句','Subject clause'],['is','predicate'],['more time.','subjectComplement']], 'structure','一个主语从句通常视为一个整体，谓语用单数。','One subject clause is normally treated as one unit and takes singular agreement.'],
      [[['Whether she comes or not','nounClause','whether...or not 主语从句整体作主语','whether...or not subject clause as a whole'],['does not matter','predicate']],'structure','whether she comes or not 虽然提出两种可能，整体仍是“她来不来”这一个问题，因此用单数 does。','Although whether she comes or not presents two alternatives, the whole clause is one question, so it takes singular does.'],
      [[['What he says and what he does','nounClause','并列主语从句','Coordinated subject clauses'],['are','predicate'],['different.','subjectComplement']], 'structure','两个并列且分别指不同内容的主语从句使用复数谓语。','Two coordinated clauses referring to distinct things take plural agreement.']
    ],
    rules:[
      ['单个主语从句通常按单数整体处理，主句谓语用单数。','A single subject clause is normally treated as singular and takes a singular main verb.'],
      ['whether ... or not 整体仍是一个问题，通常按单数处理。','whether ... or not as a whole is one question and normally takes singular agreement.'],
      ['两个并列主语从句表示不同事实或行为时，主句谓语通常用复数。','Two coordinated subject clauses denoting distinct facts or actions normally take a plural main verb.']
    ],
    questions:[
      ['What he needs ___ more time.','What he needs ___ more time.',['is','are'],'A','单个主语从句按一个整体。','A single subject clause is one unit.'],
      ['Whether she comes or not ___ not matter.','Whether she comes or not ___ not matter.',['does','do'],'A','整个 whether 问题按单数。','The whole whether-question is singular.'],
      ['What he says and what he does ___ different.','What he says and what he does ___ different.',['are','is'],'A','两个不同的并列内容用复数。','Two distinct coordinated contents take plural agreement.']
    ]
  },
  {
    id:'wh-ever-nominal',level:'advanced',title:['wh-ever 的名词性用法','Nominal uses of wh-ever forms'],meta:['whoever、whatever、whichever 可整体作主宾语','whoever, whatever and whichever as subjects or objects'],
    examples:[
      [[['Whoever arrives first','nounClause','whoever 主语从句','whoever-subject clause'],['will get','predicate'],['a prize.','object']], 'structure','whoever 同时表示“任何……的人”并在从句内作主语。','whoever means anyone who and is the internal subject.'],
      [[['Choose','predicate'],['whatever you like.','nounClause','whatever 宾语从句','whatever-object clause']], 'structure','whatever 在从句内作 like 的宾语，整个从句作 choose 的宾语。','whatever is the object of like internally; the whole clause is the object of choose.'],
      [[['Take','predicate'],['whichever seat is free.','nounClause','whichever 宾语从句','whichever-object clause']], 'structure','whichever 在限定座位范围中修饰 seat。','whichever determines seat within a limited set.'],
      [[['Whoever wants to join','nounClause','名词性主语从句','Nominal subject clause'],['may come.','predicate']], 'contrast','不能用 no matter who 替代主语槽位；no matter who 通常引导让步状语从句。','no matter who cannot normally replace a subject-slot clause; it usually introduces a concessive adverbial clause.']
    ],
    rules:[
      ['whoever 可相当于 anyone who，在从句内部指人并承担成分。','whoever can mean anyone who and fills an internal role referring to a person.'],
      ['whatever 可相当于 anything that，既含泛指意义又承担从句成分。','whatever can mean anything that, combining free-choice meaning with an internal role.'],
      ['whichever 表示在限定范围中的“无论哪一个/任何一个”。','whichever means any one that within a limited set.'],
      ['wh-ever 可引导名词性从句占主宾语槽位；no matter + wh- 通常只能引导让步状语从句。','wh-ever can introduce a noun clause in subject or object position; no matter + wh- normally introduces only a concessive adverbial clause.']
    ],
    questions:[
      ['___ arrives first will get a prize.','___ arrives first will get a prize.',['Whoever','No matter who'],'A','主语槽位使用 whoever 名词性从句。','Use a whoever noun clause in the subject slot.'],
      ['Choose ___ you like.','Choose ___ you like.',['whatever','that whatever'],'A','whatever 作 like 的宾语。','whatever is the object of like.'],
      ['在几把已知座位中任选一把，使用什么？','Which form means any one from a known set of seats?',['whichever','whoever'],'A','限定范围选择使用 whichever。','Use whichever for a limited set.'],
      ['哪一项能直接作整句主语？','Which can directly serve as the sentence subject?',['Whoever wants to join','No matter who wants to join'],'A','名词性槽位用 whoever。','Use whoever in a nominal slot.']
    ]
  },
  {
    id:'reported-speech-boundary',level:'advanced',title:['宾语从句与间接引语的交界','The boundary with reported speech'],meta:['只处理成为宾语从句时必要的转换','Only the changes needed when a quotation becomes an object clause'],
    examples:[
      [[['Mia','subject'],['said,','predicate'],['“I am busy.”','directObject','直接引语作内容直接宾语','Direct quotation as content direct object']],'transformation','主干是 Mia said，引号内原话整体作 said 的内容宾语，并保留说话者原来的 I。','The skeleton is Mia said; the quoted words as a whole are the content object of said and preserve the speaker’s original I.'],
      [[['Mia','subject'],['said','predicate'],['that she was busy.','nounClause','间接引语宾语从句','Reported object clause']], 'transformation','转为宾语从句后去掉引号，I 按报告者视角改为 she，并常发生时态后移。','As an object clause, quotation marks disappear, I shifts to she, and tense commonly backshifts.'],
      [[['Tom','subject'],['asked','predicate'],['where I lived.','nounClause','间接疑问宾语从句','Reported-question object clause']], 'transformation','原问句 Where do you live? 转述后使用陈述语序 I lived，不保留 do 倒装。','The original Where do you live? becomes statement order I lived without do-inversion.']
    ],
    rules:[
      ['直接引语是原话引用；转为间接引语后常成为 say/tell 等动词的宾语从句。','Direct speech quotes exact words; reported speech commonly becomes an object clause after verbs such as say or tell.'],
      ['转述时人称、指示词和时间地点表达要按新的说话视角调整，不能机械只改时态。','In reporting, pronouns, demonstratives and time/place expressions shift with viewpoint; do not change tense alone mechanically.'],
      ['间接疑问属于宾语从句，必须使用陈述语序；完整引语规则应放在独立专题继续学习。','A reported question is an object clause and must use statement order; the full reporting system belongs in its own topic.']
    ],
    questions:[
      ['直接引语最主要保留什么？','What does direct speech principally preserve?',[['说话者原话和引号','Exact words and quotation marks'],['陈述语序宾语从句','A statement-order object clause']],'A','直接引语引用原话。','Direct speech quotes exact words.'],
      ['Mia said, “I am busy.” 转述时 I 通常改为什么？','What does I normally become when Mia’s words are reported?',['she','you'],'A','按报告视角，I 指 Mia，改为 she。','From the reporting viewpoint, I refers to Mia and becomes she.'],
      ['Tom asked where ___.','Tom asked where ___.',['I lived','did I live'],'A','间接疑问使用陈述语序。','A reported question uses statement order.']
    ]
  },
  {
    id:'noun-clause-integration',level:'advanced',title:['名词性从句综合分析','Integrated noun-clause analysis'],meta:['类型、整体功能、内部成分和边界一起判断','Combine type, outer role, inner role and usage boundaries'],
    examples:[
      [[['It','dummySubject'],['is','predicate'],['uncertain','subjectComplement'],['whether what he said is true.','nounClause','后置主语从句','Postponed subject clause']], 'structure','外层 whether 从句是真正主语；内部 what he said 又作内层主语。','The outer whether-clause is the notional subject; internally what he said is an embedded subject clause.'],
      [[['The fact','subject'],['that she knows what we need','nounClause','同位语从句含宾语从句','Appositive clause containing an object clause'],['is','predicate'],['helpful.','subjectComplement']], 'structure','外层 that 从句解释 fact；内层 what 从句作 knows 的宾语。','The outer that-clause explains fact; the inner what-clause is the object of knows.'],
      [[['What matters','nounClause','主语从句','Subject clause'],['is','predicate'],['how we solve the problem.','nounClause','表语从句','Predicative clause']], 'structure','主语和表语都由名词性从句承担；分别分析内部 matters 与 solve。','Both subject and complement are noun clauses; analyse matters and solve internally.'],
      [[['I','subject'],['do not think','predicate'],['that whether he comes matters.','nounClause','宾语从句内含主语从句','Object clause containing a subject clause']], 'boundary','外层 that 从句作宾语；内层 whether 从句作 matters 的主语，主句还有否定转移。','The outer that-clause is object; the inner whether-clause is subject of matters, with negative raising in the main clause.']
    ],
    rules:[
      ['嵌套名词性从句要逐层确定边界，不能把最外层连接词直接配给最内层谓语。','With nested noun clauses, identify boundaries layer by layer; do not attach the outer connector directly to the innermost predicate.'],
      ['同位语从句内部可以再包含宾语从句，应分别标出两层功能。','An appositive clause may contain an object clause; label the two levels separately.'],
      ['主语和表语都可由从句承担，但每个从句内部仍需独立检查语序和缺失成分。','Both subject and complement may be clauses, but each clause still requires its own checks for order and missing roles.'],
      ['综合判断需同时检查连接词功能、从句类型、时态一致、主谓一致及特殊边界。','Integrated analysis checks connector role, clause type, tense, agreement and special boundaries together.']
    ],
    questions:[
      ['It is uncertain whether what he said is true. 中真正主语是什么？','What is the notional subject?',['whether what he said is true','it'],'A','it 是形式主语，whether 从句是真正主语。','it is dummy; the whether-clause is the notional subject.'],
      ['The fact that she knows what we need is helpful. 中 what we need 作什么？','What role does “what we need” play?',[['knows 的宾语','Object of knows'],['fact 的定语从句','Relative clause modifying fact']],'A','she knows what we need。','She knows what we need.'],
      ['What matters is how we solve the problem. 中 how 从句整体作什么？','What role does the how-clause play?',[['主语补语（表语）','Subject complement'],['主语','Subject']],'A','它位于 is 后说明 What matters。','It follows is and complements What matters.'],
      ['复杂名词性从句分析应先做什么？','What should come first in analysing nested noun clauses?',[['逐层划分从句边界','Mark clause boundaries layer by layer'],['只数连接词数量','Only count connectors']],'A','边界决定每个连接词和谓语的归属。','Boundaries determine which connector belongs to which predicate.']
    ]
  }
];

const sectionSpecs = [
  ['noun-clause-foundation','名词性从句基础','Noun-clause foundations','建立整体槽位、内部骨架、连接词和陈述语序。','Build outer-slot, inner-skeleton, connector and statement-order foundations.',['clause-as-noun-slot','connector-system','declarative-order']],
  ['four-functions','四类核心功能','Four core functions','系统学习主语、宾语、表语和同位语从句。','Study subject, object, predicative and appositive clauses systematically.',['subject-clauses','object-clauses','predicative-clauses','appositive-clauses']],
  ['dummy-and-preposition','形式成分与介词结构','Dummy elements and prepositional structures','掌握形式主宾语和介词后的从句。','Master dummy subjects/objects and clauses after prepositions.',['dummy-it-subject','dummy-it-object','preposition-noun-clauses']],
  ['connector-boundaries','连接词功能与使用边界','Connector roles and restrictions','细分连接代词、副词及 that、whether/if 的边界。','Distinguish connector pronouns/adverbs and restrictions on that and whether/if.',['that-omission','whether-if-boundaries','connector-pronouns','connector-adverbs']],
  ['high-frequency-distinctions','高频易混辨析','High-frequency distinctions','解决 what/that、同位语/定语及 wh-ever 用法。','Resolve what/that, appositive/relative and wh-ever contrasts.',['what-vs-that','appositive-vs-relative','wh-ever-nominal']],
  ['tense-agreement-reporting','时态、一致与转述交界','Tense, agreement and reporting boundary','处理时态呼应、否定转移、主谓一致和必要转述规则。','Handle backshift, negative raising, agreement and essential reporting rules.',['tense-sequence-facts','negative-raising','subject-clause-agreement','reported-speech-boundary']],
  ['noun-clause-integration','综合嵌套分析','Integrated nested analysis','逐层分析嵌套从句并综合校验。','Analyse nested clauses layer by layer and integrate all checks.',['noun-clause-integration']]
];

function buildNounClausesCourse(english) {
  const specById = new Map(specs.map((spec)=>[spec.id,spec]));
  const course = sectionSpecs.flatMap((section)=>section[5]).map((id,index)=>lesson(english,specById.get(id),index));
  const ids=course.map(x=>x.id), assigned=sectionSpecs.flatMap(x=>x[5]);
  if(ids.length!==assigned.length||new Set(assigned).size!==assigned.length||ids.some(id=>!assigned.includes(id))||assigned.some(id=>!ids.includes(id))) throw new Error('Invalid noun-clause section coverage');
  const sections=sectionSpecs.map(x=>({id:x[0],title:pick(english,x[1],x[2]),copy:pick(english,x[3],x[4]),lessonIds:x[5].slice(),lessonCount:x[5].length}));
  const core=course.filter(x=>x.level==='core'), advanced=course.filter(x=>x.level==='advanced');
  return { title:pick(english,`名词性从句 · ${course.length} 节微课`,`Noun clauses · ${course.length} lessons`), copy:pick(english,'从整体句子成分到内部骨架，系统掌握四类名词性从句及高频边界。','From outer sentence roles to inner skeletons, master the four noun-clause types and their key boundaries.'), course, sections, groups:[
    {id:'core',title:pick(english,`核心必学 · ${core.length} 节`,`Core · ${core.length} essential lessons`),copy:pick(english,'连接词、语序、四类功能和基础结构。','Connectors, order, four functions and foundational structures.'),lessons:core},
    {id:'advanced',title:pick(english,`进阶挑战 · ${advanced.length} 节`,`Advanced · ${advanced.length} challenge lessons`),copy:pick(english,'易混边界、时态一致、转述交界和嵌套分析。','Difficult boundaries, tense/agreement, reporting and nested analysis.'),lessons:advanced}
  ]};
}
module.exports = { buildNounClausesCourse };
