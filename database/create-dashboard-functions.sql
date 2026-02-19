-- ============================================
-- Dashboard Aggregate Functions for mv_sales_cube
-- 모든 함수가 mv_sales_cube를 사용하도록 수정됨
-- ============================================

-- ============================================
-- 1. get_distinct_entities - 엔티티 목록 조회
-- ============================================
DROP FUNCTION IF EXISTS get_distinct_entities();

CREATE OR REPLACE FUNCTION get_distinct_entities()
RETURNS TABLE(entity TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT mv_sales_cube.entity::TEXT
  FROM mv_sales_cube
  WHERE mv_sales_cube.entity IS NOT NULL
  ORDER BY mv_sales_cube.entity::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_distinct_entities() TO authenticated, anon, service_role;

-- ============================================
-- 2. get_distinct_years - 연도 목록 조회
-- ============================================
DROP FUNCTION IF EXISTS get_distinct_years(TEXT);

CREATE OR REPLACE FUNCTION get_distinct_years(entity_name TEXT DEFAULT NULL)
RETURNS TABLE(year INTEGER) AS $$
BEGIN
  IF entity_name IS NULL OR entity_name = 'All' THEN
    RETURN QUERY
    SELECT DISTINCT mv_sales_cube.year
    FROM mv_sales_cube
    WHERE mv_sales_cube.year IS NOT NULL
    ORDER BY mv_sales_cube.year DESC;
  ELSE
    RETURN QUERY
    SELECT DISTINCT mv_sales_cube.year
    FROM mv_sales_cube
    WHERE mv_sales_cube.entity = entity_name
      AND mv_sales_cube.year IS NOT NULL
    ORDER BY mv_sales_cube.year DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_distinct_years TO authenticated, anon, service_role;

-- ============================================
-- 3. get_dashboard_summary - 대시보드 요약 통계
-- ============================================
DROP FUNCTION IF EXISTS get_dashboard_summary(INTEGER, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_prev_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH current_year_stats AS (
        SELECT 
            COALESCE(SUM(row_count), 0) as total_records,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(total_quantity), 0) as total_quantity
        FROM mv_sales_cube
        WHERE year = p_year
            AND (p_entities IS NULL OR entity = ANY(p_entities))
    ),
    prev_year_stats AS (
        SELECT 
            COALESCE(SUM(row_count), 0) as total_records,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(total_quantity), 0) as total_quantity
        FROM mv_sales_cube
        WHERE year = p_prev_year
            AND (p_entities IS NULL OR entity = ANY(p_entities))
            AND p_prev_year IS NOT NULL
    )
    SELECT json_build_object(
        'current_year', json_build_object(
            'year', p_year,
            'total_records', c.total_records,
            'total_amount', c.total_amount,
            'total_quantity', c.total_quantity
        ),
        'previous_year', CASE 
            WHEN p_prev_year IS NOT NULL THEN json_build_object(
                'year', p_prev_year,
                'total_records', COALESCE(p.total_records, 0),
                'total_amount', COALESCE(p.total_amount, 0),
                'total_quantity', COALESCE(p.total_quantity, 0)
            )
            ELSE NULL
        END
    )
    INTO v_result
    FROM current_year_stats c
    LEFT JOIN prev_year_stats p ON TRUE;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_dashboard_summary TO authenticated, anon, service_role;

