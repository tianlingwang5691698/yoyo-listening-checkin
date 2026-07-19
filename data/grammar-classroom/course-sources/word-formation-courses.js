const pick = (en, zh, english) => en ? english : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const FIRST_LESSON_NARRATION = {
  id: 'word-formation:word-parts', version: 'v2', lengthText: '534 字 · 约 2 分钟',
  text: `看到陌生词 helpful，不一定要立刻查词典。先看看它里面有没有熟面孔：help。再看后面多出来的 ful。help 是“帮助”，ful 常让词带上“充满、有这种特点”的方向，于是 helpful 大致就是“有帮助的”。像这样观察单词是怎么拼起来的，叫构词法。它能帮你猜方向，但不是拆开就一定得到标准答案。<#0.8#>\n把三个词放在一起。<#0.4#>help，helpful，helpless。<#0.8#>它们都保留 help 这块核心。helpful 往“有帮助的”走，helpless 往“缺少帮助、无助的”走。放在核心后面的 ful 和 less，叫后缀；它们不只改变意思，还常提示新词在句中能做什么。<#0.8#>\n再看。<#0.4#>happy，unhappy。<#0.6#>un 放在 happy 前，把意思推向否定。放在前面的这一小块叫前缀。teacher 也能拆出 teach 和 er，er 在这里把“教”变成“教的人”。<#0.8#>\n不过，不能看见几个字母相同就硬拆。比如一个词拆完后意思很奇怪，或者放回句子根本不通，就要停下来查词典。act、action、active、actively 看起来是一家人，意思有关，词的用途却不同，不能随便互换。<#0.7#>\n遇到生词就按这个顺序：先找认识的核心部分；再看前后有没有常见的小零件；猜出大概意思和词的用途；最后放回原句验证。猜得通才保留，猜不通就查证。`
};
const REMAINING_NARRATIONS = {
  'derivation-inflection': {
    id: 'word-formation:derivation-inflection', version: 'v1', lengthText: '395 字 · 约 2 分钟',
    text: `看 teach 和 teacher。<#0.5#>teach 是“教”这个动作，后面加 er 以后，teacher 变成“教书的人”。这不是同一个词换了外衣，而是做出了一个用途不同的新词。这样的变化叫派生。<#0.8#>\n再看 play、plays、played、playing。它们都还是“玩”这个动词，只是为了配合谁来玩、什么时候玩，或者句子需要的形式而变化，没有造出一个新的词典词。这种只调整语法形式的变化叫屈折。<#0.8#>\n最容易混的是同样的字母可能做不同工作。teach 加 er，teacher 是“教的人”，er 在造新词；tall 加 er，taller 还是形容词 tall，只是拿来比较高矮，er 在表达比较级。不能只看到后缀长得一样，就认定作用一样。<#0.8#>\n做题时先把变化前后的词放回句子。问它们还是不是同一种词、核心意思是否没变。如果词性或基本意义变了，通常是派生；如果只是复数、时态、第三人称、比较级等句法要求，通常是屈折。先看句中工作，再看词尾。`
  },
  'negative-prefixes': {
    id: 'word-formation:negative-prefixes', version: 'v1', lengthText: '398 字 · 约 2 分钟',
    text: `一扇门锁上后，再把锁打开，可以用第一组来观察。<#0.4#>unhappy · unfair · unlock。<#0.8#>un 在 unhappy、unfair 中把意思推向否定，在 unlock 中则把动作反过来。放在词前、改变意义方向的小零件叫前缀，但同一个前缀的中文不能永远固定。<#0.7#>第二组 incorrect · impossible · illegal · irregular 都带否定方向。in 会为了说起来顺口出现 im、il、ir 等变化，这些形式要随完整单词记。<#0.7#>第三组 disagree · disconnect · disappear 里，dis 提示不同意、断开或不再出现；第四组 non-smoker · non-fiction 里的 non 常表示“不属于这一类”。<#0.8#>这些前缀都能带来否定或相反方向，却不能随便互换。判断时先遮住前缀，看剩下的部分是否是本课熟词；再把否定、相反或撤销的方向放回去；最后核对英语是否真的这样组成。前缀帮助猜方向，固定词形仍要随单词确认。`
  },
  'meaning-prefixes': {
    id: 'word-formation:meaning-prefixes', version: 'v1', lengthText: '393 字 · 约 2 分钟',
    text: `前缀不只表示否定，还能提示时间、次数、错误和程度。先看第一组。<#0.4#>rewrite · return · rebuild。<#0.8#>re 常给出“再次、返回”的方向，其中 rewrite、rebuild 容易看出重复动作；return 更适合作为完整词记，不能把每个字母组合都硬拆。<#0.7#>第二组 pre-school · preview · post-war 中，pre 指向之前，post 指向之后。第三组 misunderstand · mispronounce 里的 mis 提示理解或发音出了错。<#0.7#>第四组 overcook · underpaid · underground 更要看语境：over 可以提示过度，underpaid 表示低于应有程度，underground 里的 under 则说位置在地下。<#0.8#>判断时先找认识的核心部分，再看前面的小块是在说再次、之前、之后、错误、过度还是不足。得到大概方向后，把整个词放回原句检查；若拆分后意思牵强，就停止硬拆并查词典。`
  },
  'person-noun-suffixes': {
    id: 'word-formation:person-noun-suffixes', version: 'v1', lengthText: '384 字 · 约 2 分钟',
    text: `看到一个动作词，词尾有时能把它变成“做这件事的人”。第一组是。<#0.4#>teach → teacher · act → actor · visit → visitor。<#0.8#>er 和 or 在这里都把动作变成人物名词，但具体拼写要随完整词记。放在词尾、帮助造出新词的小块叫后缀。<#0.7#>第二组 art → artist · music → musician · history → historian。ist 和 ian 常把领域名称变成从事或研究这个领域的人，词根拼写也可能随之调整。<#0.7#>第三组 employ → employee · interview → interviewee 的方向不同。ee 常把注意力放在动作的接受者身上，而不是动作发出者，但仍要以实际词义为准。<#0.8#>做词形题时，先看空格是不是在表示“一个人”；再找前面的动作或领域，以及这个人是执行者还是接受者；最后用对应词族确认 er、or、ist、ian 或 ee。后缀给出人物方向，不代表每个词都能随意添加。`
  },
  'abstract-noun-suffixes': {
    id: 'word-formation:abstract-noun-suffixes', version: 'v1', lengthText: '371 字 · 约 2 分钟',
    text: `动作、结果或品质可以被“装进一个名字里”。第一组是。<#0.4#>act → action · decide → decision · discuss → discussion。<#0.8#>tion 或 sion 把动作变成可以谈论的事情或结果，这类词叫抽象名词；变化时拼写和读音也可能调整。<#0.7#>第二组 develop → development · arrive → arrival 中，ment 和 al 同样把动作变成名词概念。第三组 kind → kindness · possible → possibility 则把性质变成“善良、可能性”这样的概念，ness 和 ity 常提示名词位置。<#0.8#>这些后缀能帮你判断词性，却不是看到字母就机械翻译；真正意思还由词根和语境决定。<#0.7#>做题先看空格前后，判断句子是否缺一个能表示事情、结果或品质的名词；再从所给词的对应词族中选择合适形式；最后检查拼写、读音和搭配。句中位置先定词性，后缀只负责验证。`
  },
  'adjective-suffixes': {
    id: 'word-formation:adjective-suffixes', version: 'v1', lengthText: '412 字 · 约 2 分钟',
    text: `有些词尾一出现，就会提示这个词可以说明“什么样”。先看 careful ↔ careless · hopeful ↔ hopeless。<#0.8#>ful 常把意义推向“有这种特点”，less 常推向“缺少这种特点”，两边形成清楚对照。这类专门给人或事物添特点的词叫形容词。<#0.7#>第二组 dangerous · natural · active 分别用 ous、al、ive 形成形容词；第三组 readable · washable · possible 中，able 或 ible 常带“能够、可以”的方向。第四组 rainy · sunny · scientific 也通过 y、ic 提示形容词用途。<#0.8#>后缀只提示方向，不能机械翻译。possible 的内部结构不适合随意强拆，washable 也要结合被说明对象理解。<#0.7#>判断时先找空格在说明哪个名词，或是否在系动词后说明主语；确认句子需要形容词后，再观察 ful、less、ous、al、ive、able、ible、y、ic 等词尾。最后把整个词放回句子检查意义。`
  },
  'participial-adjectives': {
    id: 'word-formation:participial-adjectives', version: 'v1', lengthText: '461 字 · 约 2 分钟',
    text: `看书时，你觉得有趣，可以说。<#0.4#>I am interested in the book。<#0.7#>这本书让人觉得有趣，可以说。<#0.4#>The book is interesting。<#0.8#>两句都来自 interest，但 ed 形式把镜头对准“感受到的人”，ing 形式把镜头对准“带来这种感受的人或事物”。它们在这里都像普通形容词一样说明特点。<#0.8#>\n所以 bored 是某人感到无聊，boring 是某事让人无聊；excited 是感到兴奋，exciting 是让人兴奋。不要死背“人用 ed、物用 ing”。一本书也可以是 interested，前提是语境真的说它“感兴趣”；一个人也可以是 interesting，表示这个人很有趣。关键是感受从哪里来、落在谁身上。<#0.8#>\n还要注意，ed 和 ing 形容词不全是在讲情绪。an experienced teacher 是有经验的老师，a developing country 是正在发展的国家，要看词本身的意思。<#0.8#>\n判断时先圈出被说明的对象，再问：它是在承受某种感受或结果，还是在引发感受、表现进行中的特点？用这个关系选择 ed 或 ing，最后放回整句验证，别只按人和物分类。`
  },
  'adverb-suffix': {
    id: 'word-formation:adverb-suffix', version: 'v1', lengthText: '339 字 · 约 2 分钟',
    text: `给动作补充“怎样发生”，常需要副词。第一组是。<#0.4#>careful → carefully · quick → quickly。<#0.8#>两个形容词加 ly 后变成副词，可以去修饰动作。<#0.7#>第二组 happy → happily · simple → simply 显示拼写会调整：y 变 i，le 结尾也会随词族变化，不能只把 ly 生硬接上。<#0.7#>第三组 a friendly boy · a lovely day 提醒我们，看到 ly 不等于副词；friendly 和 lovely 都在说明后面的名词，是形容词。第四组 work hard · hardly work 则相反：hard 没有 ly 也能作副词，hardly 的意思已经变成“几乎不”。<#0.8#>做题先看空格说明谁：说明名词，通常要形容词；说明动作、形容词或整句，才考虑副词。确认需要副词后，再处理拼写，句中作用比词尾长相更可靠。`
  },
  'verb-suffixes': {
    id: 'word-formation:verb-suffixes', version: 'v1', lengthText: '338 字 · 约 2 分钟',
    text: `名词或形容词有时会通过词尾变成一个动作。先看第一组。<#0.4#>modern → modernize · real → realize。<#0.8#>ize 或 ise 提示新词常按动词使用，但完整词义仍要结合语境。<#0.7#>第二组 wide → widen · strength → strengthen 中，en 带来“使变成、发生变化”的方向；strength 变 strengthen 时，拼写和读音也一起调整。<#0.7#>第三组 simple → simplify · pure → purify 中，ify 把性质变成“使其具有这种性质”的动作。把名词或形容词改造成动作词的词尾，叫动词后缀。<#0.8#>不过，后缀不能像积木一样随便接。判断时先找句子的谓语位置，或情态动词、to 后需要的动词位置；再看所给词能否用对应词族形成动词；最后检查主语、时态和拼写。先确认句子缺动词，再选后缀。`
  },
  conversion: {
    id: 'word-formation:conversion', version: 'v1', lengthText: '355 字 · 约 2 分钟',
    text: `同一个词一个字母也不加，换到不同位置就可能做不同工作。先看 water (n.) → water the flowers (v.)。<#0.8#>前面的 water 给物质命名，是名词；后面的 water 放在动作位置，表示给花浇水，是动词。这种不加词缀、直接改变词性的办法，叫转化。<#0.7#>第二组 to answer (v.) → an answer (n.) 中，to 后的 answer 是动作，an 后的 answer 变成一件事物的名称。<#0.7#>第三组 empty (adj.) → empty the box (v.) 中，empty 先说明“空的”这一特点，换到动作位置后表示把盒子清空。<#0.8#>这不代表一个词能随便当任何词性。判断时先不要贴死标签，而要看前后信号：限定词后常需要名词，名词前常需要形容词，动作位置需要动词。再用句意问它是在命名、说明特点，还是表达动作。位置和意义同时对上，才确定转化。`
  },
  compounds: {
    id: 'word-formation:compounds', version: 'v1', lengthText: '405 字 · 约 2 分钟',
    text: `两个熟词合在一起，可能形成一个不能逐字理解的新概念。先看 blackboard · greenhouse · smartphone。<#0.8#>它们把两个部分组合成稳定名称，这种词叫合成词；第一个部分缩小范围，后一个部分常决定整体是什么。<#0.7#>第二组 toothbrush (a kind of brush) · school bus (a kind of bus) 把中心说得更清楚：toothbrush 是一种 brush，school bus 是一种 bus。第三组 notebook · post office · well-known 又显示，合成词可能连写、分写或加连字符，拼写要按实际词记。<#0.8#>第四组 school buses · toothbrushes · passers-by 说明复数也要先找中心。前两个的中心在末尾，复数变化落在末尾；passers-by 的中心在前面，所以变化位置不同。<#0.7#>判断时先问组合是否形成稳定新概念，再找哪一部分回答“它是什么”，最后根据中心确定词性和复数位置。`
  },
  'word-class-slots': {
    id: 'word-formation:word-class-slots', version: 'v1', lengthText: '374 字 · 约 2 分钟',
    text: `词形转换题先问的，不是“这个词能变出什么”，而是“句子这个位置需要什么角色”。先看 Her kindness moved us。<#0.8#>Her 后面需要一个能作主语中心的名词，kindness 正好站进这个位置。<#0.7#>第二句 The plan sounds practical 中，sounds 把 plan 和它的特点连起来，后面需要形容词 practical。第三句 She answered politely 里，politely 补充怎样回答，所以是副词。第四句 We can simplify it 中，can 后要接动词原形，因此用 simplify。<#0.8#>这些位置像不同形状的插槽：限定词后常放名词，系动词后常放形容词，修饰动作常用副词，情态动词后放动词原形。<#0.7#>做题时先遮住括号提示，只读句子，判断空格在负责命名、说明特点、补充动作，还是表达动作；再写出所需词性；最后才从提示词变形，并检查单复数、时态和拼写。`
  },
  'prefix-assimilation': {
    id: 'word-formation:prefix-assimilation', version: 'v1', lengthText: '352 字 · 约 2 分钟',
    text: `否定前缀 in 会为了让相邻声音更顺口，变成 im、il 或 ir。先看 possible → impossible · patient → impatient。<#0.8#>后面的声音需要双唇参与，前缀常变成 im。这个声音互相靠近的现象叫同化。<#0.7#>第二组 legal → illegal · regular → irregular 中，in 分别调整成 il 和 ir，让开头更容易连读。第三组 inaccurate · inactive · uncertain 提醒我们，有些词保留 in，有些否定词使用 un，拼写不能只靠一条同化规则现场创造。<#0.8#>这些规律能帮你理解和记忆，却不能替代固定词形。有些以 im、in 开头的词，也未必都能按否定前缀拆开。<#0.7#>判断时先去掉开头，看剩下部分是否是熟悉词；再看整个词是否表达否定；若是，就把 im、il、ir 和 in 联系起来。最后用对应词族或词典确认拼写。`
  },
  'suffix-spelling': {
    id: 'word-formation:suffix-spelling', version: 'v1', lengthText: '340 字 · 约 2 分钟',
    text: `加后缀不只是把字母接到最后，原词常要调整。先看 happy → happiness · happily · hurrying。<#0.8#>happy 加后缀时常把 y 变成 i，hurrying 在 ing 前则保留 y；同样看到 y，后缀不同，处理也不同。<#0.7#>第二组 write → writing · hope → hopeful 显示，结尾 e 有时去掉，有时保留，要看后缀和固定词形。第三组 sun → sunny · begin → beginner 会双写末尾字母。<#0.7#>最后一组 decide → decision · explain → explanation 变化更大，不能只套一条“去 e 加后缀”。拼写规则还和音节、重音、词族习惯有关。<#0.8#>操作时先写出基词和目标后缀，再观察结尾是 y、e 还是短元音加辅音；按本课词族写出候选形式，最后核对。变化较大的要整组记忆，不临场硬算。`
  },
  'suffix-sound-stress': {
    id: 'word-formation:suffix-sound-stress', version: 'v1', lengthText: '314 字 · 约 2 分钟',
    text: `同一家族的词长得相像，重音却不一定待在同一位置。先看 action /ˈækʃən/ · education /ˌedʒuˈkeɪʃən/。<#0.8#>tion 常形成相近的结尾声音，但两个词的音节数量和重音位置不同，不能只认词尾就套同一个节奏。<#0.7#>第二组 PHOtograph → phoTOGraphy 更直观：加入后缀后，重音从靠前音节移向后面。第三组 exPLAIN → explaNAtion 也发生重音移动，词根中的声音还可能随之变化。<#0.8#>后缀不只提示词性，有时还会拉动重音；具体发音仍属于每个词的固定信息。<#0.7#>学习时把这些基词和派生词成对读：先划音节，再标最响的音节，最后比较后缀加入后哪里变化。听到熟悉词根却重音不同，先想它是否换了词性。拼写、词性和发音要一起记。`
  },
  'layered-derivation': {
    id: 'word-formation:layered-derivation', version: 'v1', lengthText: '349 字 · 约 2 分钟',
    text: `长词不需要一口气拆完，要按形成顺序一层层看。先看 nation → national → international。<#0.8#>nation 先变成 national，再在前面加 inter；每一步都在已有词上继续构造，顺序不同，结构和意义也可能不同。<#0.7#>第二组 care → careful → carefully 中，ful 先把 care 变成形容词，最外面的 ly 再提示 carefully 最终按副词使用。分析长词时，最外层往往最直接决定当前词性。<#0.7#>第三组 teach → teacher → teachers 中，er 先派生出人物名词，最后的 s 只标复数，是派生完成后的语法变化，两层作用不能混。<#0.8#>操作时从最确定的核心词开始，一次只加或去一层，并在每一步写下词性和大概意思；再看最外层决定当前用途，最后放回句子验证。若中间一步不成立，就说明拆分顺序可能错了。`
  },
  'word-inference': {
    id: 'word-formation:word-inference', version: 'v2', lengthText: '369 字 · 约 2 分钟',
    text: `阅读时遇到陌生派生词，不必立刻停下，先让句子位置提供线索。第一句是 The new policy improved safety。<#0.8#>improved 后面缺一个“改善了什么”，所以需要名词；safe 是安全的，ty 把它变成 safety，意思是安全程度或安全状况。句中位置和词缀互相验证，比只拆字母可靠。<#0.7#>再看 The machine is reusable。is 后面需要一个说明机器特点的词，able 提示“可以被”，中间是 use，前面的 re 表示再次，于是可以推到“可以重复使用的”。<#0.8#>最后看 understand ≠ under + stand 的简单相加。很多词经历长期变化，今天的意思不能靠现代词块直接相加。猜词只是暂时理解，不是最终判决。<#0.8#>遇到生词按四步走：先看位置需要什么词性；再找可靠词根和词缀，只猜意义方向；接着用上下文检查；如果影响理解或需要自己使用，再查词典确认。`
  }
};

