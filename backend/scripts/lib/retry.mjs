/**
 * 지수 백오프 재시도
 *
 * Ticketmaster, MusicBrainz 등 외부 API는 rate limit 이나
 * 일시적 5xx 오류를 가끔 뱉는다. 무조건 실패시키지 않고 재시도.
 *
 *   1차 실패 → 1초 대기 후 재시도
 *   2차 실패 → 2초 대기
 *   3차 실패 → 4초 대기
 *   ... 최대 N회
 */

import { createLogger } from './logger.mjs';

const log = createLogger('retry');

const DEFAULT_OPTS = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  // 재시도할 가치가 있는 에러인지 판정. 4xx (rate limit 빼고) 는 재시도 안 함
  shouldRetry: (err) => {
    const status = err?.response?.status;
    if (!status) return true; // 네트워크 에러 — 재시도
    if (status === 429) return true; // rate limit
    if (status >= 500) return true; // 서버 에러
    return false; // 4xx (404, 401 등) 는 재시도해도 의미 없음
  },
};

export async function withRetry(fn, opts = {}) {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = {
    ...DEFAULT_OPTS,
    ...opts,
  };
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      log.warn(`재시도 대기`, {
        시도: `${attempt}/${maxAttempts}`,
        대기ms: delay,
        에러: err.message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * 일정 시간 대기 (rate limit 회피용)
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
