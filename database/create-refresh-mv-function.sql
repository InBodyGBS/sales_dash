-- Create RPC function to refresh mv_sales_cube materialized view
-- This allows the application to refresh the view without direct SQL access
-- Note: Using non-concurrent refresh to avoid timeout issues

CREATE OR REPLACE FUNCTION refresh_mv_sales_cube()
RETURNS TEXT AS $$
BEGIN
  -- Use non-concurrent refresh to avoid timeout and index requirements
  -- This will lock the view during refresh but is faster
  REFRESH MATERIALIZED VIEW mv_sales_cube;
  RETURN 'Materialized view mv_sales_cube refreshed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error refreshing materialized view: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_mv_sales_cube() TO authenticated, anon, service_role;

-- Alternative: If you need concurrent refresh, ensure unique index exists first:
-- CREATE UNIQUE INDEX IF NOT EXISTS mv_sales_cube_unique_idx ON mv_sales_cube (entity, year, month, quarter, channel, product, country, industry, fg_classification);
