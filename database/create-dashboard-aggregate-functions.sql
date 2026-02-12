-- Create PostgreSQL aggregate functions for dashboard
-- This eliminates the need to fetch all rows and aggregate in JavaScript

-- 1. Get summary statistics (total amount, quantity, counts)
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
            COUNT(*) as total_records,
            COALESCE(SUM(line_amount_mst), 0) as total_amount,
            COALESCE(SUM(quantity), 0) as total_quantity,
            COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_amount_count,
            COUNT(CASE WHEN line_amount_mst = 0 THEN 1 END) as zero_amount_count
        FROM mv_sales_cube
        WHERE year = p_year
            AND (p_entities IS NULL OR entity = ANY(p_entities))
    ),
    prev_year_stats AS (
        SELECT 
            COUNT(*) as total_records,
            COALESCE(SUM(line_amount_mst), 0) as total_amount,
            COALESCE(SUM(quantity), 0) as total_quantity
        FROM mv_sales_cube
        WHERE year = p_prev_year
            AND (p_entities IS NULL OR entity = ANY(p_entities))
            AND p_prev_year IS NOT NULL
    )
    SELECT json_build_object(
        'current_year', json_build_object(
            'total_records', c.total_records,
            'total_amount', c.total_amount,
            'total_quantity', c.total_quantity,
            'null_amount_count', c.null_amount_count,
            'zero_amount_count', c.zero_amount_count
        ),
        'previous_year', CASE 
            WHEN p_prev_year IS NOT NULL THEN json_build_object(
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

-- 2. Get monthly trend data
CREATE OR REPLACE FUNCTION get_monthly_trend(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(json_build_object(
            'month', month,
            'amount', total_amount,
            'quantity', total_quantity
        ) ORDER BY month)
        FROM (
            SELECT 
                EXTRACT(MONTH FROM invoice_date)::INTEGER as month,
                COALESCE(SUM(line_amount_mst), 0) as total_amount,
                COALESCE(SUM(quantity), 0) as total_quantity
            FROM mv_sales_cube
            WHERE year = p_year
                AND invoice_date IS NOT NULL
                AND (p_entities IS NULL OR entity = ANY(p_entities))
            GROUP BY EXTRACT(MONTH FROM invoice_date)
        ) monthly_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Get quarterly comparison data
CREATE OR REPLACE FUNCTION get_quarterly_comparison(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL,
    p_prev_year INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_object_agg(
            'Q' || quarter,
            json_build_object(
                'current_amount', current_amount,
                'previous_amount', COALESCE(previous_amount, 0),
                'current_quantity', current_quantity,
                'previous_quantity', COALESCE(previous_quantity, 0)
            )
        )
        FROM (
            SELECT 
                c.quarter,
                c.total_amount as current_amount,
                c.total_quantity as current_quantity,
                p.total_amount as previous_amount,
                p.total_quantity as previous_quantity
            FROM (
                SELECT 
                    quarter,
                    COALESCE(SUM(line_amount_mst), 0) as total_amount,
                    COALESCE(SUM(quantity), 0) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_year
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                GROUP BY quarter
            ) c
            LEFT JOIN (
                SELECT 
                    quarter,
                    COALESCE(SUM(line_amount_mst), 0) as total_amount,
                    COALESCE(SUM(quantity), 0) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_prev_year
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                    AND p_prev_year IS NOT NULL
                GROUP BY quarter
            ) p ON c.quarter = p.quarter
        ) quarterly_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_summary TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_monthly_trend TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_quarterly_comparison TO authenticated, anon, service_role;

-- Test queries
-- Summary for USA 2026 vs 2025
SELECT get_dashboard_summary(2026, ARRAY['USA'], 2025);

-- Monthly trend for USA 2026
SELECT get_monthly_trend(2026, ARRAY['USA']);

-- Quarterly comparison for USA 2026 vs 2025
SELECT get_quarterly_comparison(2026, ARRAY['USA'], 2025);

