const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const config = require('../config');

function storePath() {
  return path.join(app.getPath('userData'), 'widget-position.json');
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function defaultSettings() {
  return {
    defaultMinutes: config.pomodoro.defaultMinutes,
    markTaskCompleteByDefault: config.pomodoro.markTaskCompleteByDefault,
    blockSitesByDefault: config.blocking.enabledByDefault,
  };
}

function getSettings() {
  const defaults = defaultSettings();
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    const saved = JSON.parse(raw);
    return { ...defaults, ...saved };
  } catch (_) {
    // no file yet, or corrupt — fall back to config defaults
  }
  return defaults;
}

function setSettings(partial) {
  const merged = { ...getSettings(), ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged));
  return merged;
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

module.exports = { getWidgetPosition, setWidgetPosition, getSettings, setSettings };
