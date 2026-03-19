import type { Column, Card, Vote, ActionItem } from '@/types';

interface ExportData {
  boardTitle: string;
  boardDescription: string | null;
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMarkdown(data: ExportData): void {
  const { boardTitle, boardDescription, columns, cards, votes, actionItems } = data;

  const lines: string[] = [];
  lines.push(`# ${boardTitle}`);
  if (boardDescription) lines.push(`\n${boardDescription}`);
  lines.push('');

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  for (const col of sortedColumns) {
    lines.push(`## ${col.title}`);
    if (col.description) lines.push(`*${col.description}*`);
    lines.push('');

    const colCards = cards
      .filter((c) => c.column_id === col.id)
      .sort((a, b) => a.position - b.position);

    if (colCards.length === 0) {
      lines.push('*No cards*');
    } else {
      for (const card of colCards) {
        const voteCount = votes.filter((v) => v.card_id === card.id).length;
        const voteSuffix = voteCount > 0 ? ` (${voteCount} vote${voteCount !== 1 ? 's' : ''})` : '';
        lines.push(`- ${card.text}${voteSuffix} — *${card.author_name}*`);
      }
    }
    lines.push('');
  }

  if (actionItems.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    for (const item of actionItems) {
      const checkbox = item.status === 'done' ? '[x]' : '[ ]';
      const assignee = item.assignee ? ` @${item.assignee}` : '';
      const due = item.due_date ? ` (due: ${item.due_date})` : '';
      lines.push(`- ${checkbox} ${item.description}${assignee}${due}`);
    }
    lines.push('');
  }

  const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  triggerDownload(lines.join('\n'), `${slug}-retro.md`, 'text/markdown');
}

export function exportCsv(data: ExportData): void {
  const { boardTitle, columns, cards, votes, actionItems } = data;

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const lines: string[] = [];

  // Cards section
  lines.push('Column,Card,Author,Votes');
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  for (const col of sortedColumns) {
    const colCards = cards
      .filter((c) => c.column_id === col.id)
      .sort((a, b) => a.position - b.position);

    for (const card of colCards) {
      const voteCount = votes.filter((v) => v.card_id === card.id).length;
      lines.push(`${escape(col.title)},${escape(card.text)},${escape(card.author_name)},${voteCount}`);
    }
  }

  // Action items section
  if (actionItems.length > 0) {
    lines.push('');
    lines.push('Action Item,Assignee,Due Date,Status');
    for (const item of actionItems) {
      lines.push(
        `${escape(item.description)},${escape(item.assignee || '')},${escape(item.due_date || '')},${escape(item.status)}`
      );
    }
  }

  const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  triggerDownload(lines.join('\n'), `${slug}-retro.csv`, 'text/csv');
}
