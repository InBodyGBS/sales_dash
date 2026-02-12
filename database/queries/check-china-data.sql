-- Check if China entity data exists in sales_data table
-- This will help diagnose why China is not appearing in the entities list

-- 1. Check all distinct entity values (case-sensitive)
SELECT DISTINCT entity, COUNT(*) as record_count
FROM sales_data
WHERE entity IS NOT NULL
GROUP BY entity
ORDER BY entity;

-- 2. Check for China with different case variations
SELECT 
    'China (exact)' as check_type,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'China';

SELECT 
    'china (lowercase)' as check_type,
    COUNT(*) as record_count
FROM sales_data
WHERE LOWER(entity) = 'china';

SELECT 
    'CHINA (uppercase)' as check_type,
    COUNT(*) as record_count
FROM sales_data
WHERE UPPER(entity) = 'CHINA';

-- 3. Check for any entity containing 'China' or 'china'
SELECT DISTINCT entity, COUNT(*) as record_count
FROM sales_data
WHERE entity ILIKE '%china%'
GROUP BY entity;

-- 4. Check China data by year (if exists)
SELECT 
    entity,
    year,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date
FROM sales_data
WHERE entity = 'China'
GROUP BY entity, year
ORDER BY year DESC;

-- 5. Sample China data (if exists)
SELECT 
    id,
    entity,
    year,
    invoice_date,
    line_amount_mst,
    quantity,
    item_number,
    product
FROM sales_data
WHERE entity = 'China'
LIMIT 10;

-- 6. Test the get_distinct_entities function
SELECT * FROM get_distinct_entities();
