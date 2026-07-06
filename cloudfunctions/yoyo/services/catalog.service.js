const shared = require('./shared.service');
const storageAdapter = require('../adapters/storage.adapter');

const MATERIAL_PATHS = {
  writingEm1: '_content/writing-em1/writing-prompts.json',
  writingEm2: '_content/writing-em2/writing-prompts.json',
  listeningEm1: '_content/listening-em1/listening-practice.json',
  listeningEm2: '_content/listening-em2/listening-practice.json'
};

function getResourceDebugSnapshot() {
  return shared.getResourceDebugSnapshot();
}

async function loadList(path) {
  try {
    const content = await storageAdapter.downloadCloudJson(path, { skipCache: true });
    return Array.isArray(content) ? content : (content.items || content.prompts || content.sets || []);
  } catch (error) {
    return [];
  }
}

function slimMaterialItem(item) {
  return {
    _id: item && item._id,
    id: item && item.id,
    title: item && item.title,
    year: item && item.year,
    sourceYear: item && item.sourceYear,
    district: item && item.district,
    examType: item && item.examType,
    stage: item && item.stage,
    audioCloudPath: item && item.audioCloudPath,
    hasAudio: !!(item && item.hasAudio),
    hasTranscript: !!(item && item.hasTranscript)
  };
}

async function getMaterialIndex(event) {
  const moduleId = String((event && event.payload && event.payload.moduleId) || '').trim();
  const shouldLoadWriting = !moduleId || moduleId === 'writing';
  const shouldLoadListening = !moduleId || moduleId === 'listening';
  const [writingEm1, writingEm2, listeningEm1, listeningEm2] = await Promise.all([
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingEm1) : [],
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingEm2) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningEm1) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningEm2) : []
  ]);
  return {
    writingEm1,
    writingEm2,
    listeningEm1: listeningEm1.map(slimMaterialItem),
    listeningEm2: listeningEm2.map(slimMaterialItem)
  };
}

async function getMaterialItem(event) {
  const payload = (event && event.payload) || {};
  const moduleId = String(payload.moduleId || '').trim();
  const itemId = String(payload.itemId || '').trim();
  if (!itemId) {
    return { item: null };
  }
  const paths = moduleId === 'listening'
    ? [MATERIAL_PATHS.listeningEm1, MATERIAL_PATHS.listeningEm2]
    : [MATERIAL_PATHS.writingEm1, MATERIAL_PATHS.writingEm2];
  const lists = await Promise.all(paths.map(loadList));
  const item = lists.flat().find((row) => row && String(row._id || row.id || '') === itemId) || null;
  return { item };
}

module.exports = {
  getResourceDebugSnapshot,
  getMaterialIndex,
  getMaterialItem
};
