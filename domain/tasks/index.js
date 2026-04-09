const {
  peppaTasks,
  unlockTasks,
  songTasks,
  songPlaceholder
} = require('../../data/catalog');

const CATEGORY_ORDER = ['peppa', 'unlock1', 'song'];
const CATEGORY_LABELS = {
  peppa: 'Peppa',
  unlock1: 'Unlock 1',
  song: '歌曲'
};

function getCatalog(category) {
  if (category === 'peppa') {
    return peppaTasks;
  }
  if (category === 'unlock1') {
    return unlockTasks;
  }
  if (category === 'song') {
    return songTasks;
  }
  return [];
}

function getActiveCategories() {
  return CATEGORY_ORDER.filter((category) => getCatalog(category).length > 0);
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function getMediaDisplayName(filePath) {
  if (!filePath) {
    return '';
  }
  const normalizedPath = String(filePath).split('?')[0];
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || '';
  const decodedName = decodeURIComponent(fileName);
  const dotIndex = decodedName.lastIndexOf('.');
  return (dotIndex > 0 ? decodedName.slice(0, dotIndex) : decodedName).trim();
}

function getTaskDisplayTitle(task, audioDisplayName) {
  if (!task) {
    return '';
  }
  const rawTitle = String(task.title || '').trim();
  if (!rawTitle || rawTitle === '未知歌曲' || rawTitle === '每日歌曲') {
    return audioDisplayName || rawTitle || '';
  }
  return rawTitle;
}

function getTaskPresentation(task, audioDisplayName) {
  const fallbackTitle = getTaskDisplayTitle(task, audioDisplayName);
  const rawTitle = String((task && task.title) || '').trim();

  if (!task) {
    return {
      displayTitle: '',
      displaySubtitle: '',
      episodeCode: '',
      coverVariant: 'song',
      coverBadge: '',
      coverIndex: '',
      coverMeta: ''
    };
  }

  if (task.category === 'peppa') {
    const sourceTitle = rawTitle || audioDisplayName;
    const match = sourceTitle.match(/^S(\d)(\d{2})\s+(.+)$/i);
    if (match) {
      const season = Number(match[1]);
      const episode = Number(match[2]);
      const episodeCode = `${season}-${episode}`;
      return {
        displayTitle: match[3].trim(),
        displaySubtitle: episodeCode,
        episodeCode,
        coverVariant: 'peppa',
        coverBadge: 'Peppa',
        coverIndex: '',
        coverMeta: `Season ${season} Episode ${episode}`
      };
    }
    return {
      displayTitle: fallbackTitle || 'Peppa',
      displaySubtitle: String(task.subtitle || '').trim(),
      episodeCode: '',
      coverVariant: 'peppa',
      coverBadge: 'Peppa',
      coverIndex: '',
      coverMeta: ''
    };
  }

  if (task.category === 'unlock1') {
    const sourceTitle = rawTitle || audioDisplayName;
    const match = sourceTitle.match(/Unlock2e_A1_(\d+\.\d+)/i);
    const unitCode = match ? match[1] : sourceTitle.replace(/^Unlock\s*/i, '').trim();
    return {
      displayTitle: unitCode || 'A1',
      displaySubtitle: 'A1 Listen & Speak',
      episodeCode: '',
      coverVariant: 'unlock',
      coverBadge: 'Unlock-1',
      coverIndex: '',
      coverMeta: ''
    };
  }

  if (task.category === 'song') {
    const sourceTitle = rawTitle || audioDisplayName;
    const normalized = sourceTitle
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/^[0-9]+\./, '')
      .replace(/\s*-\s*Super Simple Songs$/i, '')
      .trim();
    const numbered = sourceTitle.match(/^0*([0-9]+)\.(.+)$/);
    return {
      displayTitle: numbered ? `Song ${Number(numbered[1])}` : 'Daily Song',
      displaySubtitle: normalized || '等待歌曲音频',
      episodeCode: '',
      coverVariant: 'song',
      coverBadge: 'Song',
      coverIndex: '',
      coverMeta: ''
    };
  }

  return {
    displayTitle: fallbackTitle || getCategoryLabel(task.category),
    displaySubtitle: String(task.subtitle || '').trim() || (audioDisplayName ? 'Audio ready' : '等待音频接入'),
    episodeCode: '',
    coverVariant: 'song',
    coverBadge: 'Song',
    coverIndex: '',
    coverMeta: ''
  };
}

