'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Package, TrendingUp, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatJPY, formatCNH, formatMXN, formatINR, formatAUD, formatMYR, formatSGD } from '@/lib/utils/formatters';
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
    currencyBreakdown?: Array<{
      currency: string;
      currentAmount: number;
      previousAmount: number;
      comparison: {
        amount: number;
      };
    }>;
  } | null;
  loading?: boolean;
  entity?: Entity;
}

export function KPICards({ data, loading, entity }: KPICardsProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot', 'All'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  const isCNHEntity = entity === 'China';
  const isMXNEntity = entity === 'Mexico';
  const isINREntity = entity === 'India';
  const isAUDEntity = entity === 'Oceania';
  const isEUREntity = entity && ['Netherlands', 'Germany', 'UK', 'Europe'].includes(entity);
  const isAsiaEntity = entity === 'Asia';
  
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

  // For Mexico: show Total Amount with MXN format
  if (isMXNEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMXN(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatMXN(data.prevTotalAmount)}
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
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (MXN)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For India: show Total Amount with INR format
  if (isINREntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatINR(data.prevTotalAmount)}
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
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (INR)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For Oceania: show Total Amount with AUD format
  if (isAUDEntity) {
    return (
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAUD(data.totalAmount)}</div>
            {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Previous year: {formatAUD(data.prevTotalAmount)}
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
            <p className="text-xs text-muted-foreground mt-1">Total sales amount (AUD)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For Asia: show Total Amount by currency (MYR, SGD)
  if (isAsiaEntity) {
    // If currency breakdown is available, show by currency
    if (data.currencyBreakdown && data.currencyBreakdown.length > 0) {
      const getCurrencyFormatter = (currency: string) => {
        switch (currency) {
          case 'MYR':
            return formatMYR;
          case 'SGD':
            return formatSGD;
          default:
            return (amount: number) => formatCurrency(amount, currency);
        }
      };

      return (
        <div className="grid gap-4 md:grid-cols-2">
          {data.currencyBreakdown.map((item) => {
            const formatter = getCurrencyFormatter(item.currency);
            return (
              <Card key={item.currency}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount ({item.currency})</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatter(item.currentAmount)}</div>
                  {item.previousAmount > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Previous year: {formatter(item.previousAmount)}
                    </div>
                  )}
                  <div className={`flex items-center text-xs mt-1 ${item.comparison.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.comparison.amount >= 0 ? (
                      <ArrowUp className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDown className="h-3 w-3 mr-1" />
                    )}
                    <span>{Math.abs(item.comparison.amount).toFixed(1)}% vs previous period</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total sales amount ({item.currency})</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }
    // If currency breakdown is not available, show loading or fallback
    console.warn('Asia entity but currencyBreakdown is not available:', data.currencyBreakdown);
  }

  // For other entities, show only Total Amount with appropriate currency format
  const currency = isEUREntity ? 'EUR' : 'USD';
  return (
    <div className="grid gap-4 md:grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalAmount, currency)}</div>
          {data.prevTotalAmount !== undefined && data.prevTotalAmount > 0 && (
            <div className="text-sm text-muted-foreground mt-1">
              Previous year: {formatCurrency(data.prevTotalAmount, currency)}
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
