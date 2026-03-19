import { sql } from '@/lib/db';

export async function GET() {
  const [settings] = await sql`SELECT * FROM app_settings LIMIT 1`;
  return Response.json({ settings: settings ?? null });
}

export async function PATCH(request: Request) {
  const updates = await request.json();
  const [settings] = await sql`SELECT * FROM app_settings LIMIT 1`;
  if (!settings) {
    return Response.json({ error: 'No settings found' }, { status: 404 });
  }

  const merged = { ...settings, ...updates };
  await sql`UPDATE app_settings SET
    default_template = ${merged.default_template},
    default_board_settings = ${JSON.stringify(merged.default_board_settings)},
    app_name = ${merged.app_name},
    app_logo_url = ${merged.app_logo_url},
    board_retention_days = ${merged.board_retention_days}
    WHERE id = ${settings.id}`;

  const [updated] = await sql`SELECT * FROM app_settings LIMIT 1`;
  return Response.json({ settings: updated });
}
