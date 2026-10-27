import { Hono } from 'hono';
import {
  Env,
  authenticateInstitution,
  readJson,
  extractIdempotencyKey,
} from '../middleware';

export const feesRouter = new Hono<{ Bindings: Env }>();

async function fingerprintPaymentRequest(payload: {
  studentId: string;
  amountPaise: number;
  method: string;
  notes: string | null;
}): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

feesRouter.get('/:institutionId/fees/plans', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const raw = await c.env.DB.prepare(
    `SELECT id, name, plan_type, amount_paise, frequency, status
     FROM fee_plans
     WHERE institution_id = ? AND deleted_at IS NULL
     ORDER BY name`
  )
    .bind(auth.institutionId)
    .all<{ id: string; name: string; plan_type: string; amount_paise: number; frequency: string; status: string }>();

  const plans = raw.results.map((p) => {
    let typeName: 'Tuition Fee' | 'Special Batch' | 'Subject-wise' | 'Entrance Prep' = 'Tuition Fee';
    if (p.plan_type === 'special_batch') typeName = 'Special Batch';
    else if (p.plan_type === 'subject_wise') typeName = 'Subject-wise';
    else if (p.plan_type === 'entrance_prep') typeName = 'Entrance Prep';

    let freq: 'Monthly' | 'Quarterly' | 'Yearly' | 'One-time' = 'Monthly';
    if (p.frequency === 'quarterly') freq = 'Quarterly';
    else if (p.frequency === 'yearly') freq = 'Yearly';
    else if (p.frequency === 'one_time') freq = 'One-time';

    return {
      id: p.id,
      name: p.name,
      type: typeName,
      classes: 'Class 9 - 10',
      amount: Math.round(p.amount_paise / 100),
      frequency: freq,
      status: (p.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
    };
  });

  return c.json({ plans });
});

feesRouter.get('/:institutionId/fees/records', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Query each student's fee summary
  const query = `
    SELECT s.id AS student_id, s.first_name, s.last_name, s.avatar_url,
           c.name AS class_name,
           COALESCE(fa.description, 'Annual Tuition Fee') AS fee_plan_name,
           COALESCE(NULLIF(SUM(fc.amount_paise), 0), fa.agreed_amount_paise, 0) AS total_charges_paise,
           COALESCE((
             SELECT SUM(pa.amount_paise)
             FROM payment_allocations pa
             WHERE pa.student_id = s.id AND pa.institution_id = s.institution_id
           ), 0) AS total_paid_paise,
           MIN(CASE WHEN fc.status IN ('open', 'partial') THEN fc.due_on ELSE NULL END) AS earliest_due,
           (SELECT p.receipt_no FROM payments p WHERE p.student_id = s.id AND p.institution_id = s.institution_id ORDER BY p.received_at DESC LIMIT 1) AS last_receipt_no,
           (SELECT p.method FROM payments p WHERE p.student_id = s.id AND p.institution_id = s.institution_id ORDER BY p.received_at DESC LIMIT 1) AS last_method,
           (SELECT p.received_at FROM payments p WHERE p.student_id = s.id AND p.institution_id = s.institution_id ORDER BY p.received_at DESC LIMIT 1) AS last_payment_date
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN student_fee_assignments fa ON fa.student_id = s.id AND fa.institution_id = s.institution_id AND fa.status = 'active'
    LEFT JOIN fee_charges fc ON fc.student_id = s.id AND fc.institution_id = s.institution_id AND fc.status NOT IN ('waived', 'void')
    WHERE s.institution_id = ? AND s.deleted_at IS NULL
    GROUP BY s.id, s.first_name, s.last_name, s.avatar_url, c.name, fa.description, fa.agreed_amount_paise
    ORDER BY s.roll_no, s.first_name
  `;

  const raw = await DB.prepare(query).bind(instId).all<{
    student_id: string;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
    class_name: string | null;
    fee_plan_name: string;
    total_charges_paise: number;
    total_paid_paise: number;
    earliest_due: string | null;
    last_receipt_no: string | null;
    last_method: string | null;
    last_payment_date: string | null;
  }>();

  const todayStr = new Date().toISOString().slice(0, 10);
  const records = raw.results.map((r, idx) => {
    const totalFees = Math.round(r.total_charges_paise / 100);
    const paidAmount = Math.round(r.total_paid_paise / 100);
    const outstanding = Math.max(0, totalFees - paidAmount);

    let status: 'Paid' | 'Pending' | 'Overdue' = 'Paid';
    let daysOverdue = 0;
    const dueDate = r.earliest_due || '—';

    if (outstanding > 0) {
      if (r.earliest_due && r.earliest_due < todayStr) {
        status = 'Overdue';
        const diffMs = new Date().getTime() - new Date(r.earliest_due).getTime();
        daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      } else {
        status = 'Pending';
      }
    }

    let mappedMethod: 'UPI' | 'Cash' | 'Card' | 'Bank Transfer' | undefined;
    if (r.last_method === 'cash') mappedMethod = 'Cash';
    else if (r.last_method === 'card') mappedMethod = 'Card';
    else if (r.last_method === 'bank_transfer') mappedMethod = 'Bank Transfer';
    else if (r.last_method === 'upi') mappedMethod = 'UPI';

    return {
      id: `fee-rec-${r.student_id}`,
      studentId: r.student_id,
      studentName: `${r.first_name} ${r.last_name || ''}`.trim(),
      avatar:
        r.avatar_url ||
        `https://images.unsplash.com/photo-${1535713875002 + (idx % 10)}?w=150&auto=format&fit=crop&q=80`,
      class: r.class_name || 'Class 10',
      feePlan: r.fee_plan_name,
      totalFees,
      paidAmount,
      outstandingAmount: outstanding,
      dueDate,
      daysOverdue,
      paymentMethod: mappedMethod,
      paymentDate: r.last_payment_date ? r.last_payment_date.slice(0, 10) : undefined,
      transactionId: r.last_receipt_no ? `TXN-${r.last_receipt_no.slice(-6)}` : undefined,
      status,
      receiptNo: r.last_receipt_no || undefined,
    };
  });

  return c.json({ records });
});

