// Cloudflare Pages Function: /api/change-request
// Saves a change request from Yaakov to status.json so Ariel can see it
//
// Env vars required:
//   GITHUB_TOKEN - GitHub personal access token
//   GITHUB_REPO  - e.g. "YS-projectcalc/ariel-dashboard"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

async function getStatusJson(token, repo) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/public/status.json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ariel-dashboard',
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const fileData = await res.json();
  // Decode base64 → bytes → UTF-8 string (atob alone mangles multi-byte UTF-8)
  const binaryStr = atob(fileData.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const jsonStr = new TextDecoder('utf-8').decode(bytes);
  const content = JSON.parse(jsonStr);
  return { content, sha: fileData.sha };
}

async function commitStatusJson(token, repo, content, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/public/status.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ariel-dashboard',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        // Encode UTF-8 string → bytes → base64 (matches the read-side decode)
        content: ((str) => {
          const bytes = new TextEncoder().encode(str);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return btoa(binary);
        })(JSON.stringify(content, null, 2)),
        sha,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub commit failed: ${res.status} - ${errText}`);
  }
  return res.json();
}

async function notifyOpenClaw(env, message) {
  const hookUrl = env.OPENCLAW_HOOK_URL;
  const hookToken = env.OPENCLAW_HOOK_TOKEN;
  if (!hookUrl || !hookToken) return;
  try {
    await fetch(`${hookUrl}/hooks/wake`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hookToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: `💬 Dashboard change request: ${message}`, mode: 'now' }),
    });
  } catch {
    // Non-critical
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { env } = context;
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'YS-projectcalc/ariel-dashboard';

  if (!token) {
    return jsonResponse({ error: 'Server not configured (missing GITHUB_TOKEN)' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Handle cancel action
  if (body.action === 'cancel') {
    const id = body.id;
    if (!id) return jsonResponse({ error: 'Missing id' }, 400);
    try {
      const { content, sha } = await getStatusJson(token, repo);
      if (content.changeRequests) {
        const req = content.changeRequests.find(r => r.id === id);
        if (req) {
          req.status = 'cancelled';
          req.cancelledAt = new Date().toISOString();
          content.lastUpdated = new Date().toISOString();
          await commitStatusJson(token, repo, content, sha, `Cancel change request: ${req.text?.slice(0, 50) || id}`);
        }
      }
      return jsonResponse({ ok: true }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Internal error', detail: err.message }, 500);
    }
  }

  const text = body.text?.trim();
  if (!text) return jsonResponse({ error: 'Missing text' }, 400);

  try {
    const { content, sha } = await getStatusJson(token, repo);

    if (!content.changeRequests) content.changeRequests = [];
    const req = {
      id: body.id || ('cr-' + Date.now().toString(36)),
      text,
      createdAt: body.createdAt || new Date().toISOString(),
      status: 'pending',
    };
    content.changeRequests.push(req);
    content.lastUpdated = new Date().toISOString();

    await commitStatusJson(token, repo, content, sha, `Change request: ${text.slice(0, 60)}`);
    notifyOpenClaw(env, text.slice(0, 120));
    return jsonResponse({ ok: true, id: req.id }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Internal error', detail: err.message }, 500);
  }
}
