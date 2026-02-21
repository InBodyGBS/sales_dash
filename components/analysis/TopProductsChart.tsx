'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TopProduct {
  model: string;
  qty: number;
  amt: number;
  price: number;
  share: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  year: number;
  entity: string;
  onProductClick: (model: string) => void;
}

export function TopProductsChart({ data, year, entity, onProductClick }: TopProductsChartProps) {
  // Sort by amount in descending order (내림차순) - 가장 큰 금액이 위에 오도록
  const sortedData = [...data].sort((a, b) => b.amt - a.amt);
  
  const chartData = sortedData
    .slice(0, 10)
    .map((item) => ({
      ...item,
      displayModel: item.model.length > 20 ? `${item.model.substring(0, 20)}...` : item.model,
      originalModel: item.model, // 원본 모델명 보존
    }));

  // Format currency in millions (백만원 단위)
  const formatCurrency = (value: number) => {
    const millions = value / 1000000;
    return `${millions.toFixed(1)}M`;
  };
  
  // Format currency for tooltip (전체 금액 표시)
  const formatCurrencyFull = (value: number) => {
    return `₩${value.toLocaleString('ko-KR')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const modelName = data.originalModel || data.model;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold">{modelName}</p>
          <p className="text-sm">매출: {formatCurrencyFull(data.amt)} ({data.share.toFixed(1)}%)</p>
          <p className="text-sm">수량: {data.qty.toLocaleString()}대</p>
          <p className="text-sm">평균단가: {formatCurrencyFull(data.price)}</p>
          <p className="text-xs text-muted-foreground mt-1">클릭 시 단가 상세 분석 이동</p>
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
    ? 'rgba(46, 204, 113, 0.7)' 
    : 'rgba(155, 89, 182, 0.7)';

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedItem = data.activePayload[0].payload;
      if (clickedItem.originalModel) {
        onProductClick(clickedItem.originalModel);
      }
    }
  };

  return (
    <ResponsiveContainer width="100%" height={500}>
      <BarChart 
        data={chartData} 
        layout="vertical"
        margin={{ top: 20, right: 80, left: 100, bottom: 20 }}
        onClick={handleBarClick}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          type="number"
          tickFormatter={(value) => formatCurrency(value)}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          type="category" 
          dataKey="displayModel"
          width={90}
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="amt" 
          radius={[0, 8, 8, 0]}
          style={{ cursor: 'pointer' }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

