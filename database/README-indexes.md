# Database Performance Indexes

## Purpose
These indexes significantly improve query performance for the sales dashboard, especially for large datasets (100,000+ rows).

## Files
- `create-performance-indexes.sql` - Creates all performance indexes

## When to Run
Run this SQL after:
1. Creating the `sales_data` table
2. Uploading large amounts of data (e.g., USA with 100,000+ records)
3. Experiencing slow dashboard load times

## Expected Performance Improvements

### Before Indexes
- `get_distinct_years('USA')`: 8+ seconds (timeout)
- Dashboard summary API: 30+ seconds
- Quarterly comparison: 40+ seconds

### After Indexes
- `get_distinct_years('USA')`: < 1 second
- Dashboard summary API: 3-5 seconds
- Quarterly comparison: 3-5 seconds

## How to Apply

### Method 1: Supabase SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `create-performance-indexes.sql`
3. Paste and click "Run"

### Method 2: Command Line (if you have psql)
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f database/create-performance-indexes.sql
```

## Indexes Created

1. **idx_sales_data_year**
   - Column: `year`
   - Purpose: Speeds up DISTINCT year queries
   
2. **idx_sales_data_entity_year**
   - Columns: `entity, year`
   - Purpose: Speeds up dashboard queries filtering by entity and year
   
3. **idx_sales_data_entity**
   - Column: `entity`
   - Purpose: Speeds up queries filtering by entity only
   
4. **idx_sales_data_entity_year_quarter**
   - Columns: `entity, year, quarter`
   - Purpose: Speeds up quarterly comparison queries
   
5. **idx_sales_data_invoice_date**
   - Column: `invoice_date`
   - Purpose: Speeds up date-based queries
   
6. **idx_sales_data_entity_year_id**
   - Columns: `entity, year, id`
   - Purpose: Speeds up paginated queries with consistent ordering

## Verification

After creating indexes, run this query to verify:

```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'sales_data'
AND schemaname = 'public'
ORDER BY indexname;
```

You should see all 6 indexes listed.

## Maintenance

Indexes are automatically maintained by PostgreSQL. However, if you notice performance degradation after many inserts/updates:

```sql
-- Reindex all indexes on sales_data table
REINDEX TABLE sales_data;
```

## Storage Impact

Each index uses additional disk space:
- Approximate size per index: 1-5% of table size
- Total additional storage: ~10-30% of table size
- This is a good trade-off for the performance improvement

## Notes

- Indexes speed up SELECT queries but slightly slow down INSERT/UPDATE operations
- For this dashboard application, the read performance improvement far outweighs the insert cost
- All indexes use `IF NOT EXISTS` so running the script multiple times is safe

