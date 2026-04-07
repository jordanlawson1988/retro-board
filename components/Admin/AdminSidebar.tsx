'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Flag, Kanban, Settings, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/features', label: 'Feature Flags', icon: Flag },
  { href: '/admin/boards', label: 'Boards', icon: Kanban },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const { adminUser, signOut } = useAuthStore();
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-white/10 bg-[var(--color-navy-pressed)] text-white/70 shadow-lg">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-sm font-semibold text-white tracking-wide">RetroBoard Admin</h2>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors',
              isActive(item.href, item.exact)
                ? 'bg-white/15 text-white font-medium shadow-sm'
                : 'hover:bg-white/10 hover:text-white'
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 truncate text-xs text-white/50">
          {adminUser?.email}
        </div>
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-white/50 no-underline hover:bg-white/10 hover:text-white hover:no-underline transition-colors"
          >
            <ArrowLeft size={14} />
            Back to App
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
