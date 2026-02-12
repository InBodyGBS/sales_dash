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

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    
    if (isNaN(yearInt)) {
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
    }

    console.log(`📊 Channel Sales API - Request:`, { year: yearInt, limit, entities });

    // RPC 함수 호출 (mv_sales_cube 사용, 훨씬 빠름)
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

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    console.log(`✅ Channel Sales API - Success:`, { 
      channels: data.length,
      year: yearInt,
      entities: entities.join(',') || 'All'
    });

    // limit 적용 후 반환
    const result = data.slice(0, limit).map((item: any) => ({
      channel: item.channel,
      amount: item.amount,
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
