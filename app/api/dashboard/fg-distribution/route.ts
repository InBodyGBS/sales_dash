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

    // Europe 특별 처리: sales_data_europe View 사용
    if (isEurope) {
      console.log('🌍 Europe entity detected - querying sales_data_europe view for FG distribution');
      try {
        const { data: europeData, error: europeError } = await supabase
          .from('sales_data_europe')
          .select('fg_classification, line_amount_mst')
          .eq('year', yearInt);

        if (europeError) {
          console.error('❌ Europe FG distribution error:', europeError);
          return NextResponse.json([{ fg: 'FG', amount: 0, percentage: 0 }, { fg: 'NonFG', amount: 0, percentage: 0 }]);
        }

        const normalizeFGEurope = (fg: string | null | undefined): string => {
          if (!fg || fg.trim() === '') return 'NonFG';
          const n = fg.trim().toLowerCase();
          if (n === 'fg' || n === 'finished goods') return 'FG';
          if (n === 'nonfg' || n === 'non-fg' || n === 'non_fg') return 'NonFG';
          return 'FG';
        };

        const fgMap = new Map<string, number>();
        (europeData || []).forEach((r: any) => {
          const fg = normalizeFGEurope(r.fg_classification);
          fgMap.set(fg, (fgMap.get(fg) || 0) + (Number(r.line_amount_mst) || 0));
        });

        const total = Array.from(fgMap.values()).reduce((s, v) => s + v, 0);
        const result = Array.from(fgMap.entries())
          .map(([fg, amount]) => ({ fg, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount);

        return NextResponse.json(result.length > 0 ? result : [{ fg: 'FG', amount: 0, percentage: 0 }, { fg: 'NonFG', amount: 0, percentage: 0 }]);
      } catch (europeErr) {
        console.error('Europe FG distribution exception:', europeErr);
        return NextResponse.json([{ fg: 'FG', amount: 0, percentage: 0 }, { fg: 'NonFG', amount: 0, percentage: 0 }]);
      }
    }

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
          .from('mv_sales_cube')
          .select('fg_classification, total_amount')
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
    // Normalize FG values to 'FG' or 'NonFG'
    const normalizeFG = (fg: string | null | undefined): string => {
      if (!fg || fg.trim() === '' || fg.toLowerCase() === 'null' || fg === '__null__') {
        return 'NonFG';
      }
      const normalized = fg.trim();
      // Normalize common variations to 'FG' or 'NonFG'
      if (normalized.toLowerCase() === 'fg' || normalized.toLowerCase() === 'finished goods' || normalized.toLowerCase() === 'finishedgoods') {
        return 'FG';
      }
      if (normalized.toLowerCase() === 'nonfg' || normalized.toLowerCase() === 'non-fg' || normalized.toLowerCase() === 'non_fg' || normalized.toLowerCase() === 'non finished goods') {
        return 'NonFG';
      }
      // If it's not a recognized NonFG variant, assume it's FG
      return normalized === 'NonFG' ? 'NonFG' : 'FG';
    };

    const fgMap = new Map<string, number>();

    data.forEach((row) => {
      const fg = normalizeFG(row.fg_classification);
      const amount = Number(row.total_amount || 0);
      
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
