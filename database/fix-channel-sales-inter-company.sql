-- ============================================
-- Fix get_channel_sales function to include Inter-Company channel
-- Entity별 dashboard에서 Inter-Company 채널 데이터도 조회되도록 수정
-- 
-- 참고: Group Dashboard (get_inbody_group_*) 함수들은 Inter-Company 필터를 유지합니다.
--       Group Dashboard에서는 Inter-Company를 제외하는 것이 의도된 동작입니다.
-- ============================================

DROP FUNCTION IF EXISTS get_channel_sales(INTEGER, TEXT[], TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_channel_sales(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_quarter TEXT DEFAULT NULL,
    p_month INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'channel', channel,
            'amount', total_amount,
            'quantity', total_quantity,
            'transactions', total_records
        ) ORDER BY total_amount DESC)
        FROM (
            SELECT 
                CASE WHEN channel = '__null__' THEN 'Unknown' ELSE channel END as channel,
                SUM(total_amount) as total_amount,
                SUM(total_quantity) as total_quantity,
                SUM(row_count) as total_records
            FROM mv_sales_cube
            WHERE year = p_year
                AND (p_entities IS NULL OR entity = ANY(p_entities))
                AND (p_quarter IS NULL OR p_quarter = 'All' OR quarter = p_quarter)
                AND (p_month IS NULL OR month = p_month)
                -- Inter-Company 필터 제거: entity별 dashboard에서는 Inter-Company도 포함
                -- Group Dashboard (get_inbody_group_channel_sales)는 Inter-Company 필터를 유지
            GROUP BY channel
        ) channel_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_channel_sales(INTEGER, TEXT[], TEXT, INTEGER) TO authenticated, anon, service_role;

-- ============================================
-- 확인: 다른 entity별 dashboard 함수들은 Inter-Company 필터가 없습니다:
-- - get_dashboard_summary: Inter-Company 필터 없음 ✓
-- - get_monthly_trend: Inter-Company 필터 없음 ✓
-- - get_quarterly_comparison: Inter-Company 필터 없음 ✓
-- - get_industry_breakdown: Inter-Company 필터 없음 ✓
-- - get_top_products: Inter-Company 필터 없음 ✓
-- ============================================
