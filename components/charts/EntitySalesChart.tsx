'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { 
  formatCurrency, 
  formatNumber, 
  formatKRW,
  formatJPY,
  formatCNH,
  formatVND,
  formatINR,
  formatMXN,
  formatAUD,
  formatEUR,
  formatMYR,
  formatSGD,
} from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useState } from 'react';

interface EntitySalesData {
  entity: string;
  amount: number;
  amountLocal?: number;
  currency?: string;
  qty: number;
}

interface EntitySalesChartProps {
  data: EntitySalesData[];
  loading?: boolean;
  year?: number;
  quarter?: string;
  month?: string | null;
}

const ENTITY_COLORS: { [key: string]: string } = {
  HQ: '#3B82F6',
  USA: '#10B981',
  BWA: '#F59E0B',
  Vietnam: '#EF4444',
  Healthcare: '#8B5CF6',
  Korot: '#EC4899',
  Japan: '#F97316',
  China: '#DC2626',
  India: '#059669',
  Mexico: '#7C3AED',
  Oceania: '#0891B2',
  Netherlands: '#BE185D',
  Germany: '#1F2937',
  UK: '#0369A1',
  Asia: '#B45309',
  Europe: '#7C2D12',
  Singapore: '#1E40AF',
  Samhan: '#6B21A8',
};

// Currency formatter map
const currencyFormatters: { [key: string]: (amount: number) => string } = {
  KRW: formatKRW,
  USD: (amount: number) => formatCurrency(amount, 'USD'),
  JPY: formatJPY,
  CNH: formatCNH,
  CNY: formatCNH,
  VND: formatVND,
  INR: formatINR,
  MXN: formatMXN,
  AUD: formatAUD,
  EUR: formatEUR,
  MYR: formatMYR,
  SGD: formatSGD,
};

function formatLocalCurrency(amount: number, currency: string = 'KRW'): string {
  const formatter = currencyFormatters[currency] || ((amt: number) => formatCurrency(amt, currency));
  return formatter(amount);
}

export function EntitySalesChart({ data, loading, year, quarter, month }: EntitySalesChartProps) {
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  const handleExportExcel = () => {
    const worksheetData = [
      ['Entity', 'Amount (KRW)', 'Amount (Local Currency)', 'Currency'],
      ...data.map((item) => [
        item.entity,
        item.amount,
        item.amountLocal || item.amount,
        item.currency || 'KRW',
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entity Sales');

    // Generate filename
    let filename = `Entity_Sales_${year || 'All'}`;
    if (quarter && quarter !== 'All') filename += `_${quarter}`;
    if (month) filename += `_Month${month}`;
    filename += '.xlsx';

    XLSX.writeFile(workbook, filename);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Entity Sales</CardTitle>
            <CardDescription>Sales by entity - Amount (KRW) and Local Currency</CardDescription>
          </div>
          <Button onClick={handleExportExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="entity" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
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

          {/* Table showing both amounts */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Entity Sales Details</span>
              {isTableExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {isTableExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left font-semibold">Entity</th>
                      <th className="p-3 text-right font-semibold">Amount (KRW)</th>
                      <th className="p-3 text-right font-semibold">Amount (Local Currency)</th>
                      <th className="p-3 text-center font-semibold">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{item.entity}</td>
                        <td className="p-3 text-right">{formatKRW(item.amount)}</td>
                        <td className="p-3 text-right">
                          {formatLocalCurrency(item.amountLocal || item.amount, item.currency)}
                        </td>
                        <td className="p-3 text-center">{item.currency || 'KRW'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
