-- Create performance indexes for sales_data table
-- These indexes significantly improve query performance for dashboards

-- 1. Index on year column for faster DISTINCT year queries
-- This makes the get_distinct_years() RPC function much faster
CREATE INDEX IF NOT EXISTS idx_sales_data_year 
ON sales_data(year);

-- 2. Composite index on entity and year
-- This speeds up queries that filter by both entity and year (most dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sales_data_entity_year 
ON sales_data(entity, year);

-- 3. Index on entity column (if not already exists)
CREATE INDEX IF NOT EXISTS idx_sales_data_entity 
ON sales_data(entity);

-- 4. Composite index on entity, year, and quarter for quarterly queries
CREATE INDEX IF NOT EXISTS idx_sales_data_entity_year_quarter 
ON sales_data(entity, year, quarter);

-- 5. Index on invoice_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_sales_data_invoice_date 
ON sales_data(invoice_date);

-- 6. Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_sales_data_entity_year_id 
ON sales_data(entity, year, id);

-- Verify indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'sales_data'
AND schemaname = 'public'
ORDER BY indexname;

-- Check index usage stats (after some queries have been run)
-- Run this later to verify indexes are being used:
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'sales_data'
ORDER BY idx_scan DESC;
*/

