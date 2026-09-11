const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// TickTick's own `parentId` field is undocumented for writes, so this file
// is the source of truth for which task is a subtask of which — a task's
// entry here is only trusted when the parent id still resolves to a task
// that's actually present in the latest fetch (see api.js's parentIdOf).
function linksPath() {
  return path.join(app.getPath('userData'), 'subtask-links.json');
}

function getLinks() {
  try {
    return JSON.parse(fs.readFileSync(linksPath(), 'utf-8'));
  } catch (_) {
    return {};
  }
}

function linkSubtask(childId, parentId) {
  const links = getLinks();
  links[childId] = parentId;
  fs.writeFileSync(linksPath(), JSON.stringify(links));
}

function unlinkSubtask(childId) {
  const links = getLinks();
  delete links[childId];
  fs.writeFileSync(linksPath(), JSON.stringify(links));
}

module.exports = { getLinks, linkSubtask, unlinkSubtask };
