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

module.exports = { KNOWN_ALIASES, expandDomains };