-- ============================================
-- 4. get_monthly_trend - 월별 추이
-- ============================================
DROP FUNCTION IF EXISTS get_monthly_trend(INTEGER, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION get_monthly_trend(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_prev_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(monthly_result ORDER BY month)
        FROM (
            SELECT 
                c.month,
                COALESCE(c.total_amount, 0) as amount,
                COALESCE(c.total_quantity, 0) as quantity,
                COALESCE(p.total_amount, 0) as prev_amount,
                COALESCE(p.total_quantity, 0) as prev_quantity
            FROM (
                SELECT 
                    month,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_year
                    AND month IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                GROUP BY month
            ) c
            LEFT JOIN (
                SELECT 
                    month,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_prev_year
                    AND month IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                    AND p_prev_year IS NOT NULL
                GROUP BY month
            ) p ON c.month = p.month
        ) monthly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_monthly_trend TO authenticated, anon, service_role;

-- ============================================
-- 5. get_quarterly_comparison - 분기별 비교
-- ============================================
DROP FUNCTION IF EXISTS get_quarterly_comparison(INTEGER, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION get_quarterly_comparison(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_prev_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(quarterly_result ORDER BY quarter)
        FROM (
            SELECT 
                c.quarter,
                COALESCE(c.total_amount, 0) as current_amount,
                COALESCE(c.total_quantity, 0) as current_quantity,
                COALESCE(p.total_amount, 0) as previous_amount,
                COALESCE(p.total_quantity, 0) as previous_quantity
            FROM (
                SELECT 
                    quarter,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_year
                    AND quarter IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                GROUP BY quarter
            ) c
            LEFT JOIN (
                SELECT 
                    quarter,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_prev_year
                    AND quarter IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                    AND p_prev_year IS NOT NULL
                GROUP BY quarter
            ) p ON c.quarter = p.quarter
        ) quarterly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_quarterly_comparison TO authenticated, anon, service_role;

-- ============================================
-- 6. get_channel_sales - 채널별 매출
-- ============================================
DROP FUNCTION IF EXISTS get_channel_sales CASCADE;

CREATE OR REPLACE FUNCTION get_channel_sales(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_quarter TEXT DEFAULT NULL
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
            GROUP BY channel
        ) channel_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_channel_sales TO authenticated, anon, service_role;

-- ============================================
-- 7. get_industry_breakdown - 산업별 분석
-- ============================================
DROP FUNCTION IF EXISTS get_industry_breakdown(INTEGER, TEXT[]);

CREATE OR REPLACE FUNCTION get_industry_breakdown(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'industry', industry,
            'amount', total_amount,
            'quantity', total_quantity,
            'transactions', total_records
        ) ORDER BY total_amount DESC)
        FROM (
            SELECT 
                CASE WHEN industry = '__null__' THEN 'Unknown' ELSE industry END as industry,
                SUM(total_amount) as total_amount,
                SUM(total_quantity) as total_quantity,
                SUM(row_count) as total_records
            FROM mv_sales_cube
            WHERE year = p_year
                AND (p_entities IS NULL OR entity = ANY(p_entities))
            GROUP BY industry
        ) industry_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_industry_breakdown TO authenticated, anon, service_role;

-- ============================================
-- 8. get_top_products - 상위 제품
-- ============================================
DROP FUNCTION IF EXISTS get_top_products(INTEGER, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION get_top_products(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(product_data)
        FROM (
            SELECT 
                CASE WHEN product = '__null__' THEN 'Unknown' ELSE product END as product,
                CASE WHEN category = '__null__' THEN 'Unknown' ELSE category END as category,
                CASE WHEN fg_classification = '__null__' THEN 'Unknown' ELSE fg_classification END as fg_classification,
                COALESCE(SUM(total_amount), 0) as amount,
                COALESCE(SUM(total_quantity), 0) as quantity,
                COALESCE(SUM(row_count), 0) as transactions
            FROM mv_sales_cube
            WHERE year = p_year
                AND (p_entities IS NULL OR entity = ANY(p_entities))
                AND fg_classification = 'FG'
            GROUP BY product, category, fg_classification
            ORDER BY COALESCE(SUM(total_amount), 0) DESC
            LIMIT p_limit
        ) product_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_top_products TO authenticated, anon, service_role;

-- ============================================
-- 테스트 쿼리
-- ============================================

-- 엔티티 목록
SELECT * FROM get_distinct_entities();

-- 연도 목록
SELECT * FROM get_distinct_years('HQ');
SELECT * FROM get_distinct_years(NULL);

-- 대시보드 요약 (HQ, 2025년 vs 2024년)
SELECT get_dashboard_summary(2025, ARRAY['HQ'], 2024);

-- 월별 추이 (Japan, 2026년 vs 2025년)
SELECT get_monthly_trend(2026, ARRAY['Japan'], 2025);

-- 분기별 비교 (USA, 2026년 vs 2025년)
SELECT get_quarterly_comparison(2026, ARRAY['USA'], 2025);

-- 채널별 매출 (China, 2026년)
SELECT get_channel_sales(2026, ARRAY['China']);

-- 산업별 분석 (USA, 2026년)
SELECT get_industry_breakdown(2026, ARRAY['USA']);

-- 상위 제품 (Japan, 2026년, Top 5)
SELECT get_top_products(2026, ARRAY['Japan'], 5);
