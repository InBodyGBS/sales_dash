import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

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
        
        const { data, error } = await supabase
          .from('sales_data')
          .select('entity, line_amount_mst, quantity')
          .eq('year', yearInt)
          .range(from, to);
        
        if (error) {
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
        { error: 'Failed to fetch sales data', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by entity
    const entityMap = new Map<string, { amount: number; qty: number }>();

    data.forEach((row) => {
      const entity = row.entity;
      if (!entityMap.has(entity)) {
        entityMap.set(entity, { amount: 0, qty: 0 });
      }

      const entityData = entityMap.get(entity)!;
      const amount = parseFloat(row.line_amount_mst || 0);
      const qty = parseFloat(row.quantity || 0);
      
      entityData.amount += isNaN(amount) ? 0 : amount;
      entityData.qty += isNaN(qty) ? 0 : qty;
    });

    const result = Array.from(entityMap.entries())
      .map(([entity, data]) => ({
        entity,
        amount: data.amount,
        qty: data.qty,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Entity sales API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity sales', details: (error as Error).message },
      { status: 500 }
    );
  }
}
