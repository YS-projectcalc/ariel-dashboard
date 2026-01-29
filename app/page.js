'use client';

import { useState, useEffect } from 'react';

// Helper to check if a date is today
function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// Initial data - this will be replaced with fetch from status.json
const initialData = {
  lastUpdated: new Date().toISOString(),
  columns: {
    ideas: {
      title: "💡 Ideas",
      color: "#a855f7",
      tasks: [
        { id: "i1", title: "SEO → AEO product duplication", description: "Find successful SEO-driven sites (calculators, tools), replicate them, optimize for AI citations (AEO)", created: "2026-01-28" },
      ]
    },
    backlog: {
      title: "📋 Backlog",
      color: "#64748b",
      tasks: [
        { id: "b1", title: "Build supplier-sourcing skill", description: "Find suppliers for dropship products", created: "2026-01-28" },
        { id: "b2", title: "Build legal-templates skill", description: "Terms, privacy, disclaimers", created: "2026-01-28" },
        { id: "b3", title: "Build traffic-ads skill", description: "Paid traffic and ad creative", created: "2026-01-28" },
      ]
    },
    inProgress: {
      title: "🔨 In Progress",
      color: "#3b82f6",
      tasks: [
        { id: "p1", title: "Build infoproduct-creation skill", description: "Generic framework for ebook + Skool", started: "2026-01-28T22:15:00Z" },
        { id: "p2", title: "Dashboard improvements", description: "Reset daily, add activity log", started: "2026-01-29T11:00:00Z" },
      ]
    },
    waiting: {
      title: "⏳ Waiting on Yaakov",
      color: "#f59e0b",
      tasks: [
        { id: "w1", title: "Image generation APIs", description: "Need Nano Banana Pro + Ideogram API keys", reminder: "2026-01-29T13:00:00Z" },
      ]
    },
    done: {
      title: "✅ Done Today",
      color: "#22c55e",
      tasks: []  // Will be populated by filtering activityLog for today
    }
  },
  // Running log of ALL completed tasks
  activityLog: [
    { id: "d1", title: "Rebuilt brand-assets skill", description: "Elite version with dropship/infoproduct split", completed: "2026-01-28T19:30:00Z" },
    { id: "d2", title: "Deep research: Nano Banana vs Ideogram", description: "Compared image gen options", completed: "2026-01-28T20:00:00Z" },
    { id: "d3", title: "Skills capability assessment", description: "Analyzed all 4 skills honestly", completed: "2026-01-28T19:45:00Z" },
    { id: "d4", title: "Built Kanban dashboard", description: "Initial version of status board", completed: "2026-01-28T22:30:00Z" },
  ]
};

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
  return date.toLocaleDateString();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function TaskCard({ task, color }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{task.title}</div>
      <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>{task.description}</div>
      <div style={{ fontSize: '11px', color: '#64748b' }}>
        {task.completed && `Completed ${timeAgo(task.completed)}`}
        {task.started && `Started ${timeAgo(task.started)}`}
        {task.reminder && `⏰ Reminder: ${new Date(task.reminder).toLocaleString()}`}
        {task.created && !task.started && !task.completed && `Added ${task.created}`}
      </div>
    </div>
  );
}

function Column({ title, color, tasks }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '16px',
      minWidth: '280px',
      maxWidth: '320px',
      flex: '1',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `2px solid ${color}`,
      }}>
        <span style={{ fontWeight: 700, fontSize: '16px' }}>{title}</span>
        <span style={{
          backgroundColor: color,
          color: 'white',
          borderRadius: '12px',
          padding: '2px 10px',
          fontSize: '12px',
          fontWeight: 600,
        }}>{tasks.length}</span>
      </div>
      <div>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} color={color} />
        ))}
        {tasks.length === 0 && (
          <div style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityLog({ activities }) {
  // Sort by completed date, newest first
  const sorted = [...activities].sort((a, b) => 
    new Date(b.completed) - new Date(a.completed)
  );

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '24px',
    }}>
      <h2 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📜 Activity Log
        <span style={{
          backgroundColor: '#64748b',
          color: 'white',
          borderRadius: '12px',
          padding: '2px 10px',
          fontSize: '12px',
          fontWeight: 600,
        }}>{activities.length} total</span>
      </h2>
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        paddingRight: '8px',
      }}>
        {sorted.map((task, i) => (
          <div key={task.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 0',
            borderBottom: i < sorted.length - 1 ? '1px solid #334155' : 'none',
          }}>
            <div style={{
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              width: '8px',
              height: '8px',
              marginTop: '6px',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>{task.title}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{task.description}</div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#64748b',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {formatDate(task.completed)}
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
            No completed tasks yet
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(initialData);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Compute "Done Today" from activity log
  const doneToday = data.activityLog.filter(task => isToday(task.completed));
  
  // Create display data with computed "Done Today"
  const displayData = {
    ...data,
    columns: {
      ...data.columns,
      done: {
        ...data.columns.done,
        tasks: doneToday
      }
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/status.json?t=' + Date.now());
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    refresh(); // Load on mount
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            🦁 Ariel Status Board
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Last updated: {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#64748b' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '16px',
      }}>
        {Object.entries(displayData.columns).map(([key, column]) => (
          <Column
            key={key}
            title={column.title}
            color={column.color}
            tasks={column.tasks}
          />
        ))}
      </div>

      {/* Footer Stats */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-around',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>
            {doneToday.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Completed Today</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
            {displayData.columns.inProgress.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>In Progress</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
            {displayData.columns.waiting.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Waiting</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#64748b' }}>
            {displayData.columns.backlog.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>In Backlog</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#a855f7' }}>
            {displayData.columns.ideas.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Ideas</div>
        </div>
      </div>

      {/* Activity Log */}
      <ActivityLog activities={data.activityLog} />
    </div>
  );
}
