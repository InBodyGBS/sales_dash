export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatJPY(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCNH(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY', // CNH uses CNY format (Chinese Yuan)
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Compact formatters for Y-axis (M unit only, no K unit)
export function formatCompactCurrency(amount: number, currency: string = 'USD'): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactKRW(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactVND(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactJPY(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactCNH(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactMXN(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactINR(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatCompactAUD(amount: number): string {
  // Always use M unit, no K unit
  return `${(amount / 1000000).toFixed(1)}M`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function getQuarterFromDate(date: Date): string {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

export function getYearFromDate(date: Date): number {
  return date.getFullYear();
}
