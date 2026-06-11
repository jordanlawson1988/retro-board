'use client';

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import { ANTI_BOT_HEADERS } from '@/lib/anti-bot/constants';
import { encodeHoneypotHeader, type HoneypotPayload } from '@/lib/anti-bot/honeypot';
import type { AdminUser, User, Subscription } from '@/types';

export interface AntiBotPayload {
  /** Token issued by the Cloudflare Turnstile widget. */
  captchaToken: string;
  /** Honeypot field value + mountedAt timestamp. */
  honeypot: HoneypotPayload;
}

function buildAntiBotHeaders(antiBot: AntiBotPayload): Record<string, string> {
  return {
    [ANTI_BOT_HEADERS.CAPTCHA_RESPONSE]: antiBot.captchaToken,
    [ANTI_BOT_HEADERS.HONEYPOT]: encodeHoneypotHeader(antiBot.honeypot),
  };
}

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string, antiBot: AntiBotPayload, redirectTo?: string) => Promise<string>;
  signUp: (email: string, password: string, name: string, antiBot: AntiBotPayload) => Promise<string>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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

      const adminRes = await fetch('/api/admin/verify');
      const adminUser = adminRes.ok ? await adminRes.json() : null;

      set({
        user: session.data.user,
        adminUser,
        subscription: null,
        loading: false,
        isAuthenticated: true,
      });
    } catch {
      set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
    }
  },

  signIn: async (email, password, antiBot, redirectTo) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email(
      { email, password },
      { headers: buildAntiBotHeaders(antiBot) }
    );
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      throw new Error('Sign in failed');
    }

    const adminRes = await fetch('/api/admin/verify');
    const adminUser = adminRes.ok ? await adminRes.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
      isAuthenticated: true,
    });

    return redirectTo || '/dashboard';
  },

  signUp: async (email, password, name, antiBot) => {
    set({ loading: true, error: null });
    const result = await authClient.signUp.email(
      { email, password, name },
      { headers: buildAntiBotHeaders(antiBot) }
    );
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
