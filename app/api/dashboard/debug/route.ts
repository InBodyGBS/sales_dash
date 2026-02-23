import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity') || 'Oceania';
    const year = parseInt(searchParams.get('year') || '2024');

    const supabase = createServiceClient();

    // 1. sales_data 테이블에서 직접 데이터 확인
    const { data: salesData, error: salesError, count: salesCount } = await supabase
      .from('sales_data')
      .select('*', { count: 'exact', head: false })
      .eq('entity', entity)
      .eq('year', year)
      .limit(5);

    // 2. mv_sales_cube에서 데이터 확인
    const { data: cubeData, error: cubeError, count: cubeCount } = await supabase
      .from('mv_sales_cube')
      .select('*', { count: 'exact', head: false })
      .eq('entity', entity)
      .eq('year', year)
      .limit(5);

    // 3. 전체 연도 확인 (sales_data)
    const { data: yearsFromSales, error: yearsSalesError } = await supabase
      .from('sales_data')
      .select('year')
      .eq('entity', entity)
      .order('year', { ascending: false });

    const uniqueYearsFromSales = [...new Set((yearsFromSales || []).map((r: any) => r.year))];

    // 4. 전체 연도 확인 (mv_sales_cube)
    const { data: yearsFromCube, error: yearsCubeError } = await supabase
      .from('mv_sales_cube')
      .select('year')
      .eq('entity', entity)
      .order('year', { ascending: false });

    const uniqueYearsFromCube = [...new Set((yearsFromCube || []).map((r: any) => r.year))];

    // 5. RPC 함수 테스트
    let rpcTestResult = null;
    let rpcTestError = null;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('refresh_mv_sales_cube');
      rpcTestResult = rpcData;
      rpcTestError = rpcError;
    } catch (e) {
      rpcTestError = e;
    }

    // 6. get_distinct_years RPC 테스트
    let distinctYearsResult = null;
    let distinctYearsError = null;
    try {
      const { data: distinctYearsData, error: distinctYearsErr } = await supabase.rpc('get_distinct_years', {
        entity_name: entity
      });
      distinctYearsResult = distinctYearsData;
      distinctYearsError = distinctYearsErr;
    } catch (e) {
      distinctYearsError = e;
    }

    // 7. get_dashboard_summary RPC 테스트
    let summaryResult = null;
    let summaryError = null;
    try {
      const { data: summaryData, error: summaryErr } = await supabase.rpc('get_dashboard_summary', {
        p_year: year,
        p_entities: [entity],
        p_prev_year: year - 1
      });
      summaryResult = summaryData;
      summaryError = summaryErr;
    } catch (e) {
      summaryError = summaryErr;
    }

    // 8. 모든 연도에 대한 전체 통계
    const allYearsStats: any = {};
    for (const y of uniqueYearsFromSales) {
      const { count: yearCount } = await supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('entity', entity)
        .eq('year', y);
      
      const { count: cubeYearCount } = await supabase
        .from('mv_sales_cube')
        .select('*', { count: 'exact', head: true })
        .eq('entity', entity)
        .eq('year', y);
      
      allYearsStats[y] = {
        sales_data: yearCount || 0,
        mv_sales_cube: cubeYearCount || 0,
        needsRefresh: (yearCount || 0) > 0 && ((cubeYearCount || 0) < (yearCount || 0) * 0.5)
      };
    }

    return NextResponse.json({
      entity,
      year,
      diagnostics: {
        sales_data: {
          count: salesCount || 0,
          sample: salesData?.slice(0, 2) || [],
          error: salesError?.message || null,
          years: uniqueYearsFromSales,
        },
        mv_sales_cube: {
          count: cubeCount || 0,
          sample: cubeData?.slice(0, 2) || [],
          error: cubeError?.message || null,
          years: uniqueYearsFromCube,
        },
        all_years_stats: allYearsStats,
        rpc_functions: {
          refresh_mv_sales_cube: {
            exists: rpcTestError === null || !rpcTestError.message?.includes('does not exist'),
            result: rpcTestResult,
            error: rpcTestError?.message || null,
          },
          get_distinct_years: {
            result: distinctYearsResult,
            error: distinctYearsError?.message || null,
          },
          get_dashboard_summary: {
            result: summaryResult,
            error: summaryError?.message || null,
          },
        },
      },
      recommendations: {
        needsRefresh: (salesCount || 0) > 0 && ((cubeCount || 0) < (salesCount || 0) * 0.5), // 50% 이상 차이나면 갱신 필요
        message: (salesCount || 0) > 0 && (cubeCount || 0) === 0
          ? 'Data exists in sales_data but not in mv_sales_cube. Please refresh the materialized view.'
          : (salesCount || 0) > 0 && (cubeCount || 0) < (salesCount || 0) * 0.5
          ? `Data synchronization issue: sales_data has ${salesCount} records but mv_sales_cube only has ${cubeCount} records. Please refresh the materialized view.`
          : (salesCount || 0) === 0
          ? 'No data found in sales_data for this entity and year.'
          : 'Data appears to be synchronized.',
      },
    });
  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run diagnostics',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
