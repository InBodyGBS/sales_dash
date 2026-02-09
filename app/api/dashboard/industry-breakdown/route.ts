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
        .eq('year', yearInt)
        .not('line_amount_mst', 'is', null);

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      const { count: initialCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Count query error:', countError);
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Industry Breakdown - Total records to fetch: ${totalCount} (year: ${yearInt}, entities: ${entities.join(',')})`);

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('sales_data')
          .select('industry, line_amount_mst', { count: 'exact', head: false })
          .eq('year', yearInt)
          .not('line_amount_mst', 'is', null)
          .order('id', { ascending: true }); // 정렬 추가

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          console.error('Database error (page ' + page + '):', error);
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Industry Breakdown - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지
        if (page > 1000) {
          console.warn(`⚠️ Industry Breakdown - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
      if (allData.length < totalCount) {
        console.warn(`⚠️ Industry Breakdown - Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch industry breakdown', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by industry
    const industryMap = new Map<string, { amount: number; transactions: number }>();
    let zeroAmountCount = 0;

    data.forEach((row) => {
      const industry = row.industry || 'Unknown';
      
      // line_amount_mst는 이미 null이 아닌 것만 가져왔지만, 0인 경우도 추적
      const amount = Number(row.line_amount_mst || 0);
      
      if (isNaN(amount)) {
        console.warn('Invalid line_amount_mst:', row.line_amount_mst);
      } else {
        if (!industryMap.has(industry)) {
          industryMap.set(industry, { amount: 0, transactions: 0 });
        }

        const industryData = industryMap.get(industry)!;
        industryData.amount += amount;
        industryData.transactions += 1;
        
        if (amount === 0) zeroAmountCount++;
      }
    });
    
    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Industry Breakdown - 엔티티 집계 결과 (entities: ${entityList}):`, {
        totalRecords: data.length,
        zeroAmountCount,
        totalIndustries: industryMap.size,
        topIndustries: Array.from(industryMap.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 10)
          .map(([industry, data]) => ({
            industry,
            amount: data.amount,
            amountFormatted: data.amount.toLocaleString(),
            transactions: data.transactions
          }))
      });
    }

    const result = Array.from(industryMap.entries())
      .map(([industry, data]) => ({
        industry,
        amount: data.amount,
        transactions: data.transactions,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Industry breakdown API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch industry breakdown', details: (error as Error).message },
      { status: 500 }
    );
  }
}
