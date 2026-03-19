'use client';

import { useEffect } from 'react';
import { Info } from 'lucide-react';
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
import { FeatureFlagCard } from '@/components/Admin/FeatureFlagCard';

export function AdminFeaturesPage() {
  const { flags, loading, fetchFlags, updateFlag } = useFeatureFlagStore();

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateFlag(id, enabled);
    } catch (err) {
      console.error('Failed to update flag:', err);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Feature Flags</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">Toggle features on or off for your application</p>

      {loading ? (
        <div className="mt-6 text-sm text-[var(--color-gray-5)]">Loading flags...</div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {flags.map((flag) => (
            <FeatureFlagCard key={flag.id} flag={flag} onToggle={handleToggle} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-3 text-sm text-[var(--color-info)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>Feature flags take effect immediately for new board sessions. Active boards will pick up changes on their next polling cycle or page refresh.</span>
      </div>
    </div>
  );
}
