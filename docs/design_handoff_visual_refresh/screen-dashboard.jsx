/* global React */
/* eslint-disable */

const { useState: useStateDB } = React;

// ============================================================
// Dashboard — my boards
// ============================================================
function DashboardScreen({ theme: defaultTheme = 'light' }) {
  const [theme, setTheme] = useStateDB(defaultTheme);
  const [filter, setFilter] = useStateDB('all');
  const [search, setSearch] = useStateDB('');
  const { Plus, Search: SearchI, Vote, Users: UsersI, Clock, Action } = window.Icons;

  const filtered = window.DASHBOARD_BOARDS.filter(b => {
    if (filter === 'active' && b.status !== 'active') return false;
    if (filter === 'completed' && b.status !== 'completed') return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const me = window.SAMPLE_PARTICIPANTS[0];

  return (
    <div data-theme={theme} className="rb-root" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ThemeSwitch theme={theme} setTheme={setTheme} />
      <div className="rb-shell">
        <div className="rb-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Logo />
            <nav style={{ display: 'flex', gap: 4 }}>
              <button className="rb-chip active">Boards</button>
              <button className="rb-chip">Templates</button>
              <button className="rb-chip">Team</button>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="rb-icon-btn"><Icons.Bell size={16} /></button>
            <Avatar p={me} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>Welcome back, {me.name.split(' ')[0]}</p>
                <h1 style={{ fontSize: 28 }}>Your retros</h1>
              </div>
              <button className="rb-btn accent">
                <Plus size={16} /> New retro
              </button>
            </div>

            {/* Stat strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Active boards',     v: '4',   trend: '+1 this week', accent: false },
                { label: 'Action items open', v: '12',  trend: '5 due this sprint', accent: true },
                { label: 'Cards shared',      v: '184', trend: '32 this month', accent: false },
                { label: 'Team votes cast',   v: '268', trend: 'Across 6 boards', accent: false },
              ].map((s, i) => (
                <div key={i} className="rb-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: s.accent ? 'var(--accent)' : 'var(--ink)' }}>{s.v}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.trend}</p>
                </div>
              ))}
            </div>

            {/* Filter row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface-muted)', border: '1px solid var(--line)' }}>
                {[['all','All'],['active','Active'],['completed','Completed']].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: filter === k ? 'var(--bg-elev)' : 'transparent',
                      color: filter === k ? 'var(--ink)' : 'var(--ink-3)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      boxShadow: filter === k ? 'var(--shadow-xs)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', display: 'flex' }}>
                  <SearchI size={14} />
                </span>
                <input
                  className="rb-field"
                  style={{ paddingLeft: 36 }}
                  placeholder="Search boards…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Board cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {filtered.map(board => (
                <BoardTile key={board.id} board={board} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardTile({ board }) {
  const { Vote, Users: UsersI, Action, Clock } = window.Icons;
  const isCompleted = board.status === 'completed';
  return (
    <div className="tile lift" style={{ gap: 14 }}>
      {/* color strip preview */}
      <div style={{ display: 'flex', gap: 4 }}>
        {board.cols.map((c, i) => (
          <span key={i} className={`tint-${c}`} style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--tint)' }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{board.title}</h3>
          {isCompleted && (
            <span className="rb-pill" style={{ background: 'color-mix(in oklab, var(--success) 15%, transparent)', color: 'var(--success)', border: 'none' }}>
              Completed
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>{board.desc} · {board.template}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--ink-3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Action size={12} /> <span className="mono">{board.cards}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Vote size={12} /> <span className="mono">{board.votes}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <UsersI size={12} /> <span className="mono">{board.participants}</span>
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-4)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {board.when}
        </span>
      </div>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
