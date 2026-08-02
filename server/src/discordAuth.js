import express from 'express';

export const discordAuthRouter = express.Router();

// Exchanges the OAuth2 authorization code the client got from
// discordSdk.commands.authorize() for an access token. This must happen
// server-side because it requires the client secret.
// https://discord.com/developers/docs/activities/building-an-activity
discordAuthRouter.post('/token', express.json(), async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    return res.status(400).json({ error: 'missing_code' });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'server_not_configured' });
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Discord token exchange failed:', response.status, text);
      return res.status(502).json({ error: 'token_exchange_failed' });
    }

    const data = await response.json();
    return res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Discord token exchange error:', err);
    return res.status(502).json({ error: 'token_exchange_failed' });
  }
});
