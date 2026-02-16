'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatCNH, formatJPY } from '@/lib/utils/formatters';

interface FGDistributionData {
  fg?: string;
  fg_classification?: string;
  amount: number;
  percentage?: number;
}

interface FGDistributionChartProps {
  data: FGDistributionData[];
  loading?: boolean;
  entity?: string;
}

const COLORS = {
  FG: '#3B82F6',
  NonFG: '#6B7280',
};

export function FGDistributionChart({ data, loading, entity }: FGDistributionChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>FG vs NonFG</CardTitle>
          <CardDescription>Sales distribution by FG classification</CardDescription>
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
          <CardTitle>FG vs NonFG</CardTitle>
          <CardDescription>Sales distribution by FG classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total for percentage calculation
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  
  const chartData = data.map((item) => ({
    name: item.fg || item.fg_classification || 'Unknown',
    value: item.amount,
    percentage: total > 0 ? (item.amount / total) * 100 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>FG vs NonFG</CardTitle>
        <CardDescription>Sales distribution by FG classification</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${(percentage || 0).toFixed(1)}%`}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'}
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => {
                if (entity === 'China') {
                  return formatCNH(value);
                } else if (entity === 'Japan') {
                  return formatJPY(value);
                }
                return formatCurrency(value, 'USD');
              }} 
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
