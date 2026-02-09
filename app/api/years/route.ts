import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');

    const supabase = createServiceClient();
    
    // 효율적으로 고유 연도만 가져오기: 최대 20페이지(20,000행)까지만 확인
    // 연도는 보통 많지 않으므로 충분함
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 20; // 타임아웃 방지를 위한 최대 페이지 수
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    const seenYears = new Set<number>();

    try {
      while (hasMore && page < MAX_PAGES) {
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
          // 연도만 추출하여 Set에 추가 (중복 제거)
          data.forEach((row) => {
            if (row.year != null) {
              seenYears.add(row.year);
            }
          });
          
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

    // Get unique years from Set and sort
    const years = Array.from(seenYears)
      .sort((a, b) => b - a);

    console.log(`Fetched ${years.length} unique years for entity: ${entity || 'All'} (checked ${page} pages)`);

    return NextResponse.json({ years });
  } catch (error) {
    console.error('Years API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: (error as Error).message },
      { status: 500 }
    );
  }
}
