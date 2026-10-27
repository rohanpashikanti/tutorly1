/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import {
  isValidAssessmentMarkInput,
  parseAssessmentMarkInput,
  summarizeAssessmentMarks,
  toAssessmentMarkSubmission,
} from '../../src/utils/assessmentMarks';

const db = (env as unknown as { DB: D1Database }).DB;
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${++sequence}-${crypto.randomUUID().slice(0, 8)}`;
const request = (url: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const match = (response.headers.get('set-cookie') || '').match(/((?:tutorly\.)?session_token=[^;,]+)/i);
  if (!match) throw new Error('Expected the test authentication response to set a session cookie');
  return match[1];
}

async function createFixture() {
  const email = `${unique('marks-user')}@example.test`;
  const authResponse = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ name: `Test ${email}`, email, password: 'Correct-Horse-Battery-7' }),
  });
  const cookie = cookieFrom(authResponse);
  const institutionResponse = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: unique('Marks Academy') }),
  });
  expect(institutionResponse.status).toBe(201);
  const { institutionId } = await institutionResponse.json() as { institutionId: string };

  const studentIds: string[] = [];
  for (let index = 0; index < 3; index++) {
    const response = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: unique(`Synthetic Marks Student ${index}`), class: 'Class 10', batch: 'Batch A' }),
    });
    expect(response.status).toBe(201);
    studentIds.push((await response.json() as { studentId: string }).studentId);
  }

  const assessmentResponse = await request(`/api/institutions/${institutionId}/assessments`, {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({
      name: unique('Synthetic School Exam'),
      type: 'school_exam',
      class: 'Class 10',
      batch: 'Batch A',
      subject: 'Mathematics',
      maxMarks: 40,
    }),
  });
  expect(assessmentResponse.status).toBe(201);
  const { assessmentId } = await assessmentResponse.json() as { assessmentId: string };
  return { cookie, institutionId, assessmentId, studentIds };
}

function postMarks(
  institutionId: string,
  assessmentId: string,
  cookie: string | undefined,
  marks: unknown[],
) {
  return request(`/api/institutions/${institutionId}/assessments/${assessmentId}/marks`, {
    method: 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ marks }),
  });
}

async function readMark(institutionId: string, assessmentId: string, studentId: string) {
  return db.prepare(
    `SELECT marks, status FROM assessment_marks WHERE institution_id = ? AND assessment_id = ? AND student_id = ?`,
  ).bind(institutionId, assessmentId, studentId).first<{ marks: number | null; status: string }>();
}

describe('assessment marks validation and missing-value handling', () => {
  it('persists blank as NULL draft, preserves explicit zero, and returns both distinctly', async () => {
    const fixture = await createFixture();
    const [blankStudent, zeroStudent, scoredStudent] = fixture.studentIds;
    const save = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: blankStudent, marks: null },
      { studentId: zeroStudent, marks: 0 },
      { studentId: scoredStudent, marks: 24 },
    ]);
    expect(save.status).toBe(200);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, blankStudent)).toEqual({ marks: null, status: 'draft' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, zeroStudent)).toEqual({ marks: 0, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, scoredStudent)).toEqual({ marks: 24, status: 'published' });

    const response = await request(`/api/institutions/${fixture.institutionId}/assessments/${fixture.assessmentId}/marks`, {
      headers: { cookie: fixture.cookie },
    });
    const body = await response.json() as { marks: Array<{ studentId: string; marks: number | null; percentage: number | null; grade: string; status: string }> };
    expect(body.marks.find((item) => item.studentId === blankStudent)).toMatchObject({ marks: null, percentage: null, grade: '—', status: 'Draft' });
    expect(body.marks.find((item) => item.studentId === zeroStudent)).toMatchObject({ marks: 0, percentage: 0, grade: 'D', status: 'Published' });
    expect(body.marks.find((item) => item.studentId === scoredStudent)).toMatchObject({ marks: 24, percentage: 60, status: 'Published' });
  });

  it.each([
    ['negative', -1],
    ['above configured maximum', 41],
    ['decimal', 1.5],
    ['numeric string', '12'],
    ['empty string', ''],
    ['object', { score: 12 }],
  ])('rejects %s without writing any marks', async (_description, invalidMark) => {
    const fixture = await createFixture();
    const [existingStudent, invalidStudent] = fixture.studentIds;
    await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: existingStudent, marks: 19 }]);

    const response = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent, marks: 20 },
      { studentId: invalidStudent, marks: invalidMark },
    ]);
    expect(response.status).toBe(400);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 19, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, invalidStudent)).toBeNull();
  });

  it('rejects a student outside the assessment enrollment and rejects unauthenticated requests', async () => {
    const fixture = await createFixture();
    const outsiderResponse = await request(`/api/institutions/${fixture.institutionId}/students`, {
      method: 'POST',
      headers: { cookie: fixture.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: unique('Synthetic Outsider'), class: 'Class 9', batch: 'Batch Z' }),
    });
    expect(outsiderResponse.status).toBe(201);
    const { studentId: outsiderId } = await outsiderResponse.json() as { studentId: string };
    const denied = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: outsiderId, marks: 12 }]);
    expect(denied.status).toBe(400);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, outsiderId)).toBeNull();

    const anonymous = await postMarks(fixture.institutionId, fixture.assessmentId, undefined, [{ studentId: fixture.studentIds[0], marks: 12 }]);
    expect(anonymous.status).toBe(401);
  });

  it('leaves existing marks unchanged when an item omits the marks field', async () => {
    const fixture = await createFixture();
    const [existingStudent, newStudent] = fixture.studentIds;
    await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: existingStudent, marks: 18 }]);
    const response = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent },
      { studentId: newStudent, marks: 21 },
    ]);
    expect(response.status).toBe(200);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 18, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, newStudent)).toEqual({ marks: 21, status: 'published' });
  });
});

describe('assessment mark input and calculation helpers', () => {
  it('keeps blank distinct from zero, validates the configured maximum, and excludes blank scores from metrics', () => {
    expect(parseAssessmentMarkInput('')).toBe('');
    expect(parseAssessmentMarkInput('0')).toBe(0);
    expect(parseAssessmentMarkInput('12')).toBe(12);
    expect(isValidAssessmentMarkInput('', 40)).toBe(true);
    expect(isValidAssessmentMarkInput(0, 40)).toBe(true);
    expect(isValidAssessmentMarkInput(40, 40)).toBe(true);
    expect(isValidAssessmentMarkInput(41, 40)).toBe(false);
    expect(isValidAssessmentMarkInput(1.5, 40)).toBe(false);
    expect(isValidAssessmentMarkInput(Number.NaN, 40)).toBe(false);
    expect(toAssessmentMarkSubmission([{ id: 'student-a', marks: '' }, { id: 'student-b', marks: 0 }]))
      .toEqual([{ studentId: 'student-a', marks: null }, { studentId: 'student-b', marks: 0 }]);
    expect(summarizeAssessmentMarks(['', 0, 20], 40)).toMatchObject({
      enteredCount: 2,
      averageMarks: 10,
      averagePercent: 25,
      highestMark: 20,
      passRate: 50,
    });
    expect(summarizeAssessmentMarks(['', ''], 40)).toMatchObject({
      enteredCount: 0,
      averageMarks: null,
      averagePercent: null,
      highestMark: null,
      passRate: null,
    });
  });
});
