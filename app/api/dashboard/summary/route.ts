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

    const supabase = await createServiceClient();
    const yearInt = parseInt(year);

    // Total Amount = 연도별 Line Amount_MST의 합계
    // 모든 페이지를 반복해서 가져와서 전체 합계 계산
    
    // 모든 데이터를 가져오기 위해 페이지네이션 처리
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 각 페이지마다 새로운 쿼리 생성
        let query = supabase
          .from('sales_data')
          .select('line_amount_mst, quantity', { count: 'exact', head: false })
          .eq('year', yearInt);

        // Filter by entities
        if (entities.length > 0 && !entities.includes('All')) {
          query = query.in('entity', entities);
        }

        // range 적용
        query = query.range(from, to);

        const { data, error, count } = await query;
        
        if (error) {
          console.error('Database error (page ' + page + '):', error);
          throw new Error(`Database query failed: ${error.message}`);
        }

        if (count !== null && totalCount === 0) {
          totalCount = count;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          hasMore = data.length === PAGE_SIZE; // 더 가져올 데이터가 있는지 확인
        } else {
          hasMore = false;
        }
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
      DB에서_가져온_행수: data.length,
      null_line_amount_mst_개수: nullCount,
      zero_line_amount_mst_개수: zeroCount,
      계산된_Total_Amount: totalAmount,
      계산된_Total_Amount_포맷: totalAmount.toLocaleString(),
      샘플_데이터_타입: typeof data[0]?.line_amount_mst,
      샘플_값: data.slice(0, 3).map(r => ({
        line_amount_mst: r.line_amount_mst,
        타입: typeof r.line_amount_mst,
        변환된값: Number(r.line_amount_mst)
      }))
    });
    
    console.log(`✅ Total Amount 계산 완료: ${totalAmount.toLocaleString()} (${data.length}개 행)`);

    // Get previous period data for comparison - 모든 페이지 가져오기
    const prevYear = yearInt - 1;
    let allPrevData: any[] = [];
    let prevPage = 0;
    let prevHasMore = true;

    try {
      while (prevHasMore) {
        const from = prevPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        // 각 페이지마다 새로운 쿼리 생성
        let prevQuery = supabase
          .from('sales_data')
          .select('line_amount_mst, quantity', { count: 'exact', head: false })
          .eq('year', prevYear);

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
          prevHasMore = data.length === PAGE_SIZE;
        } else {
          prevHasMore = false;
        }
      }
    } catch (prevQueryError) {
      console.error('Previous year query error:', prevQueryError);
      // 이전 연도 데이터는 필수가 아니므로 에러가 나도 계속 진행
    }

    const prevData = allPrevData;

    // Calculate previous year totals
    let prevTotalAmount = 0;
    let prevTotalQty = 0;
    
    if (prevData && Array.isArray(prevData) && prevData.length > 0) {
      for (const row of prevData) {
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
    }

    // Calculate percentage change
    // (totalAmount - prevTotalAmount) / prevTotalAmount * 100
    // totalAmount가 증가하면 양수, 감소하면 음수
    const amountChange = prevTotalAmount > 0 
      ? ((totalAmount - prevTotalAmount) / prevTotalAmount) * 100 
      : 0;
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
    console.error('Dashboard summary API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
    });
    
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
