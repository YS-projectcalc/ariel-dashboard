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

// localStorage helpers
function getCompletedIds() {
  try { return JSON.parse(localStorage.getItem('cc_done') || '[]'); } catch { return []; }
}
function getDragOverrides() {
  try { return JSON.parse(localStorage.getItem('cc_drag') || '{}'); } catch { return {}; }
}
function saveDragOverrides(overrides) {
  localStorage.setItem('cc_drag', JSON.stringify(overrides));
}

// Get all tasks from a project as flat array
function getAllTasks(project) {
  const t = project.tasks || {};
  return [...(t.todo || []), ...(t.upnext || []), ...(t.in_progress || []), ...(t.done || [])];
}

// Check if task is in the done array from status.json
function isInDoneArray(task, project) {
  return ((project.tasks || {}).done || []).some(d => d.id === task.id);
}

// Check if task is in the upnext array from status.json
function isInUpnextArray(task, project) {
  return ((project.tasks || {}).upnext || []).some(d => d.id === task.id);
}

// Check if task is done (server-side done array OR client-side completedIds)
function isTaskDone(task, project, completedIds) {
  if (completedIds.includes(task.id)) return true;
  return isInDoneArray(task, project);
}

function hasAssignees(project) {
  return getAllTasks(project).some(t => t.assignee);
}

function getAssignees(project) {
  const assignees = new Set();
  getAllTasks(project).forEach(t => { if (t.assignee) assignees.add(t.assignee); });
  return Array.from(assignees);
}

const priorityOrder = { high: 0, medium: 1, low: 2 };
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
}

// ─── Overview: Bird's-eye project card ──────────────────────────────

