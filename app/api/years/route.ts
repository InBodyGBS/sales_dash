import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('📥 Years API called');
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    console.log('📋 Entity parameter:', entity);

    const supabase = createServiceClient();
    console.log('✅ Supabase client created');
    
    // Use pagination to get all years (Supabase returns max 1000 rows per query)
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 5; // 최대 5,000행까지 확인 (연도는 보통 많지 않음)
    const seenYears = new Set<number>();
    let page = 0;
    let hasMore = true;

    console.log('🔄 Starting pagination to fetch all years...');
    
    try {
      while (hasMore && page < MAX_PAGES) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        console.log(`📄 Fetching page ${page + 1} (rows ${from}-${to})...`);
        
        try {
          // 필터를 먼저 적용하고, 그 다음 정렬, 마지막에 range 적용
          // Select both year column and invoice_date to extract year from date if needed
          let query = supabase
            .from('sales_data')
            .select('year, invoice_date');

          if (entity && entity !== 'All') {
            query = query.eq('entity', entity);
          }

          // 정렬: invoice_date 기준으로 정렬 (year가 null이어도 invoice_date에서 추출 가능)
          // invoice_date가 null이 아닌 것을 우선
          query = query.order('invoice_date', { ascending: false, nullsFirst: false })
                       .order('year', { ascending: false, nullsFirst: false })
                       .range(from, to);

          const { data, error } = await query;

          if (error) {
            console.error(`❌ Database error (page ${page}):`, {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            
            // If it's a "table not found" error, return empty array
            if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST205') {
              console.warn('Table does not exist, returning empty years array');
              return NextResponse.json({ years: [] });
            }
            
            // For other errors, try to continue with next page or return what we have
            console.warn(`⚠️ Error on page ${page + 1}, stopping pagination`);
            break;
          }

          if (data && data.length > 0) {
            // Extract unique years from this page
            data.forEach((row: any) => {
              // First try year column (sales_data.year)
              let year = row?.year;
              if (year != null && year !== undefined && !isNaN(Number(year))) {
                const yearNum = Number(year);
                if (yearNum > 1900 && yearNum < 2100) {
                  seenYears.add(yearNum);
                }
              }
              
              // Also extract year from invoice_date (in case year column is null or different)
              const invoiceDate = row?.invoice_date;
              if (invoiceDate) {
                try {
                  const date = new Date(invoiceDate);
                  if (!isNaN(date.getTime())) {
                    const yearFromDate = date.getFullYear();
                    if (yearFromDate > 1900 && yearFromDate < 2100) {
                      seenYears.add(yearFromDate);
                    }
                  }
                } catch (e) {
                  // Ignore date parsing errors
                }
              }
            });
            
            console.log(`   Page ${page + 1}: Found ${data.length} rows, ${seenYears.size} unique years so far`);
            
            page++;
            hasMore = data.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }
        } catch (pageError) {
          console.error(`❌ Error on page ${page + 1}:`, {
            error: pageError instanceof Error ? pageError.message : String(pageError),
            stack: pageError instanceof Error ? pageError.stack : undefined,
          });
          // Continue with next page or break if too many errors
          break;
        }
      }

      // Get unique years and sort (descending)
      const years = Array.from(seenYears)
        .filter((y) => !isNaN(y))
        .sort((a, b) => b - a);

      console.log(`✅ Fetched ${years.length} unique years for entity: ${entity || 'All'} (checked ${page} pages):`, years);

      return NextResponse.json({ years });
    } catch (paginationError) {
      console.error('❌ Pagination error:', {
        error: paginationError instanceof Error ? paginationError.message : String(paginationError),
        stack: paginationError instanceof Error ? paginationError.stack : undefined,
      });
      // Return what we have so far, or empty array
      const years = Array.from(seenYears)
        .filter((y) => !isNaN(y))
        .sort((a, b) => b - a);
      return NextResponse.json({ years });
    }
  } catch (error) {
    console.error('Years API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: (error as Error).message },
      { status: 500 }
    );
  }
}
