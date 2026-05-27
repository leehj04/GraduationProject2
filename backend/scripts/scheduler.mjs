/**
 * 스케줄러 — 매일 새벽 자동 실행
 *
 * 이 프로세스만 백그라운드로 띄워두면 끝.
 *   node scripts/scheduler.js
 *
 * 더 견고한 운영을 원하면:
 *   - pm2 로 띄우기:  pm2 start scripts/scheduler.js --name classictour-pipeline
 *   - systemd 유닛으로 등록
 *
 * 발표 시 어필 포인트:
 *   "사람이 개입하지 않아도 매일 자동으로 데이터가 최신화됩니다."
 *   "실행 이력은 pipeline_runs 테이블에 남아 운영 감사가 가능합니다."
 */

import cron from 'node-cron';
import dotenv from 'dotenv';
import { runPipeline } from './pipeline/run.mjs';
import { createLogger } from './lib/logger.mjs';

dotenv.config();
const log = createLogger('scheduler');

const SCHEDULE = process.env.PIPELINE_CRON || '0 3 * * *'; // 매일 새벽 3시

// 1) 시작 시 한 번 즉시 실행 (옵션) — 첫 실행을 새벽 3시까지 기다릴 필요 없게
const RUN_ON_START = process.env.RUN_ON_START !== 'false';

async function safeRun(reason) {
  log.info(`파이프라인 실행 — ${reason}`);
  try {
    const result = await runPipeline({ useBachtrack: false });
    log.info('실행 결과', result);
  } catch (err) {
    log.error('실행 중 치명적 에러 — 스케줄러는 계속 동작', {
      error: err.message,
    });
    // 절대 process.exit 하지 않는다. 다음 스케줄까지 살아있어야 함.
  }
}

log.info('스케줄러 시작', { schedule: SCHEDULE });

if (!cron.validate(SCHEDULE)) {
  log.error(`잘못된 cron 표현식: ${SCHEDULE}`);
  process.exit(1);
}

// 매일 새벽 자동 실행
cron.schedule(SCHEDULE, () => safeRun(`스케줄 트리거 (${SCHEDULE})`), {
  timezone: 'Asia/Seoul',
});

// 시작 시 한 번 실행
if (RUN_ON_START) {
  safeRun('스케줄러 부팅 직후 초기 실행');
}

// 종료 시그널 깔끔하게 처리
process.on('SIGINT', () => {
  log.info('SIGINT 수신 — 스케줄러 종료');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log.info('SIGTERM 수신 — 스케줄러 종료');
  process.exit(0);
});

// 핸들링 안 된 에러도 죽이지 않고 로깅만
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection', { error: err?.message });
});
process.on('uncaughtException', (err) => {
  log.error('uncaughtException', { error: err?.message });
});
