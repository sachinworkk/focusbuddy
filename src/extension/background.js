// Must match src/config.js's blocking.serverPort (FOCUSBUDDY_BLOCK_SERVER_PORT)
// and manifest.json's host_permissions entry.
const STATUS_URL = 'http://127.0.0.1:47990/status';
const ALARM_NAME = 'focusbuddy-sync';

function buildRules(domains) {
  return domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: [
        'main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'media', 'font', 'stylesheet',
      ],
    },
  }));
}

async function clearRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (!existing.length) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
  });
}

async function syncRules() {
  let status;
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store' });
    status = await res.json();
  } catch (_) {
    // FocusBuddy app isn't running (or the port changed) — fail open, never block.
    await clearRules();
    return;
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: status.active ? buildRules(status.domains || []) : [],
  });
}

// Chrome enforces a 30-second minimum on repeating alarms, so a block toggled
// in the app can take up to that long to take effect here. onStartup/onInstalled
// cover the common case of the browser or extension (re)starting mid-session.
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) syncRules();
});
chrome.runtime.onStartup.addListener(syncRules);
chrome.runtime.onInstalled.addListener(syncRules);
