# WS4: Enhanced Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF export, image screenshot export, and print-friendly CSS. PDF and image export are Pro-tier features; print is free.

**Architecture:** PDF generated server-side via `@react-pdf/renderer` (no headless browser). Image export via `html-to-image` client-side. Print via `@media print` CSS + `react-to-print` hook.

**Tech Stack:** @react-pdf/renderer, html-to-image, react-to-print, Next.js 16 API routes

**Depends on:** WS1 (user accounts — for auth check), WS3 (subscription — for tier gating)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/pdf/BoardPdfDocument.tsx` | React PDF document layout for board export |
| `app/api/boards/[boardId]/export/pdf/route.ts` | Server-side PDF generation endpoint |
| `components/Board/ExportMenu.tsx` | Export dropdown with format options (replaces current export buttons) |
| `styles/print.css` | Print-specific CSS rules |

### Modified Files
| File | Changes |
|------|---------|
| `utils/export.ts` | Add image export function using html-to-image |
| `styles/index.css` | Import print.css |

---

### Task 1: Install Dependencies

- [ ] **Step 1: Install export packages**

Run: `npm install @react-pdf/renderer html-to-image react-to-print`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install PDF, image, and print export dependencies"
```

---

### Task 2: PDF Document Component

**Files:**
- Create: `lib/pdf/BoardPdfDocument.tsx`

- [ ] **Step 1: Create the PDF layout**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#004F71' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 4 },
  meta: { fontSize: 9, color: '#999', marginTop: 8 },
  columnSection: { marginBottom: 16 },
  columnTitle: { fontSize: 14, fontWeight: 'bold', color: '#004F71', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  card: { marginBottom: 6, padding: 8, backgroundColor: '#F8F8F8', borderRadius: 4 },
  cardText: { fontSize: 10, color: '#333' },
  cardMeta: { fontSize: 8, color: '#999', marginTop: 2 },
  actionSection: { marginTop: 20 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#004F71', marginBottom: 8 },
  actionRow: { flexDirection: 'row', marginBottom: 4, fontSize: 10 },
  actionStatus: { width: 60, color: '#666' },
  actionDesc: { flex: 1, color: '#333' },
  actionAssignee: { width: 80, color: '#666' },
  actionDue: { width: 70, color: '#666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#BBB', flexDirection: 'row', justifyContent: 'space-between' },
  noCards: { fontSize: 10, color: '#999', fontStyle: 'italic' },
});

interface PdfBoardData {
  title: string;
  description: string | null;
  template: string;
  createdAt: string;
  columns: { id: string; title: string; position: number }[];
  cards: { id: string; column_id: string; text: string; author_name: string; position: number; vote_count: number }[];
  actionItems: { description: string; assignee: string | null; due_date: string | null; status: string }[];
  participantCount: number;
  totalVotes: number;
}

