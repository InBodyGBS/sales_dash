'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatJPY, formatCompactCurrency, formatCompactKRW, formatCompactVND, formatCompactJPY } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface MonthlyTrendData {
  month: number;
  amount: number;
  qty: number;
  prevAmount?: number;
  prevQty?: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyTrendData[];
  loading?: boolean;
  entity?: Entity;
  currentYear?: number;
}

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export function MonthlyTrendChart({ data, loading, entity, currentYear }: MonthlyTrendChartProps) {
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Sales trend by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[450px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Sales trend by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[450px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create chart data for all 12 months, filling missing months with 0
  const chartData = monthNames.map((monthName, index) => {
    const month = index + 1;
    const monthData = data.find((d) => d.month === month);
    const currentYearKey = currentYear ? currentYear.toString() : 'current';
    const prevYearKey = currentYear ? (currentYear - 1).toString() : 'previous';
    
    const currentAmount = monthData?.amount ?? 0;
    const prevAmount = monthData?.prevAmount ?? 0;
    
    const chartItem: any = {
      month: monthName,
      amount: currentAmount,
      prevAmount: prevAmount,
    };
    
    // 동적 키 추가 - currentYear가 있을 때만
    if (currentYear) {
      chartItem[currentYearKey] = currentAmount;
      chartItem[prevYearKey] = prevAmount;
    } else {
      chartItem['current'] = currentAmount;
      chartItem['previous'] = prevAmount;
    }
    
    return chartItem;
  });
  
  // 디버깅: 첫 번째 데이터 확인
  if (chartData.length > 0 && currentYear) {
    console.log('MonthlyTrendChart - currentYear:', currentYear);
    console.log('MonthlyTrendChart - first data item:', chartData[0]);
    console.log('MonthlyTrendChart - data keys:', Object.keys(chartData[0]));
    console.log('MonthlyTrendChart - raw data:', data.slice(0, 3));
  }

  // Calculate max amount for better Y-axis scaling (both current and previous year)
  const maxAmount = Math.max(
    ...chartData.flatMap((d) => [d.amount || 0, d.prevAmount || 0]),
    0
  );
  const yAxisDomain = [0, maxAmount * 1.1 || 1]; // Add 10% padding, minimum 1 to avoid domain error

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Trend</CardTitle>
        <CardDescription>Sales trend by month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={chartData} margin={{ left: 20, right: 20, top: 5, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month"
              ticks={monthNames}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            {isKRWEntity ? (
              <>
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatCompactKRW(value)}
                  width={60}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === currentYear?.toString() || name === 'current') {
                      return formatKRW(value);
                    }
                    if (name === (currentYear ? (currentYear - 1).toString() : 'previous') || name === 'previous') {
                      return formatKRW(value);
                    }
                    return formatKRW(value);
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={currentYear ? currentYear.toString() : 'amount'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name={currentYear ? currentYear.toString() : 'Amount'}
                  dot={{ r: 4 }}
                  connectNulls={true}
                />
                {currentYear && (
                  <Line
                    type="monotone"
                    dataKey={(currentYear - 1).toString()}
                    stroke="#6B7280"
                    strokeWidth={2}
                    name={(currentYear - 1).toString()}
                    dot={{ r: 4 }}
                    connectNulls={true}
                  />
                )}
              </>
            ) : isVNDEntity ? (
              <>
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatCompactVND(value)}
                  width={60}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === currentYear?.toString() || name === 'current') {
                      return formatVND(value);
                    }
                    if (name === (currentYear ? (currentYear - 1).toString() : 'previous') || name === 'previous') {
                      return formatVND(value);
                    }
                    return formatVND(value);
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={currentYear ? currentYear.toString() : 'amount'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name={currentYear ? currentYear.toString() : 'Amount'}
                  dot={{ r: 4 }}
                  connectNulls={true}
                />
                {currentYear && (
                  <Line
                    type="monotone"
                    dataKey={(currentYear - 1).toString()}
                    stroke="#6B7280"
                    strokeWidth={2}
                    name={(currentYear - 1).toString()}
                    dot={{ r: 4 }}
                    connectNulls={true}
                  />
                )}
              </>
            ) : isJPYEntity ? (
              <>
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatCompactJPY(value)}
                  width={60}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === currentYear?.toString() || name === 'current') {
                      return formatJPY(value);
                    }
                    if (name === (currentYear ? (currentYear - 1).toString() : 'previous') || name === 'previous') {
                      return formatJPY(value);
                    }
                    return formatJPY(value);
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={currentYear ? currentYear.toString() : 'amount'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name={currentYear ? currentYear.toString() : 'Amount'}
                  dot={{ r: 4 }}
                  connectNulls={true}
                />
                {currentYear && (
                  <Line
                    type="monotone"
                    dataKey={(currentYear - 1).toString()}
                    stroke="#6B7280"
                    strokeWidth={2}
                    name={(currentYear - 1).toString()}
                    dot={{ r: 4 }}
                    connectNulls={true}
                  />
                )}
              </>
            ) : (
              <>
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatCompactCurrency(value, 'USD')}
                  width={60}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === currentYear?.toString() || name === 'current') {
                      return formatCurrency(value, 'USD');
                    }
                    if (name === (currentYear ? (currentYear - 1).toString() : 'previous') || name === 'previous') {
                      return formatCurrency(value, 'USD');
                    }
                    if (name === 'amount') {
                      return formatCurrency(value, 'USD');
                    }
                    return formatCurrency(value, 'USD');
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={currentYear ? currentYear.toString() : 'amount'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name={currentYear ? currentYear.toString() : 'Amount'}
                  dot={{ r: 4 }}
                  connectNulls={true}
                />
                {currentYear && (
                  <Line
                    type="monotone"
                    dataKey={(currentYear - 1).toString()}
                    stroke="#6B7280"
                    strokeWidth={2}
                    name={(currentYear - 1).toString()}
                    dot={{ r: 4 }}
                    connectNulls={true}
                  />
                )}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
