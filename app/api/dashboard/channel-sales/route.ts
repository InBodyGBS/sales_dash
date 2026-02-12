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

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    
    console.log(`📊 Channel Sales API - Request params:`, { year, yearInt, limit, entities });
    
    if (isNaN(yearInt)) {
      console.error(`❌ Channel Sales API - Invalid year parameter: "${year}"`);
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
    }

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      // Count query 최적화: 필요한 컬럼만 선택하고 타임아웃 방지
      // head: true를 사용하여 데이터를 가져오지 않고 count만 가져옴
      let countQuery = supabase
        .from('mv_sales_cube')
        .select('id', { count: 'exact', head: true })
        .eq('year', yearInt)
        .not('channel', 'is', null); // Channel이 NULL이 아닌 데이터만

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      // 타임아웃 방지를 위해 5초 제한
      const countPromise = countQuery;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Count query timeout')), 5000)
      );

      const { count: initialCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]).catch((err) => {
        console.warn('⚠️ Channel Sales API - Count query timeout or error, proceeding without count:', err);
        return { count: null, error: null }; // Count 없이 진행
      }) as any;
      
      if (countError) {
        // If column doesn't exist, return empty array instead of error
        if (countError.code === '42703' || countError.message?.includes('column') || countError.message?.includes('does not exist')) {
          return NextResponse.json([]);
        }
        console.error('❌ Channel Sales API - Count query error:', {
          code: countError.code,
          message: countError.message,
          details: countError.details,
          hint: countError.hint,
          year: yearInt,
          entities
        });
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Channel Sales - Total records to fetch: ${totalCount || 'unknown'} (year: ${yearInt}, entities: ${entities.join(',')})`);

      // Count가 없으면 데이터를 가져오면서 카운트 추정
      let estimatedCount = totalCount;
      let maxPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 100; // 최대 100페이지로 제한
      
      while (hasMore && page < maxPages) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('mv_sales_cube')
          .select('channel, line_amount_mst', { count: 'exact', head: false })
          .eq('year', yearInt)
          .not('channel', 'is', null) // Channel이 NULL이 아닌 데이터만
          .order('id', { ascending: true }); // 정렬 추가

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          // If column doesn't exist, return empty array instead of error
          if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
            return NextResponse.json([]);
          }
          console.error('❌ Channel Sales API - Database error (page ' + page + '):', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            year: yearInt,
            entities,
            page
          });
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Channel Sales - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지
        if (page > 1000) {
          console.warn(`⚠️ Channel Sales - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
      if (allData.length < totalCount) {
        console.warn(`⚠️ Channel Sales - Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch channel sales', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by channel
    const channelMap = new Map<string, number>();
    let nullCount = 0;
    let zeroCount = 0;

    data.forEach((row: any) => {
      const channel = row.channel || 'Unknown';
      
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          channelMap.set(channel, (channelMap.get(channel) || 0) + amount);
          if (amount === 0) zeroCount++;
        }
      }
    });
    
    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Channel Sales - 엔티티 집계 결과 (entities: ${entityList}):`, {
        totalRecords: data.length,
        nullCount,
        zeroCount,
        channels: Array.from(channelMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([channel, amount]) => ({
            channel,
            amount,
            amountFormatted: amount.toLocaleString()
          }))
      });
    }

    const result = Array.from(channelMap.entries())
      .map(([channel, amount]) => ({
        channel,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Channel Sales API - Unexpected error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    return NextResponse.json(
      { error: 'Failed to fetch channel sales', details: (error as Error).message },
      { status: 500 }
    );
  }
}
