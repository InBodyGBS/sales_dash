import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');

    const supabase = createServiceClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_distinct_years', {
      p_entity: entity || null
    });

    if (error) {
      console.error('❌ Years API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch years', details: error.message },
        { status: 500 }
      );
    }

    // year 배열로 변환
    const years = (data || []).map((row: any) => row.year);

    return NextResponse.json({ years });
  } catch (error) {
    console.error('❌ Years API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: (error as Error).message },
      { status: 500 }
    );
  }
}
