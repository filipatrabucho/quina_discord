import { DiscordSDK } from '@discord/embedded-app-sdk';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

// Discord injects `frame_id` as a query param when the page runs inside the
// Activity iframe. Outside Discord (plain browser, local dev) we skip the
// whole SDK handshake and fall back to a locally-entered name + room code.
export function isRunningInsideDiscord() {
  return new URLSearchParams(window.location.search).has('frame_id');
}

let discordSdkInstance = null;

export function getDiscordSdk() {
  if (!discordSdkInstance) {
    discordSdkInstance = new DiscordSDK(CLIENT_ID);
  }
  return discordSdkInstance;
}

/**
 * Runs the full Discord Activity handshake: waits for the SDK to be ready,
 * asks the user to authorize the app, exchanges the resulting code for an
 * access token via our backend (needs the client secret, so it can't happen
 * in the browser), then authenticates the SDK session.
 *
 * Returns { instanceId, user } so the caller can join a game room named
 * after the current voice-channel activity instance.
 */
export async function setupDiscordSdk() {
  const sdk = getDiscordSdk();
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds'],
  });

  const tokenResponse = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Falha ao autenticar com o Discord.');
  }

  const { access_token: accessToken } = await tokenResponse.json();
  const auth = await sdk.commands.authenticate({ access_token: accessToken });

  return {
    instanceId: sdk.instanceId,
    user: {
      id: auth.user.id,
      username: auth.user.global_name || auth.user.username,
      avatar: auth.user.avatar
        ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png`
        : null,
    },
  };
}
