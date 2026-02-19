// app/api/dashboard/inbody-group/channel-sales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '10');
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || [];
    const quarter = searchParams.get('quarter') || 'All';
    const month = searchParams.get('month');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    const monthInt = month ? parseInt(month) : null;

    // RPC 함수 호출 - InBody Group 전용 (KRW 변환)
    const { data, error } = await supabase.rpc('get_inbody_group_channel_sales', {
      p_year: yearInt,
      p_entities: entities.length > 0 && !entities.includes('All') ? entities : null,
      p_quarter: quarter === 'All' ? null : quarter,
      p_month: monthInt,
    });

    if (error) {
      console.error('❌ InBody Group Channel Sales API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channel sales', details: error.message },
        { status: 500 }
      );
    }

    // API 형식에 맞게 변환 (channel, amount)
    const result = (data || []).slice(0, limit).map((item: any) => ({
      channel: item.channel,
      amount: item.amount || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ InBody Group Channel Sales API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel sales', details: (error as Error).message },
      { status: 500 }
    );
  }
}

