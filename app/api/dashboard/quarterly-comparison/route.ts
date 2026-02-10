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

    const supabase = createServiceClient();
    const currentYear = parseInt(year);
    const previousYear = currentYear - 1;
    
    // 디버깅: 받은 year 파라미터 확인
    console.log(`📊 Quarterly Comparison API - Received year parameter: "${year}", parsed as: ${currentYear}, entities: ${entities.join(',')}`);

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 5000; // 페이지 크기 증가로 속도 개선
    
    // Get current year data - 모든 페이지 가져오기
    let allCurrentData: any[] = [];
    let currentPage = 0;
    let currentHasMore = true;
    let currentTotalCount = 0;

    try {
      // 먼저 전체 개수를 확인
      let currentCountQuery = supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('year', currentYear)
        .not('quarter', 'is', null);

      if (entities.length > 0 && !entities.includes('All')) {
        currentCountQuery = currentCountQuery.in('entity', entities);
      }

      const { count: currentInitialCount, error: currentCountError } = await currentCountQuery;
      
      if (currentCountError) {
        console.error('Current year count query error:', currentCountError);
        throw new Error(`Failed to get total count for current year: ${currentCountError.message}`);
      }

      currentTotalCount = currentInitialCount || 0;
      console.log(`📊 Quarterly Comparison - Total records to fetch for current year ${currentYear}: ${currentTotalCount} (entities: ${entities.join(',')})`);

      while (currentHasMore) {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let currentQuery = supabase
          .from('sales_data')
          .select('quarter, line_amount_mst', { count: 'exact', head: false })
          .eq('year', currentYear)
          .not('quarter', 'is', null)
          .order('id', { ascending: true }); // 정렬 추가

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
          
          // 더 가져올 데이터가 있는지 확인 (data.length가 PAGE_SIZE와 같으면 더 있음)
          currentHasMore = data.length === PAGE_SIZE;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인 (추가 안전장치)
          if (allCurrentData.length >= currentTotalCount) {
            currentHasMore = false;
            console.log(`✅ Quarterly Comparison - All current year data fetched: ${allCurrentData.length} records (expected: ${currentTotalCount})`);
          }
        } else {
          currentHasMore = false;
        }
        
        // 안전장치: 무한 루프 방지 (최대 10000페이지 = 10,000,000 레코드)
        if (currentPage > 10000) {
          console.warn(`⚠️ Quarterly Comparison - Maximum page limit reached for current year (10000 pages). Fetched ${allCurrentData.length} records out of ${currentTotalCount}`);
          currentHasMore = false;
        }
      }
      
      // 최종 확인
      if (allCurrentData.length < currentTotalCount) {
        console.warn(`⚠️ Quarterly Comparison - Warning: Fetched ${allCurrentData.length} current year records but expected ${currentTotalCount}. Missing ${currentTotalCount - allCurrentData.length} records.`);
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
    let prevTotalCount = 0;

    try {
      // 먼저 이전 연도 전체 개수를 확인
      let prevCountQuery = supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('year', previousYear)
        .not('quarter', 'is', null);

      if (entities.length > 0 && !entities.includes('All')) {
        prevCountQuery = prevCountQuery.in('entity', entities);
      }

      const { count: prevInitialCount, error: prevCountError } = await prevCountQuery;
      
      if (prevCountError) {
        console.error('Previous year count query error:', prevCountError);
        // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
        prevTotalCount = 0;
      } else {
        prevTotalCount = prevInitialCount || 0;
        console.log(`📊 Quarterly Comparison - Total records to fetch for previous year ${previousYear}: ${prevTotalCount} (entities: ${entities.join(',')})`);
      }

      while (prevHasMore && prevTotalCount > 0) {
        const from = prevPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let prevQuery = supabase
          .from('sales_data')
          .select('quarter, line_amount_mst', { count: 'exact', head: false })
          .eq('year', previousYear)
          .not('quarter', 'is', null)
          .order('id', { ascending: true }); // 정렬 추가

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
          
          // 더 가져올 데이터가 있는지 확인 (data.length가 PAGE_SIZE와 같으면 더 있음)
          prevHasMore = data.length === PAGE_SIZE;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인 (추가 안전장치)
          if (allPrevData.length >= prevTotalCount) {
            prevHasMore = false;
            console.log(`✅ Quarterly Comparison - All previous year data fetched: ${allPrevData.length} records (expected: ${prevTotalCount})`);
          }
        } else {
          prevHasMore = false;
        }
        
        // 안전장치: 무한 루프 방지 (최대 10000페이지 = 10,000,000 레코드)
        if (prevPage > 10000) {
          console.warn(`⚠️ Quarterly Comparison - Maximum page limit reached for previous year (10000 pages). Fetched ${allPrevData.length} records out of ${prevTotalCount}`);
          prevHasMore = false;
        }
      }
      
      // 최종 확인
      if (prevTotalCount > 0 && allPrevData.length < prevTotalCount) {
        console.warn(`⚠️ Quarterly Comparison - Warning: Fetched ${allPrevData.length} previous year records but expected ${prevTotalCount}. Missing ${prevTotalCount - allPrevData.length} records.`);
      }
    } catch (prevError) {
      console.error('Previous year query error:', prevError);
      // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
    }

    const prevData = allPrevData;


    // Group by quarter for current year
    const currentQuarterMap = new Map<string, number>();
    let currentNullCount = 0;
    let currentZeroCount = 0;
    
    (currentData || []).forEach((row) => {
      const quarter = row.quarter || 'Q1';
      
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        currentNullCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst (current year):', row.line_amount_mst);
        } else {
          currentQuarterMap.set(quarter, (currentQuarterMap.get(quarter) || 0) + amount);
          if (amount === 0) currentZeroCount++;
        }
      }
    });

    // Group by quarter for previous year
    const prevQuarterMap = new Map<string, number>();
    let prevNullCount = 0;
    let prevZeroCount = 0;
    
    (prevData || []).forEach((row) => {
      const quarter = row.quarter || 'Q1';
      
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        prevNullCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst (previous year):', row.line_amount_mst);
        } else {
          prevQuarterMap.set(quarter, (prevQuarterMap.get(quarter) || 0) + amount);
          if (amount === 0) prevZeroCount++;
        }
      }
    });

    // Build result
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const result = quarters.map((q) => ({
      quarter: q,
      currentYear: currentQuarterMap.get(q) || 0,
      previousYear: prevQuarterMap.get(q) || 0,
    }));

    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Quarterly Comparison - 엔티티 최종 결과 (year: ${currentYear}, entities: ${entityList}):`, {
        quarterlyBreakdown: result.map(r => ({
          quarter: r.quarter,
          currentYear: r.currentYear,
          currentYearFormatted: r.currentYear.toLocaleString(),
          previousYear: r.previousYear,
          previousYearFormatted: r.previousYear.toLocaleString()
        })),
        currentYearTotal: result.reduce((sum, r) => sum + r.currentYear, 0),
        previousYearTotal: result.reduce((sum, r) => sum + r.previousYear, 0),
        currentNullCount,
        currentZeroCount,
        prevNullCount,
        prevZeroCount,
        note: `SQL 쿼리 결과와 비교해주세요: SELECT SUM(line_amount_mst) FROM sales_data WHERE entity IN (${entities.map(e => `'${e}'`).join(', ')}) AND year = ${currentYear} AND quarter = '[Q]'`
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Quarterly comparison API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quarterly comparison', details: (error as Error).message },
      { status: 500 }
    );
  }
}
