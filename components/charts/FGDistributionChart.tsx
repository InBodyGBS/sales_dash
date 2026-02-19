'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatCNH, formatJPY, formatKRW, formatCompactKRW } from '@/lib/utils/formatters';

interface FGDistributionData {
  fg?: string;
  fg_classification?: string;
  category?: string;
  amount: number;
  percentage?: number;
}

interface FGDistributionChartProps {
  data: FGDistributionData[];
  loading?: boolean;
  entity?: string;
  showCategory?: boolean; // Category 차트로 표시할지 여부
}

const COLORS = {
  FG: '#3B82F6',
  NonFG: '#6B7280',
};

// Category 차트용 색상 팔레트
const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#EAB308', '#F43F5E'
];

export function FGDistributionChart({ data, loading, entity, showCategory = false }: FGDistributionChartProps) {
  const isKRWEntity = entity === 'All' || (entity && ['HQ', 'Healthcare', 'Korot'].includes(entity));
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{showCategory ? 'Category Distribution' : 'FG vs NonFG'}</CardTitle>
          <CardDescription>{showCategory ? 'Sales distribution by category (KRW)' : 'Sales distribution by FG classification'}</CardDescription>
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
          <CardTitle>{showCategory ? 'Category Distribution' : 'FG vs NonFG'}</CardTitle>
          <CardDescription>{showCategory ? 'Sales distribution by category (KRW)' : 'Sales distribution by FG classification'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total for percentage calculation (if not provided)
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  
  const chartData = data.map((item, index) => ({
    name: showCategory 
      ? (item.category || 'Unknown')
      : (item.fg || item.fg_classification || 'Unknown'),
    value: item.amount,
    percentage: item.percentage !== undefined ? item.percentage : (total > 0 ? (item.amount / total) * 100 : 0),
    color: showCategory 
      ? CATEGORY_COLORS[index % CATEGORY_COLORS.length]
      : (COLORS[item.fg as keyof typeof COLORS] || COLORS[item.fg_classification as keyof typeof COLORS] || '#8884d8'),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{showCategory ? 'Category Distribution' : 'FG vs NonFG'}</CardTitle>
        <CardDescription>{showCategory ? 'Sales distribution by category (KRW)' : 'Sales distribution by FG classification'}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={showCategory ? 400 : 300}>
          {showCategory ? (
            <PieChart margin={{ top: -40, right: 0, bottom: -40, left: 0 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percentage }) => {
                  // 작은 조각(3% 미만)은 레이블 숨기기
                  if ((percentage || 0) < 3) {
                    return '';
                  }
                  return `${name}\n${(percentage || 0).toFixed(1)}%`;
                }}
                outerRadius={showCategory ? 140 : 100}
                innerRadius={showCategory ? 60 : 50}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => {
                  const amount = props.payload.value;
                  const percentage = props.payload.percentage;
                  const categoryName = props.payload.name;
                  return [
                    <div key="tooltip" className="space-y-1">
                      <div className="font-semibold text-base">{categoryName}</div>
                      <div className="text-blue-600 font-medium">{formatKRW(amount)}</div>
                      <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>,
                    ''
                  ];
                }}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #ccc', 
                  borderRadius: '8px', 
                  padding: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
            </PieChart>
          ) : (
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
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => {
                  if (isKRWEntity) {
                    return formatKRW(value);
                  } else if (entity === 'China') {
                    return formatCNH(value);
                  } else if (entity === 'Japan') {
                    return formatJPY(value);
                  }
                  return formatCurrency(value, 'USD');
                }} 
              />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
