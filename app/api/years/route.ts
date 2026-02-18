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
    
    console.log('🔄 Fetching distinct years using RPC function...');
    
    try {
      // RPC 함수 호출 - 파라미터 이름을 p_entity로 수정
      const { data, error } = await supabase
        .rpc('get_distinct_years', { 
          p_entity: entity && entity !== 'All' ? entity : null 
        });

      if (error) {
        console.error('❌ RPC error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        
        // RPC 함수가 없거나 타임아웃이면 fallback
        if (error.code === '42883' || error.code === '57014' || error.message?.includes('function') || error.message?.includes('does not exist') || error.message?.includes('timeout')) {
          console.warn('⚠️ RPC failed. Using fallback method...');
          
          let fallbackQuery = supabase
            .from('mv_sales_cube')
            .select('year')
            .not('year', 'is', null)
            .order('year', { ascending: false })
            .limit(50000);
          
          if (entity && entity !== 'All') {
            fallbackQuery = fallbackQuery.eq('entity', entity);
          }
          
          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          
          if (fallbackError) {
            console.error('❌ Fallback query also failed:', fallbackError);
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

      // RPC 결과 처리
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

      years.sort((a, b) => b - a);

      console.log(`✅ Fetched ${years.length} unique years for entity: ${entity || 'All'}:`, years);
      
      if (years.length === 0 && entity && entity !== 'All') {
        console.warn(`⚠️ No years found for entity: ${entity}. This may indicate missing data.`);
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
