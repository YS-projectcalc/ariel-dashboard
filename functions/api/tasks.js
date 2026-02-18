// Cloudflare Pages Function: /api/tasks
// Syncs task changes (add, move, complete) to status.json via GitHub API
//
// Env vars required (set in Cloudflare Pages dashboard):
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
  const content = JSON.parse(atob(fileData.content.replace(/\n/g, '')));
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
        content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
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

function findTaskInProject(project, taskId) {
  const tasks = project.tasks || {};
  for (const col of ['todo', 'upnext', 'in_progress', 'done']) {
    const arr = tasks[col] || [];
    const idx = arr.findIndex(t => t.id === taskId);
    if (idx !== -1) return { column: col, index: idx, task: arr[idx] };
  }
  return null;
}

function removeTaskFromProject(project, taskId) {
  const tasks = project.tasks || {};
  for (const col of ['todo', 'upnext', 'in_progress', 'done']) {
    if (!tasks[col]) continue;
    tasks[col] = tasks[col].filter(t => t.id !== taskId);
  }
}

// Map column IDs from the UI to status.json array names
function resolveColumn(columnId) {
  if (columnId === '__done__') return 'done';
  if (columnId === '__upnext__') return 'upnext';
  if (columnId === '__todo__') return 'todo';
  // Assignee columns (e.g. "mordy", "yaakov") → keep in upnext but with assignee
  return null; // signals assignee-based column
}

// ─── Handlers ────────────────────────────────────────────────────────

async function handleAdd(body, token, repo) {
  const { task, projectId, column } = body;
  if (!task || !task.title) return jsonResponse({ error: 'Missing task.title' }, 400);

  const { content, sha } = await getStatusJson(token, repo);

  const newTask = {
    id: task.id || ('u-' + Date.now().toString(36)),
    title: task.title.trim(),
    description: task.description?.trim() || undefined,
    priority: task.priority || 'medium',
    tags: [...(task.tags || []), 'user-added'],
    assignee: task.assignee || undefined,
    createdAt: task.createdAt || new Date().toISOString(),
  };

  if (projectId) {
    const project = content.projects?.find(p => p.id === projectId);
    if (!project) return jsonResponse({ error: `Project not found: ${projectId}` }, 404);
    const targetCol = resolveColumn(column) || 'todo';
    if (!project.tasks) project.tasks = { upnext: [], todo: [], in_progress: [], done: [] };
    if (!project.tasks[targetCol]) project.tasks[targetCol] = [];
    project.tasks[targetCol].push(newTask);
  } else {
    if (!content.todos) content.todos = [];
    content.todos.push(newTask);
  }

  content.lastUpdated = new Date().toISOString();
  await commitStatusJson(token, repo, content, sha, `Add task: ${newTask.title}`);
  return jsonResponse({ ok: true, task: newTask }, 201);
}

async function handleMove(body, token, repo) {
  const { taskId, projectId, targetColumn, assignee } = body;
  if (!taskId || !projectId) return jsonResponse({ error: 'Missing taskId or projectId' }, 400);

  const { content, sha } = await getStatusJson(token, repo);
  const project = content.projects?.find(p => p.id === projectId);
  if (!project) return jsonResponse({ error: `Project not found: ${projectId}` }, 404);

  const found = findTaskInProject(project, taskId);
  if (!found) return jsonResponse({ error: `Task not found: ${taskId}` }, 404);

  const task = { ...found.task };

  // Determine target array
  const resolvedCol = resolveColumn(targetColumn);
  const destCol = resolvedCol || 'upnext'; // assignee columns go to upnext

  // Update assignee if moving to/from assignee column
  if (!resolvedCol && targetColumn) {
    // Moving to an assignee column
    task.assignee = targetColumn;
  }

  // Remove from current location
  removeTaskFromProject(project, taskId);

  // Add to destination
  if (!project.tasks[destCol]) project.tasks[destCol] = [];
  project.tasks[destCol].push(task);

  content.lastUpdated = new Date().toISOString();
  await commitStatusJson(token, repo, content, sha,
    `Move task "${task.title}" to ${resolvedCol || targetColumn}`);
  return jsonResponse({ ok: true, taskId, from: found.column, to: destCol });
}

async function handleComplete(body, token, repo) {
  const { taskId, projectId, completed } = body;
  if (!taskId) return jsonResponse({ error: 'Missing taskId' }, 400);

  const { content, sha } = await getStatusJson(token, repo);

  if (projectId) {
    const project = content.projects?.find(p => p.id === projectId);
    if (!project) return jsonResponse({ error: `Project not found: ${projectId}` }, 404);

    const found = findTaskInProject(project, taskId);
    if (!found) return jsonResponse({ error: `Task not found: ${taskId}` }, 404);

    const task = { ...found.task };
    removeTaskFromProject(project, taskId);

    if (completed !== false) {
      // Move to done
      task.completedAt = new Date().toISOString();
      if (!project.tasks.done) project.tasks.done = [];
      project.tasks.done.push(task);
    } else {
      // Un-complete: move back to todo
      delete task.completedAt;
      if (!project.tasks.todo) project.tasks.todo = [];
      project.tasks.todo.push(task);
    }

    content.lastUpdated = new Date().toISOString();
    await commitStatusJson(token, repo, content, sha,
      `${completed !== false ? 'Complete' : 'Reopen'} task: ${task.title}`);
  }

  return jsonResponse({ ok: true, taskId, completed: completed !== false });
}

// ─── Entry points ────────────────────────────────────────────────────

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
    switch (action) {
      case 'add': return await handleAdd(body, token, repo);
      case 'move': return await handleMove(body, token, repo);
      case 'complete': return await handleComplete(body, token, repo);
      default: return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: 'Internal error', detail: err.message }, 500);
  }
}