feesRouter.post('/:institutionId/fees/payments', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
  const amountRupees = body.amount;
  const methodStr = typeof body.method === 'string' ? body.method.toLowerCase().trim() : '';
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const headerKey = c.req.header('idempotency-key') || c.req.header('x-idempotency-key') || '';
  const idempotencyKey = extractIdempotencyKey(c, body);

  if (!studentId || typeof amountRupees !== 'number' || !Number.isFinite(amountRupees) || amountRupees <= 0) {
    return c.json({ error: 'Student and positive payment amount are required' }, 400);
  }
  const hasControlCharacter = idempotencyKey ? Array.from(idempotencyKey).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint < 0x20 || codePoint === 0x7f;
  }) : false;
  if (!idempotencyKey || idempotencyKey.length > 200 || hasControlCharacter) {
    return c.json({ error: 'A valid idempotency key is required for a payment' }, 400);
  }
  if ((body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') ||
      (bodyKey && headerKey.trim() && bodyKey !== headerKey.trim())) {
    return c.json({ error: 'Invalid payment request' }, 400);
  }
  if (!['upi', 'cash', 'card', 'bank_transfer'].includes(methodStr)) {
    return c.json({ error: 'A supported payment method is required' }, 400);
  }

  const method = methodStr as 'upi' | 'cash' | 'card' | 'bank_transfer';
  const totalPaise = Math.round(amountRupees * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    return c.json({ error: 'Payment amount must be a valid positive amount in paise' }, 400);
  }

  const { DB } = c.env;
  const instId = auth.institutionId;
  const requestHash = await fingerprintPaymentRequest({ studentId, amountPaise: totalPaise, method, notes });
  // The existing table has institution-wide uniqueness; namespacing the stored key scopes
  // this payment operation to the authenticated membership without changing other callers.
  const scopedKey = `fee-payment:${auth.membership.id}:${idempotencyKey}`;
  const endpoint = '/fees/payments';
  const replay = await DB.prepare(
    `SELECT endpoint, actor_membership_id, request_hash, status_code, response_body
     FROM idempotency_keys
     WHERE institution_id = ? AND idempotency_key = ?`
  ).bind(instId, scopedKey).first<{
    endpoint: string;
    actor_membership_id: string | null;
    request_hash: string | null;
    status_code: number | null;
    response_body: string | null;
  }>();
  if (replay) {
    if (replay.endpoint !== endpoint || replay.actor_membership_id !== auth.membership.id || replay.request_hash !== requestHash) {
      return c.json({ error: 'Idempotency key was already used for a different payment request' }, 409);
    }
    if (replay.status_code && replay.response_body) {
      return c.json(JSON.parse(replay.response_body), replay.status_code as any);
    }
    return c.json({ error: 'Payment request is still being resolved; retry with the same key and details' }, 503);
  }

  const student = await DB.prepare(
    `SELECT first_name, last_name FROM students WHERE id = ? AND institution_id = ? AND deleted_at IS NULL`
  ).bind(studentId, instId).first<{ first_name: string; last_name: string | null }>();
  if (!student) return c.json({ error: 'Student not found' }, 404);

  // Preserve the existing short-window guard against accidental distinct-key double clicks.
  const recentDuplicate = await DB.prepare(
    `SELECT id, receipt_no FROM payments
     WHERE institution_id = ? AND student_id = ? AND amount_paise = ?
       AND received_at >= datetime('now', '-5 seconds')
     LIMIT 1`
  ).bind(instId, studentId, totalPaise).first<{ id: string; receipt_no: string }>();
  if (recentDuplicate) {
    return c.json({
      error: `A payment of ₹${(totalPaise / 100).toLocaleString('en-IN')} for this student was just recorded (${recentDuplicate.receipt_no}). Duplicate payments are blocked.`,
      existingPaymentId: recentDuplicate.id,
      receiptNo: recentDuplicate.receipt_no,
    }, 409);
  }

  const openCharges = await DB.prepare(
    `SELECT fc.id, fc.amount_paise,
            COALESCE((SELECT SUM(amount_paise) FROM payment_allocations WHERE charge_id = fc.id), 0) AS paid_paise
     FROM fee_charges fc
     WHERE fc.student_id = ? AND fc.institution_id = ? AND fc.status IN ('open', 'partial')
     ORDER BY fc.due_on ASC, fc.id ASC`
  ).bind(studentId, instId).all<{ id: string; amount_paise: number; paid_paise: number }>();

  const paymentId = `pmt-${crypto.randomUUID().slice(0, 8)}`;
  const receiptNo = `REC-2026-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const responseBody = {
    success: true,
    message: 'Payment recorded and allocated successfully',
    paymentId,
    receiptNo,
    amount: totalPaise / 100,
    studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
  };
  const expiresAt = '9999-12-31T23:59:59.999Z';
  const statements = [
    DB.prepare(
      `INSERT INTO idempotency_keys (id, institution_id, idempotency_key, endpoint, status_code, response_body, expires_at, actor_membership_id, request_hash)
       VALUES (?, ?, ?, ?, 201, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), instId, scopedKey, endpoint, JSON.stringify(responseBody), expiresAt, auth.membership.id, requestHash),
    DB.prepare(
      `INSERT INTO payments (
         id, institution_id, student_id, amount_paise, currency_code, method,
         receipt_no, status, received_at, recorded_by_membership_id, notes
       ) VALUES (?, ?, ?, ?, 'INR', ?, ?, 'received', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?)`
    ).bind(paymentId, instId, studentId, totalPaise, method, receiptNo, auth.membership.id, notes),
  ];

  let remainingPaise = totalPaise;
  for (const charge of openCharges.results) {
    if (remainingPaise <= 0) break;
    const dueOnCharge = charge.amount_paise - charge.paid_paise;
    if (dueOnCharge <= 0) continue;

    const allocationPaise = Math.min(remainingPaise, dueOnCharge);
    statements.push(
      DB.prepare(
        `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(instId, paymentId, charge.id, studentId, allocationPaise),
      DB.prepare(`UPDATE fee_charges SET status = ? WHERE id = ? AND institution_id = ?`)
        .bind(charge.paid_paise + allocationPaise >= charge.amount_paise ? 'paid' : 'partial', charge.id, instId),
    );
    remainingPaise -= allocationPaise;
  }

  if (remainingPaise > 0) {
    const extraChargeId = `chg-${crypto.randomUUID().slice(0, 8)}`;
    statements.push(
      DB.prepare(
        `INSERT INTO fee_charges (id, institution_id, student_id, description, due_on, amount_paise, status, created_by_membership_id)
         VALUES (?, ?, ?, 'Tuition Fee Payment', strftime('%Y-%m-%d', 'now'), ?, 'paid', ?)`
      ).bind(extraChargeId, instId, studentId, remainingPaise, auth.membership.id),
      DB.prepare(
        `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(instId, paymentId, extraChargeId, studentId, remainingPaise),
    );
  }

  try {
    // D1 batch is transactional: the payment, allocations, charge updates, audit trigger,
    // and final replay response commit together or are all rolled back.
    await DB.batch(statements);
  } catch (err) {
    // A concurrent duplicate may have won the unique idempotency-key insert. Replay it
    // only after verifying both the authenticated actor and the original payload hash.
    const winner = await DB.prepare(
      `SELECT endpoint, actor_membership_id, request_hash, status_code, response_body
       FROM idempotency_keys WHERE institution_id = ? AND idempotency_key = ?`
    ).bind(instId, scopedKey).first<{
      endpoint: string;
      actor_membership_id: string | null;
      request_hash: string | null;
      status_code: number | null;
      response_body: string | null;
    }>().catch(() => null);
    if (winner) {
      if (winner.endpoint !== endpoint || winner.actor_membership_id !== auth.membership.id || winner.request_hash !== requestHash) {
        return c.json({ error: 'Idempotency key was already used for a different payment request' }, 409);
      }
      if (winner.status_code && winner.response_body) {
        return c.json(JSON.parse(winner.response_body), winner.status_code as any);
      }
    }
    console.error('Record payment error:', err);
    return c.json({ error: 'Failed to record payment' }, 500);
  }

  return c.json(responseBody, 201);
});

