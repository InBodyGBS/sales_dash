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
    const prevYear = yearInt - 1;

    // 현재 연도 데이터 가져오기
    const fetchYearData = async (year: number) => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let query = supabase
          .from('sales_data')
          .select('invoice_date, line_amount_mst, quantity')
          .eq('year', year)
          .not('invoice_date', 'is', null);

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
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
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
    const currentMonthMap = new Map<number, { amount: number; qty: number }>();
    currentData.forEach((row) => {
      const invoiceDate = row.invoice_date;
      if (!invoiceDate) return;

      const date = new Date(invoiceDate);
      const month = date.getMonth() + 1; // 1-12

      if (!currentMonthMap.has(month)) {
        currentMonthMap.set(month, { amount: 0, qty: 0 });
      }

      const monthData = currentMonthMap.get(month)!;
      const amount = Number(row.line_amount_mst || 0);
      const qty = Number(row.quantity || 0);
      
      monthData.amount += isNaN(amount) ? 0 : amount;
      monthData.qty += isNaN(qty) ? 0 : qty;
    });

    // Group by month for previous year
    const prevMonthMap = new Map<number, { amount: number; qty: number }>();
    prevData.forEach((row) => {
      const invoiceDate = row.invoice_date;
      if (!invoiceDate) return;

      const date = new Date(invoiceDate);
      const month = date.getMonth() + 1; // 1-12

      if (!prevMonthMap.has(month)) {
        prevMonthMap.set(month, { amount: 0, qty: 0 });
      }

      const monthData = prevMonthMap.get(month)!;
      const amount = Number(row.line_amount_mst || 0);
      const qty = Number(row.quantity || 0);
      
      monthData.amount += isNaN(amount) ? 0 : amount;
      monthData.qty += isNaN(qty) ? 0 : qty;
    });

    // Convert to array and fill missing months with 0
    const result = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const current = currentMonthMap.get(month) || { amount: 0, qty: 0 };
      const previous = prevMonthMap.get(month) || { amount: 0, qty: 0 };
      return {
        month,
        amount: current.amount,
        qty: current.qty,
        prevAmount: previous.amount,
        prevQty: previous.qty,
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
