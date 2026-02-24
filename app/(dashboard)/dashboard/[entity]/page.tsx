'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICards } from '@/components/dashboard/KPICards';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { QuarterlyComparisonChart } from '@/components/charts/QuarterlyComparisonChart';
import { FGDistributionChart } from '@/components/charts/FGDistributionChart';
import { ChannelSalesChart } from '@/components/charts/ChannelSalesChart';
import { TopProductsChart } from '@/components/charts/TopProductsChart';
import { IndustryBreakdownChart } from '@/components/charts/IndustryBreakdownChart';
// import { SalesDataTable } from '@/components/dashboard/SalesDataTable';
import { Entity } from '@/lib/types/sales';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ENTITY_DISPLAY_NAMES = {
  HQ: 'HQ',
  USA: 'USA',
  BWA: 'BWA',
  Vietnam: 'Vietnam',
  Healthcare: 'Healthcare',
  Korot: 'Korot',
  Japan: 'Japan',
  China: 'China',
  India: 'India',
  Mexico: 'Mexico',
  Oceania: 'Oceania',
  Netherlands: 'Netherlands',
  Germany: 'Germany',
  UK: 'UK',
  Asia: 'Asia',
  Europe: 'Europe',
  Singapore: 'Singapore',
  All: 'All',
} as const;

