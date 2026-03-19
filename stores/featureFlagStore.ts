'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
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
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at');

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    set({ flags: data as FeatureFlag[], loading: false });
  },

  updateFlag: async (id, is_enabled) => {
    // Optimistic update
    set((state) => ({
      flags: state.flags.map((f) =>
        f.id === id ? { ...f, is_enabled, updated_at: new Date().toISOString() } : f
      ),
    }));

    const { error } = await supabase
      .from('feature_flags')
      .update({ is_enabled })
      .eq('id', id);

    if (error) {
      // Revert on failure
      set((state) => ({
        flags: state.flags.map((f) =>
          f.id === id ? { ...f, is_enabled: !is_enabled } : f
        ),
      }));
      throw error;
    }
  },

  isEnabled: (key) => {
    const flag = get().flags.find((f) => f.key === key);
    return flag?.is_enabled ?? true; // Default to enabled if flag not found
  },
}));
