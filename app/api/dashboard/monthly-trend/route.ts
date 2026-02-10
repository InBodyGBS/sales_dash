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
    const prevYear = yearInt - 1;
    
    // 디버깅: 받은 year 파라미터 확인
    console.log(`📊 Monthly Trend API - Received year parameter: "${year}", parsed as: ${yearInt}, entities: ${entities.join(',')}`);

    // 현재 연도 데이터 가져오기
    const fetchYearData = async (year: number) => {
      // Supabase PostgREST의 기본 max-rows 제한이 1000이므로 PAGE_SIZE를 1000으로 설정
    const PAGE_SIZE = 1000; // 페이지 크기 증가로 속도 개선
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;
      let totalCount = 0;

      // 먼저 전체 개수를 확인
      let countQuery = supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('year', year)
        .not('invoice_date', 'is', null);

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      const { count: initialCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error(`Count query error (year ${year}):`, countError);
        throw new Error(`Failed to get total count for year ${year}: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Monthly Trend - Total records to fetch for year ${year}: ${totalCount} (entities: ${entities.join(',')})`);

      // 모든 데이터를 가져올 때까지 반복
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        // entity, year, invoice_date를 모두 가져와서 정확한 집계
        let query = supabase
          .from('sales_data')
          .select('entity, year, invoice_date, line_amount_mst, quantity', { count: 'exact', head: false })
          .eq('year', year)
          .not('invoice_date', 'is', null)
          .order('id', { ascending: true }); // 정렬 추가

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          console.error(`Database error (year ${year}, page ${page}):`, error);
          throw new Error(`Database query failed for year ${year}: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          // 더 가져올 데이터가 있는지 확인 (data.length가 PAGE_SIZE와 같으면 더 있음)
          hasMore = data.length === PAGE_SIZE;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인 (추가 안전장치)
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Monthly Trend - All data fetched for year ${year}: ${allData.length} records (expected: ${totalCount})`);
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지 (최대 10000페이지 = 10,000,000 레코드)
        if (page > 10000) {
          console.warn(`⚠️ Monthly Trend - Maximum page limit reached for year ${year} (10000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
      if (allData.length < totalCount) {
        console.warn(`⚠️ Monthly Trend - Warning: Fetched ${allData.length} records for year ${year} but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }

      return allData;
    };

    // 현재 연도와 이전 연도 데이터 가져오기
    let currentData: any[] = [];
    let prevData: any[] = [];

    try {
      currentData = await fetchYearData(yearInt);
    } catch (queryError) {
      console.error('Query error (current year):', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch current year data', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    try {
      prevData = await fetchYearData(prevYear);
    } catch (queryError) {
      console.warn('Query error (previous year, might be empty):', queryError);
      // 이전 연도 데이터는 필수가 아니므로 빈 배열로 처리
      prevData = [];
    }

    // Group by month for current year
    const currentMonthMap = new Map<number, { amount: number; qty: number; count: number }>();
    let nullAmountCount = 0;
    let zeroAmountCount = 0;
    
    currentData.forEach((row) => {
      const invoiceDate = row.invoice_date;
      if (!invoiceDate) return;

      const date = new Date(invoiceDate);
      const month = date.getMonth() + 1; // 1-12

      if (!currentMonthMap.has(month)) {
        currentMonthMap.set(month, { amount: 0, qty: 0, count: 0 });
      }

      const monthData = currentMonthMap.get(month)!;
      
      // line_amount_mst 처리
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullAmountCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          monthData.amount += amount;
          monthData.count++;
          if (amount === 0) zeroAmountCount++;
        }
      }
      
      // quantity 처리
      if (row.quantity !== null && row.quantity !== undefined) {
        const qty = Number(row.quantity);
        if (!isNaN(qty)) {
          monthData.qty += qty;
        }
      }
    });
    
    // 디버깅: 월별 집계 결과 확인
    console.log(`📊 Monthly Trend - Current year (${yearInt}) aggregation:`, {
      totalRecords: currentData.length,
      nullAmountCount,
      zeroAmountCount,
      monthlyBreakdown: Array.from(currentMonthMap.entries()).map(([month, data]) => ({
        month,
        amount: data.amount,
        amountFormatted: data.amount.toLocaleString(),
        count: data.count
      }))
    });

    // Group by month for previous year
    const prevMonthMap = new Map<number, { amount: number; qty: number; count: number }>();
    let prevNullAmountCount = 0;
    let prevZeroAmountCount = 0;
    
    prevData.forEach((row) => {
      const invoiceDate = row.invoice_date;
      if (!invoiceDate) return;

      const date = new Date(invoiceDate);
      const month = date.getMonth() + 1; // 1-12

      if (!prevMonthMap.has(month)) {
        prevMonthMap.set(month, { amount: 0, qty: 0, count: 0 });
      }

      const monthData = prevMonthMap.get(month)!;
      
      // line_amount_mst 처리
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        prevNullAmountCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst (prev year):', row.line_amount_mst);
        } else {
          monthData.amount += amount;
          monthData.count++;
          if (amount === 0) prevZeroAmountCount++;
        }
      }
      
      // quantity 처리
      if (row.quantity !== null && row.quantity !== undefined) {
        const qty = Number(row.quantity);
        if (!isNaN(qty)) {
          monthData.qty += qty;
        }
      }
    });
    
    // 디버깅: 이전 연도 월별 집계 결과 확인
    if (prevData.length > 0) {
      console.log(`📊 Monthly Trend - Previous year (${prevYear}) aggregation:`, {
        totalRecords: prevData.length,
        nullAmountCount: prevNullAmountCount,
        zeroAmountCount: prevZeroAmountCount,
        monthlyBreakdown: Array.from(prevMonthMap.entries()).map(([month, data]) => ({
          month,
          amount: data.amount,
          amountFormatted: data.amount.toLocaleString(),
          count: data.count
        }))
      });
    }

    // Convert to array and fill missing months with 0
    const result = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const current = currentMonthMap.get(month) || { amount: 0, qty: 0, count: 0 };
      const previous = prevMonthMap.get(month) || { amount: 0, qty: 0, count: 0 };
      return {
        month,
        amount: current.amount,
        qty: current.qty,
        prevAmount: previous.amount,
        prevQty: previous.qty,
      };
    });

    // 디버깅: 최종 결과 확인 (모든 엔티티에 적용)
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Monthly Trend - 엔티티 최종 결과 (year: ${yearInt}, entities: ${entityList}):`, {
        monthlyAmounts: result.map(r => ({
          month: r.month,
          amount: r.amount,
          amountFormatted: r.amount.toLocaleString(),
          prevAmount: r.prevAmount,
          prevAmountFormatted: r.prevAmount.toLocaleString()
        })),
        totalAmount: result.reduce((sum, r) => sum + r.amount, 0),
        totalAmountFormatted: result.reduce((sum, r) => sum + r.amount, 0).toLocaleString(),
        note: `SQL 쿼리 결과와 비교해주세요: SELECT SUM(line_amount_mst) FROM sales_data WHERE entity IN (${entities.map(e => `'${e}'`).join(', ')}) AND year = ${yearInt} AND EXTRACT(MONTH FROM invoice_date) = [month]`
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Monthly trend API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly trend', details: (error as Error).message },
      { status: 500 }
    );
  }
}
