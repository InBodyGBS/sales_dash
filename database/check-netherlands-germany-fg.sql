-- Check fg_classification for Netherlands and Germany entities
-- To diagnose why Top 10 Products "All" category shows incorrect data

-- Step 1: Check if fg_classification column exists and has data
SELECT 
    'Netherlands FG Distribution' as check_type,
    fg_classification,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Netherlands'
  AND year = 2026
GROUP BY fg_classification
ORDER BY total_amount DESC;

SELECT 
    'Germany FG Distribution' as check_type,
    fg_classification,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Germany'
  AND year = 2026
GROUP BY fg_classification
ORDER BY total_amount DESC;

-- Step 2: Check top products for Netherlands WITHOUT FG filter
SELECT 
    'Netherlands Top Products (No FG Filter)' as check_type,
    product,
    fg_classification,
    category,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Netherlands'
  AND year = 2026
  AND product IS NOT NULL
GROUP BY product, fg_classification, category
ORDER BY SUM(line_amount_mst) DESC
LIMIT 10;

-- Step 3: Check top products for Netherlands WITH FG filter
SELECT 
    'Netherlands Top Products (FG Only)' as check_type,
    product,
    fg_classification,
    category,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Netherlands'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
GROUP BY product, fg_classification, category
ORDER BY SUM(line_amount_mst) DESC
LIMIT 10;

-- Step 4: Check top products for Germany WITHOUT FG filter
SELECT 
    'Germany Top Products (No FG Filter)' as check_type,
    product,
    fg_classification,
    category,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Germany'
  AND year = 2026
  AND product IS NOT NULL
GROUP BY product, fg_classification, category
ORDER BY SUM(line_amount_mst) DESC
LIMIT 10;

-- Step 5: Check top products for Germany WITH FG filter
SELECT 
    'Germany Top Products (FG Only)' as check_type,
    product,
    fg_classification,
    category,
    SUM(line_amount_mst) as total_amount,
    SUM(quantity) as total_quantity
FROM sales_data
WHERE entity = 'Germany'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
GROUP BY product, fg_classification, category
ORDER BY SUM(line_amount_mst) DESC
LIMIT 10;

-- Step 6: Check mv_sales_cube for Netherlands
SELECT 
    'Netherlands mv_sales_cube FG Distribution' as check_type,
    fg_classification,
    SUM(row_count) as record_count,
    SUM(total_amount) as total_amount,
    SUM(total_quantity) as total_quantity
FROM mv_sales_cube
WHERE entity = 'Netherlands'
  AND year = 2026
GROUP BY fg_classification
ORDER BY total_amount DESC;

-- Step 7: Check mv_sales_cube for Germany
SELECT 
    'Germany mv_sales_cube FG Distribution' as check_type,
    fg_classification,
    SUM(row_count) as record_count,
    SUM(total_amount) as total_amount,
    SUM(total_quantity) as total_quantity
FROM mv_sales_cube
WHERE entity = 'Germany'
  AND year = 2026
GROUP BY fg_classification
ORDER BY total_amount DESC;

-- Step 8: Check item_mapping for Netherlands
SELECT 
    'Netherlands item_mapping' as check_type,
    COUNT(*) as total_mappings,
    COUNT(CASE WHEN fg_classification = 'FG' THEN 1 END) as fg_count,
    COUNT(CASE WHEN fg_classification = 'NonFG' THEN 1 END) as nonfg_count,
    COUNT(CASE WHEN fg_classification IS NULL OR fg_classification = '' THEN 1 END) as null_or_empty_count
FROM item_mapping
WHERE entity = 'Netherlands'
  AND is_active = true;

-- Step 9: Check item_mapping for Germany
SELECT 
    'Germany item_mapping' as check_type,
    COUNT(*) as total_mappings,
    COUNT(CASE WHEN fg_classification = 'FG' THEN 1 END) as fg_count,
    COUNT(CASE WHEN fg_classification = 'NonFG' THEN 1 END) as nonfg_count,
    COUNT(CASE WHEN fg_classification IS NULL OR fg_classification = '' THEN 1 END) as null_or_empty_count
FROM item_mapping
WHERE entity = 'Germany'
  AND is_active = true;

