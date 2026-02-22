'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

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
function getUserTasks() {
  try { return JSON.parse(localStorage.getItem('cc_user_tasks') || '[]'); } catch { return []; }
}
function saveUserTasks(tasks) {
  localStorage.setItem('cc_user_tasks', JSON.stringify(tasks));
}
function getColumnOrder() {
  try { return JSON.parse(localStorage.getItem('cc_col_order') || '{}'); } catch { return {}; }
}
function saveColumnOrder(order) {
  localStorage.setItem('cc_col_order', JSON.stringify(order));
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

// Apply user edits to tasks
function applyEdits(tasks, taskEdits) {
  if (!taskEdits || Object.keys(taskEdits).length === 0) return tasks;
  return tasks.map(t => {
    const edits = taskEdits[t.id];
    if (!edits) return t;
    const merged = { ...t, ...edits };
    // Preserve original subtasks if edits don't have meaningful subtask data
    if (t.subtasks && (!edits.subtasks || edits.subtasks.length === 0)) {
      merged.subtasks = t.subtasks;
    }
    return merged;
  });
}

// Apply column ordering
function applyColumnOrder(tasks, orderKey, columnOrder) {
  const order = columnOrder[orderKey];
  if (!order || order.length === 0) return tasks;
  const orderMap = {};
  order.forEach((id, i) => { orderMap[id] = i; });
  return [...tasks].sort((a, b) => {
    const aIdx = orderMap[a.id] ?? 999;
    const bIdx = orderMap[b.id] ?? 999;
    if (aIdx !== 999 || bIdx !== 999) return aIdx - bIdx;
    return 0; // keep original order for unordered items
  });
}

// ─── Omnisearch Bar (Feature 5) ─────────────────────────────────────

function OmnisearchBar({ data, onNavigate, userTasks }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  // Build searchable index
  const searchResults = useMemo(() => {
    if (!query.trim() || !data) return [];
    const q = query.toLowerCase().trim();
    const results = [];

    // Search projects
    (data.projects || []).forEach(p => {
      if (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) {
        results.push({ type: 'project', label: p.name, sub: p.description, id: p.id, color: p.color });
      }
      // Search tasks in projects
      getAllTasks(p).forEach(t => {
        if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
          results.push({ type: 'task', label: t.title, sub: `${p.name}`, id: t.id, projectId: p.id, color: p.color });
        }
      });
    });

    // Search general todos
    (data.todos || []).forEach(t => {
      if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
        results.push({ type: 'todo', label: t.title, sub: 'General To-Do', id: t.id, color: '#60a5fa' });
      }
    });

    // Search potential businesses
    (data.potentialBusinesses || []).forEach(b => {
      if (b.title.toLowerCase().includes(q) || (b.idea || '').toLowerCase().includes(q) || (b.notes || '').toLowerCase().includes(q)) {
        results.push({ type: 'idea', label: b.title, sub: b.idea ? b.idea.slice(0, 80) : 'Potential Idea', id: b.id, color: '#f59e0b' });
      }
    });

    // Search user tasks
    (userTasks || []).forEach(t => {
      if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
        results.push({ type: 'task', label: t.title, sub: t._projectId || 'User Task', id: t.id, color: '#60a5fa' });
      }
    });

    return results.slice(0, 12);
  }, [query, data, userTasks]);

  const showResults = focused && query.trim().length > 0 && searchResults.length > 0;

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const typeIcons = { project: 'P', task: 'T', todo: 'G', idea: 'I' };
  const typeLabels = { project: 'Project', task: 'Task', todo: 'To-Do', idea: 'Idea' };

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: '480px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        backgroundColor: '#163344', border: '1px solid ' + (focused ? '#60a5fa' : '#1e4258'),
        borderRadius: '10px', padding: '8px 14px',
        transition: 'border-color 0.15s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search projects, tasks, ideas..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
          }}
        />
        <kbd style={{
          fontSize: '10px', color: '#475569', backgroundColor: '#0a2233',
          padding: '2px 6px', borderRadius: '4px', border: '1px solid #334155',
        }}>
          {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+K
        </kbd>
      </div>
      {showResults && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#163344', border: '1px solid #1e4258', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100,
          maxHeight: '320px', overflowY: 'auto',
        }}>
          {searchResults.map((r, i) => (
            <div
              key={r.id + '-' + i}
              onMouseDown={() => {
                if (r.type === 'project') onNavigate('project', r.id);
                else if (r.projectId) onNavigate('project', r.projectId);
                else if (r.type === 'idea') onNavigate('ideas', r.id);
                setQuery('');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < searchResults.length - 1 ? '1px solid #1e4258' : 'none',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#253347'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px',
                backgroundColor: (r.color || '#64748b') + '20', color: r.color || '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, flexShrink: 0,
              }}>{typeIcons[r.type]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.label}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.sub}
                </div>
              </div>
              <span style={{
                fontSize: '9px', color: '#475569', textTransform: 'uppercase',
                fontWeight: 600, letterSpacing: '0.5px',
              }}>{typeLabels[r.type]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Change Request Popout (Feature 6) ──────────────────────────────

function ChangeRequestPopout({ onClose }) {
  const [request, setRequest] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!request.trim() || sending) return;
    setSending(true);
    try {
      const newReq = {
        id: Date.now().toString(36),
        text: request.trim(),
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      // Save to localStorage for local display
      const requests = JSON.parse(localStorage.getItem('cc_change_requests') || '[]');
      requests.push(newReq);
      localStorage.setItem('cc_change_requests', JSON.stringify(requests));
      // Also POST to server so Ariel can see it
      try {
        await fetch('/api/change-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReq),
        });
      } catch {
        // Server save failed silently — local copy still preserved
      }
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
      width: '340px', backgroundColor: '#163344', border: '1px solid #1e4258',
      borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      zIndex: 100, padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>Request a Change</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px', padding: '4px',
        }}>&times;</button>
      </div>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#4ade80', fontSize: '13px' }}>
          Request saved. Ariel will pick it up.
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder="Describe the change you'd like to see on the dashboard..."
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: '#0a2233', border: '1px solid #334155',
              borderRadius: '8px', padding: '10px',
              color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
              outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button onClick={handleSubmit} disabled={!request.trim() || sending} style={{
              backgroundColor: request.trim() && !sending ? '#8b5cf6' : '#334155',
              color: request.trim() && !sending ? '#fff' : '#64748b',
              border: 'none', borderRadius: '8px', padding: '8px 16px',
              fontSize: '13px', fontWeight: 600, cursor: request.trim() && !sending ? 'pointer' : 'default',
            }}>{sending ? 'Saving...' : 'Submit'}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Due Date Picker (Feature 2) ────────────────────────────────────

function DueDatePicker({ taskId, currentDueDate, onSetDueDate, onClose, anchorRect }) {
  const [date, setDate] = useState(currentDueDate || '');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const handleClick = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  const style = anchorRect ? {
    position: 'fixed', top: anchorRect.bottom + 4, right: Math.max(8, window.innerWidth - anchorRect.right),
    backgroundColor: '#163344', border: '1px solid #1e4258',
    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 10000, padding: '12px', width: '220px',
  } : {
    position: 'absolute', top: '100%', right: 0, marginTop: '4px',
    backgroundColor: '#163344', border: '1px solid #1e4258',
    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 10000, padding: '12px', width: '220px',
  };

  return (
    <div ref={pickerRef} style={style} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>Set Due Date</div>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          backgroundColor: '#0a2233', border: '1px solid #334155',
          borderRadius: '6px', padding: '8px',
          color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
          outline: 'none', colorScheme: 'dark',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        {date && (
          <button onClick={() => { onSetDueDate(taskId, ''); onClose(); }} style={{
            background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '11px', padding: '4px',
          }}>Clear</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '4px 8px',
        }}>Cancel</button>
        <button onClick={() => { onSetDueDate(taskId, date); onClose(); }} disabled={!date} style={{
          backgroundColor: date ? '#60a5fa' : '#334155',
          color: date ? '#fff' : '#64748b',
          border: 'none', borderRadius: '6px', padding: '4px 12px',
          fontSize: '12px', fontWeight: 600, cursor: date ? 'pointer' : 'default',
        }}>Set</button>
      </div>
    </div>
  );
}

// ─── Reminder Picker (Feature 3) ────────────────────────────────────

function ReminderPicker({ taskId, taskTitle, onClose, anchorRect }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [sent, setSent] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const handleClick = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  const handleSet = () => {
    if (!date || !time) return;
    // Save reminder to localStorage — Ariel's cron will pick it up
    const reminders = JSON.parse(localStorage.getItem('cc_reminders') || '[]');
    reminders.push({
      id: Date.now().toString(36),
      taskId,
      taskTitle,
      datetime: `${date}T${time}:00`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    localStorage.setItem('cc_reminders', JSON.stringify(reminders));
    setSent(true);
    setTimeout(onClose, 1200);
  };

  const style = anchorRect ? {
    position: 'fixed', top: anchorRect.bottom + 4, right: Math.max(8, window.innerWidth - anchorRect.right),
    backgroundColor: '#163344', border: '1px solid #1e4258',
    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 10000, padding: '12px', width: '240px',
  } : {
    position: 'absolute', top: '100%', right: 0, marginTop: '4px',
    backgroundColor: '#163344', border: '1px solid #1e4258',
    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 10000, padding: '12px', width: '240px',
  };

  return (
    <div ref={pickerRef} style={style} onClick={e => e.stopPropagation()}>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '12px', color: '#4ade80', fontSize: '13px' }}>
          Reminder set
        </div>
      ) : (
        <>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
            Set Reminder
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
            You'll get an email at the chosen time.
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: '#0a2233', border: '1px solid #334155',
              borderRadius: '6px', padding: '8px',
              color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
              outline: 'none', colorScheme: 'dark', marginBottom: '6px',
            }}
          />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: '#0a2233', border: '1px solid #334155',
              borderRadius: '6px', padding: '8px',
              color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
              outline: 'none', colorScheme: 'dark',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '10px' }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '4px 8px',
            }}>Cancel</button>
            <button onClick={handleSet} disabled={!date} style={{
              backgroundColor: date ? '#f59e0b' : '#334155',
              color: date ? '#fff' : '#64748b',
              border: 'none', borderRadius: '6px', padding: '4px 12px',
              fontSize: '12px', fontWeight: 600, cursor: date ? 'pointer' : 'default',
            }}>Set Reminder</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Edit Card Modal (Feature 7) ────────────────────────────────────

function EditCardModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [tags, setTags] = useState((task.tags || []).join(', '));

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    onClose();
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: '#0a2233', border: '1px solid #334155',
    borderRadius: '8px', padding: '10px 12px',
    color: '#f8fafc', fontSize: '14px', fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#163344', borderRadius: '14px',
          border: '1px solid #1e4258', width: '100%', maxWidth: '440px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>Edit Card</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', padding: '4px',
          }}>&times;</button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Priority</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['high', 'medium', 'low'].map(p => (
              <button key={p} type="button" onClick={() => setPriority(p)} style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                border: priority === p ? '2px solid' : '1px solid #334155',
                borderColor: priority === p ? (p === 'high' ? '#fb923c' : p === 'medium' ? '#a78bfa' : '#64748b') : '#334155',
                backgroundColor: p === 'high' ? '#451a03' : p === 'medium' ? '#1e1b4b' : '#0f172a',
                color: p === 'high' ? '#fb923c' : p === 'medium' ? '#a78bfa' : '#64748b',
                cursor: 'pointer',
              }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g. urgent, frontend, design"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #334155', borderRadius: '8px',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            padding: '8px 16px',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim()} style={{
            backgroundColor: title.trim() ? '#8b5cf6' : '#334155',
            color: title.trim() ? '#fff' : '#64748b',
            border: 'none', borderRadius: '8px', padding: '8px 20px',
            fontSize: '13px', fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default',
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Task Form (inline) ─────────────────────────────────────────

function AddTaskForm({ projectId, column, assignee, accentColor, onAdd, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    const task = {
      id: 'u-' + Date.now().toString(36),
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      tags: ['user-added'],
      assignee: assignee || undefined,
      createdAt: new Date().toISOString(),
      _userAdded: true,
      _projectId: projectId,
      _column: column,
    };
    onAdd(task);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setSaving(false);
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, projectId, column }),
      });
      if (res.ok) {
        setSyncStatus('synced');
        const stored = JSON.parse(localStorage.getItem('cc_user_tasks') || '[]');
        const updated = stored.filter(t => t.id !== task.id);
        localStorage.setItem('cc_user_tasks', JSON.stringify(updated));
      } else {
        setSyncStatus('error');
      }
    } catch {
      setSyncStatus('error');
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: '#163344', border: '1px solid #334155',
    borderRadius: '6px', padding: '8px 10px',
    color: '#f8fafc', fontSize: '13px',
    outline: 'none', fontFamily: 'inherit',
  };

  return (
    <form onSubmit={handleSubmit} style={{
      backgroundColor: '#0a2233', borderRadius: '8px',
      padding: '12px', marginBottom: '8px',
      borderLeft: `3px solid ${accentColor}`,
    }}>
      <input
        autoFocus
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={inputStyle}
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        style={{ ...inputStyle, marginTop: '6px', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
        {['high', 'medium', 'low'].map(p => (
          <button key={p} type="button" onClick={() => setPriority(p)} style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
            border: priority === p ? '1px solid' : '1px solid transparent',
            borderColor: priority === p ? (p === 'high' ? '#fb923c' : p === 'medium' ? '#a78bfa' : '#64748b') : 'transparent',
            backgroundColor: p === 'high' ? '#451a03' : p === 'medium' ? '#1e1b4b' : '#0f172a',
            color: p === 'high' ? '#fb923c' : p === 'medium' ? '#a78bfa' : '#64748b',
            cursor: 'pointer',
          }}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} style={{
          background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: '12px', padding: '4px 8px',
        }}>Cancel</button>
        <button type="submit" disabled={!title.trim() || saving} style={{
          backgroundColor: title.trim() && !saving ? accentColor : '#334155',
          color: title.trim() && !saving ? '#fff' : '#64748b',
          border: 'none', borderRadius: '6px', padding: '5px 12px',
          fontSize: '12px', fontWeight: 600, cursor: title.trim() && !saving ? 'pointer' : 'default',
        }}>{saving ? 'Adding...' : 'Add'}</button>
      </div>
      {syncStatus && (
        <div style={{
          fontSize: '11px', marginTop: '6px', textAlign: 'right',
          color: syncStatus === 'synced' ? '#4ade80' : syncStatus === 'error' ? '#f87171' : '#94a3b8',
        }}>
          {syncStatus === 'syncing' ? 'Saving to server...' :
           syncStatus === 'synced' ? 'Saved permanently' :
           'Saved locally (server sync failed — will retry on next add)'}
        </div>
      )}
    </form>
  );
}

// ─── Add button for column headers ──────────────────────────────────

function AddButton({ onClick, color }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: '20px', height: '20px', borderRadius: '4px',
        border: '1px solid #334155', background: 'none',
        color: '#64748b', cursor: 'pointer', fontSize: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, lineHeight: 1, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#64748b'; }}
      title="Add task"
    >+</button>
  );
}

// ─── Overview: Bird's-eye project card ──────────────────────────────

