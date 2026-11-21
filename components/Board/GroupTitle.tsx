'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/common';
import { cn } from '@/utils/cn';
import { usePhaseGates } from '@/hooks/usePhaseGates';
import { useBoardStore } from '@/stores/boardStore';
import { useGroupVoteStore } from '@/stores/groupVoteStore';
import { GROUP_TITLE_MAX } from '@/lib/constants/groups';
import { GUIDED_MODE, type PhaseId } from '@/lib/constants/phases';
import { clampGroupTitle, editorStillOpen, groupTitleLength, isLeadCard, showTitleCounter, visibleGroupTitle } from '@/lib/groups';

const PLACEHOLDER = 'Name this group';

interface GroupTitleProps {
  cardId: string;
}

/**
 * The title of a group, shown above the text of its lead card on a guided board. Every selector
 * returns a primitive and answers "not guided" before it reads `cards`, so a card re-renders only
 * when its own title or lead status changes. The editor belongs to the phase it was opened in.
 */
export function GroupTitle({ cardId }: GroupTitleProps) {
  const { phase, moveLocked } = usePhaseGates();
  const isLead = useBoardStore((s) => s.board?.mode === GUIDED_MODE && isLeadCard(cardId, s.cards));
  const title = useBoardStore((s) => (s.board?.mode === GUIDED_MODE ? visibleGroupTitle(cardId, s.cards) : null));
  const joinedAndOpen = useBoardStore((s) => s.currentParticipantId !== null && !s.board?.archived_at);
  const setGroupTitle = useGroupVoteStore((s) => s.setGroupTitle);
  const clearWriteError = useBoardStore((s) => s.clearWriteError);

  const [editor, setEditor] = useState<{ phase: PhaseId; value: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const cancelledRef = useRef(false);
  const refocusRef = useRef(false);

  const canEdit = isLead && joinedAndOpen && !moveLocked;
  const open = editor !== null && editorStillOpen(editor.phase, phase, canEdit);

  // An editor left behind by a phase change (or by a card that stopped being a lead) must not come
  // back when that state is reached again, and never saves on its way out.
  if (editor !== null && !open) {
    setEditor(null);
    setProblem(null);
  }

  useEffect(() => {
    if (open) {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    } else if (refocusRef.current) {
      refocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  if (!isLead) return null;
  if (!canEdit && !title) return null;

  const close = (returnFocus: boolean) => {
    refocusRef.current = returnFocus;
    setEditor(null);
    setProblem(null);
  };

  const begin = () => {
    if (!phase) return;
    savingRef.current = false;
    cancelledRef.current = false;
    setProblem(null);
    setEditor({ phase, value: title ?? '' });
  };

  const save = (returnFocus: boolean) => {
    if (!editor || savingRef.current || cancelledRef.current) return;
    // Judge by the live store: a blur that arrives while the editor is being torn down must not save.
    const live = useBoardStore.getState();
    if (!editorStillOpen(editor.phase, live.board?.phase ?? null, true) || !isLeadCard(cardId, live.cards)) return;
    const value = editor.value.trim();
    if (value === (title ?? '')) return close(returnFocus);
    savingRef.current = true;
    setProblem(null);
    // A rejection leaves the editor open with what was typed and shows the reason here, so the
    // connection banner's copy of the same message is cleared rather than shown twice.
    setGroupTitle(cardId, value === '' ? null : value)
      .then(() => close(returnFocus))
      .catch((e: unknown) => {
        clearWriteError();
        setProblem(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        savingRef.current = false;
      });
  };

  if (!open || !editor) {
    const shown = title ?? PLACEHOLDER;
    const text = (
      <span
        data-testid={title ? 'group-title' : undefined}
        className={cn(
          'min-w-0 text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]',
          title ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]'
        )}
      >
        {shown}
      </span>
    );
    if (!canEdit) return <p className="mb-2 flex">{text}</p>;
    return (
      <button
        ref={triggerRef}
        type="button"
        aria-label={title ? 'Rename group' : PLACEHOLDER}
        onClick={(e) => {
          e.stopPropagation();
          begin();
        }}
        className="mb-1 flex min-h-11 w-full items-center gap-1.5 rounded-[var(--r-sm)] text-left hover:text-[var(--ink)] sm:min-h-0 sm:mb-2"
      >
        {text}
        <Pencil size={12} className="shrink-0 text-[var(--ink-3)]" aria-hidden />
      </button>
    );
  }

  const counterId = `group-title-count-${cardId}`;
  const problemId = `group-title-problem-${cardId}`;
  const describedBy = [showTitleCounter(editor.value) ? counterId : null, problem ? problemId : null].filter(Boolean).join(' ');
  return (
    <div className="mb-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        aria-label="Group title"
        placeholder={PLACEHOLDER}
        value={editor.value}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => setEditor({ ...editor, value: clampGroupTitle(e.target.value) })}
        onBlur={() => save(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelledRef.current = true;
            close(true);
          }
        }}
        className={cn(problem && 'border-[var(--danger)]')}
      />
      {showTitleCounter(editor.value) && (
        <span id={counterId} className="text-[11px] text-[var(--ink-3)]">
          {groupTitleLength(editor.value)} of {GROUP_TITLE_MAX}
        </span>
      )}
      {problem && (
        <p id={problemId} role="alert" className="text-sm text-[var(--danger)]">
          {problem}
        </p>
      )}
    </div>
  );
}
