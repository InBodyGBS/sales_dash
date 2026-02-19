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

    const yearInt = parseInt(year);
    if (isNaN(yearInt)) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_fg_distribution', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null
    });

    if (error) {
      console.error('❌ FG Distribution API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch FG distribution', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('❌ FG Distribution API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FG distribution', details: (error as Error).message },
      { status: 500 }
    );
  }
}
