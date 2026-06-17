import type { MetadataRoute } from 'next';

// Minimal install manifest for Add-to-Home-Screen polish. No service worker /
// no offline support (intentionally out of scope).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RetroBoard',
    short_name: 'RetroBoard',
    description: 'Real-time retrospective board for team collaboration',
    start_url: '/',
    display: 'standalone',
    background_color: '#15161b',
    theme_color: '#15161b',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
