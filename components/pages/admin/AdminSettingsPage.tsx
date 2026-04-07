'use client';

import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { Button } from '@/components/common';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { BOARD_TEMPLATES } from '@/utils/templates';
import type { BoardTemplate } from '@/types';

export function AdminSettingsPage() {
  const { settings, loading, fetchSettings, updateSettings } = useAppSettingsStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [cardVisibility, setCardVisibility] = useState<'hidden' | 'visible'>('hidden');
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [maxVotes, setMaxVotes] = useState(5);
  const [secretVoting, setSecretVoting] = useState(false);
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync form state when settings load
  useEffect(() => {
    if (!settings) return;
    setAppName(settings.app_name);
    setLogoUrl(settings.app_logo_url ?? '');
    setDefaultTemplate(settings.default_template);

    const bs = settings.default_board_settings;
    if (bs.card_visibility) setCardVisibility(bs.card_visibility);
    if (bs.voting_enabled !== undefined) setVotingEnabled(bs.voting_enabled);
    if (bs.max_votes_per_participant !== undefined) setMaxVotes(bs.max_votes_per_participant);
    if (bs.secret_voting !== undefined) setSecretVoting(bs.secret_voting);

    setRetentionEnabled(settings.board_retention_days !== null);
    setRetentionDays(settings.board_retention_days ?? 90);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        app_name: appName,
        app_logo_url: logoUrl || null,
        default_template: defaultTemplate,
        default_board_settings: {
          card_visibility: cardVisibility,
          voting_enabled: votingEnabled,
          max_votes_per_participant: maxVotes,
          secret_voting: secretVoting,
          board_locked: false,
          card_creation_disabled: false,
          anonymous_cards: false,
        },
        board_retention_days: retentionEnabled ? retentionDays : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--color-gray-5)]">Loading settings...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-gray-5)]">Configure application-wide defaults and branding</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Branding */}
        <Section title="Branding" subtitle="Customize the look and name of your instance">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-gray-7)]">Application Name</label>
              <input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-gray-8)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-gray-7)]">
                Logo URL <span className="font-normal text-[var(--color-gray-4)]">(optional)</span>
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.svg"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-gray-8)] placeholder:text-[var(--color-gray-4)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Default Template */}
        <Section title="Default Board Template" subtitle="Pre-selected template when users create a new board">
          <div className="flex flex-wrap gap-2">
            {BOARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setDefaultTemplate(t.id)}
                className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${
                  defaultTemplate === t.id
                    ? 'bg-[var(--color-info)]/10 border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border border-[var(--color-gray-2)] text-[var(--color-gray-6)] hover:border-[var(--color-gray-3)]'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Default Board Settings */}
        <Section title="Default Board Settings" subtitle="Applied to every new board unless the facilitator changes them">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingRow label="Card Visibility" description="Start cards hidden or visible">
              <div className="flex rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-gray-1)] p-0.5">
                {(['hidden', 'visible'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCardVisibility(v)}
                    className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      cardVisibility === v
                        ? 'bg-[var(--color-gray-8)] text-white'
                        : 'text-[var(--color-gray-5)]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow label="Voting Enabled" description="Allow participants to vote on cards">
              <Toggle checked={votingEnabled} onChange={setVotingEnabled} />
            </SettingRow>

            <SettingRow label="Max Votes per Participant" description="Limit how many votes each person gets">
              <input
                type="number"
                min={1}
                max={99}
                value={maxVotes}
                onChange={(e) => setMaxVotes(Number(e.target.value))}
                className="w-16 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-2 py-1 text-center text-sm text-[var(--color-gray-8)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </SettingRow>

            <SettingRow label="Secret Voting" description="Hide vote counts until revealed">
              <Toggle checked={secretVoting} onChange={setSecretVoting} />
            </SettingRow>
          </div>
        </Section>

        {/* Board Retention */}
        <Section title="Board Retention" subtitle="Automatically clean up old boards to save storage">
          <div className="flex items-center gap-3">
            <Toggle checked={retentionEnabled} onChange={setRetentionEnabled} />
            <span className="text-sm text-[var(--color-gray-6)]">Auto-delete completed boards after</span>
            <input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              disabled={!retentionEnabled}
              className="w-16 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-2 py-1 text-center text-sm text-[var(--color-gray-8)] disabled:opacity-40 focus:border-[var(--color-primary)] focus:outline-none"
            />
            <span className="text-sm text-[var(--color-gray-6)]">days</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-gray-4)]">
            When disabled, boards are kept indefinitely. Only completed boards are affected.
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]" style={{ color: '#92700c' }}>
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Auto-deletion is not yet active. This setting will be used when the scheduled cleanup job is implemented.</span>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5">
      <h2 className="text-base font-semibold text-[var(--color-gray-8)]">{title}</h2>
      <p className="mt-0.5 text-sm text-[var(--color-gray-5)]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-gray-1)] py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-gray-7)]">{label}</p>
        <p className="text-xs text-[var(--color-gray-4)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-3)]'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}
