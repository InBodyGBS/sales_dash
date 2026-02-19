-- ============================================
-- InBody Group Dashboard Functions (with KRW conversion)
-- ============================================

-- 1. Entity-Currency 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS entity_currency (
    entity VARCHAR(50) PRIMARY KEY,
    currency VARCHAR(10) NOT NULL
);

-- 초기 데이터 삽입
INSERT INTO entity_currency (entity, currency) VALUES
('HQ', 'KRW'),
('Korot', 'KRW'),
('Healthcare', 'KRW'),
('USA', 'USD'),
('Japan', 'JPY'),
('China', 'CNH'),
('Vietnam', 'VND'),
('India', 'INR'),
('Mexico', 'MXN'),
('BWA', 'USD'),
('Oceania', 'AUD'),
('Singapore', 'SGD'),
('Asia', 'MYR'),
('Europe', 'EUR'),
('Netherlands', 'EUR'),
('Germany', 'EUR'),
('UK', 'EUR')
ON CONFLICT (entity) DO UPDATE SET currency = EXCLUDED.currency;

-- 권한 부여
GRANT SELECT ON entity_currency TO authenticated, anon, service_role;

-- ============================================
-- 2. InBody Group 대시보드 요약 함수
-- ============================================
DROP FUNCTION IF EXISTS get_inbody_group_summary CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_summary(
    p_year INTEGER,
    p_prev_year INTEGER DEFAULT NULL,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH filtered_data AS (
        SELECT 
            s.entity,
            s.year,
            s.quarter,
            s.total_amount,
            s.row_count,
            -- Amount(KRW) 계산: HQ, Korot, Healthcare는 그대로, 나머지는 환율 적용
            CASE 
                WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
                ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
            END as amount_krw
        FROM mv_sales_cube s
        LEFT JOIN entity_currency ec ON s.entity = ec.entity
        LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
        WHERE (s.channel IS NULL OR s.channel != 'Inter-Company')
          AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
    ),
    current_year_stats AS (
        SELECT 
            COALESCE(SUM(row_count), 0) as total_records,
            COALESCE(SUM(amount_krw), 0) as total_amount_krw
        FROM filtered_data
        WHERE year = p_year
    ),
    prev_year_stats AS (
        SELECT 
            COALESCE(SUM(row_count), 0) as total_records,
            COALESCE(SUM(amount_krw), 0) as total_amount_krw
        FROM filtered_data
        WHERE year = p_prev_year
            AND p_prev_year IS NOT NULL
    )
    SELECT json_build_object(
        'current_year', json_build_object(
            'year', p_year,
            'total_records', c.total_records,
            'total_amount_krw', c.total_amount_krw
        ),
        'previous_year', CASE 
            WHEN p_prev_year IS NOT NULL THEN json_build_object(
                'year', p_prev_year,
                'total_records', COALESCE(p.total_records, 0),
                'total_amount_krw', COALESCE(p.total_amount_krw, 0)
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

GRANT EXECUTE ON FUNCTION get_inbody_group_summary(INTEGER, INTEGER, TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 3. InBody Group 월별 추이 (KRW)
-- ============================================
DROP FUNCTION IF EXISTS get_inbody_group_monthly_trend CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_monthly_trend(
    p_year INTEGER,
    p_prev_year INTEGER DEFAULT NULL,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(monthly_result ORDER BY month)
        FROM (
            SELECT 
                COALESCE(c.month, p.month) as month,
                COALESCE(c.total_amount_krw, 0) as amount,
                COALESCE(c.total_quantity, 0) as quantity,
                COALESCE(p.total_amount_krw, 0) as prev_amount,
                COALESCE(p.total_quantity, 0) as prev_quantity
            FROM (
                SELECT 
                    month,
                    SUM(
                        CASE 
                            WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN total_amount
                            ELSE ROUND(total_amount * COALESCE(e.rate, 1))
                        END
                    ) as total_amount_krw,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube s
                LEFT JOIN entity_currency ec ON s.entity = ec.entity
                LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
                WHERE s.year = p_year
                    AND s.month IS NOT NULL
                    AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                    AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
                GROUP BY month
            ) c
            FULL OUTER JOIN (
                SELECT 
                    month,
                    SUM(
                        CASE 
                            WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN total_amount
                            ELSE ROUND(total_amount * COALESCE(e.rate, 1))
                        END
                    ) as total_amount_krw,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube s
                LEFT JOIN entity_currency ec ON s.entity = ec.entity
                LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
                WHERE s.year = p_prev_year
                    AND s.month IS NOT NULL
                    AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                    AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
                    AND p_prev_year IS NOT NULL
                GROUP BY month
            ) p ON c.month = p.month
        ) monthly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_monthly_trend(INTEGER, INTEGER, TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 4. InBody Group 분기별 비교 (KRW)
-- ============================================
CREATE OR REPLACE FUNCTION get_inbody_group_quarterly(
    p_year INTEGER,
    p_prev_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(quarterly_result ORDER BY quarter)
        FROM (
            SELECT 
                COALESCE(c.quarter, p.quarter) as quarter,
                COALESCE(c.total_amount_krw, 0) as current_amount,
                COALESCE(c.total_quantity, 0) as current_quantity,
                COALESCE(p.total_amount_krw, 0) as previous_amount,
                COALESCE(p.total_quantity, 0) as previous_quantity
            FROM (
                SELECT 
                    quarter,
                    SUM(
                        CASE 
                            WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN total_amount
                            ELSE ROUND(total_amount * COALESCE(e.rate, 1))
                        END
                    ) as total_amount_krw,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube s
                LEFT JOIN entity_currency ec ON s.entity = ec.entity
                LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
                WHERE s.year = p_year
                    AND s.quarter IS NOT NULL
                    AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                GROUP BY quarter
            ) c
            FULL OUTER JOIN (
                SELECT 
                    quarter,
                    SUM(
                        CASE 
                            WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN total_amount
                            ELSE ROUND(total_amount * COALESCE(e.rate, 1))
                        END
                    ) as total_amount_krw,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube s
                LEFT JOIN entity_currency ec ON s.entity = ec.entity
                LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
                WHERE s.year = p_prev_year
                    AND s.quarter IS NOT NULL
                    AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                    AND p_prev_year IS NOT NULL
                GROUP BY quarter
            ) p ON c.quarter = p.quarter
        ) quarterly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_quarterly TO authenticated, anon, service_role;

-- ============================================
-- 5. InBody Group Entity별 매출 (KRW)
-- ============================================
DROP FUNCTION IF EXISTS get_inbody_group_entity_sales CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_entity_sales(
    p_year INTEGER,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'entity', entity,
            'amount', total_amount_krw,
            'quantity', total_quantity
        ) ORDER BY total_amount_krw DESC)
        FROM (
            SELECT 
                s.entity,
                SUM(
                    CASE 
                        WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN total_amount
                        ELSE ROUND(total_amount * COALESCE(e.rate, 1))
                    END
                ) as total_amount_krw,
                SUM(total_quantity) as total_quantity
            FROM mv_sales_cube s
            LEFT JOIN entity_currency ec ON s.entity = ec.entity
            LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
            WHERE s.year = p_year
                AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
            GROUP BY s.entity
        ) entity_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_entity_sales(INTEGER, TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 6. InBody Group 상위 제품 (KRW)
-- ============================================
DROP FUNCTION IF EXISTS get_inbody_group_top_products CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_top_products(
    p_year INTEGER,
    p_limit INTEGER DEFAULT 10,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(product_data)
        FROM (
            SELECT 
                CASE WHEN s.product = '__null__' THEN 'Unknown' ELSE s.product END as product,
                CASE WHEN s.category = '__null__' THEN 'Unknown' ELSE s.category END as category,
                CASE WHEN s.fg_classification = '__null__' THEN 'Unknown' ELSE s.fg_classification END as fg_classification,
                COALESCE(SUM(
                    CASE 
                        WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
                        ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
                    END
                ), 0) as amount,
                COALESCE(SUM(s.total_quantity), 0) as quantity,
                COALESCE(SUM(s.row_count), 0) as transactions
            FROM mv_sales_cube s
            LEFT JOIN entity_currency ec ON s.entity = ec.entity
            LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
            WHERE s.year = p_year
                AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                AND s.fg_classification = 'FG'
                AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
            GROUP BY s.product, s.category, s.fg_classification
            ORDER BY COALESCE(SUM(
                CASE 
                    WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
                    ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
                END
            ), 0) DESC
            LIMIT p_limit
        ) product_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_top_products(INTEGER, INTEGER, TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 7. InBody Group 산업별 분석 (KRW)
-- ============================================
-- Drop all overloaded versions of this function
DROP FUNCTION IF EXISTS get_inbody_group_industry CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_industry(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'industry', industry,
            'amount', total_amount_krw,
            'quantity', total_quantity
        ) ORDER BY total_amount_krw DESC)
        FROM (
            SELECT 
                CASE WHEN s.industry = '__null__' THEN 'Unknown' ELSE s.industry END as industry,
                SUM(
                    CASE 
                        WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
                        ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
                    END
                ) as total_amount_krw,
                SUM(s.total_quantity) as total_quantity
            FROM mv_sales_cube s
            LEFT JOIN entity_currency ec ON s.entity = ec.entity
            LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
            WHERE s.year = p_year
                AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                AND (p_entities IS NULL OR s.entity = ANY(p_entities))
                AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
            GROUP BY s.industry
        ) industry_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_industry(INTEGER, TEXT[], TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 8. InBody Group FG Classification 분포 (KRW)
-- ============================================
DROP FUNCTION IF EXISTS get_inbody_group_fg_distribution CASCADE;

CREATE OR REPLACE FUNCTION get_inbody_group_fg_distribution(
    p_year INTEGER,
    p_quarter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'fg_classification', fg_classification,
            'amount', total_amount_krw,
            'quantity', total_quantity
        ) ORDER BY total_amount_krw DESC)
        FROM (
            SELECT 
                CASE WHEN s.fg_classification = '__null__' THEN 'Unknown' ELSE s.fg_classification END as fg_classification,
                SUM(
                    CASE 
                        WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
                        ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
                    END
                ) as total_amount_krw,
                SUM(s.total_quantity) as total_quantity
            FROM mv_sales_cube s
            LEFT JOIN entity_currency ec ON s.entity = ec.entity
            LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
            WHERE s.year = p_year
                AND (s.channel IS NULL OR s.channel != 'Inter-Company')
                AND (p_quarter IS NULL OR p_quarter = 'All' OR s.quarter = p_quarter)
            GROUP BY s.fg_classification
        ) fg_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_inbody_group_fg_distribution(INTEGER, TEXT) TO authenticated, anon, service_role;

-- ============================================
-- 9. InBody Group 국가별 매출 (KRW) - DISABLED
-- country 컬럼이 mv_sales_cube에 없음
-- ============================================
-- CREATE OR REPLACE FUNCTION get_inbody_group_country_sales(
--     p_year INTEGER
-- )
-- RETURNS JSON AS $$
-- BEGIN
--     RETURN (
--         SELECT json_agg(json_build_object(
--             'country', country,
--             'amount', total_amount_krw,
--             'quantity', total_quantity
--         ) ORDER BY total_amount_krw DESC)
--         FROM (
--             SELECT 
--                 CASE WHEN s.country = '__null__' THEN 'Unknown' ELSE s.country END as country,
--                 SUM(
--                     CASE 
--                         WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
--                         ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
--                     END
--                 ) as total_amount_krw,
--                 SUM(s.total_quantity) as total_quantity
--             FROM mv_sales_cube s
--             LEFT JOIN entity_currency ec ON s.entity = ec.entity
--             LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
--             WHERE s.year = p_year
--                 AND (s.channel IS NULL OR s.channel != 'Inter-Company')
--             GROUP BY s.country
--         ) country_data
--     );
-- END;
-- $$ LANGUAGE plpgsql STABLE;

-- GRANT EXECUTE ON FUNCTION get_inbody_group_country_sales TO authenticated, anon, service_role;

-- ============================================
-- 테스트 쿼리
-- ============================================
-- 요약 정보
SELECT get_inbody_group_summary(2025, 2024);

-- 월별 추이
SELECT get_inbody_group_monthly_trend(2025, 2024);

-- 분기별 비교
SELECT get_inbody_group_quarterly(2025, 2024);

-- Entity별 매출
SELECT get_inbody_group_entity_sales(2025);

-- 상위 제품
SELECT get_inbody_group_top_products(2025, 10);

-- 산업별 분석
SELECT get_inbody_group_industry(2025);

-- FG 분포
SELECT get_inbody_group_fg_distribution(2025);

-- 국가별 매출 (DISABLED - country 컬럼 없음)
-- SELECT get_inbody_group_country_sales(2025);