function getTaskReward(category, progress, task) {
  const completed = progress && progress.completedToday;
  const playCount = progress ? progress.playCount : 0;
  const nextStep = Math.min(playCount + 1, (task && task.repeatTarget) || 3);

  if (category === 'peppa') {
    return completed
      ? {
        rewardBadge: 'MUDDY BOOTS',
        rewardTitle: '泥坑探险章拿到了',
        rewardCopy: '这一集今天已经顺利通关，明天会自动切到下一集冒险。'
      }
      : {
        rewardBadge: `PEPPA ${nextStep}`,
        rewardTitle: '泥坑探险线',
        rewardCopy: nextStep < 3 ? `先完成第 ${nextStep} 遍听力，就能继续推进这一集剧情。`
          : '第 3 遍会把这一关完整听完，也能顺着文本再过一遍。'
      };
  }

  if (category === 'unlock1') {
    return completed
      ? {
        rewardBadge: 'UNLOCKED',
        rewardTitle: '学习徽章已点亮',
        rewardCopy: '这一条已经听满 3 遍，今天的学习徽章顺利收入袋里。'
      }
      : {
        rewardBadge: `UNLOCK ${nextStep}`,
        rewardTitle: '学习任务线',
        rewardCopy: nextStep < 3 ? `再完成第 ${nextStep} 遍，就离今天的学习徽章更近一步。`
          : (task && task.transcriptTrackId ? '第 3 遍会顺着文本一起听，像把这一关认真收尾。' : '第 3 遍先按纯听力完成，文本高亮正在分批接入。')
      };
  }

  return completed
    ? {
      rewardBadge: 'SING STAR',
      rewardTitle: '歌曲小星星到手了',
      rewardCopy: '今天这首歌已经听满 3 遍，奖励星已经亮起来了。'
    }
    : {
      rewardBadge: `SONG ${nextStep}`,
      rewardTitle: '歌曲星星线',
      rewardCopy: nextStep < 3 ? `再听第 ${nextStep} 遍，这颗小星星就会更亮一点。`
        : '第 3 遍会顺着文本一起听，把今天的音乐奖励点亮。'
    };
}

function createPendingTask(category) {
  if (category === 'song') {
    const presentation = getTaskPresentation(songPlaceholder, '');
    const reward = getTaskReward(category, { playCount: 0, completedToday: false }, songPlaceholder);
    return Object.assign({}, songPlaceholder, presentation, {
      categoryLabel: getCategoryLabel(category),
      audioDisplayName: '',
      audioCompactTitle: '',
      isPendingAsset: true,
      note: '云端歌曲目录扫描到音频后，这里就会开始轮换。',
      currentPass: 1,
      playStepText: '0/3',
      textUnlocked: false,
      completedToday: false,
      durationMinutes: 0,
      rewardBadge: reward.rewardBadge,
      rewardTitle: reward.rewardTitle,
      rewardCopy: '把歌曲音频放进来后，这条奖励线就会亮起来。'
    });
  }

  const presentation = getTaskPresentation({
    category,
    title: `${getCategoryLabel(category)} 暂无音频`,
    subtitle: '等待素材'
  }, '');
  const reward = getTaskReward(category, { playCount: 0, completedToday: false }, { repeatTarget: 3 });
  return {
    taskId: `${category}-pending`,
    category,
    categoryLabel: getCategoryLabel(category),
    title: presentation.displayTitle,
    subtitle: presentation.displaySubtitle,
    displayTitle: presentation.displayTitle,
    displaySubtitle: presentation.displaySubtitle,
    episodeCode: presentation.episodeCode,
    coverVariant: presentation.coverVariant,
    coverBadge: presentation.coverBadge,
    coverIndex: presentation.coverIndex,
    coverMeta: presentation.coverMeta,
    audioUrl: '',
    audioDisplayName: '',
    audioCompactTitle: '',
    repeatTarget: 3,
    currentPass: 1,
    playStepText: '0/3',
    textUnlocked: false,
    completedToday: false,
    isPendingAsset: true,
    note: '这个分类还没有可用音频。',
    durationMinutes: 0,
    coverTone: category === 'song' ? 'mint' : 'peach',
    rewardBadge: reward.rewardBadge,
    rewardTitle: reward.rewardTitle,
    rewardCopy: '素材放进来后，这条任务线就会开始推进。'
  };
}

