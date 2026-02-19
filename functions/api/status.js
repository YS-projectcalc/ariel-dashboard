// Cloudflare Pages Function: /api/status
// Returns the live status.json from GitHub (not the deployed static copy)
// This ensures all browsers see the latest data regardless of deploy cache

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-store',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { env } = context;
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'YS-projectcalc/ariel-dashboard';

  if (!token) {
    // Fallback: serve static file if no token configured
    return context.next();
  }

  try {
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

    return new Response(jsonStr, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Fallback to static file on error
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
