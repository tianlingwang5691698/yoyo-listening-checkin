const pick = (en, zh, english) => en ? english : zh;
const BUILD_TARGET = typeof GRAMMAR_TARGET === 'undefined' ? 'all' : GRAMMAR_TARGET;
const VERB_FIRST_LESSON_NARRATION = {
    id: 'verb:verb-jobs', version: 'v3', lengthText: '492 字 · 约 2 分钟',
    text: `一句话像一小段视频，总得告诉我们“发生了什么”。有人跑，有人知道答案，汤尝起来很甜。负责把这些动作或状态说出来的词，叫动词。动词不一定是跑、跳这种看得见的动作，know、like、is 也在告诉我们一种状态。<#0.8#>\n先听最短的一句。<#0.4#>Birds fly。<#0.8#>Birds 告诉我们谁，fly 告诉我们鸟做什么。把 fly 拿掉，只剩“鸟”，事情就没说完整。所以 fly 是这句话最关键的发动机，语法上叫谓语核心。把很多只鸟换成一只鸟，就要说。<#0.4#>A bird flies。<#0.7#>fly 变成 flies，说明这个核心会跟着主语和时间调整形式。<#0.8#>\n再听。<#0.4#>I know the answer。<#0.7#>know 不是能看到的动作，却说明“我知道”。它后面的 the answer 补上“知道什么”。有些动词后面要接一个对象，有些不需要。<#0.7#>\nThe soup tastes good 里，tastes 也不是说“汤在品尝”，它像一座桥，把 the soup 和 good 连起来，说明汤的味道很好。这类词叫系动词。<#0.8#>\n找动词时，先问这句话到底在说谁做了什么，或谁处在什么状态；再找会跟着主语、时间发生变化的那个核心；最后看它后面是否还缺“什么”或“怎么样”。这样比看到带动作意思的词就圈，更可靠。`
};
const NUMERAL_FIRST_LESSON_NARRATION = {
    id: 'numeral:numeral-essence', version: 'v3', lengthText: '473 字 · 约 2 分钟',
    text: `看到数字，先别急着把它翻成几。生活里，同一个数字可能在回答三个完全不同的问题：有多少，排第几，或者是哪一个编号。用来表达这些数字关系的词，语法上叫数词。<#0.8#>\n先看。<#0.4#>Three students arrived。<#0.8#>这里 three 回答“来了多少人”，所以是数量。真正站在“谁来了”这个位置上的，是整个 Three students，不是 three 单独一个词。再听。<#0.4#>Mia came second。<#0.8#>second 不是说 Mia 来了两次，而是说她排第二，所以它表示顺序。<#0.7#>\n还有一种很容易混。Take Bus 18 里的 18，不是在说有十八辆公交车，而是在告诉你坐哪一路。Room 4 也不是四个房间，而是四号房。这里的数字像姓名牌，负责编号。<#0.8#>\n把 three books、the third book、Book 3 放在一起听：three 是三本，third 是第三本，3 是三号书。数字看起来接近，作用却不同，读法有时也不同。<#0.7#>\n判断数词，先把数字所在的小短语圈出来，然后只问：它回答“多少”“第几”还是“哪一个编号”？最后再看整个短语在句中负责谁、什么或补充什么信息。不要一看到阿拉伯数字，就默认它在表示数量。`
};
if (BUILD_TARGET === 'all' || BUILD_TARGET === 'numeral') {
  NUMERAL_FIRST_LESSON_NARRATION.text = NUMERAL_FIRST_LESSON_NARRATION.text.replace('把 three books、the third book、Book 3 放在一起听：three 是三本，third 是第三本，3 是三号书。', '把这三个画面放在一起听：three 是数量，second 是顺序，18 是公交线路编号。');
  NUMERAL_FIRST_LESSON_NARRATION.lengthText = `${NUMERAL_FIRST_LESSON_NARRATION.text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '').length} 字 · 约 2 分钟`;
}
const ARTICLE_FIRST_LESSON_NARRATION = {
    id: 'article:article-essence', version: 'v3', lengthText: '468 字 · 约 2 分钟',
    text: `你说“把书给我”，对方可能会问：哪本书？英语放在名词前面的 a、an、the，常常就是在帮听者判断，你说的是随便一个、刚出现的一个，还是双方都能认出的那个。这几个小词叫冠词。它们的重点不是中文怎么翻，而是听者能不能找到你指的对象。<#0.8#>\n听一个小故事。<#0.4#>I saw a dog。<#0.6#>The dog followed me。<#0.8#>第一句用 a dog，是从“狗”这一类里带出一只，听者第一次听见，还不知道具体是哪只。第二句再说 the dog，听者会自然对上刚才那只狗。不是因为 the 永远等于“这个”，而是此时双方已经知道说的是谁。<#0.8#>\n再听。<#0.4#>Dogs need care。<#0.8#>Dogs 前面什么冠词都没有，这种情况叫零冠词。这里不是说某几只狗，而是在谈狗这一类动物。如果换成 The dogs need care，听者通常会去找现场或前文中能认出的那几只狗。<#0.8#>\na 和 an 都是在带出一个对象，选择时还要听后面开头的声音；the 是提醒听者“你应该能认出来”；零冠词有时是在泛谈一类。实际判断时，先看名词能不能数、是单数还是复数；再问这是新带出的、已经能认出的，还是整类事物；最后才选 a、an、the 或不加冠词。`
};
if (BUILD_TARGET === 'all' || BUILD_TARGET === 'article') {
  ARTICLE_FIRST_LESSON_NARRATION.text = ARTICLE_FIRST_LESSON_NARRATION.text.replace('如果换成 The dogs need care，听者通常会去找现场或前文中能认出的那几只狗。', '如果给 dogs 加上 the，听者通常会去找现场或前文中能认出的那几只狗。');
  ARTICLE_FIRST_LESSON_NARRATION.lengthText = `${ARTICLE_FIRST_LESSON_NARRATION.text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '').length} 字 · 约 2 分钟`;
}
const narration = (id, text) => ({
  id,
  version: 'v1',
  text,
  lengthText: `${text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '').length} 字 · 约 2 分钟`
});
const VERB_NARRATIONS = {
  transitivity: narration('verb:transitivity', `想象你只听到“她打开了”，你多半会追问：打开了什么？有些动词说完后，后面必须跟一个对象，意思才完整；有些动词自己就能把事情说完。<#0.8#>
She opened the window。<#0.8#>opened 的动作直接落在 the window 上，the window 叫宾语。像 open 这样可以直接带宾语的用法，叫及物。再听 The baby cried。<#0.7#>宝宝哭了，意思已经完整，不需要再补“哭了什么”。这种不直接带宾语的用法，叫不及物。<#0.8#>
We arrived at noon 里，at noon 说明到达的时间。它前面有介词 at，整块是时间补充，不是 arrive 直接带的宾语。判断时，先把时间、地点等补充暂时拿掉，再问动词后是否还必须回答“谁或什么”。能直接接上这个答案是及物；意思已完整，或必须先加介词，就不是直接宾语。`),
  linking: narration('verb:linking', `闻一口花，你说 The flower smells sweet。<#0.8#>这不是“花在闻甜味”，而是“花闻起来很香甜”。smells 没有把动作打到 sweet 上，它像一座桥，把 flower 和 sweet 连起来，sweet 在说明花的性质。<#0.8#>
再看 She is a doctor。<#0.7#>a doctor 告诉我们 She 是谁。The leaves turned yellow 里，yellow 告诉我们叶子变成什么样。这些放在桥后面、回头说明主语身份、性质或状态的内容，叫表语；be、sound、smell、feel、become、turn 等在这种用法里叫系动词。<#0.8#>
要注意，同一个动词也可能换工作。She tasted the soup 里，tasted 是真正去品尝，the soup 是宾语；The soup tastes good 里，tastes 只把汤和 good 连起来。判断时，把动词后面的内容和主语连成“主语是或变得怎样”。如果意思成立，后面是在说明主语，通常就是系动词加表语。`),
  'aux-modal': narration('verb:aux-modal', `有时动作本身没变，说话人只是想加上“不”、“正在”、“必须”这些信息。英语会在主要动词前放一个帮手，让它负责结构或语气。<#0.8#>
She does not like coffee。<#0.8#>真正表示“喜欢”的是 like，does 帮它安放 not，同时承担现在时和三单信息。这种帮动词完成否定、疑问、时态或语态的词，叫助动词。They are working 里，are 帮 working 表示动作正在进行。<#0.8#>
You must finish today。<#0.7#>finish 是完成，must 把“必须”这种强烈态度加进来。这类表示能力、允许、义务、推测的帮手，叫情态动词。情态动词后的主要动词用原形，所以是 must finish，不是 must finishes。判断时，先找真正说动作的词，再看前面的词是在帮它搭结构，还是加入说话人的判断。两者要和主要动词一起看成完整谓语。`),
  'finite-forms': narration('verb:finite-forms', `同一个“玩”，遇到不同的人和时间，样子会变。你说 I play，换成她就是 She plays，换到昨天又是 They played。这些变化不是装饰，而是在告诉我们“谁”和“什么时候”。<#0.8#>
He is ready 和 They are ready 更明显。<#0.7#>主语从一个人变成多个人，be 从 is 变成 are。能承担时间，并在需要时跟主语人称和单复数配合的动词部分，叫限定动词。它让一组词真正成为一个有时间落点的小句。<#0.8#>
再看 She wants to leave。<#0.7#>换到过去时，wants 变成 wanted，to leave 仍然保持这个样子。所以这句只有 wants 负责时间和主语配合，to leave 只补充想做什么，不是第二个限定谓语。实际判断时，先把句子分成一个个小句，再尝试换主语或换到过去。找出承担变化的动词部分，每个小句通常只有一个这样的核心。`),
  'double-object-complement': narration('verb:double-object-complement', `听到 Mum gave me a gift，脑中要出现一次传递：妈妈把礼物交到我手上。<#0.8#>给了什么？a gift。给了谁？me。动词后同时放着接收者和传递的东西，这叫双宾语。me 是间接宾语，a gift 是直接宾语。<#0.8#>
这句也可以说 Mum gave a gift to me。<#0.7#>这时 a gift 仍是直接宾语，to me 是介词短语，把礼物的去向说出来。give、send、show 常用 to；buy、make 说“为某人做或买”时常用 for。<#0.8#>
再看 They painted the door red。<#0.7#>the door 是被漆的对象，red 不是又一个被漆的东西，而是说门最后变成什么样。the door 和 red 之间能连成“门是红的”，red 叫宾语补足语。区分时，先问是否有“给谁什么”的传递关系；如果没有，再把宾语和后面内容连成小句。后面是在说明宾语是谁、怎样或做什么，就是宾补，不是第二个宾语。`),
  'verb-five-forms': narration('verb:verb-five-forms', `一个动词像一个会换工服的人。work、works、worked、worked、working 意思都和“工作”有关，但它们在句子里接的任务不同。<#0.8#>
work 是原形，情态动词后会用 can work。<#0.7#>works 用在一般现在时的第三人称单数。worked 可以是过去式，也可以是过去分词，要看它是单独说过去，还是跟 have 或 be 组合。working 常进入进行结构，也能当非谓语。<#0.8#>
不规则动词更能看出区别。<#0.6#>go、goes、went、gone、going 里，went 是过去式，gone 是过去分词，不能在 has 后面说 has went。write 也要记成 write、writes、wrote、written、writing。判断时，不要只背中文词义，先看前面有没有情态动词、have 或 be，再看主语和时间。每学一个新动词，就用“原形、三单、过去式、过去分词、-ing”五格记录，这样才知道它能穿哪件工服。`),
  'third-person-form': narration('verb:third-person-form', `每天的习惯，你说 I play tennis，主语换成 She，动词就要留下一个小标记：She plays tennis。<#0.8#>这个 -s 不是复数，而是一般现在时里，主语为 he、she、it 或一个人事物时的动词标记，叫第三人称单数形式。<#0.8#>
大多数动词直接加 s，play 变 plays，run 变 runs。<#0.6#>watch、wash、fix、go 这类结尾，为了读起来顺口，通常加 es：watches、washes、fixes、goes。辅音字母加 y 结尾的 study，要把 y 变 i 再加 es，成为 studies；have 则直接变 has。<#0.8#>
拼对了还要听读音。likes 的词尾读 /s/，plays 和 runs 读 /z/，watches 读 /iz/，多出一个音节。不用先背一长串术语，可以用嘴巴感受：前面已经是 s、sh、ch 这类嘶声，就需要 /iz/ 把词尾送出来。实际做题先确认是一般现在时和三单主语，再看动词结尾决定 s、es 或 ies，最后读一遍检查发音。`),
  'past-forms': narration('verb:past-forms', `要讲昨天的事，work 通常要穿上 -ed，变成 worked。<#0.8#>大多数规则动词就这样表示过去；如果原词已经有 e，live 只加 d，成为 lived，不会写成 liveed。<#0.8#>
有些词在加 -ed 前要整理一下词尾。<#0.6#>study 的 y 前是辅音字母，所以变成 studied。stop 只有一个重读音节，末尾是“辅音、元音、辅音”的紧结构，要双写 p，成为 stopped。但 open 的重音不在最后，通常不双写。<#0.8#>
更需要小心的是 go 和 see。go 的过去式是 went，过去分词是 gone；see 是 saw 和 seen。过去式可以自己做谓语，过去分词常跟 have 或 be 组合，两者不能因为都和过去有关就混用。实际书写时，先判断动词是否规则；规则动词再检查 e、辅音加 y 和重读闭音节；不规则动词则要把“原形、过去式、过去分词”成组调出来。`),
  'subject-verb-agreement': narration('verb:subject-verb-agreement', `一群人踢球和一个男孩踢球，动作一样，但一般现在时的动词要和真正的主角对上号。The boy plays football 里，the boy 是一个人，所以 play 变 plays。<#0.8#>
再看 The boy with his friends plays football。<#0.8#>动词前最近的 friends 是复数，但这句的核心主角仍然是 the boy。with his friends 只补充他和谁一起，不会把主角变成多数。因此仍然用 plays。这种谓语形式跟主语人称和单复数配合的关系，叫主谓一致。<#0.8#>
Tom and Jack play football 则不同。<#0.7#>and 把 Tom 和 Jack 都放进主语，现在是两个人，所以用 play。最常见的错误是只盯着动词前最近的名词。判断时，先框出完整主语，再找它的中心；把 with、of、together with 后的补充暂时遮住；最后看中心是单数，还是由 and 真正连成复数。先找谁在掌控谓语，再选动词形式。`),
  'present-simple': narration('verb:present-simple', `水在一百摄氏度沸腾，不是只在你说话的这一秒发生。Water boils at 100 degrees。<#0.8#>这句把事情当作稳定事实来说。She walks to school every day 则是反复出现的习惯。这种说事实、状态和常规习惯的视角，叫一般现在时。<#0.8#>
主语是 he、she、it 或一个人事物时，肯定句的实义动词要用三单，所以是 She walks。<#0.7#>但变疑问时要说 Does he like music？Does 已经拿走三单标记，后面用 like，不是 likes。否定句 He does not like music 也是同一道理。<#0.8#>
The train leaves at seven 看似未来，却仍用一般现在时，因为列车时刻表是既定安排，说话人把它当作稳定事实。判断时不要只找 every day。先问说话人是否把内容当成稳定状态、反复习惯或固定时刻表；再看主语决定动词原形还是三单；有 do 或 does 时，实义动词恢复原形。`),
  'present-progressive': narration('verb:present-progressive', `现在看一眼宝宝，他正在睡觉。The baby is sleeping now。<#0.8#>这句不是说宝宝平时有睡觉的习惯，而是把镜头对准此刻正在展开的过程。is 负责现在时和主语配合，sleeping 展示动作正在进行，合起来就是现在进行时。<#0.8#>
这个镜头不一定只有一秒。<#0.6#>I am staying with my aunt this week 表示这一周的临时安排，说话时我可能正在学校，但这个阶段仍在持续。The weather is getting warmer 则把气温越来越高的变化展开给我们看。<#0.8#>
结构是 am、is 或 are，加动词的 -ing 形式，两部分都不能丢。只写 The baby sleeping 还没有为这个小句装上现在时。判断时，先问是否在拍一个此刻或当前阶段的动态镜头，还是在陈述稳定习惯；如果是动态镜头，再按主语选 am、is、are，并检查后面是否用 doing。`),
  'past-simple': narration('verb:past-simple', `相册里有一张去年苏州的照片。We visited Suzhou last year。<#0.8#>这次旅行放在已经结束的过去时间里，说话人不是在强调它和现在的连接。visited 用过去式把整件事放回了过去，这叫一般过去时。<#0.8#>
否定时，过去的标记会移到 did 上。<#0.6#>She did not see him yesterday 里，did 已经表示过去，所以后面是 see，不是 saw。疑问句 Did you finish the work 也一样，Did 放到主语前，finish 恢复原形。一句里不需要 did 和过去式同时重复标记过去。<#0.8#>
常见的 last year、yesterday、two days ago 能帮助定位，但不是只要看到它们就不思考。判断时，先画一条时间线，看事情是否完全落在已结束的过去区间；肯定句用动词过去式；有 did 的否定或疑问句，实义动词立即回到原形。`),
  'future-forms': narration('verb:future-forms', `电话响了，你当场决定“我今晚给你回电话”，可以说 I will call you tonight。<#0.8#>will 常把临时决定、承诺或当下的预测指向未来，后面用动词原形。<#0.8#>
抬头看见乌云已经压下来，你说 It is going to rain。<#0.7#>这不是凭空猜测，而是根据眼前迹象判断。be going to 也可以表示已经有的计划。注意 be 要按主语变成 am、is 或 are。<#0.8#>
如果时间和对方都已经安排好，会说 We are meeting the teacher tomorrow。现在进行时放在这里，不是说此刻正在见老师，而是把未来会面当作已排进日程的事。选择时，先问决定是否刚刚做出，是就用 will；再看是否有早已存在的计划或眼前迹象，可用 be going to；如果具体安排已落定，就考虑现在进行时。不要只看 tomorrow，要看未来是怎样被说话人想象的。`),
  'five-sentence-patterns': narration('verb:five-sentence-patterns', `动词像游戏里不同形状的插槽，有的自己就能完成画面，有的后面必须接一块或两块内容。Birds fly 说完已经成立，只有主语和谓语，叫 SV。<#0.8#>
She is kind 里，is 把 She 和 kind 连起来，kind 说明她怎样，这是 SVC，也就是主系表。<#0.7#>I like music 的 like 直接需要“喜欢什么”，music 是宾语，这是 SVO。Mum gave me a gift 有接收者 me 和东西 a gift，这是 SVOO。<#0.8#>
They made me happy 最容易混。me 是被影响的人，happy 说明 me 最后的状态，两者能连成“我很开心”，所以 happy 是宾补，整体是 SVOC。判句型先找动词，再问它后面必须补“主语怎样”、一个对象、接收者加东西，还是对宾语的说明。暂时去掉时间地点，留下的必需插槽就决定句型。`),
  'auxiliary-system': narration('verb:auxiliary-system', `be、do、have 单独出现时有自己的意思，但它们也常做幕后助手，帮主要动词搭出不同结构。They are working 里，are 没有表示“是”，它和 working 组合，把动作展示为正在进行。<#0.8#>
The door was closed 里，be 加过去分词 closed，让门成为动作承受者，这是被动。<#0.7#>Do you know him 里，know 本身没有可以移到主语前的助手，所以 do 来帮它变疑问。否定句 I do not know 也靠 do 安放 not。<#0.8#>
She has finished the task 里，has 加过去分词 finished，把任务的完成和现在连起来，这是完成体。判断这三个词的工作，不要只看词形。先看它后面跟的是 doing、done 还是动词原形；be 加 doing 表进行，be 加 done 表被动，have 加 done 表完成，do 则常帮一般时实义动词做疑问、否定或强调。`),
  'modal-meanings': narration('verb:modal-meanings', `同一个“去”，前面加不同小词，说话人的态度就变了。You can go 可能是你有能力去，也可能是你被允许去。You must go 则带着强烈必要性。<#0.8#>
can 和 could 常说能力或请求允许，could 用在请求中通常更委婉。<#0.7#>must 可以表说话人认为必须，have to 常突出外部规定或客观需要，should 更像建议。这些词叫情态动词或情态表达，核心是把说话人的判断加到动作上。<#0.8#>
它们还能表推测。He may be at home 是可能在家；He must be at home 不是命令他在家，而是根据线索推断“他肯定在”；He can't be at home 表示“不可能在”。判断时，先看语境在说能力、允许、义务、建议还是推测，再根据态度强弱选词。最后检查：can、must、may、should 后面用动词原形，不加 to，也不变三单。`),
  'perfect-vs-past': narration('verb:perfect-vs-past', `你说 I have visited Beijing twice，重点是到现在为止有过两次北京经历，并没有把它钉在某一个已结束的时间。<#0.8#>这种把过去的事与现在经验或结果连起来的说法，用 have 或 has 加过去分词，叫现在完成时。<#0.8#>
She has lived here since 2020 中，since 给出起点，居住从二零二零年一直延伸到现在。<#0.7#>for 则给出延续多久。如果这种延续还没有结束，要选能持续的动词表达，不能用瞬间动作硬拉一段时间。<#0.8#>
We visited Beijing last year 则把旅行放在已经结束的 last year，所以用一般过去时。两者的分界不是“事情发生过没有”，而是说话人是否把镜头连到现在。判断时，先找 yesterday、last year 这类已结束时间，有就优先考虑一般过去时；没有时，再问是否在说截至现在的经历、结果或延续。`),
  'passive-tenses': narration('verb:passive-tenses', `工厂介绍一件产品时，往往更关心“它是怎么被制造的”，而不是谁在操作。It is made here 用 is 加过去分词 made，把承受动作的 it 放在主语位置，这是现在时被动。<#0.8#>
时间变化时，主要变的是 be。<#0.7#>was made 是过去制造，will be made 是将被制造。如果镜头正对着维修过程，要说 The bridge is being repaired，be 加 being 加过去分词，这是进行时被动。<#0.8#>
如果重点是已经完成，可以说 The task has been finished。has 负责现在完成，been 建立被动，finished 表示具体动作。不要看到三个动词形式就分成三个谓语，它们是一条链。判断时，先确认主语是动作承受者，再确定一般、进行还是完成；最后按顺序搭骨架：一般被动用 be done，进行被动用 be being done，完成被动用 have been done。`),
  'future-in-clauses': narration('verb:future-in-clauses', `明天是否下雨还没确定，但你可以说 If it rains, we will stay home。<#0.8#>两部分都谈未来，英语却不在 if 后再放 will。if 已经把 rains 标成未来条件，主句 will stay 再说条件成立后的结果。<#0.8#>
时间从句也是同样。<#0.6#>I will call you when I arrive 里，arrive 形式上是一般现在时，意思却由 when 指向未来到达的那一刻。as soon as、before、after、until 引出的未来时间从句，通常也这样处理。<#0.8#>
Even if he is busy, he will help 表示即使将来忙，也会帮忙。even if 引出让步条件，从句仍用 is，不用 will be。这个简称“主将从现”，但不能看到从句就套。判断时，先确认 if、when、until、even if 引出的是真实未来条件、时间或让步；是的话，从句用一般现在时表未来，will 通常留在主句。`),
  infinitive: narration('verb:infinitive', `说“学英语需要时间”，英语可以把动作“学”打包成一件事：To learn English takes time。<#0.8#>To learn English 整块站在主语位置，takes 才是负责时间的谓语。to 加动词原形叫不定式，它有动作意思，却能整体去做别的句子工作。<#0.8#>
I need a pen to write with 里，to write with 说明需要一支什么用途的笔，它放在 pen 后面修饰 pen。<#0.7#>介词 with 不能丢，因为普通关系是 write with a pen。She got up early to catch the bus 里，to catch the bus 回答“为什么早起”，表示目的。<#0.8#>
不定式也能放在动词后补充“想做、决定做”的内容，但不能因为中文有“去做”就乱加 to。判断时，先找整句真正承担时间的谓语，再把 to do 整块圈出来；问它在表示一件事、修饰前面名词，还是回答目的。先找整块的工作，再确定术语。`),
  gerund: narration('verb:gerund', `Reading helps us 不是一句缺少主语的命令。<#0.8#>Reading 在这里表示“阅读这件事”，整体站在主语位置，helps 才是谓语。动词加 -ing 后保留动作意思，同时像名词一样做主语、宾语或表语，这种用法叫动名词。<#0.8#>
She enjoys dancing 里，dancing 是 enjoys 的宾语，表示她享受跳舞这项活动。<#0.7#>enjoy、finish、mind、avoid、practice 后常选 doing，这是动词自己选择的补足方式，不能只把中文“做”换成任意形式。<#0.8#>
He left without saying goodbye 里，without 是介词，介词后面要放能当名词性内容的 saying goodbye，不用 to say。即使介词本身是 to，如 look forward to，后面也用 doing。判断时，先看 -ing 整块是否在句中代表一项活动；再看它是主语、动词宾语还是介词宾语。若前面是介词，直接优先检查 doing。`),
  'ing-forms': narration('verb:ing-forms', `给动词加 -ing 时，大多数很直接：work 变 working，play 变 playing。<#0.8#>但有些词尾如果原样保留，会让拼写和发音不匹配，所以加之前要做一个小调整。<#0.8#>
write 末尾的 e 不发音，加 -ing 时去掉 e，成为 writing。<#0.7#>run 只有一个重读音节，词尾是紧的“辅音、元音、辅音”结构，要双写 n，成为 running。这样能保住原来的短元音。open 的重音不在末音节，通常不双写。<#0.8#>
lie 和 die 又是另一类，末尾 ie 先变成 y，再加 ing，得到 lying 和 dying，不写 lieing。实际拼写可以用四步：先看是否为 ie 结尾，是就变 y；再看是否有不发音 e，有就通常去掉；然后检查末音节是否重读且需要双写；都不是，就直接加 -ing。`),
  phrasal: narration('verb:phrasal', `老师说 turn on the light，turn 不是让你转身，turn on 合在一起才是“打开”。<#0.8#>动词和后面的小词组成一个新意思，这种组合常叫短语动词。学它时不能只背 turn 和 on 的单独中文，要连同宾语位置一起学。<#0.8#>
turn on 在这个意思下可以拆开，所以 turn on the light 和 turn the light on 都可以。<#0.7#>但宾语换成 it 时，只能说 turn it on，不说 turn on it。短小代词必须放在动词和小品词中间，这是可分短语动词的高频位置。<#0.8#>
look after the child 却不能把 the child 塞进 look 和 after 中间，因为 after 在这里带着自己的介词宾语，这种组合不可分。判断时，先确认两个词是否共同形成一个意思；再查这个组合是否可分；最后把宾语换成 it 测一次。如果是可分结构，it 必须放中间。`),
  voice: narration('verb:voice', `桌上有一封信，可以先说写信人：Tom wrote the letter。<#0.8#>也可以把镜头转向信：The letter was written by Tom。事情没变，只是被关注的参与者换了。第一句由做动作的人做主语，叫主动语态；第二句由承受动作的 letter 做主语，叫被动语态。<#0.8#>
被动骨架是 be 加过去分词。was 负责过去时，written 说明 letter 承受 write 的动作。<#0.7#>by Tom 只在需要交代写信者时出现。English is spoken worldwide 里，具体谁说不重要，所以不用 by people。<#0.8#>
改被动时，先找主动句中承受动作的宾语，把它放到主语位置；再保留原来时间，选对 be 的形式；然后把实义动词变过去分词。最后问施动者是否未知、不重要或已明显，是的话省掉 by 短语。`),
  'tense-aspect': narration('verb:tense-aspect', `同一个“学英语”，可以选三种镜头。I study English every day 把它当日常习惯；I am studying now 把此刻过程放大；I have finished my homework 把过去完成的事连到现在结果。<#0.8#>这说明时态不只标“过去、现在、未来”，还展示说话人如何看动作。<#0.8#>
一般体常把事当作事实或完整事件，进行体展示过程，完成体建立较早动作与当前参照点的连接。<#0.7#>now、every day、already 只是线索，不是按下就必然得出某时态的按钮。<#0.8#>
判断时先定位参照时间，再问想展示稳定事实、正在进行的过程，还是已完成且与参照点有关的结果。最后才用时间标志检查。先选镜头，再选结构，比只背标志词更稳，也更能解释真实句子。`),
  nonfinite: narration('verb:nonfinite', `She wants to leave 里有两个动作意思，但只有 wants 会随主语和时间变化，to leave 只把“离开”打包成她想做的事。<#0.8#>Swimming is good exercise 里，Swimming 表示一项活动，is 才负责时间。The broken window 里，broken 说明 window 承受了破坏。<#0.8#>
这些保留动作意思，却不独立让小句获得时态和主谓一致的形式，叫非谓语。<#0.7#>to do 常把动作看成目标、目的或未展开的事；doing 常把它看成活动或进行画面；done 常带被动或完成视角。<#0.8#>
判断时，先找每个小句中真正承担时间的谓语；再圈出剩下的 to do、doing、done；最后问它整体在句中做主语、宾语、修饰语还是目的说明。这一节只负责分清谓语和非谓语边界，后面再分别学三种形式。`),
  'past-progressive': narration('verb:past-progressive', `昨晚八点，你像把摄像机放回过去：I was reading at eight last night。<#0.8#>was 把镜头定位在过去，reading 展示当时尚未结束的过程。was 或 were 加 doing，叫过去进行时。<#0.8#>
They were playing when it began to rain 里，玩耍是正在展开的背景，下雨是途中发生的较短事件。<#0.7#>when 常把短事件插入持续背景，但不是见到 when 就必须一进行一过去，还要看动作长短。<#0.8#>
While Mum was cooking, Dad was cleaning 像分屏画面，两个持续动作同时进行。判断时，先找过去参照点，再问那一刻动作是否正在中途；若有两个动作，还要看是背景与插入事件，还是两个同时持续的画面。`),
  'past-time-sequence': narration('verb:past-time-sequence', `到车站时，火车已经开走：The train had left before we arrived。<#0.8#>到达是过去参照点，had left 把开走放在它之前，所以叫“过去的过去”，结构是 had 加过去分词。<#0.8#>
He said he would return 中，said 把观察点带回过去，对当时的他来说，“回来”还在未来，所以用 would 加原形。<#0.7#>She said she was tired 里，疲惫与过去说话情境对应，所以 is 后移为 was。<#0.8#>
但转述仍成立的客观真理，不必机械后移。做题先标出过去参照点；早于它的动作考虑 had done，晚于它的过去未来考虑 would do；转述内容则问是否要保持过去视角。先排清事件先后，再选时态，不要只看某一个时间词。`),
  participles: narration('verb:participles', `The crying baby 里，宝宝正在哭，crying 和 baby 是主动关系，带着进行画面。<#0.8#>The book written by Lu Xun 里，书是 write 的承受者，written 带着被动和完成视角。doing 和 done 这样修饰名词或补充画面时，叫分词。<#0.8#>
written by Lu Xun 整块后置修饰 book，中文理解时通常前移成“鲁迅写的书”。<#0.7#>Walking home, she saw Tom 里，Walking home 不修饰某个名词，而是给整个主句补充背景。<#0.8#>
这时要问“谁在 walking”，答案必须能和主句主语 she 对上。判断时，先找分词所指的名词或逻辑主语；再问它们是主动还是被动、动作正展开还是已完成；主动进行倾向 doing，被动完成倾向 done。`),
  'causative-perception': narration('verb:causative-perception', `The joke made us laugh 表示笑话让我们笑。<#0.8#>made 的对象是 us，laugh 说明 us 做了什么。主动句里，make 和 let 后用“宾语加动词原形”，不加 to。但改成 We were made to laugh 时，to 要恢复。<#0.8#>
I saw him cross the road 把过马路当作从开始到结束的完整事件，所以用原形 cross。<#0.7#>I saw him crossing the road 只拍到他当时正在过，不说明是否看到全过程，所以用 crossing。这两种都是宾语加宾语补足语。<#0.8#>
判断时，先找 make、let、see、hear、watch 后的宾语，再问后一个动作是谁做的。若表“使让”或感知到完整过程，用原形；若镜头只落在正进行的片段，用 doing。最后检查 make 是否改被动，是的话补回 to。`),
  'gerund-infinitive-meaning': narration('verb:gerund-infinitive-meaning', `出门前想起“还要关灯”，说 remember to turn off the light；回家后回想“我记得关过了”，说 remember turning it off。<#0.8#>to do 指向当时未完成的任务，doing 指向已发生、可回想的事。<#0.8#>
He stopped smoking 是停止抽烟；He stopped to smoke 是停下原来的事，目的是抽烟。<#0.7#>doing 是被停止的事，to do 是停下后要做的新事。try restarting the computer 是试试重启这个办法；try to restart it 是努力把它重启成功。<#0.8#>
判断时不只背“某词后接 doing 或 to do”。先问动作已发生还是待完成，是原来的事还是新目的，是试验办法还是努力完成。把两个动作的先后和关系说清，再选 doing 或 to do。`),
  'nonfinite-advanced': narration('verb:nonfinite-advanced', `他希望被邀请，要说 He hopes to be invited。<#0.8#>to be invited 保留不定式，同时用 be 加过去分词表被动。being praised 也是被动，但用 doing 形式把被表扬当作一项活动或进行画面。<#0.8#>
She seems to have finished it 里，看起来是现在判断，完成任务却早于它，所以用 to have done 表示非谓语动作先发生。<#0.7#>Having finished the work, she left 也把完成工作放在离开之前。<#0.8#>
最后要问“谁在做”。Having finished 的执行者必须是主句主语 she。判断时，先看逻辑主语是执行者还是承受者，决定主动或被动；再比较非谓语与谓语动作的先后，明显早于谓语时考虑 to have done 或 having done；最后检查逻辑主语是否清楚对应。`),
  'agreement-complex': narration('verb:agreement-complex', `Either Tom or his friends are coming 有两个候选主语，either...or 常让谓语和较近的一项配合，friends 是复数，所以用 are。<#0.8#>Tom, together with his friends, is here 里，together with his friends 只是陪同信息，真正中心仍是单数 Tom，所以用 is。<#0.8#>
Everyone has a ticket 里，everyone 意思包含每一个人，语法上却逐个看待，通常按单数用 has。<#0.7#>Swimming keeps us healthy、To read every day improves your English、What he says sounds true 的主语虽然很长，却各自把一项活动或一件事当成一个整体，通常用单数谓语。<#0.8#>
判断时，or 类成对连接看就近，with 类附加信息看前面中心；everyone、each 先按单数；遇到 doing、to do 或从句作主语，先问它是否整体表示一件事。先识别主语的组装方式，再决定单复数。`),
  'special-verb-patterns': narration('verb:special-verb-patterns', `过去常晚起，现在不这样，说 He used to get up late。<#0.8#>used to 加原形表过去习惯已改变。He is used to getting up early 却是他已习惯早起，这里 to 是介词，后面用 doing。<#0.8#>
朋友快迟到了，你说 You had better leave now。<#0.7#>had better 表示带后果提醒的较强建议，后面用原形。否定说 You had better not be late，not 放 better 后，不加 to。<#0.8#>
I would rather stay home than go out 表示两个选择中更愿留家。would rather 后用原形，than 后与前面保持平行。判断时，把整个词组当信号：used to do 是过去常常，be used to doing 是习惯，had better do 是强建议，would rather do 是偏好。再检查后面是原形还是 doing。`),
  'verb-complements': narration('verb:verb-complements', `She enjoys reading 里，enjoy 把 reading 这项活动当宾语，英语选 doing，不选 to read。<#0.8#>He decided to leave 里，decide 指向尚待实现的决定内容，选 to leave。这些叫动词的补足方式，是词义和语言习惯共同决定的。<#0.8#>
Mum gave me a gift 又不是 doing 或 to do 问题。<#0.7#>give 带出一次传递，me 是接收者，a gift 是传递的东西，所以可用“人加物”的双宾语，也可改成 gave a gift to me。<#0.8#>
学动词不只记中文意思，要连同后面允许的结构一起记，例如 enjoy doing、decide to do、give someone something。做题先问主动词还缺“一项活动”、“一个目标”，还是“接收者和东西”；再调出该动词允许的结构，检查整块是否真的补全了它的意思。`)
};
const NUMERAL_NARRATIONS = {
  'numeral-functions': narration('numeral:numeral-functions', `数词不是放进句子就永远做同一份工作。Two books are missing。<#0.8#>真正站在“什么东西不见了”这个位置上的，是整块 Two books。two 只在名词 books 前说明数量，整个名词短语才是主语。<#0.8#>
The first chapter is short。<#0.7#>这次 first 不说有多少章，而是把 chapter 放到顺序中的第一位。first 仍然放在名词前限定它，整块 The first chapter 做主语。<#0.8#>
I need two 里，two 后面没写名词，但语境已让大家知道需要什么，two 自己就能代表“两个”做宾语。Leo was the first to answer 里，the first 也独立表示第一个回答的人。本节要解决的不是数字表示数量还是顺序，而是它在句中跟名词一起工作，还是独立代替已知名词。判断时先圈整块，再看它在谓语前、动词后还是表语位置，不要把“数词”直接等同于某个句子成分。`),
  cardinals: narration('numeral:cardinals', `书架上一本书写 one book，两本写 two books。<#0.8#>这类直接回答“有多少”的数词叫基数词。数量为一时名词用单数，大于一时可数名词通常用复数，所以 two 后是 books。<#0.8#>
twenty-one、forty、ninety-nine 展示了两个容易错的地方。<#0.7#>二十一到九十九之间不是整十的数，十位和个位在书写中用连字符连起来。forty 不是 fourty，它的拼写要单独记住。<#0.8#>
three hundred students 里，three 已经给出精确数量，所以 hundred 保持单数，不加 s；students 才是被计数的人，用复数。这一节专门处理精确数量的拼写和组合，还不谈“数百”那种模糊范围。操作时先确认是否在回答“多少”，再检查名词单复数；两位数检查连字符；具体数字后的 hundred、thousand、million 保持单数。`),
  ordinals: narration('numeral:ordinals', `one、two、three 只告诉我们数量，要说第一、第二、第三，会换成 first、second、third。<#0.8#>这类把人或事物放进次序的词叫序数词。前三个不能从基数词机械推出，要当作高频特殊形式记住。<#0.8#>
five、twelve、twenty 变序数词时，分别是 fifth、twelfth、twentieth。<#0.7#>它们不是简单在原词后加 th，词干或词尾会变，所以需要按真实拼写记忆。<#0.8#>
The third runner crossed the line。third 在 runner 前说明跑者的名次，序数词前通常用 the。This is my second visit 里，my 已经占了名词前的限定位置，不再叠加 the，所以是 my second visit。本节在基数词之后专门解决“第几”的形式和限定词位置。判断时先问是数量还是顺序；若是顺序，再检查特殊拼写；最后看前面已有 the、my 还是 this，不要把中心限定词重复叠放。`),
  'large-numbers': narration('numeral:large-numbers', `看到 3,506，不要从左到右逐个数字念。它要按三位一组分层，先读千位，再读后面三位：three thousand five hundred and six。<#0.8#>英式读法常在百位后保留 and，美式读法可省略，两种都要能识别。<#0.8#>
2,000,000 读 two million。<#0.7#>前面有精确数字 two，million 只是位级名称，保持单数，不加 s，后面也不加 of。<#0.8#>
millions of stars 却没有给出具体是几百万，只表示数以百万计的大量星星，所以 millions 用复数，后面接 of。这一节不重复基数词的普通拼写，专门解决大数的分组和精确、概数边界。实际读大数，先从右向左三位分组，再给每组安上 thousand、million 等位级；有具体数字就保持位级词单数，没有精确数字而表大量，才用复数加 of。`),
  fractions: narration('numeral:fractions', `把一个蛋糕平均切成三份，取其中一份：1/3 → one third。<#0.8#>上面的分子告诉我们取了几份，用基数词；下面的分母告诉我们整体被分成几等份，用序数词。这个关系比单纯背读法更重要。<#0.8#>
2/3 读 two thirds。<#0.7#>现在取的不止一份，所以表示“三分之一份”的 third 要变复数 thirds。判断分母是否加 s，要看分子是一还是大于一。<#0.8#>
1/2 读 one half，1/4 可读 one quarter。half 和 quarter 是日常使用中的高频特殊形式，不按 second 和 fourth 的机械路线处理。这一节在数量读法之后，把数词放进“整体与部分”的关系。操作时先说分子，再把分母变成序数词；分子大于一，分母通常加 s；最后单独检查 half 和 quarter。`),
  'decimals-percent': narration('numeral:decimals-percent', `0.75 不按“七十五”来读，而是 zero point seven five。<#0.8#>小数点读 point，小数点后面的数字按顺序一个一个读，因为每一位都在标明更精细的数值，不再按普通两位数组合。<#0.8#>
25% 读 twenty-five percent。<#0.7#>percent 就是“每一百份中占多少”，前面无论是一还是二十五，percent 本身都不加复数 s。<#0.8#>
The tank is thirty percent full。这句说水箱达到百分之三十的满度，thirty percent 告诉我们 full 的程度。百分比只给出部分占整体的比例，如果要算具体有多少人或多少升，还必须知道整体数量。这一节专门区分小数的位值读法和百分比的比例意义。判断时先看符号：小数点后逐位读，百分号前按基数词读；再问题目要比例，还是要根据整体算实际数量。`),
  'date-time': narration('numeral:date-time', `May 5 → May fifth / the fifth of May。<#0.8#>这表示五月的第五天。日期中的“日”不是在数五个东西，而是把这一天放在当月的顺序里，所以读序数词。<#0.8#>
7:30 可直接读 seven thirty。<#0.7#>这种方式先读小时，再读分钟，看到电子时钟时最直接。<#0.8#>
8:15 读 a quarter past eight，past 表示已经过了八点多久；8:45 读 a quarter to nine，to 表示距离下一个整点九点还差多久。quarter 是四分之一小时，也就是十五分钟。这一节把数字放入日期和时间坐标，不再把它只当普通数量。操作时，日期的日用序数词；时刻可先用“小时加分钟”直读；使用 past 和 to 时，先判断分针在前半小时还是后半小时，后半小时要朝下一个整点计算。`),
  'labels-years': narration('numeral:labels-years', `Room 205 → Room two oh five。<#0.8#>这里的 205 不是说房间里有二百零五个东西，而是一张身份牌，告诉我们找哪个房间。编号里的零常读 oh，整串也常按数字逐位读，不按大数位级处理。<#0.8#>
Bus 106 同样读 Bus one oh six。<#0.7#>这不是一百零六辆公交车，而是一零六路公交车。看到数字前的 Room、Bus 等名称，要先问它在计数，还是在识别对象。<#0.8#>
1998 作年份时读 nineteen ninety-eight；2008 可读 two thousand and eight，也能听到 twenty oh eight。年份有自己的分段习惯，它的任务是在时间线上给某一年命名，不是表示那么多个东西。这一节在日期时间之后进一步解决“数字用来命名”的情况。判断时先看数字前后是否有房间、车次或年份语境；如果是标签，按惯用的逐位或分段读法，不套精确大数读法。`),
  approximate: narration('numeral:approximate', `Hundreds of visitors came today。<#0.8#>说话人没有给出精确是几百人，只想表示人数以百计。所以 hundreds 加 s，后面用 of 连接 visitors。这和 three hundred 不同：前面有具体数字时，hundred 保持单数，不用 of。<#0.8#>
About fifty people joined the event。<#0.7#>fifty 本来是精确数字，about 把它扩成一个大约范围。around 也可表大约，nearly 表接近但还没到，more than 则表超过。这些词会改变数字的上下边界。<#0.8#>
She bought two dozen eggs。dozen 是一组十二个的计量单位，前面已有 two 给出精确数量，所以 dozen 通常保持单数，后面直接接 eggs。这一节不再训练大数如何分组，而是看数量是精确值、大约范围还是一个计量组。判断时，先找 about、nearly 等范围信号；再看 hundred 类词前有没有具体数字；有就用单数，无精确数字而表大量，才用复数加 of。`),
  'multiples-ratios': narration('numeral:multiples-ratios', `This box is twice as heavy as that one。<#0.8#>这里 twice 不是单独报一个数，而是比较两个箱子的重量，表示前者是后者的两倍。倍数放在 as...as 比较骨架前，once 是一倍，twice 是两倍，更高倍数常用基数词加 times。<#0.8#>
a ratio of 2 to 3 读 two to three。<#0.7#>这不是加减计算，而是说两类数量按二比三对应。to 左右的顺序不能随便交换，因为每个数对应不同对象。<#0.8#>
6 + 4 = 10 读 six plus four equals ten。数词仍表数量，plus 和 equals 说明这些数量如何发生关系。这一节在分数和百分比之后，专门处理两个数量之间的倍数、比例和运算，不是只教数字发音。做题先问是在比较大小、说两类数量对应，还是进行运算；倍数用 twice 或 times 放比较骨架前，比例保持 A to B 的对应顺序，算式则读准运算词。`),
  'number-agreement': narration('numeral:number-agreement', `Two hours is enough。<#0.8#>两小时在形式上有复数 hours，这里却把它当作一段完整时长，所以谓语用单数 is。金钱和距离被当作一个总量时，也常按单数处理。<#0.8#>
Two thirds of the students are present。<#0.7#>二分之三是从 students 这个复数群体中取出一定比例，真正决定谓语单复数的是 of 后的 students，所以用 are。<#0.8#>
Thirty percent of the water is gone。water 是不可数的整体，从中取出百分之三十，谓语仍按单数用 is。这一节是数词专题的结尾，把前面的总量、分数和百分比放回完整句子，解决谓语到底用单数还是复数。判断时，先问时间、金钱、距离是否被当成一个总体；若是分数或百分比加 of，就跳过前面数字，找 of 后的名词；可数复数用复数谓语，不可数或单数名词用单数谓语。`)
};
const ARTICLE_NARRATIONS = {
  'article-determiner-boundary': narration('article:article-determiner-boundary', `the book、my book、this book 都在告诉听者“说的是哪一本书”，但不能把它们随意叠成一长串。<#0.8#>the、my、this 都想占据名词前最核心的限定位置，所以通常只选一个。冠词属于限定词系统，不是看到名词就必须再加一个。<#0.8#>
a book 和 one book 都能带出一本书，但侧重不同。<#0.7#>a 只是从一类中引入一个，one 则特别强调数量是一，不是两个。两者也不会在同一个核心位置里叠放。<#0.8#>
all the books 和 both my hands 说明也有能放在核心限定词前的词。all 说全部，both 说两者都，后面再由 the 或 my 锁定对象。本节解决的是名词前小词的排队边界。判断时先找名词，再看前面是冠词、物主词还是指示词；三者通常只留一个核心限定词，all、both 则按固定顺序放在它前面。`),
  'indefinite-reference': narration('article:indefinite-reference', `I need a pen。<#0.8#>说话人需要一支笔，但没有让听者去找某一支已知的笔。a 把 pen 这一类中的某一个带进谈话，核心是“一个、但尚未锁定”，这叫不定指。<#0.8#>
Mia is a doctor。<#0.7#>这里并不是说 Mia 是某一位听者找不到的医生，而是把她归入 doctor 这一职业类别。职业、身份等单数可数名词作表语时，常用 a 或 an 表示“这一类中的一员”。<#0.8#>
A child needs love。这句借用“任何一个孩子”来说这一类人的共同情况，a 仍从 child 这一类中取出一个代表。本节只解决 a/an 在意义上如何“引入一个”，下一节才专门处理 a 还是 an 的发音选择。判断时先看名词是否为单数可数，再问听者是否已能识别具体对象；若只是首次带出、说职业或用一个成员代表整类，考虑 a/an。`),
  'a-an': narration('article:a-an', `an hour 为什么用 an？<#0.8#>因为 hour 的 h 不发音，开头听到的是元音。a 还是 an 不看第一个字母长什么样，而看紧跟后面那个成分的第一个声音。<#0.8#>
a university 里，university 虽然以元音字母 u 开头，发音却以类似 y 的辅音开头，所以用 a。<#0.7#>an MBA student 里，MBA 按字母名读，第一个声音是元音，所以用 an。<#0.8#>
a one-year course 里，one 开头听到的也是辅音，因此用 a。an interesting book 和 a useful book 则提醒我们，冠词看的不一定是中心名词 book，而是紧跟在它后面的 interesting 或 useful 的首音。本节承接上一节的不定指意义，只解决语音形式。操作时先确定意义上需要 a/an，再从冠词后的第一个词开始读；首音是元音用 an，首音是辅音用 a，不靠字母外观猜。`),
  'the-known': narration('article:the-known', `Please close the door。<#0.8#>说话人没有先介绍这扇门，但现场情况让听者能找到要关的那一扇。the 的关键不是简单翻成“这个”，而是说话人预期听者能识别对象。<#0.8#>
The teacher is waiting outside。<#0.7#>世界上当然有很多老师，但在当前班级或谈话范围里，双方知道说的是哪位。所以 the 要求的是当前范围内可识别，不是全世界唯一。<#0.8#>
The sun provides light。sun 可以靠双方共享的世界知识被识别，不需要每次先在前文出现。本节是 the 系统的第一步，专门处理现场和共享知识；下一节才看前文和后置信息如何锁定对象。判断时先问：不看中文翻译，听者能否根据眼前场景、共同经历或常识，唯一对上我说的对象？能，才有使用 the 的基础。`),
  'the-context-chain': narration('article:the-context-chain', `I saw a dog. The dog followed me。<#0.8#>第一句用 a 带出一只新出现的狗，第二句再说 the dog，听者会对上前文那一只。这是前文让对象从新信息变成可识别信息。<#0.8#>
We bought a house. The kitchen is small。<#0.7#>前文没有直接说过 kitchen，但说了 house，听者能通过“房子通常有厨房”的关联找到对象。<#0.8#>
The book on the desk is mine。on the desk 进一步缩小 book 的范围，让听者锁定桌上那本。I need a book about birds 则不同，about birds 只说明书的主题，不一定能锁定唯一一本，所以仍用 a。本节承接现场可识别，专门分清前文复现、关联识别和后置限定。判断时先查对象是否已在前文出现；再看能否从已知事物推出；最后检查后面信息是真的锁定唯一对象，还是只描述类型。`),
  'unique-superlative': narration('article:unique-superlative', `Mia is the tallest student in her class。<#0.8#>tallest 把范围限定在 her class，并指向这个范围内身高排在最前的一人，所以听者能识别这个位置，通常用 the。不是最高级一出现就神奇地触发 the，而是它常建立范围内唯一顶位。<#0.8#>
This is the first lesson in the book。<#0.7#>first 把 lesson 放在本书课程顺序的第一位，in the book 给出范围，所以用 the。<#0.8#>
Leo is my best friend。best 前没有 the，因为 my 已经占据名词前的核心限定位置，不能再叠加 the。We need a second chance 也不是“唯一的第二次”，a second 表示再来一次、另一次机会。本节在 the 可识别之后，专门处理最高级和序数词常建立的范围唯一性，同时保留 my 和 a 造成的例外意义。判断时先找比较或顺序范围，再看对象是否因此唯一；最后检查前面是否已有 my，或 a 是否在表示“又一个”。`),
  'zero-basic': narration('article:zero-basic', `Books can teach us a lot。<#0.8#>这里不是指几本已知的书，而是谈书这一类事物。可数名词用复数泛谈整类时，前面常什么冠词都不加，这种形式叫零冠词。<#0.8#>
Water is essential。<#0.7#>water 被当作一种物质整体，没有分成某一份或某一瓶，泛指时也用零冠词。<#0.8#>
The books on this shelf belong to Mia。on this shelf 锁定了架子上那些书，所以不再是泛谈所有书，而用 the。The water in this bottle is cold 也通过 in this bottle 锁定这瓶里的水，不可数名词一样能因为对象可识别而用 the。本节专门建立“谈整类”与“锁定对象”的对比。判断时先看复数可数名词或不可数名词是否在泛谈一类、一种物质或概念；是就考虑零冠词。再检查后面信息是否锁定具体范围，锁定了就重新考虑 the。`),
  'institutions-meals': narration('article:institutions-meals', `The children are at school。<#0.8#>这里关心的不是孩子们站在哪栋建筑里，而是他们正在上学、参与 school 这个机构的常规功能。在这种约定用法里，school 前用零冠词。<#0.8#>
Their parents are waiting at the school。<#0.7#>父母不是去上学，只是在那所学校的具体地点等待。此时 school 被当作可识别的建筑或地点，所以用 the。<#0.8#>
The baby is in bed 表示宝宝在床上睡觉或休息，重点是 bed 的常规用途。Eva is in hospital 在英式用法中常表示 Eva 作为病人住院，同样突出制度功能；地区用法可有差异。本节不是要背一张“某名词永远不加冠词”的表，而是区分人在使用机构或设施的正常功能，还是只指具体地点或物件。判断时先问主语在那里做什么；参与上学、休息、住院等常规功能，检查零冠词；只是去那栋建筑，再按可识别对象选 the。`),
  'activity-conventions': narration('article:activity-conventions', `She speaks English 和 We study maths 里，English 是语言名称，maths 是学科名称，在这种普通用法中前面不加冠词。<#0.8#>这属于英语名称系统的约定，不是因为它们都能用同一条抽象公式推出。<#0.8#>
They play football 里，球类运动名称在 play 后通常用零冠词。<#0.7#>Mia plays the piano 里，传统乐器演奏用法常保留 the，不能把 football 的规则直接搬过来。<#0.8#>
We had a wonderful breakfast 中，breakfast 本是餐名，普通说吃早饭时常零冠词；现在 wonderful 把它包装成一次具体、可描述的早餐经历，所以用 a。Leo came by bus 里，by 加交通方式名称时通常不加冠词。本节专门组织语言、学科、运动、乐器、餐名和交通方式的常用名称系统。判断时先识别名称类别，再调用该类的真实惯用形式；如果餐名被修饰并表示一次具体经历，再重新考虑 a/an。`),
  'names-places': narration('article:names-places', `China、Asia、Shanghai 都是单一国家、大洲或城市的专有名称，通常不加冠词。<#0.8#>Mount Tai 和 Lake Baikal 里，Mount 和 Lake 已经成为名称结构的一部分，也常用零冠词。<#0.8#>
the Yangtze River、the Pacific Ocean、the Alps 则分别属于河流、海洋和山脉名称，这些名称类别通常使用 the。<#0.7#>the United States、the United Kingdom、the Netherlands 也保留 the，它们的名称结构不能用“所有国家名都零冠词”来覆盖。<#0.8#>
Oxford University、Buckingham Palace 是大学和宫殿名称中常见的零冠词结构。本节的独有问题是：专有名称不能只凭“独一无二”猜 the，要按名称类别和真实惯用学习。判断时先确认它是普通名词还是完整专名；再分类为国家、城市、单山湖泊，或河流、海洋、山脉和特殊国名；最后按习惯核对，不用中文译名机械决定冠词。`),
  'generic-contrast': narration('article:generic-contrast', `Tigers need protection。<#0.8#>复数 Tigers 配零冠词，直接谈老虎整个类别，这是日常表达中最常用、最自然的泛指方式。<#0.8#>
A tiger is a powerful animal。<#0.7#>这次用任何一只典型老虎代表整类，特别适合说类别成员共同拥有的性质。<#0.8#>
The tiger is disappearing from some regions。the 加单数名词在这里把 tiger 当作一个物种概念，这种泛指更正式，常见于物种或发明类讨论，不能对每个普通可数名词都随意使用。The tigers in this zoo need more space 则不是泛指，in this zoo 锁定了这家动物园里的那些老虎。本节把前面的 a/an、the 和零冠词放到同一个泛指问题里比较。判断时，优先用复数零冠词谈整类；要用典型单个成员说共同特征，可用 a/an；只有适合当作物种概念时，才考虑 the 加单数。最后检查后置信息是否已经把对象锁定成具体一群。`),
  'article-countability-shift': narration('article:article-countability-shift', `Coffee keeps me awake。<#0.8#>这里 Coffee 表示咖啡这种饮料或物质，没有切成一份一份，所以按不可数名词泛指，用零冠词。<#0.8#>
I ordered a coffee。<#0.7#>在点单情境里，a coffee 不是说一种抽象物质，而是把咖啡包装成一杯或一份。语境提供了可计数的单位，同一个名词就可以使用 a。<#0.8#>
The coffee on my desk is cold。on my desk 把咖啡锁定为我桌上那份具体饮品，无论把 coffee 理解成物质还是一杯饮料，听者都能识别对象，所以用 the。本节进入冠词的意义变化，专门解决“同一名词为什么一会儿可数、一会儿不可数”。判断时先问是在说物质整体，还是语境已把它分成一杯、一份或一种；再问对象是首次引入还是已被锁定。先判断当前词义的计数单位，再选冠词。`),
  'article-meaning': narration('article:article-meaning', `go to school ↔ go to the school。两块只差一个 the，第一个常表示去上学，第二个表示去那所具体学校建筑。<#0.8#>go to bed 是去睡觉，sit on the bed 是坐在那张具体床上。冠词有无改变的是功能视角和具体物件视角。<#0.8#>
have breakfast 是普通说吃早饭，have a big breakfast 把它包装成一顿具体且丰盛的早餐。<#0.7#>by bus 说交通方式，on the bus 则说人在那辆可识别的公交车上。<#0.8#>
few friends 表示朋友少到几乎没有，a few friends 表示虽然不多，但还有几个。little time 和 a little time 也有同样的否定、肯定差别，只是它们修饰不可数的 time。本节不是继续分类名称，而是观察冠词这个小变化怎样改写整个短语的意义。判断时把有冠词和无冠词的两块整体对照：是制度功能还是具体地点，是常规活动还是一次具体经历，是几乎没有还是仍有一些。`),
  'article-groups': narration('article:article-groups', `The rich are not always happy。<#0.8#>rich 原本是形容词，the 放在前面后，the rich 整体表示“富人这一群人”。它不是指一个富人，而是复数群体，所以谓语用 are。<#0.8#>
The French are known for their cuisine。<#0.7#>The French 在这里表示法国人整个民族群体，同样按复数与 are 配合。不同民族名称的构造方式并不完全一样，这里要记真实用法，不能给所有国籍词机械加 the。<#0.8#>
The Smiths live next door。Smith 是姓氏，变成复数 Smiths，再加 the，整体表示 Smith 一家人，所以谓语用 live。本节是冠词课程的群体指称结尾，专门区分“the 加形容词”、民族名和“the 加姓氏复数”三种构造。判断时先问整块是否在指一类人或一家人，再看核心是形容词、民族名还是姓氏；最后按复数群体检查谓语，不要被表面没有普通复数词尾迷惑。`)
};
const reviseNarration = (item, replacements, prefix = '') => {
  replacements.forEach(([from, to]) => { item.text = item.text.split(from).join(to); });
  if (prefix) item.text = `${prefix}<#0.8#>${item.text}`;
  item.lengthText = `${item.text.replace(/<#\d+(?:\.\d+)?#>/g, '').replace(/\s/g, '').length} 字 · 约 2 分钟`;
};
if (BUILD_TARGET === 'all' || BUILD_TARGET === 'verb') {
reviseNarration(VERB_FIRST_LESSON_NARRATION, [['A bird flies', '一只鸟作主语时，fly 会变成 flies']]);
reviseNarration(VERB_NARRATIONS.linking, [
  ['The flower smells sweet', '页面的感官系动词例句'], ['She tasted the soup', '当 tasted 表示真正品尝时'], ['The soup tastes good', '当 tastes 只连接汤和它的味道时']
]);
reviseNarration(VERB_NARRATIONS['finite-forms'], [['He is ready 和 They are ready', '主语从单数换成复数时']]);
reviseNarration(VERB_NARRATIONS['third-person-form'], [
  ['I play tennis，主语换成 She，动词就要留下一个小标记：She plays tennis', '主语换成第三人称单数时，动词要留下一个小标记']
], 'play → plays · run → runs。');
reviseNarration(VERB_NARRATIONS['past-forms'], [], 'work → worked · live → lived。');
reviseNarration(VERB_NARRATIONS['present-simple'], [['He does not like music', '它的否定形式']]);
reviseNarration(VERB_NARRATIONS['present-progressive'], [['The baby sleeping', '只保留宝宝和 sleeping']]);
reviseNarration(VERB_NARRATIONS['past-simple'], [['two days ago', '几天前']]);
reviseNarration(VERB_NARRATIONS['future-forms'], [['be going to', 'going to 结构']]);
reviseNarration(VERB_NARRATIONS['five-sentence-patterns'], [], 'Birds fly. (SV) · She is kind. (SVC)。');
reviseNarration(VERB_NARRATIONS['auxiliary-system'], [
  ['The door was closed', '当门被关上时'], ['I do not know', '实义动词的否定形式']
]);
reviseNarration(VERB_NARRATIONS['modal-meanings'], [
  ['You can go', 'can 放在动词前'], ['You must go', 'must 放在动词前'], ['He may be at home', 'may 表示可能'], ['He must be at home', 'must 表示肯定推测'], ["He can't be at home", "can't 表示不可能"]
], 'can/could: ability or permission。');
reviseNarration(VERB_NARRATIONS['passive-tenses'], [
  ['It is made here', '它在这里被制造'], ['The bridge is being repaired', '桥正在被修理'], ['The task has been finished', '任务已经被完成'], ['be being done', '进行被动结构'], ['have been done', '完成被动结构']
], 'is made · was made · will be made。');
reviseNarration(VERB_NARRATIONS['future-in-clauses'], [['as soon as', '表示“一……就……”的连接词']]);
reviseNarration(VERB_NARRATIONS.infinitive, [['write with a pen', '用笔书写这层关系']]);
reviseNarration(VERB_NARRATIONS.gerund, [['look forward to', '表示期待的介词结构']]);
reviseNarration(VERB_NARRATIONS['ing-forms'], [], 'work → working · play → playing。');
reviseNarration(VERB_NARRATIONS['causative-perception'], [['We were made to laugh', '改成被动后']]);
reviseNarration(VERB_NARRATIONS['gerund-infinitive-meaning'], [
  ['remember to turn off the light', 'remember to do'], ['remember turning it off', 'remember doing'], ['He stopped smoking', 'stop doing'], ['He stopped to smoke', 'stop to do'], ['try restarting the computer', 'try doing'], ['try to restart it', 'try to do']
], '形式相近，意义不同：remember doing ↔ remember to do。');
reviseNarration(VERB_NARRATIONS['nonfinite-advanced'], [
  ['He hopes to be invited', '他希望被邀请'], ['She seems to have finished it', '她似乎已经完成'], ['to have done', '不定式完成式']
]);
reviseNarration(VERB_NARRATIONS['special-verb-patterns'], [
  ['He used to get up late', 'used to do'], ['He is used to getting up early', 'be used to doing'], ['You had better leave now', 'had better do'], ['You had better not be late', 'had better not do'], ['I would rather stay home than go out', 'would rather do than do']
], 'used to do · be used to doing。');
reviseNarration(VERB_NARRATIONS['special-verb-patterns'], [[
  'used to do 是过去常常，be used to doing 是习惯，had better do 是强建议，would rather do 是偏好',
  '第一组区分过去习惯和现在已习惯，第二组表强建议，第三组表个人偏好'
]]);
reviseNarration(VERB_NARRATIONS['verb-complements'], [
  ['gave a gift to me', '把礼物给我'], ['decide to do', 'decide 后接不定式'], ['give someone something', 'give 后接人和物']
]);
}
const FIRST_LESSON_NARRATIONS = BUILD_TARGET === 'verb'
  ? { Verbs: VERB_FIRST_LESSON_NARRATION }
  : BUILD_TARGET === 'numeral'
    ? { Numerals: NUMERAL_FIRST_LESSON_NARRATION }
    : BUILD_TARGET === 'article'
      ? { Articles: ARTICLE_FIRST_LESSON_NARRATION }
      : { Verbs: VERB_FIRST_LESSON_NARRATION, Numerals: NUMERAL_FIRST_LESSON_NARRATION, Articles: ARTICLE_FIRST_LESSON_NARRATION };
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const labels = {
  subject: ['主语', 'Subject'], predicate: ['谓语动词', 'Predicate verb'], object: ['宾语', 'Object'],
  complement: ['表语', 'Subject complement'], predicative: ['表语', 'Subject complement'], objectComplement: ['宾语补足语', 'Object complement'],
  directObject: ['直接宾语', 'Direct object'], indirectObject: ['间接宾语', 'Indirect object'],
  preposition: ['介词', 'Preposition'], prepositionalObject: ['介词宾语', 'Object of preposition'], attribute: ['定语', 'Attribute'], adverbial: ['状语', 'Adverbial'],
  auxiliary: ['助动词', 'Auxiliary'], modal: ['情态动词', 'Modal verb'], conjunction: ['连词', 'Conjunction']
};
const questionEnglish = Object.assign({}, BUILD_TARGET === 'all' || BUILD_TARGET === 'verb' ? {
  'The flower smells sweet. smells 是？': 'In “The flower smells sweet,” what is “smells”?',
  '系动词': 'a linking verb', '及物动词': 'a transitive verb',
  'Birds fly. fly 表示？': 'In “Birds fly,” what does “fly” express?', '动作': 'an action', '所属': 'possession',
  'I understand you. understand 后面是？': 'What follows “understand” in “I understand you”?', '宾语': 'an object', '表语': 'a subject complement',
  'The child smiled. smiled 是？': 'In “The child smiled,” “smiled” is ...', '不及物': 'intransitive', '及物': 'transitive',
  'The sky grew dark. dark 是？': 'In “The sky grew dark,” “dark” is ...',
  'They are reading. are 是？': 'In “They are reading,” “are” is ...', '助动词': 'an auxiliary',
  'pick up the box 的正确改写是？': 'Which correctly replaces “the box” with a pronoun?',
  'People speak English. 被动为？': 'What is the passive form of “People speak English”?',
  'The window was broken. 这是？': 'What structure is used in “The window was broken”?', '被动结构': 'the passive voice', '现在进行时': 'the present progressive',
  'She sent me a card. me 是？': 'In “She sent me a card,” “me” is ...', '间接宾语': 'the indirect object', '状语': 'an adverbial'
} : {}, BUILD_TARGET === 'all' || BUILD_TARGET === 'numeral' ? {
  '40 的正确拼写': 'Which is the correct spelling of 40?', '第十二': 'the twelfth', '第20': 'the twentieth',
  '数百万': 'millions (an indefinite quantity)', '3.14 中的小数点读': 'How is the decimal point in 3.14 read?',
  'Bus 106 常读': 'Bus 106 is normally read as ...', '数百名学生': 'hundreds of students', '大约30': 'about 30', '两打鸡蛋': 'two dozen eggs'
} : {}, BUILD_TARGET === 'all' || BUILD_TARGET === 'article' ? {
  '不填': '(no article)',
  '泛指“猫是独立的动物”最自然：': 'Which sentence most naturally refers to cats in general?',
  '“还有一点希望”': 'Which phrase means “there is still some hope”?',
  '“几乎没有朋友”': 'Which phrase means “almost no friends”?'
} : {});
const localizeQuestionText = (en, text) => en && questionEnglish[text] ? questionEnglish[text] : text;
const analyzed = (en, units, mode = '', zh = '', english = '') => ({
  text: units.map(x => x[0]).join(' '),
  analysis: units.map(x => ({ text: x[0], role: x[1], label: pick(en, x[2] || (labels[x[1]] || [x[1], x[1]])[0], x[3] || (labels[x[1]] || [x[1], x[1]])[1]) })),
  note: mode ? { visible: true, mode, title: pick(en, mode === 'translation' ? '语序翻译' : '结构观察', mode === 'translation' ? 'Word order' : 'Structure focus'), body: pick(en, zh, english), detail: '' } : { visible: false, mode: '', title: '', body: '', detail: '' }
});
const form = (en, text, mode, zh, english) => ({ text, analysis: null, note: { visible: true, mode, title: pick(en, mode === 'sound' ? '发音观察' : '规则观察', mode === 'sound' ? 'Sound focus' : 'Rule focus'), body: pick(en, zh, english), detail: '' } });
const question = (en, prompt, a, b, answer, zh, english) => ({ question: localizeQuestionText(en, prompt), options: [{ key: 'A', text: localizeQuestionText(en, a) }, { key: 'B', text: localizeQuestionText(en, b) }], answer, correct: pick(en, zh, english), wrong: pick(en, `再看规则：${zh}`, `Check the rule: ${english}`) });
const ruleCoverageByLesson = INCLUDE_RULE_COVERAGE ? {
  'verb-jobs': [[[0,1,2],[0,1,2]],[[0,1,2],[0,1,2]]],
  transitivity: [[[0,1],[0,2]],[[2],[1]]], linking: [[[0,1,2],[0,1,2]],[[0,1,2],[0,1,2]]],
  'aux-modal': [[[0,1,2],[1,2]],[[2],[0]]], 'finite-forms': [[[0,1,2],[0,1]],[[2],[2]],[[3],[3]]],
  'tense-aspect': [[[0,1,2],[0,1,2]],[[0,1,2],[0,1,2]]], nonfinite: [[[0,1,2],[0,1,2]],[[0,1,2],[0,1,2]]],
  phrasal: [[[0,1,2],[0,1,2]],[[1],[0,2]]], voice: [[[0,1,2],[0,1,2]],[[2],[0,1]]],
  'verb-complements': [[[0,1],[0,1]],[[2],[2]]],
  'double-object-complement': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'verb-five-forms': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'third-person-form': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]],[[4],[4]],[[5],[5]]],
  'past-forms': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'ing-forms': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'subject-verb-agreement': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'present-simple': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]]],
  'present-progressive': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'past-simple': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'past-progressive': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'future-forms': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'present-perfect': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'past-perfect': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'passive-tenses': [[[0],[0]],[[1],[1]],[[2],[2]]],
  infinitive: [[[0],[0]],[[1],[1]],[[2],[2]]],
  gerund: [[[0],[0]],[[1],[1]],[[2],[2]]],
  participles: [[[0],[0]],[[1],[1]],[[2],[2]]],
  'causative-perception': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'special-verb-patterns': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'five-sentence-patterns': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'auxiliary-system': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'modal-meanings': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'agreement-complex': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]],[[4],[4]],[[5],[5]]],
  'future-in-clauses': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'perfect-vs-past': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'past-time-sequence': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'nonfinite-advanced': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'gerund-infinitive-meaning': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'numeral-essence': [[[0,1,2],[0,1,2]],[[0,1,2],[0,1,2]]],
  'numeral-functions': [[[0,1],[0,1]],[[2],[2]],[[3],[3]]],
  cardinals: [[[0],[0]],[[1],[1]],[[1],[2]],[[2],[3]]],
  ordinals: [[[2],[0]],[[0,1],[1,2]],[[3],[3]]],
  'large-numbers': [[[0],[0]],[[1,2],[1,2]],[[0],[3]]],
  fractions: [[[0],[1]],[[1],[0]],[[2],[2]]],
  'decimals-percent': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'date-time': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]]],
  'labels-years': [[[0],[0]],[[1],[1]],[[2],[2]]],
  approximate: [[[0],[0]],[[1],[1]],[[2],[2]]],
  'multiples-ratios': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'number-agreement': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'article-essence': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'article-determiner-boundary': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'indefinite-reference': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'a-an': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]],[[4],[4]]],
  'the-known': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'the-context-chain': [[[0],[0]],[[1],[1]],[[2,3],[2,3]]],
  'unique-superlative': [[[0],[0]],[[1],[1]],[[2,3],[2,3]]],
  'zero-basic': [[[0,1],[0,1]],[[2,3],[2,3]]],
  'institutions-meals': [[[0,1],[0,1]],[[2],[2]],[[3],[3]]],
  'activity-conventions': [[[0,1],[0,1]],[[2,3],[2,3]],[[4,5],[4,5]]],
  'names-places': [[[0,1],[0,1]],[[2],[2]],[[3],[3]],[[4],[4]]],
  'generic-contrast': [[[0],[0]],[[1],[1]],[[2],[2]],[[3],[3]]],
  'article-countability-shift': [[[0],[0]],[[1],[1]],[[2],[2]]],
  'article-meaning': [[[0,1],[0,1]],[[2,3],[2,3]],[[4],[4]]],
  'article-groups': [[[0],[0]],[[1],[1]],[[2],[2]]]
} : null;
const ruleCoverage = (id, rules) => {
  const mapping = ruleCoverageByLesson[id];
  if (!mapping || mapping.length !== rules.length) throw new Error(`Missing rule coverage: ${id}`);
  return mapping.map(([exampleIndexes, questionIndexes]) => ({ exampleIndexes, questionIndexes }));
};
function lesson(en, id, zhTitle, enTitle, zhMeta, enMeta, examples, rules, questions) {
  const allAnalyzed = examples.every(x => Array.isArray(x.analysis));
  return { id, title: pick(en, zhTitle, enTitle), meta: pick(en, zhMeta, enMeta), examples: examples.map(x => x.text), analyses: allAnalyzed ? examples.map(x => x.analysis) : [], exampleNotes: examples.map(x => x.note), rules: rules.map(x => pick(en, x[0], x[1])), ruleCoverage: INCLUDE_RULE_COVERAGE ? ruleCoverage(id, rules) : [], questions };
}
const allSectionSpecs = {
  Verbs: [
    { id: 'roles-patterns', zhTitle: '动词作用与基本句型', enTitle: 'Verb roles and basic patterns', zhCopy: '从动词任务判断及物性、系表关系和五大基本句型。', enCopy: 'Classify verb roles, transitivity, linking and the five basic patterns.', lessonIds: ['verb-jobs','transitivity','linking','double-object-complement','five-sentence-patterns'] },
    { id: 'auxiliaries-modals', zhTitle: '助动词与情态动词', enTitle: 'Auxiliaries and modal verbs', zhCopy: '掌握 be、do、have 的结构功能和情态意义。', enCopy: 'Master structural uses of be, do and have and the modal meanings.', lessonIds: ['aux-modal','auxiliary-system','modal-meanings'] },
    { id: 'forms-agreement', zhTitle: '词形变化与主谓一致', enTitle: 'Verb forms and agreement', zhCopy: '系统掌握五种形式、拼写变化和基础及复杂一致。', enCopy: 'Learn the principal forms, spelling changes and basic to complex agreement.', lessonIds: ['finite-forms','verb-five-forms','third-person-form','past-forms','ing-forms','subject-verb-agreement','agreement-complex'] },
    { id: 'tense-aspect', zhTitle: '动作的时间与状态', enTitle: 'Tense and aspect', zhCopy: '时态看动作发生的时间；体看动作处于一般、进行还是完成状态。', enCopy: 'Tense locates an action in time; aspect shows it as simple, progressive or perfect.', lessonIds: ['present-simple','present-progressive','past-simple','past-progressive','future-forms','perfect-vs-past','past-time-sequence','future-in-clauses','tense-aspect'] },
    { id: 'voice-nonfinite', zhTitle: '语态与非谓语动词', enTitle: 'Voice and non-finite verbs', zhCopy: '区分主动被动，并分课掌握不定式、动名词和分词。', enCopy: 'Distinguish active and passive voice and master infinitives, gerunds and participles.', lessonIds: ['voice','passive-tenses','nonfinite','infinitive','gerund','participles','nonfinite-advanced'] },
    { id: 'patterns-collocations', zhTitle: '动词补足关系与特殊结构', enTitle: 'Verb complementation and special structures', zhCopy: '理解动词怎样决定后接成分，并处理短语动词、感官使役和意义变化。', enCopy: 'Understand how verbs select what follows, then handle phrasal, causative, perception and meaning patterns.', lessonIds: ['phrasal','causative-perception','gerund-infinitive-meaning','special-verb-patterns','verb-complements'] }
  ],
  Numerals: [
    { id: 'number-meaning', zhTitle: '定义、本质与句中作用', enTitle: 'Meaning and sentence roles', zhCopy: '先判断数字表达数量、顺序还是编号，再看它在句中的作用。', enCopy: 'First decide whether a number gives quantity, order or a label, then identify its sentence role.', lessonIds: ['numeral-essence','numeral-functions'] },
    { id: 'number-forms', zhTitle: '基数、序数与大数', enTitle: 'Cardinals, ordinals and large numbers', zhCopy: '掌握基本数词的构成、拼写和分级读写。', enCopy: 'Build, spell and read basic and large numbers accurately.', lessonIds: ['cardinals','ordinals','large-numbers'] },
    { id: 'parts-measures', zhTitle: '部分与比例表达', enTitle: 'Parts and proportions', zhCopy: '用分数、小数和百分数表达整体中的部分。', enCopy: 'Use fractions, decimals and percentages to express parts of a whole.', lessonIds: ['fractions','decimals-percent'] },
    { id: 'functional-reading', zhTitle: '日期、时间、年份与编号', enTitle: 'Dates, time, years and labels', zhCopy: '同一数字因承担的功能不同而采用不同读法。', enCopy: 'Read the same digits differently according to their function.', lessonIds: ['date-time','labels-years'] },
    { id: 'quantity-relations', zhTitle: '概数、倍数与数量关系', enTitle: 'Approximation and quantity relations', zhCopy: '表达不精确数量、倍数、比例及其结构关系。', enCopy: 'Express approximate quantities, multiples and ratios structurally.', lessonIds: ['approximate','multiples-ratios'] },
    { id: 'agreement-integration', zhTitle: '数量短语与主谓一致', enTitle: 'Quantity phrases and agreement', zhCopy: '根据数量短语表示整体还是部分选择谓语。', enCopy: 'Choose agreement by whether a quantity phrase denotes one unit or a proportion.', lessonIds: ['number-agreement'] }
  ],
  Articles: [
    { id: 'article-foundation', zhTitle: '定义、本质与边界', enTitle: 'Meaning and determiner boundaries', zhCopy: '先判断名词怎样被识别，再区分冠词与其他限定词。', enCopy: 'First decide how a noun is identified, then distinguish articles from other determiners.', lessonIds: ['article-essence','article-determiner-boundary','indefinite-reference'] },
    { id: 'indefinite-form', zhTitle: 'a/an 的形式选择', enTitle: 'Choosing a or an', zhCopy: '根据紧随成分的首个音素选择 a 或 an。', enCopy: 'Choose a or an by the first sound of the following expression.', lessonIds: ['a-an'] },
    { id: 'definite-reference', zhTitle: 'the 与可识别对象', enTitle: 'The and identifiable reference', zhCopy: '从现场、前文、关联、限定和唯一性判断听者能否识别对象。', enCopy: 'Use situation, discourse, association, modification and uniqueness to judge identifiability.', lessonIds: ['the-known','the-context-chain','unique-superlative'] },
    { id: 'zero-and-conventions', zhTitle: '零冠词与约定系统', enTitle: 'Zero article and conventional systems', zhCopy: '区分泛指零冠词、制度功能、活动名称和专有名称。', enCopy: 'Distinguish generic zero article, institutional function, activity names and proper names.', lessonIds: ['zero-basic','institutions-meals','activity-conventions','names-places'] },
    { id: 'generic-reference', zhTitle: '泛指一类事物', enTitle: 'Generic reference', zhCopy: '比较复数零冠词、a/an 单数和 the 单数的适用范围。', enCopy: 'Compare zero-article plurals, a/an singulars and the singular for general reference.', lessonIds: ['generic-contrast'] },
    { id: 'advanced-meaning', zhTitle: '进阶意义变化', enTitle: 'Advanced meaning shifts', zhCopy: '处理可数化、制度与具体对象以及群体指称。', enCopy: 'Handle count shifts, function-versus-object readings and group reference.', lessonIds: ['article-countability-shift','article-meaning','article-groups'] }
  ]
};
const sectionSpecs = BUILD_TARGET === 'verb' ? { Verbs: allSectionSpecs.Verbs } : BUILD_TARGET === 'numeral' ? { Numerals: allSectionSpecs.Numerals } : BUILD_TARGET === 'article' ? { Articles: allSectionSpecs.Articles } : allSectionSpecs;
function buildSections(en, enTitle, course) {
  const specs = sectionSpecs[enTitle];
  if (!specs) return [];
  const courseIds = course.map(item => item.id);
  const assignedIds = specs.flatMap(item => item.lessonIds);
  if (assignedIds.length !== courseIds.length || new Set(assignedIds).size !== assignedIds.length || courseIds.some(id => !assignedIds.includes(id)) || assignedIds.some(id => !courseIds.includes(id))) {
    throw new Error(`Invalid section coverage: ${enTitle}`);
  }
  return specs.map(item => ({ id: item.id, title: pick(en, item.zhTitle, item.enTitle), copy: pick(en, item.zhCopy, item.enCopy), lessonIds: item.lessonIds.slice(), lessonCount: item.lessonIds.length }));
}
function grouped(en, zhTitle, enTitle, lessons, coreCount) {
  const advancedIds = Array.isArray(coreCount) ? coreCount : null;
  const leveled = lessons.map((x, i) => Object.assign({}, x, { level: advancedIds ? (advancedIds.includes(x.id) ? 'advanced' : 'core') : (i < coreCount ? 'core' : 'advanced') }));
  const ordered = advancedIds ? leveled.filter(x => x.level === 'core').concat(leveled.filter(x => x.level === 'advanced')) : leveled;
  const course = ordered.map((x, i) => Object.assign({}, x, { no: String(i + 1).padStart(2, '0') }));
  if (FIRST_LESSON_NARRATIONS[enTitle] && course.length) course[0].narration = Object.assign({}, FIRST_LESSON_NARRATIONS[enTitle]);
  if (enTitle === 'Verbs') course.forEach(item => { if (VERB_NARRATIONS[item.id]) item.narration = Object.assign({}, VERB_NARRATIONS[item.id]); });
  if (enTitle === 'Numerals') course.forEach(item => { if (NUMERAL_NARRATIONS[item.id]) item.narration = Object.assign({}, NUMERAL_NARRATIONS[item.id]); });
  if (enTitle === 'Articles') course.forEach(item => { if (ARTICLE_NARRATIONS[item.id]) item.narration = Object.assign({}, ARTICLE_NARRATIONS[item.id]); });
  const coreLessons = course.filter(x => x.level === 'core');
  const advancedLessons = course.filter(x => x.level === 'advanced');
  return { title: pick(en, `${zhTitle} · ${course.length} 节微课`, `${enTitle} · ${course.length} lessons`), copy: pick(en, '核心规则优先，进阶处理特殊与综合语境。', 'Core rules first; advanced lessons handle special and mixed contexts.'), course, sections: buildSections(en, enTitle, course), groups: [
    { id: 'core', title: pick(en, `核心必学 · ${coreLessons.length} 节`, `Core · ${coreLessons.length} lessons`), copy: pick(en, '基础理解、高频使用与后续学习前提。', 'Essential foundations and high-frequency use.'), lessons: coreLessons },
    { id: 'advanced', title: pick(en, `进阶挑战 · ${advancedLessons.length} 节`, `Advanced · ${advancedLessons.length} lessons`), copy: pick(en, '特殊规则与综合辨析。', 'Special rules and integrated distinctions.'), lessons: advancedLessons }
  ] };
}

