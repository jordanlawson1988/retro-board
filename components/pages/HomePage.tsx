'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, Zap, ListChecks, Eye } from 'lucide-react';
import { AppShell, SiteFooter } from '@/components/Layout';
import { Button, Input, Modal, Pill } from '@/components/common';
import { BoardHistorySidebar } from '@/components/Board';
import { CreateBoardModal } from '@/components/Dashboard';
import { APP_NAME } from '@/utils';

// Simple vote icon inline (lucide doesn't export "Vote")
function VoteIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L8 7h3v6h2V7h3L12 2z" />
      <rect x="4" y="15" width="16" height="2" rx="1" />
      <rect x="6" y="19" width="12" height="2" rx="1" />
    </svg>
  );
}

export function HomePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = async () => {
    const code = joinCode.replace(/\s/g, '');
    if (code.length !== 5) {
      setJoinError('Please enter a 5-digit code');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch('/api/boards/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join');
        return;
      }
      router.push(`/board/${data.boardId}`);
    } catch {
      setJoinError('Something went wrong');
    } finally {
      setJoining(false);
    }
  };

  return (
    <AppShell headerRight={<BoardHistorySidebar />}>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <Pill className="mb-6 inline-flex">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          Real-time, no install, ready in 5 seconds
        </Pill>
        <h1
          className="leading-[1.05] font-semibold tracking-[-0.025em] text-[var(--ink)]"
          style={{ fontSize: 'var(--t-display)' }}
        >
          Retros your team actually{' '}
          <span className="text-[var(--accent)]">finishes</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-[var(--ink-3)] text-[16px] leading-relaxed">
          Shared boards. Live voting. Action items. No login required for participants.
        </p>
      </section>

      {/* CTA tiles */}
      <section className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="text-left rounded-[var(--r-xl)] bg-[var(--surface)] border border-[var(--line)] p-5 hover:border-[var(--line-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-150"
        >
          <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--accent-soft)] grid place-items-center mb-4">
            <Plus className="text-[var(--accent)]" size={20} />
          </div>
          <h3 className="mb-1.5">Start a new retro</h3>
          <p className="text-[var(--ink-4)] text-[13px]">
            Pick a template, share the link.
          </p>
          <div className="mt-4 text-[11px] text-[var(--ink-4)]">
            <kbd className="font-mono px-1.5 py-0.5 rounded bg-[var(--surface-muted)] border border-[var(--line)]">
              ⌘N
            </kbd>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowJoinModal(true)}
          className="text-left rounded-[var(--r-xl)] bg-[var(--surface)] border border-[var(--line)] p-5 hover:border-[var(--line-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-150"
        >
          <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--surface-muted)] grid place-items-center mb-4">
            <LogIn size={20} className="text-[var(--ink-3)]" />
          </div>
          <h3 className="mb-1.5">Join with a code</h3>
          <p className="text-[var(--ink-4)] text-[13px]">
            Got a board code from a teammate? Drop it in.
          </p>
          <div className="mt-4 font-mono text-[11px] text-[var(--ink-4)] tracking-[0.2em]">
            ──── ────
          </div>
        </button>
      </section>

      {/* 4-up feature row */}
      <section className="max-w-5xl mx-auto px-6 mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pb-20">
        {[
          { icon: Zap,        label: 'Real-time',    desc: 'Cards and votes sync across every participant.' },
          { icon: VoteIcon,   label: 'Live voting',  desc: "See the team's priorities form in real time." },
          { icon: ListChecks, label: 'Action items', desc: 'Capture next steps without losing context.' },
          { icon: Eye,        label: 'Hide cards',   desc: 'Brainstorm privately, then reveal together.' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex flex-col gap-2">
            <Icon size={20} className="text-[var(--accent)]" />
            <h3 className="text-[15px]">{label}</h3>
            <p className="text-[13px] text-[var(--ink-4)] leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* Create Board Modal */}
      {showCreateModal && (
        <CreateBoardModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Join Board Modal */}
      <Modal
        open={showJoinModal}
        onClose={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(null); }}
        title="Join a Retro"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-3)]">
            Enter the 5-digit code shared by your facilitator.
          </p>
          <Input
            id="join-code"
            label="Join Code"
            placeholder="e.g. 48291"
            value={joinCode}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
              setJoinCode(v);
              setJoinError(null);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
            autoFocus
          />
          {joinError && (
            <p className="text-sm text-[var(--danger)]">{joinError}</p>
          )}
          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
            <Button variant="ghost" onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(null); }}>
              Cancel
            </Button>
            <Button onClick={handleJoin} loading={joining} disabled={joinCode.length !== 5}>
              Join Board
            </Button>
          </div>
        </div>
      </Modal>
      <SiteFooter />
    </AppShell>
  );
}
