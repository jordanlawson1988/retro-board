import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Input, Textarea, Modal } from '@/components/common';
import { BoardHistorySidebar } from '@/components/Board';
import { BOARD_TEMPLATES, APP_NAME } from '@/utils';
import { useBoardStore } from '@/stores/boardStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import type { BoardTemplate } from '@/types';

export function HomePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
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
      navigate(`/board/${boardId}`);
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell headerRight={<BoardHistorySidebar />}>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 sm:px-6">
        <div className="text-center">
          <h1 className="text-[var(--color-gray-8)]">
            Run better retros with{' '}
            <span className="text-[var(--color-primary)]">{APP_NAME}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-gray-5)]">
            A real-time retrospective board for teams. Create columns, add cards,
            vote, and turn insights into action items — all in one place.
          </p>
          <div className="mt-8">
            <Button size="lg" onClick={() => setShowCreateModal(true)}>
              <Plus size={20} />
              Create a Retro Board
            </Button>
          </div>
        </div>
      </div>

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

          {/* Template Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--color-gray-7)]">
              Choose a Template
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {BOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`rounded-[var(--radius-md)] border-2 p-3 sm:p-4 text-left transition-all ${
                    selectedTemplate === t.id
                      ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5'
                      : 'border-[var(--color-gray-1)] bg-[var(--color-surface)] hover:border-[var(--color-gray-2)]'
                  }`}
                >
                  <p className="font-semibold text-[var(--color-gray-8)]">{t.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-gray-5)]">{t.description}</p>
                  {t.columns.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {t.columns.map((col) => (
                        <span
                          key={col.title}
                          className="inline-block rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: col.color }}
                        >
                          {col.title}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-[var(--color-gray-1)] pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!title.trim()}>
              Create Board
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
