const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');
const config = require('../../config');
const { saveTokens, loadTokens, clearTokens } = require('./token-store');

let pendingServer = null;

function isAuthenticated() {
  return !!loadTokens()?.access_token;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    client_id: config.ticktick.clientId,
    client_secret: config.ticktick.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.ticktick.redirectUri,
    scope: config.ticktick.scope,
  });

  const response = await fetch(config.ticktick.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// Runs a one-shot local HTTP server to catch TickTick's OAuth redirect,
// since Electron has no in-app way to intercept the system browser.
function startAuthFlow() {
  return new Promise((resolve, reject) => {
    if (!config.ticktick.clientId || !config.ticktick.clientSecret) {
      reject(new Error('Missing TICKTICK_CLIENT_ID / TICKTICK_CLIENT_SECRET — copy .env.example to .env and fill them in.'));
      return;
    }

    if (pendingServer) {
      pendingServer.close();
      pendingServer = null;
    }

    const state = crypto.randomBytes(16).toString('hex');

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${config.ticktick.redirectPort}`);
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404).end();
        return;
      }

      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>FocusBuddy connected. You can close this tab.</body></html>');

      server.close();
      pendingServer = null;

      if (error) {
        reject(new Error(`TickTick auth error: ${error}`));
        return;
      }
      if (returnedState !== state) {
        reject(new Error('OAuth state mismatch'));
        return;
      }

      exchangeCodeForTokens(code)
        .then((tokens) => {
          saveTokens(tokens);
          resolve(tokens);
        })
        .catch(reject);
    });

    pendingServer = server;

    server.on('error', (err) => {
      pendingServer = null;
      reject(err);
    });

    server.listen(config.ticktick.redirectPort, '127.0.0.1', () => {
      const authorizeUrl = new URL(config.ticktick.authorizeUrl);
      authorizeUrl.searchParams.set('client_id', config.ticktick.clientId);
      authorizeUrl.searchParams.set('scope', config.ticktick.scope);
      authorizeUrl.searchParams.set('redirect_uri', config.ticktick.redirectUri);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('state', state);
      shell.openExternal(authorizeUrl.toString());
    });
  });
}

function logout() {
  clearTokens();
}

module.exports = { startAuthFlow, isAuthenticated, logout };
