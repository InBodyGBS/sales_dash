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
import { SalesDataTable } from '@/components/dashboard/SalesDataTable';
import { Entity } from '@/lib/types/sales';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ENTITY_DISPLAY_NAMES: Record<Entity, string> = {
  HQ: 'HQ',
  USA: 'USA',
  BWA: 'BWA',
  Vietnam: 'Vietnam',
  Healthcare: 'Healthcare',
  Korot: 'Korot',
  Japan: 'Japan',
  China: 'China',
  All: 'All',
};

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
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [industryBreakdown, setIndustryBreakdown] = useState<any[]>([]);

  // Validate entity
  const validEntities: Entity[] = ['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'];
  const isValidEntity = validEntities.includes(entity);

  useEffect(() => {
    if (!isValidEntity) {
      toast.error('Invalid entity selected');
      router.push('/dashboard');
      return;
    }
    fetchYears();
  }, [entity, isValidEntity, router]);

  useEffect(() => {
    if (year && isValidEntity) {
      fetchAllData();
    }
  }, [year, entity, quarter, countries, fg, isValidEntity]);

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
      // Use the entity from URL, not from filters
      const entityParam = entity;
      
      console.log(`📊 Fetching dashboard data for year: ${year}, entity: ${entityParam}`);
      
      const basePromises = [
        fetch(`/api/dashboard/summary?year=${year}&entities=${entityParam}`),
        fetch(`/api/dashboard/monthly-trend?year=${year}&entities=${entityParam}`),
        fetch(`/api/dashboard/quarterly-comparison?year=${year}&entities=${entityParam}`),
        fetch(`/api/dashboard/channel-sales?year=${year}&limit=10&entities=${entityParam}`),
        fetch(`/api/dashboard/top-products?year=${year}&limit=10&entities=${entityParam}`),
        fetch(`/api/dashboard/industry-breakdown?year=${year}&entities=${entityParam}`),
      ];

      // Only fetch FG distribution for Japan, China, and Healthcare
      // USA, HQ, Vietnam, Korot, BWA do NOT show FG distribution
      const entitiesWithFG = ['Japan', 'China', 'Healthcare'];
      const allPromises = entitiesWithFG.includes(entityParam)
        ? [
            ...basePromises.slice(0, 3),
            fetch(`/api/dashboard/fg-distribution?year=${year}&entities=${entityParam}`),
            ...basePromises.slice(3),
          ]
        : basePromises;

      const [
        kpiRes,
        monthlyRes,
        quarterlyRes,
        ...restRes
      ] = await Promise.all(allPromises);

      if (!kpiRes.ok) {
        const errorText = await kpiRes.text();
        console.error(`❌ KPI API failed (${kpiRes.status}):`, errorText);
        throw new Error(`Failed to fetch KPI data: ${kpiRes.status} ${errorText}`);
      }
      if (!monthlyRes.ok) {
        const errorText = await monthlyRes.text();
        console.error(`❌ Monthly trend API failed (${monthlyRes.status}):`, errorText);
        throw new Error(`Failed to fetch monthly trend: ${monthlyRes.status} ${errorText}`);
      }
      // Quarterly comparison은 타임아웃 시 빈 배열로 처리 (대량 데이터 처리 중)
      if (!quarterlyRes.ok) {
        console.warn('⚠️ Quarterly comparison failed, using empty data');
      }
      
      const kpiDataJson = await kpiRes.json();
      console.log(`✅ KPI data received:`, {
        year,
        entity: entityParam,
        totalAmount: kpiDataJson.totalAmount,
        prevTotalAmount: kpiDataJson.prevTotalAmount,
        comparison: kpiDataJson.comparison
      });
      
      setKpiData(kpiDataJson);
      setMonthlyTrend(await monthlyRes.json());
      // Quarterly comparison은 에러 시 빈 배열 사용
      try {
        setQuarterlyComparison(quarterlyRes.ok ? await quarterlyRes.json() : []);
      } catch (e) {
        console.warn('Failed to parse quarterly comparison:', e);
        setQuarterlyComparison([]);
      }

      // Handle FG distribution only for Japan, China, and Healthcare
      if (entitiesWithFG.includes(entityParam)) {
        const [fgRes, channelRes, productsRes, industryRes] = restRes;
        if (!fgRes.ok) throw new Error('Failed to fetch FG distribution');
        if (!channelRes.ok) throw new Error('Failed to fetch channel sales');
        if (!productsRes.ok) throw new Error('Failed to fetch top products');
        if (!industryRes.ok) throw new Error('Failed to fetch industry breakdown');
        
        setFGDistribution(await fgRes.json());
        setChannelSales(await channelRes.json());
        setTopProducts(await productsRes.json());
        setIndustryBreakdown(await industryRes.json());
      } else {
        // USA, HQ, Vietnam, Korot, BWA: No FG distribution
        const [channelRes, productsRes, industryRes] = restRes;
        if (!channelRes.ok) throw new Error('Failed to fetch channel sales');
        if (!productsRes.ok) throw new Error('Failed to fetch top products');
        if (!industryRes.ok) throw new Error('Failed to fetch industry breakdown');
        
        setChannelSales(await channelRes.json());
        setTopProducts(await productsRes.json());
        setIndustryBreakdown(await industryRes.json());
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch data:', error);
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
          {/* Only Japan, China, and Healthcare show FG Distribution */}
          {entity === 'Korot' || entity === 'BWA' || entity === 'Vietnam' || entity === 'HQ' || entity === 'USA' ? (
            <>
              {/* Monthly Trend - Full Width for USA, HQ, Vietnam, Korot, BWA */}
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
          ) : (
            <>
              {/* Japan, China, Healthcare: Show FG Distribution */}
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
                <FGDistributionChart data={fgDistribution} loading={loading} />
                <ChannelSalesChart data={channelSales} loading={loading} entity={entity} />
              </div>
            </>
          )}
          
          {/* Top Products Section */}
          <TopProductsChart data={topProducts} loading={loading} entity={entity} />

          {/* Industry Analysis Section */}
          <IndustryBreakdownChart data={industryBreakdown} loading={loading} />

          {/* Data Table Section */}
          <SalesDataTable
            year={year}
            entities={[entity]} // Fixed to current entity
            quarter={quarter}
            countries={countries}
            fg={fg}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
