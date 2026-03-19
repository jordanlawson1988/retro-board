'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
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

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    set({ settings: data as AppSettings, loading: false });
  },

  updateSettings: async (updates) => {
    const prev = get().settings;
    if (!prev) return;

    // Optimistic update
    const updated = { ...prev, ...updates, updated_at: new Date().toISOString() };
    set({ settings: updated });

    const { error } = await supabase
      .from('app_settings')
      .update(updates)
      .eq('id', prev.id);

    if (error) {
      set({ settings: prev });
      throw error;
    }
  },
}));