function decorateTask(task, progress, category) {
  if (!task) {
    return createPendingTask(category);
  }

  const audioDisplayName = getMediaDisplayName(task.audioUrl);
  const presentation = getTaskPresentation(task, audioDisplayName);
  const reward = getTaskReward(category, progress, task);
  const completedCount = Math.min(progress.playCount, task.repeatTarget);
  const currentPass = progress.completedToday ? task.repeatTarget : Math.min(progress.playCount + 1, task.repeatTarget);
  const textUnlocked = !!task.transcriptTrackId;
  const compactAudioTitle = task.category === 'peppa'
    ? [presentation.displaySubtitle, presentation.displayTitle].filter(Boolean).join(' · ')
    : task.category === 'unlock1'
      ? [presentation.coverBadge, presentation.displayTitle].filter(Boolean).join(' · ')
      : [presentation.displayTitle, presentation.displaySubtitle].filter(Boolean).join(' · ') || audioDisplayName;

  return Object.assign({}, task, {
    category,
    categoryLabel: getCategoryLabel(category),
    originalTitle: String(task.title || '').trim(),
    title: presentation.displayTitle,
    subtitle: presentation.displaySubtitle,
    displayTitle: presentation.displayTitle,
    displaySubtitle: presentation.displaySubtitle,
    episodeCode: presentation.episodeCode,
    coverVariant: presentation.coverVariant,
    coverBadge: presentation.coverBadge,
    coverIndex: presentation.coverIndex,
    coverMeta: presentation.coverMeta,
    audioDisplayName,
    audioCompactTitle: compactAudioTitle || audioDisplayName,
    transcriptStatus: task.transcriptStatus || (task.transcriptTrackId ? 'ready' : task.textSource ? 'pending' : 'none'),
    transcriptBatch: task.transcriptBatch || null,
    textUnlocked,
    completedToday: progress.completedToday,
    playCount: progress.playCount,
    currentPass,
    playStepText: `${completedCount}/${task.repeatTarget}`,
    repeatTarget: task.repeatTarget,
    note: progress.completedToday
      ? `今天的 ${getCategoryLabel(category)} 已经完成 3 遍。`
      : currentPass < task.repeatTarget
        ? (task.transcriptTrackId ? `现在是第 ${currentPass} 遍，可以一边听一边看文本。` : `现在是第 ${currentPass} 遍，先按纯听力完成。`)
        : (task.transcriptTrackId ? '现在进入第 3 遍，可以继续一边听一边看文本。' : task.textSource ? '现在进入第 3 遍，这条的逐句高亮还在准备中。' : '现在进入第 3 遍，这条没有可用文本。'),
    durationMinutes: Math.max(1, Math.round((task.durationSec * task.repeatTarget) / 60)),
    rewardBadge: reward.rewardBadge,
    rewardTitle: reward.rewardTitle,
    rewardCopy: reward.rewardCopy
  });
}

function formatHistoryTaskTitle(taskRef) {
  const taskAudioDisplayName = getMediaDisplayName((taskRef || {}).audioUrl);
  const presentation = getTaskPresentation(taskRef || {}, taskAudioDisplayName);
  if ((taskRef || {}).category === 'peppa') {
    return [presentation.displaySubtitle, presentation.displayTitle].filter(Boolean).join(' · ');
  }
  if ((taskRef || {}).category === 'unlock1') {
    return [presentation.coverBadge, presentation.displayTitle].filter(Boolean).join(' · ');
  }
  return [presentation.displayTitle, presentation.displaySubtitle].filter(Boolean).join(' · ');
}

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getCatalog,
  getActiveCategories,
  getCategoryLabel,
  getMediaDisplayName,
  getTaskById(category, taskId) {
    return getCatalog(category).find((item) => item.taskId === taskId) || null;
  },
  getTaskPresentation,
  getTaskReward,
  createPendingTask,
  decorateTask,
  formatHistoryTaskTitle
};
