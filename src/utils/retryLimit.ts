import { StudentRegistrant } from '../types';

export type ExerciseModeType = 'pronunciation' | 'matching' | 'dictation';

export const DEFAULT_MAX_RETRIES = 3;
const STORAGE_KEY_RETRIES = 'faseeh_student_retry_counts_v1';

export interface StudentRetryStatus {
  maxRetries: number; // -1 = unlimited, 0 = disabled, >= 1 = finite cap
  usedRetries: number;
  remainingRetries: number; // -1 if unlimited, otherwise >= 0
  canRetry: boolean;
  isUnlimited: boolean;
}

export function resolveEffectiveMaxRetries(item?: {
  maxRetries?: number;
  allowRetry?: boolean;
}): number {
  if (!item) return DEFAULT_MAX_RETRIES;
  if (typeof item.maxRetries === 'number' && !isNaN(item.maxRetries)) {
    if (item.maxRetries < 0) return -1;
    return Math.max(0, Math.floor(item.maxRetries));
  }
  if (item.allowRetry === false) return 0;
  return DEFAULT_MAX_RETRIES;
}

export function getStudentRetryKey(student?: StudentRegistrant | null): string {
  const cleanId = (student?.id || '').trim();
  if (cleanId) return `id:${cleanId}`;
  const cleanName = (student?.name || '').trim();
  if (cleanName) return `name:${cleanName}`;
  return 'guest';
}

export function buildRetryEntryKey(
  mode: ExerciseModeType,
  student: StudentRegistrant | null | undefined,
  exerciseKey: string
): string {
  const sKey = getStudentRetryKey(student);
  return `${mode}::${sKey}::${exerciseKey.trim()}`;
}

function readRetryMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RETRIES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRetryMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY_RETRIES, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function getUsedRetryCount(
  mode: ExerciseModeType,
  student: StudentRegistrant | null | undefined,
  exerciseKey: string
): number {
  const map = readRetryMap();
  const key = buildRetryEntryKey(mode, student, exerciseKey);
  const val = map[key];
  return typeof val === 'number' && val > 0 ? Math.floor(val) : 0;
}

export function getRetryStatus(
  mode: ExerciseModeType,
  student: StudentRegistrant | null | undefined,
  exerciseKey: string,
  item?: { maxRetries?: number; allowRetry?: boolean }
): StudentRetryStatus {
  const maxRetries = resolveEffectiveMaxRetries(item);
  const usedRetries = getUsedRetryCount(mode, student, exerciseKey);

  if (maxRetries < 0) {
    return {
      maxRetries: -1,
      usedRetries,
      remainingRetries: -1,
      canRetry: true,
      isUnlimited: true,
    };
  }

  const remainingRetries = Math.max(0, maxRetries - usedRetries);
  return {
    maxRetries,
    usedRetries,
    remainingRetries,
    canRetry: maxRetries > 0 && usedRetries < maxRetries,
    isUnlimited: false,
  };
}

export interface RecordedRetryOutcome {
  usedRetries: number;
  maxRetries: number;
  remainingRetries: number;
  isUnlimited: boolean;
  isLastAttempt: boolean;
}

export function recordStudentRetryAttempt(
  mode: ExerciseModeType,
  student: StudentRegistrant | null | undefined,
  exerciseKey: string,
  item?: { maxRetries?: number; allowRetry?: boolean },
  webhookUrl?: string
): RecordedRetryOutcome {
  const maxRetries = resolveEffectiveMaxRetries(item);
  const map = readRetryMap();
  const key = buildRetryEntryKey(mode, student, exerciseKey);
  const prev = typeof map[key] === 'number' && map[key] > 0 ? Math.floor(map[key]) : 0;
  const nextCount = prev + 1;
  map[key] = nextCount;
  writeRetryMap(map);

  const isUnlimited = maxRetries < 0;
  const remainingRetries = isUnlimited ? -1 : Math.max(0, maxRetries - nextCount);
  const isLastAttempt = !isUnlimited && maxRetries > 0 && remainingRetries === 0;

  // Fire-and-forget sync to Google Sheets if configured
  if (webhookUrl && webhookUrl.trim().startsWith('http') && student && (student.id || student.name)) {
    syncSingleRetryToSheets(webhookUrl, {
      studentId: student.id || '',
      studentName: student.name || '',
      mode,
      exerciseKey: exerciseKey.trim(),
      retryCount: nextCount,
    }).catch(() => {});
  }

  return {
    usedRetries: nextCount,
    maxRetries,
    remainingRetries,
    isUnlimited,
    isLastAttempt,
  };
}

