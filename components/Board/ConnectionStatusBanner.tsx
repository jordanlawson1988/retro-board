'use client';

import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { useBoardStore } from '@/stores/boardStore';

export function ConnectionStatusBanner() {
  const connectionStatus = useBoardStore((s) => s.connectionStatus);

  if (connectionStatus === 'connected') return null;

  if (connectionStatus === 'polling') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-2 text-sm font-medium text-[var(--color-info)]">
          <Radio size={16} />
          <span>Polling mode — updates every 10 seconds</span>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning)]/15 px-4 py-2 text-sm font-medium text-[var(--color-warning)]" style={{ color: '#92700c' }}>
          <WifiOff size={16} />
          <span>Connection lost — reconnecting</span>
          <RefreshCw size={14} className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)]/15 px-4 py-2 text-sm font-medium text-[var(--color-success)]">
        <Wifi size={16} />
        <span>Reconnected — board data refreshed</span>
      </div>
    </div>
  );
}
