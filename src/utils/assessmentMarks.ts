export type AssessmentMarkInput = number | '';

export interface AssessmentMarkSubmission {
  studentId: string;
  enrollmentId?: string;
  marks: number | null;
  remarks?: string;
}

export function parseAssessmentMarkInput(raw: string): AssessmentMarkInput {
  return raw.trim() === '' ? '' : Number(raw);
}

export function isValidAssessmentMarkInput(value: AssessmentMarkInput, maxMarks: number): boolean {
  return value === '' || (
    Number.isSafeInteger(value) && value >= 0 && value <= maxMarks
  );
}

export function toAssessmentMarkSubmission<T extends {
  id: string;
  enrollmentId?: string;
  marks: AssessmentMarkInput;
  remarks?: string;
}>(entries: T[]): AssessmentMarkSubmission[] {
  return entries.map(({ id, enrollmentId, marks, remarks }) => ({
    studentId: id,
    ...(enrollmentId ? { enrollmentId } : {}),
    marks: marks === '' ? null : marks,
    ...(remarks === undefined ? {} : { remarks }),
  }));
}

export interface AssessmentMarksSummary {
  enteredCount: number;
  averageMarks: number | null;
  averagePercent: number | null;
  highestMark: number | null;
  passRate: number | null;
}

export function summarizeAssessmentMarks(
  marks: AssessmentMarkInput[],
  maxMarks: number,
  passingPercent = 40,
): AssessmentMarksSummary {
  const entered = marks.filter((mark): mark is number =>
    typeof mark === 'number' && Number.isSafeInteger(mark) && mark >= 0 && mark <= maxMarks,
  );
  if (entered.length === 0 || maxMarks <= 0) {
    return { enteredCount: 0, averageMarks: null, averagePercent: null, highestMark: null, passRate: null };
  }
  const averageMarks = Math.round(entered.reduce((sum, mark) => sum + mark, 0) / entered.length);
  const passedCount = entered.filter((mark) => (mark / maxMarks) * 100 >= passingPercent).length;
  return {
    enteredCount: entered.length,
    averageMarks,
    averagePercent: Math.round((averageMarks / maxMarks) * 100),
    highestMark: Math.max(...entered),
    passRate: Math.round((passedCount / entered.length) * 100),
  };
}
