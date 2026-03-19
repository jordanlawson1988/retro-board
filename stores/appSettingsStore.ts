'use client';

import { create } from 'zustand';
import type { AppSettings } from '@/types';

interface AppSettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Omit<AppSettings, 'id' | 'updated_at'>>) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });

    try {
      const res = await fetch('/api/admin/app-settings');
      if (!res.ok) {
        set({ loading: false, error: 'Failed to fetch settings' });
        return;
      }
      const { settings } = await res.json();
      set({ settings: settings as AppSettings, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch settings' });
    }
  },

  updateSettings: async (updates) => {
    const prev = get().settings;
    if (!prev) return;

    // Optimistic update
    const updated = { ...prev, ...updates, updated_at: new Date().toISOString() };
    set({ settings: updated });

    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        set({ settings: prev });
        throw new Error('Failed to update settings');
      }

      const { settings } = await res.json();
      set({ settings: settings as AppSettings });
    } catch (err) {
      set({ settings: prev });
      throw err;
    }
  },
}));