function ProjectOverviewCard({ project, completedIds, dragOverrides, onClick, userTasks }) {
  const projectUserTasks = (userTasks || []).filter(t => t._projectId === project.id);
  const allTasks = [...getAllTasks(project), ...projectUserTasks];
  const assignees = getAssignees(project);
  const hasSplit = assignees.length > 0;

  const getEffectiveColumn = (task) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    if (isTaskDone(task, project, completedIds)) return 'done';
    if (task._userAdded) {
      if (task._column === '__upnext__') return 'upnext';
      return 'todo';
    }
    if (isInUpnextArray(task, project)) return 'upnext';
    return 'todo';
  };

  const doneCount = allTasks.filter(t => getEffectiveColumn(t) === 'done').length;
  const assigneeColors = { mordy: '#f97316', yaakov: '#8b5cf6' };

  let counters;
  if (hasSplit) {
    const activeTasks = allTasks.filter(t => getEffectiveColumn(t) !== 'done');
    counters = assignees.map(a => ({
      label: a.charAt(0).toUpperCase() + a.slice(1),
      count: activeTasks.filter(t => (t.assignee || '') === a).length,
      color: assigneeColors[a] || '#60a5fa',
    }));
    const unassignedCount = activeTasks.filter(t => !t.assignee).length;
    if (unassignedCount > 0) {
      counters.unshift({ label: 'General', count: unassignedCount, color: '#94a3b8' });
    }
    counters.push({ label: 'Done', count: doneCount, color: '#4ade80' });
  } else {
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
        backgroundColor: '#163344',
        borderRadius: '12px',
        border: '1px solid #1e4258',
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
        e.currentTarget.style.borderColor = '#1e4258';
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
            backgroundColor: '#0a2233',
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

// ─── Task card (with due date + reminder buttons) ───────────────────

function TaskCard({ task, accentColor, isDone, onToggle, dueDates, onSetDueDate, onEdit, index, onReorder, onSubtaskToggle, onSubtaskAdd }) {
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const priorityColors = {
    high: { bg: '#451a03', text: '#fb923c', label: 'High' },
    medium: { bg: '#1e1b4b', text: '#a78bfa', label: 'Medium' },
    low: { bg: '#0f172a', text: '#64748b', label: 'Low' },
  };
  const p = priorityColors[task.priority] || null;
  const dueDate = dueDates[task.id] || task.dueDate;
  const isOverdue = dueDate && new Date(dueDate) < new Date() && !isDone;

  const pickerOpen = showDuePicker || showReminder;

  return (
    <div
      draggable="true"
      data-task-id={task.id}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.setData('application/x-index', String(index));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.4';
      }}
      onDragEnd={(e) => {
        e.currentTarget.style.opacity = isDone ? '0.6' : '1';
        // Belt-and-suspenders: reset all column drag states when any drag ends
        document.querySelectorAll('[data-drop-column]').forEach(el => {
          el.dispatchEvent(new CustomEvent('dragreset'));
        });
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== task.id && onReorder) {
          onReorder(draggedId, task.id);
        }
        // Reset all column drag states
        document.querySelectorAll('[data-drop-column]').forEach(el => {
          el.dispatchEvent(new CustomEvent('dragreset'));
        });
      }}
      onDoubleClick={() => { if (onEdit && !isDone) onEdit(task); }}
      style={{
        backgroundColor: '#0a2233',
        borderRadius: '8px',
        padding: '10px 10px 14px 10px',
        borderLeft: `3px solid ${isDone ? '#4ade80' : isOverdue ? '#f87171' : accentColor}`,
        marginBottom: '6px',
        opacity: isDone ? 0.6 : 1,
        transition: 'opacity 0.2s',
        cursor: 'grab',
        position: 'relative',
        zIndex: pickerOpen ? 500 : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
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
          {task.description && !isDone && (!task.subtasks || task.subtasks.length === 0) && (
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3, marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {task.description}
            </div>
          )}
          {!isDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {p && (
                <span style={{
                  padding: '1px 5px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: p.bg, color: p.text,
                }}>{p.label}</span>
              )}
              {task.assignee && (
                <span style={{
                  padding: '1px 5px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: task.assignee === 'mordy' ? '#7c2d1220' : '#4c1d9520',
                  color: task.assignee === 'mordy' ? '#f97316' : '#8b5cf6',
                }}>{task.assignee}</span>
              )}
              {task.tags && task.tags.map(tag => (
                <span key={tag} style={{
                  padding: '1px 5px', borderRadius: '3px',
                  fontSize: '10px', backgroundColor: '#163344', color: '#94a3b8',
                }}>{tag}</span>
              ))}
              {dueDate && (
                <span style={{
                  padding: '1px 5px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: isOverdue ? '#7f1d1d' : '#1e3a5f',
                  color: isOverdue ? '#f87171' : '#60a5fa',
                }}>
                  Due {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          )}
          {/* Subtask indicator removed — info merged into bottom-right arrow area */}
          {/* Expanded subtask list */}
          {!isDone && subtasksExpanded && task.subtasks && (
            <div style={{ marginTop: '8px', paddingLeft: '4px', borderLeft: '2px solid #1e4258' }}>
              {task.subtasks.map((st) => (
                <div key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '4px 8px', fontSize: '12px',
                }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); if (onSubtaskToggle) onSubtaskToggle(task.id, st.id); }}
                    style={{
                      width: '14px', height: '14px', minWidth: '14px',
                      borderRadius: '3px',
                      border: st.done ? '1.5px solid #4ade80' : '1.5px solid #475569',
                      backgroundColor: st.done ? '#4ade8020' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {st.done && (
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    color: st.done ? '#475569' : '#cbd5e1',
                    textDecoration: st.done ? 'line-through' : 'none',
                    flex: 1,
                  }}>{st.text || st.title}</span>
                </div>
              ))}
              {/* Add subtask inline */}
              {addingSubtask ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', marginTop: '2px' }}>
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                        if (onSubtaskAdd) onSubtaskAdd(task.id, newSubtaskTitle.trim());
                        setNewSubtaskTitle('');
                      }
                      if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
                    }}
                    placeholder="Subtask..."
                    style={{
                      flex: 1, backgroundColor: '#163344', border: '1px solid #334155',
                      borderRadius: '4px', padding: '4px 8px',
                      color: '#f8fafc', fontSize: '11px', fontFamily: 'inherit',
                      outline: 'none',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (newSubtaskTitle.trim() && onSubtaskAdd) {
                        onSubtaskAdd(task.id, newSubtaskTitle.trim());
                        setNewSubtaskTitle('');
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#4ade80',
                      cursor: 'pointer', fontSize: '14px', padding: '2px',
                    }}
                  >+</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingSubtask(false); setNewSubtaskTitle(''); }}
                    style={{
                      background: 'none', border: 'none', color: '#64748b',
                      cursor: 'pointer', fontSize: '12px', padding: '2px',
                    }}
                  >&times;</button>
                </div>
              ) : (
                <div
                  onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); }}
                  style={{
                    padding: '4px 8px', marginTop: '2px',
                    fontSize: '11px', color: '#475569', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                >
                  + Add subtask
                </div>
              )}
            </div>
          )}
          {/* Subtask expand button for tasks without subtasks yet (shows on hover via CSS-in-JS) */}
          {!isDone && (!task.subtasks || task.subtasks.length === 0) && subtasksExpanded && (
            <div style={{ marginTop: '8px', paddingLeft: '4px', borderLeft: '2px solid #1e4258' }}>
              {addingSubtask ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px' }}>
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                        if (onSubtaskAdd) onSubtaskAdd(task.id, newSubtaskTitle.trim());
                        setNewSubtaskTitle('');
                      }
                      if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
                    }}
                    placeholder="Subtask..."
                    style={{
                      flex: 1, backgroundColor: '#163344', border: '1px solid #334155',
                      borderRadius: '4px', padding: '4px 8px',
                      color: '#f8fafc', fontSize: '11px', fontFamily: 'inherit',
                      outline: 'none',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (newSubtaskTitle.trim() && onSubtaskAdd) {
                        onSubtaskAdd(task.id, newSubtaskTitle.trim());
                        setNewSubtaskTitle('');
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#4ade80',
                      cursor: 'pointer', fontSize: '14px', padding: '2px',
                    }}
                  >+</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingSubtask(false); setNewSubtaskTitle(''); }}
                    style={{
                      background: 'none', border: 'none', color: '#64748b',
                      cursor: 'pointer', fontSize: '12px', padding: '2px',
                    }}
                  >&times;</button>
                </div>
              ) : (
                <div
                  onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px', color: '#475569', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                >
                  + Add subtask
                </div>
              )}
            </div>
          )}
        </div>
        {/* Edit + Due date + Reminder buttons */}
        {!isDone && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(task); }}
              title="Edit card"
              style={{
                width: '24px', height: '24px', borderRadius: '4px',
                border: '1px solid #334155', background: 'none',
                color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'all 0.15s', fontSize: '12px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#475569'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setPickerAnchor(rect); setShowDuePicker(!showDuePicker); setShowReminder(false); }}
              title="Set due date"
              style={{
                width: '24px', height: '24px', borderRadius: '4px',
                border: '1px solid #334155', background: 'none',
                color: dueDate ? '#60a5fa' : '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'all 0.15s', fontSize: '12px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#60a5fa'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = dueDate ? '#60a5fa' : '#475569'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setPickerAnchor(rect); setShowReminder(!showReminder); setShowDuePicker(false); }}
              title="Set reminder"
              style={{
                width: '24px', height: '24px', borderRadius: '4px',
                border: '1px solid #334155', background: 'none',
                color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, transition: 'all 0.15s', fontSize: '12px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#f59e0b'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#475569'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            {showDuePicker && (
              <DueDatePicker
                taskId={task.id}
                currentDueDate={dueDate}
                onSetDueDate={onSetDueDate}
                onClose={() => setShowDuePicker(false)}
                anchorRect={pickerAnchor}
              />
            )}
            {showReminder && (
              <ReminderPicker
                taskId={task.id}
                taskTitle={task.title}
                onClose={() => setShowReminder(false)}
                anchorRect={pickerAnchor}
              />
            )}
          </div>
        )}
      </div>
      {/* Subtask expand/collapse arrow - absolute positioned bottom-right */}
      {!isDone && (
        <div
          onClick={(e) => { e.stopPropagation(); setSubtasksExpanded(!subtasksExpanded); }}
          title={subtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          style={{
            position: 'absolute', bottom: '4px', right: '6px',
            cursor: 'pointer', padding: '2px',
            color: '#475569', transition: 'color 0.15s',
            lineHeight: 0,
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.color = '#475569'}
        >
          {task.subtasks && task.subtasks.length > 0 && (
            <span style={{ fontSize: '9px', lineHeight: 1 }}>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            style={{ transition: 'transform 0.15s', transform: subtasksExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <path d="M3 1L7 5L3 9"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Task column (drop target) ──────────────────────────────────────

function TaskColumn({ title, tasks, accentColor, emptyText, dotColor, completedIds, onToggle, project, columnId, onDrop, onAddTask, showAddForm, onToggleAddForm, dueDates, onSetDueDate, onEdit, onReorder, onSubtaskToggle, onSubtaskAdd }) {
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const columnRef = useRef(null);

  // Reset drag state when any drag operation ends OR when a card-to-card drop fires dragreset
  useEffect(() => {
    const reset = () => { dragCounterRef.current = 0; setDragOver(false); };
    document.addEventListener('dragend', reset);
    const el = columnRef.current;
    if (el) el.addEventListener('dragreset', reset);
    return () => {
      document.removeEventListener('dragend', reset);
      if (el) el.removeEventListener('dragreset', reset);
    };
  }, []);

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
          backgroundColor: '#0a2233',
          padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
        }}>{tasks.length}</span>
        {onToggleAddForm && columnId !== '__done__' && (
          <AddButton onClick={onToggleAddForm} color={dotColor} />
        )}
      </div>
      <div
        ref={columnRef}
        data-drop-column={columnId}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; setDragOver(true); }}
        onDragLeave={(e) => { dragCounterRef.current--; if (dragCounterRef.current === 0) setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault(); dragCounterRef.current = 0; setDragOver(false);
          const taskId = e.dataTransfer.getData('text/plain');
          if (!taskId || !onDrop) return;
          // Find which card position the drop landed near using Y coordinate
          const cards = Array.from(e.currentTarget.querySelectorAll('[data-task-id]'));
          let insertBeforeId = null;
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              insertBeforeId = card.getAttribute('data-task-id');
              break;
            }
          }
          onDrop(taskId, columnId, insertBeforeId);
        }}
        style={{
          backgroundColor: dragOver ? dotColor + '10' : '#1e293b',
          borderRadius: '10px', padding: '10px', minHeight: '120px',
          border: dragOver ? `2px dashed ${dotColor}` : '1px solid #334155',
          maxHeight: '70vh', overflowY: 'auto',
          scrollbarWidth: 'none',
          transition: 'border 0.15s, background-color 0.15s',
        }}
      >
        {showAddForm && (
          <AddTaskForm
            projectId={project.id}
            column={columnId}
            assignee={columnId !== '__todo__' && columnId !== '__upnext__' && columnId !== '__done__' ? columnId : undefined}
            accentColor={accentColor}
            onAdd={(task) => { if (onAddTask) onAddTask(task); }}
            onCancel={onToggleAddForm}
          />
        )}
        {tasks.length === 0 && !showAddForm ? (
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
              index={i}
              accentColor={accentColor}
              isDone={isTaskDone(task, project, completedIds)}
              onToggle={onToggle}
              dueDates={dueDates}
              onSetDueDate={onSetDueDate}
              onEdit={onEdit}
              onReorder={onReorder}
              onSubtaskToggle={onSubtaskToggle}
              onSubtaskAdd={onSubtaskAdd}
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
          background: 'none', border: '1px solid #1e4258',
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

function ProjectDetailView({ project, onBack, completedIds, onToggle, dragOverrides, onDragDrop, userTasks, onAddUserTask, dueDates, onSetDueDate, onEditTask, columnOrder, onReorderInColumn, taskEdits: taskEditsFromParent, onSubtaskToggle, onSubtaskAdd }) {
  const [addingToColumn, setAddingToColumn] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const projectUserTasks = userTasks.filter(t => t._projectId === project.id);
  const allServerTasks = getAllTasks(project);
  const allTasks = [...allServerTasks, ...projectUserTasks];

  const assignees = getAssignees(project);
  projectUserTasks.forEach(t => { if (t.assignee && !assignees.includes(t.assignee)) assignees.push(t.assignee); });
  const hasSplit = assignees.length > 0;

  const getEffectiveColumn = (task) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    if (override && override !== '__done__' && override !== '__upnext__' && override !== '__todo__') return 'assignee:' + override;
    if (isTaskDone(task, project, completedIds)) return 'done';
    if (task._userAdded) {
      if (task._column === '__upnext__') return 'upnext';
      if (task._column === '__done__') return 'done';
      if (task._column && !task._column.startsWith('__')) return 'todo';
      return 'todo';
    }
    if (isInUpnextArray(task, project)) return 'upnext';
    return 'todo';
  };

  const getEffectiveAssignee = (task) => {
    const override = dragOverrides[task.id];
    if (override && !override.startsWith('__')) return override;
    return task.assignee;
  };

  const handleDrop = (taskId, columnId, insertBeforeId) => {
    if (onDragDrop) onDragDrop(taskId, columnId, project.id, insertBeforeId);
  };

  const handleAddTask = (task) => {
    onAddUserTask(task);
    setAddingToColumn(null);
  };

  const handleReorder = (columnId) => (draggedId, targetId) => {
    if (onReorderInColumn) onReorderInColumn(project.id, columnId, draggedId, targetId);
  };

  const handleEdit = (task) => setEditingTask(task);
  const handleSaveEdit = (updated) => {
    if (onEditTask) onEditTask(updated);
    setEditingTask(null);
  };

  const assigneeColors = { mordy: '#f97316', yaakov: '#8b5cf6' };

  if (hasSplit) {
    const editedAllTasks = applyEdits(allTasks, taskEditsFromParent);
    const doneTasks = applyColumnOrder(editedAllTasks.filter(t => getEffectiveColumn(t) === 'done'), `${project.id}:__done__`, columnOrder);
    const activeTasks = editedAllTasks.filter(t => getEffectiveColumn(t) !== 'done');

    const assigneeCols = assignees.map(a => ({
      name: a,
      tasks: applyColumnOrder(sortByPriority(activeTasks.filter(t => (getEffectiveAssignee(t) || '') === a)), `${project.id}:${a}`, columnOrder),
    }));

    const unassignedTasks = applyColumnOrder(sortByPriority(activeTasks.filter(t => !getEffectiveAssignee(t))), `${project.id}:__todo__`, columnOrder);

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
              showAddForm={addingToColumn === col.name}
              onToggleAddForm={() => setAddingToColumn(addingToColumn === col.name ? null : col.name)}
              onAddTask={handleAddTask}
              dueDates={dueDates}
              onSetDueDate={onSetDueDate}
              onEdit={handleEdit}
              onReorder={handleReorder(col.name)}
              onSubtaskToggle={onSubtaskToggle}
              onSubtaskAdd={onSubtaskAdd}
            />
          ))}
          {(unassignedTasks.length > 0 || addingToColumn === '__general__') && (
            <TaskColumn
              title="General" tasks={unassignedTasks}
              accentColor="#94a3b8" dotColor="#94a3b8"
              emptyText="No general tasks" completedIds={completedIds}
              onToggle={onToggle} project={project}
              columnId="__todo__" onDrop={handleDrop}
              showAddForm={addingToColumn === '__general__'}
              onToggleAddForm={() => setAddingToColumn(addingToColumn === '__general__' ? null : '__general__')}
              onAddTask={handleAddTask}
              dueDates={dueDates}
              onSetDueDate={onSetDueDate}
              onEdit={handleEdit}
              onReorder={handleReorder('__todo__')}
              onSubtaskToggle={onSubtaskToggle}
              onSubtaskAdd={onSubtaskAdd}
            />
          )}
          <TaskColumn
            title="Done" tasks={doneTasks}
            accentColor="#4ade80" dotColor="#4ade80"
            emptyText="Nothing completed yet" completedIds={completedIds}
            onToggle={onToggle} project={project}
            columnId="__done__" onDrop={handleDrop}
            dueDates={dueDates}
            onSetDueDate={onSetDueDate}
            onEdit={handleEdit}
            onReorder={handleReorder('__done__')}
            onSubtaskToggle={onSubtaskToggle}
            onSubtaskAdd={onSubtaskAdd}
          />
        </div>
        {editingTask && (
          <EditCardModal task={editingTask} onSave={handleSaveEdit} onClose={() => setEditingTask(null)} />
        )}
      </div>
    );
  }

  // Standard three-column: To Do, Up Next, Done
  const editedTasks = applyEdits(allTasks, taskEditsFromParent);
  const todoTasks = applyColumnOrder(sortByPriority(editedTasks.filter(t => getEffectiveColumn(t) === 'todo')), `${project.id}:__todo__`, columnOrder);
  const upnextTasks = applyColumnOrder(sortByPriority(editedTasks.filter(t => getEffectiveColumn(t) === 'upnext')), `${project.id}:__upnext__`, columnOrder);
  const doneTasks = applyColumnOrder(editedTasks.filter(t => getEffectiveColumn(t) === 'done'), `${project.id}:__done__`, columnOrder);

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
          showAddForm={addingToColumn === '__todo__'}
          onToggleAddForm={() => setAddingToColumn(addingToColumn === '__todo__' ? null : '__todo__')}
          onAddTask={handleAddTask}
          dueDates={dueDates}
          onSetDueDate={onSetDueDate}
          onEdit={handleEdit}
          onReorder={handleReorder('__todo__')}
          onSubtaskToggle={onSubtaskToggle}
          onSubtaskAdd={onSubtaskAdd}
        />
        <TaskColumn
          title="Up Next" tasks={upnextTasks}
          accentColor="#60a5fa" dotColor="#60a5fa"
          emptyText="Nothing queued" completedIds={completedIds}
          onToggle={onToggle} project={project}
          columnId="__upnext__" onDrop={handleDrop}
          showAddForm={addingToColumn === '__upnext__'}
          onToggleAddForm={() => setAddingToColumn(addingToColumn === '__upnext__' ? null : '__upnext__')}
          onAddTask={handleAddTask}
          dueDates={dueDates}
          onSetDueDate={onSetDueDate}
          onEdit={handleEdit}
          onReorder={handleReorder('__upnext__')}
          onSubtaskToggle={onSubtaskToggle}
          onSubtaskAdd={onSubtaskAdd}
        />
        <TaskColumn
          title="Done" tasks={doneTasks}
          accentColor="#4ade80" dotColor="#4ade80"
          emptyText="Nothing completed yet" completedIds={completedIds}
          onToggle={onToggle} project={project}
          columnId="__done__" onDrop={handleDrop}
          dueDates={dueDates}
          onSetDueDate={onSetDueDate}
          onEdit={handleEdit}
          onReorder={handleReorder('__done__')}
          onSubtaskToggle={onSubtaskToggle}
          onSubtaskAdd={onSubtaskAdd}
        />
      </div>
      {editingTask && (
        <EditCardModal task={editingTask} onSave={handleSaveEdit} onClose={() => setEditingTask(null)} />
      )}
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
      backgroundColor: '#0a2233',
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
                  fontSize: '10px', backgroundColor: '#163344', color: '#94a3b8',
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

function GeneralTodosSection({ todos, completedIds, onToggle, userTasks, onAddUserTask }) {
  const todoList = [...(todos || []), ...(userTasks || []).filter(t => !t._projectId)];
  const activeTodos = todoList.filter(t => !completedIds.includes(t.id));
  const doneTodos = todoList.filter(t => completedIds.includes(t.id));
  const [showAdd, setShowAdd] = useState(false);

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
          backgroundColor: '#163344',
          padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
        }}>{activeTodos.length}</span>
        <AddButton onClick={() => setShowAdd(!showAdd)} color="#60a5fa" />
      </div>
      {showAdd && (
        <div style={{ marginBottom: '12px', maxWidth: '400px' }}>
          <AddTaskForm
            projectId={null}
            column="__todo__"
            accentColor="#60a5fa"
            onAdd={(task) => { onAddUserTask({ ...task, _projectId: null }); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}
      {todoList.length === 0 && !showAdd ? (
        <div style={{
          backgroundColor: '#163344', borderRadius: '10px',
          border: '1px solid #1e4258', padding: '24px',
          textAlign: 'center', fontSize: '13px', color: '#475569',
          fontStyle: 'italic',
        }}>
          No general to-dos yet
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ─── Potential Ideas Cards (Feature 1) ──────────────────────────────

function PotentialIdeaCard({ biz, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        backgroundColor: '#163344',
        borderRadius: '12px',
        border: '1px solid #1e4258',
        padding: '24px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#f59e0b';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e4258';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '3px', backgroundColor: '#f59e0b',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: expanded ? '12px' : '0' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          backgroundColor: '#f59e0b20', color: '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 700, flexShrink: 0,
        }}>
          {biz.icon || '\u2728'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
            {biz.title}
          </div>
          {biz.idea && !expanded && (
            <div style={{
              fontSize: '12px', color: '#64748b', marginTop: '2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {biz.idea}
            </div>
          )}
        </div>
        <span style={{
          fontSize: '14px', color: '#475569',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block', flexShrink: 0,
        }}>{'\u25BC'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #1e4258', paddingTop: '12px' }}>
          {biz.idea && (
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '8px' }}>
              {biz.idea}
            </div>
          )}
          {biz.notes && (
            <div style={{
              padding: '12px', backgroundColor: '#0a2233', borderRadius: '8px',
              fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {biz.notes}
            </div>
          )}
          {biz.tags && biz.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {biz.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 8px', borderRadius: '4px',
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: '#f59e0b20', color: '#f59e0b',
                }}>{tag}</span>
              ))}
            </div>
          )}
          {!biz.notes && !biz.idea && (
            <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
              No details yet
            </div>
          )}
          {onDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(biz.id); }}
                style={{
                  background: 'none', border: '1px solid #334155', borderRadius: '4px',
                  color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: '2px 8px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#64748b'; }}
              >Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PotentialIdeasSection({ businesses }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newIdea, setNewIdea] = useState('');

  const handleAddIdea = () => {
    if (!newTitle.trim()) return;
    const idea = {
      id: 'idea-' + Date.now().toString(36),
      title: newTitle.trim(),
      idea: newIdea.trim() || undefined,
      tags: [],
      createdAt: new Date().toISOString(),
    };
    // Sync to server (persists to status.json)
    fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...idea }),
    }).catch(() => {});
    setNewTitle('');
    setNewIdea('');
    setShowAddForm(false);
    window.dispatchEvent(new Event('ideas-updated'));
  };

  const allIdeas = businesses || [];

  // Migrate localStorage ideas to server (one-time)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localIdeas = JSON.parse(localStorage.getItem('cc_potential_ideas') || '[]');
    if (localIdeas.length === 0) return;
    // Sync each local idea to server, then clear localStorage
    Promise.all(localIdeas.map(idea =>
      fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...idea }),
      }).catch(() => {})
    )).then(() => {
      localStorage.removeItem('cc_potential_ideas');
    });
  }, []);

  const handleDeleteIdea = (id) => {
    fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => {});
    window.dispatchEvent(new Event('ideas-updated'));
  };

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Overview card — like a project card */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          backgroundColor: '#163344',
          borderRadius: '12px',
          border: '1px solid #1e4258',
          padding: '24px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, transform 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#f59e0b';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#1e4258';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '3px', backgroundColor: '#f59e0b',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: expanded ? '16px' : '0' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            backgroundColor: '#f59e0b20', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, flexShrink: 0,
          }}>{'\u2728'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
              Potential Ideas
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {allIdeas.length} idea{allIdeas.length !== 1 ? 's' : ''} — click to {expanded ? 'collapse' : 'expand'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '24px', fontWeight: 700, color: '#f59e0b',
            }}>{allIdeas.length}</span>
            <span style={{
              fontSize: '14px', color: '#475569',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>{'\u25BC'}</span>
          </div>
        </div>

        {expanded && (
          <div onClick={e => e.stopPropagation()}>
            {/* Add idea button */}
            <div style={{ marginBottom: '16px' }}>
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    background: 'none', border: '1px dashed #f59e0b40',
                    borderRadius: '8px', padding: '10px', width: '100%',
                    color: '#f59e0b', cursor: 'pointer', fontSize: '13px',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#f59e0b40'}
                >+ Add Idea</button>
              ) : (
                <div style={{
                  backgroundColor: '#0a2233', borderRadius: '8px', padding: '12px',
                  border: '1px solid #f59e0b40',
                }}>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Idea title..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      backgroundColor: '#163344', border: '1px solid #334155',
                      borderRadius: '6px', padding: '8px',
                      color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
                      outline: 'none', marginBottom: '6px',
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') setShowAddForm(false); if (e.key === 'Enter' && newTitle.trim()) handleAddIdea(); }}
                  />
                  <textarea
                    value={newIdea}
                    onChange={e => setNewIdea(e.target.value)}
                    placeholder="Brief description (optional)..."
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      backgroundColor: '#163344', border: '1px solid #334155',
                      borderRadius: '6px', padding: '8px',
                      color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit',
                      outline: 'none', resize: 'vertical', marginBottom: '8px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowAddForm(false)} style={{
                      background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '4px 8px',
                    }}>Cancel</button>
                    <button onClick={handleAddIdea} disabled={!newTitle.trim()} style={{
                      backgroundColor: newTitle.trim() ? '#f59e0b' : '#334155',
                      color: newTitle.trim() ? '#fff' : '#64748b',
                      border: 'none', borderRadius: '6px', padding: '4px 12px',
                      fontSize: '12px', fontWeight: 600, cursor: newTitle.trim() ? 'pointer' : 'default',
                    }}>Add</button>
                  </div>
                </div>
              )}
            </div>

            {/* Ideas grid */}
            {allIdeas.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px',
              }}>
                {allIdeas.map(biz => (
                  <PotentialIdeaCard key={biz.id} biz={biz} onDelete={handleDeleteIdea} />
                ))}
              </div>
            ) : (
              <div style={{
                padding: '20px', textAlign: 'center', fontSize: '13px',
                color: '#475569', fontStyle: 'italic',
              }}>
                No ideas yet — add your first one above
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Today's Plan Section ──────────────────────────────────────────────

// localStorage helpers for today's tasks
function getTodayKey() {
  const d = new Date();
  return `cc_today_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTodayTasks() {
  try { return JSON.parse(localStorage.getItem(getTodayKey()) || '[]'); } catch { return []; }
}
function saveTodayTasks(tasks) {
  localStorage.setItem(getTodayKey(), JSON.stringify(tasks));
}
function getTodayCompletedIds() {
  try { return JSON.parse(localStorage.getItem(getTodayKey() + '_done') || '[]'); } catch { return []; }
}
function saveTodayCompletedIds(ids) {
  localStorage.setItem(getTodayKey() + '_done', JSON.stringify(ids));
}

function TodaySection({ projects, completedIds: globalCompletedIds, dragOverrides, serverTodayTasks }) {
  const [todayTasks, setTodayTasks] = useState(() => getTodayTasks());
  const [todayDone, setTodayDone] = useState(() => getTodayCompletedIds());

  const activeProjects = (projects || []).filter(p => p.status === 'active');
  const projectMap = {};
  activeProjects.forEach(p => { projectMap[p.id] = p; });

  // Check effective column for a task (respects drag overrides + completions)
  const getEffCol = (task, project) => {
    const override = dragOverrides[task.id];
    if (override === '__done__') return 'done';
    if (override === '__upnext__') return 'upnext';
    if (override === '__todo__') return 'todo';
    if (globalCompletedIds.includes(task.id)) return 'done';
    if (((project.tasks || {}).done || []).some(d => d.id === task.id)) return 'done';
    if (((project.tasks || {}).upnext || []).some(d => d.id === task.id)) return 'upnext';
    return 'todo';
  };

  // Get available (non-done) tasks from a project, prioritized
  const getAvailableTasks = (project) => {
    const t = project.tasks || {};
    const all = [...(t.upnext || []), ...(t.in_progress || []), ...(t.todo || [])];
    return all.filter(task => getEffCol(task, project) !== 'done');
  };

  // Load from server todayTasks if localStorage is empty
  useEffect(() => {
    if (todayTasks.length > 0) return;
    // Try server-side todayTasks first (populated by 8 AM cron)
    if (serverTodayTasks && serverTodayTasks.tasks && serverTodayTasks.tasks.length > 0) {
      // Check if it's for today
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      if (serverTodayTasks.date === todayStr) {
        setTodayTasks(serverTodayTasks.tasks);
        saveTodayTasks(serverTodayTasks.tasks);
        return;
      }
    }
    // Fallback: auto-populate from project tasks
    const weights = {
      'epiphany-made': 40,
      'juniform': 25,
      'spotlight-ai': 20,
      'bigbang': 5,
      'iluy': 5,
      'raffle-builder': 5,
    };
    const planned = [];
    activeProjects.forEach(p => {
      const weight = weights[p.id] || 5;
      const available = getAvailableTasks(p);
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
    if (planned.length > 0) {
      setTodayTasks(planned);
      saveTodayTasks(planned);
    }
  }, []);

  const toggleTodayDone = (taskId) => {
    setTodayDone(prev => {
      const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
      saveTodayCompletedIds(next);
      return next;
    });
  };

  const removeFromToday = (taskId) => {
    setTodayTasks(prev => {
      const next = prev.filter(t => t.taskId !== taskId);
      saveTodayTasks(next);
      return next;
    });
  };

  // Group tasks by project
  const grouped = {};
  todayTasks.forEach(t => {
    if (!grouped[t.projectId]) grouped[t.projectId] = [];
    grouped[t.projectId].push(t);
  });

  const doneCount = todayTasks.filter(t => todayDone.includes(t.taskId)).length;
  const totalCount = todayTasks.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      {/* Header card */}
      <div style={{
        backgroundColor: '#163344', borderRadius: '12px', border: '1px solid #1e4258',
        padding: '24px', marginBottom: '20px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '3px', backgroundColor: '#60a5fa',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '20px', color: '#f8fafc' }}>
              Today&apos;s Plan
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              {todayStr}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: progressPct === 100 ? '#4ade80' : '#60a5fa' }}>
              {doneCount}/{totalCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              completed
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{
          height: '8px', borderRadius: '4px', backgroundColor: '#0a2233', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            backgroundColor: progressPct === 100 ? '#4ade80' : '#60a5fa',
            width: `${progressPct}%`,
            transition: 'width 0.3s, background-color 0.3s',
          }} />
        </div>
        {progressPct === 100 && totalCount > 0 && (
          <div style={{ marginTop: '12px', fontSize: '14px', color: '#4ade80', fontWeight: 600 }}>
            All done for today!
          </div>
        )}
      </div>

      {/* Tasks grouped by project */}
      {totalCount === 0 ? (
        <div style={{
          backgroundColor: '#163344', borderRadius: '12px', border: '1px solid #1e4258',
          padding: '40px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{'\u{1F4C5}'}</div>
          <div style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
            No tasks scheduled for today
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Tasks are populated at 8 AM each workday (Sun–Thu)
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(grouped).map(([projectId, tasks]) => {
            const project = projectMap[projectId];
            if (!project) return null;
            const projectDone = tasks.filter(t => todayDone.includes(t.taskId)).length;
            return (
              <div key={projectId} style={{
                backgroundColor: '#163344', borderRadius: '12px', border: '1px solid #1e4258',
                overflow: 'hidden',
              }}>
                {/* Project header */}
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid #1e4258',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  borderLeft: `4px solid ${project.color}`,
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    backgroundColor: project.color + '20', color: project.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, flexShrink: 0,
                  }}>{project.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{project.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{project.description}</div>
                  </div>
                  <div style={{
                    fontSize: '12px', fontWeight: 600,
                    color: projectDone === tasks.length ? '#4ade80' : '#94a3b8',
                  }}>
                    {projectDone}/{tasks.length}
                  </div>
                </div>
                {/* Task list */}
                <div style={{ padding: '8px 12px' }}>
                  {tasks.map(task => {
                    const isDone = todayDone.includes(task.taskId);
                    const priorityColors = { high: '#f87171', medium: '#f59e0b', low: '#94a3b8' };
                    return (
                      <div key={task.taskId} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 8px', borderRadius: '8px',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0a2233'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {/* Checkbox */}
                        <div
                          onClick={() => toggleTodayDone(task.taskId)}
                          style={{
                            width: '20px', height: '20px', borderRadius: '6px',
                            border: `2px solid ${isDone ? '#4ade80' : '#475569'}`,
                            backgroundColor: isDone ? '#4ade8020' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                          }}
                        >
                          {isDone && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                        {/* Task title */}
                        <div style={{
                          flex: 1, fontSize: '13px', fontWeight: 500,
                          color: isDone ? '#64748b' : '#f8fafc',
                          textDecoration: isDone ? 'line-through' : 'none',
                          transition: 'color 0.15s',
                        }}>
                          {task.title}
                        </div>
                        {/* Priority dot */}
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: priorityColors[task.priority] || '#94a3b8',
                          flexShrink: 0,
                        }} title={task.priority} />
                        {/* Remove button */}
                        <div
                          onClick={(e) => { e.stopPropagation(); removeFromToday(task.taskId); }}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#475569', fontSize: '14px',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                          title="Remove from today"
                        >{'\u00D7'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ariel Sidebar (Feature 4) ──────────────────────────────────────

function ArielSidebar({ isOpen, onToggle }) {
  const [cronJobs, setCronJobs] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    // Load change requests from localStorage
    try {
      setChangeRequests(JSON.parse(localStorage.getItem('cc_change_requests') || '[]'));
    } catch { setChangeRequests([]); }
    // Load reminders from localStorage
    try {
      setReminders(JSON.parse(localStorage.getItem('cc_reminders') || '[]'));
    } catch { setReminders([]); }
    // Cron jobs are static/known
    setCronJobs([
      { id: 'heartbeat', name: 'Heartbeat Check', schedule: 'Every 30m', status: 'active' },
      { id: 'email-poll', name: 'Email Polling', schedule: 'Every 30m', status: 'active' },
      { id: 'memory-flush', name: 'Memory Flush', schedule: 'On compaction', status: 'active' },
    ]);
  }, [isOpen]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed', right: isOpen ? 'min(340px, 90vw)' : '0', top: '50%',
          transform: 'translateY(-50%)',
          width: '32px', height: '64px',
          backgroundColor: '#163344', border: '1px solid #1e4258',
          borderRight: isOpen ? 'none' : '1px solid #1e4258',
          borderLeft: isOpen ? '1px solid #1e4258' : 'none',
          borderRadius: '8px 0 0 8px',
          color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', zIndex: 102,
          transition: 'right 0.2s',
        }}
        title="Ariel Panel"
      >
        {isOpen ? '\u25B6' : '\uD83E\uDD81'}
      </button>

      {/* Sidebar panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 'min(340px, 90vw)', backgroundColor: '#0f2233',
        borderLeft: '1px solid #1e4258',
        zIndex: 101, transition: 'transform 0.2s',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        overflowY: 'auto', padding: '24px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <span style={{ fontSize: '24px' }}>{'\uD83E\uDD81'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>Ariel</div>
            <div style={{ fontSize: '11px', color: '#4ade80' }}>Online</div>
          </div>
        </div>

        {/* Cron Jobs */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px',
          }}>Scheduled Jobs</div>
          {cronJobs.map(job => (
            <div key={job.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', backgroundColor: '#163344', borderRadius: '8px',
              marginBottom: '6px',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: job.status === 'active' ? '#4ade80' : '#f87171',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{job.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{job.schedule}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pending Reminders */}
        {reminders.filter(r => r.status === 'pending').length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px',
            }}>Pending Reminders</div>
            {reminders.filter(r => r.status === 'pending').map(r => (
              <div key={r.id} style={{
                padding: '10px', backgroundColor: '#163344', borderRadius: '8px',
                marginBottom: '6px', borderLeft: '3px solid #f59e0b',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{r.taskTitle}</div>
                <div style={{ fontSize: '11px', color: '#f59e0b' }}>
                  {new Date(r.datetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Change Requests — only show pending */}
        {changeRequests.filter(cr => cr.status === 'pending').length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px',
            }}>Change Requests</div>
            {changeRequests.filter(cr => cr.status === 'pending').map(cr => (
              <div key={cr.id} style={{
                padding: '10px', backgroundColor: '#163344', borderRadius: '8px',
                marginBottom: '6px', borderLeft: '3px solid #8b5cf6',
              }}>
                <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: 1.4 }}>{cr.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#475569' }}>
                    pending &middot; {timeAgo(cr.createdAt)}
                  </div>
                  <button
                    onClick={() => {
                      const updated = changeRequests.map(r => r.id === cr.id ? { ...r, status: 'cancelled' } : r);
                      setChangeRequests(updated);
                      localStorage.setItem('cc_change_requests', JSON.stringify(updated));
                      fetch('/api/change-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'cancel', id: cr.id }),
                      }).catch(() => {});
                    }}
                    style={{
                      background: 'none', border: '1px solid #334155', borderRadius: '4px',
                      color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: '2px 6px',
                    }}
                  >Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status */}
        <div style={{
          padding: '12px', backgroundColor: '#163344', borderRadius: '8px',
          fontSize: '12px', color: '#64748b', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>System</div>
          <div>Model: Claude Opus 4.6</div>
          <div>Host: Clawdbot</div>
          <div>Channel: Google Chat</div>
        </div>
      </div>
    </>
  );
}

// ─── Main App ───────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [error, setError] = useState(null);
  const [completedIds, setCompletedIds] = useState([]);
  const [dragOverrides, setDragOverrides] = useState({});
  const [userTasks, setUserTasks] = useState([]);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dueDates, setDueDates] = useState({});
  const [columnOrder, setColumnOrder] = useState({});
  const [taskEdits, setTaskEdits] = useState({});
  const [activeSection, setActiveSection] = useState('projects');

  useEffect(() => {
    setCompletedIds(getCompletedIds());
    setDragOverrides(getDragOverrides());
    setUserTasks(getUserTasks());
    try { setDueDates(JSON.parse(localStorage.getItem('cc_due_dates') || '{}')); } catch { setDueDates({}); }
    setColumnOrder(getColumnOrder());
    try { setTaskEdits(JSON.parse(localStorage.getItem('cc_task_edits') || '{}')); } catch { setTaskEdits({}); }
  }, []);

  const setDueDate = useCallback((taskId, date) => {
    setDueDates(prev => {
      const next = { ...prev };
      if (date) next[taskId] = date;
      else delete next[taskId];
      localStorage.setItem('cc_due_dates', JSON.stringify(next));
      return next;
    });
  }, []);

  const addUserTask = useCallback((task) => {
    setUserTasks(prev => {
      const next = [...prev, task];
      saveUserTasks(next);
      return next;
    });
  }, []);

  const syncToServer = useCallback((payload) => {
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  const findProjectForTask = useCallback((taskId) => {
    if (!data?.projects) return null;
    for (const p of data.projects) {
      const t = p.tasks || {};
      for (const col of ['todo', 'upnext', 'in_progress', 'done']) {
        if ((t[col] || []).some(task => task.id === taskId)) return p.id;
      }
    }
    return null;
  }, [data]);

  const toggleTask = useCallback((taskId) => {
    const wasCompleted = getCompletedIds().includes(taskId);
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
    const projectId = findProjectForTask(taskId);
    if (projectId) {
      syncToServer({ action: 'complete', taskId, projectId, completed: !wasCompleted });
    }
  }, [findProjectForTask, syncToServer]);

  const handleDragDrop = useCallback((taskId, targetColumnId, projectId, insertBeforeId) => {
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
      const newCompleted = getCompletedIds().filter(id => id !== taskId);
      localStorage.setItem('cc_done', JSON.stringify(newCompleted));
      setCompletedIds(newCompleted);
      const newOverrides = { ...getDragOverrides(), [taskId]: targetColumnId };
      saveDragOverrides(newOverrides);
      setDragOverrides(newOverrides);
    }
    const pid = projectId || findProjectForTask(taskId);
    if (pid) {
      syncToServer({ action: 'move', taskId, projectId: pid, targetColumn: targetColumnId });
    }
    // If a specific drop position was requested, reorder within the column
    if (insertBeforeId && pid) {
      setColumnOrder(prev => {
        const key = `${pid}:${targetColumnId}`;
        const currentOrder = prev[key] || [];
        const filtered = currentOrder.filter(id => id !== taskId);
        const targetIdx = filtered.indexOf(insertBeforeId);
        if (targetIdx >= 0) {
          filtered.splice(targetIdx, 0, taskId);
        } else {
          filtered.push(taskId);
        }
        const next = { ...prev, [key]: filtered };
        saveColumnOrder(next);
        return next;
      });
    }
  }, [findProjectForTask, syncToServer]);

  const editTask = useCallback((updatedTask) => {
    setTaskEdits(prev => {
      const next = { ...prev, [updatedTask.id]: updatedTask };
      localStorage.setItem('cc_task_edits', JSON.stringify(next));
      return next;
    });
    // Also update user tasks if it's a user-added task
    setUserTasks(prev => {
      const idx = prev.findIndex(t => t.id === updatedTask.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updatedTask };
        saveUserTasks(next);
        return next;
      }
      return prev;
    });
    // Sync edits to server (persists to status.json via GitHub)
    const projectId = findProjectForTask(updatedTask.id);
    syncToServer({
      action: 'edit',
      taskId: updatedTask.id,
      projectId: projectId || updatedTask._projectId || null,
      updates: {
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        tags: updatedTask.tags,
        dueDate: updatedTask.dueDate,
      },
    });
  }, [findProjectForTask, syncToServer]);

  // Helper to find a task within a project (client-side)
  const findTaskInProjectLocal = useCallback((project, taskId) => {
    const t = project.tasks || {};
    for (const col of ['todo', 'upnext', 'in_progress', 'done']) {
      const found = (t[col] || []).find(task => task.id === taskId);
      if (found) return found;
    }
    return null;
  }, []);

  // ─── Subtask handlers ──────────────────────────────────────────────
  const handleSubtaskToggle = useCallback((taskId, subtaskId) => {
    // Update local state (taskEdits) to toggle subtask done status
    setTaskEdits(prev => {
      const existing = prev[taskId] || {};
      const currentSubtasks = existing.subtasks || (data?.projects?.reduce((found, p) => {
        if (found) return found;
        const t = findTaskInProjectLocal(p, taskId);
        return t?.subtasks;
      }, null)) || [];
      const updatedSubtasks = currentSubtasks.map(s =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      );
      const next = { ...prev, [taskId]: { ...existing, subtasks: updatedSubtasks } };
      localStorage.setItem('cc_task_edits', JSON.stringify(next));
      return next;
    });
    // Sync to server
    const projectId = findProjectForTask(taskId);
    syncToServer({ action: 'subtask', taskId, projectId, subtaskAction: 'toggle', subtaskId });
  }, [data, findProjectForTask, syncToServer]);

  const handleSubtaskAdd = useCallback((taskId, title) => {
    const newSubtask = { id: 'st-' + Date.now().toString(36), title, done: false };
    setTaskEdits(prev => {
      const existing = prev[taskId] || {};
      const currentSubtasks = existing.subtasks || (data?.projects?.reduce((found, p) => {
        if (found) return found;
        const t = findTaskInProjectLocal(p, taskId);
        return t?.subtasks;
      }, null)) || [];
      const updatedSubtasks = [...currentSubtasks, newSubtask];
      const next = { ...prev, [taskId]: { ...existing, subtasks: updatedSubtasks } };
      localStorage.setItem('cc_task_edits', JSON.stringify(next));
      return next;
    });
    // Sync to server
    const projectId = findProjectForTask(taskId);
    syncToServer({ action: 'subtask', taskId, projectId, subtaskAction: 'add', subtask: newSubtask });
  }, [data, findProjectForTask, syncToServer]);

  const reorderInColumn = useCallback((projectId, columnId, draggedId, targetId) => {
    setColumnOrder(prev => {
      const key = `${projectId}:${columnId}`;
      const currentOrder = prev[key] || [];
      // Remove draggedId from current position, insert before targetId
      const filtered = currentOrder.filter(id => id !== draggedId);
      const targetIdx = filtered.indexOf(targetId);
      if (targetIdx >= 0) {
        filtered.splice(targetIdx, 0, draggedId);
      } else {
        filtered.push(draggedId);
      }
      const next = { ...prev, [key]: filtered };
      saveColumnOrder(next);
      return next;
    });
  }, []);

  // Navigation from search
  const handleSearchNavigate = useCallback((type, id) => {
    if (type === 'project') {
      setSelectedProject(id);
    }
    // For ideas, just scroll to the section
    if (type === 'ideas') {
      setSelectedProject(null);
      // Small delay to let render happen
      setTimeout(() => {
        const el = document.getElementById('potential-ideas-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/status?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) { setError(e.message); }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#143d4f', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#f87171', padding: '40px', textAlign: 'center' }}>
          Failed to load: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#143d4f', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#64748b', padding: '40px', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  const projects = data.projects || [];
  const todos = data.todos || [];
  const selected = selectedProject ? projects.find(p => p.id === selectedProject) : null;

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
  userTasks.forEach(t => {
    if (completedIds.includes(t.id)) totalDone++;
    else if (t._column === '__upnext__') totalUpnext++;
    else totalTodo++;
  });
  const totalTasks = totalTodo + totalUpnext + totalDone + todos.length;

  const navItems = [
    { id: 'projects', label: 'Current Projects', icon: '\u{1F4CB}' },
    { id: 'ideas', label: 'Potential Ideas', icon: '\u{1F4A1}' },
    { id: 'schedule', label: 'Today', icon: '\u{1F4C5}' },
  ];

  // When selecting a project detail, force projects section
  const handleProjectClick = (projectId) => {
    setSelectedProject(projectId);
    setActiveSection('projects');
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#143d4f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
      display: 'flex',
    }}>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
      `}</style>

      {/* Left Navbar */}
      <nav style={{
        width: '220px',
        minWidth: '220px',
        backgroundColor: '#0f2233',
        borderRight: '1px solid #1e4258',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 16px 24px', borderBottom: '1px solid #1e4258', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#fff',
            }}>CC</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>Command Center</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {projects.length} projects
              </div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: '8px' }}>
          {navItems.map(item => {
            const isActive = activeSection === item.id && !selectedProject;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSelectedProject(null); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#1e4258' : 'transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginBottom: '2px',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#163344'; e.currentTarget.style.color = '#f8fafc'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Bottom info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e4258', fontSize: '11px', color: '#475569' }}>
          {data.lastUpdated && <>Updated {timeAgo(data.lastUpdated)}</>}
        </div>
      </nav>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: '220px',
        padding: '24px',
        marginRight: sidebarOpen ? 'min(340px, 90vw)' : '32px',
        transition: 'margin-right 0.2s',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Top bar with search and actions */}
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #1e4258',
            gap: '16px', flexWrap: 'wrap',
          }}>
            <div style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc' }}>
              {selected ? selected.name : navItems.find(n => n.id === activeSection)?.label}
            </div>

            <OmnisearchBar data={data} onNavigate={(type, id) => {
              if (type === 'project') handleProjectClick(id);
              else if (type === 'ideas') { setActiveSection('ideas'); setSelectedProject(null); }
              else handleSearchNavigate(type, id);
            }} userTasks={userTasks} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
              <button
                onClick={() => setShowChangeRequest(!showChangeRequest)}
                title="Request a change"
                style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  border: '1px solid #1e4258', background: 'none',
                  color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', padding: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e4258'; e.currentTarget.style.color = '#64748b'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </button>
              {showChangeRequest && (
                <ChangeRequestPopout onClose={() => setShowChangeRequest(false)} />
              )}
            </div>
          </header>

          {/* Content based on active section or selected project */}
          {selected ? (
            <ProjectDetailView
              project={selected}
              onBack={() => setSelectedProject(null)}
              completedIds={completedIds}
              onToggle={toggleTask}
              dragOverrides={dragOverrides}
              onDragDrop={handleDragDrop}
              userTasks={userTasks}
              onAddUserTask={addUserTask}
              dueDates={dueDates}
              onSetDueDate={setDueDate}
              onEditTask={editTask}
              columnOrder={columnOrder}
              onReorderInColumn={reorderInColumn}
              taskEdits={taskEdits}
              onSubtaskToggle={handleSubtaskToggle}
              onSubtaskAdd={handleSubtaskAdd}
            />
          ) : activeSection === 'projects' ? (
            <>
              {totalTasks > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'To Do', count: totalTodo, color: '#94a3b8' },
                    { label: 'Up Next', count: totalUpnext, color: '#60a5fa' },
                    { label: 'Done', count: totalDone, color: '#4ade80' },
                  ].map(item => (
                    <div key={item.label} style={{
                      flex: 1, backgroundColor: '#163344',
                      borderRadius: '10px', border: '1px solid #1e4258',
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
                    onClick={() => handleProjectClick(card.project.id)}
                    userTasks={userTasks}
                  />
                ))}
              </div>

              <GeneralTodosSection
                todos={todos}
                completedIds={completedIds}
                onToggle={toggleTask}
                userTasks={userTasks}
                onAddUserTask={addUserTask}
              />
            </>
          ) : activeSection === 'ideas' ? (
            <div id="potential-ideas-section">
              <PotentialIdeasSection
                businesses={data.potentialBusinesses || []}
              />
            </div>
          ) : activeSection === 'schedule' ? (
            <TodaySection projects={projects} completedIds={completedIds} dragOverrides={dragOverrides} serverTodayTasks={data.todayTasks} />
          ) : null}
        </div>
      </div>

      {/* Feature 4: Ariel Sidebar */}
      <ArielSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
    </div>
  );
}