function buildVerbCourse(en) {
  const s = (u, m, z, e) => analyzed(en, u, m, z, e), f = (t, m, z, e) => form(en, t, m, z, e), q = (...a) => question(en, ...a);
  const bq = (zp, ep, za, ea, zb, eb, answer, zh, english) => q(pick(en, zp, ep), pick(en, za, ea), pick(en, zb, eb), answer, zh, english);
  const bundle = grouped(en, '动词', 'Verbs', [
    lesson(en, 'verb-jobs', '动词的定义与本质', 'Definition and core of verbs', '句子的谓语核心', 'The core of the predicate', [
      s([['Birds','subject'],['fly.','predicate']]), s([['I','subject'],['know','predicate'],['the answer.','object']]), s([['The soup','subject'],['tastes','predicate'],['good.','predicative']])
    ], [['动词是谓语的核心，用来表达动作、状态或变化；系动词还把主语和表语连接起来。','A verb is the core of the predicate: it expresses an action, state or change; a linking verb connects the subject with its complement.'],['先找句中随时态或主语变化的谓语核心，再判断它后面需要宾语、表语还是其他成分。','First find the finite predicate core, then decide whether it requires an object, subject complement or another element.']], [q('The flower smells sweet. smells 是？','系动词','及物动词','A','smells 连接 flower 和 sweet。','smells links flower and sweet.'),q('Birds fly. fly 表示？','动作','所属','A','fly 表示动作。','fly expresses an action.'),q('I understand you. understand 后面是？','宾语','表语','A','you 是 understand 的宾语。','you is the object of understand.')]),
    lesson(en, 'transitivity', '及物与不及物', 'Transitive and intransitive verbs', '谓语后是否需要宾语', 'Whether an object is required', [
      s([['She','subject'],['opened','predicate'],['the window.','object']]), s([['The baby','subject'],['cried.','predicate']]), s([['We','subject'],['arrived','predicate'],['at noon.','adverbial','时间状语','Time adverbial']],'translation','at noon 是时间状语，不是宾语。','at noon is a time adverbial, not an object.')
    ], [['及物动词可直接带宾语；不及物动词不能直接带宾语。','Transitive verbs take direct objects; intransitive verbs do not.'],['介词短语不是直接宾语。','A prepositional phrase is not a direct object.']], [q('She bought ___.','a book','at','A','buy 是及物动词，需要宾语。','buy is transitive and takes an object.'),q('He arrived ___.','the station','at the station','B','arrive 后借助介词 at。','arrive needs at before the place.'),q('The child smiled. smiled 是？','不及物','及物','A','此处没有宾语，smile 不及物。','smile is intransitive here.')]),
    lesson(en, 'linking', '系动词与表语', 'Linking verbs and complements', 'be、感官与变化', 'Be · senses · changes', [
      s([['She','subject'],['is','predicate'],['a doctor.','predicative']]), s([['The music','subject'],['sounds','predicate'],['beautiful.','predicative']]), s([['The leaves','subject'],['turned','predicate'],['yellow.','predicative']])
    ], [['表语说明主语的身份、性质或状态，不是动作承受者。','A subject complement identifies or describes the subject; it is not an object.'],['常见系动词有 be、look、sound、feel、become、turn。','Common linking verbs include be, look, sound, feel, become and turn.']], [q('The cake tastes ___.','delicious','deliciously','A','系动词后用形容词作表语。','Use an adjective after a linking verb.'),q('He became ___.','a teacher','a teacher to','A','a teacher 作表语。','a teacher is the complement.'),q('The sky grew dark. dark 是？','表语','宾语','A','dark 描述 sky。','dark describes the sky.')]),
    lesson(en, 'aux-modal', '助动词与情态动词', 'Auxiliaries and modal verbs', '构成结构，不抢实义', 'Building grammatical structures', [
      s([['She','subject'],['does not','auxiliary'],['like','predicate'],['coffee.','object']]), s([['They','subject'],['are','auxiliary'],['working.','predicate']]), s([['You','subject'],['must','modal'],['finish','predicate'],['today.','adverbial','时间状语','Time adverbial']])
    ], [['助动词构成否定、疑问、时态或语态；情态动词表达能力、许可、义务等。','Auxiliaries form negatives, questions, tense or voice; modals express ability, permission, obligation and more.'],['情态动词后接动词原形。','A modal is followed by the base verb.']], [q('She ___ swim.','can','cans','A','can 后接原形。','can takes the base form.'),q('___ he like tea?','Does','Is','A','一般现在时实义动词问句用 Does。','Use Does for this present-simple question.'),q('They are reading. are 是？','助动词','宾语','A','are 与 reading 构成进行时。','are helps form the progressive.')]),
    lesson(en, 'finite-forms', '谓语动词随什么变化', 'Finite verb forms', '时态、人称与数', 'Tense · person · number', [
      f('I play → She plays','spelling','一般现在时第三人称单数改变谓语形式。','The third-person singular changes the present-simple verb.'), f('They work → They worked','spelling','规则过去式通常加 -ed。','Regular past forms normally add -ed.'), f('He is → They are','structure','be 随主语人称和数变化。','be agrees with the subject in person and number.'),
      f('She wants to leave.','structure','简单句只有一个限定谓语 wants；to leave 是非谓语部分。','The simple sentence has one finite predicate, wants; to leave is non-finite.')
    ], [['限定动词体现时态，并可能随主语人称和数变化。','A finite verb marks tense and may agree with the subject.'],['be 的现在时形式必须与主语的人称和数一致。','Present forms of be must agree with the subject in person and number.'],['一个简单句通常只有一个限定谓语核心，非谓语不另算谓语。','A simple clause normally has one finite predicate core; a non-finite form is not another finite predicate.']], [q('She ___ every day.','runs','run','A','第三人称单数用 runs。','Use runs with third-person singular.'),q('Yesterday we ___.','worked','work','A','yesterday 要求过去式。','yesterday calls for the past form.'),q('The boys ___ happy.','are','is','A','复数主语用 are。','Use are with a plural subject.'),q('In “She wants to leave,” the finite predicate is ...','wants','to leave','A','限定谓语是 wants。','The finite predicate is wants.')]),
    lesson(en, 'tense-aspect', '时态表达什么', 'Tense and aspect', '时间与动作状态', 'Time and the state of an action', [
      s([['I','subject'],['study','predicate'],['English','object'],['every day.','adverbial','频率状语','Frequency adverbial']]), s([['I','subject'],['am studying','predicate'],['now.','adverbial','时间状语','Time adverbial']]), s([['I','subject'],['have finished','predicate'],['my homework.','object']])
    ], [['一般时表达习惯或事实，进行时突出正在进行，完成时连接过去与当前结果。','Simple forms express habits or facts, progressive forms ongoing actions, and perfect forms a past-to-present result.'],['时间标志帮助判断，但最终要看语境意义。','Time markers help, but meaning decides the tense.']], [q('Look! The dog ___.','is running','runs every day','A','Look 提示正在发生。','Look signals an action in progress.'),q('She ___ here since 2020.','has lived','lived yesterday','A','since 连接过去到现在。','since links past and present.'),q('Water ___ at 100°C.','boils','is boiling always','A','客观事实用一般现在时。','Use present simple for facts.')]),
    lesson(en, 'nonfinite', '非谓语动词基础', 'Non-finite verb basics', 'to do、doing、done', 'to do · doing · done', [
      s([['She','subject'],['wants','predicate'],['to leave.','object','不定式作宾语','Infinitive as object']]), s([['Swimming','subject','动名词作主语','Gerund as subject'],['is','predicate'],['good exercise.','complement']]), s([['The broken window','subject','含过去分词前置定语的主语','Subject with participial attribute'],['needs','predicate'],['repair.','object']],'translation','broken 前置修饰 window，中文同样译为“破损的窗户”。','broken modifies window before the noun here.')
    ], [['非谓语动词不能独立充当句子的限定谓语。','A non-finite verb cannot serve alone as the finite predicate.'],['to do 常表目的或未发生，doing 有名词/进行意味，done 常有被动或完成意味。','to do often suggests purpose or prospect; doing has nominal/progressive force; done often suggests passive/completed meaning.']], [q('I hope ___ you.','to see','saw','A','hope 后常接 to do。','hope commonly takes to do.'),q('___ is fun.','Reading','Read yesterday','A','Reading 可作主语。','Reading can act as subject.'),q('the ___ door','closed','closing by someone','A','closed 作定语表示已关闭。','closed is a participial modifier.')]),
    lesson(en,'double-object-complement','双宾语与宾语补足语','Two objects and object complements','谁收到什么；宾语变得怎样','Receiver + thing; object + description',[s([['Mum','subject'],['gave','predicate'],['me','indirectObject'],['a gift.','directObject']]),s([['Mum','subject'],['gave','predicate'],['a gift','directObject'],['to','preposition'],['me.','prepositionalObject']]),s([['They','subject'],['painted','predicate'],['the door','object'],['red.','objectComplement']])],[['双宾语按“间接宾语（人）＋直接宾语（物）”排列。','Two objects normally follow the order indirect receiver + direct thing.'],['give/send/show 等可改为“物＋to＋人”，buy/make 等常用 for。','give/send/show can use thing + to + person; buy/make often use for.'],['宾语补足语说明宾语的身份、状态或动作，和宾语构成逻辑主谓关系。','An object complement identifies, describes or predicates an action of the object.']],[bq('She sent ___。','She sent ...','我一封邮件','me an email','一封邮件给我','an email to me','A','双宾语是“人＋物”。','Use receiver + thing.'),bq('He bought a cake ___ me.','He bought a cake ___ me.','to','to','for','for','B','buy 的受益者常用 for。','Use for with the beneficiary of buy.'),bq('We found the task ___.','We found the task ...','困难的','difficult','困难地','difficultly','A','difficult 作宾语补足语。','difficult is the object complement.')]),
    lesson(en,'verb-five-forms','动词五种基本形式','The five principal forms','原形、三单、过去式、过去分词、-ing','Base · third singular · past · participle · -ing',[f('work · works · worked · worked · working','spelling','规则动词由原形按规则构成其余形式。','A regular verb forms the other principal forms regularly.'),f('go · goes · went · gone · going','spelling','不规则动词的过去式和过去分词要分别记忆。','For an irregular verb, learn past and past participle separately.'),f('write · writes · wrote · written · writing','spelling','过去式 wrote 与过去分词 written 不能混用。','Do not confuse past wrote with participle written.')],[['五种形式承担不同结构任务，不能只记中文词义。','The five forms serve different grammatical structures; meaning alone is insufficient.'],['规则动词的过去式和过去分词通常同形。','A regular verb normally has identical past and past-participle forms.'],['不规则动词的过去式和过去分词可能不同，必须成组记忆。','An irregular verb may have different past and participle forms and must be learned as a set.']],[bq('哪一项是 work 的 -ing 形式？','Which is the -ing form of work?','working','working','worked','worked','A','working 是 -ing 形式。','working is the -ing form.'),bq('规则动词 play 的过去分词是？','What is the past participle of regular play?','played','played','playing','playing','A','规则过去分词为 played。','The regular participle is played.'),bq('write 的过去分词是？','What is the past participle of write?','wrote','wrote','written','written','B','written 是过去分词。','written is the past participle.')]),
    lesson(en,'third-person-form','第三人称单数的拼写与发音','Third-person singular spelling and sound','-s、-es、y→ies · /s/、/z/、/ɪz/','-s · -es · y→ies · /s/ · /z/ · /ɪz/',[f('play → plays · run → runs','spelling','大多数动词直接加 -s。','Most verbs add -s.'),f('watch → watches · go → goes','spelling','s/x/ch/sh/o 结尾通常加 -es。','Verbs ending in s/x/ch/sh/o normally add -es.'),f('study → studies · have → has','spelling','辅音字母+y 变 ies；have 变 has。','Consonant+y changes to ies; have becomes has.'),f('likes /s/','sound','非咝音的清辅音后，词尾读 /s/。','After a voiceless non-sibilant sound, the ending is /s/.'),f('plays /z/ · runs /z/','sound','元音或非咝音的浊辅音后，词尾读 /z/。','After a vowel or voiced non-sibilant sound, the ending is /z/.'),f('watches /ɪz/ · washes /ɪz/','sound','咝音后，-es 构成额外的 /ɪz/ 音节。','After a sibilant, -es forms an extra /ɪz/ syllable.')],[['大多数动词第三人称单数直接加 -s。','Most verbs add -s in the third-person singular.'],['s、x、ch、sh、o 结尾通常加 -es。','Verbs ending in s, x, ch, sh or o normally add -es.'],['辅音字母+y 变 -ies；have、be 是高频特殊变化。','Consonant+y changes to -ies; have and be are common irregular forms.'],['非咝音的清辅音后，词尾读 /s/。','After a voiceless non-sibilant sound, the ending is /s/.'],['元音或非咝音的浊辅音后，词尾读 /z/。','After a vowel or voiced non-sibilant sound, the ending is /z/.'],['咝音后，-es 读 /ɪz/ 并增加一个音节。','After a sibilant, -es is /ɪz/ and adds a syllable.']],[bq('She ___ tennis.','She ___ tennis.','打 plays','plays','打 play','play','A','第三人称单数加 s。','The third-person singular adds s.'),bq('He ___ TV.','He ___ TV.','watches','watches','watchs','watchs','A','watch 加 es。','watch adds es.'),bq('Tom ___ hard.','Tom ___ hard.','studys','studys','studies','studies','B','study 变 studies。','study changes to studies.'),bq('likes 的词尾读什么？','How does the ending of likes sound?','/s/','/s/','/z/','/z/','A','likes 的词尾读 /s/。','likes ends in /s/.'),bq('plays 的词尾读什么？','How does the ending of plays sound?','/s/','/s/','/z/','/z/','B','plays 的词尾读 /z/。','plays ends in /z/.'),bq('watches 的词尾读什么？','How does the ending of watches sound?','/z/','/z/','/ɪz/','/ɪz/','B','watches 的词尾读 /ɪz/。','watches ends in /ɪz/.')]),
    lesson(en,'past-forms','过去式与过去分词拼写','Past and past-participle forms','规则变化与不规则变化','Regular and irregular formation',[f('work → worked · live → lived','spelling','一般加 -ed；已有 e 只加 -d。','Normally add -ed; after e add only -d.'),f('study → studied · stop → stopped','spelling','辅音+y 变 ied；重读闭音节双写末字母。','Consonant+y changes to ied; a final consonant doubles in the stressed CVC pattern.'),f('go → went → gone · see → saw → seen','spelling','不规则过去式和过去分词分别记忆。','Learn irregular past and participle forms separately.')],[['规则过去式一般加 -ed，词尾 e 后只加 -d。','Regular past forms add -ed, or only -d after final e.'],['辅音+y 变 -ied；符合条件的重读闭音节双写末辅音再加 -ed。','Consonant+y changes to -ied; eligible stressed CVC verbs double the final consonant.'],['不规则动词不能套 -ed，过去式与过去分词必须分别掌握。','Irregular verbs do not take -ed; learn past and participle separately.']],[bq('live 的过去式是？','What is the past form of live?','lived','lived','liveed','liveed','A','词尾 e 后加 d。','Add d after final e.'),bq('stop 的过去式是？','What is the past form of stop?','stoped','stoped','stopped','stopped','B','重读闭音节双写 p。','Double p in this stressed CVC verb.'),bq('go 的过去分词是？','What is the past participle of go?','went','went','gone','gone','B','gone 是过去分词。','gone is the past participle.')]),
    lesson(en,'subject-verb-agreement','主谓一致','Subject–verb agreement','找中心主语再定单复数','Find the head subject',[s([['The boy','subject'],['plays','predicate'],['football.','object']]),s([['The boy with his friends','subject','含后置定语的主语','Subject with postmodifier'],['plays','predicate'],['football.','object']],'translation','with his friends 后置修饰 boy，不改变中心词 boy 的单数。','with his friends modifies boy and does not change the singular head.'),s([['Tom and Jack','subject'],['play','predicate'],['football.','object']])],[['一般现在时中，第三人称单数主语使用三单谓语。','In the present simple, a third-person singular subject takes a third-singular verb.'],['介词短语等后置修饰语不改变中心主语的数。','A postmodifying prepositional phrase does not change the number of the head subject.'],['and 连接两个并列主语通常使用复数谓语。','Two subjects joined by and normally take a plural verb.']],[bq('Mary ___ every day.','Mary ___ every day.','跑 runs','runs','跑 run','run','A','Mary 是第三人称单数。','Mary is third-person singular.'),bq('The girl with two dogs ___ here.','The girl with two dogs ___ here.','live','live','lives','lives','B','中心主语 girl 是单数。','The singular head is girl.'),bq('Tom and Jack ___ here.','Tom and Jack ___ here.','lives','lives','live','live','B','and 并列主语用复数谓语。','The coordinated subject takes a plural verb.')]),
    lesson(en,'present-simple','一般现在时','Present simple','事实、习惯、时刻表与结构转换','Facts · habits · timetables · do/does',[s([['Water','subject'],['boils','predicate'],['at 100°C.','adverbial','条件状语','Condition adverbial']]),s([['She','subject'],['walks','predicate'],['to school every day.','adverbial','频率状语','Frequency adverbial']]),s([['Does','auxiliary'],['he','subject'],['like','predicate'],['music?','object']]),s([['The train','subject'],['leaves','predicate'],['at seven.','adverbial','时间状语','Time adverbial']])],[['一般现在时表达客观事实、状态和经常性动作。','The present simple expresses facts, states and habitual actions.'],['第三人称单数肯定句改变实义动词形式。','A third-person singular affirmative changes the lexical verb form.'],['实义动词的疑问和否定用 do/does，后面的动词恢复原形。','Questions and negatives with lexical verbs use do/does plus the base form.'],['固定时刻表可以用一般现在时表达将来安排。','A fixed timetable can use the present simple for a future event.']],[bq('太阳从东方升起。','The sun ___ in the east.','rises','rises','is rising now','is rising now','A','客观事实用一般现在时。','Use present simple for a fact.'),bq('She ___ English every day.','She ___ English every day.','study','study','studies','studies','B','第三人称单数用 studies。','Use studies with third-person singular.'),bq('___ he play chess?','___ he play chess?','Does','Does','Is','Is','A','实义动词问句用 Does＋原形。','Use Does + base verb.'),bq('The film ___ at eight tonight.','The film ___ at eight tonight.','starts','starts','will starting','will starting','A','固定时刻表可用 starts。','A fixed timetable can use starts.')]),
    lesson(en,'present-progressive','现在进行时','Present progressive','此刻进行与阶段性变化','Now · temporary situations · change',[s([['The baby','subject'],['is sleeping','predicate'],['now.','adverbial','时间状语','Time adverbial']]),s([['I','subject'],['am staying','predicate'],['with my aunt this week.','adverbial','时间状语','Time adverbial']]),s([['The weather','subject'],['is getting','predicate'],['warmer.','complement']])],[['现在进行时用 am/is/are＋doing，表达此刻正在进行。','The present progressive uses am/is/are + doing for action in progress now.'],['它也可表达现阶段的临时情况。','It can also express a temporary situation around now.'],['get、become 等进行形式可突出正在发生的变化。','Progressive get/become can highlight an ongoing change.']],[bq('Look! It ___.','Look! It ___.','rains','rains','is raining','is raining','B','Look 提示此刻正在发生。','Look signals action in progress.'),bq('This month I ___ by bus.','This month I ___ by bus.','am travelling','am travelling','travel always','travel always','A','this month 表示现阶段临时情况。','this month marks a temporary situation.'),bq('Days ___ longer.','Days ___ longer.','are getting','are getting','gets','gets','A','进行时突出变化过程。','The progressive highlights change.')]),
    lesson(en,'past-simple','一般过去时','Past simple','过去完成且与现在分开','Completed past events',[s([['We','subject'],['visited','predicate'],['Suzhou last year.','adverbial','时间状语','Time adverbial']]),s([['She','subject'],['did not see','predicate'],['him yesterday.','object']]),s([['Did','auxiliary'],['you','subject'],['finish','predicate'],['the work?','object']])],[['一般过去时表达过去某时发生并结束的动作或状态。','The past simple expresses a completed past action or state.'],['实义动词否定用 did not＋原形。','A lexical-verb negative uses did not + base form.'],['实义动词疑问用 Did＋主语＋原形。','A lexical-verb question uses Did + subject + base form.']],[bq('Last night we ___ a film.','Last night we ___ a film.','watched','watched','watch','watch','A','明确过去时间用过去式。','Use the past form with a definite past time.'),bq('She did not ___ home.','She did not ___ home.','went','went','go','go','B','did 后用原形。','Use the base form after did.'),bq('___ he call you?','___ he call you?','Did','Did','Was','Was','A','实义动词过去问句用 Did。','Use Did for this lexical-verb past question.')]),
    lesson(en,'past-progressive','过去进行时','Past progressive','过去某刻正在进行','Action in progress at a past time',[s([['I','subject'],['was reading','predicate'],['at eight last night.','adverbial','时间状语','Time adverbial']]),s([['They','subject'],['were playing','predicate'],['when it began to rain.','adverbial','时间状语从句','Time clause']]),s([['While Mum was cooking','adverbial','时间状语从句','Time clause'],['Dad','subject'],['was cleaning','predicate']])],[['过去进行时用 was/were＋doing，表示过去某时正在进行。','The past progressive uses was/were + doing for action in progress at a past time.'],['when 常引出短动作，打断正在进行的背景动作。','when often introduces a shorter event interrupting an ongoing background action.'],['while 常连接同时持续的动作。','while often links simultaneous continuing actions.']],[bq('At nine yesterday I ___.','At nine yesterday I ___.','was sleeping','was sleeping','slept every day','slept every day','A','过去具体时刻正在进行用过去进行时。','Use past progressive for action in progress then.'),bq('I was walking when he ___.','I was walking when he ___.','called','called','was call','was call','A','when 后短动作常用一般过去时。','The interrupting event uses past simple.'),bq('While I was reading, she ___.','While I was reading, she ___.','was writing','was writing','writes now','writes now','A','同时持续动作用过去进行时。','Use past progressive for simultaneous continuing action.')]),
    lesson(en,'future-forms','一般将来表达','Future forms','will、be going to 与进行时表安排','will · be going to · arranged future',[s([['I','subject'],['will call','predicate'],['you tonight.','adverbial','时间状语','Time adverbial']]),s([['Look at the clouds; it','subject'],['is going to rain.','predicate']]),s([['We','subject'],['are meeting','predicate'],['the teacher tomorrow.','adverbial','时间状语','Time adverbial']])],[['will＋原形可表达临时决定、预测、承诺等。','will + base form can express instant decisions, predictions and promises.'],['be going to 表示已有计划或有当前迹象的预测。','be going to expresses a prior plan or an evidence-based prediction.'],['现在进行时可表示已经安排好的近期将来。','The present progressive can express an arranged near future.']],[bq('I think it ___ fine tomorrow.','I think it ___ fine tomorrow.','will be','will be','is being','is being','A','一般预测可用 will。','Use will for a prediction.'),bq('Look at those clouds! It ___.','Look at those clouds! It ___.','is going to rain','is going to rain','rains every day','rains every day','A','当前迹象支持 going to。','Present evidence supports going to.'),bq('We ___ the doctor at 3 p.m. tomorrow.','We ___ the doctor at 3 p.m. tomorrow.','are seeing','are seeing','saw','saw','A','已安排事项可用现在进行时。','Use present progressive for an arrangement.')]),
    lesson(en,'five-sentence-patterns','动词决定五大基本句型','Verbs and the five basic patterns','SV、SVC、SVO、SVOO、SVOC','SV · SVC · SVO · SVOO · SVOC',[f('Birds fly. (SV) · She is kind. (SVC)','structure','不及物动词构成 SV；系动词构成 SVC。','Intransitive verbs form SV; linking verbs form SVC.'),f('I like music. (SVO) · Mum gave me a gift. (SVOO)','structure','及物动词可带一个或两个宾语。','Transitive verbs may take one or two objects.'),f('They made me happy. (SVOC)','structure','宾补说明宾语。','The object complement describes the object.')],[['SV 与 SVC 的区别是后者含系动词和主语补语。','SVC contains a linking verb and subject complement.'],['SVO 与 SVOO 分别含一个宾语和两个宾语。','SVO has one object; SVOO has two.'],['SVOC 中宾补对宾语进行说明或陈述。','In SVOC, the complement predicates something of the object.']],[bq('Birds sing. 属于？','“Birds sing” is ...','SV','SV','SVO','SVO','A','sing 此处不带宾语。','sing has no object.'),bq('She gave me a pen. 属于？','“She gave me a pen” is ...','SVO','SVO','SVOO','SVOO','B','句中有两个宾语。','There are two objects.'),bq('We kept the room clean. 属于？','“We kept the room clean” is ...','SVOC','SVOC','SVC','SVC','A','clean 补充说明 room。','clean complements room.')]),
    lesson(en,'auxiliary-system','be、do、have 作助动词','Be, do and have as auxiliaries','进行/被动、疑问否定、完成','Progressive/passive · do-support · perfect',[s([['They','subject'],['are','auxiliary'],['working.','predicate']]),s([['Do','auxiliary'],['you','subject'],['know','predicate'],['him?','object']]),s([['She','subject'],['has','auxiliary'],['finished','predicate'],['the task.','object']])],[['be＋doing 构成进行体，be＋done 构成被动。','be + doing forms the progressive; be + done the passive.'],['do/does/did 帮助一般时实义动词构成疑问、否定和强调。','do/does/did supplies questions, negatives and emphasis in simple tenses.'],['have/has/had＋过去分词构成完成体。','have/has/had + participle forms the perfect.']],[bq('They are playing. are 的作用？','What does are do here?','构成进行时','form the progressive','表示拥有','mean possession','A','are＋playing 构成进行时。','are + playing forms the progressive.'),bq('___ she like it?','___ she like it?','Does','Does','Has','Has','A','一般现在时问句用 Does。','Use Does.'),bq('He has left. has 的作用？','What does has do here?','构成完成时','form the perfect','构成被动','form the passive','A','has＋left 构成完成时。','has + left forms the perfect.')]),
    lesson(en,'modal-meanings','情态动词的核心意义','Core modal meanings','能力许可、义务建议、推测','Ability/permission · obligation/advice · deduction',[f('can/could: ability or permission','structure','can/could 表能力或许可。','can/could express ability or permission.'),f('must/have to/should: obligation or advice','structure','三者表达不同强度或来源的义务与建议。','They express different force or source of obligation/advice.'),f('may/might/must/can’t: probability','structure','按证据强弱表达可能与推测。','They express degrees of possibility and deduction.')],[['can/could 表能力或许可，后接原形。','can/could express ability or permission and take a base verb.'],['must、have to、should 表达义务、客观需要或建议。','must, have to and should express obligation, necessity or advice.'],['may/might、must、can’t 可表达不同把握程度的推测。','may/might, must and can’t express degrees of deduction.']],[bq('___ I use your phone?','___ I use your phone?','May','May','Must','Must','A','May 可请求许可。','May asks permission.'),bq('You look tired. You ___ rest.','You look tired. You ___ rest.','should','should','can’t','can’t','A','should 表建议。','should gives advice.'),bq('The light is on. He ___ be home.','The light is on. He ___ be home.','must','must','can’t','can’t','A','must 表肯定推测。','must marks strong deduction.')]),
    lesson(en,'perfect-vs-past','现在完成时与一般过去时','Present perfect versus past simple','经历、延续、明确过去','Experience · duration · finished past',[s([['I','subject'],['have visited','predicate'],['Beijing twice.','adverbial','次数状语','Frequency adverbial']]),s([['She','subject'],['has lived','predicate'],['here since 2020.','adverbial','时间状语','Time adverbial']]),s([['We','subject'],['visited','predicate'],['Beijing last year.','adverbial','时间状语','Time adverbial']])],[['现在完成时可表达截至现在的经历或当前结果。','The present perfect expresses experience up to now or a present result.'],['since/for 表示从过去延续到现在时应使用延续性表达。','With since/for, use a durative expression for continuation to now.'],['明确结束的过去时间通常用一般过去时。','A definite finished past time normally takes past simple.']],[bq('I ___ this film twice.','I ___ this film twice.','have seen','have seen','saw yesterday','saw yesterday','A','twice 表截至现在的经历。','twice marks experience up to now.'),bq('He ___ here for five years.','He ___ here for five years.','has lived','has lived','has arrived','has arrived','A','延续时间用 live。','Use durative live.'),bq('She ___ yesterday.','She ___ yesterday.','has left','has left','left','left','B','yesterday 用一般过去时。','yesterday requires past simple.')]),
    lesson(en,'passive-tenses','跨时态被动语态','Passive voice across tenses','一般、进行与完成被动','Simple · progressive · perfect passive',[f('is made · was made · will be made','structure','一般时被动改变 be 的时态。','Simple passives change the tense of be.'),f('is being repaired · was being repaired','structure','进行时被动为 be＋being＋done。','A progressive passive uses be + being + done.'),f('has been finished · had been finished','structure','完成时被动为 have＋been＋done。','A perfect passive uses have + been + done.')],[['一般时被动为相应时态的 be＋过去分词。','A simple passive uses the relevant form of be + participle.'],['进行时被动用 be＋being＋过去分词。','A progressive passive uses be + being + participle.'],['完成时被动用 have/has/had＋been＋过去分词。','A perfect passive uses have/has/had + been + participle.']],[bq('The room ___ every day.','The room ___ every day.','is cleaned','is cleaned','cleans','cleans','A','一般现在被动用 is cleaned。','Use is cleaned.'),bq('The road ___ now.','The road ___ now.','is being repaired','is being repaired','repairs','repairs','A','正在被修用进行被动。','Use the progressive passive.'),bq('The work ___ already.','The work ___ already.','has been finished','has been finished','has finished itself','has finished itself','A','完成被动用 has been done。','Use has been + participle.')]),
    lesson(en,'future-in-clauses','主将从现','Present tense in future clauses','条件、时间与让步从句','Condition · time · concession',[s([['If it rains','adverbial','条件状语从句','Condition clause'],['we','subject'],['will stay','predicate'],['home.','adverbial','地点状语','Place adverbial']]),s([['I','subject'],['will call','predicate'],['you when I arrive.','adverbial','时间状语从句','Time clause']]),s([['Even if he is busy','adverbial','让步状语从句','Concession clause'],['he','subject'],['will help.','predicate']])],[['真实将来条件句中，if 从句用一般现在时。','In a real future condition, the if-clause uses present simple.'],['when/as soon as/until 等将来时间从句用一般现在时。','Future time clauses with when/as soon as/until use present simple.'],['even if 等将来让步从句通常不用 will。','Future concession clauses with even if normally avoid will.']],[bq('If it ___, we will leave.','If it ___, we will leave.','stops','stops','will stop','will stop','A','if 从句用一般现在时。','Use present simple.'),bq('I will tell her when she ___.','I will tell her when she ___.','comes','comes','will come','will come','A','when 从句用一般现在时。','Use present simple.'),bq('Even if he ___ busy, he will come.','Even if he ___ busy, he will come.','is','is','will be','will be','A','让步从句不用 will。','Avoid will in the concession clause.')]),
    lesson(en,'past-time-sequence','过去完成、过去将来与时态呼应','Past perfect, future-in-the-past and sequence','过去之前与过去视角','Earlier past and past viewpoint',[s([['The train','subject'],['had left','predicate'],['before we arrived.','adverbial','时间状语从句','Time clause']]),s([['He','subject'],['said','predicate'],['he would return.','object','宾语从句','Object clause']]),s([['She','subject'],['said','predicate'],['she was tired.','object','宾语从句','Object clause']])],[['过去完成时 had＋done 表示“过去的过去”。','Past perfect had + done expresses an earlier past.'],['would＋原形表示过去视角的将来。','would + base expresses future viewed from the past.'],['过去主句后的宾语从句通常按过去视角调整，客观真理除外。','An object clause after past reporting normally shifts to a past viewpoint; universal truths are excepted.']],[bq('By then the film ___.','By then the film ___.','had started','had started','will start','will start','A','先发生用过去完成时。','Use past perfect for the earlier event.'),bq('He said he ___ come.','He said he ___ come.','would','would','will','will','A','过去将来用 would。','Use would.'),bq('She said she ___ ill.','She said she ___ ill.','was','was','is yesterday','is yesterday','A','从句按过去视角调整。','Shift to the past viewpoint.')]),
    lesson(en,'infinitive','不定式 to do','The infinitive','名词功能、定语、状语','Nominal roles · attribute · adverbial',[s([['To learn English','subject','不定式作主语','Infinitive as subject'],['takes','predicate'],['time.','object']]),s([['I','subject'],['need','predicate'],['a pen to write with.','object','含不定式后置定语的宾语','Object with infinitive postmodifier']]),s([['She','subject'],['got up','predicate'],['early to catch the bus.','adverbial','目的状语','Purpose adverbial']])],[['不定式可作主语、宾语或表语。','An infinitive can be subject, object or complement.'],['不定式可后置修饰名词或代词。','An infinitive can postmodify a noun or pronoun.'],['不定式常作目的状语，也可表结果或原因。','An infinitive commonly marks purpose and can mark result or cause.']],[bq('___ a language takes time.','___ a language takes time.','To learn','To learn','Learned','Learned','A','不定式可作主语。','An infinitive can be subject.'),bq('I need something ___.','I need something ___.','to eat','to eat','ate','ate','A','不定式后置修饰 something。','The infinitive postmodifies something.'),bq('He went out ___ milk.','He went out ___ milk.','to buy','to buy','bought','bought','A','不定式表目的。','The infinitive marks purpose.')]),
    lesson(en,'gerund','动名词 doing','The gerund','主语、动词宾语、介词宾语','Subject · verb object · preposition object',[s([['Reading','subject','动名词作主语','Gerund as subject'],['helps','predicate'],['us.','object']]),s([['She','subject'],['enjoys','predicate'],['dancing.','object','动名词作宾语','Gerund as object']]),s([['He','subject'],['left','predicate'],['without','preposition'],['saying goodbye.','prepositionalObject']])],[['动名词可作主语或表语。','A gerund can act as subject or complement.'],['enjoy、finish、mind、avoid、practice 等后接 doing。','enjoy, finish, mind, avoid and practice take doing.'],['介词后接 doing，不接 to do；介词 to 后也一样。','A preposition takes doing, not an infinitive; this includes prepositional to.']],[bq('___ is useful.','___ is useful.','Reading','Reading','To read','To read','A','动名词可作主语。','A gerund can be subject.'),bq('She enjoys ___.','She enjoys ___.','reading','reading','to read','to read','A','enjoy 后接 doing。','enjoy takes doing.'),bq('He left without ___.','He left without ___.','speaking','speaking','to speak','to speak','A','介词后接 doing。','Use doing after a preposition.')]),
    lesson(en,'participles','现在分词与过去分词','Present and past participles','主动进行与被动完成','Active/ongoing versus passive/completed',[s([['The crying baby','subject','现在分词作前置定语','Present-participle attribute'],['woke','predicate'],['me.','object']]),s([['The book written by Lu Xun','subject','过去分词短语作后置定语','Past-participle postmodifier'],['is','predicate'],['famous.','complement']],'translation','written by Lu Xun 后置修饰 book，中文前移。','The postmodifier moves before the noun in Chinese.'),s([['Walking home','adverbial','时间/伴随状语','Time/accompanying adverbial'],['she','subject'],['saw','predicate'],['Tom.','object']])],[['doing 分词通常含主动或进行意义。','An -ing participle normally carries active or ongoing meaning.'],['done 分词通常含被动或完成意义。','A past participle normally carries passive or completed meaning.'],['分词短语可作定语或状语，状语分词的逻辑主语通常与主句主语一致。','A participial phrase can modify a noun or clause; an adverbial participle normally shares the main subject.']],[bq('the ___ girl','the ___ girl','smiling','smiling','smiled by someone','smiled by someone','A','主动关系用 smiling。','Use smiling for the active relation.'),bq('the letter ___ yesterday','the letter ___ yesterday','written','written','writing itself','writing itself','A','被动完成关系用 written。','Use written for a passive completed relation.'),bq('___ home, I met Tom.','___ home, I met Tom.','Walking','Walking','Walked by me','Walked by me','A','Walking 的逻辑主语是 I。','I is the understood subject.')]),
    lesson(en,'causative-perception','使役与感官动词','Causative and perception verbs','宾语＋原形或 doing','Object + base or doing',[s([['The joke','subject'],['made','predicate'],['us laugh.','object','宾语＋原形宾补','Object + base complement']]),s([['I','subject'],['saw','predicate'],['him cross the road.','object','宾语＋原形宾补','Object + base complement']]),s([['I','subject'],['saw','predicate'],['him crossing the road.','object','宾语＋现在分词宾补','Object + -ing complement']])],[['make/let＋宾语＋原形；make 的被动结构恢复 to。','make/let take object + base; passive make restores to.'],['see/hear/watch＋宾语＋原形强调完整过程。','Perception verb + object + base emphasizes a complete event.'],['see/hear/watch＋宾语＋doing 强调动作正在进行。','Perception verb + object + doing emphasizes action in progress.']],[bq('The teacher made us ___.','The teacher made us ___.','wait','wait','to wait','to wait','A','主动 make 后用原形。','Active make takes a base verb.'),bq('I saw him ___ and leave.','I saw him ___ and leave.','enter','enter','entered','entered','A','完整过程用原形。','Use the base for the complete event.'),bq('I saw him ___ when I arrived.','I saw him ___ when I arrived.','crossing','crossing','crossed already','crossed already','A','正在进行用 doing。','Use doing for action in progress.')]),
    lesson(en,'gerund-infinitive-meaning','doing 与 to do 的意义变化','Meaning changes with doing and to do','remember、stop、try','remember · stop · try',[f('remember doing ↔ remember to do','structure','记得做过 ↔ 记得要做。','Recall a past action ↔ remember a duty.'),f('stop doing ↔ stop to do','structure','停止该动作 ↔ 停下来去做另一动作。','End the action ↔ pause to do another.'),f('try doing ↔ try to do','structure','试用办法 ↔ 努力完成。','Test a method ↔ make an effort.')],[['remember/forget doing 指已发生动作；to do 指未完成责任。','remember/forget doing recalls a past action; to do concerns a duty.'],['stop doing 停止该动作；stop to do 停下来做另一事。','stop doing ends the action; stop to do pauses for another.'],['try doing 试验方法；try to do 努力完成。','try doing tests a method; try to do makes an effort.']],[bq('记得关灯（还没关）','Remember the duty to turn off the light.','remember doing','remember doing','remember to do','remember to do','B','未完成责任用 to do。','Use to do for a duty.'),bq('他戒烟了。','He ended the activity of smoking.','stopped smoking','stopped smoking','stopped to smoke','stopped to smoke','A','停止该动作用 doing。','Use doing to end the activity.'),bq('试试重启电脑。','Test restarting as a method.','try restarting','try restarting','try to restart with effort','try to restart with effort','A','试用方法用 doing。','Use doing to test a method.')]),
    lesson(en,'nonfinite-advanced','非谓语被动式与完成式','Passive and perfect non-finite forms','to be done、being done、having done','to be done · being done · having done',[f('to be invited · being praised','structure','非谓语被动式保留被动关系。','Passive non-finite forms retain a passive relation.'),f('to have finished · having finished','structure','完成式表示先于谓语动作。','Perfect forms mark action prior to the finite verb.'),f('Having finished the work, she left.','structure','逻辑主语 she 同时执行 finish 和 leave。','she is the understood subject of both actions.')],[['to be done/being done 表被动关系。','to be done/being done marks a passive relation.'],['to have done/having done 表示动作先于谓语。','to have done/having done marks prior action.'],['非谓语逻辑主语必须清楚，状语分词通常与主句主语一致。','The understood subject must be clear; an adverbial participle normally shares the main subject.']],[bq('He hopes ___.（被邀请）','He hopes ___. (passive)','to be invited','to be invited','to invite','to invite','A','he 是动作承受者。','He receives the action.'),bq('She seems ___ it.','She seems ___ it.','to have finished','to have finished','finish yesterday','finish yesterday','A','完成式表先发生。','The perfect form marks prior action.'),bq('___ the work, she left.','___ the work, she left.','Having finished','Having finished','Finished by him','Finished by him','A','she 是两个动作的逻辑主语。','she is the shared subject.')]),
    lesson(en,'agreement-complex','复杂主谓一致','Complex subject–verb agreement','就近、中心词、不定代词与主语结构','Proximity · head noun · indefinites · subject structures',[s([['Either Tom or his friends','subject'],['are','predicate'],['coming.','complement']]),s([['Tom, together with his friends','subject'],['is','predicate'],['here.','complement']]),s([['Everyone','subject'],['has','predicate'],['a ticket.','object']]),s([['Swimming','subject','动名词短语作主语','Gerund phrase as subject'],['keeps','predicate'],['us healthy.','object']]),s([['To read every day','subject','不定式短语作主语','Infinitive phrase as subject'],['improves','predicate'],['your English.','object']]),s([['What he says','subject','主语从句','Subject clause'],['sounds','predicate'],['true.','complement']])],[['either...or、neither...nor、not only...but also 常按就近原则。','With either...or, neither...nor and not only...but also, agreement often follows the nearer subject.'],['with、together with、as well as 不改变前面中心主语的数。','with, together with and as well as do not change the head subject’s number.'],['everyone、each、either、neither 等通常按单数处理。','everyone, each, either and neither normally take singular agreement.'],['动名词短语表示一个活动时通常按单数处理。','A gerund phrase naming one activity normally takes singular agreement.'],['不定式短语作主语时通常按一个单数单位处理。','An infinitive phrase as subject is normally treated as one singular unit.'],['主语从句通常整体视为一个单数单位。','A subject clause is normally treated as one singular unit.']],[bq('Either Tom or the boys ___ ready.','Either Tom or the boys ___ ready.','is','is','are','are','B','就近主语 boys 为复数。','The nearer subject is plural.'),bq('Tom, with his friends, ___ here.','Tom, with his friends, ___ here.','lives','lives','live','live','A','中心主语 Tom 是单数。','The head Tom is singular.'),bq('Everyone ___ a book.','Everyone ___ a book.','has','has','have','have','A','everyone 按单数。','everyone is singular.'),bq('Reading books ___ her relax.','Reading books ___ her relax.','help','help','helps','helps','B','Reading books 整体表示一个活动。','Reading books is one activity.'),bq('To stay calm ___ practice.','To stay calm ___ practice.','require','require','requires','requires','B','不定式短语整体按单数。','The infinitive phrase is one subject.'),bq('What he needs ___ more time.','What he needs ___ more time.','is','is','are','are','A','主语从句整体按单数。','The subject clause is one unit.')]),
    lesson(en,'ing-forms','-ing 形式拼写','Spelling the -ing form','直接加、去 e、双写与 ie→y','Add · drop e · double · ie→y',[f('work → working · play → playing','spelling','大多数动词直接加 -ing。','Most verbs add -ing directly.'),f('write → writing · run → running','spelling','不发音 e 通常去掉；重读闭音节双写末辅音。','Normally drop silent e; double the final consonant in an eligible stressed CVC verb.'),f('lie → lying · die → dying','spelling','-ie 结尾变 y 再加 -ing。','Change final -ie to y before -ing.')],[['大多数动词直接加 -ing。','Most verbs add -ing directly.'],['不发音 e 通常去掉；符合条件的重读闭音节双写末辅音。','Normally drop silent e; eligible stressed CVC verbs double the final consonant.'],['-ie 结尾变 y 再加 -ing。','Change final -ie to y before adding -ing.']],[bq('work 的 -ing 形式是？','What is the -ing form of work?','working','working','workking','workking','A','直接加 ing。','Add ing directly.'),bq('run 的 -ing 形式是？','What is the -ing form of run?','runing','runing','running','running','B','双写 n 再加 ing。','Double n before ing.'),bq('lie 的 -ing 形式是？','What is the -ing form of lie?','lying','lying','lieing','lieing','A','ie 变 y。','Change ie to y.')]),
    lesson(en,'special-verb-patterns','高频特殊动词结构','High-frequency special patterns','used to、had better、would rather','used to · had better · would rather',[f('used to do · be used to doing','structure','过去常常做 ↔ 习惯于做。','Former habit ↔ be accustomed to.'),f('had better do · had better not do','structure','had better 后接原形，否定为 had better not do。','had better takes a base; the negative is had better not do.'),f('would rather do than do','structure','would rather 后接原形，可用 than 表取舍。','would rather takes a base and may contrast with than.')],[['used to＋原形表示过去习惯；be used to＋doing 表示习惯于。','used to + base marks a former habit; be used to + doing means be accustomed to.'],['had better (not)＋原形表示较强建议。','had better (not) + base gives strong advice.'],['would rather＋原形表示宁愿，比较时常用 than。','would rather + base expresses preference, often with than.']],[bq('He ___ get up late, but now he rises early.','He ___ get up late, but now he rises early.','used to','used to','is used to','is used to','A','过去习惯用 used to do。','Use used to do for a former habit.'),bq('You had better ___ late.','You had better ___ late.','not be','not be','not to be','not to be','A','had better not 后接原形。','Use had better not + base.'),bq('I would rather ___ home.','I would rather ___ home.','stay','stay','to stay','to stay','A','would rather 后接原形。','would rather takes a base.')]),
    lesson(en, 'phrasal', '短语动词与宾语位置', 'Phrasal verbs and object position', '动词＋副词/介词', 'Verb + particle/preposition', [
      f('turn on the light → turn the light on','structure','名词宾语可放在可分短语动词中间或后面。','A noun object may go between or after a separable phrasal verb.'), f('turn it on ✓ · turn on it ✗','structure','代词宾语必须放在可分短语动词中间。','A pronoun object must go between the verb and particle.'), f('look after the child','structure','介词型短语动词通常不可拆分。','Prepositional verbs are normally inseparable.')
    ], [['短语动词要作为意义整体学习，同时判断是否可分。','Learn a phrasal verb as a meaning unit and note whether it is separable.'],['代词位置是可分短语动词的高频考点。','Pronoun placement is a key test of separable phrasal verbs.']], [q('Please turn ___ on.','it','on it','A','代词放在 turn 与 on 之间。','Put the pronoun between turn and on.'),q('She looks ___ her sister.','after','her sister after','A','look after 不可拆。','look after is inseparable.'),q('pick up the box 的正确改写是？','pick it up','pick up it','A','代词必须居中。','The pronoun must go in the middle.')]),
    lesson(en, 'voice', '主动与被动', 'Active and passive voice', '关注施事还是承受者', 'Agent or receiver focus', [
      s([['Tom','subject'],['wrote','predicate'],['the letter.','object']]), s([['The letter','subject'],['was written','predicate'],['by Tom.','adverbial','施事者状语','Agent phrase']]), s([['English','subject'],['is spoken','predicate'],['worldwide.','adverbial','地点范围状语','Scope adverbial']])
    ], [['被动语态结构为 be＋过去分词，原宾语成为主语。','The passive uses be + past participle; the active object becomes subject.'],['施事者不重要或未知时常省略 by 短语。','Omit the by-phrase when the agent is unknown or unimportant.']], [q('The bridge ___ in 2010.','was built','built','A','被动需要 was built。','The passive needs was built.'),q('People speak English. 被动为？','English is spoken.','English speaks.','A','English 是动作承受者。','English receives the action.'),q('The window was broken. 这是？','被动结构','现在进行时','A','was＋过去分词构成被动。','was + past participle forms the passive.')]),
    lesson(en, 'verb-complements', '动词搭配综合辨析', 'Verb-pattern challenge', 'doing、to do 与双宾语', 'doing · to do · two objects', [
      s([['She','subject'],['enjoys','predicate'],['reading.','object','动名词作宾语','Gerund as object']]), s([['He','subject'],['decided','predicate'],['to leave.','object','不定式作宾语','Infinitive as object']]), s([['Mum','subject'],['gave','predicate'],['me','object','间接宾语','Indirect object'],['a gift.','object','直接宾语','Direct object']])
    ], [['不同动词选择不同补足结构，必须连同搭配学习。','Different verbs select different complement patterns; learn the pattern with the verb.'],['双宾语结构通常是“人＋物”，也可改为“物＋to/for＋人”。','The double-object pattern is usually person + thing and may alternate with thing + to/for + person.']], [q('enjoy ___','reading','to read only','A','enjoy 后接 doing。','enjoy takes doing.'),q('decide ___','to go','going only','A','decide 后接 to do。','decide takes to do.'),q('She sent me a card. me 是？','间接宾语','状语','A','me 表示接收者。','me is the indirect object.')])
  ], ['tense-aspect','nonfinite','past-progressive','past-time-sequence','participles','causative-perception','gerund-infinitive-meaning','nonfinite-advanced','agreement-complex','special-verb-patterns','verb-complements']);
  const explanations = {
    'verb-jobs': [
      ['fly 是谓语核心，直接说明 Birds 做什么。','fly is the predicate core and directly tells what Birds do.'],
      ['know 是谓语核心，the answer 是它所指向的宾语。','know is the predicate core, and the answer is its object.'],
      ['tastes 不表示“品尝”动作，而是连接 soup 和描述它的 good。','tastes does not mean an action of tasting here; it links soup with good.']
    ],
    transitivity: [
      ['opened 后直接接 the window；window 承受“打开”这个动作。','opened directly takes the window, which receives the action.'],
      ['cried 已能把动作说完整，后面不需要宾语。','cried completes the action without an object.'], null
    ],
    linking: [
      ['is 把 She 和身份 a doctor 连接起来。','is links She with the identity a doctor.'],
      ['sounds 把 music 和性质 beautiful 连接起来；beautiful 是表语。','sounds links the music with beautiful, which is the subject complement.'],
      ['turned 表示状态变化：leaves 变成了 yellow。','turned marks a change of state: the leaves became yellow.']
    ],
    'aux-modal': [
      ['does 帮助 like 构成否定；真正表达“喜欢”的仍是 like。','does helps like form the negative; like still carries the main meaning.'],
      ['are 和 working 合在一起构成现在进行时，不能分成两个谓语。','are and working together form the present progressive, not two predicates.'],
      ['must 表达“必须”，后面的 finish 保持原形。','must expresses obligation, and finish stays in the base form.']
    ],
    'double-object-complement': [
      ['gave 后先说接收者 me，再说被给予的东西 a gift。','After gave, me names the receiver and a gift names the thing given.'],
      ['a gift 仍是直接宾语；to me 用介词 to 引出接收者。','a gift remains the direct object; to introduces the receiver me.'],
      ['red 说明 the door 被刷成什么状态，所以是宾语补足语。','red describes the resulting state of the door, so it is an object complement.']
    ],
    'subject-verb-agreement': [
      ['中心主语 boy 是第三人称单数，所以谓语用 plays。','The head subject boy is third-person singular, so the verb is plays.'], null,
      ['Tom and Jack 是两个并列主语，所以谓语用原形 play。','Tom and Jack form a plural coordinated subject, so the verb is play.']
    ],
    'present-simple': [
      ['boils 表达不随眼前时刻改变的客观事实。','boils states a general fact, not an action limited to this moment.'],
      ['every day 表明这是习惯；主语 She 使 walk 变为 walks。','every day marks a habit, and She changes walk to walks.'],
      ['Does 承担疑问和三单标记，因此 like 恢复原形。','Does carries the question and agreement marking, so like returns to the base form.'],
      ['leaves 用一般现在时表达列车时刻表中的固定安排。','leaves uses the present simple for a fixed timetable.']
    ],
    'present-progressive': [
      ['is sleeping 表示婴儿此刻正在睡觉，now 明确当前时间。','is sleeping shows an action in progress now.'],
      ['am staying 表示 this week 这一阶段的临时居住。','am staying describes a temporary situation during this week.'],
      ['is getting 强调天气正处在逐渐变暖的变化过程中。','is getting highlights a change that is developing now.']
    ],
    'past-simple': [
      ['visited 把参观放在已结束的 last year。','visited places the completed visit in last year.'],
      ['did not 已标出过去和否定，see 因此使用原形。','did not marks past time and negation, so see stays in the base form.'],
      ['Did 把过去时移到句首，finish 恢复原形。','Did carries past time at the front, so finish returns to the base form.']
    ],
    'future-forms': [
      ['will call 表示说话时作出的承诺或决定。','will call expresses a promise or decision made at speaking time.'],
      ['眼前的 clouds 是证据，所以用 is going to 预测下雨。','The clouds are present evidence, so is going to predicts rain.'],
      ['are meeting 表示已经约好的近期安排。','are meeting expresses an arranged near-future event.']
    ],
    'auxiliary-system': [
      ['are 不单独表示动作；它和 working 一起构成进行体。','are does not name the action; with working it forms the progressive.'],
      ['Do 帮助 know 构成疑问，know 保持原形。','Do helps know form a question, and know stays in the base form.'],
      ['has 和 finished 合起来表示任务已经完成并与现在相关。','has and finished together show a completed action relevant now.']
    ],
    'perfect-vs-past': [
      ['have visited 说的是截至现在的两次经历，没有给出已结束的具体时间。','have visited counts experience up to now without a finished past time.'],
      ['since 2020 把居住从过去连到现在，所以用 has lived。','since 2020 connects the living from the past to now, so has lived is used.'],
      ['last year 是已结束的过去时间，所以用 visited。','last year is a finished past time, so visited is used.']
    ],
    'future-in-clauses': [
      ['will stay 表示主句将来；if 从句用 rains 表示实现条件。','will stay marks the future result, while rains states the condition.'],
      ['主句用 will call；when 从句虽然指将来，仍用 arrive。','The main clause uses will call; the future time clause still uses arrive.'],
      ['even if 从句用 is 表示将来的让步条件，不再加 will。','The even if clause uses is for the future concession without will.']
    ],
    infinitive: [
      ['To learn English 整体作主语，谓语 takes 仍用单数。','To learn English is one subject, so takes is singular.'],
      ['to write with 后置说明 pen 的用途；with 的宾语就是前面的 pen。','to write with postmodifies pen; pen supplies the understood object of with.'],
      ['to catch the bus 回答“为什么早起”，所以是不定式目的状语。','to catch the bus answers why she got up early, so it marks purpose.']
    ],
    gerund: [
      ['Reading 把“阅读”当作一项活动，整个词作主语。','Reading treats the action as an activity and serves as subject.'],
      ['enjoys 后需要宾语，dancing 用动名词形式填入这个位置。','enjoys needs an object, and the gerund dancing fills that position.'],
      ['without 是介词，后面的 saying goodbye 用 doing 作介词宾语。','without is a preposition, so saying goodbye is its gerund object.']
    ],
    voice: [
      ['主动句以动作执行者 Tom 为主语，the letter 是承受动作的宾语。','The active sentence makes the agent Tom subject and the letter object.'],
      ['被动句把 the letter 提为主语，用 was written 表示它承受动作。','The passive makes the letter subject and uses was written to show it receives the action.'],
      ['说话重点是 English 的使用范围，执行者不重要，所以省略 by 短语。','The focus is where English is spoken; the agent is unimportant and omitted.']
    ],
    'tense-aspect': [
      ['study 配合 every day，把学习看作反复发生的习惯。','study with every day presents the action as a repeated habit.'],
      ['am studying 配合 now，把动作放在当前进行的过程中。','am studying with now presents the action as in progress.'],
      ['have finished 把过去的完成和现在“作业已完成”的结果连起来。','have finished links past completion with the present result.']
    ],
    nonfinite: [
      ['wants 是限定谓语；to leave 受 wants 支配，不能单独作本句谓语。','wants is finite; to leave depends on it and is not another finite predicate.'],
      ['Swimming 把动作名词化后作主语，is 才是限定谓语。','Swimming turns the action into a subject; is is the finite predicate.'], null
    ],
    'past-progressive': [
      ['was reading 把阅读放在昨晚八点那个过去时刻的进行中。','was reading shows the action in progress at eight last night.'],
      ['were playing 是持续背景，began 是插入其中的短动作。','were playing is the ongoing background; began is the shorter interrupting event.'],
      ['while 连接两个同时持续的过去动作：做饭和打扫。','while links two continuing past actions happening at the same time.']
    ],
    'past-time-sequence': [
      ['had left 早于 arrived：火车先离开，我们后到达。','had left occurred before arrived: the train left first.'],
      ['said 在过去，would return 表示从那个过去时点看仍在未来。','said is past, and would return is future viewed from that past point.'],
      ['was tired 把“累”的状态放到 said 所在的过去视角。','was tired shifts the state into the past viewpoint set by said.']
    ],
    participles: [
      ['crying 表示 baby 主动发出哭声，并正在进行。','crying shows that the baby actively produces the ongoing action.'], null,
      ['Walking home 的逻辑主语是 she，表示她回家途中看到 Tom。','she is the understood subject of Walking home; she saw Tom on the way home.']
    ],
    'causative-perception': [
      ['us 是 made 的宾语，laugh 说明 us 做出的动作。','us is the object of made, and laugh predicates the action of us.'],
      ['cross 用原形，把过马路看作看到的完整过程。','cross uses the base form to present the complete event seen.'],
      ['crossing 用 doing，只聚焦看到时正在进行的片段。','crossing focuses on the action in progress at the moment of seeing.']
    ],
    'agreement-complex': [
      ['离谓语最近的 friends 是复数，所以用 are coming。','The nearer subject friends is plural, so the predicate is are coming.'],
      ['together with his friends 只是附加信息，中心主语 Tom 决定用 is。','together with his friends is added information; Tom controls singular is.'],
      ['Everyone 形式上按单数处理，所以用 has。','Everyone takes singular agreement, so has is used.'],
      ['Swimming 整体表示一项活动，所以谓语用 keeps。','Swimming names one activity, so the predicate is keeps.'],
      ['To read every day 整体作一个主语，所以用 improves。','To read every day is one subject, so improves is singular.'],
      ['What he says 是一个主语从句，整体按单数与 sounds 一致。','What he says is one subject clause and agrees with singular sounds.']
    ],
    'verb-complements': [
      ['enjoys 选择 doing 作宾语，所以这里用 reading。','enjoys selects an -ing object, so reading is used.'],
      ['decided 选择 to do 作宾语，所以这里用 to leave。','decided selects an infinitive object, so to leave is used.'],
      ['gave 后的 me 是接收者，a gift 是被给予的东西。','After gave, me is the receiver and a gift is the thing given.']
    ]
  };
  const byId = Object.fromEntries(bundle.course.map(item => [item.id, item]));
  const relabel = (id, exampleIndex, unitIndex, role, zh, english) => Object.assign(byId[id].analyses[exampleIndex][unitIndex], { role, label: pick(en, zh, english) });
  relabel('participles', 1, 2, 'predicative', '表语', 'Subject complement');
  byId['causative-perception'].analyses.forEach((analysis, index) => {
    const splitAt = index === 0 ? ['us', 'laugh.'] : index === 1 ? ['him', 'cross the road.'] : ['him', 'crossing the road.'];
    analysis.splice(2, 1,
      { text: splitAt[0], role: 'object', label: pick(en, '宾语', 'Object') },
      { text: splitAt[1], role: 'objectComplement', label: pick(en, '宾语补足语', 'Object complement') }
    );
  });
  byId['agreement-complex'].analyses[0].splice(1, 2, { text: 'are coming.', role: 'predicate', label: pick(en, '谓语动词', 'Predicate verb') });
  relabel('agreement-complex', 1, 2, 'predicative', '地点表语', 'Locative complement');
  byId['agreement-complex'].analyses[3].splice(2, 1,
    { text: 'us', role: 'object', label: pick(en, '宾语', 'Object') },
    { text: 'healthy.', role: 'objectComplement', label: pick(en, '宾语补足语', 'Object complement') }
  );
  relabel('agreement-complex', 5, 2, 'predicative', '表语', 'Subject complement');
  byId['verb-complements'].title = pick(en, '动词后的补足结构', 'Complement patterns after verbs');
  byId['verb-complements'].rules[0] = pick(en, '不同动词会选择不同的后接结构；判断时要看什么成分能补全该动词的意义。', 'Different verbs select different following structures; identify what completes each verb’s meaning.');
  const optionFixes = {
    'tense-aspect': [[0,1,'runs','runs'],[1,1,'lived','lived'],[2,1,'is boiling','is boiling']],
    nonfinite: [[1,1,'To read','To read'],[2,1,'closing','closing']],
    'third-person-form': [[0,0,'plays','plays'],[0,1,'play','play']],
    'subject-verb-agreement': [[0,0,'runs','runs'],[0,1,'run','run']],
    'past-progressive': [[0,1,'read','read'],[1,1,'was calling','was calling'],[2,1,'cleaned','cleaned']],
    'perfect-vs-past': [[0,1,'visited','visited'],[1,1,'lived','lived'],[2,1,'have visited','have visited']],
    'passive-tenses': [[2,1,'has finished','has finished']],
    'past-time-sequence': [[2,1,'is','is']],
    participles: [[0,1,'smiled','smiled'],[1,1,'writing','writing'],[2,1,'Walked','Walked']],
    'causative-perception': [[2,1,'crossed','crossed']],
    'gerund-infinitive-meaning': [[2,1,'try to restart','try to restart']],
    'nonfinite-advanced': [[1,1,'to finish','to finish'],[2,1,'Finishing','Finishing']],
    'verb-complements': [[0,1,'to read','to read'],[1,1,'going','going']]
  };
  Object.entries(optionFixes).forEach(([id, fixes]) => fixes.forEach(([questionIndex, optionIndex, zh, english]) => {
    byId[id].questions[questionIndex].options[optionIndex].text = pick(en, zh, english);
  }));
  bundle.course.forEach(item => item.exampleNotes.forEach((note, index) => {
    if (note.visible) return;
    const pair = explanations[item.id] && explanations[item.id][index];
    if (!pair) throw new Error(`Missing verb example explanation: ${item.id}[${index}]`);
    item.exampleNotes[index] = { visible: true, mode: 'structure', title: pick(en, '例句说明', 'Example focus'), body: pick(en, pair[0], pair[1]), detail: '' };
  }));
  return bundle;
}

