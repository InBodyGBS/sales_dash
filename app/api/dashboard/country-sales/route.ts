import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '10');
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || [];

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const yearInt = parseInt(year);

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      // 먼저 전체 개수를 확인
      let countQuery = supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('year', yearInt);

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      const { count: initialCount, error: countError } = await countQuery;
      
      if (countError) {
        // If column doesn't exist, return empty array instead of error
        if (countError.code === '42703' || countError.message?.includes('column') || countError.message?.includes('does not exist')) {
          return NextResponse.json([]);
        }
        console.error('Count query error:', countError);
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Country Sales - Total records to fetch: ${totalCount} (year: ${yearInt}, entities: ${entities.join(',')})`);

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('sales_data')
          .select('country, state, city, entity, line_amount_mst', { count: 'exact', head: false })
          .eq('year', yearInt)
          .order('id', { ascending: true }); // 정렬 추가

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          console.error('Database error (page ' + page + '):', error);
          // If column doesn't exist, return empty array instead of error
          if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
            return NextResponse.json([]);
          }
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Country Sales - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지
        if (page > 1000) {
          console.warn(`⚠️ Country Sales - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
      if (allData.length < totalCount) {
        console.warn(`⚠️ Country Sales - Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch country sales', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by country (use country, state, city, or entity as fallback)
    const countryMap = new Map<string, number>();
    let nullCount = 0;
    let zeroCount = 0;

    data.forEach((row: any) => {
      // Use country if available, otherwise fallback to state, city, or entity
      const country = row.country || row.state || row.city || row.entity || 'Unknown';
      
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          countryMap.set(country, (countryMap.get(country) || 0) + amount);
          if (amount === 0) zeroCount++;
        }
      }
    });
    
    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Country Sales - 엔티티 집계 결과 (entities: ${entityList}):`, {
        totalRecords: data.length,
        nullCount,
        zeroCount,
        topCountries: Array.from(countryMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([country, amount]) => ({
            country,
            amount,
            amountFormatted: amount.toLocaleString()
          }))
      });
    }

    const result = Array.from(countryMap.entries())
      .map(([country, amount]) => ({
        country,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Country sales API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch country sales', details: (error as Error).message },
      { status: 500 }
    );
  }
}
