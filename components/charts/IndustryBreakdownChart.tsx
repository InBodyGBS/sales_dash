'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatJPY, formatCNH } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface IndustryBreakdownData {
  industry: string;
  amount: number;
  transactions: number;
}

interface IndustryBreakdownChartProps {
  data: IndustryBreakdownData[];
  loading?: boolean;
  entity?: Entity;
}

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

export function IndustryBreakdownChart({ data, loading, entity }: IndustryBreakdownChartProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot', 'All'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  const isCNHEntity = entity === 'China';
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Industry Breakdown</CardTitle>
          <CardDescription>Sales by industry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Industry Breakdown</CardTitle>
          <CardDescription>Sales by industry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const chartData = data.map((item) => ({
    name: item.industry,
    value: item.amount,
    percentage: total > 0 ? (item.amount / total) * 100 : 0,
    transactions: item.transactions,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry Breakdown</CardTitle>
        <CardDescription>Sales by industry</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              labelLine={false}
              label={({ name, percentage }) => {
                if (percentage < 3) return ''; // Hide small labels
                return `${name}: ${percentage.toFixed(1)}%`;
              }}
              outerRadius={90}
              innerRadius={55}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                if (name === 'value') {
                  let formattedAmount: string;
                  if (isKRWEntity) {
                    formattedAmount = formatKRW(value);
                  } else if (isVNDEntity) {
                    formattedAmount = formatVND(value);
                  } else if (isJPYEntity) {
                    formattedAmount = formatJPY(value);
                  } else if (isCNHEntity) {
                    formattedAmount = formatCNH(value);
                  } else {
                    formattedAmount = formatCurrency(value, 'USD');
                  }
                  return [
                    formattedAmount,
                    `Amount: ${formattedAmount}, Transactions: ${formatNumber(props.payload.transactions)}`,
                  ];
                }
                return value;
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={80}
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
