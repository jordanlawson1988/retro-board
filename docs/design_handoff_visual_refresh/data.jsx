/* global React */
/* eslint-disable */

// Shared sample data + small reusable bits across screens.

const SAMPLE_PARTICIPANTS = [
  { id: 'p1', name: 'Maya Chen',     hue: 280, online: true,  admin: true  },
  { id: 'p2', name: 'Devon Patel',   hue: 30,  online: true               },
  { id: 'p3', name: 'Sasha Ito',     hue: 160, online: true               },
  { id: 'p4', name: 'Theo Marshall', hue: 230, online: false              },
  { id: 'p5', name: 'Jordan Lee',    hue: 350, online: true               },
  { id: 'p6', name: 'Priya Anand',   hue: 90,  online: false              },
];

const SAMPLE_CARDS = [
  { id: 'c1', col: 'mad',  text: "Sprint planning still ran 90 minutes over. We need a hard stop.",                     author: 'Devon Patel',   votes: 5, voted: true,  reactions: { '👍': 4, '🔥': 2 } },
  { id: 'c2', col: 'mad',  text: "Three production incidents this sprint and no clear owner for follow-up.",            author: 'Maya Chen',     votes: 3, voted: false, reactions: {} },
  { id: 'c3', col: 'mad',  text: "Design reviews getting bottlenecked by single approver.",                              author: 'Sasha Ito',     votes: 2, voted: false, combined: 2 },
  { id: 'c4', col: 'sad',  text: "Lost two engineers to the platform team mid-sprint without a handoff plan.",          author: 'Theo Marshall', votes: 4, voted: true,  reactions: { '😢': 2 } },
  { id: 'c5', col: 'sad',  text: "Roadmap shifted twice on Tuesday — hard to feel ownership over the work.",            author: 'Priya Anand',   votes: 3, voted: false, reactions: {} },
  { id: 'c6', col: 'sad',  text: "Customer interview prep got cut to make room for unplanned migration.",                author: 'Jordan Lee',    votes: 1, voted: false, reactions: {} },
  { id: 'c7', col: 'glad', text: "Pair programming Wednesday afternoons turned into the best part of the week.",        author: 'Maya Chen',     votes: 6, voted: true,  reactions: { '❤️': 5, '🎉': 3 } },
  { id: 'c8', col: 'glad', text: "Shipped the dark mode launch on time and the team rallied around the demo.",         author: 'Jordan Lee',    votes: 4, voted: false, reactions: { '🚀': 2 } },
  { id: 'c9', col: 'glad', text: "Sasha's docs PR made onboarding new hires noticeably less painful.",                  author: 'Devon Patel',   votes: 3, voted: false, reactions: {} },
];

const COLUMNS = [
  { id: 'mad',  title: 'Mad',  desc: "What frustrated you?",  tint: 'rose'    },
  { id: 'sad',  title: 'Sad',  desc: "What disappointed you?", tint: 'sky'    },
  { id: 'glad', title: 'Glad', desc: "What made you happy?",   tint: 'emerald' },
];

const TEMPLATES = [
  { id: 'msg', name: 'Mad · Sad · Glad', desc: 'Emotional check-in', cols: ['rose','sky','emerald'] },
  { id: 'lll', name: 'Liked · Learned · Lacked', desc: 'Reflect on positives, growth, gaps', cols: ['emerald','sky','amber'] },
  { id: 'ssc', name: 'Start · Stop · Continue', desc: 'Action-oriented process improvement', cols: ['emerald','rose','sky'] },
  { id: 'wda', name: 'Went Well · Didn’t · Actions', desc: 'Simple review with action planning', cols: ['emerald','rose','violet'] },
];

const DASHBOARD_BOARDS = [
  { id: 'b1', title: 'Sprint 47 Retrospective', desc: 'Platform team — Q2',     template: 'Mad / Sad / Glad',          cards: 24, votes: 41, participants: 6, when: '2 days ago', status: 'active',  cols: ['rose','sky','emerald'] },
  { id: 'b2', title: 'Launch retro: Dark Mode',  desc: 'Cross-functional',      template: 'Liked / Learned / Lacked',  cards: 32, votes: 58, participants: 9, when: '1 week ago', status: 'active',  cols: ['emerald','sky','amber'] },
  { id: 'b3', title: 'Q1 Quarterly Reflection',  desc: 'All hands offsite',     template: 'Start / Stop / Continue',   cards: 47, votes: 92, participants: 14, when: '2 weeks ago', status: 'completed', cols: ['emerald','rose','sky'] },
  { id: 'b4', title: 'Onboarding flow review',   desc: 'Growth pod',            template: 'Custom',                    cards: 18, votes: 24, participants: 4, when: '3 weeks ago', status: 'active',  cols: ['violet','amber','sky'] },
  { id: 'b5', title: 'Incident #2814 post-mortem', desc: 'SRE',                 template: 'Went well / Didn’t',        cards: 12, votes: 18, participants: 5, when: '1 month ago', status: 'completed', cols: ['emerald','rose'] },
  { id: 'b6', title: 'Design system Q2 review',  desc: 'Design team',           template: 'Mad / Sad / Glad',          cards: 21, votes: 35, participants: 7, when: '1 month ago', status: 'completed', cols: ['rose','sky','emerald'] },
];

window.SAMPLE_PARTICIPANTS = SAMPLE_PARTICIPANTS;
window.SAMPLE_CARDS = SAMPLE_CARDS;
window.COLUMNS = COLUMNS;
window.TEMPLATES = TEMPLATES;
window.DASHBOARD_BOARDS = DASHBOARD_BOARDS;

// ---------- Common primitives ----------
function Avatar({ p, size = '' }) {
  const initial = p.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  // pleasant warm gradient based on hue
  const bg = `oklch(0.62 0.13 ${p.hue})`;
  return (
    <div className={`rb-avatar ${size}`} style={{ background: bg }} title={p.name}>
      {initial}
    </div>
  );
}

function AvatarStack({ people, size = 'sm', max = 4 }) {
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;
  return (
    <div className="rb-avatar-stack">
      {visible.map(p => <Avatar key={p.id} p={p} size={size} />)}
      {extra > 0 && (
        <div className={`rb-avatar ${size}`} style={{ background: 'var(--surface-muted)', color: 'var(--ink-3)', border: '2px solid var(--bg)' }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function Logo({ name = 'Retroboard' }) {
  return (
    <div className="rb-logo">
      <div className="rb-logo-mark">R</div>
      <span>{name}</span>
    </div>
  );
}

function ThemeSwitch({ theme, setTheme }) {
  const { Sun, Moon } = window.Icons;
  return (
    <div className="theme-switch">
      <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} title="Light mode"><Sun size={14} /></button>
      <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} title="Dark mode"><Moon size={14} /></button>
    </div>
  );
}

window.Avatar = Avatar;
window.AvatarStack = AvatarStack;
window.Logo = Logo;
window.ThemeSwitch = ThemeSwitch;
