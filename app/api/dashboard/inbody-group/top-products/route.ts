// app/api/dashboard/inbody-group/top-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);

    // Get all products (no limit) to enable category filtering
    const { data, error } = await supabase.rpc('get_inbody_group_top_products', {
      p_year: yearInt,
      p_limit: 1000, // Get more products for category filtering
    });

    if (error) {
      console.error('InBody Group Top Products RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch top products', details: error.message },
        { status: 500 }
      );
    }

    const allProducts = (data || []).map((item: any) => ({
      product: item.product,
      amount: item.amount,
      qty: item.quantity,
      category: item.category,
    }));

    // Get unique categories
    const categories = Array.from(new Set(
      allProducts
        .map((p: any) => p.category)
        .filter((cat: any): cat is string => {
          return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '' && cat !== 'Unknown';
        })
    )).sort();

    console.log(`📊 InBody Group Top Products - Total products: ${allProducts.length}, Categories: ${categories.length}`);

    // Return HQ-like format
    const result = {
      byAmount: [...allProducts].sort((a, b) => b.amount - a.amount).slice(0, limit),
      byQuantity: [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, limit),
      categories,
      allProducts,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('InBody Group Top Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top products', details: (error as Error).message },
      { status: 500 }
    );
  }
}

