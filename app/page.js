'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

function ProjectCard({ project }) {
  const backlogCount = project.columns.backlog?.tasks?.length || 0;
  const inProgressCount = project.columns.inProgress?.tasks?.length || 0;
  const doneCount = project.columns.done?.tasks?.length || 0;
  const waitingCount = project.columns.waiting?.tasks?.length || 0;
  
  return (
    <Link href={`/project/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        borderLeft: `4px solid ${project.color}`,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{project.name}</h3>
        <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '14px' }}>{project.description}</p>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <span style={{ color: '#64748b' }}>📋 {backlogCount}</span>
          <span style={{ color: '#3b82f6' }}>🔨 {inProgressCount}</span>
          <span style={{ color: '#f59e0b' }}>⏳ {waitingCount}</span>
          <span style={{ color: '#22c55e' }}>✅ {doneCount}</span>
        </div>
      </div>
    </Link>
  );
}

function TaskCard({ task, color }) {
  return (
    <div style={{
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      padding: '10px',
      marginBottom: '6px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{task.title}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{task.description}</div>
    </div>
  );
}

function MiniColumn({ title, color, tasks }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '10px',
      padding: '12px',
      minWidth: '200px',
      flex: '1',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: `2px solid ${color}`,
      }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{title}</span>
        <span style={{
          backgroundColor: color,
          color: 'white',
          borderRadius: '10px',
          padding: '1px 8px',
          fontSize: '11px',
          fontWeight: 600,
        }}>{tasks.length}</span>
      </div>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} color={color} />
        ))}
        {tasks.length === 0 && (
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '12px',
      borderLeft: '3px solid #a855f7',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{idea.title}</div>
      <div style={{ fontSize: '13px', color: '#94a3b8' }}>{idea.description}</div>
    </div>
  );
}

function ActivityItem({ activity }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '10px 0',
      borderBottom: '1px solid #334155',
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
        <div style={{ fontWeight: 600, fontSize: '14px' }}>{activity.title}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{activity.description}</div>
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
        {timeAgo(activity.completed)}
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState({ projects: [], globalIdeas: [], globalActivityLog: [] });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(true);

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
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate stats
  const totalInProgress = data.projects?.reduce((sum, p) => 
    sum + (p.columns.inProgress?.tasks?.length || 0), 0) || 0;
  const totalDone = data.projects?.reduce((sum, p) => 
    sum + (p.columns.done?.tasks?.length || 0), 0) || 0;
  const totalBacklog = data.projects?.reduce((sum, p) => 
    sum + (p.columns.backlog?.tasks?.length || 0), 0) || 0;

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
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
          }}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '32px',
        padding: '16px 24px',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{totalInProgress}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>In Progress</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{totalDone}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Done</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#64748b' }}>{totalBacklog}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Backlog</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#a855f7' }}>{data.projects?.length || 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Projects</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left: Projects */}
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#94a3b8' }}>Projects</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.projects?.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {(!data.projects || data.projects.length === 0) && (
              <div style={{ color: '#64748b', padding: '20px', textAlign: 'center' }}>
                No projects yet
              </div>
            )}
          </div>
        </div>

        {/* Right: Ideas & Recent Activity */}
        <div>
          {/* Ideas */}
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#94a3b8' }}>
            💡 Ideas ({data.globalIdeas?.length || 0})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {data.globalIdeas?.map(idea => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
            {(!data.globalIdeas || data.globalIdeas.length === 0) && (
              <div style={{ color: '#64748b', fontSize: '14px' }}>No ideas yet</div>
            )}
          </div>

          {/* Recent Activity */}
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#94a3b8' }}>
            📜 Recent Activity
          </h2>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '12px 16px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            {data.globalActivityLog?.map(activity => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
            {(!data.globalActivityLog || data.globalActivityLog.length === 0) && (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* General / Miscellaneous Board */}
      {data.general && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#94a3b8' }}>
            🗂️ General / Miscellaneous
          </h2>
          <div style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}>
            {['backlog', 'inProgress', 'waiting', 'done'].map(key => {
              const column = data.general[key];
              if (!column) return null;
              return (
                <MiniColumn
                  key={key}
                  title={column.title}
                  color={column.color}
                  tasks={column.tasks || []}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
