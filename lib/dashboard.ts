// lib/dashboard.ts
// Supabase RPC 기반 대시보드 데이터 호출 유틸리티

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Types
// ============================================
export interface DashboardData {
  total_amount: number;
  prev_year_amount: number;
  monthly_trend: { year: number; month: number; amount: number }[];
  quarterly: { year: number; quarter: string; amount: number }[];
  channels: { channel: string; amount: number }[];
  top_products_amount: { product: string; amount: number }[];
  top_products_quantity: { product: string; quantity: number }[];
  categories: string[];
  all_products: { product: string; category: string; amount: number; qty: number }[];
  industries: {
    industry: string;
    amount: number;
    percentage: number;
  }[];
  fg_list: string[];
  entity_list: string[];
  year_list: number[];
}

// ============================================
// Fetch: 대시보드 전체 데이터 (단일 RPC 호출)
// ============================================
// Note: Europe entity는 특별 처리됩니다.
// - 데이터 소스: sales_data_europe View (Netherlands, Germany, UK 중 channel != 'Inter-Company')
// - 금액 컬럼: line_amount_mst 사용
// - 실제 Europe 처리는 app/api/dashboard/* 라우트에서 수행됩니다.
//   이 함수는 RPC를 호출하지만, Europe의 경우 API 라우트에서 직접 처리됩니다.
export async function getDashboardData(
  supabase: SupabaseClient<any, "public", any>,
  entity: string,
  year: number,
  fgFilter?: string | null,
  quarter?: string | null
): Promise<DashboardData> {
  // Europe은 API 라우트에서 직접 처리되므로, RPC 호출 전에 확인
  if (entity === 'Europe') {
    console.warn('⚠️ Europe entity: getDashboardData should not be called directly. Use API routes instead.');
  }

  const { data, error } = await supabase.rpc("get_dashboard", {
    p_entity: entity,
    p_year: year,
    p_fg: fgFilter ?? null,
    p_quarter: quarter && quarter !== 'All' ? quarter : null,
  });

  if (error) {
    console.error("Dashboard RPC error:", error);
    throw new Error(`Failed to fetch dashboard: ${error.message}`);
  }

  return data as DashboardData;
}

// ============================================
// Helpers
// ============================================

/** YoY 변화율 계산 */
export function calcYoYChange(current: number, previous: number): string {
  if (previous === 0) return "N/A";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

/** 금액 포맷팅 ($1,234,567.89) */
export function formatAmount(
  amount: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Monthly Trend 데이터를 MonthlyTrendChart 컴포넌트 형식으로 변환
 * 
 * MonthlyTrendChart expects:
 * { month: number, amount: number, qty: number, prevAmount?: number, prevQty?: number }
 */
export function transformMonthlyTrend(
  data: DashboardData["monthly_trend"],
  currentYear: number
) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return months.map((month) => ({
    month,
    amount:
      data.find((d) => d.year === currentYear && d.month === month)?.amount ?? 0,
    qty: 0,
    prevAmount:
      data.find((d) => d.year === currentYear - 1 && d.month === month)?.amount ?? 0,
    prevQty: 0,
  }));
}

/**
 * Quarterly 데이터를 QuarterlyComparisonChart 컴포넌트 형식으로 변환
 */
export function transformQuarterly(
  data: DashboardData["quarterly"],
  currentYear: number
) {
  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  return quarters.map((q) => ({
    quarter: q,
    currentYear:
      data.find((d) => d.year === currentYear && d.quarter === q)?.amount ?? 0,
    previousYear:
      data.find((d) => d.year === currentYear - 1 && d.quarter === q)?.amount ?? 0,
  }));
}

/**
 * Top Products 데이터를 TopProductsChart 컴포넌트 형식으로 변환
 * 
 * TopProductsChart expects (new format):
 * {
 *   byAmount: { product, amount, qty, category }[],
 *   byQuantity: { product, amount, qty, category }[],
 *   categories: string[],
 *   allProducts: { product, amount, qty, category }[]
 * }
 */
export function transformTopProducts(dashboardData: DashboardData) {
  const byAmount = dashboardData.top_products_amount.map((p) => {
    const qtyMatch = dashboardData.top_products_quantity.find(
      (q) => q.product === p.product
    );
    const allMatch = dashboardData.all_products.find(
      (a) => a.product === p.product
    );
    return {
      product: p.product,
      amount: (p.amount === null || p.amount === undefined) ? 0 : p.amount,
      qty: qtyMatch?.quantity || 0,
      category: allMatch?.category || null,
    };
  })
  .sort((a, b) => (b.amount || 0) - (a.amount || 0))  // 정렬 추가: 금액 높은 순
  .slice(0, 10);  // Top 10만 유지

  const byQuantity = dashboardData.top_products_quantity.map((q) => {
    const amountMatch = dashboardData.top_products_amount.find(
      (a) => a.product === q.product
    );
    const allMatch = dashboardData.all_products.find(
      (a) => a.product === q.product
    );
    return {
      product: q.product,
      amount: amountMatch?.amount || 0,
      qty: (q.quantity === null || q.quantity === undefined) ? 0 : q.quantity,
      category: allMatch?.category || null,
    };
  })
  .sort((a, b) => (b.qty || 0) - (a.qty || 0))  // 정렬 추가: 수량 많은 순
  .slice(0, 10);  // Top 10만 유지

  const allProducts = dashboardData.all_products.map((p) => ({
    product: p.product,
    amount: (p.amount === null || p.amount === undefined) ? 0 : p.amount,
    qty: (p.qty === null || p.qty === undefined) ? 0 : p.qty,
    category: p.category,
  }))
  .sort((a, b) => (b.amount || 0) - (a.amount || 0));  // 전체 제품도 정렬

  return {
    byAmount,
    byQuantity,
    categories: dashboardData.categories || [],
    allProducts,
  };
}

// ============================================
// 주간 갱신 트리거 (관리자용)
// ============================================
export async function refreshDashboard(
  supabase: SupabaseClient<any, "public", any>
): Promise<string> {
  const { data, error } = await supabase.rpc("refresh_dashboard");

  if (error) {
    throw new Error(`Refresh failed: ${error.message}`);
  }

  return data as string;
}