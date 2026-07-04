# 上海中考英语二模结构化规则

适用：上海中考英语一模/二模同类试卷，尤其阅读 A/B/C/D 和语法单选。

## 先读规则

后续处理同类结构化任务前，先读本文件，再看对应年份脚本和已有正式 JSON。

## 输出目录

- 原始抽取：`data/imports/<batch>/reading.json`
- 语法原始抽取：`data/imports/<batch>/grammar-choice.json`
- 正式阅读：`data/imports/<batch>/formal/reading-passages.formal.json`
- 正式语法：`data/imports/<batch>/formal/grammar-choice.formal.json`
- 清洗报告：`data/imports/<batch>/formal/clean-report.json`

## 正式阅读格式

阅读一份卷子通常按 4 篇入库，难度不同，不能混成一篇：

- A：阅读选择，选择题，`difficultyLevel: 1`，`difficultyLabel: 基础理解`
- B：完形填空，选择题，`difficultyLevel: 2`，`difficultyLabel: 语境词汇`
- C：首字母填空，填空题，`difficultyLevel: 3`，`difficultyLabel: 综合运用`
- D：回答问题，问答题，`difficultyLevel: 4`，`difficultyLabel: 表达输出`

每篇阅读保留：

- `_id`: `sh-em2-<year>-<district>-reading-<section>`
- `title`: `<year> 上海<district>二模阅读 <section>`
- `year`, `city`, `district`, `examType`, `section`
- `sectionLabel`, `difficultyLevel`, `difficultyLabel`
- `sourceType`: `shanghai-mock`
- `sourceFile`: 只保留文件名
- `passage`
- `questions`
- `answerSentences`, `phrases`, `vocabulary`: 空数组

每题保留：

- `number`
- `prompt`
- A/B 选择题保留 `options.A/B/C/D`
- C/D 不写 `options`，小程序按填空/问答输入框处理
- `answer`
- `questionType`: `choice` / `blank` / `answer`

## 清洗准入

阅读正式入库条件：

- 有年份和区县
- `passage` 长度不少于 500 字符
- 有效题不少于 5 题
- A/B 每题必须有 A-D 四个选项，答案为 A/B/C/D
- C/D 不要求选项；能稳定识别答案时写入，不能稳定匹配时先留空，避免错配
- 剔除解析语句、考点说明、`故选` 等非题干内容
- 剔除无法完整还原的组合题：题干里混入下一题题号（如 `71... 72...`）且选项仅为 `①②③` 这类编号组合时，不入库；如果剔除后该篇少于 5 题，整篇不进入最终阅读库。
- 阅读提交后的逐题解析和答案句不靠本地兜底文案，必须调用阅读模型生成；答案句必须是原文直接依据，并带中文翻译。

语法正式入库条件：

- 有年份和区县
- 正好 15 题
- 每题有 A-D 四个选项和答案

## 语法选择题分类规则

语法分类输出固定到：

- `data/grammar/shanghai-em2-grammar-questions.json`
- `data/grammar/shanghai-em2-grammar-by-topic.json`
- `data/grammar/grammar-topic-types.json`

每题保留：

- `_id`, `sourceSetId`
- `year`, `city`, `district`, `examType`, `sourceFile`
- `number`, `prompt`, `options`, `answer`
- `categoryId`, `category`, `subtopicId`, `subtopic`
- `topicId`, `topic`, `stage`, `questionType`
- GPT 分类时可保留 `topicReason`

小程序语法目录固定两级：

- 动词类：时态、语态、情态动词、非谓语、主谓一致
- 词法类：名词、冠词、代词、形容词副词、介词、数词
- 从句类：宾语从句、状语从句、定语从句
- 句型结构类：固定句型、感叹句、反意疑问句、倒装
- 连词逻辑类：并列、转折、原因、条件、时间、让步
- 情景交际类：日常口语表达

小程序语法入口目录固定为四层：

- 难度：初中 / 高中
- 模考：二模 / 一模
- 大类：动词类、词法类、从句类、句型结构类、连词逻辑类、情景交际类
- 细分考点：进入具体题目

当前上海二模数据全部挂到 `初中 -> 二模`；后续一模语法题挂到 `初中 -> 一模`，不要混入二模目录。

GPT 初分考点后，使用 `scripts/regroup_grammar_categories.py` 重建大类和细分目录。

本地规则分类只作兜底：

