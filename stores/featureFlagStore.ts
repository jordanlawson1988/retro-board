'use client';

import { create } from 'zustand';
import type { FeatureFlag } from '@/types';

interface FeatureFlagState {
  flags: FeatureFlag[];
  loading: boolean;
  error: string | null;

  fetchFlags: () => Promise<void>;
  updateFlag: (id: string, is_enabled: boolean) => Promise<void>;
  isEnabled: (key: string) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: [],
  loading: false,
  error: null,

  fetchFlags: async () => {
    set({ loading: true, error: null });

    try {
      const res = await fetch('/api/feature-flags');
      if (!res.ok) {
        set({ loading: false, error: 'Failed to fetch feature flags' });
        return;
      }
      const { flags } = await res.json();
      set({ flags: flags as FeatureFlag[], loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch feature flags' });
    }
  },

  updateFlag: async (id, is_enabled) => {
    // Optimistic update
    set((state) => ({
      flags: state.flags.map((f) =>
        f.id === id ? { ...f, is_enabled, updated_at: new Date().toISOString() } : f
      ),
    }));

    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_enabled }),
      });

      if (!res.ok) {
        // Revert on failure
        set((state) => ({
          flags: state.flags.map((f) =>
            f.id === id ? { ...f, is_enabled: !is_enabled } : f
          ),
        }));
        throw new Error('Failed to update feature flag');
      }
    } catch (err) {
      // Revert on failure
      set((state) => ({
        flags: state.flags.map((f) =>
          f.id === id ? { ...f, is_enabled: !is_enabled } : f
        ),
      }));
      throw err;
    }
  },

  isEnabled: (key) => {
    const flag = get().flags.find((f) => f.key === key);
    return flag?.is_enabled ?? true; // Default to enabled if flag not found
  },
}));
