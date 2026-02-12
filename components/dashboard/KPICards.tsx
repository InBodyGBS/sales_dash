'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Package, TrendingUp, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatJPY, formatCNH } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface KPICardsProps {
  data: {
    totalAmount: number;
    totalQty: number;
    avgAmount: number;
    totalTransactions: number;
    prevTotalAmount?: number; // 직전 연도 매출액
    prevTotalQty?: number; // 직전 연도 수량
    comparison: {
      amount: number;
      qty: number;
    };
  } | null;
  loading?: boolean;
  entity?: Entity;
}

export function KPICards({ data, loading, entity }: KPICardsProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  const isCNHEntity = entity === 'China';
  
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // For HQ, Healthcare, Korot: only show Total Amount with KRW format
  if (isKRWEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKRW(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatKRW(data.prevTotalAmount)}
              </div>
            )}
            <div className={`flex items-center text-xs mt-1 ${data.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.amount >= 0 ? (
                <ArrowUp className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 mr-1" />
              )}
              <span>{Math.abs(data.comparison.amount).toFixed(1)}% vs previous period</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (KRW)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For Vietnam: show Total Amount with VND format
  if (isVNDEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVND(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatVND(data.prevTotalAmount)}
              </div>
            )}
            <div className={`flex items-center text-xs mt-1 ${data.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.amount >= 0 ? (
                <ArrowUp className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 mr-1" />
              )}
              <span>{Math.abs(data.comparison.amount).toFixed(1)}% vs previous period</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (VND)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For Japan: show Total Amount with JPY format
  if (isJPYEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatJPY(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatJPY(data.prevTotalAmount)}
              </div>
            )}
            <div className={`flex items-center text-xs mt-1 ${data.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.amount >= 0 ? (
                <ArrowUp className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 mr-1" />
              )}
              <span>{Math.abs(data.comparison.amount).toFixed(1)}% vs previous period</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (JPY)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For China: show Total Amount with CNH format
  if (isCNHEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCNH(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatCNH(data.prevTotalAmount)}
              </div>
            )}
            <div className={`flex items-center text-xs mt-1 ${data.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.amount >= 0 ? (
                <ArrowUp className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 mr-1" />
              )}
              <span>{Math.abs(data.comparison.amount).toFixed(1)}% vs previous period</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (CNH)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For other entities, show only Total Amount with USD format
  return (
    <div className="grid gap-4 md:grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalAmount, 'USD')}</div>
          {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
            <div className="text-sm text-muted-foreground mt-1">
              Previous year: {formatCurrency(data.prevTotalAmount, 'USD')}
            </div>
          )}
          <div className={`flex items-center text-xs mt-1 ${data.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.comparison.amount >= 0 ? (
              <ArrowUp className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDown className="h-3 w-3 mr-1" />
            )}
            <span>{Math.abs(data.comparison.amount).toFixed(1)}% vs previous period</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total sales amount</p>
        </CardContent>
      </Card>
    </div>
  );
}