const example = (en, text, mode, zh, english) => ({
  text,
  note: {
    visible: true,
    mode,
    title: pick(en, mode === 'sound' ? '发音观察' : mode === 'spelling' ? '拼写观察' : '结构观察', mode === 'sound' ? 'Sound focus' : mode === 'spelling' ? 'Spelling focus' : 'Structure focus'),
    body: pick(en, zh, english),
    detail: ''
  }
});

const question = (en, zhPrompt, enPrompt, a, b, answer, zhFeedback, enFeedback) => ({
  question: pick(en, zhPrompt, enPrompt),
  options: [{ key: 'A', text: Array.isArray(a) ? pick(en, a[0], a[1]) : a }, { key: 'B', text: Array.isArray(b) ? pick(en, b[0], b[1]) : b }],
  answer,
  correct: pick(en, zhFeedback, enFeedback),
  wrong: pick(en, `再看规则：${zhFeedback}`, `Check the rule: ${enFeedback}`)
});

function lesson(en, id, zhTitle, enTitle, zhMeta, enMeta, rules, examples, questions) {
  if (rules.length !== examples.length || rules.length !== questions.length) throw new Error(`Word formation coverage mismatch: ${id}`);
  return {
    id,
    title: pick(en, zhTitle, enTitle),
    meta: pick(en, zhMeta, enMeta),
    examples: examples.map((item) => item.text),
    analyses: [],
    exampleNotes: examples.map((item) => item.note),
    rules: rules.map((item) => pick(en, item[0], item[1])),
    ruleCoverage: INCLUDE_RULE_COVERAGE ? rules.map((_, index) => ({ exampleIndexes: [index], questionIndexes: [index] })) : [],
    questions
  };
}

