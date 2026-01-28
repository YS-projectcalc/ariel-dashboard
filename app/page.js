'use client';

import { useState, useEffect } from 'react';

// Initial data - this will be replaced with fetch from status.json
const initialData = {
  lastUpdated: new Date().toISOString(),
  columns: {
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
        { id: "p2", title: "Build Kanban dashboard", description: "This dashboard you're looking at", started: "2026-01-28T22:20:00Z" },
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
      tasks: [
        { id: "d1", title: "Rebuilt brand-assets skill", description: "Elite version with dropship/infoproduct split", completed: "2026-01-28T19:30:00Z" },
        { id: "d2", title: "Deep research: Nano Banana vs Ideogram", description: "Compared image gen options", completed: "2026-01-28T20:00:00Z" },
        { id: "d3", title: "Skills capability assessment", description: "Analyzed all 4 skills honestly", completed: "2026-01-28T19:45:00Z" },
      ]
    }
  }
};

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
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

export default function Home() {
  const [data, setData] = useState(initialData);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = () => {
    setLastRefresh(new Date());
    // In production, this would fetch from status.json
  };

  useEffect(() => {
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
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '16px',
      }}>
        {Object.entries(data.columns).map(([key, column]) => (
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
            {data.columns.done.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Completed Today</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
            {data.columns.inProgress.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>In Progress</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
            {data.columns.waiting.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Waiting</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#64748b' }}>
            {data.columns.backlog.tasks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>In Backlog</div>
        </div>
      </div>
    </div>
  );
}
