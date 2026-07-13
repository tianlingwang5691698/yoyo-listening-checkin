function decodePathName(value) {
  const raw = String(value || '').trim().split('?')[0];
  const fileName = raw.split('/').filter(Boolean).pop() || raw;
  try {
    return decodeURIComponent(fileName);
  } catch (error) {
    return fileName;
  }
}

function cleanAudioTitle(value) {
  const title = decodePathName(value)
    .replace(/\.(?:mp3|m4a|aac|wav|ogg|flac|wma)$/i, '')
    .replace(/^[a-f0-9]{8,64}[_-]+(?=[a-z0-9])/i, '')
    .trim();
  const thirdEdition = title.match(/_U0*(\d+).*_t0*(\d+)$/i);
  if (thirdEdition) {
    return `${Number(thirdEdition[1])}.${Number(thirdEdition[2])}`;
  }
  const unitTrack = title.match(/(?:Unlock2e_|UL2v2_)?(?:A1|L1|L2|L3|L4|B2)[_-]*(?:TST_LS_)?(?:U)?(\d+\.\d+)/i);
  return unitTrack ? unitTrack[1] : title;
}

function getTaskAudioDisplayTitle(task, fallback) {
  const target = task || {};
  const candidates = [
    target.displayTitle,
    target.audioTitle,
    target.title,
    target.audioCloudPath,
    target.audioUrl,
    fallback
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    const title = cleanAudioTitle(candidates[index]);
    if (title) return title;
  }
  return '';
}

module.exports = {
  cleanAudioTitle,
  getTaskAudioDisplayTitle
};
