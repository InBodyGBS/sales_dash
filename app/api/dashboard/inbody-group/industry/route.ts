// app/api/dashboard/inbody-group/industry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);

    const { data, error } = await supabase.rpc('get_inbody_group_industry', {
      p_year: yearInt,
    });

    if (error) {
      console.error('InBody Group Industry RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch industry data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('InBody Group Industry API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch industry data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

