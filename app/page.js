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

function WaitingCard({ task, projectName, projectColor }) {
  return (
    <div style={{
      backgroundColor: '#0f172a',
      borderRadius: '12px',
      padding: '20px',
      borderLeft: `4px solid ${projectColor || '#f59e0b'}`,
      marginBottom: '12px',
    }}>
      <div style={{ 
        fontSize: '11px', 
        color: projectColor || '#f59e0b', 
        fontWeight: 600, 
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {projectName}
      </div>
      <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: '#f8fafc' }}>
        {task.title}
      </div>
      <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
        {task.description}
      </div>
      {task.asked && (
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
          Asked: {task.asked}
        </div>
      )}
    </div>
  );
}

function SkillProgressBar({ skillProgress }) {
  if (!skillProgress) return null;
  
  const skills = [
    { key: 'orchestrator', label: 'Orchestrator', icon: '🎯' },
    { key: 'business-naming', label: 'Naming', icon: '🔤' },
    { key: 'brand-assets', label: 'Brand', icon: '🎨' },
    { key: 'infoproduct-creation', label: 'Content', icon: '📝' },
    { key: 'funnel-builder', label: 'Funnel', icon: '🚀' },
    { key: 'legal-templates', label: 'Legal', icon: '⚖️' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return '#22c55e';
      case 'in-progress': return '#3b82f6';
      case 'awaiting-approval': return '#f59e0b';
      default: return '#334155';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete': return '✓';
      case 'in-progress': return '●';
      case 'awaiting-approval': return '!';
      default: return '○';
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '16px 0',
    }}>
      {skills.map((skill, i) => {
        const status = skillProgress[skill.key] || 'pending';
        const color = getStatusColor(status);
        return (
          <div key={skill.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: status === 'pending' ? 'transparent' : color,
                border: `3px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: status === 'pending' ? color : 'white',
                fontWeight: 700,
                fontSize: '14px',
              }}>
                {getStatusIcon(status)}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: status === 'pending' ? '#64748b' : color,
                marginTop: '6px',
                fontWeight: status === 'awaiting-approval' ? 700 : 500,
              }}>
                {skill.label}
              </div>
            </div>
            {i < skills.length - 1 && (
              <div style={{
                width: '60px',
                height: '3px',
                backgroundColor: skillProgress[skills[i + 1].key] === 'pending' ? '#334155' : getStatusColor(skillProgress[skills[i + 1].key]),
                margin: '0 8px',
                marginBottom: '20px',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProjectMini({ project }) {
  const statusColors = {
    active: '#22c55e',
    paused: '#64748b',
    waiting: '#f59e0b',
  };
  
  return (
    <Link href={`/project/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#334155'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1e293b'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: statusColors[project.status] || '#64748b',
          }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{project.name}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {project.currentSkill && `→ ${project.currentSkill}`}
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [data, setData] = useState({ projects: [] });
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

  // Get ALL waiting items across all projects
  const allWaiting = (data.projects || []).flatMap(p => 
    (p.columns?.waiting?.tasks || []).map(t => ({ 
      ...t, 
      projectName: p.name, 
      projectColor: p.color 
    }))
  );

  // Get active project (the one with work happening)
  const activeProject = data.projects?.find(p => p.status === 'active' && p.skillProgress);

  // Get recent activity from active project
  const recentActivity = activeProject?.activityLog?.slice(0, 3) || [];

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px 24px', 
      maxWidth: '900px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '48px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            🦁 Ariel
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Updated {timeAgo(data.lastUpdated || lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            backgroundColor: 'transparent',
            color: loading ? '#64748b' : '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '13px',
          }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* SECTION 1: Needs Your Review (PRIMARY) */}
      {allWaiting.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              backgroundColor: '#f59e0b',
              color: 'black',
              fontWeight: 700,
              fontSize: '13px',
              padding: '4px 12px',
              borderRadius: '4px',
            }}>
              {allWaiting.length} NEEDS REVIEW
            </div>
          </div>
          
          {allWaiting.map(task => (
            <WaitingCard 
              key={task.id} 
              task={task} 
              projectName={task.projectName}
              projectColor={task.projectColor}
            />
          ))}
        </div>
      )}

      {/* SECTION 2: Active Project Progress */}
      {activeProject && activeProject.skillProgress && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#64748b', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Current: {activeProject.name}
          </div>
          
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '20px 24px',
          }}>
            <SkillProgressBar skillProgress={activeProject.skillProgress} />
          </div>
        </div>
      )}

      {/* SECTION 3: Recent Activity (Minimal) */}
      {recentActivity.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#64748b', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Recent
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActivity.map(activity => (
              <div key={activity.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '14px', color: '#e2e8f0' }}>{activity.title}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{timeAgo(activity.completed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: All Projects (Compact List) */}
      <div>
        <div style={{ 
          fontSize: '12px', 
          color: '#64748b', 
          textTransform: 'uppercase', 
          letterSpacing: '1px',
          marginBottom: '12px',
        }}>
          All Projects
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.projects?.map(project => (
            <ProjectMini key={project.id} project={project} />
          ))}
        </div>
      </div>

      {/* Nothing to show fallback */}
      {allWaiting.length === 0 && !activeProject && (
        <div style={{ 
          textAlign: 'center', 
          color: '#64748b', 
          padding: '60px 20px',
          fontSize: '16px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
          <div>All clear! Nothing needs your attention.</div>
        </div>
      )}
    </div>
  );
}
