'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatCompactKRW, formatCompactCurrency, formatCompactVND } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface TopProductsData {
  product: string;
  amount: number;
  qty: number;
}

interface TopProductsResponse {
  byAmount: TopProductsData[];
  byQuantity: TopProductsData[];
}

interface TopProductsChartProps {
  data: TopProductsResponse | TopProductsData[];
  loading?: boolean;
  entity?: Entity;
}

export function TopProductsChart({ data, loading, entity }: TopProductsChartProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Products</CardTitle>
          <CardDescription>Best performing products (FG only)</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-[400px] bg-muted animate-pulse rounded" />
            <div className="h-[400px] bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle both old format (array) and new format (object with byAmount/byQuantity)
  const isNewFormat = data && typeof data === 'object' && 'byAmount' in data;
  const amountData = isNewFormat ? (data as TopProductsResponse).byAmount : (data as TopProductsData[]);
  const quantityData = isNewFormat ? (data as TopProductsResponse).byQuantity : (data as TopProductsData[]);

  if (!data || (isNewFormat && (!amountData || amountData.length === 0)) || (!isNewFormat && (data as TopProductsData[]).length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Products</CardTitle>
          <CardDescription>Best performing products (FG only)</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const amountChartData = amountData.map((item) => ({
    product: item.product,
    amount: item.amount,
    qty: item.qty,
  }));

  const quantityChartData = quantityData.map((item) => ({
    product: item.product,
    amount: item.amount,
    qty: item.qty,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Products</CardTitle>
        <CardDescription>Best performing products (FG only)</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Amount Chart */}
          <div className="pl-0">
            <h3 className="text-sm font-medium mb-2">By Amount</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={amountChartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => {
                    if (isKRWEntity) return formatCompactKRW(value);
                    if (isVNDEntity) return formatCompactVND(value);
                    return formatCompactCurrency(value, 'USD');
                  }} 
                />
                <YAxis 
                  type="category" 
                  dataKey="product" 
                  width={140} 
                  fontSize={12}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'amount') {
                      if (isKRWEntity) return formatKRW(value);
                      if (isVNDEntity) return formatVND(value);
                      return formatCurrency(value, 'USD');
                    }
                    return formatNumber(value);
                  }}
                />
                <Bar dataKey="amount" fill="#3B82F6" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quantity Chart */}
          <div className="pl-0">
            <h3 className="text-sm font-medium mb-2">By Quantity</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={quantityChartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatNumber(value)} />
                <YAxis 
                  type="category" 
                  dataKey="product" 
                  width={140} 
                  fontSize={12}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    return formatNumber(value);
                  }}
                />
                <Bar dataKey="qty" fill="#10B981" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
