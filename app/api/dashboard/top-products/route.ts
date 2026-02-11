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
    
    console.log(`📊 Top Products API - Request params:`, { year, yearInt, limit, entities });
    
    if (isNaN(yearInt)) {
      console.error(`❌ Top Products API - Invalid year parameter: "${year}"`);
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
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
        .from('sales_data')
        .select('fg_classification')
        .limit(1);

      if (columnCheckError) {
        if (columnCheckError.code === '42703' || columnCheckError.message?.includes('fg_classification') || columnCheckError.message?.includes('does not exist')) {
          useFGFilter = false;
          console.log('⚠️ Top Products - fg_classification column not found, filtering without FG filter');
        }
      }

      // Count query 최적화: id만 선택하여 타임아웃 방지
      let countQuery = supabase
        .from('sales_data')
        .select('id', { count: 'exact', head: true })
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
        return { count: null, error: null }; // Count 없이 진행
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
        
        // 정렬을 추가하여 일관된 결과 보장
        let query = supabase
          .from('sales_data')
          .select('product_name, product, line_amount_mst, quantity, fg_classification, category', { count: 'exact', head: false })
          .eq('year', yearInt)
          .order('id', { ascending: true }); // 정렬 추가

        if (useFGFilter) {
          query = query.eq('fg_classification', 'FG');
        }

        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range는 마지막에 적용
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          // If fg_classification doesn't exist, try without the filter
          if (error.code === '42703' || error.message?.includes('fg_classification') || error.message?.includes('does not exist')) {
            useFGFilter = false;
            // 재시도 (이미 useFGFilter가 false이므로 다음 루프에서 다시 시도)
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
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ Top Products - All data fetched: ${allData.length} records (expected: ${totalCount})`);
          } else {
            hasMore = data.length === PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지
        if (page > 1000) {
          console.warn(`⚠️ Top Products - Maximum page limit reached (1000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인
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
    let nullAmountCount = 0;
    let zeroAmountCount = 0;

    data.forEach((row) => {
      const product = row.product || row.product_name || 'Unknown';
      // Use the first non-null category for each product
      const category = row.category && row.category.trim() !== '' ? row.category.trim() : null;
      
      // line_amount_mst 처리
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullAmountCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          if (!productMap.has(product)) {
            productMap.set(product, { amount: 0, qty: 0, category });
          } else {
            // If product exists but category is null, update with non-null category
            const existing = productMap.get(product)!;
            if (!existing.category && category) {
              existing.category = category;
            }
          }
          const productData = productMap.get(product)!;
          productData.amount += amount;
          if (amount === 0) zeroAmountCount++;
        }
      }
      
      // quantity 처리
      if (row.quantity !== null && row.quantity !== undefined) {
        const qty = Number(row.quantity);
        if (!isNaN(qty)) {
          if (!productMap.has(product)) {
            productMap.set(product, { amount: 0, qty: 0, category });
          } else {
            // If product exists but category is null, update with non-null category
            const existing = productMap.get(product)!;
            if (!existing.category && category) {
              existing.category = category;
            }
          }
          const productData = productMap.get(product)!;
          productData.qty += qty;
        }
      }
    });
    
    // 디버깅: 모든 엔티티에 상세 로그 적용
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Top Products - 엔티티 집계 결과 (entities: ${entityList}):`, {
        totalRecords: data.length,
        nullAmountCount,
        zeroAmountCount,
        totalProducts: productMap.size,
        useFGFilter,
        topProductsByAmount: Array.from(productMap.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 10)
          .map(([product, data]) => ({
            product,
            amount: data.amount,
            amountFormatted: data.amount.toLocaleString(),
            qty: data.qty
          }))
      });
    }

    const allProducts = Array.from(productMap.entries())
      .map(([product, data]) => ({
        product,
        amount: data.amount,
        qty: data.qty,
        category: data.category,
      }));

    // Get unique categories from allProducts (from aggregated data)
    const categoriesFromProducts = Array.from(new Set(
      allProducts
        .map(p => p.category)
        .filter((cat): cat is string => {
          return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '';
        })
    ));

    // Also get all unique categories directly from raw data to ensure we don't miss any
    const categoriesFromRawData = Array.from(new Set(
      data
        .map(row => row.category)
        .filter((cat): cat is string => {
          return cat !== null && cat !== undefined && typeof cat === 'string' && cat.trim() !== '';
        })
    ));

    // Additionally, query database directly for all unique categories (for the given year and entities)
    // This ensures we get ALL categories even if they don't appear in the top products
    let categoriesFromDB: string[] = [];
    try {
      let categoryQuery = supabase
        .from('sales_data')
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
        console.log(`✅ Fetched ${categoriesFromDB.length} categories from DB:`, categoriesFromDB);
      } else {
        console.warn('⚠️ No category data returned from DB query');
      }
    } catch (error) {
      console.error('❌ Exception while fetching categories from database:', error);
    }

    // Combine all sources and get unique categories
    const allCategories = Array.from(new Set([
      ...categoriesFromProducts,
      ...categoriesFromRawData,
      ...categoriesFromDB
    ])).sort();

    // Debug: Log all categories found
    console.log(`📊 Top Products - Categories from products: ${categoriesFromProducts.length}`, categoriesFromProducts);
    console.log(`📊 Top Products - Categories from raw data: ${categoriesFromRawData.length}`, categoriesFromRawData);
    console.log(`📊 Top Products - Categories from DB: ${categoriesFromDB.length}`, categoriesFromDB);
    console.log(`📊 Top Products - All unique categories: ${allCategories.length}`, allCategories);
    console.log(`📊 Top Products - Total products: ${allProducts.length}, Products with category: ${allProducts.filter(p => p.category).length}`);

    // Return both sorted by amount and by quantity, with categories
    const result = {
      byAmount: [...allProducts].sort((a, b) => b.amount - a.amount).slice(0, limit),
      byQuantity: [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, limit),
      categories: allCategories, // Use all categories from both sources
      allProducts, // Include all products for client-side filtering
    };

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
