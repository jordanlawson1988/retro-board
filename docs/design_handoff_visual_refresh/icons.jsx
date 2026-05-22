/* global React */
/* eslint-disable */

// ============================================================
// Icons — minimal lucide-style strokes
// ============================================================
const I = ({ d, s = 1.75, size = 16, fill = "none", children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);
const Icons = {
  Plus:    (p) => <I size={p?.size} d="M12 5v14M5 12h14" />,
  Search:  (p) => <I size={p?.size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>,
  Link:    (p) => <I size={p?.size} d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
  Check:   (p) => <I size={p?.size} d="m5 12 5 5L20 7" />,
  Vote:    (p) => <I size={p?.size}><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></I>,
  Smile:   (p) => <I size={p?.size}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></I>,
  Sun:     (p) => <I size={p?.size}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></I>,
  Moon:    (p) => <I size={p?.size} d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />,
  Users:   (p) => <I size={p?.size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></I>,
  Sliders: (p) => <I size={p?.size}><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></I>,
  Clock:   (p) => <I size={p?.size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>,
  Play:    (p) => <I size={p?.size} fill="currentColor" s={0} d="M8 5v14l11-7z" />,
  Pause:   (p) => <I size={p?.size} fill="currentColor" s={0} d="M6 5h4v14H6zM14 5h4v14h-4z" />,
  More:    (p) => <I size={p?.size}><circle cx="12" cy="6" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="18" r="1.3" fill="currentColor" /></I>,
  Edit:    (p) => <I size={p?.size} d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />,
  Trash:   (p) => <I size={p?.size}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></I>,
  Merge:   (p) => <I size={p?.size} d="M6 21V8a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v13M6 12h12" />,
  Grid:    (p) => <I size={p?.size}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></I>,
  List:    (p) => <I size={p?.size} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  Lane:    (p) => <I size={p?.size}><path d="M3 6h18M3 12h18M3 18h18" /></I>,
  Filter:  (p) => <I size={p?.size} d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />,
  Sparkle: (p) => <I size={p?.size} d="M12 3v4M12 17v4M5 12H1M23 12h-4M6.34 6.34 4.22 4.22M19.78 19.78l-2.12-2.12M6.34 17.66 4.22 19.78M19.78 4.22 17.66 6.34" />,
  Action:  (p) => <I size={p?.size}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></I>,
  Logout:  (p) => <I size={p?.size} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  Bell:    (p) => <I size={p?.size}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></I>,
  Cog:     (p) => <I size={p?.size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></I>,
  Eye:     (p) => <I size={p?.size}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></I>,
  EyeOff:  (p) => <I size={p?.size} d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 1 13s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />,
  X:       (p) => <I size={p?.size} d="m6 6 12 12M6 18 18 6" />,
  Home:    (p) => <I size={p?.size} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />,
  Board:   (p) => <I size={p?.size}><rect x="3" y="3" width="7" height="18" rx="2" /><rect x="14" y="3" width="7" height="10" rx="2" /></I>,
  Send:    (p) => <I size={p?.size} d="m22 2-7 20-4-9-9-4 20-7Z" />,
  Arrow:   (p) => <I size={p?.size} d="M5 12h14M13 6l6 6-6 6" />,
  Heart:   (p) => <I size={p?.size} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />,
  Share:   (p) => <I size={p?.size}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></I>,
};

window.Icons = Icons;
