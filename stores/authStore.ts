'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AdminUser } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  adminUser: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    // Verify user is in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !adminUser) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    set({
      user: session.user,
      adminUser: adminUser as AdminUser,
      loading: false,
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      set({ loading: false, error: authError.message });
      return;
    }

    if (!data.user) {
      set({ loading: false, error: 'Sign in failed' });
      return;
    }

    // Verify admin access
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      set({ loading: false, error: 'You do not have admin access' });
      return;
    }

    set({
      user: data.user,
      adminUser: adminUser as AdminUser,
      loading: false,
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, adminUser: null, loading: false, error: null });
  },
}));
