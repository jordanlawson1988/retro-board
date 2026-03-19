import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
