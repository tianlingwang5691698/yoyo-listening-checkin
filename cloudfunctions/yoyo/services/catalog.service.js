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
    const content = await storageAdapter.downloadCloudJson(path);
    return Array.isArray(content) ? content : (content.items || content.prompts || content.sets || []);
  } catch (error) {
    return [];
  }
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
    listeningEm1,
    listeningEm2
  };
}

module.exports = {
  getResourceDebugSnapshot,
  getMaterialIndex
};
