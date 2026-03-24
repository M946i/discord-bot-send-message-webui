export const PING_COMMAND = {
  name: 'ping',
  description: 'Return pong.',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // ✅ 1. 注册命令
    // =========================
    if (url.pathname === "/register") {
      const res = await registerGlobalCommands(
        env.APP_ID,
        env.BOT_TOKEN
      );

      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================
    // ✅ 2. Discord 交互入口
    // =========================
    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text(); // ⚠️ 必须用 text

    // ✅ 验证签名（纯 Workers 版）
    const isValidRequest = await verifyDiscordRequest(
      body,
      signature,
      timestamp,
      env.DISCORD_PUBLIC_KEY
    );

    if (!isValidRequest) {
      return new Response('Bad request signature.', { status: 401 });
    }

    const json = JSON.parse(body);

    // =========================
    // ✅ 3. PING 验证（必须）
    // =========================
    if (json.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // =========================
    // ✅ 4. Slash Command
    // =========================
    if (json.type === 2) {
      const name = json.data.name;

      let content = "未知指令";

      if (name === "ping") {
        content = "pong 🏓";
      }

      return new Response(JSON.stringify({
        type: 4,
        data: { content }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Unhandled', { status: 400 });
  },
};

// =========================
// ✅ 注册命令
// =========================
async function registerGlobalCommands(applicationId, token) {
  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
  return await registerCommands(url, token);
}

async function registerCommands(url, token) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify([PING_COMMAND]),
  });

  return response;
}

// =========================
// 🔐 签名验证（无依赖版）
// =========================
async function verifyDiscordRequest(body, signature, timestamp, publicKey) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(timestamp + body);

    const signatureUint8 = hexToUint8Array(signature);
    const publicKeyUint8 = hexToUint8Array(publicKey);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      publicKeyUint8,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      signatureUint8,
      data
    );
  } catch (e) {
    return false;
  }
}

function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
