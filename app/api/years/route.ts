import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');

    const supabase = await createServiceClient();
    
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
          .select('year')
          .order('year', { ascending: false });

        if (entity && entity !== 'All') {
          query = query.eq('entity', entity);
        }

        query = query.range(from, to);

        const { data, error } = await query;

        if (error) {
          console.error(`Database error (page ${page}):`, error);
          return NextResponse.json(
            { error: 'Failed to fetch years', details: error.message },
            { status: 500 }
          );
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
        { error: 'Failed to fetch years', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    // Get unique years
    const years = Array.from(new Set(allData.map((d) => d.year).filter((y) => y != null)))
      .sort((a, b) => b - a);

    console.log(`Fetched ${years.length} unique years for entity: ${entity || 'All'}`);

    return NextResponse.json({ years });
  } catch (error) {
    console.error('Years API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: (error as Error).message },
      { status: 500 }
    );
  }
}
