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

    try {
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let query = supabase
          .from('sales_data')
          .select('invoice_date, line_amount_mst, quantity')
          .eq('year', yearInt)
          .range(from, to);

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        const { data, error } = await query;
        
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

    // Group by month
    const monthMap = new Map<number, { amount: number; qty: number }>();

    data.forEach((row) => {
      const invoiceDate = row.invoice_date;
      if (!invoiceDate) return;

      const date = new Date(invoiceDate);
      const month = date.getMonth() + 1; // 1-12

      if (!monthMap.has(month)) {
        monthMap.set(month, { amount: 0, qty: 0 });
      }

      const monthData = monthMap.get(month)!;
      const amount = parseFloat(row.line_amount_mst || 0);
      const qty = parseFloat(row.quantity || 0);
      
      monthData.amount += isNaN(amount) ? 0 : amount;
      monthData.qty += isNaN(qty) ? 0 : qty;
    });

    // Convert to array and fill missing months with 0
    const result = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const data = monthMap.get(month) || { amount: 0, qty: 0 };
      return {
        month,
        amount: data.amount,
        qty: data.qty,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Monthly trend API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly trend', details: (error as Error).message },
      { status: 500 }
    );
  }
}
