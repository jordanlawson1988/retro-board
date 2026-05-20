/* global React */
/* eslint-disable */

const { useState: useStateMB, useRef: useRefMB, useEffect: useEffectMB } = React;

// ============================================================
// Board Mobile — iPhone-style retro board
// ============================================================
function BoardMobileScreen({ theme: defaultTheme = 'light' }) {
  const [theme, setTheme] = useStateMB(defaultTheme);
  const [activeCol, setActiveCol] = useStateMB('mad');
  const [cards, setCards] = useStateMB(window.SAMPLE_CARDS);
  const [tab, setTab] = useStateMB('board');
  const [composerOpen, setComposerOpen] = useStateMB(false);
  const [composerText, setComposerText] = useStateMB('');
  const scrollRef = useRefMB(null);

  const toggleVote = (id) => {
    setCards(cs => cs.map(c => c.id === id ? { ...c, voted: !c.voted, votes: c.votes + (c.voted ? -1 : 1) } : c));
  };

  // Snap to active column when it changes
  useEffectMB(() => {
    if (!scrollRef.current) return;
    const idx = window.COLUMNS.findIndex(c => c.id === activeCol);
    if (idx < 0) return;
    const colEls = scrollRef.current.querySelectorAll('[data-col-snap]');
    const target = colEls[idx];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }, [activeCol]);

  const me = window.SAMPLE_PARTICIPANTS[0];
  const colCards = cards.filter(c => c.col === activeCol);

  return (
    <div data-theme={theme} className="rb-root" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ThemeSwitch theme={theme} setTheme={setTheme} />

      <div className="m-shell">
        {/* iOS-style status bar */}
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
          <span className="mono">9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span>●●●</span>
            <span style={{ marginLeft: 8 }}>5G</span>
            <span style={{ marginLeft: 8, display: 'inline-block', width: 22, height: 11, borderRadius: 3, border: '1.5px solid currentColor', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 1.5, left: 1.5, right: 4, bottom: 1.5, background: 'currentColor', borderRadius: 1 }} />
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="m-topbar">
          <button className="rb-icon-btn" style={{ marginLeft: -8 }}><Icons.Arrow size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Sprint 47 Retro
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
              <span className="status-dot" style={{ width: 5, height: 5, boxShadow: '0 0 0 2px color-mix(in oklab, var(--success) 30%, transparent)' }} />
              4 online · 12:30 left
            </div>
          </div>
          <AvatarStack people={window.SAMPLE_PARTICIPANTS.filter(p => p.online)} max={3} size="xs" />
        </div>

        {/* Vote tracker pill */}
        <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
              <Icons.Vote size={14} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Your votes</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                <span className="mono" style={{ color: 'var(--accent)' }}>{cards.filter(c => c.voted).length}</span> of 5 used
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{
                width: 10, height: 10, borderRadius: 999,
                background: i < cards.filter(c => c.voted).length ? 'var(--accent)' : 'var(--surface-muted)',
                border: i < cards.filter(c => c.voted).length ? 'none' : '1px solid var(--line)',
              }} />
            ))}
          </div>
        </div>

        {/* Column tabs */}
        <div className="m-tabs scroll-hide">
          {window.COLUMNS.map(col => {
            const count = cards.filter(c => c.col === col.id).length;
            const active = activeCol === col.id;
            return (
              <button
                key={col.id}
                className={`m-tab ${active ? 'active' : ''} tint-${col.tint}`}
                onClick={() => setActiveCol(col.id)}
                style={active ? { background: 'var(--tint)', color: 'var(--bg)', borderColor: 'transparent' } : {}}
              >
                <span className="rb-dot" style={{ background: active ? 'var(--bg)' : 'var(--tint)' }} />
                {col.title}
                <span className="mono" style={{ opacity: 0.6, fontSize: 11 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Column content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 100px' }}>
          <div style={{ padding: '8px 4px 12px' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {window.COLUMNS.find(c => c.id === activeCol).desc}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...colCards].sort((a, b) => b.votes - a.votes).map(card => (
              <MobileCard key={card.id} card={card} onVote={toggleVote} />
            ))}
          </div>
        </div>

        {/* FAB to add card */}
        <button className="m-fab" onClick={() => setComposerOpen(true)} aria-label="Add card">
          <Icons.Plus size={22} />
        </button>

        {/* Bottom nav */}
        <div className="m-bottombar">
          {[
            { id: 'board',  Ic: Icons.Grid,    label: 'Board' },
            { id: 'votes',  Ic: Icons.Vote,    label: 'Votes' },
            { id: 'action', Ic: Icons.Action,  label: 'Actions', badge: 4 },
            { id: 'more',   Ic: Icons.More,    label: 'More' },
          ].map(o => {
            const Ic = o.Ic;
            return (
              <button key={o.id} className={`m-bottom-btn ${tab === o.id ? 'active' : ''}`} onClick={() => setTab(o.id)}>
                <div style={{ position: 'relative' }}>
                  <Ic size={20} />
                  {o.badge && (
                    <span style={{ position: 'absolute', top: -4, right: -8, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 999, minWidth: 14, textAlign: 'center' }}>
                      {o.badge}
                    </span>
                  )}
                </div>
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Composer bottom sheet */}
        {composerOpen && (
          <div className="sheet-backdrop" onClick={() => setComposerOpen(false)} style={{ alignItems: 'flex-end' }}>
            <div className="sheet" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '100%', borderRadius: '22px 22px 0 0', marginBottom: 0, padding: '22px 18px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--line-strong)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`rb-pill tint-${window.COLUMNS.find(c => c.id === activeCol).tint}`} style={{ background: 'var(--tint-soft)', color: 'var(--tint)', border: 'none' }}>
                  <span className="rb-dot" style={{ background: 'var(--tint)' }} />
                  {window.COLUMNS.find(c => c.id === activeCol).title}
                </span>
                <h3 style={{ fontSize: 16 }}>New card</h3>
                <button className="rb-icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setComposerOpen(false)}><Icons.X size={16} /></button>
              </div>
              <textarea
                className="rb-field"
                style={{ minHeight: 120, fontSize: 16, resize: 'none' }}
                placeholder={`What ${activeCol === 'mad' ? 'frustrated' : activeCol === 'sad' ? 'disappointed' : 'made you happy'} you?`}
                autoFocus
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="rb-icon-btn"><Icons.Smile size={16} /></button>
                  <button className="rb-icon-btn"><Icons.EyeOff size={16} /></button>
                </div>
                <button className="rb-btn accent" disabled={!composerText.trim()} onClick={() => { setComposerOpen(false); setComposerText(''); }}>
                  Share <Icons.Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileCard({ card, onVote }) {
  const participant = window.SAMPLE_PARTICIPANTS.find(p => p.name === card.author);
  return (
    <div className="rcard" style={{ padding: 14, gap: 10, ...(card.combined ? { borderLeft: '3px solid var(--accent)' } : {}) }}>
      <p className="rcard-text" style={{ fontSize: 15, lineHeight: 1.4 }}>{card.text}</p>

      {card.reactions && Object.keys(card.reactions).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(card.reactions).map(([emoji, count]) => (
            <button key={emoji} className="reaction" style={{ padding: '4px 9px' }}>
              <span style={{ fontSize: 13 }}>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
          <button className="reaction" style={{ padding: '4px 9px' }}>
            <Icons.Smile size={13} />
          </button>
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
        <button className={`rb-vote ${card.voted ? 'voted' : ''}`} onClick={() => onVote(card.id)} style={{ padding: '6px 12px', fontSize: 13 }}>
          <Icons.Vote size={13} />
          {card.votes}
        </button>
      </div>
    </div>
  );
}

window.BoardMobileScreen = BoardMobileScreen;
