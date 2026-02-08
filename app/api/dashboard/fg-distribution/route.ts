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
          .select('fg_classification, line_amount_mst')
          .eq('year', yearInt);

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          // If fg_classification doesn't exist, return empty or default data
          if (error.code === '42703') {
            return NextResponse.json([
              { fg: 'FG', amount: 0, percentage: 0 },
              { fg: 'NonFG', amount: 0, percentage: 0 },
            ]);
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
        { error: 'Failed to fetch FG distribution', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([
        { fg: 'FG', amount: 0, percentage: 0 },
        { fg: 'NonFG', amount: 0, percentage: 0 },
      ]);
    }

    // Group by FG classification
    const fgMap = new Map<string, number>();

    data.forEach((row) => {
      const fg = row.fg_classification || 'NonFG';
      const amount = Number(row.line_amount_mst || 0);
      
      fgMap.set(fg, (fgMap.get(fg) || 0) + (isNaN(amount) ? 0 : amount));
    });

    const total = Array.from(fgMap.values()).reduce((sum, val) => sum + val, 0);

    const result = Array.from(fgMap.entries())
      .map(([fg, amount]) => ({
        fg,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json(result);
  } catch (error) {
    console.error('FG distribution API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FG distribution', details: (error as Error).message },
      { status: 500 }
    );
  }
}
