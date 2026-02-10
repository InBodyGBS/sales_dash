// Backup of old years API implementation with pagination
// This was too slow for large datasets like USA

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('📥 Years API called');
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    console.log('📋 Entity parameter:', entity);

    const supabase = createServiceClient();
    console.log('✅ Supabase client created');
    
    // Use pagination to get all years (Supabase returns max 1000 rows per query)
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 100; // 최대 100,000행까지 확인 (모든 연도를 찾기 위해)
    const seenYears = new Set<number>();
    let page = 0;
    let hasMore = true;

    console.log('🔄 Starting pagination to fetch all years...');
    
    // ... rest of old implementation
  } catch (error) {
    console.error('❌ Years API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch years', 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

