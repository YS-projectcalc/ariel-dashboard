// Cloudflare Pages Function: /api/ideas
// Syncs potential ideas to status.json via GitHub API
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
      body: JSON.stringify({ text: `💡 Dashboard: ${message}`, mode: 'now' }),
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

  const action = body.action || 'add';

  try {
    const { content, sha } = await getStatusJson(token, repo);
    if (!content.potentialBusinesses) content.potentialBusinesses = [];

    if (action === 'add') {
      const { title, idea, tags } = body;
      if (!title?.trim()) return jsonResponse({ error: 'Missing title' }, 400);

      const newIdea = {
        id: body.id || ('idea-' + Date.now().toString(36)),
        title: title.trim(),
        idea: idea?.trim() || undefined,
        tags: tags || [],
        createdAt: body.createdAt || new Date().toISOString(),
      };
      content.potentialBusinesses.push(newIdea);
      content.lastUpdated = new Date().toISOString();
      await commitStatusJson(token, repo, content, sha, `Add idea: ${newIdea.title}`);
      notifyOpenClaw(env, `New idea: "${newIdea.title}"`);
      return jsonResponse({ ok: true, idea: newIdea }, 201);

    } else if (action === 'delete') {
      const { id } = body;
      if (!id) return jsonResponse({ error: 'Missing id' }, 400);
      content.potentialBusinesses = content.potentialBusinesses.filter(b => b.id !== id);
      content.lastUpdated = new Date().toISOString();
      await commitStatusJson(token, repo, content, sha, `Delete idea: ${id}`);
      return jsonResponse({ ok: true });

    } else if (action === 'edit') {
      const { id, title, idea, tags } = body;
      if (!id) return jsonResponse({ error: 'Missing id' }, 400);
      const existing = content.potentialBusinesses.find(b => b.id === id);
      if (!existing) return jsonResponse({ error: `Idea not found: ${id}` }, 404);
      if (title !== undefined) existing.title = title.trim();
      if (idea !== undefined) existing.idea = idea.trim() || undefined;
      if (tags !== undefined) existing.tags = tags;
      content.lastUpdated = new Date().toISOString();
      await commitStatusJson(token, repo, content, sha, `Edit idea: ${existing.title}`);
      return jsonResponse({ ok: true, idea: existing });

    } else {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: 'Internal error', detail: err.message }, 500);
  }
}