function buildNumeralCourse(en) {
  const s = (u,m,z,e) => analyzed(en,u,m,z,e), f=(t,m,z,e)=>form(en,t,m,z,e), q=(...a)=>question(en,...a);
  const bq = (...args) => {
    if (args.length === 7) {
      const [zp,ep,a,b,answer,zh,english] = args;
      return q(pick(en,zp,ep),a,b,answer,zh,english);
    }
    const [zp,ep,za,ea,zb,eb,answer,zh,english] = args;
    return q(pick(en,zp,ep),pick(en,za,ea),pick(en,zb,eb),answer,zh,english);
  };
  return grouped(en, '数词', 'Numerals', [
    lesson(en,'numeral-essence','数词是什么','What numerals express','数量、顺序还是编号','Quantity · order · label',[
      s([['Three students','subject','主语（three 限定数量）','Subject (three gives quantity)'],['arrived.','predicate']],'structure','three 回答“有多少名学生”，它直接限定 students 的数量。','three answers “how many students” and directly limits the quantity of students.'),
      s([['Mia','subject'],['came','predicate'],['second.','complement','主语补足语（名次）','Subject complement (finishing place)']],'structure','second 不说明人数，而是在 came 后补充 Mia 到达时的名次。','second does not count people; after came, it completes the clause by giving Mia’s finishing place.'),
      s([['Take','predicate'],['Bus 18.','object','宾语（18 是编号）','Object (18 is a label)']],'structure','18 在这里不是“十八辆公交车”，而是给一条公交线路命名。','18 does not mean eighteen buses here; it identifies one route.')
    ],[['数词的核心是给事物建立可计算或可识别的数量关系：多少、次序或编号。','Numerals place things in a countable or identifiable relation: quantity, order or label.'],['先看数字在句中回答什么问题；同一数字表达的功能不同，读法和结构也可能不同。','First ask what the number answers; a different function may require a different reading or structure.']],[
      bq('“four books”中的 four 表示什么？','What does four express in “four books”?','数量','quantity','编号','a label','A','four 回答书有多少本。','four answers how many books there are.'),
      bq('“the fourth book”中的 fourth 表示什么？','What does fourth express in “the fourth book”?','顺序','order','总量','total quantity','A','fourth 指这本书所处的次序。','fourth places the book in an order.'),
      bq('“Room 4”中的 4 主要表示什么？','What does 4 mainly express in “Room 4”?','房间编号','a room label','四个房间','four rooms','A','4 用来识别具体房间。','4 identifies a particular room.')
    ]),
    lesson(en,'numeral-functions','数词在句中做什么','Sentence roles of numerals','限定名词，也可独立使用','Modifying nouns or standing alone',[
      s([['Two books','subject','主语（two 作数量限定）','Subject (two as quantity modifier)'],['are','predicate'],['missing.','complement']],'structure','two 放在 books 前，限定整个名词短语的数量。','two comes before books and limits the quantity of the whole noun phrase.'),
      s([['The first chapter','subject','主语（first 作顺序限定）','Subject (first as order modifier)'],['is','predicate'],['short.','complement']],'structure','first 放在 chapter 前，限定它在全书中的顺序。','first comes before chapter and limits its position in the book’s order.'),
      s([['I','subject'],['need','predicate'],['two.','object','宾语（two 代替数量已知的事物）','Object (two replaces understood items)']],'structure','上下文知道所指事物时，two 可以独立作宾语，不必重复名词。','When the item is understood, two can stand alone as the object without repeating the noun.'),
      s([['Leo','subject'],['was','predicate'],['the first to answer.','complement','表语','Subject complement']],'structure','the first 位于系动词 was 后，说明 Leo 的顺序，整个短语作表语。','the first follows was, identifies Leo’s order and functions as the subject complement.')
    ],[['数词最常放在名词前限定数量或顺序。','Numerals most often come before nouns to limit quantity or order.'],['名词已明确时，数词可以独立承担名词短语的作用。','When the noun is understood, a numeral can stand in for a noun phrase.'],['判断句法作用要看整个数词短语在句中的位置，不能把“数词”直接等同于某个句子成分。','Identify the role of the whole numeral phrase; numeral is a word class, not one fixed sentence element.']],[
      bq('“Five players stayed.”中 Five 的作用是？','What does Five do in “Five players stayed”?','限定 players 的数量','limits the quantity of players','独立作谓语','forms the predicate','A','Five 和 players 共同组成主语。','Five and players form the subject together.'),
      bq('“the second lesson”中 second 的作用是？','What does second do in “the second lesson”?','限定 lesson 的顺序','limits the order of lesson','表示两节课的数量','counts two lessons','A','second 放在名词前说明顺序。','second comes before the noun and gives order.'),
      bq('“I chose the second.”中 the second 作什么成分？','What is the role of the second in “I chose the second”?','宾语','object','谓语','predicate','A','the second 独立指代第二个对象，作宾语。','the second stands for the second item and acts as object.'),
      bq('“She is the third.”中 the third 作什么成分？','What is the role of the third in “She is the third”?','表语','subject complement','主语','subject','A','the third 在 is 后说明主语的顺序。','the third follows is and identifies the subject’s order.')
    ]),
    lesson(en,'cardinals','基数词表示数量','Cardinal numbers','回答“多少”','Answering “how many”',[
      f('one book · two books','structure','one 后接单数；大于一的基数词通常接复数可数名词。','one takes a singular noun; cardinals above one normally take plural count nouns.'),
      f('twenty-one · forty · ninety-nine','spelling','21—99 非整十数用连字符；forty 不含字母 u。','Hyphenate non-round numbers from 21 to 99; forty has no u.'),
      f('three hundred students','structure','具体数字直接限定 hundred，hundred 不变复数，也不接 of。','An exact number directly limits hundred, so hundred takes neither plural s nor of.')
    ],[['基数词直接给出数量，名词单复数要与数量相配。','Cardinals give quantity directly, and noun number must match that quantity.'],['forty 等高频基数词有特殊拼写，不能只按 four 机械拼接。','Common cardinals such as forty have special spellings and cannot be built mechanically from four.'],['21—99 的非整十数用连字符连接十位和个位。','Hyphenate tens and units in non-round numbers from 21 to 99.'],['具体数字＋hundred/thousand/million 表精确数量，单位词保持单数。','An exact number + hundred/thousand/million gives a precise quantity, with a singular scale word.']],[
      bq('哪一项正确？','Which is correct?','two books','two book','A','two 后用复数 books。','Use plural books after two.'),
      bq('40 的正确拼写是？','Which spelling of 40 is correct?','forty','fourty','A','40 拼作 forty。','40 is spelled forty.'),
      bq('21 的正确拼写是？','Which spelling of 21 is correct?','twenty-one','twenty one','A','十位和个位之间使用连字符。','Use a hyphen between the tens and units.'),
      bq('300 名学生','300 students','three hundred students','three hundreds of students','A','精确数字后用 hundred students。','Use hundred students after an exact number.')
    ]),
    lesson(en,'ordinals','序数词表示顺序','Ordinal numbers','回答“第几”','Answering “which in order”',[
      f('one → first · two → second · three → third','spelling','first、second、third 不是直接加 -th，需要单独掌握。','first, second and third are irregular rather than simple -th forms.'),
      f('five → fifth · twelve → twelfth · twenty → twentieth','spelling','注意 fifth、twelfth；整十词尾 y 变 ie 再加 -th。','Note fifth and twelfth; change final y to ie before -th in round tens.'),
      s([['The third runner','subject','主语（third 作顺序限定）','Subject (third as order modifier)'],['crossed','predicate'],['the line.','object']],'structure','third 把 runner 放在明确比赛顺序的第三位；the 指向这个序列中的唯一第三名。','third places the runner third in a defined race order; the identifies the unique third position in that sequence.'),
      s([['This','subject'],['is','predicate'],['my second visit.','complement','表语（second 表顺序）','Subject complement (second gives order)']],'structure','second 排列 visit 的次序；my 已经限定 visit，因此前面不再加 the。','second orders the visits; my already determines visit, so the is not added.')
    ],[['序数词把人或事物放入一个次序，通常与 the 连用。','Ordinals place a person or thing in an order and normally occur with the.'],['first、second、third 及 fifth、ninth、twelfth 等有特殊拼写。','first, second, third, fifth, ninth and twelfth have special spellings.'],['物主限定词、指示限定词已占据限定位置时，不再叠加 the。','Do not add the when a possessive or demonstrative already fills the determiner position.']],[
      bq('明确序列中的“第三位选手”应说？','How do we refer to the runner in the unique third position?','the third runner','a third runner','A','明确序列中的序数词通常与 the 连用。','An ordinal in a defined sequence normally takes the.'),
      bq('“第十二”的正确形式是？','Which form means “twelfth”?','twelfth','twelveth','A','正确拼写是 twelfth。','The correct spelling is twelfth.'),
      bq('“第20”怎样写？','How is “20th” written?','twentieth','twentyth','A','twenty 的 y 变 ie，再加 -th。','Change y in twenty to ie before -th.'),
      bq('哪一项正确？','Which is correct?','my tenth birthday','my the tenth birthday','A','my 已限定 birthday，不再加 the。','my already determines birthday, so the is not used.')
    ]),
    lesson(en,'large-numbers','读写大数','Reading large numbers','三位分级，单位定位','Groups of three and scale words',[
      f('3,506 → three thousand five hundred and six (BrE) / three thousand five hundred six (AmE)','structure','从右向左每三位一组；英式读法通常保留 and，美式读法常省略。','Group digits in threes; British usage commonly keeps and, while American usage often omits it.'),
      f('2,000,000 → two million','structure','two 给出精确数量，因此 million 保持单数。','two gives an exact quantity, so million stays singular.'),
      f('millions of stars','structure','没有精确数字时，millions of 表示“数百万的”，是范围很大的概数。','Without an exact number, millions of expresses an indefinite quantity in the millions.')
    ],[['大数按 thousand、million、billion 等位级从高到低读取。','Read large numbers from higher to lower scales such as million and thousand.'],['精确数前有具体数字，单位词不加 s；不精确的大量可用复数单位词＋of。','With an exact number, the scale word has no s; indefinite large quantities use plural scale word + of.'],['英式英语常保留 and，美式英语常省略；两种读法都应结合语境识别。','British English often keeps and while American English often omits it; recognize both by context.']],[
      bq('3,506 应按什么位级读取？','How should 3,506 be grouped and read?','three thousand five hundred and six','thirty-five hundred six only','A','先读 thousand 位级，再读 hundred 和余数。','Read the thousand group first, then the hundreds and remainder.'),
      bq('5,000 怎样表达？','How is 5,000 expressed?','five thousand','five thousands','A','精确数字后 thousand 保持单数。','thousand stays singular after an exact number.'),
      bq('“数百万颗星星”怎样表达？','How do we say “an indefinite number of stars in the millions”?','millions of stars','million of stars','A','不精确概数用 millions of。','Use millions of for an indefinite quantity.'),
      bq('1,208 的英式与美式读法，哪项正确？','Which statement about British and American readings of 1,208 is correct?','有 and 和无 and 的读法都可出现','Both readings, with and without and, occur','只有带 and 的读法成立','Only the version with and is possible','A','英式常保留 and，美式常省略。','British English often keeps and; American English often omits it.')
    ]),
    lesson(en,'fractions','分数表示整体中的部分','Fractions as parts of a whole','分子计数，分母分份','Counting parts of a divided whole',[
      f('1/3 → one third','structure','one 表示取一份，third 表示整体被等分成三份。','one counts the part taken; third shows that the whole is divided into three equal parts.'),
      f('2/3 → two thirds','structure','取出的份数大于一，表示分份的 thirds 用复数。','Because more than one part is taken, thirds is plural.'),
      f('1/2 → one half · 1/4 → one quarter','structure','half 和 quarter 是二分之一、四分之一的常用表达；one fourth 也可表示四分之一。','half and quarter are common forms for one half and one fourth; one fourth is also possible.')
    ],[['普通分数用基数词作分子、序数词作分母。','Ordinary fractions use a cardinal numerator and an ordinal denominator.'],['分子大于一时，分母通常用复数。','The denominator is normally plural when the numerator is above one.'],['half 和 quarter 是高频特殊分母形式。','half and quarter are common special denominator forms.']],[
      bq('2/5 怎样读？','How is 2/5 read?','two fifths','two fifth','A','取两份，所以 fifth 用复数。','Two parts are taken, so fifth is plural.'),
      bq('1/6 怎样读？','How is 1/6 read?','one sixth','first six','A','分子用 one，分母用 sixth。','Use one for the numerator and sixth for the denominator.'),
      bq('1/4 的常用表达是？','What is a common expression for 1/4?','one quarter','one quarters','A','四分之一常说 one quarter。','One quarter is a common form.')
    ]),
    lesson(en,'decimals-percent','小数与百分数','Decimals and percentages','一个逐位读，一个表示每百份','Digits after a point · parts per hundred',[
      f('0.75 → zero point seven five','structure','point 标出小数点；点后的 7 和 5 逐位读，不读成 seventy-five。','point marks the decimal; read 7 and 5 separately, not as seventy-five.'),
      f('25% → twenty-five percent','structure','percent 表示“每一百份中有多少份”，前面用基数词。','percent means a number of parts in every hundred and follows a cardinal.'),
      s([['The tank','subject'],['is','predicate'],['thirty percent full.','complement']],'structure','thirty percent 修饰 full，表示水箱容量完成到百分之三十；它给出比例，不是数三十个物体。','thirty percent modifies full and places the tank at 30% of its capacity; it gives a proportion, not a count of thirty objects.')
    ],[['小数点读 point，点后数字逐个读。','Read a decimal point as point and each following digit separately.'],['百分数由基数词＋percent 构成，percent 本身不加复数 s。','A percentage uses a cardinal + percent, and percent has no plural s.'],['百分数强调部分占整体的比例；需要实际人数时还要知道整体数量。','A percentage gives a part-to-whole proportion; the total is needed to calculate an actual count.']],[
      bq('3.14 中的小数点读什么？','How is the decimal point in 3.14 read?','point','dot only','A','数学小数点通常读 point。','A mathematical decimal point is normally read point.'),
      bq('50% 怎样表达？','How is 50% expressed?','fifty percent','fifty percents','A','percent 不加复数 s。','percent has no plural s.'),
      bq('20% 表示什么关系？','What relation does 20% express?','每一百份中占二十份','twenty parts in every hundred','总共有二十个','a total count of twenty','A','百分数表达部分与整体的比例。','A percentage expresses a part-to-whole proportion.')
    ]),
    lesson(en,'date-time','日期与时间','Dates and time','数字进入时间坐标','Numbers on a time scale',[
      f('May 5 → May fifth / the fifth of May','structure','日期中的“日”表示月内顺序，所以读序数词。','The day gives its order within a month, so it is read as an ordinal.'),
      f('7:30 → seven thirty','structure','直接读法按“小时＋分钟”读取，不必换算与整点的距离。','Direct reading gives hour + minutes without calculating a relation to the hour.'),
      f('8:15 → a quarter past eight','structure','past 从当前整点向后数；8:15 是八点已经过去一刻钟。','past counts after the current hour; 8:15 is a quarter after eight.'),
      f('8:45 → a quarter to nine','structure','to 向下一个整点数；8:45 是距离九点还差一刻钟。','to counts toward the next hour; 8:45 is a quarter before nine.')
    ],[['日期中的日表示顺序，通常用序数词读取。','A day in a date gives order and is normally read as an ordinal.'],['直接读法按“小时＋分钟”读取。','Direct time reading gives the hour followed by the minutes.'],['past 指已过当前整点多久。','past counts how long after the current hour.'],['to 指距离下一个整点还有多久。','to counts how long before the next hour.']],[
      bq('July 1 怎样读？','How is July 1 read?','July first','July one','A','日期中的 1 读序数词 first。','Read 1 as the ordinal first in a date.'),
      bq('7:30 的直接读法是？','What is the direct reading of 7:30?','seven thirty','half to eight','A','直接按小时 seven 和分钟 thirty 读取。','Read the hour seven followed by the minutes thirty.'),
      bq('8:15 可以怎样表达？','How can 8:15 be expressed?','a quarter past eight','a quarter to eight','A','8:15 是八点过一刻。','8:15 is a quarter after eight.'),
      bq('9:50 可以怎样表达？','How can 9:50 be expressed?','ten to ten','ten past ten','A','9:50 距十点还有十分钟。','9:50 is ten minutes before ten.')
    ]),
    lesson(en,'labels-years','编号与年份','Labels and years','数字用于识别，不一定表示数量','Identification rather than quantity',[
      f('Room 205 → Room two oh five','structure','房间号用于识别房间，常逐位读；0 常读 oh。','A room number identifies a room and is often read digit by digit; 0 is often oh.'),
      f('Bus 106 → Bus one oh six','structure','线路编号是名称的一部分，不读成序数词，也不表示一百零六辆公交车。','A route number is part of a label; it is not ordinal and does not mean 106 buses.'),
      f('1998 → nineteen ninety-eight · 2008 → two thousand and eight / twenty oh eight','structure','年份常分成两段读；2000 年后的年份存在多种自然读法。','Years are often split into two parts; post-2000 years allow more than one natural reading.')
    ],[['编号的任务是识别对象，常逐位读，不能机械套用大数读法。','A label identifies an object and is often read digit by digit rather than as a large quantity.'],['0 在编号中常读 oh，在数学数量中通常读 zero。','In labels, 0 is often oh; in mathematical quantities it is normally zero.'],['年份按语言习惯分段读取，不表示对应数量。','Years follow conventional grouped readings rather than denoting that quantity.']],[
      bq('Bus 106 常读作什么？','How is Bus 106 commonly read?','Bus one oh six','Bus one hundred and sixth','A','线路编号通常逐位读。','A route label is commonly read digit by digit.'),
      bq('编号中的 0 常读什么？','How is 0 often read in a label?','oh','hundred','A','编号中的 0 常读 oh。','0 in a label is often read oh.'),
      bq('1998 的常见年份读法是？','What is a common year reading of 1998?','nineteen ninety-eight','one thousand nine hundred and ninety-eighth','A','年份常分两段读。','Years are often read in two parts.')
    ]),
    lesson(en,'approximate','概数与计量单位','Approximate quantities and counting units','精确数量与范围数量','Exact quantities and broad ranges',[
      s([['Hundreds of visitors','subject'],['came','predicate'],['today.','adverbial','时间状语','Time adverbial']],'structure','没有给出具体数字，hundreds of 只表示数量达到数百的范围。','No exact number is given; hundreds of only places the quantity in the hundreds.'),
      s([['About fifty people','subject'],['joined','predicate'],['the event.','object']],'structure','about 放在 fifty 前，把精确的 50 放宽为“50 左右”。','about comes before fifty and changes exact 50 into an approximate range around 50.'),
      s([['She','subject'],['bought','predicate'],['two dozen eggs.','object']],'structure','dozen 是“十二个”为一组；two dozen 表示两个十二，即 24 个。','dozen is a unit of twelve; two dozen means two groups of twelve, or 24.')
    ],[['复数单位词＋of 表示不精确的大量，如 hundreds of、thousands of。','Plural scale word + of gives an indefinite large quantity, as in hundreds of.'],['about、around、nearly、more than 等词改变数字的范围边界。','Words such as about, around, nearly and more than change the boundary around a number.'],['dozen 前有具体数字时通常保持单数并直接接名词。','dozen normally stays singular and directly precedes a noun after an exact number.']],[
      bq('“数百名学生”怎样表达？','How do we express an indefinite number of students in the hundreds?','hundreds of students','hundred of students','A','概数用 hundreds of。','Use hundreds of for an indefinite quantity.'),
      bq('“大约30”怎样表达？','How do we express approximately 30?','about thirty','thirty about','A','about 放在数字前。','about comes before the number.'),
      bq('“两打鸡蛋”怎样表达？','How do we express two dozen eggs?','two dozen eggs','two dozens of eggs','A','精确数量后 dozen 保持单数。','dozen stays singular after an exact number.')
    ]),
    lesson(en,'multiples-ratios','倍数、比例与算式','Multiples, ratios and calculations','比较两个数量之间的关系','Relating two quantities',[
      s([['This box','subject'],['is','predicate'],['twice as heavy as that one.','complement']],'structure','twice 修饰 as...as 比较结构，表示这个箱子的重量是另一个的两倍。','twice modifies the as...as comparison and makes this box two times the other one’s weight.'),
      f('a ratio of 2 to 3 → two to three','structure','to 连接比例的两端：每 2 份对应 3 份。','to links the two sides of a ratio: two parts correspond to three parts.'),
      f('6 + 4 = 10 → six plus four equals ten','structure','算式中的符号读作 plus、minus、times、divided by 和 equals。','Read calculation signs as plus, minus, times, divided by and equals.')
    ],[['倍数比较常用 once/twice/three times＋as...as，倍数放在比较结构前。','Multiplicative comparison commonly uses once/twice/three times + as...as, with the multiplier first.'],['比例用 A to B 表示两类数量的对应关系。','A ratio uses A to B to relate two quantities.'],['算式中的数词仍表示数量，运算词说明数量如何发生关系。','Numerals in calculations still give quantities; operation words show how those quantities relate.']],[
      bq('“两倍重”应放在哪个结构中？','Which structure expresses “twice as heavy”?','twice as heavy as','as twice heavy as','A','倍数 twice 放在 as...as 前。','Place twice before the as...as pattern.'),
      bq('比例 2:3 怎样读？','How is the ratio 2:3 read?','two to three','second and third','A','比例符号读作 to。','Read the ratio sign as to.'),
      bq('“6 + 4 = 10”怎样读？','How is “6 + 4 = 10” read?','six plus four equals ten','six with four ten','A','加号读 plus，等号读 equals。','Read + as plus and = as equals.')
    ]),
    lesson(en,'number-agreement','数量短语与主谓一致','Quantity phrases and agreement','看整体还是看 of 后对象','One unit or the noun after of',[
      s([['Two hours','subject'],['is','predicate'],['enough.','complement']],'structure','虽然 hours 是复数形式，这里把两小时看成一段完整时长，所以谓语用 is。','Although hours is plural in form, the sentence treats two hours as one duration, so it uses is.'),
      s([['Two thirds of the students','subject'],['are','predicate'],['present.','complement']],'structure','分数取的是 students 中的一部分；students 可数且为复数，所以用 are。','The fraction selects part of the students; students is plural countable, so are is used.'),
      s([['Thirty percent of the water','subject'],['is','predicate'],['gone.','complement']],'structure','百分数取的是 water 的一部分；water 不可数，所以用 is。','The percentage selects part of the water; water is uncountable, so is is used.')
    ],[['时间、金钱、距离等数量被看作一个整体时，通常用单数谓语。','A quantity of time, money or distance normally takes singular agreement when viewed as one unit.'],['分数＋of 的谓语通常根据 of 后名词的数和可数性选择。','Agreement after a fraction + of normally follows the number and countability of the of-noun.'],['百分数＋of 与分数相同：先找到被取出一定比例的对象，再判断谓语。','Percentage + of follows the same principle: identify the measured noun, then choose agreement.']],[
      bq('Ten dollars ___ enough.','Ten dollars ___ enough.','is','is','are','are','A','十美元被看作一个金额整体。','Ten dollars is viewed as one sum.'),
      bq('Half of the books ___ new.','Half of the books ___ new.','are','are','is','is','A','谓语随复数 books 用 are。','Agreement follows plural books, so use are.'),
      bq('Thirty percent of the milk ___ gone.','Thirty percent of the milk ___ gone.','is','is','are','are','A','百分数取不可数 milk 的一部分，谓语用 is。','The percentage selects part of uncountable milk, so use is.')
    ])
  ], ['multiples-ratios','number-agreement']);
}

