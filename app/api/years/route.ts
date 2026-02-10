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
    
    // 최적화된 방법: PostgreSQL RPC 함수를 사용하여 DISTINCT year 직접 쿼리
    console.log('🔄 Fetching distinct years using RPC function...');
    
    try {
      // RPC 함수를 사용하여 고유 연도만 가져오기 (매우 빠름!)
      const { data, error } = await supabase
        .rpc('get_distinct_years', { 
          entity_name: entity && entity !== 'All' ? entity : null 
        });

      if (error) {
        console.error('❌ RPC error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        
        // If RPC function doesn't exist or timeout, use fallback method
        if (error.code === '42883' || error.code === '57014' || error.message?.includes('function') || error.message?.includes('does not exist') || error.message?.includes('timeout')) {
          console.warn('⚠️ RPC failed (function not found or timeout). Using fallback method with limit...');
          
          // Fallback: Use simple select with limit
          let fallbackQuery = supabase
            .from('sales_data')
            .select('year')
            .not('year', 'is', null)
            .order('year', { ascending: false })
            .limit(50000); // 더 많은 행을 가져와서 모든 연도 확인
          
          if (entity && entity !== 'All') {
            fallbackQuery = fallbackQuery.eq('entity', entity);
          }
          
          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          
          if (fallbackError) {
            console.error('❌ Fallback query also failed:', fallbackError);
            // If it's a "table not found" error, return empty array
            if (fallbackError.code === '42P01' || fallbackError.code === 'PGRST116' || fallbackError.code === 'PGRST205') {
              console.warn('Table does not exist, returning empty years array');
              return NextResponse.json({ years: [] });
            }
            return NextResponse.json(
              { 
                error: 'Failed to fetch years', 
                details: fallbackError.message,
                code: fallbackError.code,
              },
              { status: 500 }
            );
          }
          
          // Extract unique years from fallback data
          const fallbackYears: number[] = [];
          if (fallbackData && Array.isArray(fallbackData)) {
            console.log(`   Fallback: Found ${fallbackData.length} rows`);
            const seenYears = new Set<number>();
            fallbackData.forEach((row: any) => {
              const year = row?.year;
              if (year != null && !isNaN(Number(year))) {
                const yearNum = Number(year);
                if (yearNum > 1900 && yearNum < 2100) {
                  seenYears.add(yearNum);
                }
              }
            });
            fallbackYears.push(...Array.from(seenYears).sort((a, b) => b - a));
          }
          
          console.log(`✅ Fallback: Fetched ${fallbackYears.length} unique years for entity: ${entity || 'All'}:`, fallbackYears);
          return NextResponse.json({ years: fallbackYears });
        }
        
        // If it's a "table not found" error, return empty array
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST205') {
          console.warn('Table does not exist, returning empty years array');
          return NextResponse.json({ years: [] });
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to fetch years', 
            details: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }

      // RPC function returns array of {year: number}
      const years: number[] = [];
      if (data && Array.isArray(data)) {
        console.log(`   Found ${data.length} distinct years from RPC`);
        data.forEach((row: any) => {
          const year = row?.year || row;
          if (year != null && !isNaN(Number(year))) {
            const yearNum = Number(year);
            if (yearNum > 1900 && yearNum < 2100) {
              years.push(yearNum);
            }
          }
        });
      }

      // Sort descending (should already be sorted by RPC, but just in case)
      years.sort((a, b) => b - a);

      console.log(`✅ Fetched ${years.length} unique years for entity: ${entity || 'All'}:`, years);
      
      // If no years found but entity was specified, log a warning
      if (years.length === 0 && entity && entity !== 'All') {
        console.warn(`⚠️ No years found for entity: ${entity}. This may indicate missing data or year column issues.`);
      }

      return NextResponse.json({ years });
    } catch (queryError) {
      console.error('❌ Query error:', {
        error: queryError instanceof Error ? queryError.message : String(queryError),
        stack: queryError instanceof Error ? queryError.stack : undefined,
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch years', 
          details: queryError instanceof Error ? queryError.message : String(queryError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Years API error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch years', 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
