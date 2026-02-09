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
    let useFGFilter = true;

    try {
      // 먼저 fg_classification 컬럼 존재 여부 확인
      const { error: columnCheckError } = await supabase
        .from('sales_data')
        .select('fg_classification')
        .limit(1);

      if (columnCheckError) {
        if (columnCheckError.code === '42703' || columnCheckError.message?.includes('fg_classification') || columnCheckError.message?.includes('does not exist')) {
          useFGFilter = false;
          console.log('⚠️ Top Products - fg_classification column not found, filtering without FG filter');
        }
      }

      // 전체 개수를 확인
      let countQuery = supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('year', yearInt);

      if (useFGFilter) {
        countQuery = countQuery.eq('fg_classification', 'FG');
      }

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      const { count: initialCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Count query error:', countError);
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Top Products - Total records to fetch: ${totalCount} (year: ${yearInt}, entities: ${entities.join(',')}, useFGFilter: ${useFGFilter})`);

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('sales_data')
          .select('product_name, product, line_amount_mst, quantity, fg_classification', { count: 'exact', head: false })
          .eq('year', yearInt)
          .order('id', { ascending: true }); // 정렬 추가

        if (useFGFilter) {
          query = query.eq('fg_classification', 'FG');
        }

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          // If fg_classification doesn't exist, try without the filter
          if (error.code === '42703' || error.message?.includes('fg_classification') || error.message?.includes('does not exist')) {
            useFGFilter = false;
            // 재시도 (이미 useFGFilter가 false이므로 다음 루프에서 다시 시도)
            continue;
          }
          console.error('Database error (page ' + page + '):', error);
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Top Products - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지
        if (page > 1000) {
          console.warn(`⚠️ Top Products - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
      if (allData.length < totalCount) {
        console.warn(`⚠️ Top Products - Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch top products', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by product
    const productMap = new Map<string, { amount: number; qty: number }>();
    let nullAmountCount = 0;
    let zeroAmountCount = 0;

    data.forEach((row) => {
      const product = row.product || row.product_name || 'Unknown';
      
      // line_amount_mst 처리
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullAmountCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          if (!productMap.has(product)) {
            productMap.set(product, { amount: 0, qty: 0 });
          }
          const productData = productMap.get(product)!;
          productData.amount += amount;
          if (amount === 0) zeroAmountCount++;
        }
      }
      
      // quantity 처리
      if (row.quantity !== null && row.quantity !== undefined) {
        const qty = Number(row.quantity);
        if (!isNaN(qty)) {
          if (!productMap.has(product)) {
            productMap.set(product, { amount: 0, qty: 0 });
          }
          const productData = productMap.get(product)!;
          productData.qty += qty;
        }
      }
    });
    
    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Top Products - 엔티티 집계 결과 (entities: ${entityList}):`, {
        totalRecords: data.length,
        nullAmountCount,
        zeroAmountCount,
        totalProducts: productMap.size,
        useFGFilter,
        topProductsByAmount: Array.from(productMap.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 10)
          .map(([product, data]) => ({
            product,
            amount: data.amount,
            amountFormatted: data.amount.toLocaleString(),
            qty: data.qty
          }))
      });
    }

    const allProducts = Array.from(productMap.entries())
      .map(([product, data]) => ({
        product,
        amount: data.amount,
        qty: data.qty,
      }));

    // Return both sorted by amount and by quantity
    const result = {
      byAmount: [...allProducts].sort((a, b) => b.amount - a.amount).slice(0, limit),
      byQuantity: [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, limit),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Top products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
