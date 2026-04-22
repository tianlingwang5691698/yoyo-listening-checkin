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
  if (category === 'unlock1') {
    return 'Unlock 1';
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
  const nextTask = Object.assign({}, task, {
    categoryLabel,
    displayCategoryLabel: categoryLabel,
    title: decodeHtmlEntities(task.title),
    displayTitle: decodeHtmlEntities(task.displayTitle),
    displaySubtitle: decodeHtmlEntities(task.displaySubtitle),
    audioTitle: decodeHtmlEntities(task.audioTitle),
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
    todayTask: normalizeTask(category.todayTask)
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

module.exports = {
  decodeHtmlEntities,
  getCategoryDisplayLabel,
  normalizeTask,
  normalizeTaskList,
  normalizeCategory,
  normalizeReportItem
};
