require('dotenv').config();

const REDIRECT_PORT = Number(process.env.TICKTICK_REDIRECT_PORT || 53682);

module.exports = {
  ticktick: {
    clientId: process.env.TICKTICK_CLIENT_ID || '',
    clientSecret: process.env.TICKTICK_CLIENT_SECRET || '',
    redirectUri: `http://127.0.0.1:${REDIRECT_PORT}/oauth/callback`,
    redirectPort: REDIRECT_PORT,
    authorizeUrl: 'https://ticktick.com/oauth/authorize',
    tokenUrl: 'https://ticktick.com/oauth/token',
    apiBase: 'https://api.ticktick.com/open/v1',
    scope: 'tasks:read tasks:write',
  },
  pomodoro: {
    defaultMinutes: Number(process.env.POMODORO_DEFAULT_MINUTES || 25),
  },
};
