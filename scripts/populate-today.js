#!/usr/bin/env node
// Populate today's tasks in status.json based on project priority weights.
// Run daily at 8 AM Israel time (Sun-Thu only).
// Weights: Epiphany Made (bulk) > Juniform > Spotlight > BigBang/Iluy/Raffle Builder (smallest)

const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', 'public', 'status.json');

const WEIGHTS = {
  'epiphany-made': 40,
  'juniform': 25,
  'spotlight-ai': 20,
  'bigbang': 5,
  'iluy': 5,
  'raffle-builder': 5,
};

function run() {
  // Skip Friday (5) and Saturday (6) in Israel time
  const israelTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const dow = israelTime.getDay();
  if (dow === 5 || dow === 6) {
    console.log(`Skipping — today is ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]} in Israel`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  const projects = (data.projects || []).filter(p => p.status === 'active');

  const todayStr = `${israelTime.getFullYear()}-${String(israelTime.getMonth()+1).padStart(2,'0')}-${String(israelTime.getDate()).padStart(2,'0')}`;

  // Don't overwrite if already populated for today
  if (data.todayTasks && data.todayTasks.date === todayStr && data.todayTasks.tasks.length > 0) {
    console.log(`Today's tasks already set for ${todayStr}`);
    return;
  }

  const planned = [];

  projects.forEach(p => {
    const weight = WEIGHTS[p.id] || 5;
    const t = p.tasks || {};
    // Priority: upnext first, then in_progress, then todo
    const available = [...(t.upnext || []), ...(t.in_progress || []), ...(t.todo || [])]
      .filter(task => !((t.done || []).some(d => d.id === task.id)));

    // Scale: weight/10 tasks, min 1 if available
    const count = Math.max(1, Math.min(available.length, Math.round(weight / 10)));
    available.slice(0, count).forEach(task => {
      planned.push({
        taskId: task.id,
        projectId: p.id,
        title: task.title,
        priority: task.priority || 'medium',
      });
    });
  });

  data.todayTasks = {
    date: todayStr,
    tasks: planned,
    populatedAt: new Date().toISOString(),
  };
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(STATUS_PATH, JSON.stringify(data, null, 2));
  console.log(`Populated ${planned.length} tasks for ${todayStr}:`);
  planned.forEach(t => console.log(`  - [${t.projectId}] ${t.title}`));
}

run();