export function BoardPdfDocument({ data }: { data: PdfBoardData }) {
  const sortedColumns = [...data.columns].sort((a, b) => a.position - b.position);
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.title}</Text>
          {data.description && <Text style={styles.subtitle}>{data.description}</Text>}
          <Text style={styles.meta}>
            Template: {data.template} | Participants: {data.participantCount} | Total votes: {data.totalVotes}
          </Text>
        </View>

        {/* Columns + Cards */}
        {sortedColumns.map((col) => {
          const colCards = data.cards
            .filter((c) => c.column_id === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <View key={col.id} style={styles.columnSection}>
              <Text style={styles.columnTitle}>{col.title}</Text>
              {colCards.length === 0 ? (
                <Text style={styles.noCards}>No cards</Text>
              ) : (
                colCards.map((card) => (
                  <View key={card.id} style={styles.card}>
                    <Text style={styles.cardText}>{card.text}</Text>
                    <Text style={styles.cardMeta}>
                      {card.author_name}{card.vote_count > 0 ? ` — ${card.vote_count} vote${card.vote_count !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Action Items */}
        {data.actionItems.length > 0 && (
          <View style={styles.actionSection}>
            <Text style={styles.actionTitle}>Action Items</Text>
            {data.actionItems.map((item, i) => (
              <View key={i} style={styles.actionRow}>
                <Text style={styles.actionStatus}>[{item.status}]</Text>
                <Text style={styles.actionDesc}>{item.description}</Text>
                <Text style={styles.actionAssignee}>{item.assignee || '—'}</Text>
                <Text style={styles.actionDue}>{item.due_date || '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Exported {exportDate} from RetroBoard</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pdf/BoardPdfDocument.tsx
git commit -m "feat: add React PDF document template for board export"
```

---

### Task 3: PDF Export API Route

**Files:**
- Create: `app/api/boards/[boardId]/export/pdf/route.ts`

- [ ] **Step 1: Create the PDF generation endpoint**

```typescript
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { BoardPdfDocument } from '@/lib/pdf/BoardPdfDocument';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getPlanTier } from '@/lib/subscription';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  // Auth check
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Subscription check: PDF export is Pro-only
  const tier = await getPlanTier(session.user.id);
  if (tier !== 'pro') {
    return NextResponse.json(
      { error: 'PDF export requires a Pro subscription', code: 'PRO_REQUIRED' },
      { status: 402 }
    );
  }

  // Fetch board data
  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const columns = await sql`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position`;
  const cards = await sql`
    SELECT c.*, COALESCE(v.vote_count, 0) AS vote_count
    FROM cards c
    LEFT JOIN (SELECT card_id, COUNT(*) AS vote_count FROM votes GROUP BY card_id) v ON c.id = v.card_id
    WHERE c.board_id = ${boardId}
    ORDER BY c.position
  `;
  const actionItems = await sql`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`;
  const [participantCount] = await sql`SELECT COUNT(*) AS count FROM participants WHERE board_id = ${boardId}`;
  const [voteCount] = await sql`SELECT COUNT(*) AS count FROM votes WHERE board_id = ${boardId}`;

  const pdfData = {
    title: board.title,
    description: board.description,
    template: board.template,
    createdAt: board.created_at,
    columns,
    cards,
    actionItems,
    participantCount: parseInt(participantCount.count, 10),
    totalVotes: parseInt(voteCount.count, 10),
  };

  // Generate PDF
  const buffer = await renderToBuffer(<BoardPdfDocument data={pdfData} />);

  const slug = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}-retro.pdf"`,
    },
  });
}
```

- [ ] **Step 2: Create directory structure**

Run: `mkdir -p app/api/boards/\[boardId\]/export/pdf`

- [ ] **Step 3: Commit**

```bash
git add app/api/boards/[boardId]/export/pdf/route.ts
git commit -m "feat: add PDF export API route with subscription gating"
```

---

### Task 4: Image Export Utility

**Files:**
- Modify: `utils/export.ts`

- [ ] **Step 1: Add image export function**

Add to the end of `utils/export.ts`:

```typescript
import { toPng } from 'html-to-image';

/**
 * Capture the board container as a PNG image and trigger download.
 * @param element - The board container DOM element (use a ref)
 * @param filename - Download filename
 */
export async function exportImage(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, {
    backgroundColor: '#F4F1EC', // warm-white background
    pixelRatio: 2, // retina quality
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/export.ts
git commit -m "feat: add image export utility using html-to-image"
```

---

### Task 5: Print CSS

**Files:**
- Create: `styles/print.css`
- Modify: `styles/index.css`

- [ ] **Step 1: Create print stylesheet**

```css
/* styles/print.css — Print-specific overrides */
@media print {
  /* Hide interactive elements */
  header,
  nav,
  .theme-toggle,
  .facilitator-toolbar,
  .add-card-form,
  .board-controls,
  .timer-display,
  .action-items-panel button,
  [data-no-print] {
    display: none !important;
  }

  /* Reset layout for print */
  body {
    background: white !important;
    color: black !important;
    font-size: 11pt;
  }

  main {
    padding: 0 !important;
  }

  /* Board columns flow naturally */
  .board-columns {
    display: block !important;
    columns: 2;
    column-gap: 24pt;
  }

  .board-column {
    break-inside: avoid;
    margin-bottom: 16pt;
  }

  /* Cards print cleanly */
  .retro-card {
    break-inside: avoid;
    border: 1pt solid #ccc;
    padding: 6pt;
    margin-bottom: 6pt;
    box-shadow: none !important;
  }

  /* Action items table */
  .action-items-panel {
    break-before: page;
  }

  /* Page setup */
  @page {
    margin: 0.75in;
    size: letter;
  }
}
```

- [ ] **Step 2: Import print.css in main stylesheet**

In `styles/index.css`, add at the top (after any existing imports):

```css
@import './print.css';
```

- [ ] **Step 3: Commit**

```bash
git add styles/print.css styles/index.css
git commit -m "feat: add print-friendly CSS for board export"
```

---

### Task 6: Export Menu Component

**Files:**
- Create: `components/Board/ExportMenu.tsx`

- [ ] **Step 1: Create the export dropdown**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, Image, Printer, Lock, FileDown } from 'lucide-react';
import { useBoardStore } from '@/stores/boardStore';
import { useAuthStore } from '@/stores/authStore';
import { exportMarkdown, exportCsv, exportImage } from '@/utils/export';
import { useReactToPrint } from 'react-to-print';

interface ExportMenuProps {
  boardRef: React.RefObject<HTMLElement | null>;
}

export function ExportMenu({ boardRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { board, columns, cards, votes, actionItems } = useBoardStore();
  const { isAuthenticated } = useAuthStore();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handlePrint = useReactToPrint({ contentRef: boardRef });

  if (!board) return null;

  const exportData = {
    boardTitle: board.title,
    boardDescription: board.description,
    columns,
    cards,
    votes,
    actionItems,
  };

  const slug = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/export/pdf`, { method: 'POST' });
      if (res.status === 402) {
        window.location.href = '/pricing';
        return;
      }
      if (!res.ok) throw new Error('PDF export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-retro.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleImageExport = async () => {
    if (!boardRef.current) return;
    // Check subscription first
    const usageRes = await fetch('/api/user/usage');
    if (usageRes.ok) {
      const usage = await usageRes.json();
      if (usage.tier !== 'pro') {
        window.location.href = '/pricing';
        return;
      }
    }
    await exportImage(boardRef.current, `${slug}-retro.png`);
    setOpen(false);
  };

  const isPro = true; // WS3 will wire this up; for now show all options

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-sm font-medium text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
        title="Export board"
      >
        <Download size={16} /> Export
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] py-1 shadow-lg">
          <button
            onClick={() => { exportMarkdown(exportData); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
          >
            <FileText size={16} /> Markdown
          </button>
          <button
            onClick={() => { exportCsv(exportData); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
          >
            <Table size={16} /> CSV
          </button>
          <button
            onClick={() => { handlePrint(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
          >
            <Printer size={16} /> Print
          </button>
          <div className="my-1 border-t border-[var(--color-gray-1)]" />
          <button
            onClick={handlePdfExport}
            disabled={pdfLoading}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)] disabled:opacity-50"
          >
            <FileDown size={16} /> {pdfLoading ? 'Generating...' : 'PDF'}
            {!isPro && <Lock size={12} className="ml-auto text-[var(--color-gray-4)]" />}
          </button>
          <button
            onClick={handleImageExport}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
          >
            <Image size={16} /> Screenshot (PNG)
            {!isPro && <Lock size={12} className="ml-auto text-[var(--color-gray-4)]" />}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ExportMenu to Board barrel export**

In `components/Board/index.ts`, add: `export { ExportMenu } from './ExportMenu';`

- [ ] **Step 3: Commit**

```bash
git add components/Board/ExportMenu.tsx components/Board/index.ts
git commit -m "feat: add ExportMenu with PDF, image, print, Markdown, and CSV options"
```

---

### Task 7: Wire ExportMenu into Board Page

**Files:**
- Modify: `components/pages/BoardPage.tsx` (or wherever the board header controls are)

- [ ] **Step 1: Read the current BoardPage to find where export controls are**

- [ ] **Step 2: Add a ref to the board container and pass it to ExportMenu**

Add `useRef` for the board container:
```typescript
const boardRef = useRef<HTMLDivElement>(null);
```

Wrap the board content area with `ref={boardRef}`.

Add `<ExportMenu boardRef={boardRef} />` to the board header controls area (next to existing share button, view toggle, etc.)

- [ ] **Step 3: Commit**

```bash
git add components/pages/BoardPage.tsx
git commit -m "feat: wire ExportMenu into board page header"
```

---

### Task 8: Verify and Test

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test checklist**

1. Open a board → Export dropdown appears in header
2. Click Markdown → `.md` file downloads
3. Click CSV → `.csv` file downloads
4. Click Print → browser print dialog opens with clean layout
5. Click PDF (as Pro user) → `.pdf` file downloads with formatted board data
6. Click PDF (as Free user) → redirected to /pricing
7. Click Screenshot → `.png` file downloads with board visual
8. PDF has: title, description, columns with cards, votes, action items, footer

- [ ] **Step 4: Commit any fixes**
