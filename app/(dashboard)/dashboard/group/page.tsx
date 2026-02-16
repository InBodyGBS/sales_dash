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
// import { SalesDataTable } from '@/components/dashboard/SalesDataTable';
import { Entity } from '@/lib/types/sales';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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
  const [topProducts, setTopProducts] = useState<any>({ byAmount: [], byQuantity: [], categories: [], allProducts: [] });
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
      
      console.log(`📊 Fetching InBody Group dashboard data (KRW) for year: ${yearInt}`);
      
      // Fetch all data in parallel using new InBody Group APIs
      const [
        summaryRes,
        monthlyRes,
        quarterlyRes,
        entitySalesRes,
        fgDistributionRes,
        countrySalesRes,
        topProductsRes,
        industryRes,
      ] = await Promise.all([
        fetch(`/api/dashboard/inbody-group/summary?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/monthly-trend?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/quarterly?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/entity-sales?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/fg-distribution?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/country-sales?year=${yearInt}`),
        fetch(`/api/dashboard/inbody-group/top-products?year=${yearInt}&limit=10`),
        fetch(`/api/dashboard/inbody-group/industry?year=${yearInt}`),
      ]);

      const [
        summary,
        monthly,
        quarterly,
        entitySalesData,
        fgData,
        countryData,
        topProductsData,
        industryData,
      ] = await Promise.all([
        summaryRes.json(),
        monthlyRes.json(),
        quarterlyRes.json(),
        entitySalesRes.json(),
        fgDistributionRes.json(),
        countrySalesRes.json(),
        topProductsRes.json(),
        industryRes.json(),
      ]);

      console.log(`✅ InBody Group dashboard data received (KRW):`, {
        current_amount_krw: summary?.current_year?.total_amount_krw,
        previous_amount_krw: summary?.previous_year?.total_amount_krw,
        monthly_count: monthly?.length,
        monthly_sample: monthly?.slice(0, 2),
        quarterly_count: quarterly?.length,
        entities_count: entitySalesData?.length,
      });
      
      // Transform data for KPI cards
      const currentAmount = summary?.current_year?.total_amount_krw || 0;
      const prevAmount = summary?.previous_year?.total_amount_krw || 0;
      const amountChange = prevAmount > 0
        ? ((currentAmount - prevAmount) / prevAmount) * 100
        : 0;
      
      setKpiData({
        totalAmount: currentAmount,
        totalQty: 0,
        avgAmount: 0,
        totalTransactions: summary?.current_year?.total_records || 0,
        prevTotalAmount: prevAmount,
        prevTotalQty: 0,
        comparison: {
          amount: amountChange,
          qty: 0,
        },
      });
      
      // Monthly trend data
      setMonthlyTrend(monthly?.map((item: any) => ({
        month: item.month,
        amount: item.amount,
        quantity: item.quantity,
        prevAmount: item.prev_amount,
        prevQuantity: item.prev_quantity,
      })) || []);
      
      // Quarterly data
      setQuarterlyComparison(quarterly?.map((item: any) => ({
        quarter: item.quarter, // SQL에서 이미 "Q1", "Q2" 형식으로 반환됨
        currentYear: item.current_amount || 0,
        previousYear: item.previous_amount || 0,
        currentQuantity: item.current_quantity || 0,
        previousQuantity: item.previous_quantity || 0,
      })) || []);
      
      // FG distribution
      setFGDistribution(fgData?.map((item: any) => ({
        fg_classification: item.fg_classification,
        amount: item.amount,
        quantity: item.quantity,
      })) || []);
      
      // Entity sales
      setEntitySales(entitySalesData?.map((item: any) => ({
        entity: item.entity,
        amount: item.amount,
        quantity: item.quantity,
      })) || []);
      
      // Country sales
      setCountrySales(countryData?.map((item: any) => ({
        country: item.country,
        amount: item.amount,
        quantity: item.quantity,
      })) || []);
      
      // Top products - API에서 이미 HQ 형식으로 반환됨 (byAmount, byQuantity, categories, allProducts)
      setTopProducts(topProductsData || { byAmount: [], byQuantity: [], categories: [], allProducts: [] });
      
      // Industry breakdown
      setIndustryBreakdown(industryData?.map((item: any) => ({
        industry: item.industry,
        amount: item.amount,
        quantity: item.quantity,
      })) || []);
      
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch InBody Group dashboard data:', error);
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
              Analyze sales performance across all entities (Amount in KRW)
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

          {/* Entity Sales Section - Full Width */}
          <div className="grid gap-6 md:grid-cols-1">
            <EntitySalesChart data={entitySales} loading={loading} />
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

          {/* FG Distribution */}
          <FGDistributionChart data={fgDistribution} loading={loading} />
          
          {/* Top Products Section */}
          <TopProductsChart data={topProducts} loading={loading} entity="All" />

          {/* Industry Analysis Section */}
          <IndustryBreakdownChart data={industryBreakdown} loading={loading} />

          {/* Data Table Section - Hidden */}
          {/* <SalesDataTable
            year={year}
            entities={entities}
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
