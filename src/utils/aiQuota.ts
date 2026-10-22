export interface QuotaStatus {
  date: string;
  count: number;
  maxDaily: number;
  percentage: number;
  isWarning: boolean; // >= 80%
  isExceeded: boolean; // >= 100%
  remaining: number;
}

const STORAGE_KEY = 'arabic_ai_quota_usage_v1';
const DEFAULT_MAX_DAILY = 1500;

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current daily quota status.
 * Automatically resets at midnight when date changes!
 */
export function getDailyQuotaStatus(): QuotaStatus {
  if (typeof window === 'undefined') {
    return {
      date: getTodayDateString(),
      count: 0,
      maxDaily: DEFAULT_MAX_DAILY,
      percentage: 0,
      isWarning: false,
      isExceeded: false,
      remaining: DEFAULT_MAX_DAILY,
    };
  }

  const today = getTodayDateString();
  let data: { date: string; count: number; maxDaily: number } | null = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      data = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse quota storage:', e);
  }

  // Automatic reset at midnight if date has rolled over
  if (!data || data.date !== today) {
    const maxDaily = data && typeof data.maxDaily === 'number' && data.maxDaily >= 50 
      ? data.maxDaily 
      : DEFAULT_MAX_DAILY;
    
    data = {
      date: today,
      count: 0,
      maxDaily,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  const max = (data.maxDaily && typeof data.maxDaily === 'number' && data.maxDaily >= 50) 
    ? data.maxDaily 
    : DEFAULT_MAX_DAILY;
  const count = data.count || 0;
  const percentage = Math.min(100, Math.round((count / max) * 100));
  const isWarning = count >= Math.floor(max * 0.8) && count < max;
  const isExceeded = count >= max;
  const remaining = Math.max(0, max - count);

  return {
    date: today,
    count,
    maxDaily: max,
    percentage,
    isWarning,
    isExceeded,
    remaining,
  };
}

/**
 * Increment daily quota by 1 attempt
 */
export function incrementDailyQuota(): QuotaStatus {
  const status = getDailyQuotaStatus();
  const newCount = status.count + 1;

  const updated = {
    date: status.date,
    count: newCount,
    maxDaily: status.maxDaily,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('arabic-quota-updated', { detail: updated }));
  } catch (e) {}

  return getDailyQuotaStatus();
}

/**
 * Manually reset daily quota counter to 0
 */
export function resetDailyQuota(): QuotaStatus {
  const status = getDailyQuotaStatus();
  const updated = {
    date: status.date,
    count: 0,
    maxDaily: status.maxDaily,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('arabic-quota-updated', { detail: updated }));
  } catch (e) {}

  return getDailyQuotaStatus();
}

/**
 * Update daily maximum limit (e.g. 1500 for Free Tier, or custom for Pay-as-you-go)
 */
export function setDailyMaxQuota(newMax: number): QuotaStatus {
  const status = getDailyQuotaStatus();
  const validMax = Math.max(10, newMax);
  const updated = {
    date: status.date,
    count: status.count,
    maxDaily: validMax,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('arabic-quota-updated', { detail: updated }));
  } catch (e) {}

  return getDailyQuotaStatus();
}
