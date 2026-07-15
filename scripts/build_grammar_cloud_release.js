#!/usr/bin/env node

const { buildRelease, writeRelease } = require('./grammar_cloud_release_lib');

function main() {
  const release = buildRelease();
  const result = writeRelease(release);
  console.log(JSON.stringify({
    releaseId: release.releaseId,
    targetDir: result.targetDir,
    reused: result.reused,
    topicCount: release.manifest.topicCount,
    lessonCount: release.manifest.lessonCount,
    narrationCount: release.manifest.narrationCount,
    maxTopicBytes: Math.max(...release.files.map((file) => file.bytes)),
    manifestHash: release.manifest.manifestHash
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
