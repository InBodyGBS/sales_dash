'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatKRW, formatVND, formatJPY, formatCNH, formatCompactKRW, formatCompactCurrency, formatCompactVND, formatCompactJPY, formatCompactCNH } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface ChannelSalesData {
  channel: string;
  amount: number;
}

interface ChannelSalesChartProps {
  data: ChannelSalesData[];
  loading?: boolean;
  entity?: Entity;
}

export function ChannelSalesChart({ data, loading, entity }: ChannelSalesChartProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  const isCNHEntity = entity === 'China';
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Channel Sales</CardTitle>
          <CardDescription>Sales by channel</CardDescription>
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
          <CardTitle>Channel Sales</CardTitle>
          <CardDescription>Sales by channel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    channel: item.channel,
    amount: item.amount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Sales</CardTitle>
        <CardDescription>Sales by channel</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: -30, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              tickFormatter={(value) => {
                if (isKRWEntity) return formatCompactKRW(value);
                if (isVNDEntity) return formatCompactVND(value);
                if (isJPYEntity) return formatCompactJPY(value);
                if (isCNHEntity) return formatCompactCNH(value);
                return formatCompactCurrency(value, 'USD');
              }} 
            />
            <YAxis 
              type="category" 
              dataKey="channel" 
              width={100} 
              fontSize={12}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number) => {
                if (isKRWEntity) return formatKRW(value);
                if (isVNDEntity) return formatVND(value);
                if (isJPYEntity) return formatJPY(value);
                if (isCNHEntity) return formatCNH(value);
                return formatCurrency(value, 'USD');
              }} 
            />
            <Bar dataKey="amount" fill="#3B82F6" name="Amount" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
