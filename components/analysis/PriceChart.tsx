'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PriceData {
  [entity: string]: {
    qty: number;
    amt: number;
    price: number;
  };
}

interface PriceChartProps {
  data: PriceData;
  year: number;
  model: string;
}

export function PriceChart({ data, year, model }: PriceChartProps) {
  const chartData = Object.entries(data)
    .filter(([entity]) => entity !== 'HQ')
    .map(([entity, values]) => ({
      entity,
      price: Math.round(values.price),
      qty: values.qty,
      amt: values.amt,
    }))
    .sort((a, b) => a.entity.localeCompare(b.entity));

  const formatCurrency = (value: number) => {
    return `₩${value.toLocaleString('ko-KR')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold">{data.entity}</p>
          <p className="text-sm">단가: {formatCurrency(data.price)}</p>
          <p className="text-sm">수량: {data.qty.toLocaleString()}대</p>
          <p className="text-sm">매출: {formatCurrency(data.amt)}</p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        데이터가 없습니다
      </div>
    );
  }

  const color = year === 2024 
    ? 'rgba(52, 152, 219, 0.7)' 
    : 'rgba(231, 76, 60, 0.7)';

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="entity" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          tickFormatter={(value) => formatCurrency(value)}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="price" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

