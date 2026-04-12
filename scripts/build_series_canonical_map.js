#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    tracksExport: 'transcriptTracks',
    statusExport: 'transcriptBuildStatus',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--module') {
      args.modulePath = next;
      index += 1;
    } else if (token === '--tracks-export') {
      args.tracksExport = next;
      index += 1;
    } else if (token === '--status-export') {
      args.statusExport = next;
      index += 1;
    } else if (token === '--output') {
      args.outputPath = next;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/build_series_canonical_map.js --module <path> --output <path> [options]

Build a canonical transcript map from an external JS transcript module.

Options:
  --module <path>          JS module that exports tracks and build-status arrays
  --tracks-export <name>   Export name for the tracks array (default: transcriptTracks)
  --status-export <name>   Export name for the build-status array (default: transcriptBuildStatus)
  --output <path>          Output JSON path for the canonical map
  -h, --help               Show this help message`);
}

function ensureArgs(args) {
  if (!args.modulePath) {
    throw new Error('Missing --module');
  }
  if (!args.outputPath) {
    throw new Error('Missing --output');
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  ensureArgs(args);

  const modulePath = path.resolve(args.modulePath);
  const outputPath = path.resolve(args.outputPath);
  const mod = require(modulePath);
  const tracks = mod[args.tracksExport];
  const statuses = mod[args.statusExport];

  if (!Array.isArray(tracks)) {
    throw new Error(`Export ${args.tracksExport} is not an array`);
  }
  if (!Array.isArray(statuses)) {
    throw new Error(`Export ${args.statusExport} is not an array`);
  }

  const statusByTrackId = new Map(statuses.map((item) => [item.trackId, item]));
  const tracksByFileName = {};

  for (const track of tracks) {
    const status = statusByTrackId.get(track.trackId);
    if (!status) {
      continue;
    }
    tracksByFileName[status.fileName] = {
      trackId: track.trackId,
      contentId: track.contentId,
      taskId: status.taskId,
      fileName: status.fileName,
      batch: status.batch,
      status: status.status,
      canonicalSegments: (track.lines || []).map((line) => line.text),
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceModule: modulePath,
    tracksExport: args.tracksExport,
    statusExport: args.statusExport,
    tracksByFileName,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${Object.keys(tracksByFileName).length} canonical entries -> ${outputPath}`);
}

main();
