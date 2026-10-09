// Mədinə AI: test nəticəsinin insan dilində qısa təsviri (seçimli + açıq suallı testlər).

export interface AiExamScore {
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  score?: number;
  maxScore?: number;
  openQuestionCount?: number;
  status?: "graded" | "pending_review";
}

export function examIsPendingReview(result: AiExamScore) {
  return result.status === "pending_review";
}

/** «7/10 düzgün (70%)», «12 / 15 bal (80%)» və ya «yoxlanılır». */
export function examResultText(result: AiExamScore, compact = false) {
  if (examIsPendingReview(result)) return "yoxlanılır — açıq suallar müəllim tərəfindən qiymətləndirilir";
  if ((result.openQuestionCount ?? 0) > 0 && result.maxScore !== undefined && result.score !== undefined) {
    return `${result.score} / ${result.maxScore} bal (${result.percentage}%)`;
  }
  return `${result.correctCount}/${result.totalQuestions}${compact ? "" : " düzgün"} (${result.percentage}%)`;
}
