-- Fix get_quarterly_comparison function to include all 4 quarters and both current and previous year data

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
            -- Generate all 4 quarters and join with both current and previous year data
            SELECT 
                q.quarter,
                COALESCE(c.total_amount, 0) as current_amount,
                COALESCE(c.total_quantity, 0) as current_quantity,
                COALESCE(p.total_amount, 0) as previous_amount,
                COALESCE(p.total_quantity, 0) as previous_quantity
            FROM (VALUES ('Q1'), ('Q2'), ('Q3'), ('Q4')) AS q(quarter)
            LEFT JOIN (
                SELECT 
                    quarter,
                    SUM(total_amount) as total_amount,
                    SUM(total_quantity) as total_quantity
                FROM mv_sales_cube
                WHERE year = p_year
                    AND quarter IS NOT NULL
                    AND (p_entities IS NULL OR entity = ANY(p_entities))
                GROUP BY quarter
            ) c ON q.quarter = c.quarter
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
            ) p ON q.quarter = p.quarter
        ) quarterly_result
    );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_quarterly_comparison TO authenticated, anon, service_role;
