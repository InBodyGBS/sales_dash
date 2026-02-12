-- Create a PostgreSQL function to get distinct years efficiently
-- This is much faster than fetching all rows and extracting years in JavaScript

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_distinct_years TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_years TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_years TO service_role;

-- Test the function
SELECT * FROM get_distinct_years('USA');
SELECT * FROM get_distinct_years('HQ');
SELECT * FROM get_distinct_years(NULL); -- All entities

