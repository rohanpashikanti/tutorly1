import { Hono } from 'hono';
import { Env, authenticateInstitution } from '../middleware';

export const dashboardRouter = new Hono<{ Bindings: Env }>();

dashboardRouter.get('/:institutionId/dashboard/summary', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Total counts
  const counts = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM students WHERE institution_id = ? AND deleted_at IS NULL AND status != 'withdrawn') AS total_students,
            (SELECT COUNT(*) FROM teachers WHERE institution_id = ? AND status = 'active') AS total_teachers,
            (SELECT COUNT(*) FROM classes WHERE institution_id = ? AND deleted_at IS NULL) AS total_classes,
            (SELECT COUNT(*) FROM batches WHERE institution_id = ? AND status != 'archived') AS total_batches`
  )
    .bind(instId, instId, instId, instId)
    .first<{
      total_students: number;
      total_teachers: number;
      total_classes: number;
      total_batches: number;
    }>();

  // 2. Today's attendance metrics
  const todayStr = new Date().toISOString().slice(0, 10);
  const attSummary = await DB.prepare(
    `SELECT COUNT(ar.id) AS total_marked,
            SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_count,
            SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent_count
     FROM attendance_sessions s
     JOIN attendance_records ar ON ar.session_id = s.id AND ar.institution_id = s.institution_id
     WHERE s.institution_id = ? AND s.session_date = ?`
  )
    .bind(instId, todayStr)
    .first<{ total_marked: number; present_count: number; absent_count: number }>();

  let todayRate = 0;
  let presentCount = 0;
  let absentCount = 0;

  if (attSummary && attSummary.total_marked > 0) {
    todayRate = Math.round((attSummary.present_count / attSummary.total_marked) * 100);
    presentCount = attSummary.present_count;
    absentCount = attSummary.absent_count;
  }

  // 3. Fee metrics (This Month, Last Month)
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`;
  const feeCurrentMonth = await DB.prepare(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total_paise
     FROM payments
     WHERE institution_id = ? AND status = 'received' AND received_at >= ?`
  )
    .bind(instId, currentMonthStart)
    .first<{ total_paise: number }>();

  const currentMonthCollectedRupees = Math.round((feeCurrentMonth?.total_paise ?? 0) / 100);
  const displayFeeRupees = currentMonthCollectedRupees;

  // 4. Monthly collection trends (last 6 months)
  const monthlyTrendsRaw = await DB.prepare(
    `SELECT strftime('%Y-%m', received_at) AS month_key,
            SUM(amount_paise) AS paise
     FROM payments
     WHERE institution_id = ? AND status = 'received'
     GROUP BY strftime('%Y-%m', received_at)
     ORDER BY month_key DESC
     LIMIT 6`
  )
    .bind(instId)
    .all<{ month_key: string; paise: number }>();

  // 5. Upcoming events
  const upcomingEventsRaw = await DB.prepare(
    `SELECT id, title, event_type, starts_at, description
     FROM calendar_events
     WHERE institution_id = ? AND status != 'archived' AND starts_at >= ?
     ORDER BY starts_at ASC
     LIMIT 4`
  )
    .bind(instId, todayStr)
    .all<{ id: string; title: string; event_type: string; starts_at: string; description: string | null }>();

  return c.json({
    stats: {
      totalStudents: counts?.total_students || 0,
      totalTeachers: counts?.total_teachers || 0,
      totalClasses: counts?.total_classes || 0,
      totalBatches: counts?.total_batches || 0,
      todayAttendanceRate: todayRate,
      todayPresentCount: presentCount,
      todayAbsentCount: absentCount,
      currentMonthFees: displayFeeRupees,
    },
    upcomingEvents: upcomingEventsRaw.results,
    monthlyCollections: monthlyTrendsRaw.results,
  });
});
