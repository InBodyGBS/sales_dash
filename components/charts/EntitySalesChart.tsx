'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency, formatNumber, formatKRW } from '@/lib/utils/formatters';

interface EntitySalesData {
  entity: string;
  amount: number;
  qty: number;
}

interface EntitySalesChartProps {
  data: EntitySalesData[];
  loading?: boolean;
}

const ENTITY_COLORS: { [key: string]: string } = {
  HQ: '#3B82F6',
  USA: '#10B981',
  BWA: '#F59E0B',
  Vietnam: '#EF4444',
  Healthcare: '#8B5CF6',
  Korot: '#EC4899',
};

export function EntitySalesChart({ data, loading }: EntitySalesChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entity Sales</CardTitle>
          <CardDescription>Sales by entity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entity Sales</CardTitle>
          <CardDescription>Sales by entity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    entity: item.entity,
    amount: item.amount,
    qty: item.qty,
  }));

  // Format Y-axis in millions (M)
  const formatYAxis = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entity Sales</CardTitle>
        <CardDescription>Sales by entity (KRW)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="entity" />
            <YAxis tickFormatter={formatYAxis} width={60} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'amount') {
                  return formatKRW(value);
                }
                return formatNumber(value);
              }}
            />
            <Legend />
            <Bar
              dataKey="amount"
              fill="#3B82F6"
              name="Amount (KRW)"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={ENTITY_COLORS[entry.entity] || '#3B82F6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
