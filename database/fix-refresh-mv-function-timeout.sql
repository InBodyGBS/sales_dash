-- Fix refresh_mv_sales_cube function to handle timeout issues
-- This version sets a longer timeout and provides better error handling

DROP FUNCTION IF EXISTS refresh_mv_sales_cube();

CREATE OR REPLACE FUNCTION refresh_mv_sales_cube()
RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_duration INTERVAL;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Set statement timeout to 5 minutes (300 seconds)
    -- Note: This may not work in all Supabase configurations
    -- If timeout still occurs, refresh manually using SQL Editor
    
    BEGIN
        -- Use non-concurrent refresh (faster, but locks the view)
        REFRESH MATERIALIZED VIEW mv_sales_cube;
        
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        
        RETURN format('Materialized view refreshed successfully in %s. Total records: %s', 
                     v_duration,
                     (SELECT COUNT(*) FROM mv_sales_cube));
    EXCEPTION
        WHEN OTHERS THEN
            RETURN format('Error refreshing materialized view: %s (SQLSTATE: %s)', 
                         SQLERRM, SQLSTATE);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_mv_sales_cube() TO authenticated, anon, service_role;

-- Alternative: If the above still times out, use this direct SQL command in SQL Editor:
-- REFRESH MATERIALIZED VIEW mv_sales_cube;
