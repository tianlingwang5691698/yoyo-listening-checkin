const CATEGORY_LABELS = {
  newconcept1: 'New Concept 1',
  newconcept2: 'New Concept 2',
  newconcept3: 'New Concept 3',
  newconcept4: 'New Concept 4',
  peppa: 'Peppa',
  unlock1: 'Unlock 1',
  song: 'Songs'
};

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function getTaskPresentation(task) {
  const title = String((task && task.title) || '').trim();
  if (!task) {
    return { displayTitle: '', displaySubtitle: '', coverVariant: 'song', coverBadge: '' };
  }
  if (task.category === 'peppa') {
    const match = title.match(/^S(\d)(\d{2})\s+(.+)$/i);
    if (match) {
      return {
        displayTitle: match[3],
        displaySubtitle: `${Number(match[1])}-${Number(match[2])}`,
        coverVariant: 'peppa',
        coverBadge: 'Peppa'
      };
    }
  }
  if (['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'].includes(task.category)) {
    const levelNumber = task.category === 'newconcept1' ? 1 : 2;
    return {
      displayTitle: title,
      displaySubtitle: `New Concept English ${levelNumber}`,
      coverVariant: 'unlock',
      coverBadge: `New Concept ${levelNumber}`,
      coverMeta: `New Concept English ${levelNumber}`
    };
  }
  if (task.category === 'unlock1') {
    const match = title.match(/Unlock2e_A1_(\d+\.\d+)/i);
    return {
      displayTitle: match ? match[1] : title,
      displaySubtitle: 'A1 Listen & Speak',
      coverVariant: 'unlock',
      coverBadge: 'Unlock-1'
    };
  }
  if (task.category === 'song') {
    const match = title.match(/^0*([0-9]+)(?:[.\s_-]+)(.+)$/);
    return {
      displayTitle: match ? match[2].trim() : (title || 'Daily Song'),
      displaySubtitle: match ? `Song ${Number(match[1])}` : 'Super Simple Songs',
      coverVariant: 'song',
      coverBadge: 'Song'
    };
  }
  return {
    displayTitle: 'Daily Song',
    displaySubtitle: '等待 Songs 音频',
    coverVariant: 'song',
    coverBadge: 'Song'
  };
}

function getTaskReward(category, progress, task) {
  const nextStep = Math.min((progress && progress.playCount || 0) + 1, (task && task.repeatTarget) || 3);
  if (category === 'peppa') {
    return {
      rewardBadge: progress && progress.completedToday ? 'MUDDY BOOTS' : `PEPPA ${nextStep}`,
      rewardTitle: progress && progress.completedToday ? '泥坑探险章拿到了' : '泥坑探险线',
      rewardCopy: progress && progress.completedToday ? '这一集今天已经顺利通关。' : '前两遍盲听，最后一遍带文本高亮。'
    };
  }
  if (['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'].includes(category)) {
    return {
      rewardBadge: category === 'newconcept1' ? 'NCE 1' : 'NCE 2',
      rewardTitle: category === 'newconcept1' ? 'New Concept 1' : 'New Concept 2',
      rewardCopy: progress && progress.completedToday ? '今天这条已经完成。' : '按三遍节奏听，第二遍专心盲听。'
    };
  }
  if (category === 'unlock1') {
    return {
      rewardBadge: progress && progress.completedToday ? 'UNLOCKED' : `UNLOCK ${nextStep}`,
      rewardTitle: progress && progress.completedToday ? '学习徽章已点亮' : '学习任务线',
      rewardCopy: progress && progress.completedToday ? '这一条已经听满 3 遍。'
        : nextStep < 3 ? '先把这条学习音频稳稳听完。'
          : (task && task.transcriptTrackId ? '最后一遍会带着文本一起听，像把这一关认真收尾。' : '最后一遍先按纯听力完成，文本高亮正在分批接入。')
    };
  }
  return {
    rewardBadge: progress && progress.completedToday ? 'SING STAR' : `SONG ${nextStep}`,
    rewardTitle: progress && progress.completedToday ? 'Songs 小星星到手了' : 'Songs 星星线',
    rewardCopy: progress && progress.completedToday ? '今天这首歌已经完成。' : ((task && task.syncGranularity === 'line') ? '这条 Songs 按句级文本同步，先把整句节奏听稳。' : '放入 Songs 后就会开始轮换。')
  };
}

