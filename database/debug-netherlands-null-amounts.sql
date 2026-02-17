-- Debug: Netherlands와 Germany의 null amount 문제 진단

-- Step 1: Netherlands의 top products에서 null amount 확인
SELECT 
    'Netherlands Top 10 (with null check)' as check_type,
    product,
    total_amount,
    total_quantity,
    fg_classification,
    category,
    CASE 
        WHEN total_amount IS NULL THEN 'NULL'
        WHEN total_amount = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as amount_status
FROM mv_sales_cube
WHERE entity = 'Netherlands'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
ORDER BY COALESCE(total_amount, 0) DESC
LIMIT 15;

-- Step 2: Germany의 top products에서 null amount 확인
SELECT 
    'Germany Top 10 (with null check)' as check_type,
    product,
    total_amount,
    total_quantity,
    fg_classification,
    category,
    CASE 
        WHEN total_amount IS NULL THEN 'NULL'
        WHEN total_amount = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as amount_status
FROM mv_sales_cube
WHERE entity = 'Germany'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
ORDER BY COALESCE(total_amount, 0) DESC
LIMIT 15;

-- Step 3: 집계 쿼리 테스트 (API가 사용하는 방식)
SELECT 
    'Netherlands Aggregated' as check_type,
    product,
    fg_classification,
    category,
    SUM(total_amount) as total_amount_sum,
    SUM(total_quantity) as total_quantity_sum,
    COUNT(*) as row_count,
    COUNT(CASE WHEN total_amount IS NULL THEN 1 END) as null_amount_count
FROM mv_sales_cube
WHERE entity = 'Netherlands'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
GROUP BY product, fg_classification, category
ORDER BY SUM(total_amount) DESC NULLS LAST
LIMIT 15;

-- Step 4: sales_data 원본 테이블에서 확인
SELECT 
    'Netherlands sales_data (raw)' as check_type,
    product,
    line_amount_mst,
    quantity,
    fg_classification,
    category,
    CASE 
        WHEN line_amount_mst IS NULL THEN 'NULL'
        WHEN line_amount_mst = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as amount_status
FROM sales_data
WHERE entity = 'Netherlands'
  AND year = 2026
  AND fg_classification = 'FG'
  AND product IS NOT NULL
ORDER BY COALESCE(line_amount_mst, 0) DESC
LIMIT 15;

-- Step 5: mv_sales_cube의 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mv_sales_cube'
  AND column_name IN ('total_amount', 'total_quantity', 'line_amount_mst', 'quantity')
ORDER BY column_name;

-- Step 6: "Cart" 제품 구체적으로 확인
SELECT 
    '"Cart" product in Netherlands' as check_type,
    entity,
    year,
    product,
    total_amount,
    total_quantity,
    line_amount_mst,
    quantity,
    fg_classification,
    category
FROM mv_sales_cube
WHERE entity = 'Netherlands'
  AND year = 2026
  AND product = 'Cart'
LIMIT 10;

