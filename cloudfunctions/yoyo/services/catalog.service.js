const shared = require('./shared.service');
const storageAdapter = require('../adapters/storage.adapter');

const MATERIAL_PATHS = {
  writingEm1: '_content/writing-em1/writing-prompts.json',
  writingEm2: '_content/writing-em2/writing-prompts.json',
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

async function getMaterialIndex() {
  const [writingEm1, writingEm2, listeningEm2] = await Promise.all([
    loadList(MATERIAL_PATHS.writingEm1),
    loadList(MATERIAL_PATHS.writingEm2),
    loadList(MATERIAL_PATHS.listeningEm2)
  ]);
  return {
    writingEm1,
    writingEm2,
    listeningEm2
  };
}

module.exports = {
  getResourceDebugSnapshot,
  getMaterialIndex
};
