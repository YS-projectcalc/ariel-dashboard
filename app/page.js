'use client';

import { useState, useEffect, useCallback } from 'react';

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// localStorage helpers for completed tasks
function getCompletedIds() {
  try {
    return JSON.parse(localStorage.getItem('cc_done') || '[]');
  } catch { return []; }
}
function setCompletedIds(ids) {
  localStorage.setItem('cc_done', JSON.stringify(ids));
}

// ─── Overview: Bird's-eye project cards ─────────────────────────────

function ProjectOverviewCard({ project, completedIds, onClick }) {
  const tasks = project.tasks || { todo: [], in_progress: [], done: [] };
  // Merge all tasks, then split by completedIds
  const allTasks = [...tasks.todo, ...(tasks.in_progress || []), ...(tasks.done || [])];
  const upNextCount = allTasks.filter(t => !completedIds.includes(t.id)).length;
  const doneCount = allTasks.filter(t => completedIds.includes(t.id)).length;
  // Also count tasks already in done that might not be in completedIds
  const serverDone = (tasks.done || []).filter(t => !completedIds.includes(t.id));
  const totalDone = doneCount + serverDone.length;
  const totalUpNext = upNextCount - serverDone.length;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        padding: '24px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = project.color;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#334155';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Color accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '3px',
        backgroundColor: project.color,
      }} />

      {/* Project icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px',
          borderRadius: '10px',
          backgroundColor: project.color + '20',
          color: project.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 700,
        }}>
          {project.icon || project.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
            {project.name}
          </div>
          {project.description && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {project.description}
            </div>
          )}
        </div>
      </div>

      {/* Task count chips — just Up Next and Done */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{
          flex: 1, textAlign: 'center',
          padding: '8px 4px', borderRadius: '8px',
          backgroundColor: '#0f172a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#94a3b8' }}>{totalUpNext < 0 ? 0 : totalUpNext}</div>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Up Next</div>
        </div>
        <div style={{
          flex: 1, textAlign: 'center',
          padding: '8px 4px', borderRadius: '8px',
          backgroundColor: '#0f172a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>{totalDone}</div>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Done</div>
        </div>
      </div>
    </div>
  );
}

// ─── Task card with checkbox ────────────────────────────────────────

function TaskCard({ task, accentColor, isDone, onToggle }) {
  const priorityColors = {
    high: { bg: '#451a03', text: '#fb923c', label: 'High' },
    medium: { bg: '#1e1b4b', text: '#a78bfa', label: 'Medium' },
    low: { bg: '#0f172a', text: '#64748b', label: 'Low' },
  };
  const p = priorityColors[task.priority] || null;

  return (
    <div style={{
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      padding: '14px',
      borderLeft: `3px solid ${isDone ? '#4ade80' : accentColor}`,
      marginBottom: '8px',
      opacity: isDone ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          style={{
            width: '20px', height: '20px', minWidth: '20px',
            borderRadius: '4px',
            border: isDone ? '2px solid #4ade80' : '2px solid #475569',
            backgroundColor: isDone ? '#4ade8020' : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '1px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = '#94a3b8'; }}
          onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = '#475569'; }}
        >
          {isDone && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 600, fontSize: '13px',
            color: isDone ? '#64748b' : '#f8fafc',
            marginBottom: '4px', lineHeight: 1.4,
            textDecoration: isDone ? 'line-through' : 'none',
          }}>
            {task.title}
          </div>
          {task.description && !isDone && (
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '8px' }}>
              {task.description}
            </div>
          )}
          {!isDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {p && (
                <span style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: p.bg, color: p.text,
                }}>
                  {p.label}
                </span>
              )}
              {task.tags && task.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px',
                  backgroundColor: '#1e293b', color: '#94a3b8',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task column ────────────────────────────────────────────────────

function TaskColumn({ title, tasks, accentColor, emptyText, dotColor, completedIds, onToggle }) {
  return (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px', padding: '0 4px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: dotColor,
        }} />
        <span style={{
          fontSize: '12px', fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '11px', color: '#475569',
          backgroundColor: '#0f172a',
          padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
        }}>
          {tasks.length}
        </span>
      </div>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '10px',
        padding: '10px',
        minHeight: '120px',
        border: '1px solid #334155',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}>
        {tasks.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            fontSize: '12px', color: '#475569', fontStyle: 'italic',
          }}>
            {emptyText}
          </div>
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id || i}
              task={task}
              accentColor={accentColor}
              isDone={completedIds.includes(task.id)}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Project detail view (two columns: Up Next + Done) ──────────────

