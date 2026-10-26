import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const settingsRouter = new Hono<{ Bindings: Env }>();

settingsRouter.get('/:institutionId/settings', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const inst = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.email, i.phone, i.address, i.currency_code, i.timezone,
            s.short_name, s.tagline, s.description, s.website, s.academic_year_label,
            s.academic_start_date, s.academic_end_date, s.default_start_time, s.default_end_time,
            s.working_days_json, s.passing_percentage, s.attendance_threshold, s.term_count,
            s.fee_receipt_prefix, s.default_due_days, s.allow_partial_payments,
            s.attendance_alerts, s.test_result_alerts, s.fee_reminders
     FROM institutions i
     LEFT JOIN institution_settings s ON s.institution_id = i.id
     WHERE i.id = ? AND i.deleted_at IS NULL`
  )
    .bind(auth.institutionId)
    .first<Record<string, unknown>>();

  if (!inst) return c.json({ error: 'Institution not found' }, 404);

  return c.json({
    settings: {
      name: inst.name || '',
      shortName: inst.short_name || '',
      tagline: inst.tagline || '',
      description: inst.description || '',
      email: inst.email || '',
      phone: inst.phone || '',
      address: inst.address || '',
      website: inst.website || '',
      currency: inst.currency_code === 'INR' ? 'INR (₹)' : String(inst.currency_code || 'INR'),
      academicYear: inst.academic_year_label || '2026 - 2027',
      passingPercentage: Number(inst.passing_percentage ?? 40),
      attendanceThreshold: Number(inst.attendance_threshold ?? 75),
      termCount: Number(inst.term_count ?? 2),
      feeReceiptPrefix: (inst.fee_receipt_prefix as string) || 'REC-2026-',
      defaultDueDays: Number(inst.default_due_days ?? 10),
      allowPartialPayments: Boolean(inst.allow_partial_payments ?? 1),
      attendanceAlerts: Boolean(inst.attendance_alerts ?? 1),
      testResultAlerts: Boolean(inst.test_result_alerts ?? 1),
      feeReminders: Boolean(inst.fee_reminders ?? 1),
    },
  });
});

settingsRouter.put('/:institutionId/settings', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : null;
  const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : null;
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const email = typeof body.email === 'string' ? body.email.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const address = typeof body.address === 'string' ? body.address.trim() : null;
  const website = typeof body.website === 'string' ? body.website.trim() : null;
  const academicYear = typeof body.academicYear === 'string' ? body.academicYear.trim() : null;
  const passingPercentage = Number(body.passingPercentage ?? 40);
  const attendanceThreshold = Number(body.attendanceThreshold ?? 75);
  const termCount = Number(body.termCount ?? 2);
  const feeReceiptPrefix = typeof body.feeReceiptPrefix === 'string' ? body.feeReceiptPrefix.trim() : 'REC-2026-';
  const defaultDueDays = Number(body.defaultDueDays ?? 10);
  const allowPartialPayments = body.allowPartialPayments ? 1 : 0;
  const attendanceAlerts = body.attendanceAlerts ? 1 : 0;
  const testResultAlerts = body.testResultAlerts ? 1 : 0;
  const feeReminders = body.feeReminders ? 1 : 0;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE institutions
         SET name = COALESCE(?, name),
             email = ?, phone = ?, address = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).bind(name, email, phone, address, auth.institutionId),
      c.env.DB.prepare(
        `INSERT INTO institution_settings (
           institution_id, short_name, tagline, description, website, academic_year_label,
           passing_percentage, attendance_threshold, term_count, fee_receipt_prefix,
           default_due_days, allow_partial_payments, attendance_alerts, test_result_alerts,
           fee_reminders, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(institution_id) DO UPDATE SET
           short_name = excluded.short_name,
           tagline = excluded.tagline,
           description = excluded.description,
           website = excluded.website,
           academic_year_label = excluded.academic_year_label,
           passing_percentage = excluded.passing_percentage,
           attendance_threshold = excluded.attendance_threshold,
           term_count = excluded.term_count,
           fee_receipt_prefix = excluded.fee_receipt_prefix,
           default_due_days = excluded.default_due_days,
           allow_partial_payments = excluded.allow_partial_payments,
           attendance_alerts = excluded.attendance_alerts,
           test_result_alerts = excluded.test_result_alerts,
           fee_reminders = excluded.fee_reminders,
           updated_at = excluded.updated_at`
      ).bind(
        auth.institutionId,
        shortName,
        tagline,
        description,
        website,
        academicYear,
        passingPercentage,
        attendanceThreshold,
        termCount,
        feeReceiptPrefix,
        defaultDueDays,
        allowPartialPayments,
        attendanceAlerts,
        testResultAlerts,
        feeReminders
      ),
    ]);
  } catch (err) {
    console.error('Settings update error:', err);
    return c.json({ error: 'Failed to update institution settings' }, 500);
  }

  return c.json({ success: true, message: 'Settings saved successfully' });
});
