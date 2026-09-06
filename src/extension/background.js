// Must match src/config.js's blocking.serverPort (FOCUSBUDDY_BLOCK_SERVER_PORT)
// and manifest.json's host_permissions entry.
const STATUS_URL = 'http://127.0.0.1:47990/status';
const ALARM_NAME = 'focusbuddy-sync';

const BLOCKED_PAGE = chrome.runtime.getURL('blocked.html');

// Was the session active as of the last successful sync, and which domains
// were blocked — used to detect the on->off / off->on transitions below.
let wasActive = false;
let lastDomains = [];
// Original URL a tab was on right before dNR redirected it to blocked.html,
// keyed by tabId, so we can send the tab back there once unblocked.
const originalUrlByTab = new Map();

function hostMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function tabMatchesDomains(url, domains) {
  try {
    const hostname = new URL(url).hostname;
    return domains.some((domain) => hostMatchesDomain(hostname, domain));
  } catch (_) {
    return false;
  }
}

// dNR redirects happen before we see them here, so this only fires for the
// *original* navigation to a blocked site — exactly what we want to remember.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  if (tabMatchesDomains(details.url, lastDomains)) {
    originalUrlByTab.set(details.tabId, details.url);
  }
});

async function reloadBlockedDomainTabs(domains) {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (tab.id != null && tab.url && tabMatchesDomains(tab.url, domains)) {
      chrome.tabs.reload(tab.id);
    }
  });
}

async function sendBackFromBlockedPage() {
  const tabs = await chrome.tabs.query({ url: `${BLOCKED_PAGE}*` });
  tabs.forEach((tab) => {
    const originalUrl = originalUrlByTab.get(tab.id);
    if (originalUrl) {
      chrome.tabs.update(tab.id, { url: originalUrl });
    }
    originalUrlByTab.delete(tab.id);
  });
}

function buildRules(domains) {
  const rules = [];
  domains.forEach((domain, index) => {
    // Top-level navigations get redirected to a friendly "still blocked" page...
    rules.push({
      id: index * 2 + 1,
      priority: 1,
      action: { type: 'redirect', redirect: { url: BLOCKED_PAGE } },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ['main_frame'],
      },
    });
    // ...everything else (XHR, images, embedded frames, etc.) is just blocked outright.
    rules.push({
      id: index * 2 + 2,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ['sub_frame', 'xmlhttprequest', 'script', 'image', 'media', 'font', 'stylesheet'],
      },
    });
  });
  return rules;
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
    wasActive = false;
    lastDomains = [];
    return;
  }

  const domains = status.domains || [];
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: status.active ? buildRules(domains) : [],
  });

  if (status.active && !wasActive) {
    // Rules are live now, so reloading tabs already sitting on a blocked
    // site sends them straight to blocked.html instead of waiting for the
    // user's next navigation.
    lastDomains = domains;
    await reloadBlockedDomainTabs(domains);
  } else if (!status.active && wasActive) {
    await sendBackFromBlockedPage();
    lastDomains = [];
  } else {
    lastDomains = domains;
  }
  wasActive = status.active;
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
