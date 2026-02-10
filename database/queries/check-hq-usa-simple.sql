-- Simple queries to check HQ and USA data (avoid timeout)

-- 1. Count HQ records by year
SELECT 
    entity,
    year,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'HQ'
GROUP BY entity, year
ORDER BY year DESC;

-- 2. Count USA records by year
SELECT 
    entity,
    year,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'USA'
GROUP BY entity, year
ORDER BY year DESC;

-- 3. Check if year column exists and has values for HQ (simple count)
SELECT 
    'HQ' as entity,
    COUNT(*) as total_records,
    COUNT(CASE WHEN year IS NOT NULL THEN 1 END) as records_with_year
FROM sales_data
WHERE entity = 'HQ';

-- 4. Check if year column exists and has values for USA (simple count)
SELECT 
    'USA' as entity,
    COUNT(*) as total_records,
    COUNT(CASE WHEN year IS NOT NULL THEN 1 END) as records_with_year
FROM sales_data
WHERE entity = 'USA';

-- 5. Sample HQ data (just 5 rows)
SELECT 
    entity,
    year,
    invoice_date,
    line_amount_mst
FROM sales_data
WHERE entity = 'HQ'
LIMIT 5;

-- 6. Sample USA data (just 5 rows)
SELECT 
    entity,
    year,
    invoice_date,
    line_amount_mst
FROM sales_data
WHERE entity = 'USA'
LIMIT 5;

