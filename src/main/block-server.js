const http = require('http');

// Talks to the FocusBuddy Chrome extension (src/extension/), which polls
// GET /status and toggles its declarativeNetRequest rules to match. Only
// binds to loopback, and only ever answers reads — the extension has no way
// to change blocking state itself, this app is the sole source of truth.
let server = null;
let active = false;

function isActive() {
  return active;
}

function setActive(value) {
  active = !!value;
}

function start(port, getDomains) {
  if (server) return;

  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET' && req.url === '/status') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ active, domains: active ? getDomains() : [] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, '127.0.0.1');
}

function stop() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { start, stop, isActive, setActive };
