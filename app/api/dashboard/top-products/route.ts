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

    try {
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let query = supabase
          .from('sales_data')
          .select('product_name, product, line_amount_mst, quantity, fg_classification')
          .eq('year', yearInt)
          .eq('fg_classification', 'FG');

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          // If fg_classification doesn't exist, try without the filter
          if (error.code === '42703' || error.message?.includes('fg_classification') || error.message?.includes('does not exist')) {
            let retryQuery = supabase
              .from('sales_data')
              .select('product_name, product, line_amount_mst, quantity')
              .eq('year', yearInt);
            
            if (entities.length > 0 && !entities.includes('All')) {
              retryQuery = retryQuery.in('entity', entities);
            }

            // range는 마지막에 적용
            retryQuery = retryQuery.range(from, to);
            
            const { data: retryData, error: retryError } = await retryQuery;
            
            if (retryError) {
              console.error('Database error (page ' + page + '):', retryError);
              throw new Error(`Database query failed: ${retryError.message}`);
            }
            
            if (retryData && retryData.length > 0) {
              allData = allData.concat(retryData);
              page++;
              hasMore = retryData.length === PAGE_SIZE;
            } else {
              hasMore = false;
            }
            continue;
          }
          console.error('Database error (page ' + page + '):', error);
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
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

    data.forEach((row) => {
      const product = row.product || row.product_name || 'Unknown';
      const amount = Number(row.line_amount_mst || 0);
      const qty = Number(row.quantity || 0);

      if (!productMap.has(product)) {
        productMap.set(product, { amount: 0, qty: 0 });
      }

      const productData = productMap.get(product)!;
      productData.amount += isNaN(amount) ? 0 : amount;
      productData.qty += isNaN(qty) ? 0 : qty;
    });

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
