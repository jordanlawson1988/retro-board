'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, Zap, ListChecks, Eye } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Input, Textarea, Modal, Pill } from '@/components/common';
import { BoardHistorySidebar } from '@/components/Board';
import { BOARD_TEMPLATES, APP_NAME } from '@/utils';
import { useBoardStore } from '@/stores/boardStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { cn } from '@/utils/cn';
import type { BoardTemplate } from '@/types';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const router = useRouter();
  const createBoard = useBoardStore((s) => s.createBoard);
  const appSettings = useAppSettingsStore((s) => s.settings);
  const fetchAppSettings = useAppSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchAppSettings();
  }, [fetchAppSettings]);

  useEffect(() => {
    if (appSettings?.default_template) {
      setSelectedTemplate(appSettings.default_template);
    }
  }, [appSettings]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const boardId = await createBoard(title.trim(), description.trim() || null, selectedTemplate);
      router.push(`/board/${boardId}`);
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

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
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create a Retro Board"
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <Input
            id="board-title"
            label="Board Title"
            placeholder="e.g., Sprint 47 Retrospective"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            id="board-description"
            label="Description (optional)"
            placeholder="Add context or prompts for your team..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          {/* Template Selection — 2×2 grid with tint-stripe */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--ink-2)]">
              Choose a Template
            </label>
            <div className="grid grid-cols-2 gap-3">
              {BOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={cn(
                    'text-left p-4 rounded-[var(--r-lg)] border transition-all duration-150',
                    selectedTemplate === t.id
                      ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
                      : 'border-[var(--line)] hover:border-[var(--line-strong)]'
                  )}
                >
                  {/* Tint-stripe row */}
                  <div className="flex gap-1 mb-3">
                    {t.columns.map((c, i) => (
                      <span
                        key={i}
                        className="h-[3px] flex-1 rounded-full opacity-85"
                        style={{ background: c.color }}
                      />
                    ))}
                  </div>
                  <h4 className="text-[14px] font-semibold mb-1">{t.name}</h4>
                  <p className="text-[12px] text-[var(--ink-4)] leading-snug">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!title.trim()}>
              Create Board
            </Button>
          </div>
        </div>
      </Modal>

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
    </AppShell>
  );
}
