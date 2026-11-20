'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Input, Textarea, Button } from '@/components/common';
import { BOARD_TEMPLATES } from '@/utils';
import { useBoardStore } from '@/stores/boardStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
import { ModeChoice } from '@/components/Phase/ModeChoice';
import type { BoardMode } from '@/lib/constants/phases';
import { cn } from '@/utils/cn';
import type { BoardTemplate } from '@/types';

interface Props {
  onClose: () => void;
}

export function CreateBoardModal({ onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<BoardMode>('open');
  const [anonymous, setAnonymous] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();
  const createBoard = useBoardStore((s) => s.createBoard);
  const appSettings = useAppSettingsStore((s) => s.settings);
  const fetchAppSettings = useAppSettingsStore((s) => s.fetchSettings);
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);
  // isEnabled() reads a missing flag as on; the choice needs the flag to be present and on,
  // so while flags load, or if the fetch fails, the modal stays as it was: an open board.
  const showModeChoice = useFeatureFlagStore((s) =>
    s.flags.some((f) => f.key === 'guided_mode' && f.is_enabled)
  );

  useEffect(() => {
    fetchAppSettings();
  }, [fetchAppSettings]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  useEffect(() => {
    if (appSettings?.default_template) {
      setSelectedTemplate(appSettings.default_template);
    }
  }, [appSettings]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const boardId = showModeChoice
        ? await createBoard(title.trim(), description.trim() || null, selectedTemplate, undefined, { mode, anonymous })
        : await createBoard(title.trim(), description.trim() || null, selectedTemplate);
      router.push(`/board/${boardId}`);
    } catch (err) {
      console.error('Failed to create board:', err);
      if (showModeChoice) setCreateError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create a Retro Board" size="lg">
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

        {showModeChoice && (
          <ModeChoice
            mode={mode}
            anonymous={anonymous}
            onChange={(next) => {
              setMode(next.mode);
              setAnonymous(next.anonymous);
            }}
          />
        )}

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

        {createError && (
          <p role="alert" className="text-[13px] text-[var(--danger)]">
            {createError}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={creating} disabled={!title.trim()}>
            Create Board
          </Button>
        </div>
      </div>
    </Modal>
  );
}
