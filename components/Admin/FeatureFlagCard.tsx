'use client';

import type { FeatureFlag } from '@/types';

interface FeatureFlagCardProps {
  flag: FeatureFlag;
  onToggle: (id: string, enabled: boolean) => void;
}

export function FeatureFlagCard({ flag, onToggle }: FeatureFlagCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-gray-8)]">{flag.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              flag.is_enabled
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
            }`}>
              {flag.is_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {flag.description && (
            <p className="mt-1 text-sm text-[var(--color-gray-5)]">{flag.description}</p>
          )}
          <div className="mt-3 flex gap-4 text-xs text-[var(--color-gray-4)]">
            <span>
              Key: <code className="rounded bg-[var(--color-gray-1)] px-1 py-0.5 text-xs">{flag.key}</code>
            </span>
            <span>
              Last toggled: {new Date(flag.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <button
          onClick={() => onToggle(flag.id, !flag.is_enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            flag.is_enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-3)]'
          }`}
          role="switch"
          aria-checked={flag.is_enabled}
          aria-label={`Toggle ${flag.name}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              flag.is_enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