function buildArticleCourse(en) {
  const s=(u,m,z,e)=>analyzed(en,u,m,z,e), f=(t,m,z,e)=>form(en,t,m,z,e), q=(...a)=>question(en,...a);
  const bq = (...args) => {
    if (args.length === 7) {
      const [zp,ep,a,b,answer,zh,english] = args;
      return q(pick(en,zp,ep),a,b,answer,zh,english);
    }
    const [zp,ep,za,ea,zb,eb,answer,zh,english] = args;
    return q(pick(en,zp,ep),pick(en,za,ea),pick(en,zb,eb),answer,zh,english);
  };
  return grouped(en, '冠词', 'Articles', [
    lesson(en,'article-essence','冠词是什么','What articles do','帮助听者识别名词','Helping the listener identify a noun',[
      s([['I','subject'],['saw','predicate'],['a dog.','object']],'structure','a dog 先从“狗”这一类中引入一只；听者还不知道具体是哪一只。','a dog introduces one member of the class “dogs”; the listener does not yet know which dog.'),
      s([['The dog','subject'],['followed','predicate'],['me.','object']],'structure','the dog 表示前文或现场已经让双方能认出这只狗，不再是任意一只。','the dog shows that the discourse or situation now lets both people identify the dog.'),
      s([['Dogs','subject'],['need','predicate'],['care.','object']],'structure','Dogs 不锁定某几只狗，而是谈狗这一类，所以复数名词前用零冠词。','Dogs does not identify particular dogs; it refers to the class generally, so the plural takes zero article.')
    ],[['a/an 像 a dog 一样先引入一个未锁定的单数成员。','a/an, as in a dog, introduces one not-yet-identified singular member.'],['the 像 the dog 一样提示听者：现在可以认出所说对象。','the, as in the dog, signals that the listener can now identify the referent.'],['零冠词像 Dogs 一样可把复数或不可数名词作为一类来谈。','Zero article, as in Dogs, can present a plural or mass noun as a class.']],[
      bq('第一次提到一只不确定的狗，应说什么？','How do we first mention one unidentified dog?','a dog','the dog','A','第一次引入一个未锁定成员用 a dog。','Use a dog to introduce one unidentified member.'),
      bq('双方已经知道是哪只狗，应说什么？','What do we say when both sides know which dog?','the dog','a dog','A','对象已可识别，用 the dog。','Use the dog when the referent is identifiable.'),
      bq('泛指狗这一类，最自然的是？','What is the most natural general reference to the class of dogs?','Dogs','The dogs','A','复数零冠词 Dogs 自然泛指一类。','The zero-article plural Dogs naturally refers to the class.')
    ]),
    lesson(en,'article-determiner-boundary','冠词与其他限定词','Articles and other determiners','限定位置不能机械叠加','Do not stack central determiners',[
      f('the book · my book · this book','structure','the、my、this 都帮助锁定 book；它们通常占同一个中心限定位置，因此不能说 the my book。','the, my and this all determine book and normally fill the same central determiner slot, so the my book is not possible.'),
      f('a book · one book','structure','a 强调“某一个未锁定成员”，one 强调数量恰好为一；两者意义接近但焦点不同。','a highlights an unidentified member; one highlights the exact quantity of one. Their meanings overlap, but their focus differs.'),
      f('all the books · both my hands','structure','all、both 可以放在中心限定词之前，所以“限定词不能共现”不能讲成绝对规则。','all and both can precede a central determiner, so “determiners never combine” is not an absolute rule.')
    ],[['the 与 my、this 等通常竞争同一个中心限定位置。','the normally competes with my, this and similar words for the central determiner slot.'],['a/an 主要建立不定指称，one 主要强调数量一。','a/an mainly establishes indefinite reference, while one mainly stresses the number one.'],['all/both 等前位限定词可以出现在 the、my 之前。','Predeterminers such as all and both can occur before the or my.']],[
      bq('哪一项正确？','Which is correct?','my book','the my book','A','my 已占据中心限定位置，不再加 the。','my already fills the central determiner slot, so the is not added.'),
      bq('强调“正好一本书”更适合用？','Which better stresses “exactly one book”?','one book','a book','A','one 直接强调数量一。','one directly stresses the quantity one.'),
      bq('哪一项可以成立？','Which expression is possible?','all the books','the all books','A','all 位于 the 前。','all comes before the.')
    ]),
    lesson(en,'indefinite-reference','a/an 的指称本质','Indefinite reference with a/an','从一类中引入一个','Introducing one member of a class',[
      s([['I','subject'],['need','predicate'],['a pen.','object']],'structure','说话人需要“笔”这一类中的一支，目前没有指定必须是哪一支。','The speaker needs one member of the class “pens” and has not specified which pen.'),
      s([['Mia','subject'],['is','predicate'],['a doctor.','complement']],'structure','a doctor 把 Mia 归入“医生”这一职业类别，不是在指某位双方已知的医生。','a doctor classifies Mia as a member of the profession; it does not identify a known doctor.'),
      s([['A child','subject'],['needs','predicate'],['love.','object']],'structure','A child 用任意一个儿童代表这一类成员，说明适用于每个普通儿童的道理。','A child uses any representative member of the class to state something true of an ordinary child.')
    ],[['a/an 只能直接限定单数可数名词，因为它从可数类别中取出一个成员。','a/an directly determines only a singular count noun because it selects one member of a countable class.'],['在职业或身份表语中，a/an 表示主语属于哪一类。','In profession or identity complements, a/an classifies the subject as a member of a group.'],['a/an＋单数也可让任一成员代表该类，但只适合能落到普通个体上的概括。','a/an + singular can let any member represent a class, but only for generalizations that apply to an ordinary individual.']],[
      bq('“我需要一支笔，哪支都可以”应填？','Complete “I need ___ pen; any pen will do.”','a','the','A','没有锁定具体笔，用 a。','No particular pen is identified, so use a.'),
      bq('She is ___ engineer.','She is ___ engineer.','an','the','A','职业分类用 an engineer。','Use an engineer to classify her profession.'),
      bq('表示“孩子需要安全感”这一普遍道理，可说？','Which can state a general truth that a child needs security?','A child needs security.','The child needs security.','A','A child 用任一成员代表儿童这一类。','A child uses any representative member of the class.')
    ]),
    lesson(en,'a-an','a 还是 an','Choosing a or an','看紧随成分的首个音素','Follow the first sound of what follows',[
      f('an hour','sound','hour 的 h 不发音，开头是元音音素 /aʊ/，所以用 an。','The h in hour is silent, so the word begins with the vowel sound /aʊ/ and takes an.'),
      f('a university','sound','university 虽以元音字母 u 开头，读音却以辅音音素 /j/ 开头，所以用 a。','Although university begins with the vowel letter u, it begins with the consonant sound /j/, so it takes a.'),
      f('an MBA student','sound','MBA 的第一个字母 M 读 /em/，首音是元音音素，所以用 an。','The first letter of MBA is pronounced /em/, beginning with a vowel sound, so it takes an.'),
      f('a one-year course','sound','one 开头读 /w/，是辅音音素，所以用 a。','one begins with the consonant sound /w/, so it takes a.'),
      f('an interesting book · a useful book','sound','冠词看紧随其后的修饰词：interesting 以元音音素开头，useful 以 /j/ 开头。','The article follows the sound of the next modifier: interesting begins with a vowel sound, while useful begins with /j/.')
    ],[['an hour 说明 a/an 看发音，不看首字母。','an hour shows that a/an follows sound, not the first written letter.'],['a university 说明元音字母开头也可能因 /j/ 等辅音音素而用 a。','a university shows that a vowel letter may still take a when its first sound is consonantal, such as /j/.'],['缩写按实际读法选择；MBA 读 /em.../，因此是 an MBA。','Choose by the spoken form of an abbreviation; MBA begins /em.../, so it is an MBA.'],['a one-year course 说明数字或单词的实际首音仍是判断依据。','a one-year course shows that the actual first sound of a number or word remains decisive.'],['名词前有修饰词时，看紧随冠词的修饰词首音。','When a modifier comes before the noun, use the first sound of that modifier.']],[
      bq('___ hour','___ hour','an','an','a','a','A','hour 以元音音素开头。','hour begins with a vowel sound.'),
      bq('___ university','___ university','a','a','an','an','A','university 以 /j/ 开头。','university begins with /j/.'),
      bq('___ MBA student','___ MBA student','an','an','a','a','A','M 读 /em/，首音是元音音素。','M is pronounced /em/, which begins with a vowel sound.'),
      bq('___ one-year plan','___ one-year plan','a','a','an','an','A','one 以 /w/ 开头。','one begins with /w/.'),
      bq('___ useful idea','___ useful idea','a','a','an','an','A','useful 以 /j/ 开头。','useful begins with /j/.')
    ]),
    lesson(en,'the-known','the：现场与共享知识','The in shared situations','听者能认出是哪一个','The listener can identify the referent',[
      s([['Please close','predicate'],['the door.','object']],'structure','当前房间的现场让双方能确认要关哪扇门，所以用 the；并不是所有 door 前都用 the。','The current room lets both people identify the intended door, so the is used; door does not always take the.'),
      s([['The teacher','subject'],['is waiting','predicate'],['outside.','adverbial','地点状语','Place adverbial']],'structure','在当前班级或谈话场景中，双方知道 teacher 指哪位老师，因此可以直接用 the。','Within the current class or conversation, both sides know which teacher is meant, so the is possible.'),
      s([['The sun','subject'],['provides','predicate'],['light.','object']],'structure','在日常地球语境中，sun 是双方通过常识能识别的对象，所以用 the。','In ordinary Earth-based discourse, shared knowledge lets both sides identify the sun, so it takes the.')
    ],[['the door 表明现场信息足以让听者认出对象；the 的核心是“可识别”，不只是中文“这个”。','the door shows that the situation can identify the referent; the means “identifiable,” not merely Chinese “this.”'],['the teacher 的唯一性来自当前班级或谈话范围，不一定是世界上唯一。','the teacher is unique within the current class or discourse, not necessarily in the whole world.'],['the sun 依靠双方共享的世界知识建立可识别性。','the sun relies on shared world knowledge for identifiability.']],[
      bq('在房间里让对方关双方都看到的门，应说？','In a room, how do you ask someone to close the mutually visible door?','Close the door.','Close a door.','A','现场已经锁定那扇门。','The situation already identifies the door.'),
      bq('当前班级都知道在等哪位老师，可说？','If the class knows which teacher is waiting, what can we say?','The teacher is waiting.','A teacher is waiting.','A','共享场景让 teacher 可识别。','The shared context makes teacher identifiable.'),
      bq('___ sun gives us light.','___ sun gives us light.','The','The','A','A','A','共享常识让 sun 可识别。','Shared knowledge makes the sun identifiable.')
    ]),
    lesson(en,'the-context-chain','the：前文、关联与限定','The in discourse and identification','信息逐步锁定对象','Information identifies the referent',[
      s([['I','subject'],['saw','predicate'],['a dog.','object'],['The dog','subject'],['followed','predicate'],['me.','object']],'structure','第一句用 a dog 引入一只狗；第二句用 the dog 回指刚出现的同一只狗。','The first sentence introduces a dog; the second uses the dog to refer back to that same dog.'),
      s([['We','subject'],['bought','predicate'],['a house.','object'],['The kitchen','subject'],['is','predicate'],['small.','complement']],'structure','前文虽没提 kitchen，但提到 house 后，听者可通过“房子通常有厨房”的关联认出所指厨房。','Although kitchen was not mentioned, a house normally has one, so the listener can identify the associated kitchen.'),
      s([['The book','subject'],['on the desk','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','predicate'],['mine.','complement']],'translation','on the desk 把 book 锁定为桌上那本；英语放在名词后，中文通常前移为“桌上的书”。','on the desk identifies the book on that desk; English places it after the noun, while Chinese normally moves it before the noun.'),
      s([['I','subject'],['need','predicate'],['a book','object'],['about birds.','attribute','介词短语作后置定语','Prepositional phrase as postmodifier']],'translation','about birds 只说明书的主题，并没有锁定唯一一本，所以仍用 a；中文通常说“一本关于鸟的书”。','about birds gives the topic but does not identify one unique book, so a remains; Chinese normally places the modifier before the noun.')
    ],[['a dog → the dog 说明前文首次提及可以让后文对象变得可识别。','a dog → the dog shows how first mention can make a later referent identifiable.'],['a house → the kitchen 说明关联信息也能让听者识别对象，不要求逐字重复。','a house → the kitchen shows that an associated part can be identifiable without exact repetition.'],['修饰语只有在足以锁定对象时才支持 the；the book on the desk 能锁定，a book about birds 未必能锁定。','A modifier supports the only when it identifies the referent: the book on the desk can do so, while a book about birds may not.']],[
      bq('I saw a film. ___ film was excellent.','I saw a film. ___ film was excellent.','The','The','A','A','A','第二次提及同一部电影用 the。','Use the on the second mention of the same film.'),
      bq('We entered a house. ___ living room was bright.','We entered a house. ___ living room was bright.','The','The','A','A','A','house 与 living room 的关联让对象可识别。','The association between house and living room makes the referent identifiable.'),
      bq('双方只知道“关于鸟的一本书”，但没锁定哪本，应说？','If no particular book is identified, what should we say?','a book about birds','the book about birds','A','修饰语没有锁定唯一对象，仍用 a。','The modifier does not identify a unique referent, so use a.'),
      bq('双方都知道桌上只有一本书，应说？','If both sides know there is one book on the desk, what should we say?','the book on the desk','a book on the desk','A','限定信息足以锁定对象，用 the。','The identifying information is sufficient, so use the.')
    ]),
    lesson(en,'unique-superlative','唯一性、最高级与序数词','Uniqueness, superlatives and ordinals','唯一性来自当前范围','Uniqueness comes from the current domain',[
      s([['Mia','subject'],['is','predicate'],['the tallest student','complement'],['in her class.','attribute','介词短语作后置定语','Prepositional phrase as postmodifier']],'structure','in her class 把比较范围限定为她的班级；这个范围内只有一个“最高”，所以用 the。','in her class sets the comparison domain; one member ranks highest in that domain, so the is used.'),
      s([['This','subject'],['is','predicate'],['the first lesson','complement'],['in the book.','attribute','介词短语作后置定语','Prepositional phrase as postmodifier']],'structure','in the book 给出明确序列，first 指向该序列中的唯一第一节。','in the book supplies a clear sequence, and first identifies its unique first lesson.'),
      s([['Leo','subject'],['is','predicate'],['my best friend.','complement']],'structure','my 已经说明 friend 与说话人的关系，占据限定位置，因此不再加 the。','my already identifies the relation to the speaker and fills the determiner slot, so the is not added.'),
      s([['We','subject'],['need','predicate'],['a second chance.','object']],'structure','a second chance 表示“再一次机会”，并没有锁定某个序列中唯一的第二次机会。','a second chance means one additional chance; it does not identify the unique second item in a fixed sequence.')
    ],[['the tallest student 依靠明确比较范围形成唯一性；唯一性常是语境内的，不是世界范围的。','the tallest student becomes unique within a stated comparison domain; uniqueness is often contextual, not global.'],['the first lesson 指向明确序列中的唯一位置。','the first lesson identifies one unique position in a defined sequence.'],['最高级或序数词前已有 my/this 等限定词时不用 the；意义改成“又一个”时还可用 a。','Do not add the when my/this already determines a superlative or ordinal phrase; use a when the meaning is “another.”']],[
      bq('“她班里最高的学生”应说？','How do we say “the tallest student in her class”?','the tallest student in her class','a tallest student in her class','A','明确范围内的最高者可识别，用 the。','The highest member in a defined domain is identifiable, so use the.'),
      bq('书中第一章应说？','How do we refer to the first chapter in a book?','the first chapter','a first chapter','A','明确序列中的第一项用 the。','Use the for the unique first item in a sequence.'),
      bq('哪一项正确？','Which is correct?','my best friend','my the best friend','A','my 已占限定位置。','my already fills the determiner slot.'),
      bq('“我们需要再试一次”中的“一次”可表达为？','Which phrase can mean “one more attempt”?','a second try','the second try','A','a second 表“再一个”。','a second means “one more.”')
    ]),
    lesson(en,'zero-basic','零冠词表示泛指','Zero article for general reference','谈一类，不锁定对象','Referring to a class, not identified items',[
      s([['Books','subject'],['can teach','predicate'],['us','indirectObject','间接宾语','Indirect object'],['a lot.','directObject','直接宾语','Direct object']],'structure','Books 指书这一类，不是某几本已知的书，所以复数名词前用零冠词。','Books refers to books as a class, not to identified books, so the plural takes zero article.'),
      s([['Water','subject'],['is','predicate'],['essential.','complement']],'structure','Water 指水这种物质整体，不是某一部分已识别的水，所以用零冠词。','Water refers to the substance generally, not to an identified portion, so it takes zero article.'),
      s([['The books','subject'],['on this shelf','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['belong','predicate'],['to','preposition','介词','Preposition'],['Mia.','prepObject','介词宾语','Object of preposition']],'structure','on this shelf 把 books 锁定为这个书架上的那些书，因此改用 the。','on this shelf identifies a particular set of books, so the is used.'),
      s([['The water','subject'],['in this bottle','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','predicate'],['cold.','complement']],'structure','in this bottle 把 water 限定为瓶中的这部分水，因此用 the。','in this bottle identifies a particular portion of water, so the is used.')
    ],[['Books 和 Water 说明：复数可数名词与不可数名词泛指类别时通常用零冠词。','Books and Water show that plural count nouns and mass nouns normally take zero article in general reference.'],['the books / the water 说明一旦语境锁定具体集合或具体部分，就改用 the。','the books / the water show that an identified set or portion takes the.']],[
      bq('泛指“书能带来知识”，应填？','For books in general, what should we use?','Books','The books','A','泛指复数类别用零冠词。','Use a zero-article plural for general reference.'),
      bq('泛指“空气很重要”，应填？','For air as a substance in general, what should we use?','Air','The air','A','泛指不可数物质用零冠词。','Use zero article for a mass noun in general reference.'),
      bq('特指桌上的那些书，应说？','How do we refer to the identified books on the desk?','the books on the desk','books on the desk','A','限定信息锁定具体集合，用 the。','The modifier identifies a particular set, so use the.'),
      bq('特指杯子里的水，应说？','How do we refer to the water in a particular cup?','the water in the cup','water in the cup','A','具体部分已被锁定，用 the。','The particular portion is identified, so use the.')
    ]),
    lesson(en,'institutions-meals','机构功能与具体地点','Institutional function and physical place','看人在使用制度还是指向地点','Function versus physical place',[
      s([['The children','subject'],['are','predicate'],['at school.','predicative','表语（介词短语）','Predicative prepositional phrase']],'structure','at school 表示孩子处于“上学”这一制度活动中，school 不作为一座具体建筑来识别。','at school presents the children as participating in schooling; school is not identified as a particular building.'),
      s([['Their parents','subject'],['are waiting','predicate'],['at the school.','adverbial','地点状语','Place adverbial']],'structure','父母不是去上学，而是在那所具体学校建筑处等候，所以用 the school。','The parents are not attending school; they are waiting at the particular school building, so the school is used.'),
      s([['The baby','subject'],['is','predicate'],['in bed.','predicative','表语（介词短语）','Predicative prepositional phrase']],'structure','in bed 表示在床上睡觉或休息这一正常功能；若说东西在某张床上，通常用 on the bed。','in bed means using bed for its normal purpose of sleeping or resting; an object located on a bed normally takes on the bed.'),
      s([['Eva','subject'],['is','predicate'],['in hospital.','predicative','表语（介词短语，英式）','Predicative prepositional phrase (British)']],'structure','英式英语 in hospital 常表示住院；美式英语通常说 in the hospital。两种变体都不能脱离地区语境判断。','British English commonly uses in hospital for receiving treatment; American English normally uses in the hospital. Judge the form by variety.')
    ],[['at school / at the school 的差别不只是有没有冠词，而是“参与制度功能”与“指向具体地点”的差别。','at school / at the school contrasts participation in an institution with reference to a physical place.'],['in bed 把 bed 作为睡觉或休息的正常功能状态，因此使用零冠词。','in bed presents bed as the normal state of sleeping or resting and therefore takes zero article.'],['hospital 的制度用法存在英美差异，不能把一个地区的形式判成全球唯一规则。','Institutional hospital usage differs between British and American English, so one variety must not be taught as the only correct form.']],[
      bq('学生正在上学，应说？','How do we say that students are attending school?','at school','at the school','A','这里表达上学这一制度功能。','This expresses participation in schooling.'),
      bq('家长在那所学校建筑外等候，应说？','How do we locate a parent at a particular school building?','at the school','at school','A','这里指具体学校地点。','This refers to a particular school location.'),
      bq('“孩子已经上床睡觉”应说？','How do we say that a child has gone to sleep?','in bed','in the bed','A','这里使用床的正常功能。','This presents the normal function of bed.'),
      bq('英式英语中，哪项突出“住院治疗”这一制度状态？','In British English, which form foregrounds the institutional state of receiving treatment?','in hospital','in the hospital','A','英式制度用法用 in hospital；in the hospital 指向具体医院地点。','British institutional usage has in hospital; in the hospital identifies the hospital location.')
    ]),
    lesson(en,'activity-conventions','活动与日常名称的冠词','Articles in activities and daily names','先看名称系统，再看具体限定','Convention first, then specific reference',[
      s([['She','subject'],['speaks','predicate'],['English.','object']],'structure','English 是语言名称，按英语命名约定通常用零冠词。','English is the name of a language and normally takes zero article by naming convention.'),
      s([['We','subject'],['study','predicate'],['maths.','object']],'structure','maths 是学科名称，表示课程领域时通常用零冠词。','maths is a school-subject name and normally takes zero article when naming the field.'),
      s([['They','subject'],['play','predicate'],['football.','object']],'structure','football 作为球类运动名称通常用零冠词。','football as the name of a ball game normally takes zero article.'),
      s([['Mia','subject'],['plays','predicate'],['the piano.','object']],'structure','传统乐器演奏表达常用 the piano；这属于英语活动名称系统，不能推成所有活动都加 the。','Traditional instrument-playing expressions commonly use the piano; this is a convention of the activity system, not a rule that all activities take the.'),
      s([['We','subject'],['had','predicate'],['a wonderful breakfast.','object']],'structure','breakfast 单说一日三餐通常零冠词；这里把它看成一次有特征的餐，并由 wonderful 描写，所以用 a。','Meal names normally take zero article, but here breakfast is one characterized meal modified by wonderful, so it takes a.'),
      s([['Leo','subject'],['came','predicate'],['by bus.','adverbial','方式状语','Manner adverbial']],'structure','by bus 表示交通方式，用零冠词；on the bus 则把 bus 作为正在乘坐的具体交通工具。','by bus names a means of transport and takes zero article; on the bus refers to an identifiable vehicle being used.')
    ],[['English 和 maths 表明语言、学科作为名称时通常用零冠词。','English and maths show that language and subject names normally take zero article.'],['play football 与 play the piano 反映两套活动名称约定，不能用一条“运动/乐器口诀”扩张到所有名词。','play football and play the piano reflect conventional activity patterns that should not be overextended to every sport or instrument noun.'],['a wonderful breakfast 把餐计作一次并加以描写；by bus 只说明交通方式，两者展示零冠词约定发生变化或保持的条件。','a wonderful breakfast counts and characterizes one meal, while by bus only names a means of transport; together they show when zero-article conventions change or remain.']],[
      bq('表示学习英语这门语言，应说？','How do we name the language being studied?','study English','study the English','A','语言名称通常用零冠词。','Language names normally take zero article.'),
      bq('表示学习数学这门学科，应说？','How do we name mathematics as a school subject?','study maths','study the maths','A','学科名称通常用零冠词。','School-subject names normally take zero article.'),
      bq('踢足球应说？','How do we say “play football”?','play football','play the football','A','球类运动名称通常用零冠词。','Ball-game names normally take zero article.'),
      bq('把钢琴作为所演奏的乐器，常见表达是？','What is the conventional expression when piano names the instrument being played?','play the piano','play a piano','A','活动名称系统通常用 play the piano；play a piano 指向任意一架具体钢琴。','The activity convention normally has play the piano; play a piano refers to one non-specific instrument.'),
      bq('“一顿丰盛的早餐”应说？','How do we say “one substantial breakfast”?','a big breakfast','big breakfast','A','一次被描述的餐可用 a。','One characterized meal can take a.'),
      bq('表示交通方式“乘公交”应说？','How do we express bus as a means of transport?','by bus','by the bus','A','by＋交通方式通常用零冠词。','by + means of transport normally takes zero article.')
    ]),
    lesson(en,'names-places','专有名称中的冠词','Articles in proper names','按名称类别与实际惯用法判断','Follow name type and established usage',[
      f('China · Asia · Shanghai','structure','多数单数国家名、洲名和城市名用零冠词。','Most singular country names, continent names and city names take zero article.'),
      f('Mount Tai · Lake Baikal','structure','单座山峰和“Lake＋名称”通常用零冠词。','Single mountains and Lake + name normally take zero article.'),
      f('the Yangtze River · the Pacific Ocean · the Alps','structure','江河、海洋和山脉名称通常用 the。','Names of rivers, oceans and mountain ranges normally take the.'),
      f('the United States · the United Kingdom · the Netherlands','structure','复数国家名以及这些约定名称用 the；应记实际名称，不能只看某个普通名词。','Plural country names and these established names take the; learn the actual name rather than relying on one common noun.'),
      f('Oxford University · Buckingham Palace','structure','名称中出现 University 或 Palace 并不自动触发 the，说明“含普通名词就加 the”不成立。','University or Palace inside a name does not automatically trigger the, showing that “a common noun means the” is false.')
    ],[['China、Asia、Shanghai 与 Mount Tai、Lake Baikal 展示常见零冠词名称类别。','China, Asia, Shanghai, Mount Tai and Lake Baikal illustrate common zero-article name types.'],['the Yangtze River、the Pacific Ocean、the Alps 展示江河、海洋和山脉通常用 the。','the Yangtze River, the Pacific Ocean and the Alps show that rivers, oceans and ranges normally take the.'],['the United States 等国家名按实际惯用形式使用 the，不能只靠表面单词推断。','Country names such as the United States take the by established usage, not by a superficial word test.'],['Oxford University 与 Buckingham Palace 证明“含普通名词一律加 the”是错误规则。','Oxford University and Buckingham Palace show that a common noun inside a name does not automatically require the.']],[
      bq('___ China','___ China','China','China','the China','the China','A','单数国家名 China 用零冠词。','The singular country name China takes zero article.'),
      bq('___ Lake Baikal','___ Lake Baikal','Lake Baikal','Lake Baikal','the Lake Baikal','the Lake Baikal','A','Lake＋名称通常用零冠词。','Lake + name normally takes zero article.'),
      bq('___ Pacific Ocean','___ Pacific Ocean','the Pacific Ocean','the Pacific Ocean','Pacific Ocean','Pacific Ocean','A','海洋名称通常用 the。','Ocean names normally take the.'),
      bq('___ United States','___ United States','the United States','the United States','United States','United States','A','该国家名的惯用形式带 the。','The established form of this country name takes the.'),
      bq('哪一项正确？','Which is correct?','Oxford University','the Oxford University','A','名称含 University 不等于自动加 the。','University inside a name does not automatically require the.')
    ]),
    lesson(en,'generic-contrast','三种泛指方式','Three ways to generalize','形式相近，适用范围不同','Similar forms, different ranges',[
      s([['Tigers','subject'],['need','predicate'],['protection.','object']],'structure','复数零冠词直接谈老虎这一类，是日常泛指类别最自然、适用面最广的形式。','The zero-article plural refers directly to tigers as a class and is the most natural, broadly useful form for everyday general reference.'),
      s([['A tiger','subject'],['is','predicate'],['a powerful animal.','complement']],'structure','A tiger 用任意一只普通老虎代表这一类；句中性质能够落到每个普通成员身上。','A tiger uses any ordinary member to represent the class; the property can apply to an individual member.'),
      s([['The tiger','subject'],['is disappearing','predicate'],['from some regions.','adverbial','地点状语','Place adverbial']],'structure','the tiger 把整个物种作为一个可识别类别来谈，常见于物种、发明或较正式的分类表达。','the tiger treats the species as one identifiable class, a pattern common with species, inventions and more formal classification.'),
      s([['The tigers','subject'],['in this zoo','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['need','predicate'],['more space.','object']],'structure','这里 the tigers 不是泛指所有老虎；in this zoo 锁定了动物园里的具体一群。','Here the tigers does not mean all tigers; in this zoo identifies a particular group.')
    ],[['Tigers 说明复数零冠词是日常泛指类别的默认选择。','Tigers shows that a zero-article plural is the default everyday choice for a class in general.'],['A tiger 用任一成员代表类别，只适合可落到普通个体的概括。','A tiger uses any representative member and suits generalizations applicable to an ordinary individual.'],['The tiger 可把物种或发明作为整体类别来谈，但语体和适用范围比复数零冠词窄。','The tiger can denote a species or invention as a whole, but its range and register are narrower than the zero-article plural.'],['the＋复数常常是特指集合；要看后文是否用修饰语锁定对象。','the + plural often identifies a specific set; check whether later information restricts the referent.']],[
      bq('日常泛指“猫是独立的动物”最自然的是？','Which most naturally refers to cats in general in everyday English?','Cats are independent animals.','The cats are independent animals.','A','复数零冠词最自然地泛指类别。','A zero-article plural most naturally refers to the class.'),
      bq('哪项用任一成员说明“鲸属于哺乳动物”？','Which sentence uses one representative member to classify whales as mammals?','A whale is a mammal.','A whale is mammal.','A','单数可数表语 mammal 也需要限定词 a。','The singular count complement mammal also requires the determiner a.'),
      bq('哪项使用“the＋单数”把电话这种发明作为整体类别？','Which uses “the + singular” to present the telephone as an invention class?','The telephone changed communication.','A telephone changed communication.','A','the telephone 把这一发明作为整体类别。','the telephone presents the invention as one whole class.'),
      bq('“这个动物园里的老虎”属于？','What does “the tigers in this zoo” refer to?','具体一群老虎','a particular group of tigers','所有老虎','all tigers everywhere','A','后置短语锁定了具体集合。','The postmodifier identifies a particular set.')
    ]),
    lesson(en,'article-countability-shift','冠词与可数性变化','Articles and count shifts','同一名词可换观察单位','The same noun can be packaged differently',[
      s([['Coffee','subject'],['keeps','predicate'],['me','object','宾语','Object'],['awake.','objectComplement','宾语补足语','Object complement']],'structure','Coffee 指咖啡这种物质或饮品类别，没有分成一杯一杯，所以用零冠词。','Coffee refers to the substance or drink generally, without packaging it into servings, so it takes zero article.'),
      s([['I','subject'],['ordered','predicate'],['a coffee.','object']],'structure','a coffee 把咖啡理解成“一份/一杯咖啡”，当前语境给了它可数单位。','a coffee packages coffee as one serving or cup, giving it a countable unit in this context.'),
      s([['The coffee','subject'],['on my desk','attribute','介词短语作后置定语','Prepositional phrase as postmodifier'],['is','predicate'],['cold.','complement']],'structure','on my desk 锁定了具体那杯或那份咖啡，所以用 the。','on my desk identifies the particular coffee or serving, so the is used.')
    ],[['Coffee 表物质或饮品类别，不划分具体份数，因此使用零冠词。','Coffee denotes the substance or drink generally without dividing it into servings, so it takes zero article.'],['a coffee 表一份咖啡；a/an 只有在语境提供“一份、一次或一种”等自然单位时才能使用。','a coffee means one serving; a/an works only when context supplies a natural unit such as a serving, event or type.'],['the coffee 不负责把 coffee 变成可数，而是让听者识别具体那部分咖啡。','the coffee does not make coffee countable; it identifies a particular portion.']],[
      bq('泛指咖啡这种饮品，应说？','How do we refer to coffee as a drink in general?','Coffee','A coffee','A','物质类别用零冠词。','Use zero article for the substance generally.'),
      bq('在咖啡店首次点一杯未指定的咖啡，可说？','How do we first order one non-specific serving in a café?','a coffee','the coffee','A','a coffee 引入一份未锁定的咖啡；the coffee 要求听者已能识别。','a coffee introduces one unidentified serving; the coffee requires an identifiable one.'),
      bq('特指桌上的咖啡，应说？','How do we refer to the identified coffee on the desk?','the coffee on the desk','coffee on the desk','A','限定信息锁定具体部分，用 the。','The modifier identifies a particular portion, so use the.')
    ]),
    lesson(en,'article-meaning','有无冠词怎样改变意义','How article choice changes meaning','功能、地点与具体对象','Function, location and identified objects',[
      f('go to school ↔ go to the school','structure','go to school 表示去上学；go to the school 指前往那所具体学校。冠词改变的是名词在句中的观察方式。','go to school means attend school; go to the school means go to a particular school. The article changes how the noun is construed.'),
      f('go to bed ↔ sit on the bed','structure','go to bed 表示进入睡觉状态；the bed 把床当作可识别的具体物体。','go to bed means enter the normal sleeping state; the bed treats the bed as an identifiable physical object.'),
      f('have breakfast ↔ have a big breakfast','structure','breakfast 表日常餐名时用零冠词；a big breakfast 把它看成一次被描述的餐。','breakfast as a routine meal name takes zero article; a big breakfast presents one characterized meal.'),
      f('by bus ↔ on the bus','structure','by bus 只说明交通方式；on the bus 把正在乘坐的公交车作为具体地点。','by bus only gives the means of transport; on the bus treats the vehicle being used as an identifiable location.'),
      f('few friends ↔ a few friends · little time ↔ a little time','structure','这里 a 属于数量限定表达：a few/a little 表“有一些”，few/little 表“几乎没有”。应整体理解，但不把它当作所有冠词用法的本质。','Here a is part of a quantity expression: a few/a little means some, while few/little means almost none. Learn the contrast without treating it as the essence of all article use.')
    ],[['school 与 the school、bed 与 the bed 说明：零冠词可突出制度或正常功能，the 指向具体对象。','school versus the school and bed versus the bed show that zero article can foreground institutional function, while the identifies a physical object.'],['breakfast / a big breakfast 与 by bus / on the bus 说明：活动名称在被计次、描写或具体定位后，冠词会随观察方式变化。','breakfast / a big breakfast and by bus / on the bus show that article choice changes when an activity is counted, characterized or physically located.'],['a few/a little 是数量限定表达的局部意义对比，不能拿来概括冠词系统。','a few/a little is a local contrast inside quantity determiners and must not be used to summarize the whole article system.']],[
      bq('学生去上学，应说？','How do we say that a student attends school?','go to school','go to the school','A','这里突出学校的制度功能。','This foregrounds the institutional function of school.'),
      bq('家长去那所学校开会，应说？','How do we say that a parent goes to a particular school for a meeting?','go to the school','go to school','A','这里指具体学校地点。','This refers to a particular school location.'),
      bq('“一顿丰盛的早餐”应说？','How do we express one substantial breakfast?','a big breakfast','big breakfast','A','一次被描写的餐用 a。','One characterized meal takes a.'),
      bq('表示正在那辆公交车上，应说？','How do we say that someone is on the particular bus?','on the bus','by bus','A','这里把公交车作为具体地点。','This treats the bus as an identifiable location.'),
      bq('“还有几个朋友”应说？','Which means “there are still some friends”?','a few friends','few friends','A','a few 表肯定的“有一些”。','a few has the positive meaning “some.”')
    ]),
    lesson(en,'article-groups','the 表示一类人','The for groups of people','形容词、民族名与姓氏复数','Adjectives, nationality names and family names',[
      s([['The rich','subject','主语（群体）','Subject (group)'],['are','predicate'],['not always happy.','complement']],'structure','the rich 表示“富人这一群体”，不是某一个富有的人，因此通常配复数谓语。','the rich refers to rich people as a group, not one rich person, so it normally takes plural agreement.'),
      s([['The French','subject','主语（民族群体）','Subject (national group)'],['are known','predicate'],['for their cuisine.','adverbial','原因/方面状语','Reason/aspect adverbial']],'structure','the French 在这里表示法国人这一民族群体；语言名称 French 单独使用时仍是零冠词。','the French here refers to French people as a national group; the language name French alone still takes zero article.'),
      s([['The Smiths','subject','主语（Smith 一家）','Subject (the Smith family)'],['live','predicate'],['next door.','adverbial','地点状语','Place adverbial']],'structure','姓氏加复数 -s，再加 the，表示这一姓氏的一家人。','A pluralized surname with the refers to the family bearing that surname.')
    ],[['the rich 把形容词整体名词化为一类人，通常使用复数谓语。','the rich turns an adjective into a group of people and normally takes plural agreement.'],['the French 表民族群体；French 表语言，两种结构的冠词和意义不同。','the French denotes a national group, while French denotes the language; their article use and meaning differ.'],['the Smiths 用 the＋姓氏复数表示一家人，不指一个叫 Smith 的人。','the Smiths uses the + plural surname for a family, not one person named Smith.']],[
      bq('“富人这一群体”应说？','How do we refer to rich people as a group?','the rich','a rich','A','the＋形容词可表示一类人。','the + adjective can denote a group of people.'),
      bq('表示法语这门语言，应说？','How do we name the French language?','French','the French','A','语言名 French 用零冠词。','The language name French takes zero article.'),
      bq('表示 Smith 一家，应说？','How do we refer to the Smith family?','the Smiths','the Smith','A','the＋姓氏复数表示一家人。','the + plural surname denotes a family.')
    ])
  ], ['article-countability-shift','article-meaning','article-groups']);
}

module.exports = BUILD_TARGET === 'verb' ? { buildVerbCourse } : BUILD_TARGET === 'numeral' ? { buildNumeralCourse } : BUILD_TARGET === 'article' ? { buildArticleCourse } : { buildVerbCourse, buildNumeralCourse, buildArticleCourse };
