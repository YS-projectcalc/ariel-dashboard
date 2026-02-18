'use client';

import { useState, useEffect } from 'react';

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

// ─── Overview: Bird's-eye project cards ─────────────────────────────

function ProjectOverviewCard({ project, onClick }) {
  const tasks = project.tasks || { todo: [], in_progress: [], done: [] };
  const todoCount = tasks.todo.length;
  const inProgressCount = tasks.in_progress.length;
  const doneCount = tasks.done.length;
  const totalCount = todoCount + inProgressCount + doneCount;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        backgroundColor: project.color,
      }} />

      {/* Project icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: project.color + '20',
          color: project.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 700,
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

      {/* Task count chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          flex: 1,
          textAlign: 'center',
          padding: '8px 4px',
          borderRadius: '8px',
          backgroundColor: '#0f172a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#94a3b8' }}>{todoCount}</div>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>To Do</div>
        </div>
        <div style={{
          flex: 1,
          textAlign: 'center',
          padding: '8px 4px',
          borderRadius: '8px',
          backgroundColor: '#0f172a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#60a5fa' }}>{inProgressCount}</div>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>In Progress</div>
        </div>
        <div style={{
          flex: 1,
          textAlign: 'center',
          padding: '8px 4px',
          borderRadius: '8px',
          backgroundColor: '#0f172a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>{doneCount}</div>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Done</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        borderRadius: '2px',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: project.color,
          borderRadius: '2px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      {totalCount > 0 && (
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'right' }}>
          {progress}% complete
        </div>
      )}
      {totalCount === 0 && (
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
          No tasks yet
        </div>
      )}
    </div>
  );
}

// ─── Kanban: Task card ──────────────────────────────────────────────

function TaskCard({ task, accentColor }) {
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
      borderLeft: `3px solid ${accentColor}`,
      marginBottom: '8px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', marginBottom: '4px', lineHeight: 1.4 }}>
        {task.title}
      </div>
      {task.description && (
        <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '8px' }}>
          {task.description}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {p && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 600,
            backgroundColor: p.bg,
            color: p.text,
          }}>
            {p.label}
          </span>
        )}
        {task.tags && task.tags.map(tag => (
          <span key={tag} style={{
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
          }}>
            {tag}
          </span>
        ))}
        {task.created && (
          <span style={{ fontSize: '10px', color: '#475569', marginLeft: 'auto' }}>
            {timeAgo(task.created)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban: Column ─────────────────────────────────────────────────

function KanbanColumn({ title, tasks, accentColor, emptyText, dotColor }) {
  return (
    <div style={{
      flex: 1,
      minWidth: '240px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: dotColor,
        }} />
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '11px',
          color: '#475569',
          backgroundColor: '#0f172a',
          padding: '1px 6px',
          borderRadius: '4px',
          fontWeight: 600,
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
      }}>
        {tasks.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#475569',
            fontStyle: 'italic',
          }}>
            {emptyText}
          </div>
        ) : (
          tasks.map((task, i) => (
            <TaskCard key={task.id || i} task={task} accentColor={accentColor} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Kanban: Project detail view ────────────────────────────────────

function ProjectKanbanView({ project, onBack }) {
  const tasks = project.tasks || { todo: [], in_progress: [], done: [] };

  return (
    <div>
      {/* Back button + project header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
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
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#64748b'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
        >
          <span style={{ fontSize: '16px' }}>&larr;</span> All Projects
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: project.color + '20',
            color: project.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 700,
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

      {/* Kanban columns */}
      <div style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '8px',
      }}>
        <KanbanColumn
          title="To Do"
          tasks={tasks.todo}
          accentColor="#94a3b8"
          dotColor="#94a3b8"
          emptyText="No tasks"
        />
        <KanbanColumn
          title="In Progress"
          tasks={tasks.in_progress}
          accentColor="#60a5fa"
          dotColor="#60a5fa"
          emptyText="Nothing in progress"
        />
        <KanbanColumn
          title="Done"
          tasks={tasks.done}
          accentColor="#4ade80"
          dotColor="#4ade80"
          emptyText="Nothing completed yet"
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

  // Total task counts across all projects
  const totalTodo = projects.reduce((sum, p) => sum + (p.tasks?.todo?.length || 0), 0);
  const totalInProgress = projects.reduce((sum, p) => sum + (p.tasks?.in_progress?.length || 0), 0);
  const totalDone = projects.reduce((sum, p) => sum + (p.tasks?.done?.length || 0), 0);
  const totalTasks = totalTodo + totalInProgress + totalDone;

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              color: '#fff',
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

        {/* View toggle: Overview vs Kanban detail */}
        {selected ? (
          <ProjectKanbanView
            project={selected}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <>
            {/* Summary row */}
            {totalTasks > 0 && (
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
              }}>
                {[
                  { label: 'To Do', count: totalTodo, color: '#94a3b8' },
                  { label: 'In Progress', count: totalInProgress, color: '#60a5fa' },
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
