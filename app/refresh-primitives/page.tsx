'use client';

import { Button, Pill, Chip, IconButton, Badge } from '@/components/common';
import { Plus, Settings, Trash2, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

export default function PrimitivesReview() {
  const [activeChip, setActiveChip] = useState<'all' | 'active' | 'completed'>('all');
  return (
    <div className="p-8 space-y-10 max-w-4xl mx-auto">
      <section>
        <h2 className="mb-3">Button — variants</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="accent" loading>Loading</Button>
          <Button variant="accent" disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Button — sizes</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button variant="accent" size="sm">Small</Button>
          <Button variant="accent" size="md">Medium</Button>
          <Button variant="accent" size="lg">Large</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Pill</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Pill>Default</Pill>
          <Pill variant="tinted">Tinted</Pill>
          <Pill variant="bare">Bare</Pill>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Chip (filter)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'active', 'completed'] as const).map((k) => (
            <Chip key={k} active={activeChip === k} onClick={() => setActiveChip(k)}>
              {k}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3">IconButton</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <IconButton size="sm" aria-label="Add"><Plus size={14} /></IconButton>
          <IconButton aria-label="Settings"><Settings size={16} /></IconButton>
          <IconButton size="lg" aria-label="Delete"><Trash2 size={18} /></IconButton>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Badge (legacy → Pill wrapper)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Vote-style (preview for PR 3)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Pill variant="tinted"><ThumbsUp size={12} /> 3</Pill>
          <Pill><ThumbsUp size={12} /> 0</Pill>
        </div>
      </section>
    </div>
  );
}