function decorateTask(task, progress, category, deps) {
  const {
    songPlaceholder,
    getMediaDisplayName
  } = deps;
  if (!task) {
    const emptyTask = category === 'unlock1'
      ? {
        taskId: 'unlock1-pending',
        category: 'unlock1',
        title: 'Unlock 1',
        subtitle: '检查云端 Unlock1 目录',
        audioUrl: '',
        audioCloudPath: '',
        audioFileId: '',
        audioSource: 'none',
        repeatTarget: 3,
        durationSec: 0,
        coverTone: 'peach',
        transcriptTrackId: null,
        textSource: null
      }
      : songPlaceholder;
    const base = getTaskPresentation(emptyTask);
    return Object.assign({}, emptyTask, base, {
      category,
      categoryLabel: getCategoryLabel(category),
      audioCompactTitle: '',
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      textUnlocked: false,
      completedToday: false,
      isPendingAsset: true,
      note: category === 'unlock1'
        ? 'Unlock1 音频暂时未就绪，先检查训练池或云目录。'
        : '把 Songs 音频放进来后，这里就会开始轮换。',
      rewardBadge: category === 'unlock1' ? 'UNLOCK 1' : 'SONG 1',
      rewardTitle: category === 'unlock1' ? '学习任务线' : 'Songs 星星线',
      rewardCopy: category === 'unlock1'
        ? 'Unlock1 素材恢复后，这条奖励线会继续推进。'
        : '把 Songs 音频和 bundle 放进来后，这条奖励线就会亮起来。'
    });
  }
  const base = getTaskPresentation(task);
  const completedCount = Math.min(progress.playCount, task.repeatTarget);
  const currentPass = progress.completedToday ? task.repeatTarget : Math.min(progress.playCount + 1, task.repeatTarget);
  const textUnlocked = progress.playCount >= task.repeatTarget - 1 || progress.completedToday;
  const transcriptTrackId = task.transcriptTrackId || null;
  const reward = getTaskReward(category, progress, Object.assign({}, task, { transcriptTrackId }));
  return Object.assign({}, task, base, {
    category,
    categoryLabel: getCategoryLabel(category),
    transcriptTrackId,
    syncGranularity: task.syncGranularity || 'word',
    audioDisplayName: getMediaDisplayName(task.audioUrl),
    audioCompactTitle: category === 'peppa'
      ? [base.displaySubtitle, base.displayTitle].filter(Boolean).join(' · ')
      : category === 'unlock1'
        ? [base.coverBadge, base.displayTitle].filter(Boolean).join(' · ')
        : [base.displayTitle, base.displaySubtitle].filter(Boolean).join(' · '),
    playCount: progress.playCount,
    playMoments: Array.isArray(progress.playMoments) ? progress.playMoments : [],
    playStepText: `${completedCount}/${task.repeatTarget}`,
    currentPass,
    textUnlocked,
    transcriptVisible: currentPass !== 2,
    completedToday: progress.completedToday,
    updatedAt: progress.updatedAt || '',
    transcriptStatus: transcriptTrackId ? 'ready' : (task.textSource ? 'pending' : 'none'),
    transcriptBatch: task.transcriptBatch || null,
    note: currentPass < task.repeatTarget ? `先完成第 ${currentPass} 遍。`
      : (transcriptTrackId ? ((task.syncGranularity === 'line') ? '最后一遍会带句级文本。' : '最后一遍会带文本。') : task.textSource ? '最后一遍这条的逐句高亮还在准备中。' : '最后一遍按纯听力完成。'),
    rewardBadge: reward.rewardBadge,
    rewardTitle: reward.rewardTitle,
    rewardCopy: reward.rewardCopy
  });
}

module.exports = {
  CATEGORY_LABELS,
  getCategoryLabel,
  getTaskPresentation,
  getTaskReward,
  decorateTask
};
