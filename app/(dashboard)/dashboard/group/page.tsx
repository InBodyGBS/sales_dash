'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICards } from '@/components/dashboard/KPICards';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { QuarterlyComparisonChart } from '@/components/charts/QuarterlyComparisonChart';
import { FGDistributionChart } from '@/components/charts/FGDistributionChart';
import { EntitySalesChart } from '@/components/charts/EntitySalesChart';
import { CountrySalesChart } from '@/components/charts/CountrySalesChart';
import { TopProductsChart } from '@/components/charts/TopProductsChart';
import { IndustryBreakdownChart } from '@/components/charts/IndustryBreakdownChart';
import { SalesDataTable } from '@/components/dashboard/SalesDataTable';
import { Entity } from '@/lib/types/sales';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getDashboardData, transformMonthlyTrend, transformQuarterly } from '@/lib/dashboard';

const ENTITIES: Entity[] = ['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania'];

export default function InBodyGroupDashboardPage() {
  const router = useRouter();

  const [year, setYear] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>(ENTITIES);
  const [quarter, setQuarter] = useState<string>('All');
  const [countries, setCountries] = useState<string[]>([]);
  const [fg, setFG] = useState<string>('All');
  
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [quarterlyComparison, setQuarterlyComparison] = useState<any[]>([]);
  const [fgDistribution, setFGDistribution] = useState<any[]>([]);
  const [entitySales, setEntitySales] = useState<any[]>([]);
  const [countrySales, setCountrySales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [industryBreakdown, setIndustryBreakdown] = useState<any[]>([]);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (year) {
      fetchAllData();
    }
  }, [year, entities, quarter, countries, fg]);

  const fetchYears = async () => {
    try {
      const res = await fetch(`/api/years`);
      const data = await res.json();
      if (data.years && data.years.length > 0 && !year) {
        setYear(String(data.years[0]));
      }
    } catch (error) {
      console.error('Failed to fetch years:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const yearInt = parseInt(year);
      const fgFilter = fg && fg !== 'All' ? fg : null;
      
      // For group dashboard, we need to aggregate data from all entities
      // If RPC function supports multiple entities, pass them as array
      // Otherwise, we might need to call RPC for each entity and aggregate
      // For now, assuming RPC accepts 'All' or comma-separated entities
      const entityParam = entities.length > 0 ? entities.join(',') : 'All';
      
      console.log(`📊 Fetching group dashboard data via RPC for year: ${yearInt}, entities: ${entityParam}, fg: ${fgFilter}`);
      
      // Create Supabase client
      const supabase = createClient();
      
      // For group dashboard, we might need to call RPC for 'All' entities
      // or aggregate multiple entity calls
      // Assuming get_dashboard RPC can handle 'All' or multiple entities
      const dashboardData = await getDashboardData(supabase, entityParam, yearInt, fgFilter);
      
      console.log(`✅ Group dashboard data received via RPC:`, {
        year: yearInt,
        entities: entityParam,
        total_amount: dashboardData.total_amount,
        prev_year_amount: dashboardData.prev_year_amount,
        monthly_trend_count: dashboardData.monthly_trend.length,
        quarterly_count: dashboardData.quarterly.length,
        channels_count: dashboardData.channels.length,
        top_products_count: dashboardData.top_products_amount.length,
        industries_count: dashboardData.industries.length,
        entity_list: dashboardData.entity_list,
      });
      
      // Transform data for KPI cards
      const amountChange = dashboardData.prev_year_amount > 0
        ? ((dashboardData.total_amount - dashboardData.prev_year_amount) / dashboardData.prev_year_amount) * 100
        : 0;
      
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
      });
      
      // Transform monthly trend data
      const monthlyTrendData = transformMonthlyTrend(dashboardData.monthly_trend, yearInt);
      setMonthlyTrend(monthlyTrendData);
      
      // Transform quarterly data
      const quarterlyData = transformQuarterly(dashboardData.quarterly, yearInt);
      setQuarterlyComparison(quarterlyData);
      
      // Set FG distribution
      setFGDistribution(dashboardData.fg_list?.map((fg: string) => ({
        fg_classification: fg,
        amount: 0, // RPC에서 제공되지 않으면 0
      })) || []);
      
      // Entity sales - convert entity_list to chart format
      // If RPC provides entity sales data, use it; otherwise derive from entity_list
      setEntitySales(dashboardData.entity_list?.map((e: string) => ({
        entity: e,
        amount: 0, // RPC에서 제공되지 않으면 0
      })) || []);
      
      // Country sales - might need separate RPC call or be included in dashboard data
      // For now, set empty array if not provided
      setCountrySales([]);
      
      // Set other data directly from RPC response
      setTopProducts(dashboardData.top_products_amount.map((p, idx) => ({
        product: p.product,
        amount: p.amount,
        quantity: dashboardData.top_products_quantity[idx]?.quantity || 0,
      })));
      setIndustryBreakdown(dashboardData.industries);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch group dashboard data via RPC:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!year) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No data available. Please upload sales data first.
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
              InBody Group Sales Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Analyze sales performance across all entities
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <DashboardFilters
            year={year}
            entities={entities}
            quarter={quarter}
            countries={countries}
            fg={fg}
            onYearChange={setYear}
            onEntitiesChange={setEntities}
            onQuarterChange={setQuarter}
            onCountriesChange={setCountries}
            onFGChange={setFG}
            disableEntitySelection={false}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          <KPICards data={kpiData} loading={loading} entity="All" />

          {/* Time Trend Section */}
          <div className="grid gap-6 md:grid-cols-1">
            <MonthlyTrendChart data={monthlyTrend} loading={loading} entity="All" currentYear={parseInt(year)} />
          </div>

          {/* Quarterly Comparison and Country Sales Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <QuarterlyComparisonChart
              data={quarterlyComparison}
              currentYear={parseInt(year)}
              loading={loading}
              entity="All"
            />
            <CountrySalesChart data={countrySales} loading={loading} entity="All" />
          </div>

          {/* FG & Entity Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <FGDistributionChart data={fgDistribution} loading={loading} />
            <EntitySalesChart data={entitySales} loading={loading} />
          </div>
          
          {/* Top Products Section */}
          <TopProductsChart data={topProducts} loading={loading} entity="All" />

          {/* Industry Analysis Section */}
          <IndustryBreakdownChart data={industryBreakdown} loading={loading} />

          {/* Data Table Section */}
          <SalesDataTable
            year={year}
            entities={entities}
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
