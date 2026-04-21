'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AblyProvider } from '@/components/providers/AblyProvider';
import { BoardPage } from '@/components/pages/BoardPage';
import { useBoardStore } from '@/stores/boardStore';
import { useBoardChannel } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';
import { ChannelProvider } from 'ably/react';
import { AppShell } from '@/components/Layout';
import { Button, Input, Modal } from '@/components/common';

export function BoardPageWrapper({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);
  const board = useBoardStore((s) => s.board);
  const loading = useBoardStore((s) => s.loading);
  const error = useBoardStore((s) => s.error);
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const joinBoard = useBoardStore((s) => s.joinBoard);
  const router = useRouter();

  const [participantName, setParticipantName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    fetchBoard(boardId);
  }, [boardId, fetchBoard]);

  // Show join modal only if fetchBoard couldn't resolve a participant for this
  // user. fetchBoard sets currentParticipantId from the server's yourParticipantId
  // (matched via user_id) or from localStorage — if either is present, skip the modal.
  useEffect(() => {
    if (boardId && !loading && board && !currentParticipantId) {
      setShowJoinModal(true);
    }
  }, [boardId, loading, board, currentParticipantId]);

  const handleJoin = async () => {
    if (!participantName.trim()) return;
    try {
      await joinBoard(boardId, participantName.trim());
      setShowJoinModal(false);
    } catch (err) {
      console.error('Failed to join board:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-gray-2)] border-t-[var(--color-navy)]" />
            <p className="mt-4 text-[var(--color-gray-5)]">Loading board...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !board) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h2 className="text-[var(--color-gray-8)]">Board not found</h2>
            <p className="mt-2 text-[var(--color-gray-5)]">
              {error || 'This board may have been archived or the link is invalid.'}
            </p>
            <Button className="mt-6" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Pre-join: show join modal (no Ably needed yet)
  if (!currentParticipantId || showJoinModal) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="py-12 text-center">
            <p className="text-[var(--color-gray-5)]">Join the board to participate</p>
          </div>
        </div>
        <Modal
          open={showJoinModal || !currentParticipantId}
          onClose={() => router.push('/')}
          title="Join Retrospective"
        >
          <div className="flex flex-col gap-4">
            <p className="text-[var(--color-gray-5)]">
              Enter your display name to join{' '}
              <strong className="text-[var(--color-gray-8)]">{board.title}</strong>
            </p>
            <Input
              id="display-name"
              label="Display Name"
              placeholder="e.g., Jordan"
              value={participantName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParticipantName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => router.push('/')}>
                Cancel
              </Button>
              <Button onClick={handleJoin} disabled={!participantName.trim()}>
                Join Board
              </Button>
            </div>
          </div>
        </Modal>
      </AppShell>
    );
  }

  // Joined: render with Ably
  return (
    <AblyProvider clientId={currentParticipantId}>
      <ChannelProvider channelName={`retro-board:${boardId}`}>
        <ChannelProvider channelName={`retro-board:${boardId}:timer`}>
          <BoardPageInner boardId={boardId} />
        </ChannelProvider>
      </ChannelProvider>
    </AblyProvider>
  );
}

function BoardPageInner({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);

  useBoardChannel(boardId);
  usePresence(boardId, currentParticipantId);

  return <BoardPage boardId={boardId} />;
}
