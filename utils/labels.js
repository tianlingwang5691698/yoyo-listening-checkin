const { cleanAudioTitle, getTaskAudioDisplayTitle } = require('./audio-title');

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#39;|&apos;|&#x27;/gi, '\'')
    .replace(/&#34;|&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}

function getCategoryDisplayLabel(category, label) {
  if (category === 'song' || label === '歌曲') {
    return 'Songs';
  }
  if (category === 'peppa') {
    return 'Peppa';
  }
  if (category === 'petethecat') {
    return 'Pete the Cat';
  }
  if (category === 'magictreehouse' || category === 'magictreehouseb1') {
    return 'Magic Tree House';
  }
  if (category === 'unlock1') {
    return 'Unlock 1 听口 第二版';
  }
  if (category === 'unlock1thirdedition') {
    return 'Unlock 1 听口 第三版';
  }
  if (category === 'unlock2thirdedition') {
    return 'Unlock 2 听口 第三版';
  }
  if (category === 'unlock1workbook') {
    return 'Unlock 1 听口 练习册 第二版';
  }
  if (category === 'unlock2') {
    return 'Unlock 2 课本';
  }
  if (category === 'unlock2workbook') {
    return 'Unlock 2 练习册';
  }
  if (category === 'unlock3textbook') {
    return 'Unlock3 听口 第二版';
  }
  if (category === 'unlock3thirdedition') {
    return 'Unlock3 听口 第三版';
  }
  if (category === 'unlock3') {
    return 'Unlock3 听口练习册 第二版';
  }
  if (category === 'unlock4') {
    return 'Unlock 4 课本';
  }
  if (category === 'unlock4thirdedition') {
    return 'Unlock 4 听口 第三版';
  }
  if (category === 'unlock4workbook') {
    return 'Unlock 4 练习册';
  }
  if (category === 'newconcept1') {
    return 'New Concept 1';
  }
  if (category === 'newconcept2') {
    return 'New Concept 2';
  }
  if (category === 'newconcept3') {
    return 'New Concept 3';
  }
  if (category === 'newconcept4') {
    return 'New Concept 4';
  }
  return label || category || '';
}

function replaceSongWord(value) {
  return String(value || '').replace(/歌曲/g, 'Songs');
}

function normalizeTask(task) {
  if (!task) {
    return task;
  }
  const categoryLabel = getCategoryDisplayLabel(task.category, task.categoryLabel);
  const displayTitle = getTaskAudioDisplayTitle({
    displayTitle: decodeHtmlEntities(task.displayTitle),
    audioTitle: decodeHtmlEntities(task.audioTitle),
    title: decodeHtmlEntities(task.title),
    audioCloudPath: task.audioCloudPath,
    audioUrl: task.audioUrl
  });
  const nextTask = Object.assign({}, task, {
    categoryLabel,
    displayCategoryLabel: categoryLabel,
    title: decodeHtmlEntities(task.title),
    displayTitle,
    displaySubtitle: decodeHtmlEntities(task.displaySubtitle),
    audioTitle: cleanAudioTitle(decodeHtmlEntities(task.audioTitle)),
    audioCompactTitle: decodeHtmlEntities(task.audioCompactTitle),
    note: decodeHtmlEntities(task.note),
    rewardTitle: decodeHtmlEntities(task.rewardTitle),
    rewardCopy: decodeHtmlEntities(task.rewardCopy)
  });
  if (task.category === 'song') {
    nextTask.coverBadge = task.coverBadge === 'Song' || task.coverBadge === '歌曲' ? 'Songs' : (task.coverBadge || 'Songs');
    nextTask.rewardTitle = replaceSongWord(task.rewardTitle);
    nextTask.rewardCopy = replaceSongWord(task.rewardCopy);
    nextTask.note = replaceSongWord(task.note);
  }
  return nextTask;
}

function normalizeTaskList(tasks) {
  return (tasks || []).map(normalizeTask);
}

function normalizeCategory(category) {
  if (!category) {
    return category;
  }
  const categoryLabel = getCategoryDisplayLabel(category.category, category.categoryLabel);
  return Object.assign({}, category, {
    categoryLabel,
    displayCategoryLabel: categoryLabel,
    todayTask: normalizeTask(category.todayTask),
    tasks: normalizeTaskList(category.tasks || [])
  });
}

function normalizeReportItem(item) {
  if (!item) {
    return item;
  }
  const categoryLabel = getCategoryDisplayLabel(item.category, item.categoryLabel);
  return Object.assign({}, item, {
    categoryLabel,
    displayCategoryLabel: categoryLabel,
    title: decodeHtmlEntities(item.title)
  });
}

function normalizeHomeTaskGroups(groups) {
  return (groups || []).map((group) => Object.assign({}, group, {
    programSubtitle: decodeHtmlEntities(group.programSubtitle),
    textType: decodeHtmlEntities(group.textType),
    nextTask: group.nextTask ? Object.assign({}, group.nextTask, {
      title: decodeHtmlEntities(group.nextTask.title),
      displayTitle: decodeHtmlEntities(group.nextTask.displayTitle),
      textType: decodeHtmlEntities(group.nextTask.textType),
      progressText: decodeHtmlEntities(group.nextTask.progressText)
    }) : group.nextTask,
    tasks: (group.tasks || []).map((task) => Object.assign({}, task, {
      title: decodeHtmlEntities(task.title),
      displayTitle: decodeHtmlEntities(task.displayTitle),
      textType: decodeHtmlEntities(task.textType),
      progressText: decodeHtmlEntities(task.progressText)
    }))
  }));
}

module.exports = {
  decodeHtmlEntities,
  getCategoryDisplayLabel,
  normalizeTask,
  normalizeTaskList,
  normalizeCategory,
  normalizeReportItem,
  normalizeHomeTaskGroups
};
