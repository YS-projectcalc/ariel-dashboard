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
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Top Navigation Tabs
function TopNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'docs', label: 'Docs', icon: '📄' },
    { id: 'search', label: 'Search', icon: '🔍' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '8px 16px',
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      marginBottom: '24px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#0f172a',
        borderRadius: '6px',
        marginRight: '8px',
      }}>
        <span style={{ fontSize: '20px' }}>🦁</span>
        <span style={{ fontWeight: 700, color: '#f8fafc' }}>Ariel</span>
      </div>
      
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
            color: activeTab === tab.id ? 'white' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// Stats Bar
function StatsBar({ data }) {
  const totalTasks = (data.waitingItems?.length || 0) + (data.approvals?.length || 0);
  const completedTasks = data.projects?.[0]?.activityLog?.length || 0;
  const inProgress = data.waitingItems?.length || 0;
  const completion = totalTasks > 0 ? Math.round((completedTasks / (completedTasks + totalTasks)) * 100) : 0;

  return (
    <div style={{
      display: 'flex',
      gap: '32px',
      marginBottom: '24px',
      padding: '16px 0',
    }}>
      <div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{completedTasks}</span>
        <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>Completed</span>
      </div>
      <div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>{inProgress}</span>
        <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>In Progress</span>
      </div>
      <div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#94a3b8' }}>{totalTasks}</span>
        <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>Total</span>
      </div>
      <div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#8b5cf6' }}>{completion}%</span>
        <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>Completion</span>
      </div>
    </div>
  );
}

// Task Card Component
function TaskCard({ task, color }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      borderLeft: `3px solid ${color || '#3b82f6'}`,
    }}>
      {task.type && (
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '6px',
          textTransform: 'uppercase',
        }}>
          {task.type}
        </div>
      )}
      <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc', marginBottom: '8px' }}>
        {task.title}
      </div>
      {task.description && (
        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
          {task.description}
        </div>
      )}
      {task.image && (
        <a href={task.image} target="_blank" rel="noopener noreferrer">
          <img 
            src={task.image} 
            alt={task.title}
            style={{
              width: '100%',
              marginTop: '12px',
              borderRadius: '6px',
              border: '1px solid #334155',
            }}
          />
        </a>
      )}
      <div style={{ 
        fontSize: '11px', 
        color: '#64748b', 
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>🦁 Ariel</span>
        <span>•</span>
        <span>{timeAgo(task.created || task.updated)}</span>
      </div>
    </div>
  );
}

// Kanban Column
function KanbanColumn({ title, count, tasks, color }) {
  return (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        padding: '8px 0',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
        }} />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{title}</span>
        <span style={{
          backgroundColor: '#334155',
          color: '#94a3b8',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '12px',
        }}>
          {count}
        </span>
      </div>
      
      <div style={{ 
        backgroundColor: '#0f172a', 
        borderRadius: '8px', 
        padding: '12px',
        minHeight: '200px',
      }}>
        {tasks.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '14px', padding: '20px', textAlign: 'center' }}>
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} color={color} />
          ))
        )}
      </div>
    </div>
  );
}

