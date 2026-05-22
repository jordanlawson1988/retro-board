/* global React */
/* eslint-disable */

const { useState } = React;

// ============================================================
// Home Screen — landing with "Create" and "Join" CTAs
// ============================================================
function HomeScreen({ theme: defaultTheme = 'light' }) {
  const [theme, setTheme] = useState(defaultTheme);
  const [showCreate, setShowCreate] = useState(false);
  const [tpl, setTpl] = useState('msg');
  const [title, setTitle] = useState('');
  const { Plus, Link: LinkIcon, Sparkle, Action, Users: UsersIcon, X } = window.Icons;

  return (
    <div data-theme={theme} className="rb-root" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ThemeSwitch theme={theme} setTheme={setTheme} />
      <div className="rb-shell">
        <div className="rb-topbar">
          <Logo />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="rb-btn ghost sm">Boards</button>
            <button className="rb-btn ghost sm">Sign in</button>
            <button className="rb-btn primary sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New retro
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '40px 32px' }}>
          <div style={{ maxWidth: 880, width: '100%', display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              Real-time, no install, ready in 5 seconds
            </div>

            <h1 style={{ fontSize: 'var(--t-display)', textAlign: 'center', maxWidth: 720, fontWeight: 600, lineHeight: 1.05 }}>
              Retros your team actually <span style={{ color: 'var(--accent)' }}>finishes</span>.
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 560, lineHeight: 1.45 }}>
              Run sharp, focused retrospectives. Cards, votes, action items —
              all in one quiet, fast canvas. From kickoff to commitments in 30 minutes.
            </p>

            {/* Two-card CTA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 720, marginTop: 8 }}>
              <div className="tile lift" onClick={() => setShowCreate(true)} style={{ minHeight: 160, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center' }}>
                    <Plus size={18} />
                  </div>
                  <span className="rb-pill bare mono" style={{ color: 'var(--ink-4)' }}>⌘ N</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h3 style={{ fontSize: 17 }}>Start a new retro</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Pick a template, invite your team with a 5-digit code.</p>
                </div>
              </div>
              <div className="tile lift" style={{ minHeight: 160, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--surface-muted)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', border: '1px solid var(--line)' }}>
                    <LinkIcon size={18} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[4,8,2,9,1].map((d, i) => (
                      <span key={i} style={{ width: 22, height: 28, borderRadius: 6, border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', background: 'var(--bg-elev)' }}>{d}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h3 style={{ fontSize: 17 }}>Join with a code</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Enter the 5-digit code your facilitator shared.</p>
                </div>
              </div>
            </div>

            {/* Mini feature row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%', maxWidth: 720, marginTop: 16 }}>
              {[
                { Ic: Sparkle, t: 'Live sync',     d: 'Cards appear as they’re typed' },
                { Ic: UsersIcon, t: 'Group voting',  d: 'See what the team cares about' },
                { Ic: Action,  t: 'Action items',  d: 'Capture commitments in-line' },
                { Ic: LinkIcon,t: 'Share-by-link', d: 'No accounts required to join' },
              ].map(({ Ic, t, d }) => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 4px' }}>
                  <div style={{ color: 'var(--ink-3)' }}><Ic size={16} /></div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.35 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="sheet-backdrop" onClick={() => setShowCreate(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 18 }}>Create a retro</h2>
              <button className="rb-icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>Title</label>
              <input className="rb-field" placeholder="e.g. Sprint 47 Retrospective" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>Template</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {window.TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTpl(t.id)}
                    className={`tile ${tpl === t.id ? 'selected' : ''}`}
                    style={{ padding: 12, gap: 8, textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      {t.cols.map((c, i) => (
                        <span key={i} className={`col-bullet tint-${c}`} style={{ width: 16, height: 5, borderRadius: 3 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button className="rb-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="rb-btn accent">Create board <Icons.Arrow size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.HomeScreen = HomeScreen;
