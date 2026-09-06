const os = require('os');
const fs = require('fs');
const path = require('path');
const sudoPrompt = require('sudo-prompt');

const MARKER = '# focusbuddy-block';
const SUDO_PROMPT_OPTS = { name: 'FocusBuddy' };

// Many sites are single-page apps that shard content across API/CDN
// subdomains once the shell loads, so blocking only the bare domain lets a
// user hit "offline" on first load but keep browsing via those other hosts.
// This maps a configured domain to every host that needs blocking with it.
const KNOWN_ALIASES = {
  'youtube.com': [
    'youtube.com', 'www.youtube.com', 'm.youtube.com',
    'youtu.be', 'www.youtu.be',
    'youtubei.googleapis.com', 'yt3.ggpht.com', 's.ytimg.com', 'i.ytimg.com',
  ],
  'twitter.com': ['twitter.com', 'www.twitter.com', 'api.twitter.com'],
  'x.com': ['x.com', 'www.x.com', 'api.x.com'],
  'reddit.com': ['reddit.com', 'www.reddit.com', 'oauth.reddit.com', 'gateway.reddit.com'],
  'facebook.com': ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'graph.facebook.com'],
  'instagram.com': ['instagram.com', 'www.instagram.com', 'i.instagram.com'],
};

function expandDomains(domains) {
  const expanded = new Set();
  for (const domain of domains) {
    const aliases = KNOWN_ALIASES[domain];
    if (aliases) {
      aliases.forEach((host) => expanded.add(host));
    } else {
      expanded.add(domain);
      expanded.add(`www.${domain}`);
    }
  }
  return [...expanded];
}

function getHostsFilePath() {
  // WINDOWS ONLY: hosts file lives under System32\drivers\etc instead of /etc
  if (process.platform === 'win32') {
    return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function readHosts() {
  return fs.readFileSync(getHostsFilePath(), 'utf-8');
}

function buildBlockedLines(domains) {
  return expandDomains(domains).map((host) => `127.0.0.1 ${host} ${MARKER}`);
}

function withDomainsBlocked(hostsContent, domains) {
  const withoutOurLines = hostsContent
    .split('\n')
    .filter((line) => !line.includes(MARKER))
    .join('\n');
  const trimmed = withoutOurLines.replace(/\n+$/, '');
  return `${trimmed}\n${buildBlockedLines(domains).join('\n')}\n`;
}

function withDomainsUnblocked(hostsContent) {
  return hostsContent
    .split('\n')
    .filter((line) => !line.includes(MARKER))
    .join('\n');
}

// WINDOWS ONLY: UAC elevation via sudo-prompt uses the same API on all
// platforms (it shells out to osascript/pkexec/gksudo on mac/linux, and a
// signed helper + UAC prompt on Windows), so no branch is needed here.
function runElevated(script) {
  return new Promise((resolve, reject) => {
    sudoPrompt.exec(script, SUDO_PROMPT_OPTS, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout, stderr });
    });
  });
}

async function writeHostsElevated(newContent) {
  const hostsPath = getHostsFilePath();
  const tmpPath = path.join(os.tmpdir(), `focusbuddy-hosts-${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, newContent, 'utf-8');

  const copyCmd = process.platform === 'win32'
    ? `copy /Y "${tmpPath}" "${hostsPath}"`
    : `cp "${tmpPath}" "${hostsPath}"`;

  try {
    await runElevated(copyCmd);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

async function blockDomains(domains) {
  if (!domains || !domains.length) return;
  const current = readHosts();
  await writeHostsElevated(withDomainsBlocked(current, domains));
}

async function unblockDomains() {
  const current = readHosts();
  await writeHostsElevated(withDomainsUnblocked(current));
}

function isBlockingActive() {
  try {
    return readHosts().includes(MARKER);
  } catch (_) {
    return false;
  }
}

module.exports = {
  MARKER,
  getHostsFilePath,
  blockDomains,
  unblockDomains,
  isBlockingActive,
};