function buildWordFormationCourse(en) {
  const e = (text, mode, zh, english) => example(en, text, mode, zh, english);
  const q = (...args) => question(en, ...args);
  const lessons = [
    lesson(en, 'word-parts', '先看懂一个词的零件', 'See the parts inside a word', '基词 · 词根 · 前缀 · 后缀 · 词族', 'Base · root · prefix · suffix · word family', [
      ['构词时先找能承载核心意义的基词或词根。', 'Start with the base or root that carries the central meaning.'],
      ['前缀放在基词前，常改变意义；后缀放在基词后，常改变词性或意义。', 'A prefix precedes a base and often changes meaning; a suffix follows it and often changes class or meaning.'],
      ['同一词族共享核心形式和意义，但词性与具体用法可能不同。', 'Words in a family share a core form and meaning but may differ in word class and use.']
    ], [
      e('help · helpful · helpless', 'structure', 'help 是共同基词，三个词都保留“帮助”这一核心意义。', 'help is the shared base and keeps the central meaning.'),
      e('un + happy · teach + er', 'structure', 'un- 在前，-er 在后；位置决定它是前缀还是后缀。', 'un- comes before the base and -er after it.'),
      e('act · action · active · actively', 'structure', '一个词族可以跨越动词、名词、形容词和副词。', 'One word family can span verb, noun, adjective and adverb forms.')
    ], [
      q('unhappy 的基词是？', 'What is the base of unhappy?', 'happy', 'un', 'A', 'happy 承载核心意义。', 'happy carries the central meaning.'),
      q('teacher 中的后缀是？', 'Which is the suffix in teacher?', '-er', 'teach-', 'A', '-er 位于基词 teach 后。', '-er follows the base teach.'),
      q('与 decide 属于同一词族的是？', 'Which belongs to the word family of decide?', 'decision', 'division', 'A', 'decision 与 decide 共享核心形式和意义。', 'decision shares the core form and meaning with decide.')
    ]),

    lesson(en, 'derivation-inflection', '派生变化和语法变化不同', 'Derivation is not inflection', '造新词还是改变语法形式', 'New lexeme or grammatical form', [
      ['派生词缀常形成新词，可能改变词义或词性。', 'A derivational affix forms a new word and may change meaning or word class.'],
      ['屈折变化只表达数、时态、比较等级等语法信息，通常不形成新词条。', 'Inflection expresses grammar such as number, tense or degree and normally does not create a new lexeme.'],
      ['相同字母组合可能承担不同功能，要结合结构判断。', 'The same letter sequence can serve different functions, so classify it by structure.']
    ], [
      e('teach (v.) → teacher (n.)', 'structure', '-er 把动词变为表示人的名词，形成新词。', '-er derives a person noun from a verb.'),
      e('play → plays · played · playing', 'structure', '这些形式表达主语、时态或进行意义，核心词仍是 play。', 'These forms express agreement, tense or aspect; the lexeme remains play.'),
      e('teach + er → teacher · tall + er → taller', 'structure', 'teacher 的 -er 是派生后缀；taller 的 -er 是比较级屈折词尾。', '-er is derivational in teacher but comparative inflection in taller.')
    ], [
      q('哪一项形成了新词？', 'Which forms a new word?', 'kind → kindness', 'book → books', 'A', 'kindness 是新的名词。', 'kindness is a newly derived noun.'),
      q('walked 中 -ed 的主要作用是？', 'What is the main job of -ed in walked?', ['表示过去时', 'past tense'], ['把动词变名词', 'deriving a noun'], 'A', '-ed 在这里表达过去时。', '-ed marks past tense here.'),
      q('taller 中 -er 表示？', 'What does -er mark in taller?', ['比较级', 'the comparative'], ['做某事的人', 'a person who acts'], 'A', 'taller 是形容词比较级。', 'taller is the comparative adjective.')
    ]),

    lesson(en, 'negative-prefixes', '否定和相反意义前缀', 'Negative and opposite prefixes', 'un- · in- · dis- · non-', 'un- · in- · dis- · non-', [
      ['un- 常与形容词或动词结合，表示“不”或“反向动作”。', 'un- often combines with adjectives or verbs to mean not or reverse an action.'],
      ['in- 及其变体常放在形容词前表示“不”。', 'in- and its variants often negate adjectives.'],
      ['dis- 常表示“不、相反、分离或取消”。', 'dis- often means not, opposite, apart or reverse.'],
      ['non- 表示“非、没有”，语气通常比带评价色彩的否定更中性。', 'non- means not or without and is often more neutral than evaluative negatives.']
    ], [
      e('unhappy · unfair · unlock', 'structure', 'unhappy/unfair 表否定；unlock 表示解除锁定。', 'unhappy/unfair negate; unlock reverses the action.'),
      e('incorrect · impossible · illegal · irregular', 'structure', '这些词使用 in- 系列的不同形式，具体变体在进阶课处理。', 'These use variants of the in- family, treated in an advanced lesson.'),
      e('disagree · disconnect · disappear', 'structure', 'dis- 的具体意义随基词变化，不能只机械译成“不”。', 'The exact meaning of dis- depends on the base.'),
      e('non-smoker · non-fiction', 'structure', 'non- 只做类别排除：非吸烟者、非虚构作品。', 'non- excludes a category: non-smoker and non-fiction.')
    ], [
      q('“解开包装”最合适的是？', 'Which means “remove the wrapping”?', 'unwrap', 'inwrap', 'A', 'un- 可表示反向动作。', 'un- can reverse an action.'),
      q('“不可能的”是？', 'Which means “not possible”?', 'impossible', 'unpossible', 'A', 'possible 使用 impossible。', 'possible takes the form impossible.'),
      q('“不同意”是？', 'Which means “not agree”?', 'disagree', 'nonagree', 'A', 'agree 常与 dis- 构成 disagree。', 'agree forms disagree with dis-.'),
      q('“非虚构作品”是？', 'Which means “non-fiction writing”?', 'non-fiction', 'unfiction', 'A', '类别排除使用 non-fiction。', 'The neutral category term is non-fiction.')
    ]),

    lesson(en, 'meaning-prefixes', '前缀还能提示时间、次数和程度', 'Prefixes mark time, repetition and degree', 're- · pre-/post- · mis- · over-/under-', 're- · pre-/post- · mis- · over-/under-', [
      ['re- 常表示“再次”或“回到原处”。', 're- often means again or back.'],
      ['pre- 表示“之前”，post- 表示“之后”。', 'pre- means before and post- means after.'],
      ['mis- 表示“错误地、误解地”。', 'mis- means wrongly or badly.'],
      ['over- 可表示过度或在上方，under- 可表示不足或在下方。', 'over- can mean excessively or above; under- can mean insufficiently or below.']
    ], [
      e('rewrite · return · rebuild', 'structure', 'rewrite/rebuild 表再次；return 中 re- 与整体词义一起理解。', 'rewrite/rebuild mean again; return is best learned as a whole word.'),
      e('pre-school · preview · post-war', 'structure', '前缀帮助定位先后顺序。', 'The prefixes locate something before or after.'),
      e('misunderstand · mispronounce', 'structure', 'mis- 指理解或发音发生错误。', 'mis- marks an error in understanding or pronunciation.'),
      e('overcook · underpaid · underground', 'structure', 'overcook 表过度，underpaid 表不足，underground 表在下方。', 'overcook marks excess, underpaid insufficiency and underground location.')
    ], [
      q('“重写”是？', 'Which means “write again”?', 'rewrite', 'prewrite', 'A', 're- 表示再次。', 're- means again.'),
      q('“战后”是？', 'Which means “after the war”?', 'post-war', 'pre-war', 'A', 'post- 表示之后。', 'post- means after.'),
      q('“误解”是？', 'Which means “understand wrongly”?', 'misunderstand', 'overstand', 'A', 'mis- 表示错误地。', 'mis- means wrongly.'),
      q('“未充分利用的”是？', 'Which means “not used enough”?', 'underused', 'overused', 'A', 'under- 在这里表示不足。', 'under- marks insufficiency here.')
    ]),

    lesson(en, 'person-noun-suffixes', '表示人物和职业的名词后缀', 'Suffixes for people and occupations', '-er/-or · -ist/-ian · -ee', '-er/-or · -ist/-ian · -ee', [
      ['-er/-or 常表示执行某动作的人或事物。', '-er/-or often names a person or thing that performs an action.'],
      ['-ist/-ian 常表示专业、职业、信念或领域相关的人。', '-ist/-ian often names a specialist, profession, belief or field-related person.'],
      ['-ee 常表示接受动作或处于某种关系中的人。', '-ee often names the receiver of an action or a person in a relation.']
    ], [
      e('teach → teacher · act → actor · visit → visitor', 'spelling', '具体选择 -er 还是 -or 由词的固定形式决定。', 'The choice between -er and -or is lexical and must be learned.'),
      e('art → artist · music → musician · history → historian', 'spelling', '加后缀时有时会发生拼写调整。', 'Spelling may adjust when the suffix is added.'),
      e('employ → employee · interview → interviewee', 'structure', 'employee/interviewee 是动作接受者。', 'employee/interviewee names the receiver or related participant.')
    ], [
      q('teach 对应的职业名词是？', 'What is the person noun from teach?', 'teacher', 'teachor', 'A', 'teach 加 -er 构成 teacher。', 'teach takes -er to form teacher.'),
      q('“音乐家”是？', 'Which means “a musician”?', 'musician', 'musicist', 'A', 'music 对应 musician。', 'music forms musician.'),
      q('“受雇者、员工”是？', 'Which means “a person employed”?', 'employee', 'employer only', 'A', 'employee 是接受雇用的人。', 'employee is the person who is employed.')
    ]),

    lesson(en, 'abstract-noun-suffixes', '动作、结果和性质名词', 'Nouns for actions, results and qualities', '-tion/-sion · -ment/-al · -ness/-ity', '-tion/-sion · -ment/-al · -ness/-ity', [
      ['-tion/-sion 常把动词变为动作、过程或结果名词。', '-tion/-sion often derives nouns of action, process or result from verbs.'],
      ['-ment 和部分 -al 名词也可表示动作、过程或结果。', '-ment and some -al nouns can also name actions, processes or results.'],
      ['-ness 常接形容词表示性质，-ity 常形成较抽象的性质或状态名词。', '-ness often attaches to adjectives for qualities; -ity forms more abstract quality or state nouns.']
    ], [
      e('act → action · decide → decision · discuss → discussion', 'spelling', '词尾变化不能只靠“直接加后缀”，要按词族记忆。', 'The spelling changes are lexical and should be learned by word family.'),
      e('develop → development · arrive → arrival', 'structure', '后缀把动作转成可作主语或宾语的名词。', 'The suffix turns an action into a noun usable as subject or object.'),
      e('kind → kindness · possible → possibility', 'spelling', '-ness 与 -ity 的拼写规律不同。', '-ness and -ity trigger different spelling patterns.')
    ], [
      q('decide 的名词是？', 'What is the noun from decide?', 'decision', 'decidement', 'A', 'decide 对应 decision。', 'decide forms decision.'),
      q('develop 的名词是？', 'What is the noun from develop?', 'development', 'developal', 'A', 'develop 加 -ment。', 'develop takes -ment.'),
      q('kind 的性质名词是？', 'What is the quality noun from kind?', 'kindness', 'kindity', 'A', 'kind 加 -ness。', 'kind takes -ness.')
    ]),

    lesson(en, 'adjective-suffixes', '看后缀判断形容词', 'Recognize adjective suffixes', '-ful/-less · -ous/-al/-ive · -able/-ible · -y/-ic', '-ful/-less · -ous/-al/-ive · -able/-ible · -y/-ic', [
      ['-ful 表示“充满、有”，-less 表示“没有、缺少”。', '-ful means full of or having; -less means without or lacking.'],
      ['-ous、-al、-ive 常形成表示性质或关系的形容词。', '-ous, -al and -ive commonly form adjectives of quality or relation.'],
      ['-able/-ible 常表示“能够被……的”或“适合……的”。', '-able/-ible often means capable of being or suitable for.'],
      ['-y/-ic 常表示“具有……特征”或“与……有关”。', '-y/-ic often means characterized by or related to.']
    ], [
      e('careful ↔ careless · hopeful ↔ hopeless', 'structure', '同一基词换后缀可形成相反意义。', 'Changing the suffix can create an opposite meaning.'),
      e('dangerous · natural · active', 'structure', '这些后缀提示形容词身份，但具体拼写要按词族掌握。', 'These suffixes signal adjectives, while spelling remains word-family specific.'),
      e('readable · washable · possible', 'structure', 'readable/washable 可理解为“能被……的”。', 'readable/washable mean capable of being read or washed.'),
      e('rainy · sunny · scientific', 'spelling', '加 -y 或 -ic 时可能发生字母增减或双写。', 'Adding -y or -ic may trigger spelling adjustments.')
    ], [
      q('“无家可归的”是？', 'Which means “without a home”?', 'homeless', 'homeful', 'A', '-less 表示没有。', '-less means without.'),
      q('nature 的形容词是？', 'What is the adjective from nature?', 'natural', 'natureous', 'A', 'nature 对应 natural。', 'nature forms natural.'),
      q('“可接受的”是？', 'Which means “acceptable”?', 'acceptable', 'acceptful', 'A', '-able 表示能够被接受。', '-able means capable of being accepted.'),
      q('science 的形容词是？', 'What is the adjective from science?', 'scientific', 'sciencey', 'A', 'science 对应 scientific。', 'science forms scientific.')
    ]),

    lesson(en, 'participial-adjectives', '-ed 和 -ing 形容词', '-ed and -ing adjectives', '感受者和引发感受者', 'Experiencer and cause', [
      ['-ed 形容词通常描述人或事物“感到怎样”。', '-ed adjectives normally describe how a person or thing feels.'],
      ['-ing 形容词通常描述引发这种感受的人、事或特征。', '-ing adjectives normally describe the person, thing or feature causing the feeling.'],
      ['部分 -ed/-ing 形式已经词汇化，仍要结合它修饰的对象判断。', 'Some -ed/-ing forms are lexicalized, so interpret them with the noun they describe.']
    ], [
      e('I am interested in the book.', 'structure', 'I 是感受者，所以用 interested。', 'I is the experiencer, so interested is used.'),
      e('The book is interesting.', 'structure', 'book 引发兴趣，所以用 interesting。', 'The book causes the interest, so interesting is used.'),
      e('an experienced teacher · a developing country', 'structure', 'experienced 表“有经验的”；developing 表“正在发展中的”。', 'experienced means skilled through experience; developing means still developing.')
    ], [
      q('The students were ___.', 'The students were ___.', 'excited', 'exciting', 'A', '学生是感受者。', 'The students are the experiencers.'),
      q('It was an ___ match.', 'It was an ___ match.', 'exciting', 'excited', 'A', '比赛引发兴奋。', 'The match causes excitement.'),
      q('“一位有经验的医生”是？', 'Which means “a doctor with experience”?', 'an experienced doctor', 'an experiencing doctor', 'A', 'experienced 在这里表示有经验的。', 'experienced means having experience here.')
    ]),

    lesson(en, 'adverb-suffix', '副词 -ly 和拼写变化', 'The adverb suffix -ly', '直接加 · y→ily · le→ly · 例外', 'Add directly · y→ily · le→ly · exceptions', [
      ['多数方式副词由形容词直接加 -ly 构成。', 'Many manner adverbs are formed by adding -ly to adjectives.'],
      ['辅音字母+y 常变 y 为 i 再加 -ly；-le 常去 e 加 -y。', 'Consonant+y often changes y to i before -ly; final -le often drops e before -y.'],
      ['friendly、lovely 等以 -ly 结尾却是形容词。', 'friendly and lovely end in -ly but are adjectives.'],
      ['hard/hardly、late/lately 等形式相近但意义不同，不能机械加 -ly。', 'hard/hardly and late/lately are related in form but differ in meaning.']
    ], [
      e('careful → carefully · quick → quickly', 'spelling', '大多数形容词直接加 -ly。', 'Most adjectives add -ly directly.'),
      e('happy → happily · simple → simply', 'spelling', 'happy 变 y 为 i；simple 去 e 再加 y。', 'happy changes y to i; simple drops e before y.'),
      e('a friendly boy · a lovely day', 'structure', 'friendly/lovely 修饰名词，是形容词。', 'friendly/lovely modify nouns and are adjectives.'),
      e('work hard · hardly work', 'structure', 'hard 是“努力地”；hardly 是“几乎不”。', 'hard means with effort; hardly means almost not.')
    ], [
      q('careful 的副词是？', 'What is the adverb from careful?', 'carefully', 'carefuly', 'A', '直接加 -ly。', 'Add -ly.'),
      q('happy 的副词是？', 'What is the adverb from happy?', 'happily', 'happyly', 'A', 'y 变 i 再加 -ly。', 'Change y to i before -ly.'),
      q('friendly 在 a friendly teacher 中是？', 'What is friendly in “a friendly teacher”?', ['形容词 adjective', 'an adjective'], ['副词 adverb', 'an adverb'], 'A', '它直接修饰名词 teacher。', 'It directly modifies the noun teacher.'),
      q('“他学习很努力”应选？', 'Which means “He studies with great effort”?', 'He studies hard.', 'He hardly studies.', 'A', 'hard 表示努力地。', 'hard means with effort.')
    ]),

    lesson(en, 'verb-suffixes', '把名词或形容词变成动词', 'Derive verbs from nouns and adjectives', '-ize/-ise · -en · -ify', '-ize/-ise · -en · -ify', [
      ['-ize/-ise 常表示“使成为、按……处理”。', '-ize/-ise often means make, become or treat in a certain way.'],
      ['-en 常接形容词，表示“使变得”或“变得”。', '-en often attaches to adjectives and means make or become.'],
      ['-ify 常表示“使……化、使成为”。', '-ify often means make or cause to become.']
    ], [
      e('modern → modernize · real → realize', 'spelling', '-ize/-ise 的具体拼写因词和英美习惯而异，应查词典确认。', 'The spelling of -ize/-ise varies by word and convention; confirm it in a dictionary.'),
      e('wide → widen · strength → strengthen', 'spelling', '-en 可能伴随基词拼写或词形调整。', '-en may accompany an adjustment to the base form.'),
      e('simple → simplify · pure → purify', 'spelling', '加 -ify 时常需要改变基词末尾拼写。', 'Adding -ify often changes the end of the base.')
    ], [
      q('modern 的动词是？', 'What is the verb from modern?', 'modernize', 'modernful', 'A', 'modernize 表示现代化。', 'modernize means make modern.'),
      q('wide 的动词是？', 'What is the verb from wide?', 'widen', 'widely', 'A', 'widen 表示使变宽。', 'widen means make wider.'),
      q('simple 的动词是？', 'What is the verb from simple?', 'simplify', 'simpleness', 'A', 'simplify 表示简化。', 'simplify means make simple.')
    ]),

    lesson(en, 'conversion', '不加词缀也能改变词性', 'Conversion without an affix', '名词↔动词 · 形容词→动词 · 语境定词性', 'Noun↔verb · adjective→verb · class from context', [
      ['名词可零变化转成动词，形式不变但句法位置和意义改变。', 'A noun can convert to a verb with no visible affix; position and meaning change.'],
      ['动词也可零变化转成名词。', 'A verb can likewise convert to a noun without an affix.'],
      ['部分形容词可转成动词，表示“使变得”或“变得”。', 'Some adjectives convert to verbs meaning make or become.']
    ], [
      e('water (n.) → water the flowers (v.)', 'structure', '第二个 water 位于宾语前，承担谓语动词作用。', 'The second water precedes an object and functions as a verb.'),
      e('to answer (v.) → an answer (n.)', 'structure', '冠词 an 提示 answer 在这里是名词。', 'The article an signals that answer is a noun here.'),
      e('empty (adj.) → empty the box (v.)', 'structure', 'empty 从描述状态转为“使箱子变空”的动作。', 'empty shifts from a state to the action of making the box empty.')
    ], [
      q('Please ___ the plants. 应选？', 'Complete “Please ___ the plants.”', 'water', 'a water', 'A', '情态/祈使结构后需要动词 water。', 'The structure needs the verb water.'),
      q('I know the ___. 应选？', 'Complete “I know the ___.”', 'answer', 'to answer', 'A', 'the 后需要名词 answer。', 'A noun is needed after the.'),
      q('“把袋子清空”是？', 'Which means “make the bag empty”?', 'empty the bag', 'an empty bag only', 'A', 'empty 在这里转化为动词。', 'empty is converted into a verb here.')
    ]),

    lesson(en, 'compounds', '两个词合成一个新概念', 'Compounding creates a new concept', '中心词 · 词性 · 拼写 · 复数', 'Head · word class · spelling · plural', [
      ['英语合成词常由两个或更多自由词素组成，整体意义不一定等于逐词相加。', 'An English compound combines two or more free morphemes, and its meaning may not be fully compositional.'],
      ['多数英语合成词的右侧成分是中心词，常决定整体词性和基本类别。', 'In many English compounds, the right-hand element is the head and determines class and category.'],
      ['合成词可能连写、分写或加连字符，拼写形式要按规范词形记忆。', 'Compounds may be closed, open or hyphenated, and conventional spelling must be learned.'],
      ['复数通常加在中心词上，但固定形式和特殊合成词需单独确认。', 'Plural marking normally goes on the head, though fixed and exceptional compounds need checking.']
    ], [
      e('blackboard · greenhouse · smartphone', 'structure', '整体形成新概念，greenhouse 不是普通的 green house。', 'Each forms a new concept; a greenhouse is not simply any green house.'),
      e('toothbrush (a kind of brush) · school bus (a kind of bus)', 'structure', '右侧 brush/bus 决定整体是某类刷子或公交车。', 'The right-hand brush/bus identifies the category.'),
      e('notebook · post office · well-known', 'spelling', '三种写法都存在，不能凭感觉随意拆合。', 'Closed, open and hyphenated spellings all occur.'),
      e('school buses · toothbrushes · passers-by', 'spelling', '常规合成词在中心词变复数；passer-by 属特殊形式。', 'Regular compounds pluralize the head; passer-by is a special pattern.')
    ], [
      q('greenhouse 通常指？', 'What does greenhouse normally mean?', ['温室', 'a glass building for growing plants'], ['绿色的任意房子', 'any house that is green'], 'A', 'greenhouse 是固定合成词。', 'greenhouse is a lexicalized compound.'),
      q('school bus 的中心词是？', 'What is the head of school bus?', 'bus', 'school', 'A', '它是一种 bus。', 'It is a kind of bus.'),
      q('哪一项拼写规范？', 'Which conventional spelling is correct?', 'post office', 'postoffice always', 'A', 'post office 通常分写。', 'post office is normally open.'),
      q('两辆校车是？', 'Which means “two school buses”?', 'two school buses', 'two schools bus', 'A', '复数标记落在中心词 buses。', 'Plural marking goes on the head buses.')
    ]),

    lesson(en, 'word-class-slots', '考试先看空格需要什么词性', 'Use the sentence slot to choose word class', '限定词后 · 系动词后 · 修饰动词 · 情态动词后', 'After determiners · linking verbs · modifying verbs · after modals', [
      ['限定词或形容词后、谓语前的中心位置通常需要名词。', 'The head position after a determiner or adjective and before the predicate normally needs a noun.'],
      ['系动词后描述主语通常需要形容词。', 'A description after a linking verb normally needs an adjective.'],
      ['修饰实义动词通常需要副词。', 'A modifier of a lexical verb normally needs an adverb.'],
      ['情态动词后需要动词原形。', 'A modal verb is followed by a base verb.']
    ], [
      e('Her kindness moved us.', 'structure', 'Her 后且作主语中心，需要名词 kindness。', 'The head after Her is the subject noun kindness.'),
      e('The plan sounds practical.', 'structure', 'sounds 是系动词，后用形容词 practical。', 'sounds is linking, so the adjective practical follows.'),
      e('She answered politely.', 'structure', 'politely 修饰动作 answered。', 'politely modifies the action answered.'),
      e('We can simplify it.', 'structure', 'can 后接动词原形 simplify。', 'The modal can takes the base verb simplify.')
    ], [
      q('Her ___ impressed us. (kind)', 'Complete “Her ___ impressed us.” (kind)', 'kindness', 'kindly', 'A', '主语中心需要名词。', 'The subject head must be a noun.'),
      q('The idea sounds ___. (use)', 'Complete “The idea sounds ___.” (use)', 'useful', 'usefully', 'A', '系动词后用形容词。', 'Use an adjective after the linking verb.'),
      q('He spoke ___. (clear)', 'Complete “He spoke ___.” (clear)', 'clearly', 'clearness', 'A', '修饰 spoke 需要副词。', 'An adverb is needed to modify spoke.'),
      q('Technology can ___ life. (simple)', 'Complete “Technology can ___ life.” (simple)', 'simplify', 'simply', 'A', 'can 后需要动词原形。', 'A base verb follows can.')
    ]),

    lesson(en, 'prefix-assimilation', 'in- 为什么会变成 im-/il-/ir-', 'Why in- changes to im-/il-/ir-', '读音同化与固定词形', 'Sound assimilation and lexical forms', [
      ['否定前缀 in- 在部分双唇音前变为 im-，使发音更顺畅。', 'Negative in- becomes im- before some bilabial sounds for easier articulation.'],
      ['在 l 前常变 il-，在 r 前常变 ir-。', 'It commonly becomes il- before l and ir- before r.'],
      ['这些形式不是可自由套用的公式，最终词形必须以词典和真实词族为准。', 'These are not freely productive formulas; confirm the established lexical form.']
    ], [
      e('possible → impossible · patient → impatient', 'sound', 'in- 在 /p/ 前同化为 im-。', 'in- assimilates to im- before /p/.'),
      e('legal → illegal · regular → irregular', 'sound', 'l 前用 il-，r 前用 ir-。', 'Use il- before l and ir- before r in these established words.'),
      e('inaccurate · inactive · uncertain', 'structure', '不是所有否定词都用同一前缀；uncertain 使用 un-。', 'Not every negative takes the same prefix; uncertain uses un-.')
    ], [
      q('possible 的反义词是？', 'What is the negative of possible?', 'impossible', 'inpossible', 'A', 'p 前使用 im-。', 'im- is used before p here.'),
      q('regular 的反义词是？', 'What is the negative of regular?', 'irregular', 'inregular', 'A', 'r 前使用 ir-。', 'ir- is used before r here.'),
      q('certain 的常见反义词是？', 'What is the common negative of certain?', 'uncertain', 'incertain', 'A', '固定词形是 uncertain。', 'The established form is uncertain.')
    ]),

    lesson(en, 'suffix-spelling', '加后缀时基词怎样变形', 'Spelling changes before suffixes', 'y→i · 去 e/保留 e · 双写 · 词族变化', 'y→i · drop/keep e · doubling · family changes', [
      ['辅音字母+y 在部分后缀前变 y 为 i，但 -ing 前通常保留 y。', 'Consonant+y changes y to i before some suffixes, but y normally remains before -ing.'],
      ['不发音 e 在元音开头后缀前常去掉，在辅音开头后缀前常保留。', 'Silent e is often dropped before vowel-initial suffixes and kept before consonant-initial suffixes.'],
      ['符合重读闭音节等条件时，末辅音可能双写后再加后缀。', 'An eligible final consonant may double in a stressed closed-syllable pattern.'],
      ['部分派生词发生更深的词形变化，应按词族成组记忆。', 'Some derivatives undergo deeper stem changes and should be learned as word families.']
    ], [
      e('happy → happiness · happily · hurrying', 'spelling', 'happy 的 y 变 i；hurry 加 -ing 时保留 y。', 'happy changes y to i; hurry keeps y before -ing.'),
      e('write → writing · hope → hopeful', 'spelling', 'writing 去 e；hopeful 在辅音开头的 -ful 前保留 e。', 'writing drops e; hopeful keeps e before consonant-initial -ful.'),
      e('sun → sunny · begin → beginner', 'spelling', '满足条件时双写末辅音。', 'The final consonant doubles when the pattern requires it.'),
      e('decide → decision · explain → explanation', 'spelling', '词干变化要随词族记忆，不能临时拼接。', 'Learn the stem change with the family rather than improvising it.')
    ], [
      q('happy 的名词是？', 'What is the noun from happy?', 'happiness', 'happyness', 'A', 'y 变 i 再加 -ness。', 'Change y to i before -ness.'),
      q('write 的 -ing 形式是？', 'What is the -ing form of write?', 'writing', 'writeing', 'A', '去不发音 e 再加 -ing。', 'Drop silent e before -ing.'),
      q('sun 的形容词是？', 'What is the adjective from sun?', 'sunny', 'suny', 'A', '双写 n 再加 -y。', 'Double n before -y.'),
      q('decide 的名词是？', 'What is the noun from decide?', 'decision', 'decidation', 'A', '固定词族形式是 decision。', 'The established family form is decision.')
    ]),

    lesson(en, 'suffix-sound-stress', '后缀会改变发音和重音', 'Suffixes can change sound and stress', '-tion/-sion · 重音移动 · 词族发音', '-tion/-sion · stress shift · family pronunciation', [
      ['-tion 常读 /ʃən/；-sion 的读音需随具体词掌握。', '-tion commonly sounds /ʃən/; the sound of -sion depends on the word.'],
      ['部分派生后缀会引起单词重音移动。', 'Some derivational suffixes cause the word stress to shift.'],
      ['同一词族中字母和音节可能随词性改变，听音和拼写要一起记。', 'Letters and syllables may change across a family, so learn sound and spelling together.']
    ], [
      e('action /ˈækʃən/ · education /ˌedʒuˈkeɪʃən/', 'sound', '-tion 构成清晰的 /ʃən/ 音节。', '-tion forms a clear /ʃən/ syllable.'),
      e('PHOtograph → phoTOGraphy', 'sound', '加 -y 后重音位置发生变化。', 'Stress shifts after the suffix in photography.'),
      e('exPLAIN → explaNAtion', 'sound', 'explain 与 explanation 的重音和词干发音都需成组掌握。', 'explain and explanation should be learned together for stress and stem sound.')
    ], [
      q('action 末尾 -tion 通常读？', 'How is final -tion commonly pronounced in action?', '/ʃən/', '/taɪn/', 'A', '-tion 常读 /ʃən/。', '-tion commonly sounds /ʃən/.'),
      q('photograph 和 photography 的重音？', 'What happens to stress from photograph to photography?', ['可能移动', 'it can shift'], ['永远不变', 'it never changes'], 'A', '派生后重音发生移动。', 'Stress shifts in the derivative.'),
      q('学习 explain/explanation 最可靠的方法是？', 'What is the best way to learn explain/explanation?', ['连同拼写和发音成组记', 'learn spelling and sound as a family'], ['只按字母逐个拼', 'rely only on letter-by-letter spelling'], 'A', '词族应结合拼写、重音和读音学习。', 'Learn the family with spelling, stress and pronunciation.')
    ]),

    lesson(en, 'layered-derivation', '一个词可以叠加多层词缀', 'Words can contain several affix layers', '构词顺序 · 最外层 · 派生后再屈折', 'Order · outer layer · derivation before inflection', [
      ['多层构词要按实际生成顺序理解，不是所有词缀都能任意组合。', 'Interpret layered words by their actual derivational order; affixes cannot combine freely.'],
      ['最外层后缀常直接决定当前词性。', 'The outermost suffix often determines the current word class.'],
      ['派生形成词干后，还可以再添加复数、过去式等屈折词尾。', 'After derivation forms a stem, inflection such as plural or past can be added.']
    ], [
      e('nation → national → international', 'structure', '先加 -al 形成形容词 national，再加 inter-。', 'First -al derives national; then inter- forms international.'),
      e('care → careful → carefully', 'structure', '最外层 -ly 使 carefully 成为副词。', 'Outermost -ly makes carefully an adverb.'),
      e('teach → teacher → teachers', 'structure', '先派生 teacher，再用 -s 表复数。', 'First derive teacher, then add plural -s.')
    ], [
      q('carefully 的当前词性主要由什么提示？', 'What most directly signals the class of carefully?', ['最外层 -ly', 'the outermost -ly'], ['最里面 care', 'the innermost care'], 'A', '最外层 -ly 提示副词。', 'Outermost -ly signals an adverb.'),
      q('international 的合理构词顺序是？', 'What is a reasonable build order for international?', 'nation → national → international', 'inter → internat → international', 'A', '先形成 national，再添加 inter-。', 'national forms before inter- is added.'),
      q('teachers 中最后的 -s 是？', 'What is final -s in teachers?', ['复数屈折词尾', 'a plural inflection'], ['表示职业的派生后缀', 'a derivational occupation suffix'], 'A', '-er 派生职业名词，-s 再标复数。', '-er derives the noun and -s marks plural.')
    ]),

    lesson(en, 'word-inference', '用构词法推断生词，但不要过度猜', 'Infer new words without overguessing', '词性位置 · 词缀方向 · 语境校验', 'Class slot · affix clue · context check', [
      ['先用句法位置判断所需词性，再观察后缀验证。', 'First infer the required word class from syntax, then verify it with the suffix.'],
      ['前缀和词根通常给出意义方向，不一定能给出完整词义。', 'A prefix and root usually give a meaning direction, not the full lexical meaning.'],
      ['最后必须用上下文和词典校验；不要把每个单词都强行拆成现代可用词缀。', 'Finally check context and a dictionary; do not force every word into productive modern parts.']
    ], [
      e('The new policy improved safety.', 'structure', 'improved 后需要名词作宾语，-ty 也提示 safety 是名词。', 'improved needs an object noun, and -ty also signals safety as a noun.'),
      e('The machine is reusable.', 'structure', 're- 给出“再次”，-able 给出“可以被”，合起来指可重复使用。', 're- suggests again and -able capable of being: reusable.'),
      e('understand ≠ under + stand 的简单相加', 'structure', '现代词义不能可靠地从 under 和 stand 的字面意义直接推出。', 'The modern meaning cannot be reliably composed from literal under and stand.')
    ], [
      q('The project was a great ___. (succeed)', 'Complete “The project was a great ___.” (succeed)', 'success', 'successful', 'A', 'a great 后需要名词。', 'A noun is required after a great.'),
      q('reusable 最接近？', 'What does reusable most nearly mean?', 'can be used again', 'cannot be used', 'A', 're-＋use＋-able 给出“可再次使用”。', 're- + use + -able gives “can be used again.”'),
      q('遇到看似可拆但意义不确定的词，最好？', 'What should you do when a possible split gives an uncertain meaning?', ['结合语境并查词典', 'check context and a dictionary'], ['只按字面词缀猜到底', 'trust a literal affix guess only'], 'A', '构词推断必须由语境和词典校验。', 'Word-building inference must be checked by context and a dictionary.')
    ])
  ];

  if (lessons.length) lessons[0].narration = Object.assign({}, FIRST_LESSON_NARRATION);
  lessons.slice(1).forEach((item) => {
    item.narration = REMAINING_NARRATIONS[item.id];
  });

  const coreCount = 13;
  const course = lessons.map((item, index) => Object.assign({}, item, {
    no: String(index + 1).padStart(2, '0'),
    level: index < coreCount ? 'core' : 'advanced'
  }));
  const sectionSpecs = [
    ['formation-foundation', '构词原理与词性判断', 'Foundations and word-class choice', '理解词的组成、派生与屈折，并根据句法位置选择词形。', 'Understand word parts, derivation and inflection, then choose forms by syntactic slot.', ['word-parts','derivation-inflection','word-class-slots']],
    ['formation-prefixes', '前缀系统', 'Prefix system', '按否定、时间、重复、错误和程度理解常用前缀及变体。', 'Organize common prefixes and variants by negation, time, repetition, error and degree.', ['negative-prefixes','meaning-prefixes','prefix-assimilation']],
    ['formation-suffixes', '后缀与词性转换', 'Suffixes and word-class change', '系统掌握人物、名词、形容词、副词和动词后缀。', 'Master person, noun, adjective, adverb and verb suffixes.', ['person-noun-suffixes','abstract-noun-suffixes','adjective-suffixes','participial-adjectives','adverb-suffix','verb-suffixes']],
    ['formation-conversion-compounds', '转化与合成', 'Conversion and compounding', '理解零派生、中心词、合成词拼写和复数规则。', 'Understand zero derivation, compound heads, spelling and plural formation.', ['conversion','compounds']],
    ['formation-advanced-use', '拼写、发音与综合推断', 'Spelling, sound and integrated inference', '处理后缀拼写、重音、多层构词和生词推断边界。', 'Handle suffix spelling, stress, layered derivation and responsible word inference.', ['suffix-spelling','suffix-sound-stress','layered-derivation','word-inference']]
  ];
  const assignedIds = sectionSpecs.flatMap((section) => section[5]);
  const courseIds = course.map((lesson) => lesson.id);
  if (assignedIds.length !== courseIds.length || new Set(assignedIds).size !== assignedIds.length || courseIds.some((id) => !assignedIds.includes(id)) || assignedIds.some((id) => !courseIds.includes(id))) throw new Error('Invalid section coverage: Word Formation');
  const sections = sectionSpecs.map((section) => ({ id: section[0], title: pick(en, section[1], section[2]), copy: pick(en, section[3], section[4]), lessonIds: section[5].slice(), lessonCount: section[5].length }));
  return {
    title: pick(en, `构词法 · ${course.length} 节微课`, `Word Formation · ${course.length} lessons`),
    copy: pick(en, '从词的零件和词族出发，学会判断词性、拼写变化并推断生词。', 'Start from word parts and families, then choose word class, manage spelling and infer new words.'),
    course,
    sections,
    groups: [
      { id: 'core', title: pick(en, `核心必学 · ${coreCount} 节`, `Core · ${coreCount} lessons`), copy: pick(en, '中学词形转换和阅读推断必须掌握。', 'Essential for school word-form tasks and reading.'), lessons: course.slice(0, coreCount) },
      { id: 'advanced', title: pick(en, `进阶挑战 · ${course.length - coreCount} 节`, `Advanced · ${course.length - coreCount} lessons`), copy: pick(en, '处理拼写、读音、多层构词和推断边界。', 'Spelling, sound, layered derivation and inference limits.'), lessons: course.slice(coreCount) }
    ]
  };
}

module.exports = { buildWordFormationCourse };
