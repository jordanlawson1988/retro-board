'use client';

// Applies the stored theme before first paint. The script must be a parser-blocking
// inline <script> in the SSR HTML (next/script `beforeInteractive` is queued and run by the
// client bootstrap, i.e. after first paint). React 19 warns whenever a <script> is rendered
// on the client, so on the client we render an inert `text/template` script instead; the
// DOM already holds the server's executable script and React leaves its attributes alone.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('retro-theme');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? undefined : 'text/template'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_INIT }}
    />
  );
}
