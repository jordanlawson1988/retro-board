'use client';

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import type { AdminUser } from '@/types';

interface AuthState {
  user: { id: string; email: string; name: string } | null;
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
    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    // Check admin access
    const res = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = res.ok ? await res.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      return;
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      return;
    }

    // Verify admin access
    const res = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    if (!res.ok) {
      await authClient.signOut();
      set({ loading: false, error: 'You do not have admin access' });
      return;
    }

    const adminUser = await res.json();
    set({ user: session.data.user, adminUser, loading: false });
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null, adminUser: null, loading: false, error: null });
  },
}));
