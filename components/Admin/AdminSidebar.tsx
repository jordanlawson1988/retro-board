'use client';

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Flag, Kanban, Settings, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { href: '/admin/features', label: 'Feature Flags', icon: Flag },
  { href: '/admin/boards', label: 'Boards', icon: Kanban },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const { adminUser, signOut } = useAuthStore();

  return (
    <aside className="flex h-screen w-60 flex-col bg-[var(--color-gray-8)] text-[var(--color-gray-3)]">
      <div className="border-b border-[var(--color-gray-7)] px-4 py-4">
        <h2 className="text-sm font-semibold text-white">RetroBoard Admin</h2>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-l-3 border-[var(--color-primary)] bg-white/5 text-white'
                  : 'border-l-3 border-transparent hover:bg-white/5 hover:text-white'
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-gray-7)] p-4">
        <div className="mb-3 text-xs text-[var(--color-gray-4)]">
          {adminUser?.email}
        </div>
        <div className="flex flex-col gap-1">
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--color-gray-4)] hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to App
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--color-gray-4)] hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
