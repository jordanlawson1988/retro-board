'use client';

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import type { AdminUser, User, Subscription } from '@/types';

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string, redirectTo?: string) => Promise<string>;
  signUp: (email: string, password: string, name: string) => Promise<string>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  adminUser: null,
  subscription: null,
  loading: true,
  error: null,
  isAuthenticated: false,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const session = await authClient.getSession();
      if (!session.data?.user) {
        set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
        return;
      }

      // Check admin access (optional — not all users are admins)
      const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
      const adminUser = adminRes.ok ? await adminRes.json() : null;

      set({
        user: session.data.user,
        adminUser,
        subscription: null, // WS3 will populate this
        loading: false,
        isAuthenticated: true,
      });
    } catch {
      // Network error or auth service unavailable — treat as unauthenticated
      set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
    }
  },

  signIn: async (email, password, redirectTo) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      throw new Error('Sign in failed');
    }

    // Check admin access (optional)
    const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = adminRes.ok ? await adminRes.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
      isAuthenticated: true,
    });

    return redirectTo || (adminUser ? '/admin' : '/dashboard');
  },

  signUp: async (email, password, name) => {
    set({ loading: true, error: null });
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign up failed' });
      throw new Error('Sign up failed');
    }

    set({
      user: session.data.user,
      adminUser: null,
      loading: false,
      isAuthenticated: true,
    });

    return '/dashboard';
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null, adminUser: null, subscription: null, loading: false, error: null, isAuthenticated: false });
  },
}));