- 选项集中出现 `a/an/the//`：冠词
- 选项集中出现 `must/may/can/could/should/need/would`：情态动词
- 选项集中出现介词：介词
- 选项集中出现人称、物主、反身、不定代词：代词
- 选项考查 `to do/doing/done` 且题干有固定搭配触发词：非谓语动词
- 选项或题干含时态标志词、助动词、被动结构：时态语态
- 选项或题干含 `if/whether/when/because/although/which/who/what/how`：连词与从句
- 选项或题干含比较级、最高级、程度副词、感官系动词：形容词副词
- 感叹句、there be、固定句式：句型结构
- 交际问答、礼貌请求、应答语：情景交际
- 语音画线题不作为语法考点，归入 `other`
- 词组、动词短语、词义辨析：词义与短语辨析

GPT-5.5 分类规则：

- 脚本：`scripts/classify_grammar_with_gpt.py`
- 批量读取 `data/grammar/shanghai-em2-grammar-questions.json`
- 每批按固定 `topicId` 分类，不允许自创考点
- 按“真正考查点”分类，不按选项表面词乱分
- GPT 输出覆盖本地粗分类，并重建 by-topic 和 topic-types
- 跑完后重新上传 3 个语法 JSON 到 CloudBase

## 语法数据上传与读取规则

语法云存储固定上传到：

- `_content/grammar/grammar-topic-types.json`
- `_content/grammar/shanghai-em2-grammar-by-topic.json`
- `_content/grammar/shanghai-em2-grammar-questions.json`
- `_content/grammar/topics/*.json`

`topics/*.json` 必须按细分考点拆分，避免云函数一次返回超过 1MB。文件名必须使用 `sha1(topicId).json`，不要用中文、冒号或 URL 编码文件名。

生成细分文件后至少检查：

```bash
find data/grammar/topics -maxdepth 1 -type f -name '*.json' | wc -l
node -e "const fs=require('fs'),crypto=require('crypto');const id='verb:时态';const f='data/grammar/topics/'+crypto.createHash('sha1').update(id).digest('hex')+'.json';const d=JSON.parse(fs.readFileSync(f,'utf8'));console.log(d.topicId,d.questions.length)"
```

云函数读取规则：

- `getGrammarHome` 只返回 `grammar-topic-types.json` 的目录字段，不返回题目列表。
- `getGrammarTopic` 通过 `payload.topicId` 读取 `_content/grammar/topics/<sha1(topicId)>.json`。
- `safeDownloadJson` 必须保留对象格式；`topics/*.json` 是 `{ topicId, topic, questions }`，不能只接受数组或 `{items,data}`。
- 改完语法读取逻辑后必须重新上传 `cloudfunctions/yoyo`，只上传云存储不会生效。

## 一模阅读上传与读取规则

一模阅读不要合并进二模阅读 JSON。本地生成到：

- `data/reading-em1/reading-passages.json`

云存储上传到：

- `_content/reading-em1/reading-passages.json`

二模阅读仍上传到：

- `_content/reading/reading-passages.json`

云函数 `reading.service.js` 会同时读取两份文件，小程序按 `examType: 一模/二模` 分组显示。

一模阅读清洗优先规则抽取，不用 GPT 改题干、选项、答案；GPT-5.5 只用于用户提交后生成逐题解析、原文答案句和中文翻译。

## 一模写作上传规则

一模写作本地生成到：

- `data/writing-em1/writing-prompts.json`

云存储上传到：

- `_content/writing-em1/writing-prompts.json`

写作题归入 `stage: 初中`、`category: 初中作文`。清洗只保留作文题干、情景、字数要求和注意事项；剔除参考答案、范文、评分标准、听力文本。

二模写作本地生成到：

- `data/writing-em2/writing-prompts.json`

云存储上传到：

- `_content/writing-em2/writing-prompts.json`

## 二模听力上传规则

二模听力不要合并进阅读或写作 JSON。本地生成到：

- `data/listening-em2/listening-sets.json`
- `data/listening-em2/listening-practice.json`
- `data/listening-em2/audio/`
- `data/listening-em2/images/`

云存储上传到：

- `_content/listening-em2/listening-sets.json`
- `_content/listening-em2/listening-practice.json`
- `_content/listening-em2/audio/`
- `_content/listening-em2/images/`

云存储路径必须逐字符核对，文件夹名和文件名前后不能有空格。上传后必须用 HTTPS 地址验证 `listening-practice.json` 返回 200；如果返回 404，优先检查是否建成了 `_content/listening-em1/ listening-practice.json`、`_content/ listening-em1/` 这类带空格路径。

每套听力按年份和区县归档，字段保留 `sourceYear`、`year`、`audioCloudPath`、`transcript`、`hasAudio`、`hasTranscript`。原始文件夹年份和实际考试年份不一致时，优先按音频实际年份和原卷学年结束年份显示：如 `2019-2020` 学年卷且音频为 2020，则 `year` 写 2020；其他明确届别/源目录领先一年的素材才按 `sourceYear - 1`。`sourceYear` 只用于追溯原始来源；音频路径也必须跟随显示年份映射，不能出现 2022 套卷链接 2023 音频。2012 原目录标注无音频；若只有“听力文本及参考答案”而无音频，正式上传数据直接剔除。

