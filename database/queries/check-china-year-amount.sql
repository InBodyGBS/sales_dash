-- Check China entity data by year with amount summary
-- This helps verify data upload and identify any duplicates or data issues

-- 1. Count records by year for China
SELECT 
    year,
    COUNT(*) as record_count,
    COUNT(DISTINCT id) as unique_record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date
FROM sales_data
WHERE entity = 'China'
GROUP BY year
ORDER BY year DESC;

-- 2. Check for duplicate records (same invoice, item, date, amount)
SELECT 
    invoice,
    item_number,
    invoice_date,
    line_amount_mst,
    COUNT(*) as duplicate_count
FROM sales_data
WHERE entity = 'China'
GROUP BY invoice, item_number, invoice_date, line_amount_mst
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, invoice_date DESC
LIMIT 50;

-- 3. Check total records vs unique records
SELECT 
    'Total Records' as metric,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'China'
UNION ALL
SELECT 
    'Unique Records (by id)' as metric,
    COUNT(DISTINCT id) as count
FROM sales_data
WHERE entity = 'China'
UNION ALL
SELECT 
    'Unique Records (by invoice+item+date+amount)' as metric,
    COUNT(DISTINCT (invoice || '|' || COALESCE(item_number, '') || '|' || COALESCE(invoice_date::text, '') || '|' || COALESCE(line_amount_mst::text, ''))) as count
FROM sales_data
WHERE entity = 'China';

-- 4. Check year distribution with sample data
SELECT 
    year,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    AVG(line_amount_mst) as avg_amount,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount
FROM sales_data
WHERE entity = 'China'
GROUP BY year
ORDER BY year DESC;

-- 5. Check for NULL or zero amounts
SELECT 
    year,
    COUNT(*) as total_records,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_amount_count,
    COUNT(CASE WHEN line_amount_mst = 0 THEN 1 END) as zero_amount_count,
    COUNT(CASE WHEN line_amount_mst > 0 THEN 1 END) as positive_amount_count
FROM sales_data
WHERE entity = 'China'
GROUP BY year
ORDER BY year DESC;

-- 6. Sample data by year (latest 10 records per year)
SELECT 
    id,
    year,
    invoice_date,
    invoice,
    item_number,
    product,
    line_amount_mst,
    quantity,
    currency,
    fg_classification
FROM sales_data
WHERE entity = 'China'
ORDER BY year DESC, invoice_date DESC, id DESC
LIMIT 50;

-- 7. Check upload batches for China
SELECT 
    upload_batch_id,
    COUNT(*) as record_count,
    MIN(created_at) as first_uploaded,
    MAX(created_at) as last_uploaded
FROM sales_data
WHERE entity = 'China'
GROUP BY upload_batch_id
ORDER BY first_uploaded DESC;

-- 8. Compare expected vs actual record count
-- If you uploaded 900 rows, check if there are exactly 900 or more
SELECT 
    CASE 
        WHEN COUNT(*) = 900 THEN '✅ Exactly 900 records'
        WHEN COUNT(*) > 900 THEN '⚠️ More than 900 records - possible duplicates'
        WHEN COUNT(*) < 900 THEN '⚠️ Less than 900 records - possible data loss'
    END as status,
    COUNT(*) as actual_count,
    900 as expected_count,
    COUNT(*) - 900 as difference
FROM sales_data
WHERE entity = 'China';

-- 9. Detailed year-by-year breakdown with currency
SELECT 
    year,
    currency,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    AVG(line_amount_mst) as avg_amount
FROM sales_data
WHERE entity = 'China'
GROUP BY year, currency
ORDER BY year DESC, currency;

-- 10. Check for records with same invoice but different line numbers (possible line item expansion)
SELECT 
    invoice,
    invoice_date,
    COUNT(*) as line_count,
    COUNT(DISTINCT item_number) as unique_items,
    SUM(line_amount_mst) as total_amount
FROM sales_data
WHERE entity = 'China'
GROUP BY invoice, invoice_date
HAVING COUNT(*) > 1
ORDER BY line_count DESC, invoice_date DESC
LIMIT 50;

-- 11. Check if line_number column might be causing duplicates
SELECT 
    invoice,
    invoice_date,
    item_number,
    line_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as record_ids
FROM sales_data
WHERE entity = 'China'
GROUP BY invoice, invoice_date, item_number, line_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 50;

-- 12. Summary by upload batch (to see if multiple uploads happened)
SELECT 
    upload_batch_id,
    year,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(created_at) as upload_time
FROM sales_data
WHERE entity = 'China'
GROUP BY upload_batch_id, year
ORDER BY upload_time DESC;