function ProjectOverviewCard({ project, completedIds, dragOverrides, onClick }) {
  const allTasks = getAllTasks(project);
  const assignees = getAssignees(project);
  const hasSplit = assignees.length > 0;

  // Determine effective column for each task
  const getEffectiveColumn = (task) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    if (isTaskDone(task, project, completedIds)) return 'done';
    if (isInUpnextArray(task, project)) return 'upnext';
    return 'todo';
  };

  const doneCount = allTasks.filter(t => getEffectiveColumn(t) === 'done').length;
  const assigneeColors = { mordy: '#f97316', yaakov: '#8b5cf6' };

  // For assignee-split projects (Spotlight AI): show per-assignee to-do counts + done
  let counters;
  if (hasSplit) {
    const activeTasks = allTasks.filter(t => getEffectiveColumn(t) !== 'done');
    counters = assignees.map(a => ({
      label: a.charAt(0).toUpperCase() + a.slice(1),
      count: activeTasks.filter(t => (t.assignee || '') === a).length,
      color: assigneeColors[a] || '#60a5fa',
    }));
    // Add any unassigned tasks
    const unassignedCount = activeTasks.filter(t => !t.assignee).length;
    if (unassignedCount > 0) {
      counters.unshift({ label: 'General', count: unassignedCount, color: '#94a3b8' });
    }
    counters.push({ label: 'Done', count: doneCount, color: '#4ade80' });
  } else {
    // Standard: To Do, Up Next, Done
    const todoCount = allTasks.filter(t => getEffectiveColumn(t) === 'todo').length;
    const upnextCount = allTasks.filter(t => getEffectiveColumn(t) === 'upnext').length;
    counters = [
      { label: 'To Do', count: todoCount, color: '#94a3b8' },
      { label: 'Up Next', count: upnextCount, color: '#60a5fa' },
      { label: 'Done', count: doneCount, color: '#4ade80' },
    ];
  }

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
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '3px', backgroundColor: project.color,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          backgroundColor: project.color + '20', color: project.color,
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

      <div style={{ display: 'flex', gap: '6px' }}>
        {counters.map(item => (
          <div key={item.label} style={{
            flex: 1, textAlign: 'center',
            padding: '8px 4px', borderRadius: '8px',
            backgroundColor: '#0d2b3e',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: item.color }}>{item.count}</div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Task card ──────────────────────────────────────────────────────

function TaskCard({ task, accentColor, isDone, onToggle }) {
  const priorityColors = {
    high: { bg: '#451a03', text: '#fb923c', label: 'High' },
    medium: { bg: '#1e1b4b', text: '#a78bfa', label: 'Medium' },
    low: { bg: '#0f172a', text: '#64748b', label: 'Low' },
  };
  const p = priorityColors[task.priority] || null;

  return (
    <div
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.4';
      }}
      onDragEnd={(e) => {
        e.currentTarget.style.opacity = isDone ? '0.6' : '1';
      }}
      style={{
        backgroundColor: '#0d2b3e',
        borderRadius: '8px',
        padding: '14px',
        borderLeft: `3px solid ${isDone ? '#4ade80' : accentColor}`,
        marginBottom: '8px',
        opacity: isDone ? 0.6 : 1,
        transition: 'opacity 0.2s',
        cursor: 'grab',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          style={{
            width: '20px', height: '20px', minWidth: '20px',
            borderRadius: '4px',
            border: isDone ? '2px solid #4ade80' : '2px solid #475569',
            backgroundColor: isDone ? '#4ade8020' : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '1px', transition: 'all 0.15s',
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
                }}>{p.label}</span>
              )}
              {task.assignee && (
                <span style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: task.assignee === 'mordy' ? '#7c2d1220' : '#4c1d9520',
                  color: task.assignee === 'mordy' ? '#f97316' : '#8b5cf6',
                }}>{task.assignee}</span>
              )}
              {task.tags && task.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px', backgroundColor: '#1e293b', color: '#94a3b8',
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task column (drop target) ──────────────────────────────────────

function TaskColumn({ title, tasks, accentColor, emptyText, dotColor, completedIds, onToggle, project, columnId, onDrop }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={{ flex: 1, minWidth: '220px' }}>
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
        }}>{title}</span>
        <span style={{
          fontSize: '11px', color: '#475569',
          backgroundColor: '#0d2b3e',
          padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
        }}>{tasks.length}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setDragOver(false);
          const taskId = e.dataTransfer.getData('text/plain');
          if (taskId && onDrop) onDrop(taskId, columnId);
        }}
        style={{
          backgroundColor: dragOver ? dotColor + '10' : '#1e293b',
          borderRadius: '10px', padding: '10px', minHeight: '120px',
          border: dragOver ? `2px dashed ${dotColor}` : '1px solid #334155',
          maxHeight: '70vh', overflowY: 'auto',
          transition: 'border 0.15s, background-color 0.15s',
        }}
      >
        {tasks.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            fontSize: '12px', color: dragOver ? dotColor : '#475569', fontStyle: 'italic',
          }}>
            {dragOver ? 'Drop here' : emptyText}
          </div>
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id || i}
              task={task}
              accentColor={accentColor}
              isDone={isTaskDone(task, project, completedIds)}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Detail header ──────────────────────────────────────────────────

