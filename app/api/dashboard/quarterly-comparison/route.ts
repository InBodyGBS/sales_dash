import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || [];

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const currentYear = parseInt(year);
    const previousYear = currentYear - 1;

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    
    // Get current year data - 모든 페이지 가져오기
    let allCurrentData: any[] = [];
    let currentPage = 0;
    let currentHasMore = true;

    try {
      while (currentHasMore) {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let currentQuery = supabase
          .from('sales_data')
          .select('quarter, line_amount_mst')
          .eq('year', currentYear)
          .not('quarter', 'is', null);

        if (entities.length > 0 && !entities.includes('All')) {
          currentQuery = currentQuery.in('entity', entities);
        }

        // range는 마지막에 적용
        currentQuery = currentQuery.range(from, to);

        const { data, error } = await currentQuery;
        
        if (error) {
          console.error('Current year query error (page ' + currentPage + '):', error);
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allCurrentData = allCurrentData.concat(data);
          currentPage++;
          currentHasMore = data.length === PAGE_SIZE;
        } else {
          currentHasMore = false;
        }
      }
    } catch (currentError) {
      console.error('Current year query error:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch current year data', details: (currentError as Error).message },
        { status: 500 }
      );
    }

    const currentData = allCurrentData;

    // Get previous year data - 모든 페이지 가져오기
    let allPrevData: any[] = [];
    let prevPage = 0;
    let prevHasMore = true;

    try {
      while (prevHasMore) {
        const from = prevPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let prevQuery = supabase
          .from('sales_data')
          .select('quarter, line_amount_mst')
          .eq('year', previousYear)
          .not('quarter', 'is', null);

        if (entities.length > 0 && !entities.includes('All')) {
          prevQuery = prevQuery.in('entity', entities);
        }

        // range는 마지막에 적용
        prevQuery = prevQuery.range(from, to);

        const { data, error } = await prevQuery;
        
        if (error) {
          console.error('Previous year query error (page ' + prevPage + '):', error);
          // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
          break;
        }

        if (data && data.length > 0) {
          allPrevData = allPrevData.concat(data);
          prevPage++;
          prevHasMore = data.length === PAGE_SIZE;
        } else {
          prevHasMore = false;
        }
      }
    } catch (prevError) {
      console.error('Previous year query error:', prevError);
      // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
    }

    const prevData = allPrevData;


    // Group by quarter for current year
    const currentQuarterMap = new Map<string, number>();
    (currentData || []).forEach((row) => {
      const quarter = row.quarter || 'Q1';
      const amount = Number(row.line_amount_mst || 0);
      currentQuarterMap.set(quarter, (currentQuarterMap.get(quarter) || 0) + (isNaN(amount) ? 0 : amount));
    });

    // Group by quarter for previous year
    const prevQuarterMap = new Map<string, number>();
    (prevData || []).forEach((row) => {
      const quarter = row.quarter || 'Q1';
      const amount = Number(row.line_amount_mst || 0);
      prevQuarterMap.set(quarter, (prevQuarterMap.get(quarter) || 0) + (isNaN(amount) ? 0 : amount));
    });

    // Build result
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const result = quarters.map((q) => ({
      quarter: q,
      currentYear: currentQuarterMap.get(q) || 0,
      previousYear: prevQuarterMap.get(q) || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Quarterly comparison API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quarterly comparison', details: (error as Error).message },
      { status: 500 }
    );
  }
}
