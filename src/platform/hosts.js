const os = require('os');
const fs = require('fs');
const path = require('path');
const sudoPrompt = require('sudo-prompt');

const MARKER = '# focusbuddy-block';
const SUDO_PROMPT_OPTS = { name: 'FocusBuddy' };

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
  const lines = [];
  for (const domain of domains) {
    lines.push(`127.0.0.1 ${domain} ${MARKER}`);
    lines.push(`127.0.0.1 www.${domain} ${MARKER}`);
  }
  return lines;
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