export default function EntityDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const entity = params.entity as Entity;

  const [year, setYear] = useState<string>('');
  const [quarter, setQuarter] = useState<string>('All');
  const [month, setMonth] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [fg, setFG] = useState<string>('All');
  
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [quarterlyComparison, setQuarterlyComparison] = useState<any[]>([]);
  const [fgDistribution, setFGDistribution] = useState<any[]>([]);
  const [channelSales, setChannelSales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any>(null);
  const [industryBreakdown, setIndustryBreakdown] = useState<any[]>([]);
  const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Validate entity dynamically based on available entities from API
  const isValidEntity = availableEntities.length === 0 || availableEntities.includes(entity);

  useEffect(() => {
    // First, fetch available entities to validate
    fetchAvailableEntities();
  }, []);

  useEffect(() => {
    // Wait for available entities to be loaded
    if (availableEntities.length === 0) return;
    
    if (!isValidEntity) {
      toast.error('Invalid entity selected');
      router.push('/dashboard');
      return;
    }
    fetchYears();
  }, [entity, isValidEntity, router, availableEntities]);

  useEffect(() => {
    if (year && isValidEntity) {
      fetchAllData();
    }
  }, [year, entity, quarter, countries, fg, isValidEntity]);

  const fetchAvailableEntities = async () => {
    try {
      const res = await fetch('/api/entities/available');
      if (res.ok) {
        const data = await res.json();
        if (data.entities && Array.isArray(data.entities)) {
          setAvailableEntities(data.entities as Entity[]);
          console.log(`✅ Available entities loaded:`, data.entities);
        }
      }
    } catch (error) {
      console.error('Failed to fetch available entities:', error);
      // If API fails, allow all entities (fallback)
      setAvailableEntities(['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania']);
    }
  };

  const fetchYears = async () => {
    try {
      console.log(`🔍 Fetching years for entity: ${entity}`);
      const res = await fetch(`/api/years?entity=${entity}`);
      console.log(`📡 Years API response status: ${res.status}`);
      
      if (!res.ok) {
        console.error(`❌ Years API failed for ${entity}:`, res.status, res.statusText);
        return;
      }
      
      const data = await res.json();
      console.log(`📅 Years data for ${entity}:`, data);
      
      if (data.years && data.years.length > 0 && !year) {
        console.log(`✅ Setting year to: ${data.years[0]} for entity: ${entity}`);
        setYear(String(data.years[0]));
      } else {
        console.warn(`⚠️ No years found for entity: ${entity}`);
      }
    } catch (error) {
      console.error(`❌ Failed to fetch years for ${entity}:`, error);
    }
  };

  const handleRefreshMaterializedView = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/dashboard/refresh', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Materialized view가 갱신되었습니다. (${data.recordCount || 0}개 레코드) 데이터를 다시 불러옵니다...`, { duration: 5000 });
        // 갱신 후 데이터 다시 불러오기
        setTimeout(() => {
          fetchAllData();
        }, 2000);
      } else {
        if (data.isTimeout) {
          toast.error(
            `갱신이 timeout되었습니다. Supabase SQL Editor에서 직접 실행해주세요:\n\n${data.sqlCommand}`,
            { duration: 10000 }
          );
        } else {
          toast.error(`갱신 실패: ${data.details || data.error}`, { duration: 5000 });
        }
        console.error('Refresh error details:', data);
      }
    } catch (error) {
      toast.error('Materialized view 갱신 중 오류가 발생했습니다');
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      const response = await fetch(`/api/dashboard/debug?entity=${entity}&year=${year}`);
      const data = await response.json();
      setDiagnostics(data);
      console.log('Diagnostics:', data);
      
      if (data.recommendations?.needsRefresh) {
        toast.error('데이터가 sales_data에는 있지만 mv_sales_cube에는 없습니다. Materialized view를 갱신해주세요.');
      } else if (data.diagnostics?.sales_data?.count === 0) {
        toast.error('sales_data에 데이터가 없습니다. 데이터를 업로드해주세요.');
      } else {
        toast.success('진단 완료. 콘솔을 확인하세요.');
      }
    } catch (error) {
      toast.error('진단 중 오류가 발생했습니다');
      console.error('Diagnostics error:', error);
    }
  };

  const fetchAllData = async () => {
    console.log(`🔄 fetchAllData called - year: ${year}, entity: ${entity}`);
    setLoading(true);
    try {
      const entityParam = entity;
      const yearInt = parseInt(year);
      const fgFilter = fg && fg !== 'All' ? fg : null;
      const quarterFilter = quarter && quarter !== 'All' ? quarter : null;
      
      console.log(`📊 Fetching dashboard data via API for year: ${yearInt}, entity: ${entityParam}, fg: ${fgFilter}, quarter: ${quarterFilter}`);
      
      // Fetch summary data
      const summaryRes = await fetch(`/api/dashboard/summary?year=${yearInt}&entities=${entityParam}`);
      if (!summaryRes.ok) {
        throw new Error(`Failed to fetch summary: ${summaryRes.statusText}`);
      }
      const summaryData = await summaryRes.json();
      
      // Fetch monthly trend
      const monthlyRes = await fetch(`/api/dashboard/monthly-trend?year=${yearInt}&entities=${entityParam}`);
      const monthlyData = monthlyRes.ok ? await monthlyRes.json() : [];
      
      // Fetch quarterly comparison
      const quarterlyRes = await fetch(`/api/dashboard/quarterly-comparison?year=${yearInt}&entities=${entityParam}`);
      const quarterlyData = quarterlyRes.ok ? await quarterlyRes.json() : [];
      
      // Fetch top products
      const topProductsRes = await fetch(`/api/dashboard/top-products?year=${yearInt}&entities=${entityParam}`);
      const topProductsData = topProductsRes.ok ? await topProductsRes.json() : { byAmount: [], byQuantity: [], categories: [], allProducts: [] };
      
      // Fetch industry breakdown
      const industryRes = await fetch(`/api/dashboard/industry-breakdown?year=${yearInt}&entities=${entityParam}`);
      const industryData = industryRes.ok ? await industryRes.json() : [];
      
      console.log(`✅ Dashboard data received via API:`, {
        year: yearInt,
        entity: entityParam,
        summaryData,
        monthlyData: monthlyData?.slice(0, 3), // First 3 items
        quarterlyData: quarterlyData?.slice(0, 2), // First 2 items
        topProductsData: Array.isArray(topProductsData) ? topProductsData.slice(0, 2) : topProductsData,
        industryData: industryData?.slice(0, 2), // First 2 items
      });
      
      // Transform data for KPI cards
      const totalAmount = summaryData.total_amount || summaryData.totalAmount || 0;
      const prevYearAmount = summaryData.prev_total_amount || summaryData.prevTotalAmount || summaryData.prev_year_amount || 0;
      const amountChange = summaryData.comparison?.amount || (prevYearAmount > 0
        ? ((totalAmount - prevYearAmount) / prevYearAmount) * 100
        : 0);
      
      // For Asia entity, fetch currency breakdown
      let currencyBreakdown: any[] = [];
      if (entityParam === 'Asia') {
        try {
          console.log(`🔄 Fetching currency breakdown for Asia, year: ${yearInt}`);
          const currencyRes = await fetch(`/api/dashboard/currency-summary?year=${yearInt}&entity=${entityParam}`);
          console.log(`📡 Currency summary API response status: ${currencyRes.status}`);
          if (currencyRes.ok) {
            const currencyData = await currencyRes.json();
            currencyBreakdown = currencyData?.currencyBreakdown ?? [];
            console.log(`✅ Currency breakdown for Asia:`, currencyBreakdown);
            console.log(`📊 Currency breakdown length: ${currencyBreakdown.length}`);
          } else {
            const errorText = await currencyRes.text();
            console.error(`❌ Currency summary API failed: ${currencyRes.status}`, errorText);
          }
        } catch (error) {
          console.error('❌ Failed to fetch currency breakdown:', error);
        }
      }
      
      setKpiData({
        totalAmount,
        totalQty: summaryData.total_qty || summaryData.totalQty || 0,
        avgAmount: summaryData.avg_amount || summaryData.avgAmount || 0,
        totalTransactions: summaryData.total_transactions || summaryData.totalTransactions || 0,
        prevTotalAmount: prevYearAmount,
        prevTotalQty: summaryData.prev_total_qty || summaryData.prevTotalQty || 0,
        comparison: {
          amount: amountChange,
          qty: summaryData.comparison?.qty || summaryData.qty_change || 0,
        },
        currencyBreakdown,
      });
      
      // Transform monthly trend data
      // API returns: [{ month, amount, quantity, prev_amount, prev_quantity }]
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const monthlyTrendData = months.map((month) => {
        const monthData = monthlyData.find((m: any) => m.month === month);
        return {
          month,
          amount: monthData?.amount || 0,
          qty: monthData?.quantity || 0,
          prevAmount: monthData?.prev_amount || 0,
          prevQty: monthData?.prev_quantity || 0,
        };
      });
      setMonthlyTrend(monthlyTrendData);
      
      // Transform quarterly data
      // API returns: [{ quarter, current_amount, previous_amount, current_quantity, previous_quantity }]
      const quarters = ["Q1", "Q2", "Q3", "Q4"];
      const quarterlyTransformed = quarters.map((q) => {
        const quarterData = quarterlyData.find((qd: any) => qd.quarter === q);
        return {
          quarter: q,
          currentYear: quarterData?.current_amount || 0,
          previousYear: quarterData?.previous_amount || 0,
        };
      });
      setQuarterlyComparison(quarterlyTransformed);
      
      // Fetch channel sales with all filters
      const channelParams = new URLSearchParams({
        year: String(yearInt),
        entities: entityParam,
        limit: '10',
        quarter: quarter || 'All',
      });
      const channelRes = await fetch(`/api/dashboard/channel-sales?${channelParams}`);
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        setChannelSales(channelData);
      } else {
        setChannelSales([]);
      }
      
      // Transform top products data
      // API returns: [{ product, category, fg_classification, amount, quantity, transactions }]
      // TopProductsChart expects: { byAmount, byQuantity, categories, allProducts }
      if (Array.isArray(topProductsData)) {
        const allProducts = topProductsData.map((p: any) => ({
          product: p.product || 'Unknown',
          amount: p.amount || 0,
          qty: p.quantity || 0,
          category: p.category || null,
        }));
        
        const byAmount = [...allProducts]
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 10);
        
        const byQuantity = [...allProducts]
          .sort((a, b) => (b.qty || 0) - (a.qty || 0))
          .slice(0, 10);
        
        const categories = Array.from(new Set(
          allProducts.map((p: any) => p.category).filter(Boolean)
        ));
        
        setTopProducts({
          byAmount,
          byQuantity,
          categories,
          allProducts,
        });
      } else {
        // Already in correct format
        setTopProducts(topProductsData);
      }
      
      // Industry breakdown
      setIndustryBreakdown(industryData.map((item: any) => ({
        industry: item.industry,
        amount: item.amount,
        transactions: 0, // RPC에서 제공하지 않음
      })));
      
      // FG distribution (only for Healthcare)
      const entitiesWithFG = ['Healthcare'];
      if (entitiesWithFG.includes(entityParam)) {
        // Fetch FG distribution data from API
        try {
          const fgRes = await fetch(`/api/dashboard/fg-distribution?year=${yearInt}&entities=${entityParam}`);
          if (fgRes.ok) {
            const fgData = await fgRes.json();
            // Transform API response to match chart format
            const transformedFgData = fgData.map((item: any) => ({
              fg: item.fg || item.fg_classification || 'NonFG',
              amount: item.amount || 0,
              percentage: item.percentage || 0,
            }));
            setFGDistribution(transformedFgData);
            console.log(`✅ FG distribution data loaded:`, transformedFgData);
          } else {
            console.warn('⚠️ Failed to fetch FG distribution, using empty data');
            setFGDistribution([]);
          }
        } catch (fgError) {
          console.error('❌ Error fetching FG distribution:', fgError);
          setFGDistribution([]);
        }
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch dashboard data via RPC:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isValidEntity) {
    return null; // Will redirect
  }

  if (!year) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No data available for {ENTITY_DISPLAY_NAMES[entity]}. Please upload sales data first.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Entity Selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {ENTITY_DISPLAY_NAMES[entity]} Sales Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Analyze sales performance for {ENTITY_DISPLAY_NAMES[entity]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunDiagnostics}
            title="데이터 진단 실행"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            진단
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshMaterializedView}
            disabled={refreshing}
            title="Materialized View 갱신"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '갱신 중...' : '갱신'}
          </Button>
        </div>
      </div>

      {diagnostics && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <div className="font-semibold mb-2">진단 결과:</div>
          <div className="space-y-1">
            <div>sales_data: {diagnostics.diagnostics?.sales_data?.count || 0}개 레코드</div>
            <div>mv_sales_cube: {diagnostics.diagnostics?.mv_sales_cube?.count || 0}개 레코드</div>
            <div className="font-semibold text-red-600 mt-2">
              {diagnostics.recommendations?.message}
            </div>
            {diagnostics.diagnostics?.rpc_functions?.refresh_mv_sales_cube?.error && (
              <div className="text-red-600 mt-1">
                RPC 함수 오류: {diagnostics.diagnostics.rpc_functions.refresh_mv_sales_cube.error}
              </div>
            )}
            {diagnostics.diagnostics?.all_years_stats && (
              <div className="mt-3 pt-3 border-t">
                <div className="font-semibold mb-1">전체 연도 통계:</div>
                {Object.entries(diagnostics.diagnostics.all_years_stats)
                  .sort(([a], [b]) => parseInt(b) - parseInt(a)) // 연도 내림차순 정렬 (최신 연도 먼저)
                  .map(([y, stats]: [string, any]) => (
                    <div key={y} className={stats.needsRefresh ? 'text-red-600 font-semibold' : ''}>
                      {y}년: sales_data {stats.sales_data}개 / mv_sales_cube {stats.mv_sales_cube}개
                      {stats.needsRefresh && ' ⚠️ 갱신 필요'}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <DashboardFilters
            year={year}
            entities={[entity]} // Fixed to current entity
            quarter={quarter}
            month={month}
            countries={countries}
            fg={fg}
            onYearChange={setYear}
            onEntitiesChange={() => {}} // Disabled - entity is fixed from URL
            onQuarterChange={setQuarter}
            onMonthChange={setMonth}
            onCountriesChange={setCountries}
            onFGChange={setFG}
            disableEntitySelection={true} // Add this prop to disable entity selection
            entity={entity} // entity prop 추가하여 해당 entity의 years 가져오기
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          <KPICards data={kpiData} loading={loading} entity={entity} />

          {/* Time Trend Section */}
          {/* Only Healthcare shows FG Distribution */}
          {entity === 'Healthcare' ? (
            <>
              {/* Healthcare: Show FG Distribution */}
              <div className="grid gap-6 md:grid-cols-2">
                <MonthlyTrendChart data={monthlyTrend} loading={loading} entity={entity} currentYear={parseInt(year)} />
                <QuarterlyComparisonChart
                  data={quarterlyComparison}
                  currentYear={parseInt(year)}
                  loading={loading}
                  entity={entity}
                />
              </div>

              {/* FG Distribution and Channel Sales Section */}
              <div className="grid gap-6 md:grid-cols-2">
                <FGDistributionChart data={fgDistribution} loading={loading} entity={entity} />
                <ChannelSalesChart data={channelSales} loading={loading} entity={entity} />
              </div>
            </>
          ) : (
            <>
              {/* USA, HQ, Vietnam, Korot, BWA, Japan, China, Mexico, India, Oceania: USA Style Layout */}
              {/* Monthly Trend - Full Width */}
              <div className="grid gap-6 md:grid-cols-1">
                <MonthlyTrendChart data={monthlyTrend} loading={loading} entity={entity} currentYear={parseInt(year)} />
              </div>
              {/* Quarterly Comparison and Channel Sales */}
              <div className="grid gap-6 md:grid-cols-2">
                <QuarterlyComparisonChart
                  data={quarterlyComparison}
                  currentYear={parseInt(year)}
                  loading={loading}
                  entity={entity}
                />
                <ChannelSalesChart data={channelSales} loading={loading} entity={entity} />
              </div>
            </>
          )}
          
          {/* Top Products Section */}
          <TopProductsChart data={topProducts} loading={loading} entity={entity} />

          {/* Industry Analysis Section */}
          <IndustryBreakdownChart data={industryBreakdown} loading={loading} entity={entity} />

          {/* Data Table Section - Hidden */}
          {/* <SalesDataTable
            year={year}
            entities={[entity]} // Fixed to current entity
            quarter={quarter}
            countries={countries}
            fg={fg}
            loading={loading}
          /> */}
        </div>
      </div>
    </div>
  );
}
