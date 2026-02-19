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

    const prevYear = yearInt - 1;
    const supabase = createServiceClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_monthly_trend', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null,
      p_prev_year: prevYear
    });

    if (error) {
      console.error('❌ Monthly Trend API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch monthly trend', details: error.message },
        { status: 500 }
      );
    }

    // RPC가 이미 정렬된 결과를 반환
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('❌ Monthly Trend API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly trend', details: (error as Error).message },
      { status: 500 }
    );
  }
}
