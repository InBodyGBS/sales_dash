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

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_channel_sales', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null
    });

    if (error) {
      console.error('❌ Channel Sales API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channel sales', details: error.message },
        { status: 500 }
      );
    }

    // 기존 API 형식에 맞게 변환 (channel, amount)
    const result = (data || []).slice(0, limit).map((item: any) => ({
      channel: item.channel,
      amount: item.total_amount,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Channel Sales API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel sales', details: (error as Error).message },
      { status: 500 }
    );
  }
}
