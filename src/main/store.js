const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function storePath() {
  return path.join(app.getPath('userData'), 'widget-position.json');
}

function getWidgetPosition() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8');
    const { x, y } = JSON.parse(raw);
    if (typeof x === 'number' && typeof y === 'number') return { x, y };
  } catch (_) {
    // no file yet, or corrupt — fall back to default positioning
  }
  return null;
}

function setWidgetPosition(x, y) {
  try {
    fs.writeFileSync(storePath(), JSON.stringify({ x, y }));
  } catch (_) {
    // best-effort; not worth surfacing an error for a UI-position save
  }
}

module.exports = { getWidgetPosition, setWidgetPosition };
