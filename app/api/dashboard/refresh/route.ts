import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    console.log('🔄 Refreshing mv_sales_cube materialized view...');

    // 먼저 RPC 함수가 존재하는지 확인
    const { data: rpcCheck, error: rpcCheckError } = await supabase.rpc('refresh_mv_sales_cube');

    if (rpcCheckError) {
      // RPC 함수가 없거나 오류가 있는 경우
      console.error('❌ RPC function error:', rpcCheckError);
      
      const isTimeout = rpcCheckError.message?.includes('timeout') || 
                        rpcCheckError.message?.includes('canceling statement');
      
      return NextResponse.json(
        { 
          error: 'Failed to refresh materialized view',
          details: rpcCheckError.message,
          isTimeout,
          note: isTimeout 
            ? 'The refresh operation timed out. Please run the SQL command directly in Supabase SQL Editor:\n\nREFRESH MATERIALIZED VIEW mv_sales_cube;\n\nThis usually takes 1-2 minutes for large datasets.'
            : 'Please run the following SQL in your database:\n\nREFRESH MATERIALIZED VIEW mv_sales_cube;\n\nOr ensure the refresh_mv_sales_cube() function exists by running database/fix-refresh-mv-function-timeout.sql',
          sqlCommand: 'REFRESH MATERIALIZED VIEW mv_sales_cube;',
          instructions: 'Go to Supabase Dashboard > SQL Editor > Run the SQL command above'
        },
        { status: 500 }
      );
    }

    console.log('✅ mv_sales_cube refreshed successfully:', rpcCheck);

    // 갱신 후 데이터 확인
    const { count: afterCount } = await supabase
      .from('mv_sales_cube')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: rpcCheck || 'Materialized view refreshed successfully',
      recordCount: afterCount || 0
    });
  } catch (error) {
    console.error('❌ Error refreshing materialized view:', error);
    return NextResponse.json(
      { 
        error: 'Failed to refresh materialized view',
        details: (error as Error).message,
        sqlCommand: 'REFRESH MATERIALIZED VIEW mv_sales_cube;'
      },
      { status: 500 }
    );
  }
}
