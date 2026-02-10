-- Check if HQ and USA data exists in sales_data table

-- 1. Check HQ data count by year
SELECT 
    entity,
    year,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date
FROM sales_data
WHERE entity = 'HQ'
GROUP BY entity, year
ORDER BY year DESC;

-- 2. Check USA data count by year
SELECT 
    entity,
    year,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date
FROM sales_data
WHERE entity = 'USA'
GROUP BY entity, year
ORDER BY year DESC;

-- 3. Check if year column is NULL for HQ
SELECT 
    entity,
    COUNT(*) as total_records,
    COUNT(year) as records_with_year,
    COUNT(invoice_date) as records_with_invoice_date,
    COUNT(CASE WHEN year IS NULL THEN 1 END) as records_without_year,
    COUNT(CASE WHEN invoice_date IS NULL THEN 1 END) as records_without_invoice_date
FROM sales_data
WHERE entity = 'HQ'
GROUP BY entity;

-- 4. Check if year column is NULL for USA
SELECT 
    entity,
    COUNT(*) as total_records,
    COUNT(year) as records_with_year,
    COUNT(invoice_date) as records_with_invoice_date,
    COUNT(CASE WHEN year IS NULL THEN 1 END) as records_without_year,
    COUNT(CASE WHEN invoice_date IS NULL THEN 1 END) as records_without_invoice_date
FROM sales_data
WHERE entity = 'USA'
GROUP BY entity;

-- 5. Sample data from HQ
SELECT 
    entity,
    year,
    invoice_date,
    line_amount_mst,
    quantity,
    item_number,
    product
FROM sales_data
WHERE entity = 'HQ'
LIMIT 10;

-- 6. Sample data from USA
SELECT 
    entity,
    year,
    invoice_date,
    line_amount_mst,
    quantity,
    item_number,
    product
FROM sales_data
WHERE entity = 'USA'
LIMIT 10;

-- 7. All entities summary
SELECT 
    entity,
    COUNT(*) as record_count,
    COUNT(DISTINCT year) as distinct_years,
    MIN(year) as min_year,
    MAX(year) as max_year
FROM sales_data
GROUP BY entity
ORDER BY entity;