function ProjectDetailView({ project, onBack, completedIds, onToggle }) {
  const tasks = project.tasks || { todo: [], in_progress: [], done: [] };

  // Merge all tasks from all columns
  const allTasks = [...tasks.todo, ...(tasks.in_progress || []), ...(tasks.done || [])];

  // Split into up next vs done based on completedIds + original done status
  const upNext = allTasks.filter(t => !completedIds.includes(t.id) && !(tasks.done || []).some(d => d.id === t.id));
  const done = allTasks.filter(t => completedIds.includes(t.id) || (tasks.done || []).some(d => d.id === t.id));

  // Sort up next: high priority first
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  upNext.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  return (
    <div>
      {/* Back button + project header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        marginBottom: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#94a3b8',
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#64748b'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
        >
          <span style={{ fontSize: '16px' }}>&larr;</span> All Projects
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: project.color + '20',
            color: project.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 700,
          }}>
            {project.icon || project.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '20px', color: '#f8fafc' }}>
              {project.name}
            </div>
            {project.description && (
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {project.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two columns: Up Next + Done */}
      <div style={{
        display: 'flex', gap: '16px',
        overflowX: 'auto', paddingBottom: '8px',
      }}>
        <TaskColumn
          title="Up Next"
          tasks={upNext}
          accentColor="#94a3b8"
          dotColor="#94a3b8"
          emptyText="All done!"
          completedIds={completedIds}
          onToggle={onToggle}
        />
        <TaskColumn
          title="Done"
          tasks={done}
          accentColor="#4ade80"
          dotColor="#4ade80"
          emptyText="Nothing completed yet"
          completedIds={completedIds}
          onToggle={onToggle}
        />
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [error, setError] = useState(null);
  const [completedIds, setCompletedIds] = useState([]);

  // Load completed IDs from localStorage
  useEffect(() => {
    setCompletedIds(getCompletedIds());
  }, []);

  // Toggle a task's done state
  const toggleTask = useCallback((taskId) => {
    setCompletedIds(prev => {
      const next = prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId];
      localStorage.setItem('cc_done', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/status.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', color: '#f87171', padding: '40px', textAlign: 'center' }}>
          Failed to load: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', color: '#64748b', padding: '40px', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  const projects = data.projects || [];
  const selected = selectedProject ? projects.find(p => p.id === selectedProject) : null;

  // Total counts using completedIds logic
  const totalUpNext = projects.reduce((sum, p) => {
    const tasks = p.tasks || { todo: [], in_progress: [], done: [] };
    const all = [...tasks.todo, ...(tasks.in_progress || [])];
    return sum + all.filter(t => !completedIds.includes(t.id)).length;
  }, 0);
  const totalDone = projects.reduce((sum, p) => {
    const tasks = p.tasks || { todo: [], in_progress: [], done: [] };
    const all = [...tasks.todo, ...(tasks.in_progress || []), ...(tasks.done || [])];
    return sum + all.filter(t => completedIds.includes(t.id) || (tasks.done || []).some(d => d.id === t.id)).length;
  }, 0);
  const totalTasks = totalUpNext + totalDone;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '32px', paddingBottom: '16px',
          borderBottom: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 800, color: '#fff',
            }}>
              CC
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc' }}>
                Command Center
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {projects.length} projects &middot; {totalTasks} tasks
              </div>
            </div>
          </div>
          {data.lastUpdated && (
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Updated {timeAgo(data.lastUpdated)}
            </div>
          )}
        </header>

        {/* View toggle: Overview vs Detail */}
        {selected ? (
          <ProjectDetailView
            project={selected}
            onBack={() => setSelectedProject(null)}
            completedIds={completedIds}
            onToggle={toggleTask}
          />
        ) : (
          <>
            {/* Summary row — just Up Next and Done */}
            {totalTasks > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Up Next', count: totalUpNext, color: '#94a3b8' },
                  { label: 'Done', count: totalDone, color: '#4ade80' },
                ].map(item => (
                  <div key={item.label} style={{
                    flex: 1,
                    backgroundColor: '#1e293b',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    padding: '16px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: item.color }}>
                      {item.count}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Project grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}>
              {projects.map(project => (
                <ProjectOverviewCard
                  key={project.id}
                  project={project}
                  completedIds={completedIds}
                  onClick={() => setSelectedProject(project.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
