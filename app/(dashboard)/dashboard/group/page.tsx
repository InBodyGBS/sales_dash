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

const ENTITIES: Entity[] = ['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot'];

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
      // 모든 Entity를 포함하여 데이터 가져오기
      const entitiesParam = entities.length > 0 ? entities.join(',') : 'All';
      
      const [
        kpiRes,
        monthlyRes,
        quarterlyRes,
        fgRes,
        entityRes,
        countryRes,
        productsRes,
        industryRes,
      ] = await Promise.all([
        fetch(`/api/dashboard/summary?year=${year}&entities=${entitiesParam}`),
        fetch(`/api/dashboard/monthly-trend?year=${year}&entities=${entitiesParam}`),
        fetch(`/api/dashboard/quarterly-comparison?year=${year}&entities=${entitiesParam}`),
        fetch(`/api/dashboard/fg-distribution?year=${year}&entities=${entitiesParam}`),
        fetch(`/api/dashboard/entity-sales?year=${year}`),
        fetch(`/api/dashboard/country-sales?year=${year}&limit=10&entities=${entitiesParam}`),
        fetch(`/api/dashboard/top-products?year=${year}&limit=10&entities=${entitiesParam}`),
        fetch(`/api/dashboard/industry-breakdown?year=${year}&entities=${entitiesParam}`),
      ]);

      if (!kpiRes.ok) throw new Error('Failed to fetch KPI data');
      if (!monthlyRes.ok) throw new Error('Failed to fetch monthly trend');
      if (!quarterlyRes.ok) throw new Error('Failed to fetch quarterly comparison');
      if (!fgRes.ok) throw new Error('Failed to fetch FG distribution');
      if (!entityRes.ok) throw new Error('Failed to fetch entity sales');
      if (!countryRes.ok) throw new Error('Failed to fetch country sales');
      if (!productsRes.ok) throw new Error('Failed to fetch top products');
      if (!industryRes.ok) throw new Error('Failed to fetch industry breakdown');

      setKpiData(await kpiRes.json());
      setMonthlyTrend(await monthlyRes.json());
      setQuarterlyComparison(await quarterlyRes.json());
      setFGDistribution(await fgRes.json());
      setEntitySales(await entityRes.json());
      setCountrySales(await countryRes.json());
      setTopProducts(await productsRes.json());
      setIndustryBreakdown(await industryRes.json());
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Failed to fetch data:', error);
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
            <MonthlyTrendChart data={monthlyTrend} loading={loading} entity="All" />
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
