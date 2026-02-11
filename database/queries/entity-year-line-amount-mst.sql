-- Entity별, 연도별 Line_amount_mst 금액 조회 쿼리

-- 1. 기본 집계 (Entity별, 연도별 합계)
SELECT 
    entity,
    year,
    COUNT(*) as row_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN line_amount_mst IS NOT NULL THEN 1 END) as not_null_count,
    COUNT(CASE WHEN line_amount_mst = 0 THEN 1 END) as zero_count,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    AVG(line_amount_mst) as avg_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount_rounded
FROM sales_data
WHERE year IS NOT NULL
GROUP BY 
    entity,
    year
ORDER BY 
    entity,
    year DESC;

-- 2. 간단한 버전 (합계만)
SELECT 
    entity,
    year,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst
FROM sales_data
WHERE year IS NOT NULL
GROUP BY 
    entity,
    year
ORDER BY 
    entity,
    year DESC;

-- 3. 특정 Entity만 조회 (예: Japan)
SELECT 
    entity,
    year,
    COUNT(*) as row_count,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount
FROM sales_data
WHERE entity = 'Japan'
  AND year IS NOT NULL
GROUP BY 
    entity,
    year
ORDER BY 
    year DESC;

-- 4. 특정 연도만 조회 (예: 2025)
SELECT 
    entity,
    year,
    COUNT(*) as row_count,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount
FROM sales_data
WHERE year = 2025
GROUP BY 
    entity,
    year
ORDER BY 
    entity;

-- 5. Entity별, 연도별 합계 (NULL 값 제외)
SELECT 
    entity,
    year,
    COUNT(*) as row_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount
FROM sales_data
WHERE year IS NOT NULL
  AND line_amount_mst IS NOT NULL
GROUP BY 
    entity,
    year
ORDER BY 
    entity,
    year DESC;

-- 6. Entity별, 연도별 합계 (0보다 큰 값만)
SELECT 
    entity,
    year,
    COUNT(*) as row_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount
FROM sales_data
WHERE year IS NOT NULL
  AND line_amount_mst > 0
GROUP BY 
    entity,
    year
ORDER BY 
    entity,
    year DESC;

-- 7. Entity별, 연도별 합계 (통화별로도 구분)
SELECT 
    entity,
    year,
    currency,
    COUNT(*) as row_count,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    ROUND(AVG(line_amount_mst), 2) as avg_amount
FROM sales_data
WHERE year IS NOT NULL
GROUP BY 
    entity,
    year,
    currency
ORDER BY 
    entity,
    year DESC,
    currency;

-- 8. Entity별, 연도별 합계 (Pivot 형태 - Entity가 컬럼으로)
SELECT 
    year,
    SUM(CASE WHEN entity = 'HQ' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as HQ,
    SUM(CASE WHEN entity = 'USA' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as USA,
    SUM(CASE WHEN entity = 'BWA' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as BWA,
    SUM(CASE WHEN entity = 'Vietnam' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as Vietnam,
    SUM(CASE WHEN entity = 'Healthcare' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as Healthcare,
    SUM(CASE WHEN entity = 'Korot' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as Korot,
    SUM(CASE WHEN entity = 'Japan' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as Japan,
    SUM(CASE WHEN entity = 'China' THEN COALESCE(line_amount_mst, 0) ELSE 0 END) as China,
    SUM(COALESCE(line_amount_mst, 0)) as Total
FROM sales_data
WHERE year IS NOT NULL
GROUP BY 
    year
ORDER BY 
    year DESC;