function DetailHeader({ project, onBack }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px',
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: '1px solid #334155',
          borderRadius: '8px', color: '#94a3b8',
          padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
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
          backgroundColor: project.color + '20', color: project.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 700,
        }}>
          {project.icon || project.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '20px', color: '#f8fafc' }}>{project.name}</div>
          {project.description && (
            <div style={{ fontSize: '13px', color: '#64748b' }}>{project.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Project detail view ────────────────────────────────────────────

function ProjectDetailView({ project, onBack, completedIds, onToggle, dragOverrides, onDragDrop }) {
  const allTasks = getAllTasks(project);
  const assignees = getAssignees(project);
  const hasSplit = assignees.length > 0;

  // Determine effective column for each task, considering drag overrides
  const getEffectiveColumn = (task) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    // Assignee overrides (for Spotlight AI split)
    if (override && override !== '__done__' && override !== '__upnext__' && override !== '__todo__') return 'assignee:' + override;
    if (isTaskDone(task, project, completedIds)) return 'done';
    if (isInUpnextArray(task, project)) return 'upnext';
    return 'todo';
  };

  const getEffectiveAssignee = (task) => {
    const override = dragOverrides[task.id];
    if (override && !override.startsWith('__')) return override;
    return task.assignee;
  };

  const handleDrop = (taskId, columnId) => {
    if (onDragDrop) onDragDrop(taskId, columnId, project.id);
  };

  const assigneeColors = { mordy: '#f97316', yaakov: '#8b5cf6' };

  if (hasSplit) {
    // Assignee-split style (Spotlight AI): one column per assignee + Done
    const doneTasks = allTasks.filter(t => getEffectiveColumn(t) === 'done');
    const activeTasks = allTasks.filter(t => getEffectiveColumn(t) !== 'done');

    const assigneeCols = assignees.map(a => ({
      name: a,
      tasks: sortByPriority(activeTasks.filter(t => (getEffectiveAssignee(t) || '') === a)),
    }));

    // Any unassigned active tasks
    const unassignedTasks = sortByPriority(activeTasks.filter(t => !getEffectiveAssignee(t)));

    return (
      <div>
        <DetailHeader project={project} onBack={onBack} />
        <div style={{
          display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px',
        }}>
          {assigneeCols.map(col => (
            <TaskColumn
              key={col.name}
              title={`${col.name.charAt(0).toUpperCase() + col.name.slice(1)} To-Do`}
              tasks={col.tasks}
              accentColor={assigneeColors[col.name] || '#60a5fa'}
              dotColor={assigneeColors[col.name] || '#60a5fa'}
              emptyText={`Nothing for ${col.name}`}
              completedIds={completedIds}
              onToggle={onToggle} project={project}
              columnId={col.name} onDrop={handleDrop}
            />
          ))}
          {unassignedTasks.length > 0 && (
            <TaskColumn
              title="General" tasks={unassignedTasks}
              accentColor="#94a3b8" dotColor="#94a3b8"
              emptyText="No general tasks" completedIds={completedIds}
              onToggle={onToggle} project={project}
              columnId="__todo__" onDrop={handleDrop}
            />
          )}
          <TaskColumn
            title="Done" tasks={doneTasks}
            accentColor="#4ade80" dotColor="#4ade80"
            emptyText="Nothing completed yet" completedIds={completedIds}
            onToggle={onToggle} project={project}
            columnId="__done__" onDrop={handleDrop}
          />
        </div>
      </div>
    );
  }

  // Standard three-column: To Do, Up Next, Done
  const todoTasks = sortByPriority(allTasks.filter(t => getEffectiveColumn(t) === 'todo'));
  const upnextTasks = sortByPriority(allTasks.filter(t => getEffectiveColumn(t) === 'upnext'));
  const doneTasks = allTasks.filter(t => getEffectiveColumn(t) === 'done');

  return (
    <div>
      <DetailHeader project={project} onBack={onBack} />
      <div style={{
        display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px',
      }}>
        <TaskColumn
          title="To Do" tasks={todoTasks}
          accentColor="#94a3b8" dotColor="#94a3b8"
          emptyText="Backlog empty" completedIds={completedIds}
          onToggle={onToggle} project={project}
          columnId="__todo__" onDrop={handleDrop}
        />
        <TaskColumn
          title="Up Next" tasks={upnextTasks}
          accentColor="#60a5fa" dotColor="#60a5fa"
          emptyText="Nothing queued" completedIds={completedIds}
          onToggle={onToggle} project={project}
          columnId="__upnext__" onDrop={handleDrop}
        />
        <TaskColumn
          title="Done" tasks={doneTasks}
          accentColor="#4ade80" dotColor="#4ade80"
          emptyText="Nothing completed yet" completedIds={completedIds}
          onToggle={onToggle} project={project}
          columnId="__done__" onDrop={handleDrop}
        />
      </div>
    </div>
  );
}

// ─── General Todo Item ──────────────────────────────────────────────

function GeneralTodoItem({ todo, isDone, onToggle }) {
  const priorityColors = {
    high: { bg: '#451a03', text: '#fb923c', label: 'High' },
    medium: { bg: '#1e1b4b', text: '#a78bfa', label: 'Medium' },
    low: { bg: '#0f172a', text: '#64748b', label: 'Low' },
  };
  const p = priorityColors[todo.priority] || null;

  return (
    <div style={{
      backgroundColor: '#0d2b3e',
      borderRadius: '8px',
      padding: '14px',
      borderLeft: `3px solid ${isDone ? '#4ade80' : '#60a5fa'}`,
      opacity: isDone ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          onClick={() => onToggle(todo.id)}
          style={{
            width: '20px', height: '20px', minWidth: '20px',
            borderRadius: '4px',
            border: isDone ? '2px solid #4ade80' : '2px solid #475569',
            backgroundColor: isDone ? '#4ade8020' : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '1px', transition: 'all 0.15s',
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
            {todo.title}
          </div>
          {todo.description && !isDone && (
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '8px' }}>
              {todo.description}
            </div>
          )}
          {!isDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {p && (
                <span style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: p.bg, color: p.text,
                }}>{p.label}</span>
              )}
              {todo.tags && todo.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 6px', borderRadius: '3px',
                  fontSize: '10px', backgroundColor: '#1e293b', color: '#94a3b8',
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── General Todos Section ──────────────────────────────────────────

function GeneralTodosSection({ todos, completedIds, onToggle }) {
  if (!todos || todos.length === 0) return null;

  const activeTodos = todos.filter(t => !completedIds.includes(t.id));
  const doneTodos = todos.filter(t => completedIds.includes(t.id));

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: '#60a5fa',
        }} />
        <span style={{
          fontSize: '14px', fontWeight: 700, color: '#f8fafc',
        }}>General To-Do</span>
        <span style={{
          fontSize: '11px', color: '#475569',
          backgroundColor: '#1e293b',
          padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
        }}>{activeTodos.length}</span>
      </div>
      <div style={{
        display: 'grid', gap: '8px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      }}>
        {activeTodos.map(todo => (
          <GeneralTodoItem
            key={todo.id}
            todo={todo}
            isDone={false}
            onToggle={onToggle}
          />
        ))}
        {doneTodos.map(todo => (
          <GeneralTodoItem
            key={todo.id}
            todo={todo}
            isDone={true}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Potential Businesses Section ─────────────────────────────────────

function PotentialBusinessRow({ biz, isExpanded, onToggle }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '10px',
      border: '1px solid #334155',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#253347'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span style={{
          fontSize: '14px', color: '#64748b',
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>{'\u25B6'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
            {biz.title}
          </div>
          {biz.idea && !isExpanded && (
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
              {biz.idea}
            </div>
          )}
        </div>
      </div>
      {isExpanded && (
        <div style={{
          padding: '0 20px 16px 48px',
          borderTop: '1px solid #334155',
        }}>
          {biz.idea && (
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '12px', lineHeight: 1.5 }}>
              {biz.idea}
            </div>
          )}
          {biz.notes && (
            <div style={{
              marginTop: '12px', padding: '12px',
              backgroundColor: '#0d2b3e', borderRadius: '8px',
              fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {biz.notes}
            </div>
          )}
          {!biz.notes && (
            <div style={{
              marginTop: '12px', padding: '12px',
              backgroundColor: '#0d2b3e', borderRadius: '8px',
              fontSize: '12px', color: '#475569', fontStyle: 'italic',
            }}>
              No notes yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PotentialBusinessesSection({ businesses }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!businesses || businesses.length === 0) {
    return (
      <div style={{ marginTop: '32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: '#f59e0b',
          }} />
          <span style={{
            fontSize: '14px', fontWeight: 700, color: '#f8fafc',
          }}>Potential Businesses</span>
          <span style={{
            fontSize: '11px', color: '#475569',
            backgroundColor: '#1e293b',
            padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
          }}>0</span>
        </div>
        <div style={{
          backgroundColor: '#1e293b', borderRadius: '10px',
          border: '1px solid #334155', padding: '24px',
          textAlign: 'center', fontSize: '13px', color: '#475569',
          fontStyle: 'italic',
        }}>
          No ideas yet — add them to status.json under potentialBusinesses
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: '#f59e0b',
        }} />
        <span style={{
          fontSize: '14px', fontWeight: 700, color: '#f8fafc',
        }}>Potential Businesses</span>
        <span style={{
          fontSize: '11px', color: '#475569',
          backgroundColor: '#1e293b',
          padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
        }}>{businesses.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {businesses.map(biz => (
          <PotentialBusinessRow
            key={biz.id}
            biz={biz}
            isExpanded={expandedId === biz.id}
            onToggle={() => setExpandedId(expandedId === biz.id ? null : biz.id)}
          />
        ))}
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
  const [dragOverrides, setDragOverrides] = useState({});

  useEffect(() => {
    setCompletedIds(getCompletedIds());
    setDragOverrides(getDragOverrides());
  }, []);

  const toggleTask = useCallback((taskId) => {
    setCompletedIds(prev => {
      const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
      localStorage.setItem('cc_done', JSON.stringify(next));
      return next;
    });
    setDragOverrides(prev => {
      const next = { ...prev };
      delete next[taskId];
      saveDragOverrides(next);
      return next;
    });
  }, []);

  const handleDragDrop = useCallback((taskId, targetColumnId, projectId) => {
    if (!taskId) return;
    if (targetColumnId === '__done__') {
      setCompletedIds(prev => {
        if (prev.includes(taskId)) return prev;
        const next = [...prev, taskId];
        localStorage.setItem('cc_done', JSON.stringify(next));
        return next;
      });
      setDragOverrides(prev => {
        const next = { ...prev };
        next[taskId] = '__done__';
        saveDragOverrides(next);
        return next;
      });
    } else {
      // Move to To Do, Up Next, or an assignee column — always remove from done
      const newCompleted = getCompletedIds().filter(id => id !== taskId);
      localStorage.setItem('cc_done', JSON.stringify(newCompleted));
      setCompletedIds(newCompleted);
      // Set the column override
      const newOverrides = { ...getDragOverrides(), [taskId]: targetColumnId };
      saveDragOverrides(newOverrides);
      setDragOverrides(newOverrides);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/status.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) { setError(e.message); }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d2b3e', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#f87171', padding: '40px', textAlign: 'center' }}>
          Failed to load: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d2b3e', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#64748b', padding: '40px', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  const projects = data.projects || [];
  const todos = data.todos || [];
  const selected = selectedProject ? projects.find(p => p.id === selectedProject) : null;

  // One card per project — no splitting by assignee
  const overviewCards = projects.map(project => ({ project, key: project.id }));

  // Total counts
  const getEffCol = (task, project) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    if (isTaskDone(task, project, completedIds)) return 'done';
    if (isInUpnextArray(task, project)) return 'upnext';
    return 'todo';
  };
  let totalTodo = 0, totalUpnext = 0, totalDone = 0;
  projects.forEach(p => {
    getAllTasks(p).forEach(t => {
      const col = getEffCol(t, p);
      if (col === 'done') totalDone++;
      else if (col === 'upnext') totalUpnext++;
      else totalTodo++;
    });
  });
  const totalTasks = totalTodo + totalUpnext + totalDone + todos.length;

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0d2b3e', padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 800, color: '#fff',
            }}>CC</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc' }}>Command Center</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {projects.length} projects &middot; {totalTasks} tasks
              </div>
            </div>
          </div>
          {data.lastUpdated && (
            <div style={{ fontSize: '12px', color: '#64748b' }}>Updated {timeAgo(data.lastUpdated)}</div>
          )}
        </header>

        {selected ? (
          <ProjectDetailView
            project={selected}
            onBack={() => setSelectedProject(null)}
            completedIds={completedIds}
            onToggle={toggleTask}
            dragOverrides={dragOverrides}
            onDragDrop={handleDragDrop}
          />
        ) : (
          <>
            {totalTasks > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'To Do', count: totalTodo, color: '#94a3b8' },
                  { label: 'Up Next', count: totalUpnext, color: '#60a5fa' },
                  { label: 'Done', count: totalDone, color: '#4ade80' },
                ].map(item => (
                  <div key={item.label} style={{
                    flex: 1, backgroundColor: '#1e293b',
                    borderRadius: '10px', border: '1px solid #334155',
                    padding: '16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: item.color }}>{item.count}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}>
              {overviewCards.map(card => (
                <ProjectOverviewCard
                  key={card.key}
                  project={card.project}
                  completedIds={completedIds}
                  dragOverrides={dragOverrides}
                  onClick={() => setSelectedProject(card.project.id)}
                />
              ))}
            </div>

            <GeneralTodosSection
              todos={todos}
              completedIds={completedIds}
              onToggle={toggleTask}
            />

            <PotentialBusinessesSection
              businesses={data.potentialBusinesses || []}
            />
          </>
        )}
      </div>
    </div>
  );
}
