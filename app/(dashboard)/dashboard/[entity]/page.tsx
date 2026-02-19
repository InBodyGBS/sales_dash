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
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getDashboardData, transformMonthlyTrend, transformQuarterly, transformTopProducts } from '@/lib/dashboard';

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

  const fetchAllData = async () => {
    console.log(`🔄 fetchAllData called - year: ${year}, entity: ${entity}`);
    setLoading(true);
    try {
      const entityParam = entity;
      const yearInt = parseInt(year);
      const fgFilter = fg && fg !== 'All' ? fg : null;
      
      console.log(`📊 Fetching dashboard data via RPC for year: ${yearInt}, entity: ${entityParam}, fg: ${fgFilter}`);
      
      // Create Supabase client
      const supabase = createClient();
      
      // Single RPC call to get all dashboard data
      const dashboardData = await getDashboardData(supabase, entityParam, yearInt, fgFilter);
      
      console.log(`✅ Dashboard data received via RPC:`, {
        year: yearInt,
        entity: entityParam,
        total_amount: dashboardData.total_amount,
        prev_year_amount: dashboardData.prev_year_amount,
        monthly_trend_count: dashboardData.monthly_trend.length,
        quarterly_count: dashboardData.quarterly.length,
        channels_count: dashboardData.channels.length,
        top_products_count: dashboardData.top_products_amount.length,
        industries_count: dashboardData.industries.length,
      });
      
      // Transform data for KPI cards
      const amountChange = dashboardData.prev_year_amount > 0
        ? ((dashboardData.total_amount - dashboardData.prev_year_amount) / dashboardData.prev_year_amount) * 100
        : 0;
      
      // For Asia entity, fetch currency breakdown
      let currencyBreakdown: any[] | undefined = undefined;
      if (entityParam === 'Asia') {
        try {
          console.log(`🔄 Fetching currency breakdown for Asia, year: ${yearInt}`);
          const currencyRes = await fetch(`/api/dashboard/currency-summary?year=${yearInt}&entity=${entityParam}`);
          console.log(`📡 Currency summary API response status: ${currencyRes.status}`);
          if (currencyRes.ok) {
            const currencyData = await currencyRes.json();
            currencyBreakdown = currencyData.currencyBreakdown || [];
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
        totalAmount: dashboardData.total_amount,
        totalQty: 0, // RPC에서 제공되지 않으면 0
        avgAmount: 0,
        totalTransactions: 0,
        prevTotalAmount: dashboardData.prev_year_amount,
        prevTotalQty: 0,
        comparison: {
          amount: amountChange,
          qty: 0,
        },
        currencyBreakdown,
      });
      
      // Transform monthly trend data
      const monthlyTrendData = transformMonthlyTrend(dashboardData.monthly_trend, yearInt);
      setMonthlyTrend(monthlyTrendData);
      
      // Transform quarterly data
      const quarterlyData = transformQuarterly(dashboardData.quarterly, yearInt);
      setQuarterlyComparison(quarterlyData);
      
      // Set other data directly from RPC response
      setChannelSales(dashboardData.channels);
      const topProductsData = transformTopProducts(dashboardData);
      setTopProducts(topProductsData);
      
      // Industry breakdown
      setIndustryBreakdown(dashboardData.industries.map((item) => ({
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
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <DashboardFilters
            year={year}
            entities={[entity]} // Fixed to current entity
            quarter={quarter}
            countries={countries}
            fg={fg}
            onYearChange={setYear}
            onEntitiesChange={() => {}} // Disabled - entity is fixed from URL
            onQuarterChange={setQuarter}
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
