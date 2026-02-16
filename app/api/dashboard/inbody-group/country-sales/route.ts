// app/api/dashboard/inbody-group/country-sales/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Country sales function is disabled because country column doesn't exist in mv_sales_cube
export async function GET(request: NextRequest) {
  // Return empty array since country data is not available
  return NextResponse.json([]);
}

