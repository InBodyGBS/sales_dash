-- Create a PostgreSQL function to get distinct entities efficiently
-- This is much faster than fetching all rows and extracting entities in JavaScript

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_distinct_entities() TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_entities() TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_entities() TO service_role;

-- Test the function
SELECT * FROM get_distinct_entities();
