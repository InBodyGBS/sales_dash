'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatNumber, formatKRW, formatVND, formatJPY, formatCNH, formatCompactKRW, formatCompactCurrency, formatCompactVND, formatCompactJPY, formatCompactCNH } from '@/lib/utils/formatters';
import { Entity } from '@/lib/types/sales';

interface TopProductsData {
  product: string;
  amount: number;
  qty: number;
  category?: string | null;
}

interface TopProductsResponse {
  byAmount: TopProductsData[];
  byQuantity: TopProductsData[];
  categories?: string[];
  allProducts?: TopProductsData[];
}

interface TopProductsChartProps {
  data: TopProductsResponse | TopProductsData[];
  loading?: boolean;
  entity?: Entity;
}

export function TopProductsChart({ data, loading, entity }: TopProductsChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isKRWEntity = entity && ['HQ', 'Healthcare', 'Korot', 'All'].includes(entity);
  const isVNDEntity = entity === 'Vietnam';
  const isJPYEntity = entity === 'Japan';
  const isCNHEntity = entity === 'China';
  const isEUREntity = entity && ['Netherlands', 'Germany', 'UK', 'Europe'].includes(entity);
  
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
  const responseData = isNewFormat ? (data as TopProductsResponse) : null;
  const categories = responseData?.categories || [];
  const allProducts = responseData?.allProducts || null;
  
  // Sort base data with NULL handling
  const baseAmountData = isNewFormat && responseData 
    ? [...responseData.byAmount].sort((a, b) => (b.amount || 0) - (a.amount || 0))
    : [...(data as TopProductsData[])].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const baseQuantityData = isNewFormat && responseData 
    ? [...responseData.byQuantity].sort((a, b) => (b.qty || 0) - (a.qty || 0))
    : [...(data as TopProductsData[])].sort((a, b) => (b.qty || 0) - (a.qty || 0));

  // Debug: Log categories and allProducts count
  console.log('TopProductsChart - Data format:', isNewFormat ? 'new' : 'old');
  console.log('TopProductsChart - ResponseData:', responseData);
  console.log('TopProductsChart - Categories (count):', categories.length);
  console.log('TopProductsChart - Categories (values):', JSON.stringify(categories));
  console.log('TopProductsChart - AllProducts count:', allProducts?.length || 0);
  if (allProducts && allProducts.length > 0) {
    const categoryCounts = allProducts.reduce((acc, p) => {
      const cat = p.category || 'null';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('TopProductsChart - Category distribution:', JSON.stringify(categoryCounts));
    
    // Also log all unique categories from allProducts
    const allCategoriesFromProducts = Array.from(new Set(
      allProducts.map(p => p.category).filter(c => c)
    ));
    console.log('TopProductsChart - All categories from allProducts:', JSON.stringify(allCategoriesFromProducts));
  }

  // Filter and sort data based on selected category
  // Logic:
  // - "All" selected: Show top 10 products by total sales across all categories
  // - Category selected: Show top 10 products within that specific category
  const amountData = (() => {
    if (!selectedCategory) {
      // "All" selected: Show top 10 products by total sales (across all categories)
      return baseAmountData;
    }
    
    // Category selected: Filter from allProducts and show top 10 of that category
    if (allProducts && allProducts.length > 0) {
      const filtered = allProducts.filter(item => item.category === selectedCategory);
      const sorted = filtered.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      const top10 = sorted.slice(0, 10);
      
      console.log(`TopProductsChart - Category "${selectedCategory}": ${filtered.length} products, showing top 10`);
      
      return top10;
    }
    
    // Fallback: filter from baseAmountData if allProducts is not available
    return baseAmountData.filter(item => item.category === selectedCategory);
  })();

  const quantityData = (() => {
    if (!selectedCategory) {
      // "All" selected: Show top 10 products by total quantity (across all categories)
      return baseQuantityData;
    }
    
    // Category selected: Filter from allProducts and show top 10 of that category
    if (allProducts && allProducts.length > 0) {
      const filtered = allProducts.filter(item => item.category === selectedCategory);
      const sorted = filtered.sort((a, b) => (b.qty || 0) - (a.qty || 0));
      const top10 = sorted.slice(0, 10);
      
      return top10;
    }
    
    // Fallback: filter from baseQuantityData if allProducts is not available
    return baseQuantityData.filter(item => item.category === selectedCategory);
  })();

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

  // Sort again before creating chart data to ensure correct order
  const amountChartData = [...amountData]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .map((item) => ({
      product: item.product,
      amount: item.amount || 0,
      qty: item.qty || 0,
    }));

  const quantityChartData = [...quantityData]
    .sort((a, b) => (b.qty || 0) - (a.qty || 0))
    .map((item) => ({
      product: item.product,
      amount: item.amount || 0,
      qty: item.qty || 0,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Products</CardTitle>
        <CardDescription>Best performing products (FG only)</CardDescription>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">
            No categories available. Check console for debugging info.
          </div>
        )}
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
                    if (isJPYEntity) return formatCompactJPY(value);
                    if (isCNHEntity) return formatCompactCNH(value);
                    if (isEUREntity) return formatCompactCurrency(value, 'EUR');
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
                      if (isJPYEntity) return formatJPY(value);
                      if (isCNHEntity) return formatCNH(value);
                      if (isEUREntity) return formatCurrency(value, 'EUR');
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