-- Fix duplicate get_inbody_group_industry function issue
-- This script drops all versions of the function and recreates it

-- 1. First, check what functions exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inbody_group_industry'
ORDER BY p.proname, pg_get_function_arguments(p.oid);

-- 2. Drop all versions of the function (CASCADE removes dependencies)
DROP FUNCTION IF EXISTS get_inbody_group_industry CASCADE;

-- 3. Recreate the function
CREATE OR REPLACE FUNCTION get_inbody_group_industry(
    p_year INTEGER,
    p_entities TEXT[] DEFAULT NULL
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
            GROUP BY s.industry
        ) industry_data
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_inbody_group_industry(INTEGER, TEXT[]) TO authenticated, anon, service_role;

-- 5. Verify the function was created correctly
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_inbody_group_industry'
ORDER BY p.proname, pg_get_function_arguments(p.oid);

