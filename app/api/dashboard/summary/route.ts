import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || [];

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const yearInt = parseInt(year);
    
    if (isNaN(yearInt)) {
      console.error(`❌ Summary API - Invalid year parameter: "${year}"`);
      return NextResponse.json(
        { error: 'Invalid year parameter', details: `Year "${year}" is not a valid number` },
        { status: 400 }
      );
    }
    
    // 디버깅: 받은 year 파라미터 확인
    console.log(`📊 Summary API - Received year parameter: "${year}", parsed as: ${yearInt}, entities: ${entities.join(',')}`);

    // Total Amount = 연도별 Line Amount_MST의 합계
    // 모든 페이지를 반복해서 가져와서 전체 합계 계산
    
    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    // Supabase PostgREST의 기본 max-rows 제한이 1000이므로 PAGE_SIZE를 1000으로 설정
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      // Count query 최적화: id만 선택하여 타임아웃 방지
      let countQuery = supabase
        .from('sales_data')
        .select('id', { count: 'exact', head: true })
        .eq('year', yearInt);

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
        console.warn('⚠️ Summary API - Count query timeout or error, proceeding without count:', err);
        return { count: null, error: null }; // Count 없이 진행
      }) as any;
      
      if (countError) {
        console.error('❌ Summary API - Count query error:', {
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
      console.log(`📊 Total records to fetch: ${totalCount || 'unknown'} (year: ${yearInt}, entities: ${entities.join(',')})`);

      // Count가 없으면 최대 100페이지로 제한
      let maxPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 100;

      // 모든 데이터를 가져올 때까지 반복
      while (hasMore && page < maxPages) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 각 페이지마다 새로운 쿼리 생성
        // 정렬을 추가하여 일관된 결과 보장 (id로 정렬)
        // entity, year를 포함하여 정확한 집계 확인
        let query = supabase
          .from('sales_data')
          .select('entity, year, line_amount_mst, quantity', { count: 'exact', head: false })
          .eq('year', yearInt)
          .order('id', { ascending: true }); // 정렬 추가로 일관된 결과 보장

        // Filter by entities
        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range 적용 (정렬 후)
        // Supabase의 기본 limit이 1000이므로 명시적으로 설정하지 않으면 1000개만 반환됨
        query = query.range(from, to);

        const { data, error } = await query;
        
        if (error) {
          console.error('❌ Summary API - Database error (page ' + page + '):', {
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
          
          // 더 가져올 데이터가 있는지 확인 (data.length가 PAGE_SIZE와 같으면 더 있음)
          hasMore = data.length === PAGE_SIZE;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인 (추가 안전장치)
          if (allData.length >= totalCount) {
            hasMore = false;
            console.log(`✅ All data fetched: ${allData.length} records (expected: ${totalCount})`);
          }
        } else {
          hasMore = false;
        }
        
        // 안전장치: 무한 루프 방지 (최대 10000페이지 = 10,000,000 레코드)
        if (page > 10000) {
          console.warn(`⚠️ Maximum page limit reached (10000 pages). Fetched ${allData.length} records out of ${totalCount}`);
          hasMore = false;
        }
      }
      
      // 최종 확인: 가져온 데이터 수와 전체 개수 비교
      console.log(`📊 Final count: Fetched ${allData.length} records, expected ${totalCount}, difference: ${totalCount - allData.length}`);
      if (allData.length < totalCount) {
        console.warn(`⚠️ Warning: Fetched ${allData.length} records but expected ${totalCount}. Missing ${totalCount - allData.length} records.`);
      } else if (allData.length > totalCount) {
        console.warn(`⚠️ Warning: Fetched ${allData.length} records but expected ${totalCount}. Extra ${allData.length - totalCount} records.`);
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch sales data', details: (queryError as Error).message },
        { status: 500 }
      );
    }
    
    const data = allData;
    
    // 디버깅: 실제로 가져온 데이터 수 확인
    console.log(`🔍 DB 쿼리 결과 (모든 페이지):`, {
      가져온_행수: data.length,
      count_값: totalCount,
      페이지_수: page,
      year: yearInt,
      entities
    });

    if (!data || data.length === 0) {
      return NextResponse.json({
        totalAmount: 0,
        totalQty: 0,
        avgAmount: 0,
        totalTransactions: 0,
        comparison: {
          amount: 0,
          qty: 0,
        },
      });
    }

    // Calculate Total Amount: 연도별 Line Amount_MST 합계
    // Number() 사용하여 정확한 숫자 변환
    let totalAmount = 0;
    let totalQty = 0;
    let nullCount = 0;
    let zeroCount = 0;
    let wrongEntityCount = 0;
    let wrongYearCount = 0;
    
    for (const row of data) {
      // line_amount_mst 처리
      if (row.line_amount_mst === null || row.line_amount_mst === undefined) {
        nullCount++;
      } else {
        const amount = Number(row.line_amount_mst);
        if (isNaN(amount)) {
          console.warn('Invalid line_amount_mst:', row.line_amount_mst);
        } else {
          totalAmount += amount;
          if (amount === 0) zeroCount++;
        }
      }
      
      // quantity 처리
      if (row.quantity !== null && row.quantity !== undefined) {
        const qty = Number(row.quantity);
        if (!isNaN(qty)) {
          totalQty += qty;
        }
      }
    }

    const avgAmount = data.length > 0 ? totalAmount / data.length : 0;
    const totalTransactions = data.length;
    
    // 상세 디버깅 로그
    console.log(`📊 Summary API - 연도별 Line Amount_MST 합계 계산:`, {
      year: yearInt,
      entities,
      전체_레코드_수: totalCount,
      DB에서_가져온_행수: data.length,
      누락된_레코드_수: totalCount - data.length,
      null_line_amount_mst_개수: nullCount,
      zero_line_amount_mst_개수: zeroCount,
      잘못된_entity_개수: wrongEntityCount,
      잘못된_year_개수: wrongYearCount,
      계산된_Total_Amount: totalAmount,
      계산된_Total_Amount_원: `${totalAmount.toLocaleString()} 원`,
      계산된_Total_Amount_KRW: `₩${totalAmount.toLocaleString()}`,
      샘플_데이터: data.slice(0, 5).map(r => ({
        entity: r.entity,
        year: r.year,
        line_amount_mst: r.line_amount_mst
      }))
    });
    
    console.log(`✅ Total Amount 계산 완료: ${totalAmount.toLocaleString()} 원 (${data.length}개 행 / 전체 ${totalCount}개 행)`);
    
    // SQL 쿼리와 비교를 위한 추가 정보 (모든 엔티티에 적용)
    if (entities.length > 0 && !entities.includes('All')) {
      const entityList = entities.join(', ');
      console.log(`🔍 Summary API - 엔티티 디버깅 정보:`, {
        year: yearInt,
        entities: entityList,
        totalAmount: totalAmount,
        totalAmountFormatted: totalAmount.toLocaleString(),
        expectedSQL: `SELECT SUM(line_amount_mst) FROM sales_data WHERE entity IN (${entities.map(e => `'${e}'`).join(', ')}) AND year = ${yearInt}`,
        note: 'SQL에서 확인한 금액과 비교해주세요'
      });
    }

    // Get previous period data for comparison - 모든 페이지 가져오기
    const prevYear = yearInt - 1;
    let allPrevData: any[] = [];
    let prevPage = 0;
    let prevHasMore = true;
    let prevTotalCount = 0;

    try {
      // 이전 연도 Count query 최적화: id만 선택하여 타임아웃 방지
      let prevCountQuery = supabase
        .from('sales_data')
        .select('id', { count: 'exact', head: true })
        .eq('year', prevYear);

      if (entities.length > 0 && !entities.includes('All')) {
        prevCountQuery = prevCountQuery.in('entity', entities);
      }

      // 타임아웃 방지를 위해 5초 제한
      const prevCountPromise = prevCountQuery;
      const prevTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Previous year count query timeout')), 5000)
      );

      const { count: prevInitialCount, error: prevCountError } = await Promise.race([
        prevCountPromise,
        prevTimeoutPromise
      ]).catch((err) => {
        console.warn(`⚠️ Summary API - Previous year count query timeout or error, proceeding without count:`, err);
        return { count: null, error: null }; // Count 없이 진행
      }) as any;
      
      if (prevCountError) {
        console.error('Previous year count query error:', prevCountError);
        // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
        prevTotalCount = 0;
        prevHasMore = false; // 데이터가 없으면 루프 진입하지 않음
      } else {
        prevTotalCount = prevInitialCount || 0;
        console.log(`📊 Previous year total records: ${prevTotalCount} (year: ${prevYear}, entities: ${entities.join(',')})`);
        // 데이터가 없으면 루프 진입하지 않음
        if (prevTotalCount === 0) {
          prevHasMore = false;
          console.log(`ℹ️ No previous year data found for year ${prevYear}`);
        }
      }

      // 이전 연도도 최대 100페이지로 제한
      let prevMaxPages = prevTotalCount > 0 ? Math.ceil(prevTotalCount / PAGE_SIZE) : 100;

      while (prevHasMore && prevTotalCount > 0 && prevPage < prevMaxPages) {
        const from = prevPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 각 페이지마다 새로운 쿼리 생성 (정렬 추가)
        // entity, year를 포함하여 정확한 집계 확인
        let prevQuery = supabase
          .from('sales_data')
          .select('entity, year, line_amount_mst, quantity', { count: 'exact', head: false })
          .eq('year', prevYear)
          .order('id', { ascending: true }); // 정렬 추가

        if (entities.length > 0 && !entities.includes('All')) {
          prevQuery = prevQuery.in('entity', entities);
        }

        prevQuery = prevQuery.range(from, to);

        const { data, error } = await prevQuery;
        
        if (error) {
          console.error('Previous year query error (page ' + prevPage + '):', error);
          // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
          break;
        }

        if (data && data.length > 0) {
          allPrevData = allPrevData.concat(data);
          prevPage++;
          
          // 더 가져올 데이터가 있는지 확인 (data.length가 PAGE_SIZE와 같으면 더 있음)
          prevHasMore = data.length === PAGE_SIZE;
          
          // 가져온 데이터가 전체 개수에 도달했는지 확인 (추가 안전장치)
          if (allPrevData.length >= prevTotalCount) {
            prevHasMore = false;
            console.log(`✅ All previous year data fetched: ${allPrevData.length} records (expected: ${prevTotalCount})`);
          }
        } else {
          prevHasMore = false;
        }
        
        // 안전장치: 무한 루프 방지 (최대 10000페이지 = 10,000,000 레코드)
        if (prevPage > 10000) {
          console.warn(`⚠️ Maximum page limit reached for previous year (10000 pages). Fetched ${allPrevData.length} records out of ${prevTotalCount}`);
          prevHasMore = false;
        }
      }
      
      // 최종 확인
      if (prevTotalCount > 0 && allPrevData.length < prevTotalCount) {
        console.warn(`⚠️ Warning: Fetched ${allPrevData.length} previous year records but expected ${prevTotalCount}. Missing ${prevTotalCount - allPrevData.length} records.`);
      }
    } catch (prevQueryError) {
      console.error('Previous year query error:', prevQueryError);
      // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
    }

    const prevData = allPrevData;

    // Calculate previous year totals
    // entity, year 필터가 정확히 적용되었는지 확인
    let prevTotalAmount = 0;
    let prevTotalQty = 0;
    let prevWrongEntityCount = 0;
    let prevWrongYearCount = 0;
    
    if (prevData && Array.isArray(prevData) && prevData.length > 0) {
      for (const row of prevData) {
        // entity와 year 검증
        if (entities.length > 0 && !entities.includes('All')) {
          if (!entities.includes(row.entity)) {
            prevWrongEntityCount++;
            console.warn(`⚠️ Previous year - Wrong entity found: ${row.entity} (expected: ${entities.join(', ')})`);
          }
        }
        if (row.year !== prevYear) {
          prevWrongYearCount++;
          console.warn(`⚠️ Previous year - Wrong year found: ${row.year} (expected: ${prevYear})`);
        }
        
        if (row.line_amount_mst !== null && row.line_amount_mst !== undefined) {
          const amount = Number(row.line_amount_mst);
          if (!isNaN(amount)) {
            prevTotalAmount += amount;
          }
        }
        
        if (row.quantity !== null && row.quantity !== undefined) {
          const qty = Number(row.quantity);
          if (!isNaN(qty)) {
            prevTotalQty += qty;
          }
        }
      }
      
      // 검증 결과 로그
      if (prevWrongEntityCount > 0 || prevWrongYearCount > 0) {
        console.error(`❌ Previous year data validation failed:`, {
          prevYear,
          prevWrongEntityCount,
          prevWrongYearCount,
          prevTotalRecords: prevData.length
        });
      }
      
      console.log(`✅ Previous year calculation complete:`, {
        prevYear,
        prevTotalAmount,
        prevTotalRecords: prevData.length
      });
    } else {
      // 이전 연도 데이터가 없으면 0으로 설정
      console.log(`ℹ️ No previous year data available for year ${prevYear}, setting amounts to 0`);
      prevTotalAmount = 0;
      prevTotalQty = 0;
    }

    // Calculate percentage change
    // (totalAmount - prevTotalAmount) / prevTotalAmount * 100
    // totalAmount가 증가하면 양수, 감소하면 음수
    const amountChange = prevTotalAmount > 0 
      ? ((totalAmount - prevTotalAmount) / prevTotalAmount) * 100 
      : 0;
    
    // 디버깅: 현재 연도와 이전 연도 비교
    if (totalAmount === prevTotalAmount && prevTotalAmount > 0) {
      console.error(`❌ ERROR: Current year (${yearInt}) and previous year (${prevYear}) amounts are identical!`, {
        currentYear: yearInt,
        previousYear: prevYear,
        currentAmount: totalAmount,
        previousAmount: prevTotalAmount,
        currentRecords: data.length,
        previousRecords: prevData.length
      });
    } else {
      console.log(`📊 Year comparison:`, {
        currentYear: yearInt,
        previousYear: prevYear,
        currentAmount: totalAmount,
        previousAmount: prevTotalAmount,
        amountChange: amountChange.toFixed(2) + '%',
        currentRecords: data.length,
        previousRecords: prevData.length
      });
    }
    const qtyChange = prevTotalQty > 0 
      ? ((totalQty - prevTotalQty) / prevTotalQty) * 100 
      : 0;

    // 응답에 디버깅 정보 포함 (개발 환경에서만)
    const response: any = {
      totalAmount,
      totalQty,
      avgAmount,
      totalTransactions,
      prevTotalAmount, // 직전 연도 매출액 추가
      prevTotalQty, // 직전 연도 수량 추가
      comparison: {
        amount: amountChange,
        qty: qtyChange,
      },
    };

    // 디버깅 정보 추가
    if (process.env.NODE_ENV === 'development') {
      response._debug = {
        year: yearInt,
        entities,
        dataRows: data.length,
        totalCount: totalCount,
        pages: page,
        nullCount,
        zeroCount,
        calculatedTotal: totalAmount,
        calculatedTotalFormatted: totalAmount.toLocaleString(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    // searchParams는 try 블록 밖에서 접근할 수 없으므로 request에서 다시 가져옴
    const errorSearchParams = request.nextUrl.searchParams;
    console.error('❌ Summary API - Unexpected error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name,
      year: errorSearchParams.get('year'),
      entities: errorSearchParams.get('entities')
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard summary', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
