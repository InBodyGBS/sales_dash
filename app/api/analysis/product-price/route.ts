import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');
    const year = searchParams.get('year') || '2024,2025';

    const supabase = createServiceClient();
    const years = year.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));

    // Use mv_sales_cube (same data source as corp-top-products) instead of sales_data
    // Note: 법인별 주력 제품 분석에서는 get_top_products RPC를 사용하는데, 이는:
    // - fg_classification = 'FG' 필터만 사용
    // - channel 필터를 사용하지 않음
    // Oceania가 법인별 주력 제품 분석에서 보인다면, 제품별 단가 분석에서도 동일한 필터를 사용해야 합니다.
    // 따라서 channel 필터를 제거하고, fg_classification만 필터링합니다.
    // IMPORTANT: Supabase 기본 limit은 1000개이므로, 페이지네이션을 사용하여 모든 데이터를 가져옵니다.
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('mv_sales_cube')
        .select('entity, year, product, category, total_quantity, total_amount, fg_classification, channel')
        .neq('entity', 'HQ')
        .not('product', 'is', null)
        // channel 필터 제거 (get_top_products RPC와 동일하게)
        .in('year', years.length > 0 ? years : [2024, 2025])
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (model) {
        query = query.eq('product', model);
      }

      const { data: pageData, error: pageError } = await query;

      if (pageError) {
        console.error('❌ Product Price API - Query error:', pageError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch product price data', details: pageError.message },
          { status: 500 }
        );
      }

      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(pageData);
        hasMore = pageData.length === pageSize; // 더 가져올 데이터가 있는지 확인
        page++;
      }
    }

    const data = allData;
    const error = null;
    
    // Debug: Always check Oceania data (even without model filter)
    console.log(`🔍 Product Price API - Total records from query:`, data?.length || 0);
    const allEntities = [...new Set((data || []).map((r: any) => r.entity))];
    console.log(`🔍 Product Price API - All entities in raw query:`, allEntities.sort());
    
    // Check Oceania in raw query results
    const oceaniaRaw = (data || []).filter((row: any) => row.entity === 'Oceania');
    console.log(`🔍 Product Price API - Oceania raw data (all products):`, oceaniaRaw.length, 'records');
    if (oceaniaRaw.length > 0) {
      console.log('🔍 Oceania sample (all products):', oceaniaRaw[0]);
      console.log('🔍 Oceania fg_classification values:', [...new Set(oceaniaRaw.map((r: any) => r.fg_classification))]);
      console.log('🔍 Oceania channel values:', [...new Set(oceaniaRaw.map((r: any) => r.channel))]);
      console.log('🔍 Oceania products:', [...new Set(oceaniaRaw.map((r: any) => r.product))]);
    } else {
      console.log(`⚠️ Product Price API - No Oceania data found in raw query`);
      // Check if Oceania data exists at all in mv_sales_cube (direct query)
      console.log(`🔍 Checking Oceania in mv_sales_cube directly...`);
      const { data: oceaniaCheck, error: oceaniaError } = await supabase
        .from('mv_sales_cube')
        .select('entity, year, product, fg_classification, channel, total_quantity, total_amount')
        .eq('entity', 'Oceania')
        .in('year', years.length > 0 ? years : [2024, 2025])
        .limit(10);
      console.log('🔍 Oceania direct query result:', oceaniaCheck?.length || 0, 'records');
      if (oceaniaError) {
        console.error('🔍 Oceania direct query error:', oceaniaError);
      }
      if (oceaniaCheck && oceaniaCheck.length > 0) {
        console.log('🔍 Oceania sample (direct query):', oceaniaCheck[0]);
        console.log('🔍 Oceania fg_classification (direct):', [...new Set(oceaniaCheck.map((r: any) => r.fg_classification))]);
        console.log('🔍 Oceania channel (direct):', [...new Set(oceaniaCheck.map((r: any) => r.channel))]);
      } else {
        console.log(`❌ Oceania data does NOT exist in mv_sales_cube for years ${years.join(',')}`);
      }
    }
    
    // Debug: Check Oceania data before filtering (for specific model)
    if (model) {
      const oceaniaRaw = (data || []).filter((row: any) => row.entity === 'Oceania' && row.product === model);
      console.log(`🔍 Product Price API - Oceania raw data for ${model}:`, oceaniaRaw.length, 'records');
      if (oceaniaRaw.length > 0) {
        console.log('🔍 Sample Oceania raw data:', oceaniaRaw[0]);
        console.log('🔍 Oceania fg_classification values:', oceaniaRaw.map((r: any) => r.fg_classification));
        console.log('🔍 Oceania channel values:', oceaniaRaw.map((r: any) => r.channel));
      } else {
        console.log(`⚠️ Product Price API - No Oceania data found in raw query for ${model}`);
        // Check if Oceania data exists at all
        const { data: oceaniaCheck } = await supabase
          .from('mv_sales_cube')
          .select('entity, year, product, fg_classification, channel, total_quantity, total_amount')
          .eq('entity', 'Oceania')
          .eq('product', model)
          .in('year', years.length > 0 ? years : [2024, 2025])
          .limit(10);
        console.log('🔍 Oceania data check (no filters):', oceaniaCheck?.length || 0, 'records');
        if (oceaniaCheck && oceaniaCheck.length > 0) {
          console.log('🔍 Oceania sample (no filters):', oceaniaCheck[0]);
        }
      }
    }

    if (error) {
      console.error('❌ Product Price API - Query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch product price data', details: (error as Error).message },
        { status: 500 }
      );
    }

    // Filter FG classification on client side (same as get_top_products RPC logic)
    // Only include rows where fg_classification is 'FG' (same as get_top_products RPC)
    const filteredData = (data || []).filter((row: any) => {
      const fg = row.fg_classification;
      return fg === 'FG';
    });
    
    // Debug: Check Oceania data after FG filter
    if (model) {
      const oceaniaFiltered = filteredData.filter((row: any) => row.entity === 'Oceania' && row.product === model);
      console.log(`🔍 Product Price API - Oceania filtered data (FG only) for ${model}:`, oceaniaFiltered.length, 'records');
      if (oceaniaFiltered.length === 0 && (data || []).some((r: any) => r.entity === 'Oceania' && r.product === model)) {
        const oceaniaNonFG = (data || []).filter((row: any) => 
          row.entity === 'Oceania' && 
          row.product === model && 
          row.fg_classification !== 'FG'
        );
        console.log(`⚠️ Oceania data exists but fg_classification is not 'FG':`, oceaniaNonFG.length, 'records');
        if (oceaniaNonFG.length > 0) {
          console.log('⚠️ Oceania non-FG sample:', oceaniaNonFG[0]);
        }
      }
    }

    if (!filteredData || filteredData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          categories: [],
          models: [],
          productCategories: {},
          priceData: {},
        },
      });
    }

    // Debug: Log entity distribution
    const entityCounts = new Map<string, number>();
    const entityProductMap = new Map<string, Set<string>>();
    filteredData.forEach((row: any) => {
      const entity = row.entity || 'unknown';
      const product = row.product || '';
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
      if (!entityProductMap.has(entity)) {
        entityProductMap.set(entity, new Set());
      }
      if (product) {
        entityProductMap.get(entity)!.add(product);
      }
    });
    console.log('📊 Product Price API - Entity distribution:', Object.fromEntries(entityCounts));
    if (model) {
      console.log(`📊 Product Price API - Filtered by product: ${model}`);
      console.log('📊 Product Price API - Entities with this product:', Array.from(entityProductMap.entries())
        .filter(([entity, products]) => products.has(model))
        .map(([entity]) => entity));
    }

    // Load exchange rates for KRW conversion (same logic as Group Dashboard)
    const { data: exchangeRates } = await supabase
      .from('exchange_rate')
      .select('year, currency, rate');
    
    const { data: entityCurrencies } = await supabase
      .from('entity_currency')
      .select('entity, currency');

    const exchangeRateMap = new Map<string, number>();
    (exchangeRates || []).forEach((er: any) => {
      exchangeRateMap.set(`${er.year}_${er.currency}`, er.rate || 1);
    });

    const entityCurrencyMap = new Map<string, string>();
    (entityCurrencies || []).forEach((ec: any) => {
      entityCurrencyMap.set(ec.entity, ec.currency);
    });

    // Aggregate data by product, year, entity with KRW conversion
    const modelMap = new Map<string, Map<string, Map<string, { qty: number; amt: number }>>>();
    const modelTotalAmt = new Map<string, number>();
    const productCategoryMap = new Map<string, string>(); // product -> category mapping
    const categorySet = new Set<string>();

    filteredData.forEach((row) => {
      const productName = row.product || '';
      const category = row.category || '';
      const yearStr = String(row.year);
      const entity = row.entity || '';
      const qty = parseFloat(row.total_quantity) || 0; // mv_sales_cube uses total_quantity
      let amt = parseFloat(row.total_amount) || 0; // mv_sales_cube uses total_amount

      // Track category for each product
      if (category && productName) {
        productCategoryMap.set(productName, category);
        categorySet.add(category);
      }

      // Apply KRW conversion (same logic as Group Dashboard)
      if (entity && !['HQ', 'Korot', 'Healthcare'].includes(entity)) {
        const currency = entityCurrencyMap.get(entity);
        if (currency) {
          const rate = exchangeRateMap.get(`${row.year}_${currency}`) || 1;
          amt = Math.round(amt * rate);
        }
      }

      if (!modelMap.has(productName)) {
        modelMap.set(productName, new Map());
        modelTotalAmt.set(productName, 0);
      }

      const yearMap = modelMap.get(productName)!;
      if (!yearMap.has(yearStr)) {
        yearMap.set(yearStr, new Map());
      }

      const entityMap = yearMap.get(yearStr)!;
      if (!entityMap.has(entity)) {
        entityMap.set(entity, { qty: 0, amt: 0 });
      }

      const entityData = entityMap.get(entity)!;
      entityData.qty += qty;
      entityData.amt += amt;
      modelTotalAmt.set(productName, (modelTotalAmt.get(productName) || 0) + amt);
    });

    // Convert to response format
    const priceData: any = {};
    const models: string[] = [];
    const categories = Array.from(categorySet).sort();

    modelMap.forEach((yearMap, modelName) => {
      priceData[modelName] = {};
      yearMap.forEach((entityMap, yearStr) => {
        priceData[modelName][yearStr] = {};
        const entitiesInYear: string[] = [];
        entityMap.forEach((entityData, entity) => {
          const price = entityData.qty > 0 ? entityData.amt / entityData.qty : 0;
          priceData[modelName][yearStr][entity] = {
            qty: Math.round(entityData.qty),
            amt: Math.round(entityData.amt),
            price: Math.round(price),
          };
          entitiesInYear.push(entity);
        });
        // Debug: Log entities for this product/year
        if (model && model === modelName) {
          console.log(`📊 Product Price API - ${modelName} (${yearStr}): entities =`, entitiesInYear.sort());
          if (entitiesInYear.includes('Oceania')) {
            console.log(`✅ Oceania found in priceData for ${modelName} (${yearStr})`);
          } else {
            console.log(`❌ Oceania NOT found in priceData for ${modelName} (${yearStr})`);
          }
        }
      });
      models.push(modelName);
    });

    // Sort models by total amount (descending)
    models.sort((a, b) => (modelTotalAmt.get(b) || 0) - (modelTotalAmt.get(a) || 0));

    // Build product-category mapping
    const productCategories: { [product: string]: string } = {};
    productCategoryMap.forEach((category, product) => {
      productCategories[product] = category;
    });

    return NextResponse.json({
      success: true,
      data: {
        categories,
        models,
        productCategories,
        priceData,
      },
    });
  } catch (error) {
    console.error('❌ Product Price API - Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product price data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

