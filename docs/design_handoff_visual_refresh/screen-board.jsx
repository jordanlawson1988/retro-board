/* global React */
/* eslint-disable */

const { useState: useStateBD } = React;

// ============================================================
// Board Desktop — Sprint 47 Retrospective
// ============================================================
function BoardDesktopScreen({ theme: defaultTheme = 'light' }) {
  const [theme, setTheme] = useStateBD(defaultTheme);
  const [view, setView] = useStateBD('grid');
  const [activeCol, setActiveCol] = useStateBD(null);
  const [cards, setCards] = useStateBD(window.SAMPLE_CARDS);
  const [showTimer, setShowTimer] = useStateBD(true);

  const toggleVote = (id) => {
    setCards(cs => cs.map(c => c.id === id ? { ...c, voted: !c.voted, votes: c.votes + (c.voted ? -1 : 1) } : c));
  };

  const me = window.SAMPLE_PARTICIPANTS[0];

  const totalCards = cards.length;
  const totalVotes = cards.reduce((s, c) => s + c.votes, 0);
  const myVotes = cards.filter(c => c.voted).length;

  return (
    <div data-theme={theme} className="rb-root" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ThemeSwitch theme={theme} setTheme={setTheme} />

      <div className="rb-shell">
        {/* Top bar */}
        <div className="rb-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Logo />
            <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Boards</span>
              <span style={{ color: 'var(--ink-5)' }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>Sprint 47 Retrospective</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="rb-btn ghost sm"><Icons.Clock size={14} /> 12:30 left</button>
            <button className="rb-btn ghost sm"><Icons.EyeOff size={14} /> Hide cards</button>
            <button className="rb-btn ghost sm"><Icons.Sliders size={14} /></button>
            <div style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px' }} />
            <button className="rb-btn primary sm"><Icons.Check size={14} /> Complete retro</button>
            <Avatar p={me} />
          </div>
        </div>

        {/* Board header */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 22 }}>Sprint 47 Retrospective</h1>
                <button className="rb-pill mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none', cursor: 'pointer' }}>
                  <Icons.Link size={11} /> Join · 48291
                </button>
                <span className="rb-pill" style={{ background: 'transparent' }}>
                  <span className="status-dot" /> Live · 4 online
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                Platform team · Facilitated by Maya · Tuesday 2:30 PM
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Your votes</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{
                      width: 14, height: 6, borderRadius: 2,
                      background: i < myVotes ? 'var(--accent)' : 'var(--surface-muted)',
                      border: i < myVotes ? 'none' : '1px solid var(--line)',
                    }} />
                  ))}
                </div>
              </div>
              <AvatarStack people={window.SAMPLE_PARTICIPANTS} max={5} />
              <button className="rb-btn sm"><Icons.Share size={14} /> Share</button>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div style={{ padding: '14px 32px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ViewToggle view={view} onChange={setView} />
              <div style={{ width: 1, height: 18, background: 'var(--line)' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`rb-chip ${activeCol === null ? 'active' : ''}`}
                  onClick={() => setActiveCol(null)}
                >
                  All <span className="mono" style={{ color: 'inherit', opacity: 0.6 }}>{totalCards}</span>
                </button>
                {window.COLUMNS.map(col => {
                  const count = cards.filter(c => c.col === col.id).length;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setActiveCol(activeCol === col.id ? null : col.id)}
                      className={`rb-chip tint-${col.tint} ${activeCol === col.id ? 'active' : ''}`}
                      style={activeCol === col.id ? { background: 'var(--tint)', color: 'var(--bg)', borderColor: 'transparent' } : {}}
                    >
                      <span className="rb-dot" style={{ background: 'var(--tint)' }} />
                      {col.title}
                      <span className="mono" style={{ opacity: 0.6 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-4)' }} className="mono">
                <span style={{ color: 'var(--ink-2)' }}>{totalVotes}</span> votes · <span style={{ color: 'var(--ink-2)' }}>{totalCards}</span> cards
              </span>
              <button className="rb-btn ghost sm"><Icons.Action size={14} /> Action items <span className="rb-pill tinted mono" style={{ padding: '1px 7px' }}>4</span></button>
            </div>
          </div>
        </div>

        {/* Board grid */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-sunken)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'flex-start' }}>
            {window.COLUMNS.map(col => (
              <BoardColumn
                key={col.id}
                col={col}
                cards={cards.filter(c => c.col === col.id)}
                onVote={toggleVote}
              />
            ))}
          </div>
        </div>

        {showTimer && <FloatingTimer onClose={() => setShowTimer(false)} />}
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  const opts = [
    { id: 'grid', label: 'Grid',     Ic: Icons.Grid },
    { id: 'lane', label: 'Swimlane', Ic: Icons.Lane },
    { id: 'list', label: 'List',     Ic: Icons.List },
  ];
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--surface-muted)', border: '1px solid var(--line)' }}>
      {opts.map(o => {
        const Ic = o.Ic;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: 'none',
              background: view === o.id ? 'var(--bg-elev)' : 'transparent',
              color: view === o.id ? 'var(--ink)' : 'var(--ink-3)',
              fontSize: 12,
              fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: 'pointer',
              boxShadow: view === o.id ? 'var(--shadow-xs)' : 'none',
            }}
          >
            <Ic size={13} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BoardColumn({ col, cards, onVote }) {
  const sorted = [...cards].sort((a, b) => b.votes - a.votes);
  return (
    <div className={`col tint-${col.tint}`}>
      <div className="col-stripe" />
      <div className="col-head">
        <span className="col-bullet" />
        <span className="col-title">{col.title}</span>
        <span className="col-count mono">{cards.length}</span>
        <button className="rb-icon-btn" style={{ width: 26, height: 26 }}><Icons.More size={14} /></button>
      </div>
      <div className="col-desc">{col.desc}</div>

      <div className="col-body">
        <div className="add-card">
          <Icons.Plus size={14} />
          <span>Add a {col.title.toLowerCase()} card…</span>
          <span className="kbd mono" style={{ marginLeft: 'auto' }}>↵</span>
        </div>
        {sorted.map(card => <RetroCard key={card.id} card={card} onVote={onVote} />)}
      </div>
    </div>
  );
}

function RetroCard({ card, onVote }) {
  const participant = window.SAMPLE_PARTICIPANTS.find(p => p.name === card.author);
  return (
    <div className="rcard" style={card.combined ? { borderLeft: '3px solid var(--accent)' } : {}}>
      <p className="rcard-text">{card.text}</p>

      {card.reactions && Object.keys(card.reactions).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(card.reactions).map(([emoji, count]) => (
            <button key={emoji} className={`reaction ${emoji === '👍' || emoji === '❤️' ? 'mine' : ''}`}>
              <span style={{ fontSize: 12 }}>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rcard-meta">
        <span className="rcard-author">
          {participant && <Avatar p={participant} size="xs" />}
          <span>{card.author}</span>
          {card.combined && (
            <span className="rb-pill tinted" style={{ padding: '2px 7px', fontSize: 10 }}>
              <Icons.Merge size={10} /> +{card.combined}
            </span>
          )}
        </span>
        <div className="rcard-actions">
          <button className={`rb-vote ${card.voted ? 'voted' : ''}`} onClick={() => onVote(card.id)}>
            <Icons.Vote size={11} />
            {card.votes}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingTimer({ onClose }) {
  const [running, setRunning] = useStateBD(true);
  return (
    <div className="timer-fab">
      <button onClick={() => setRunning(!running)} className="rb-icon-btn" style={{ width: 28, height: 28 }}>
        {running ? <Icons.Pause size={13} /> : <Icons.Play size={13} />}
      </button>
      <span>12:30</span>
      <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>· brainstorm</span>
      <button onClick={onClose} className="rb-icon-btn" style={{ width: 22, height: 22, color: 'var(--ink-4)' }}><Icons.X size={11} /></button>
    </div>
  );
}

window.BoardDesktopScreen = BoardDesktopScreen;
