import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_distinct_entities');

    if (error) {
      console.error('❌ Entities API - RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch entities', details: error.message },
        { status: 500 }
      );
    }

    // entity 배열로 변환
    const entities = (data || []).map((row: any) => row.entity);

    return NextResponse.json({ entities });
  } catch (error) {
    console.error('❌ Entities API - Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities', details: (error as Error).message },
      { status: 500 }
    );
  }
}
