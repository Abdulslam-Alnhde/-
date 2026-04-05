/** Default total grades by exam type (teacher may override). */
export const DEFAULT_TOTAL_BY_EXAM_TYPE: Record<string, number> = {
  QUIZ: 10,
  MIDTERM: 20,
  FINAL: 70,
};

export function defaultTotalGradeForType(type: string): number {
  return DEFAULT_TOTAL_BY_EXAM_TYPE[type] ?? 20;
}
