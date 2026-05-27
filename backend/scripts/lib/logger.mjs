/**
 * 색상 있는 콘솔 로그 + logs/pipeline-YYYY-MM-DD.log 파일 저장
 * 의존성 없이 ANSI escape 만 사용 → 추가 패키지 불필요
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 1;

const COLORS = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
};

function getLogFilePath() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `pipeline-${today}.log`);
}

function format(level, scope, message, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] [${scope}] ${message}${metaStr}`;
}

function write(level, scope, message, meta) {
  if (LEVELS[level] < CURRENT_LEVEL) return;
  const line = format(level, scope, message, meta);
  // 콘솔 출력 (색상)
  console.log(`${COLORS[level]}${line}${COLORS.reset}`);
  // 파일 저장 (색상 없음)
  fs.appendFileSync(getLogFilePath(), line + '\n');
}

export function createLogger(scope) {
  return {
    debug: (msg, meta) => write('debug', scope, msg, meta),
    info: (msg, meta) => write('info', scope, msg, meta),
    warn: (msg, meta) => write('warn', scope, msg, meta),
    error: (msg, meta) => write('error', scope, msg, meta),
  };
}
