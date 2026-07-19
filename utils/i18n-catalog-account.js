module.exports = {
  profile: {
    'zh-CN': {
      navTitle: '我的', defaultNickname: '同学', syncFailed: '档案暂时无法同步', pendingSync: '待同步', unbound: '未绑定',
      switchedStudent: '已切到学生', switchedParent: '已切到家长', switchFailed: '切换失败', studentMark: '学'
    },
    en: {
      navTitle: 'Me', defaultNickname: 'Student', syncFailed: 'Profile sync is temporarily unavailable', pendingSync: 'Sync pending', unbound: 'Not linked',
      switchedStudent: 'Switched to Student', switchedParent: 'Switched to Parent', switchFailed: 'Could not switch', studentMark: 'S'
    }
  },
  settings: {
    'zh-CN': {
      navTitle: '设置', languageIcon: '文', title: '设置', subtitle: '管理账号、外观与显示语言', accountSection: '账号', preferenceSection: '偏好',
      familyTitle: '家庭与账号', familyDescription: '管理身份、学号与家庭成员', appearanceTitle: '外观主题', appearanceDescription: '选择你喜欢的界面风格',
      languageTitle: '语言', languageDescription: '设置界面显示语言', adminTitle: '后台管理', adminDescription: '查看用户与学习数据', adminBadge: '管理者',
      warmTheme: '雾蓝玻璃', libraryTheme: '图书馆静谧', zhHans: '中文简体', english: 'English'
    },
    en: {
      navTitle: 'Settings', languageIcon: 'A', title: 'Settings', subtitle: 'Account, appearance, and language', accountSection: 'Account', preferenceSection: 'Preferences',
      familyTitle: 'Family & Account', familyDescription: 'Identity, student ID, and family', appearanceTitle: 'Appearance', appearanceDescription: 'Choose an interface style',
      languageTitle: 'Language', languageDescription: 'Choose display language', adminTitle: 'Admin', adminDescription: 'Users and learning activity', adminBadge: 'ADMIN',
      warmTheme: 'Mist Glass', libraryTheme: 'Quiet Library', zhHans: 'Simplified Chinese', english: 'English'
    }
  },
  family: {
    'zh-CN': {
      navTitle: '家庭与账号', title: '家庭与账号', familyTitle: '家庭', connected: '已接通', pendingSync: '待同步',
      completeBinding: '补齐绑定信息', completeBindingCopy: '请输入你的昵称和与孩子的关系，保存后会显示为“昵称 · 关系”。',
      yourNickname: '你的昵称', nicknameExample: '例如 王天龙', relation: '关系', relationExample: '例如 妈妈 / 爸爸 / 老师', save: '保存',
      identityTab: '身份页签', accountIdentity: '账号身份', myNickname: '我的昵称', studentNickname: '学生昵称', required: '（必填）',
      nicknamePlaceholder: '写下常用称呼', changeNickname: '请更换其他名字后继续使用。', saveNickname: '保存昵称', readerNumber: '读者证编号',
      familyRelation: '家庭借阅关系', boundStudents: '绑定学生', boundStudentsCopy: '已绑定的学生在这里，点学生姓名即可切换查看记录。',
      studentMark: '学', studentIdPrefix: '学号：', current: '当前', addMoreStudents: '继续在下面输入学号，可添加更多学生。',
      loginOtherStudent: '登录其他学生账号', studentId: '学号', login: '登录', bind: '绑定',
      fixTodayRecord: '修正今日记录', undoPlayCopy: '撤回今天误记的一次播放', undo: '撤回',
      unbind: '解除绑定', unbindCopy: '解除当前绑定', exit: '退出', members: '成员', localDevice: '本机', parentMark: '家',
      student: '学生', parent: '家长', switched: '切换', boundCount: '已绑定 {count} 人', defaultStudent: '学生',
      enterNickname: '请输入昵称', chooseAnotherNickname: '请更换其他名字', nicknameUpdated: '昵称已更新', updateFailed: '更新失败',
      enterOwnNickname: '先填写你的昵称', enterRelation: '先填写和孩子的关系', updated: '已更新', inviteRefreshed: '邀请码已刷新',
      enterInvite: '先输入邀请码', joinedFamily: '已加入家庭', joinFailed: '加入失败', enterSixDigitId: '请输入 6 位学号',
      studentLoggedIn: '已登录学生账号', studentBound: '已绑定学生', bindFailed: '绑定失败', studentSwitched: '已切换学生',
      exitTitle: '退出孩子记录？', exitContent: '退出后，这个微信将不再连接当前孩子记录。', exited: '已退出孩子记录', exitFailed: '退出失败',
      switchedStudent: '已切到学生', switchedParent: '已切到家长', switchFailed: '切换失败',
      clearPlayTitle: '清掉多记播放？', clearPlayContent: '今天还没打卡，可以清掉家长误记的播放次数。', notNow: '不用', clear: '清掉',
      playCleared: '已清掉多记播放', handled: '已处理', undoFailed: '撤回失败'
    },
    en: {
      navTitle: 'Family & Account', title: 'Family & Account', familyTitle: 'Family', connected: 'Connected', pendingSync: 'Sync pending',
      completeBinding: 'Complete your profile', completeBindingCopy: 'Enter your nickname and relationship to the student. It will appear as “Nickname · Relationship”.',
      yourNickname: 'Your nickname', nicknameExample: 'e.g. Alex', relation: 'Relationship', relationExample: 'e.g. Mom / Dad / Teacher', save: 'Save',
      identityTab: 'Identity', accountIdentity: 'Account identity', myNickname: 'My nickname', studentNickname: 'Student nickname', required: ' (Required)',
      nicknamePlaceholder: 'Enter a preferred name', changeNickname: 'Choose another name to continue.', saveNickname: 'Save nickname', readerNumber: 'Student ID',
      familyRelation: 'Family links', boundStudents: 'Linked students', boundStudentsCopy: 'Tap a linked student to switch whose records you are viewing.',
      studentMark: 'S', studentIdPrefix: 'Student ID: ', current: 'Current', addMoreStudents: 'Enter another student ID below to add more students.',
      loginOtherStudent: 'Log in to another student account', studentId: 'Student ID', login: 'Log in', bind: 'Link',
      fixTodayRecord: 'Correct today’s record', undoPlayCopy: 'Remove one play recorded by mistake today', undo: 'Undo',
      unbind: 'Unlink', unbindCopy: 'Unlink the current student', exit: 'Exit', members: 'Members', localDevice: 'This device', parentMark: 'F',
      student: 'Student', parent: 'Parent', switched: 'Switch', boundCount: '{count} linked', defaultStudent: 'Student',
      enterNickname: 'Enter a nickname', chooseAnotherNickname: 'Choose another name', nicknameUpdated: 'Nickname updated', updateFailed: 'Update failed',
      enterOwnNickname: 'Enter your nickname first', enterRelation: 'Enter your relationship to the student', updated: 'Updated', inviteRefreshed: 'Invite code refreshed',
      enterInvite: 'Enter an invite code first', joinedFamily: 'Joined family', joinFailed: 'Could not join', enterSixDigitId: 'Enter a 6-digit student ID',
      studentLoggedIn: 'Student account logged in', studentBound: 'Student linked', bindFailed: 'Could not link student', studentSwitched: 'Student switched',
      exitTitle: 'Exit this student record?', exitContent: 'This WeChat account will no longer be connected to the current student record.', exited: 'Exited student record', exitFailed: 'Could not exit',
      switchedStudent: 'Switched to Student', switchedParent: 'Switched to Parent', switchFailed: 'Could not switch',
      clearPlayTitle: 'Remove the extra play?', clearPlayContent: 'No check-in has been completed today. You can remove the play recorded by mistake.', notNow: 'Not now', clear: 'Remove',
      playCleared: 'Extra play removed', handled: 'Done', undoFailed: 'Could not undo'
    }
  },
  identity: {
    'zh-CN': {
      navTitle: '身份绑定', title: '绑定身份', subtitle: '用学号，把家长和同一份打卡记录连起来。', parentRole: '我是家长', parentRoleCopy: '输入 6 位学号。',
      studentRole: '我是学生', studentRoleCopy: '查看自己的学号。', bindForStudent: '代学生绑定', applicationTitle: '读者证申请表', enterSixDigits: '输入 6 位数字',
      relationPlaceholder: '和孩子关系，例如 妈妈 / 爸爸 / 老师', bindRecord: '绑定孩子记录', myStudentId: '我的学号', notGenerated: '未生成',
      shareIdCopy: '把这个数字给家长，家长即可加入记录。', studentId: '学号', bindingDisplayCopy: '绑定后会显示为“你的昵称 · 关系”。',
      enterSixDigitId: '请输入 6 位学号', joinedChildRecord: '已加入孩子记录', bindFailed: '绑定失败'
    },
    en: {
      navTitle: 'Link Identity', title: 'Link identity', subtitle: 'Use a student ID to connect a parent to the same learning record.', parentRole: 'I’m a parent', parentRoleCopy: 'Enter a 6-digit student ID.',
      studentRole: 'I’m a student', studentRoleCopy: 'View my student ID.', bindForStudent: 'Link a student', applicationTitle: 'Student link form', enterSixDigits: 'Enter 6 digits',
      relationPlaceholder: 'Relationship, e.g. Mom / Dad / Teacher', bindRecord: 'Link student record', myStudentId: 'My student ID', notGenerated: 'Not generated',
      shareIdCopy: 'Share this number with a parent so they can join the record.', studentId: 'Student ID', bindingDisplayCopy: 'After linking, you will appear as “Nickname · Relationship”.',
      enterSixDigitId: 'Enter a 6-digit student ID', joinedChildRecord: 'Student record linked', bindFailed: 'Could not link record'
    }
  },
  parent: {
    'zh-CN': {
      navTitle: '家长日报', observation: '家庭观察', dailyReport: '日报', today: '今日', defaultNickname: '同学', studentIdPrefix: '学号：', unbound: '未绑定',
      switchStudentPrefix: '切换学生：', todayConclusion: '今日结论', viewLearningFile: '查看学习档案', todaySummary: '今日借阅摘要',
      todayDetails: '今日明细', completedActionsCopy: '{count} 项完成内容，按学习动作整理。', view: '查看', recentSevenDays: '最近 7 天', rhythmCopy: '看节奏，不看压力。', collapse: '收起', noRecord: '无记录',
      learningProfile: '学习画像', itemMinuteSummary: '{count} 项 · {minutes} 分钟', itemCount: '{count} 项', minutes: '{count} 分钟', task: '项', completedActionsLabel: '项完成内容，按学习动作整理。', dateLabel: '{month}月{day}日',
      listeningDuration: '听力时长', readingCompleted: '阅读完成', grammarPractice: '语法练习', writingSubmitted: '写作提交', vocabularyReviewed: '单词背诵', speakingPractice: '口语练习',
      minute: '分钟', article: '篇', questionUnit: '题', wordUnit: '个', timeUnit: '次', listeningTimeCopy: '今日听力用时', completeReading: '完成阅读', completePractice: '完成练习', completeWriting: '完成作文', reviewWords: '背诵单词', completeRecording: '完成录音',
      listening: '听力', reading: '阅读', grammar: '语法', writing: '写作', vocabulary: '词汇', speaking: '口语', recordingScore: '录音评分', completionRecord: '完成记录', student: '学生',
      steadyProgress: '今天有稳定推进', noCompletedToday: '今天还没有完成记录', completedSummary: '已完成 {count} 项{minutes}。', learningMinutesSuffix: '，学习约 {count} 分钟',
      laterCopy: '晚一点完成后，这里会显示今日学习情况。', modulesHaveRecords: '{modules}有记录。', focusMainTask: '先关注今天的主线任务即可。'
    },
    en: {
      navTitle: 'Parent Daily Report', observation: 'Family overview', dailyReport: 'Daily report', today: 'Today', defaultNickname: 'Student', studentIdPrefix: 'Student ID: ', unbound: 'Not linked',
      switchStudentPrefix: 'Switch student: ', todayConclusion: 'Today’s summary', viewLearningFile: 'View learning record', todaySummary: 'Today’s activity',
      todayDetails: 'Today’s details', completedActionsCopy: '{count} completed activities, grouped by learning action.', view: 'View', recentSevenDays: 'Last 7 days', rhythmCopy: 'Focus on rhythm, not pressure.', collapse: 'Collapse', noRecord: 'No record',
      learningProfile: 'Learning overview', itemMinuteSummary: '{count} items · {minutes} min', itemCount: '{count} items', minutes: '{count} min', task: 'items', completedActionsLabel: 'completed activities, grouped by learning action.', dateLabel: '{month}/{day}',
      listeningDuration: 'Listening time', readingCompleted: 'Reading completed', grammarPractice: 'Grammar practice', writingSubmitted: 'Writing submitted', vocabularyReviewed: 'Words reviewed', speakingPractice: 'Speaking practice',
      minute: 'min', article: 'article', questionUnit: 'question', wordUnit: 'word', timeUnit: 'time', listeningTimeCopy: 'Listening time today', completeReading: 'Reading completed', completePractice: 'Practice completed', completeWriting: 'Writing completed', reviewWords: 'Words reviewed', completeRecording: 'Recording completed',
      listening: 'Listening', reading: 'Reading', grammar: 'Grammar', writing: 'Writing', vocabulary: 'Vocabulary', speaking: 'Speaking', recordingScore: 'Recording score', completionRecord: 'Completion record', student: 'Student',
      steadyProgress: 'Steady progress today', noCompletedToday: 'No completed activity yet today', completedSummary: '{count} activities completed{minutes}.', learningMinutesSuffix: ', about {count} minutes of learning',
      laterCopy: 'Today’s learning will appear here after it is completed.', modulesHaveRecords: 'Activity in {modules}.', focusMainTask: 'Focus on today’s main task first.'
    }
  },
  parentDetail: {
    'zh-CN': {
      navTitle: '日报详情', observationDaily: '家庭观察日报', detailTitle: '日报详情', envelope: '信封', actionSummary: '今天留下了 {count} 个学习动作，累计 {minutes} 分钟。',
      completedItems: '完成 {count} 项', plannedItems: '计划 {count} 项', learningMinutes: '{count} 分钟', studyRhythm: '学习节奏', taskCount: '{count} 个任务',
      actionCountJoin: '个学习动作，累计', minuteUnit: '分钟。', plannedLabel: '记录', learningMinutesLabel: '学习分钟', taskUnit: '个任务', listenLabel: '听读', scoredLabel: '已评分',
      completed: '完成', pending: '待完成', listenRepeat: '听读 {count} / {target} 遍', noCompletionTime: '还没有完成时间记录', noDayRecord: '这一天还没有记录。',
      voiceArchive: '声音档案', scoredCount: '{count} / {total} 已评分', averageScore: '平均分', latestScore: '最近得分', recordingPrefix: '录音 ',
      playRecording: '播放录音', pauseRecording: '暂停录音', resumePlaying: '继续播放', noRecording: '这一天还没有录音。',
      contentArchive: '内容档案', onDemand: '按需查看', openDossier: '打开当天内容案卷', dossierCopy: '按模块查看当天学习明细。', open: '打开', recordCount: '{count} 条记录', speaking: '口语',
      answerPrefix: '答题 ', collapseDetail: '收起详情', loadingDetail: '加载详情中', source: '原文', writingPrompt: '作文题目', studentEssay: '学生作文',
      analysis: '分析', content: '内容', language: '语言', structure: '结构', spelling: '拼写', issues: '问题', suggestions: '建议', referenceEssay: '参考范文',
      meaningPrefix: '含义：', examplePrefix: '例句：', translationPrefix: '译文：', questionPrefix: '第 ', questionSuffix: ' 题', correct: '正确', correction: '订正', answer: '答案',
      childChoicePrefix: '孩子选择：', oldChoiceMissing: '旧记录未保存选择', locatingSentencePrefix: '定位句：', noLearningContent: '这一天还没有学习内容记录。',
      latestAttempt: '最近一次', passNumber: '第 {count} 遍', dateLabel: '{month}月{day}日', followRecording: '跟读录音', answerRecording: '回答录音', thisRecording: '本次录音', seconds: '{count}秒', scorePending: '待评分', saved: '已保存',
      pronunciationContent: '发音 {pronunciation} · 内容 {content}', listening: '听力', reading: '阅读', grammar: '语法', writing: '写作', vocabulary: '词汇', complete: '完成', listeningCourse: '听力课程', completionRecord: '完成记录',
      viewStudyPack: '查看学习包', viewOriginalAnalysis: '查看原题和分析', score: '{score} 分', scoreFraction: '{score}/{total} 分', questionCount: '{correct}/{total} 题',
      memorization: '背诵', dictation: '听写', studyPack: '学习包', dailyReview: '日常复习', memorizationProgress: '复习 {reviewed} 词 · 不熟 {unfamiliar} 词', vocabularyPlanProgress: '主学 {main} 词 · 到期复习 {review} 词 · 不熟 {unfamiliar} 词', dictationProgress: '正确 {correct}/{total} · 错词 {wrong}',
      recordingPlaybackFailed: '录音播放失败', recordLoadFailed: '记录加载失败', taskLocationMissing: '学习包缺少任务定位', recordingUnavailable: '录音暂不可播放', recordingLoadFailed: '录音加载失败', viewOriginalGrammar: '查看原词法课堂', viewOriginalListening: '查看原听力课程'
    },
    en: {
      navTitle: 'Daily Report Details', observationDaily: 'Family daily report', detailTitle: 'Report details', envelope: 'Report', actionSummary: '{count} learning activities today, {minutes} minutes in total.',
      completedItems: '{count} completed', plannedItems: '{count} planned', learningMinutes: '{count} min', studyRhythm: 'Learning rhythm', taskCount: '{count} tasks',
      actionCountJoin: 'learning activities,', minuteUnit: 'minutes total.', plannedLabel: 'Records', learningMinutesLabel: 'Minutes', taskUnit: 'tasks', listenLabel: 'Listened', scoredLabel: 'scored',
      completed: 'Completed', pending: 'Pending', listenRepeat: 'Listened {count} / {target} times', noCompletionTime: 'No completion time recorded', noDayRecord: 'No record for this day.',
      voiceArchive: 'Voice records', scoredCount: '{count} / {total} scored', averageScore: 'Average score', latestScore: 'Latest score', recordingPrefix: 'Recording ',
      playRecording: 'Play recording', pauseRecording: 'Pause recording', resumePlaying: 'Resume', noRecording: 'No recording for this day.',
      contentArchive: 'Learning content', onDemand: 'View on demand', openDossier: 'Open this day’s learning content', dossierCopy: 'View this day’s learning details by module.', open: 'Open', recordCount: '{count} records', speaking: 'Speaking',
      answerPrefix: 'Answers ', collapseDetail: 'Collapse details', loadingDetail: 'Loading details', source: 'Source text', writingPrompt: 'Writing prompt', studentEssay: 'Student essay',
      analysis: 'Analysis', content: 'Content', language: 'Language', structure: 'Structure', spelling: 'Spelling', issues: 'Issues', suggestions: 'Suggestions', referenceEssay: 'Sample essay',
      meaningPrefix: 'Meaning: ', examplePrefix: 'Example: ', translationPrefix: 'Translation: ', questionPrefix: 'Question ', questionSuffix: '', correct: 'Correct', correction: 'Review', answer: 'Answer',
      childChoicePrefix: 'Student choice: ', oldChoiceMissing: 'Choice not saved in this older record', locatingSentencePrefix: 'Evidence: ', noLearningContent: 'No learning content recorded for this day.',
      latestAttempt: 'Latest attempt', passNumber: 'Pass {count}', dateLabel: '{month}/{day}', followRecording: 'Repeat recording', answerRecording: 'Answer recording', thisRecording: 'This recording', seconds: '{count}s', scorePending: 'Scoring pending', saved: 'Saved',
      pronunciationContent: 'Pronunciation {pronunciation} · Content {content}', listening: 'Listening', reading: 'Reading', grammar: 'Grammar', writing: 'Writing', vocabulary: 'Vocabulary', complete: 'Completed', listeningCourse: 'Listening lesson', completionRecord: 'Completion record',
      viewStudyPack: 'View study pack', viewOriginalAnalysis: 'View question and analysis', score: '{score} points', scoreFraction: '{score}/{total} points', questionCount: '{correct}/{total} questions',
      memorization: 'Review', dictation: 'Dictation', studyPack: 'Study pack', dailyReview: 'Daily review', memorizationProgress: 'Reviewed {reviewed} words · Unfamiliar {unfamiliar}', vocabularyPlanProgress: 'Main {main} words · Due review {review} words · Unfamiliar {unfamiliar}', dictationProgress: 'Correct {correct}/{total} · Wrong {wrong}',
      recordingPlaybackFailed: 'Could not play recording', recordLoadFailed: 'Could not load record', taskLocationMissing: 'Task reference is missing', recordingUnavailable: 'Recording is temporarily unavailable', recordingLoadFailed: 'Could not load recording', viewOriginalGrammar: 'View original grammar lesson', viewOriginalListening: 'View original listening lesson'
    }
  },
  record: {
    'zh-CN': {
      navTitle: '成长记录', archive: '成长档案', title: '成长轨迹', growth: '成长', synced: '已同步', localState: '本地状态', streak: '连续', total: '累计',
      daySuffix: '天', task: '任务', totalDays: '累计天数', totalDuration: '累计时长', completedTasks: '完成任务', dateIndex: '日期索引', calendarHeatmap: '日历热力',
      calendarCopy: '每天一格，记录被点亮。', recentContent: '正在使用最近内容', tapDate: '点日期查看当天记录', catchupStrip: '追赶借阅条', learningTrack: '学习轨迹',
      catchupPurpose: '完成真实任务，点亮漏掉的一天。', viewCatchup: '查看追赶任务', catchupLoadCopy: '按需加载可补做的真实任务。', view: '查看', lit: '已点亮', continue: '继续',
      dossier: '成长档案袋', reportCard: '报告卡', noDayRecord: '这一天还没有记录。', recentScore: '最近 {score} 分 · {count} 次回答', completed: '完成', wait: '等待',
      recentPrefix: '最近 ', scoreJoin: ' 分 · ', answerCountSuffix: ' 次回答', pronunciationLabel: '发音流畅', contentLabel: '内容语法', debugLibrary: '馆藏校验单', debugPoint: '调试断点',
      pronunciationContent: '发音流畅 {pronunciation} / 内容语法 {content}', questionPrefix: '问题：', answerPrefix: '回答：', noAnalysis: '暂无分析', playAnswer: '播放回答', playAnalysis: '播放分析',
      sunday: '日', monday: '一', tuesday: '二', wednesday: '三', thursday: '四', friday: '五', saturday: '六', monthDay: '{month}月{day}日', calendarTitle: '{year}年{month}月',
      notCompleted: '未完成', zeroMinutes: '0 分钟', passNumber: '第 {count} 遍', totalCheckins: '累计打卡', streakCheckins: '连续打卡',
      hoursMinutes: '{hours}小时{minutes}分钟', hours: '{hours}小时', minutes: '{minutes}分钟', available: '可追赶', availableCopy: '可点亮 {date}', usedToday: '今日已用', tomorrow: '明天继续',
      finishTodayFirst: '先完成今日', finishTodayCopy: '完成今日后可追赶', notNeeded: '无需追赶', normalRhythm: '节奏正常', attemptNumber: '第 {count} 次回答', scorePending: '待评分', score: '{score} 分',
      vocabulary: '词汇', reading: '阅读', grammar: '语法', writing: '写作', completionRecord: '完成记录', hasRecord: '有记录', loading: '待加载', streakDays: '连续 {count} 天',
      catchupLoadFailed: '追赶任务加载失败', noSuggestionAudio: '暂无建议语音', noRecording: '暂无录音', playbackFailed: '播放失败'
    },
    en: {
      navTitle: 'Growth Record', archive: 'Growth archive', title: 'Growth journey', growth: 'Growth', synced: 'Synced', localState: 'Local data', streak: 'Streak', total: 'Total',
      daySuffix: ' days', task: 'Tasks', totalDays: 'Total days', totalDuration: 'Total time', completedTasks: 'Completed tasks', dateIndex: 'Date index', calendarHeatmap: 'Activity calendar',
      calendarCopy: 'Each day lights up as learning is recorded.', recentContent: 'Showing recent content', tapDate: 'Tap a date to view its record', catchupStrip: 'Catch-up', learningTrack: 'Learning journey',
      catchupPurpose: 'Complete a real task to fill a missed day.', viewCatchup: 'View catch-up tasks', catchupLoadCopy: 'Load available tasks when needed.', view: 'View', lit: 'Completed', continue: 'Continue',
      dossier: 'Growth record', reportCard: 'Report card', noDayRecord: 'No record for this day.', recentScore: 'Latest {score} · {count} answers', completed: 'Completed', wait: 'Waiting',
      recentPrefix: 'Latest ', scoreJoin: ' · ', answerCountSuffix: ' answers', pronunciationLabel: 'Pronunciation', contentLabel: 'Content', debugLibrary: 'Diagnostics', debugPoint: 'Diagnostics',
      pronunciationContent: 'Pronunciation & fluency {pronunciation} / Content & grammar {content}', questionPrefix: 'Question: ', answerPrefix: 'Answer: ', noAnalysis: 'No analysis yet', playAnswer: 'Play answer', playAnalysis: 'Play feedback',
      sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', monthDay: '{month}/{day}', calendarTitle: '{month}/{year}',
      notCompleted: 'Not completed', zeroMinutes: '0 min', passNumber: 'Pass {count}', totalCheckins: 'Total check-ins', streakCheckins: 'Check-in streak',
      hoursMinutes: '{hours}h {minutes}m', hours: '{hours}h', minutes: '{minutes} min', available: 'Available', availableCopy: 'Can fill {date}', usedToday: 'Used today', tomorrow: 'Continue tomorrow',
      finishTodayFirst: 'Finish today first', finishTodayCopy: 'Catch up after today’s task', notNeeded: 'No catch-up needed', normalRhythm: 'On track', attemptNumber: 'Answer {count}', scorePending: 'Scoring pending', score: '{score} points',
      vocabulary: 'Vocabulary', reading: 'Reading', grammar: 'Grammar', writing: 'Writing', completionRecord: 'Completion record', hasRecord: 'Activity recorded', loading: 'Loading', streakDays: '{count}-day streak',
      catchupLoadFailed: 'Could not load catch-up tasks', noSuggestionAudio: 'No feedback audio', noRecording: 'No recording', playbackFailed: 'Playback failed'
    }
  },
  admin: {
    'zh-CN': {
      navTitle: '后台', archiveTitle: '管理档案', defaultCopy: '默认显示多次登录的活跃用户', activeUserCount: '{count} 个活跃用户', activeUsers: '活跃用户', inactiveUsers: '不活跃用户',
      active: '活跃', inactive: '不活跃', unavailable: '后台暂时不可用', retry: '重试', noUsers: '暂无用户', defaultNickname: '同学', student: '学生', parent: '家长',
      parentCount: '{count} 位家长', collapse: '收起', expand: '展开', notGenerated: '未生成', unnamed: '未命名', notRecorded: '未记录',
      loginSummary: '登录 {count} 次 · 最近 {date}', activitySummary: '登录 {count} 次 · 学习 {activity} 条 · 最近 {date}', noPermission: '当前微信没有后台权限。',
      permissionOrDeployError: '当前微信没有后台权限，或云函数还没有部署最新版本。', loadFailed: '后台数据加载失败，请重新部署 yoyo 云函数后再试。'
    },
    en: {
      navTitle: 'Admin', archiveTitle: 'User records', defaultCopy: 'Active users with multiple logins are shown by default', activeUserCount: '{count} active users', activeUsers: 'Active users', inactiveUsers: 'Inactive users',
      active: 'Active', inactive: 'Inactive', unavailable: 'Admin is temporarily unavailable', retry: 'Retry', noUsers: 'No users', defaultNickname: 'Student', student: 'Student', parent: 'Parent',
      parentCount: '{count} parents', collapse: 'Collapse', expand: 'Expand', notGenerated: 'Not generated', unnamed: 'Unnamed', notRecorded: 'Not recorded',
      loginSummary: '{count} logins · Latest {date}', activitySummary: '{count} logins · {activity} learning records · Latest {date}', noPermission: 'This WeChat account does not have admin access.',
      permissionOrDeployError: 'This WeChat account does not have admin access, or the latest cloud function has not been deployed.', loadFailed: 'Could not load admin data. Deploy the latest yoyo cloud function and try again.'
    }
  }
};

module.exports.record['zh-CN'].grammarMicroLesson = '词法微课';
module.exports.record.en.grammarMicroLesson = 'Grammar Micro-lesson';
module.exports.parentDetail['zh-CN'].grammarMicroLesson = '词法微课';
module.exports.parentDetail.en.grammarMicroLesson = 'Grammar Micro-lesson';

Object.assign(module.exports.record['zh-CN'], { syncingDuration: '同步中' });
Object.assign(module.exports.record.en, { syncingDuration: 'Syncing' });