feesRouter.get('/:institutionId/fees/payments', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const raw = await c.env.DB.prepare(
    `SELECT p.id, p.student_id, p.amount_paise, p.method, p.receipt_no, p.status, p.received_at, p.notes,
            s.first_name, s.last_name, c.name AS class_name
     FROM payments p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
     LEFT JOIN classes c ON c.id = e.class_id
     WHERE p.institution_id = ?
     ORDER BY p.received_at DESC`
  )
    .bind(auth.institutionId)
    .all<{
      id: string;
      student_id: string;
      amount_paise: number;
      method: string;
      receipt_no: string;
      status: string;
      received_at: string;
      notes: string | null;
      first_name: string;
      last_name: string | null;
      class_name: string | null;
    }>();

  const payments = raw.results.map((p) => ({
    id: p.id,
    receiptNo: p.receipt_no,
    studentId: p.student_id,
    studentName: `${p.first_name} ${p.last_name || ''}`.trim(),
    class: p.class_name || 'Unassigned',
    amount: Math.round(p.amount_paise / 100),
    method: p.method.toUpperCase(),
    date: p.received_at.slice(0, 10),
    status: p.status === 'received' ? 'Received' : p.status,
    notes: p.notes || '',
  }));

  return c.json({ payments });
});

feesRouter.get('/:institutionId/fees/reports', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Monthly breakdown
  const monthlyRaw = await DB.prepare(
    `SELECT strftime('%Y-%m', received_at) AS month_key,
            SUM(amount_paise) AS monthly_total
     FROM payments
     WHERE institution_id = ? AND status = 'received'
     GROUP BY strftime('%Y-%m', received_at)
     ORDER BY month_key ASC`
  )
    .bind(instId)
    .all<{ month_key: string; monthly_total: number }>();

  // Overall totals
  const totals = await DB.prepare(
    `SELECT (SELECT COALESCE(SUM(amount_paise), 0) FROM fee_charges WHERE institution_id = ? AND status NOT IN ('waived', 'void')) AS total_charges,
            (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE institution_id = ? AND status = 'received') AS total_received`
  )
    .bind(instId, instId)
    .first<{ total_charges: number; total_received: number }>();

  const totalBilled = Math.round((totals?.total_charges ?? 0) / 100);
  const totalCollected = Math.round((totals?.total_received ?? 0) / 100);
  const totalOutstanding = Math.max(0, totalBilled - totalCollected);

  const monthlyCollections = monthlyRaw.results.map((m) => ({
    month: m.month_key,
    amount: Math.round(m.monthly_total / 100),
  }));

  return c.json({
    totalBilled,
    totalCollected,
    totalOutstanding,
    collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
    monthlyCollections,
  });
});
