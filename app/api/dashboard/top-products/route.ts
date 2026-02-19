import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '10');
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

    // RPC 함수 호출 (모든 로직은 DB에서 처리)
    const { data, error } = await supabase.rpc('get_top_products', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null,
      p_limit: limit
    });

    if (error) {
      console.error('❌ Top Products API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch top products', details: error.message },
        { status: 500 }
      );
    }

    // RPC가 이미 정렬된 결과를 반환하므로 그대로 전달
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Top Products API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
