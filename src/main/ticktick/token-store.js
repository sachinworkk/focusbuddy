const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'ticktick-tokens.enc');
}

function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf-8');
  fs.writeFileSync(tokenFilePath(), payload);
}

function loadTokens() {
  try {
    const payload = fs.readFileSync(tokenFilePath());
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(payload)
      : payload.toString('utf-8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function clearTokens() {
  try {
    fs.unlinkSync(tokenFilePath());
  } catch (_) {
    // already gone
  }
}

module.exports = { saveTokens, loadTokens, clearTokens };
