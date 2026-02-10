import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Simplified version - fetch all years without pagination first
export async function GET(request: NextRequest) {
  console.log('📥 Years API called (simple version)');
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    console.log('📋 Entity parameter:', entity);

    const supabase = createServiceClient();
    console.log('✅ Supabase client created');

    // Simple query - just get all years (Supabase will return max 1000 rows)
    // For years, this should be enough
    let query = supabase
      .from('sales_data')
      .select('year')
      .order('year', { ascending: false })
      .limit(1000);

    if (entity && entity !== 'All') {
      console.log(`   Filtering by entity: ${entity}`);
      query = query.eq('entity', entity);
    }

    console.log('   Executing query...');
    const { data, error } = await query;
    console.log(`   Query result: data=${data?.length || 0} rows, error=${error ? 'YES' : 'NO'}`);

    if (error) {
      console.error('❌ Database error:', {
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
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch years', 
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    // Extract unique years
    const seenYears = new Set<number>();
    if (data && data.length > 0) {
      data.forEach((row: any) => {
        const year = row?.year;
        if (year != null && year !== undefined && !isNaN(Number(year))) {
          seenYears.add(Number(year));
        }
      });
    }

    // Get unique years and sort (descending)
    const years = Array.from(seenYears)
      .filter((y) => !isNaN(y))
      .sort((a, b) => b - a);

    console.log(`✅ Fetched ${years.length} unique years for entity: ${entity || 'All'}`);

    return NextResponse.json({ years });
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
