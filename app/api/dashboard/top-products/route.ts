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
    
    const isEurope = entities.includes('Europe');
    console.log(`📊 Top Products API - Request params:`, { year, yearInt, limit, entities, isEurope });
    
    if (isNaN(yearInt)) {
      console.error(`❌ Top Products API - Invalid year parameter: "${year}"`);
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
    }

    // Europe 특별 처리: sales_data_europe View 사용
    if (isEurope) {
      console.log('🌍 Europe entity detected - querying sales_data_europe view for top products');
      try {
        const { data: europeData, error: europeError } = await supabase
          .from('sales_data_europe')
          .select('product_name, product, line_amount_mst, quantity, fg_classification, category')
          .eq('year', yearInt)
          .eq('fg_classification', 'FG');

        if (europeError) {
          console.error('❌ Europe top products error:', europeError);
          return NextResponse.json({ byAmount: [], byQuantity: [], categories: [], allProducts: [] });
        }

        const productMap = new Map<string, { amount: number; qty: number; category: string | null }>();
        (europeData || []).forEach((r: any) => {
          const product = r.product || r.product_name || 'Unknown';
          const existing = productMap.get(product) || { amount: 0, qty: 0, category: r.category || null };
          existing.amount += Number(r.line_amount_mst) || 0;
          existing.qty += Number(r.quantity) || 0;
          if (!existing.category && r.category) existing.category = r.category;
          productMap.set(product, existing);
        });

        const allProducts = Array.from(productMap.entries()).map(([product, d]) => ({ product, amount: d.amount, qty: d.qty, category: d.category }));
        const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean) as string[])).sort();

        const result = {
          byAmount: [...allProducts].sort((a, b) => b.amount - a.amount).slice(0, limit),
          byQuantity: [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, limit),
          categories,
          allProducts,
        };

        console.log(`✅ Europe top products fetched: ${allProducts.length} products`);
        return NextResponse.json(result);
      } catch (europeErr) {
        console.error('Europe top products exception:', europeErr);
        return NextResponse.json({ byAmount: [], byQuantity: [], categories: [], allProducts: [] });
      }
    }

    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;
    let useFGFilter = true;

    try {
      // 먼저 fg_classification 컬럼 존재 여부 확인
      const { error: columnCheckError } = await supabase
        .from('mv_sales_cube')
        .select('fg_classification')
        .limit(1);

      if (columnCheckError) {
        if (columnCheckError.code === '42703' || columnCheckError.message?.includes('fg_classification') || columnCheckError.message?.includes('does not exist')) {
          useFGFilter = false;
          console.log('⚠️ Top Products - fg_classification column not found, filtering without FG filter');
        }
      }

      // Count query 최적화
      let countQuery = supabase
        .from('mv_sales_cube')
        .select('entity', { count: 'exact', head: true })
        .eq('year', yearInt);

      if (useFGFilter) {
        countQuery = countQuery.eq('fg_classification', 'FG');
      }

      if (entities.length > 0 && !entities.includes('All')) {
        countQuery = countQuery.in('entity', entities);
      }

      // 타임아웃 방지를 위해 5초 제한
      const countPromise = countQuery;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Count query timeout')), 5000)
      );

      const { count: initialCount, error: countError } = await Promise.race([
        countPromise,
        timeoutPromise
      ]).catch((err) => {
        console.warn('⚠️ Top Products API - Count query timeout or error, proceeding without count:', err);
        return { count: null, error: null };
      }) as any;
      
      if (countError) {
        console.error('❌ Top Products API - Count query error:', {
          code: countError.code,
          message: countError.message,
          details: countError.details,
          hint: countError.hint,
          year: yearInt,
          entities
        });
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      totalCount = initialCount || 0;
      console.log(`📊 Top Products - Total records to fetch: ${totalCount || 'unknown'} (year: ${yearInt}, entities: ${entities.join(',')}, useFGFilter: ${useFGFilter})`);

      // Count가 없으면 최대 100페이지로 제한
      let maxPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 100;
      
      while (hasMore && page < maxPages) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        let query = supabase
          .from('mv_sales_cube')
          .select('product_name, product, total_amount, total_quantity, fg_classification, category', { count: 'exact', head: false })
          .eq('year', yearInt)
          .order('entity', { ascending: true });

        if (useFGFilter) {
          query = query.eq('fg_classification', 'FG');
        }

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          if (error.code === '42703' || error.message?.includes('fg_classification') || error.message?.includes('does not exist')) {
            useFGFilter = false;
            continue;
          }
          console.error('❌ Top Products API - Database error (page ' + page + '):', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            year: yearInt,
            entities,
            page
          });
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Top Products - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        if (page > 1000) {
          console.warn(`⚠️ Top Products - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      if (allData.length < totalCount) {
        console.warn(`⚠️ Top Products - Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch top products', details: (queryError as Error).message },
        { status: 500 }
      );
    }

    const data = allData;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group by product with category
    const productMap = new Map<string, { amount: number; qty: number; category: string | null }>();

    data.forEach((row) => {
      const product = row.product || row.product_name || 'Unknown';
      const category = row.category && row.category.trim() !== '' ? row.category.trim() : null;
      
      // 제품이 없으면 초기화
      if (!productMap.has(product)) {
        productMap.set(product, { amount: 0, qty: 0, category });
      }
      
      const productData = productMap.get(product)!;
      
      // category 업데이트 (기존이 null이고 새 값이 있으면)
      if (!productData.category && category) {
        productData.category = category;
      }
      
      // amount 처리: NULL, undefined, NaN을 모두 0으로 변환
      const rawAmount = row.total_amount;
      const amount = (rawAmount === null || rawAmount === undefined || isNaN(Number(rawAmount))) 
        ? 0 
        : Number(rawAmount);
      productData.amount += amount;
      
      // quantity 처리: NULL, undefined, NaN을 모두 0으로 변환
      const rawQty = row.total_quantity;
      const qty = (rawQty === null || rawQty === undefined || isNaN(Number(rawQty))) 
        ? 0 
        : Number(rawQty);
      productData.qty += qty;
    });

    const allProducts = Array.from(productMap.entries())
      .map(([product, data]) => ({
        product,
        amount: data.amount || 0,  // null/undefined 방지
        qty: data.qty || 0,        // null/undefined 방지
        category: data.category,
      }));

    // Get unique categories
    const categoriesFromProducts = Array.from(new Set(
      allProducts
        .map(p => p.category)
        .filter((cat): cat is string => {
          return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '';
        })
    ));

    const categoriesFromRawData = Array.from(new Set(
      data
        .map(row => row.category)
        .filter((cat): cat is string => {
          return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '';
        })
    ));

    let categoriesFromDB: string[] = [];
    try {
      let categoryQuery = supabase
        .from('mv_sales_cube')
        .select('category')
        .eq('year', yearInt)
        .not('category', 'is', null);

      if (entities.length > 0 && !entities.includes('All')) {
        categoryQuery = categoryQuery.in('entity', entities);
      }

      if (useFGFilter) {
        categoryQuery = categoryQuery.eq('fg_classification', 'FG');
      }

      const { data: categoryData, error: categoryError } = await categoryQuery;

      if (categoryError) {
        console.error('❌ Error fetching categories from DB:', categoryError);
      } else if (categoryData) {
        categoriesFromDB = Array.from(new Set(
          categoryData
            .map(row => row.category)
            .filter((cat): cat is string => {
              return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '';
            })
        ));
      }
    } catch (error) {
      console.error('❌ Exception while fetching categories from database:', error);
    }

    const allCategories = Array.from(new Set([
      ...categoriesFromProducts,
      ...categoriesFromRawData,
      ...categoriesFromDB
    ])).sort();

    // 정렬: amount가 0인 것들은 뒤로 보내기
    const sortByAmount = (a: typeof allProducts[0], b: typeof allProducts[0]) => {
      const aAmount = a.amount || 0;
      const bAmount = b.amount || 0;
      // 둘 다 0이면 이름순
      if (aAmount === 0 && bAmount === 0) {
        return a.product.localeCompare(b.product);
      }
      // 하나만 0이면 0인 것을 뒤로
      if (aAmount === 0) return 1;
      if (bAmount === 0) return -1;
      // 둘 다 0이 아니면 내림차순
      return bAmount - aAmount;
    };

    const sortByQty = (a: typeof allProducts[0], b: typeof allProducts[0]) => {
      const aQty = a.qty || 0;
      const bQty = b.qty || 0;
      if (aQty === 0 && bQty === 0) {
        return a.product.localeCompare(b.product);
      }
      if (aQty === 0) return 1;
      if (bQty === 0) return -1;
      return bQty - aQty;
    };

    const result = {
      byAmount: [...allProducts].sort(sortByAmount).slice(0, limit),
      byQuantity: [...allProducts].sort(sortByQty).slice(0, limit),
      categories: allCategories,
      allProducts: allProducts.map(p => ({ ...p, amount: p.amount || 0, qty: p.qty || 0 })),
    };

    console.log(`✅ Top Products API - Returning ${result.byAmount.length} products by amount, ${result.byQuantity.length} by quantity`);
    console.log(`📊 Top 3 by Amount:`, result.byAmount.slice(0, 3).map(p => ({ product: p.product, amount: p.amount })));

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Top Products API - Unexpected error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    return NextResponse.json(
      { error: 'Failed to fetch top products', details: (error as Error).message },
      { status: 500 }
    );
  }
}