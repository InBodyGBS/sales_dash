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
    const yearInt = parseInt(year);
    
    const isEurope = entities.includes('Europe');
    console.log(`📊 Industry Breakdown API - Request params:`, { year, yearInt, entities, isEurope });
    
    if (isNaN(yearInt)) {
      console.error(`❌ Industry Breakdown API - Invalid year parameter: "${year}"`);
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
    }

    // Europe 특별 처리: sales_data_europe View 사용
    if (isEurope) {
      console.log('🌍 Europe entity detected - querying sales_data_europe view for industry breakdown');
      try {
        const { data: europeData, error: europeError } = await supabase
          .from('sales_data_europe')
          .select('industry, line_amount_mst')
          .eq('year', yearInt)
          .not('line_amount_mst', 'is', null);

        if (europeError) {
          console.error('❌ Europe industry breakdown error:', europeError);
          return NextResponse.json([]);
        }

        const industryMap = new Map<string, { amount: number; transactions: number }>();
        (europeData || []).forEach((r: any) => {
          const industry = r.industry || 'Unknown';
          const existing = industryMap.get(industry) || { amount: 0, transactions: 0 };
          existing.amount += Number(r.line_amount_mst) || 0;
          existing.transactions += 1;
          industryMap.set(industry, existing);
        });

        const result = Array.from(industryMap.entries())
          .map(([industry, d]) => ({ industry, amount: d.amount, transactions: d.transactions }))
          .sort((a, b) => b.amount - a.amount);

        console.log(`✅ Europe industry breakdown fetched: ${result.length} industries`);
        return NextResponse.json(result);
      } catch (europeErr) {
        console.error('Europe industry breakdown exception:', europeErr);
        return NextResponse.json([]);
      }
    }

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      // Count query 최적화: id만 선택하여 타임아웃 방지
      let countQuery = supabase
        .from('mv_sales_cube')
        .select('id', { count: 'exact', head: true })
        .eq('year', yearInt)
        .not('line_amount_mst', 'is', null);

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
        console.warn('⚠️ Industry Breakdown API - Count query timeout or error, proceeding without count:', err);
        return { count: null, error: null }; // Count 없이 진행
      }) as any;
      
      if (countError) {
        console.error('❌ Industry Breakdown API - Count query error:', {
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
      console.log(`📊 Industry Breakdown - Total records to fetch: ${totalCount || 'unknown'} (year: ${yearInt}, entities: ${entities.join(',')})`);

      // Count가 없으면 최대 100페이지로 제한
      let maxPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 100;
      
      while (hasMore && page < maxPages) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('mv_sales_cube')
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
          console.error('❌ Industry Breakdown API - Database error (page ' + page + '):', {
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
    console.error('❌ Industry Breakdown API - Unexpected error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    return NextResponse.json(
      { error: 'Failed to fetch industry breakdown', details: (error as Error).message },
      { status: 500 }
    );
  }
}
