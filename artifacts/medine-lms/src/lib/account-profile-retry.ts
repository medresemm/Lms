// /api/account/profile sorğusu üçün qısa təkrar cəhd siyasəti.
// Qeydiyyat/e-poçt təsdiqindən dərhal sonra sessiya və ya server müvəqqəti xəta verə bilər;
// bu halda «Hesab məlumatı yüklənmədi» ekranını göstərməzdən əvvəl artan fasilə ilə bir neçə dəfə yenidən yoxlanılır.
export const ACCOUNT_PROFILE_MAX_RETRIES = 3;

export function accountProfileRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return failureCount < 2;
  if (typeof status === 'number' && status < 500) return false;
  return failureCount < ACCOUNT_PROFILE_MAX_RETRIES;
}

export function accountProfileRetryDelay(attemptIndex: number): number {
  return Math.min(500 * 2 ** attemptIndex, 2_000);
}

export const accountProfileQueryRetry = { retry: accountProfileRetry, retryDelay: accountProfileRetryDelay } as const;
