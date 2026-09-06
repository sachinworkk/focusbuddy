const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function storePath() {
  return path.join(app.getPath('userData'), 'session-log.json');
}

function getSessions() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8');
    const sessions = JSON.parse(raw);
    return Array.isArray(sessions) ? sessions : [];
  } catch (_) {
    return [];
  }
}

function appendSession(entry) {
  const sessions = getSessions();
  sessions.push(entry);
  try {
    fs.writeFileSync(storePath(), JSON.stringify(sessions, null, 2));
  } catch (_) {
    // best-effort; not worth surfacing an error for a local history log
  }
  return entry;
}

module.exports = { getSessions, appendSession };
