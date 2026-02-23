-- Fix get_monthly_trend function to include all 12 months and both current and previous year data
-- This ensures that when viewing 2026, the 2025 comparison data is also shown

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
            -- Generate all 12 months and join with both current and previous year data
            SELECT 
                m.month,
                COALESCE(c.total_amount, 0) as amount,
                COALESCE(c.total_quantity, 0) as quantity,
                COALESCE(p.total_amount, 0) as prev_amount,
                COALESCE(p.total_quantity, 0) as prev_quantity
            FROM generate_series(1, 12) AS m(month)
            LEFT JOIN (
                SELECT 
                    month,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_year
                    AND month IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                GROUP BY month
            ) c ON m.month = c.month
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
            ) p ON m.month = p.month
        ) monthly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_monthly_trend TO authenticated, anon, service_role;
