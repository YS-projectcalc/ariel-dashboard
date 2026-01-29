'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function timeAgo(dateString) {
  if (!dateString) return '';
  if (/^\d{1,2}\/\d{1,2}$/.test(dateString)) return dateString;
  
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
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function TaskCard({ task, color }) {
  return (
    <div style={{
      backgroundColor: '#0f172a',
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
        {task.created && !task.started && !task.completed && `Added ${timeAgo(task.created)}`}
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
      minWidth: '260px',
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
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{title}</span>
        <span style={{
          backgroundColor: color,
          color: 'white',
          borderRadius: '12px',
          padding: '2px 10px',
          fontSize: '12px',
          fontWeight: 600,
        }}>{tasks.length}</span>
      </div>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
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
        fontSize: '16px',
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
        }}>{activities.length}</span>
      </h2>
      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
        {sorted.map((task, i) => (
          <div key={task.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '10px 0',
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
              <div style={{ fontWeight: 600, marginBottom: '2px', fontSize: '14px' }}>{task.title}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{task.description}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
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

export default function ProjectPage() {
  const params = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/status.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        const found = data.projects?.find(p => p.id === params.id);
        setProject(found || null);
      }
    } catch (e) {
      console.error('Failed to fetch:', e);
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (loading && !project) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px' }}>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>← Back</Link>
        <div style={{ marginTop: '24px', color: '#64748b' }}>Project not found</div>
      </div>
    );
  }

  // Use columns directly - Done is for major milestones, not computed from activity
  const displayColumns = project.columns;

  // Column order
  const columnOrder = ['backlog', 'inProgress', 'waiting', 'done'];

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
      }}>
        <div>
          <Link href="/" style={{ 
            color: 'white', 
            textDecoration: 'none', 
            fontSize: '14px',
            backgroundColor: '#334155',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'inline-block',
            marginBottom: '12px',
          }}>
            ← Back to Overview
          </Link>
          <h1 style={{ 
            margin: '8px 0 0 0', 
            fontSize: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: project.color,
              display: 'inline-block',
            }} />
            {project.name}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            {project.description}
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
          }}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '24px',
        padding: '12px 20px',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#64748b' }}>
            {project.columns.backlog?.tasks?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Backlog</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
            {project.columns.inProgress?.tasks?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>In Progress</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
            {project.columns.waiting?.tasks?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Waiting</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>
            {project.columns.done?.tasks?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Done</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#94a3b8' }}>
            {project.activityLog?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Activities</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '16px',
      }}>
        {columnOrder.map(key => {
          const column = displayColumns[key];
          if (!column) return null;
          return (
            <Column
              key={key}
              title={column.title}
              color={column.color}
              tasks={column.tasks || []}
            />
          );
        })}
      </div>

      {/* Activity Log */}
      <ActivityLog activities={project.activityLog || []} />
    </div>
  );
}