听力练习题必须来自原卷，不允许用 1-20 占位模板。正式练习库只保留同时满足：有音频、有原卷 1-20 题结构、有 A 部分图片题图片。缺图或题目不全的套卷先不进练习入口。

听力题目按原卷 A/B/C/D 四段保留分段字段：1-5 为 A 图片题，6-10 为 B 对话选择题，11-15 为 C 判断题，16-20 为 D 填空题。清洗选项时必须过滤 A/B/C/D 段落说明，不能把 `Listen and choose the right picture`、`Listen to the dialogue/passage` 等段落标题识别成选项文本。

图片清洗从 A 部分 `Listen and choose the right picture` 开始，到 Part 2 之前结束；A 部分图片必须保留，B/C/D 部分若原卷有听力配图也必须保留。不得把整份 docx 的学科网 logo、阅读图片、网页页眉、二维码或其他素材当作听力图片。只保留小程序可直接显示的 PNG/JPG/GIF；WMF 等不可显示格式必须过滤，不能占用 A/B/C 选项位置。A 部分图片抽取不稳定时，该套不进入正式练习入口。

听力文本只收真实听力原文或听力文字稿，可来自答案、听力文本、听力文稿、录音文字稿等文件。仅有答案、解析、题干或“原文略”的文件不能当作 `transcript`；缺真实原文时 `hasTranscript: false`，不人工补写、不跨年借用。

## 一模听力上传规则

一模听力不要合并进二模听力 JSON。本地生成到：

- `data/listening-em1/listening-practice.json`
- `data/listening-em1/audio/`
- `data/listening-em1/images/`

云存储上传到：

- `_content/listening-em1/listening-practice.json`
- `_content/listening-em1/audio/`
- `_content/listening-em1/images/`

一模上传同样必须检查路径无前后空格；尤其是 `listening-practice.json` 文件名前不能有空格。验证地址必须是 `_content/listening-em1/listening-practice.json` 并返回 200。

一模听力沿用二模听力清洗准入：必须同时具备音频、原卷题目、20 题答案、A 部分图片题图片。A 部分图片只从 `Listen and choose the right picture` 到 B 部分之前抽取；文本只收真实听力原文或文字稿，不人工补写。

一模听力同样按 `displayYear = sourceYear - 1` 对齐实际考试年。比如 `2025届` 一模素材实际对应 2024 学年/2024 音频，不能挂到 2025 展示年；若 2025 展示年缺 2026 源里的对应音频，该区县先不进入练习库。

一模音频上传时文件名必须带内容指纹，例如 `sh-em1-2025-普陀-listening-651d8aa3.mp3`。不要复用旧的同名音频路径覆盖上传，否则小程序临时链接或缓存可能继续播放旧年份音频。

本地重清洗时，一模只读源目录里的 `一模` 分支并输出到 `data/listening-em1`；二模只读源目录里的 `二模` 分支并输出到 `data/listening-em2`。一模、二模不得互相借音频、图片、题目或文本。

## 元数据规则

- `浦东新区` 统一为 `浦东`
- `黄埔` 统一为 `黄浦`
- 只收真实区县试卷；专项汇编、押题卷、模拟卷缺区县时不进正式库
- 同一区县同一 section 重复时，保留有效题更多的一版

## 答案识别

必须支持：

- `59. A`
- `59 A`
- `59-64 DCDABC`
- `65-70 BACADC`
- 解析行回填：如 `59 ... 故选C`

## 2024/2025 对齐口径

- 结构以 `formal/*.formal.json` 为准
- 阅读 A/B/C/D 分开成独立 item
- 题号保持原卷题号，不重排
- 不把中文解析写入题干、选项或 passage
- 不补写题目解释、词汇、定位句，除非后续单独要求
- 项目词典不只限阅读板块；语法等其他板块在学生做完题后，也可对题目和选项调用词典。
- 词典发音只保留单词和短语级别；句子、句型、例句不提供发音功能。发音统一使用按钮内轻反馈：点击后按钮显示 `…` 并轻微呼吸，播放完成恢复“发音”，不弹大块“生成发音中”提示。

## 验证

每次生成后至少检查：

```bash
python3 -m json.tool data/imports/<batch>/formal/reading-passages.formal.json >/dev/null
python3 -m json.tool data/imports/<batch>/formal/clean-report.json >/dev/null
```

并统计：

- 各年份正式阅读数量
- 空答案数量必须为 0
- 剩余 rejected reason