// Activity Feed
function ActivityFeed({ activities }) {
  return (
    <div style={{
      width: '300px',
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      padding: '16px',
      height: 'fit-content',
    }}>
      <div style={{
        fontWeight: 600,
        color: '#f8fafc',
        marginBottom: '16px',
        fontSize: '14px',
      }}>
        ACTIVITY
      </div>
      
      {activities.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '13px' }}>No recent activity</div>
      ) : (
        activities.map((activity, i) => (
          <div key={i} style={{
            padding: '12px 0',
            borderBottom: i < activities.length - 1 ? '1px solid #1e293b' : 'none',
          }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              <span style={{ color: '#8b5cf6' }}>Ariel</span>
              {' '}{activity.action || 'completed'}{' '}
              <span style={{ color: '#3b82f6' }}>{activity.title}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {timeAgo(activity.completed || activity.created)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Projects View
function ProjectsView({ data }) {
  const project = data.projects?.[0];
  if (!project) return <div style={{ color: '#64748b' }}>No projects</div>;

  return (
    <div>
      <h2 style={{ color: '#f8fafc', marginBottom: '24px' }}>{project.name}</h2>
      
      {/* Skill Progress */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '32px',
        flexWrap: 'wrap',
      }}>
        {Object.entries(project.skillProgress || {}).map(([skill, status]) => (
          <div key={skill} style={{
            padding: '12px 16px',
            backgroundColor: status === 'complete' ? '#166534' : status === 'awaiting-approval' ? '#854d0e' : '#1e293b',
            borderRadius: '8px',
            fontSize: '13px',
          }}>
            <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>{skill}</div>
            <div style={{ color: '#f8fafc', fontWeight: 600 }}>{status}</div>
          </div>
        ))}
      </div>

      {/* Brand Alternatives */}
      {data.brandAlternatives && data.brandAlternatives.length > 0 && (
        <div>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px' }}>📚 Book Cover Options</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '16px' 
          }}>
            {data.brandAlternatives.map(variant => (
              <div key={variant.id} style={{
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                padding: '16px',
                borderLeft: variant.recommended ? '3px solid #22c55e' : '3px solid #334155',
              }}>
                {variant.recommended && (
                  <div style={{ color: '#22c55e', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                    ⭐ RECOMMENDED
                  </div>
                )}
                <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>{variant.title}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>{variant.description}</div>
                {variant.image && (
                  <a href={variant.image} target="_blank" rel="noopener noreferrer">
                    <img src={variant.image} alt={variant.title} style={{ width: '100%', borderRadius: '6px' }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Memory View
function MemoryView() {
  return (
    <div style={{ color: '#94a3b8' }}>
      <h2 style={{ color: '#f8fafc', marginBottom: '16px' }}>🧠 Memory</h2>
      <p>Memory search and browsing coming soon.</p>
    </div>
  );
}

// Docs View
function DocsView() {
  return (
    <div style={{ color: '#94a3b8' }}>
      <h2 style={{ color: '#f8fafc', marginBottom: '16px' }}>📄 Documentation</h2>
      <p>Documentation browser coming soon.</p>
    </div>
  );
}

// Search View
function SearchView() {
  return (
    <div style={{ color: '#94a3b8' }}>
      <h2 style={{ color: '#f8fafc', marginBottom: '16px' }}>🔍 Search</h2>
      <p>Global search coming soon.</p>
    </div>
  );
}

// Tasks View (Kanban)
function TasksView({ data }) {
  const approvals = (data.approvals || []).map(a => ({ ...a, type: 'APPROVAL' }));
  const waiting = (data.waitingItems || []).map(w => ({ ...w }));
  const activities = data.projects?.[0]?.activityLog || [];

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1, display: 'flex', gap: '16px', overflowX: 'auto' }}>
        <KanbanColumn 
          title="Approvals" 
          count={approvals.length} 
          tasks={approvals}
          color="#8b5cf6"
        />
        <KanbanColumn 
          title="In Progress" 
          count={waiting.length} 
          tasks={waiting}
          color="#f59e0b"
        />
        <KanbanColumn 
          title="Done" 
          count={activities.length} 
          tasks={activities.map(a => ({ id: a.id, title: a.title, created: a.completed }))}
          color="#22c55e"
        />
      </div>
      <ActivityFeed activities={activities.slice(0, 10)} />
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState({ projects: [] });
  const [activeTab, setActiveTab] = useState('tasks');
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
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks': return <TasksView data={data} />;
      case 'projects': return <ProjectsView data={data} />;
      case 'memory': return <MemoryView />;
      case 'docs': return <DocsView />;
      case 'search': return <SearchView />;
      default: return <TasksView data={data} />;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px', 
      backgroundColor: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />
        <StatsBar data={data} />
        {loading ? (
          <div style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
}