async function syncSingleRetryToSheets(
  webhookUrl: string,
  payload: {
    studentId: string;
    studentName: string;
    mode: ExerciseModeType;
    exerciseKey: string;
    retryCount: number;
  }
): Promise<void> {
  try {
    await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'record_retry',
        sheetName: 'سجل_المحاولات',
        ...payload,
        timestamp: new Date().toLocaleString('ar-SA'),
      }),
    });
  } catch {
    // Graceful no-op if network fails or legacy Apps Script ignores unknown action
  }
}

export async function syncStudentRetriesFromSheets(
  webhookUrl: string,
  student: StudentRegistrant | null | undefined
): Promise<void> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) return;
  const cleanId = (student?.id || '').trim();
  const cleanName = (student?.name || '').trim();
  if (!cleanId && !cleanName) return;

  try {
    const cleanUrl = webhookUrl.trim();
    const sep = cleanUrl.includes('?') ? '&' : '?';
    const targetUrl = `${cleanUrl}${sep}action=get_student_retries&studentId=${encodeURIComponent(
      cleanId
    )}&studentName=${encodeURIComponent(cleanName)}&_t=${Date.now()}`;

    let data: any = null;
    try {
      const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
      if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
    } catch {}

    if (!data || !Array.isArray(data.retries)) {
      try {
        const directRes = await fetch(targetUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (directRes.ok) data = await directRes.json().catch(() => null);
      } catch {}
    }

    if (data && Array.isArray(data.retries) && data.retries.length > 0) {
      const map = readRetryMap();
      let changed = false;
      for (const r of data.retries) {
        const mode = r.mode as ExerciseModeType;
        const exKey = String(r.exerciseKey || '').trim();
        const cnt = Number(r.retryCount) || 0;
        if ((mode === 'pronunciation' || mode === 'matching' || mode === 'dictation') && exKey && cnt > 0) {
          const entryKey = buildRetryEntryKey(mode, student, exKey);
          if ((map[entryKey] || 0) < cnt) {
            map[entryKey] = cnt;
            changed = true;
          }
        }
      }
      if (changed) writeRetryMap(map);
    }
  } catch {
    // Graceful no-op
  }
}

export function formatStudentRetryBannerMessage(
  outcome: RecordedRetryOutcome,
  student: StudentRegistrant | null | undefined,
  tr: (id: string, fallback: string) => string
): string {
  const cleanName = (student?.name || '').trim();
  const namePrefix = cleanName ? `${cleanName} — ` : '';

  if (outcome.isUnlimited) {
    return tr(
      'retry_special_unlimited_banner',
      '🔄 {name}بدأت محاولة الإعادة رقم ({attempt}) — الإعادة مفتوحة لهذا التمرين.'
    )
      .replace('{name}', namePrefix)
      .replace('{attempt}', String(outcome.usedRetries));
  }

  if (outcome.isLastAttempt) {
    return tr(
      'retry_special_last_banner',
      '⚠️ {name}هذه هي محاولة الإعادة الأخيرة لك ({attempt} من {max})، وبعدها ستُغلق الإعادة لهذا التمرين.'
    )
      .replace('{name}', namePrefix)
      .replace('{attempt}', String(outcome.usedRetries))
      .replace('{max}', String(outcome.maxRetries));
  }

  return tr(
    'retry_special_banner',
    '🔄 {name}محاولة الإعادة رقم ({attempt}) من ({max}) — المتبقي بعد هذه المحاولة: ({remaining})'
  )
    .replace('{name}', namePrefix)
    .replace('{attempt}', String(outcome.usedRetries))
    .replace('{max}', String(outcome.maxRetries))
    .replace('{remaining}', String(outcome.remainingRetries));
}

export function parseRetryCountFromSettingsText(raw: string): {
  allowRetry: boolean;
  maxRetries: number;
} {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) {
    return { allowRetry: true, maxRetries: DEFAULT_MAX_RETRIES };
  }
  if (
    s.includes('منع الإعادة') ||
    s.includes('منع الاعادة') ||
    s.includes('لا إعادة') ||
    s.includes('no_retry') ||
    s === 'false' ||
    s.includes(',منع') ||
    s.includes('| منع')
  ) {
    return { allowRetry: false, maxRetries: 0 };
  }
  if (s.includes('غير محدود') || s.includes('مفتوح') || s.includes('unlimited')) {
    return { allowRetry: true, maxRetries: -1 };
  }
  const numMatch = s.match(/(?:إعادة|اعادة|محاولات|retry)\s*[:=]?\s*(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!isNaN(n)) {
      return { allowRetry: n > 0, maxRetries: Math.max(0, n) };
    }
  }
  return { allowRetry: true, maxRetries: DEFAULT_MAX_RETRIES };
}

export function formatRetrySettingToken(maxRetries?: number, allowRetry?: boolean): string {
  const resolved = resolveEffectiveMaxRetries({ maxRetries, allowRetry });
  if (resolved === 0) return 'منع الإعادة';
  if (resolved < 0) return 'إعادة غير محدودة';
  return `إعادة ${resolved}`;
}
