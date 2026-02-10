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

function StatusBadge({ status }) {
  const colors = {
    complete: { bg: '#052e16', text: '#4ade80', label: 'Complete' },
    active: { bg: '#172554', text: '#60a5fa', label: 'Active' },
    'awaiting-approval': { bg: '#422006', text: '#fbbf24', label: 'Needs Approval' },
    pending: { bg: '#1e293b', text: '#64748b', label: 'Pending' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.text,
    }}>
      {c.label}
    </span>
  );
}

function Header({ lastUpdated }) {
  return (
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
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}>
          A
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc' }}>Ariel</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Status Board</div>
        </div>
      </div>
      {lastUpdated && (
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Updated {timeAgo(lastUpdated)}
        </div>
      )}
    </header>
  );
}

function ApprovalCard({ item }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      borderLeft: '3px solid #f59e0b',
    }}>
      <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
        Needs your decision
      </div>
      <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc', marginBottom: '6px' }}>
        {item.title}
      </div>
      {item.description && (
        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '10px' }}>
          {item.description}
        </div>
      )}
      {item.options && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {item.options.map((opt, i) => (
            <span key={i} style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: '#334155',
              color: '#cbd5e1',
            }}>
              {opt}
            </span>
          ))}
        </div>
      )}
      {item.image && (
        <a href={item.image} target="_blank" rel="noopener noreferrer">
          <img src={item.image} alt={item.title} style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '6px',
            border: '1px solid #334155',
            marginTop: '8px',
          }} />
        </a>
      )}
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
        {timeAgo(item.created)}
      </div>
    </div>
  );
}

function ProjectCard({ project, data, isExpanded, onToggle }) {
  const approvals = (data.approvals || []).filter(a => a.projectId === project.id);
  const alternatives = (data.brandAlternatives || []).filter(b => b.projectId === project.id);
  const waiting = (data.waitingItems || []).filter(w => w.projectId === project.id);
  const activities = project.activityLog || [];
  const pipeline = project.skillProgress || {};

  const statusColor = project.status === 'complete' ? '#4ade80'
    : approvals.length > 0 ? '#fbbf24'
    : '#60a5fa';

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid #334155',
    }}>
      {/* Project Header — always visible */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: '#f8fafc' }}>
              {project.name}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {project.status === 'complete' ? 'Complete' : `Current: ${project.currentSkill}`}
              {approvals.length > 0 && (
                <span style={{ color: '#fbbf24', marginLeft: '8px' }}>
                  {approvals.length} awaiting approval
                </span>
              )}
            </div>
          </div>
        </div>
        <span style={{ color: '#64748b', fontSize: '18px' }}>
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Pipeline */}
          {Object.keys(pipeline).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Pipeline
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(pipeline).map(([skill, status]) => (
                  <div key={skill} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    backgroundColor: '#0f172a',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: '#94a3b8' }}>{skill.replace(/-/g, ' ')}</span>
                    <StatusBadge status={status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approvals */}
          {approvals.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Awaiting Decision
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {approvals.map(a => <ApprovalCard key={a.id} item={a} />)}
              </div>
            </div>
          )}

          {/* Brand Alternatives */}
          {alternatives.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Design Alternatives
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {alternatives.map(v => (
                  <div key={v.id} style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    padding: '12px',
                    borderLeft: v.recommended ? '3px solid #4ade80' : '3px solid #334155',
                  }}>
                    {v.recommended && (
                      <div style={{ color: '#4ade80', fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>RECOMMENDED</div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', marginBottom: '4px' }}>{v.title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{v.description}</div>
                    {v.image && (
                      <a href={v.image} target="_blank" rel="noopener noreferrer">
                        <img src={v.image} alt={v.title} style={{ width: '100%', borderRadius: '4px' }} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {waiting.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                In Progress
              </div>
              {waiting.map(w => (
                <div key={w.id} style={{
                  backgroundColor: '#0f172a',
                  borderRadius: '6px',
                  padding: '12px',
                  borderLeft: '3px solid #60a5fa',
                  marginBottom: '8px',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>{w.title}</div>
                  {w.description && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{w.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Activity Log */}
          {activities.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Activity
              </div>
              <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '4px 12px' }}>
                {activities.slice(0, 8).map((a, i) => (
                  <div key={a.id || i} style={{
                    padding: '10px 0',
                    borderBottom: i < Math.min(activities.length, 8) - 1 ? '1px solid #1e293b' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(a.completed)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompletedSection({ data }) {
  const items = data.completedItems || [];
  if (items.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '10px',
      border: '1px solid #334155',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
        Recently Completed
      </div>
      {items.slice(0, 6).map((item, i) => (
        <div key={item.id} style={{
          padding: '10px 0',
          borderBottom: i < Math.min(items.length, 6) - 1 ? '1px solid #0f172a' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#4ade80', flexShrink: 0, marginTop: '1px' }}>&#10003;</span>
            <div>
              <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{item.title}</div>
              {item.projectId && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {data.projects?.find(p => p.id === item.projectId)?.name || item.projectId}
                  {item.completed && ` \u00B7 ${timeAgo(item.completed)}`}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/status.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        // Auto-expand active projects, collapse complete ones
        const expanded = {};
        (json.projects || []).forEach(p => {
          expanded[p.id] = p.status !== 'complete';
        });
        setExpandedProjects(expanded);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleProject = (id) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', color: '#f87171', padding: '40px', textAlign: 'center' }}>
          Failed to load: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', color: '#64748b', padding: '40px', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  // Sort: active projects first, then complete
  const sortedProjects = [...(data.projects || [])].sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return 1;
    if (a.status !== 'complete' && b.status === 'complete') return -1;
    return 0;
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Header lastUpdated={data.lastUpdated} />

        {/* Projects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {sortedProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              data={data}
              isExpanded={expandedProjects[project.id]}
              onToggle={() => toggleProject(project.id)}
            />
          ))}
        </div>

        {/* Completed Items */}
        <CompletedSection data={data} />
      </div>
    </div>
  );
}
