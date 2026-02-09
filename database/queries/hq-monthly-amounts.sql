-- HQ 엔티티의 월별 Line Amount_MST 합계액 조회 쿼리

-- 1. 연도별 월별 합계 (year 컬럼 사용)
SELECT 
    entity,
    year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN line_amount_mst IS NOT NULL THEN 1 END) as not_null_count
FROM sales_data
WHERE entity = 'HQ'
  AND year = 2025  -- 연도를 변경하여 확인
  AND invoice_date IS NOT NULL
GROUP BY entity, year, EXTRACT(MONTH FROM invoice_date), TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY year, month;

-- 2. 모든 연도 월별 합계 (year 컬럼 사용)
SELECT 
    entity,
    year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst
FROM sales_data
WHERE entity = 'HQ'
  AND invoice_date IS NOT NULL
GROUP BY entity, year, EXTRACT(MONTH FROM invoice_date), TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY year DESC, month;

-- 3. 특정 연도 월별 합계 (invoice_date에서 직접 추출)
SELECT 
    entity,
    EXTRACT(YEAR FROM invoice_date) as year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    TO_CHAR(invoice_date, 'Month YYYY') as month_name,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst,
    ROUND(AVG(line_amount_mst), 2) as avg_line_amount_mst,
    MIN(line_amount_mst) as min_line_amount_mst,
    MAX(line_amount_mst) as max_line_amount_mst
FROM sales_data
WHERE entity = 'HQ'
  AND invoice_date IS NOT NULL
  AND EXTRACT(YEAR FROM invoice_date) = 2025  -- 연도를 변경하여 확인
GROUP BY entity, EXTRACT(YEAR FROM invoice_date), EXTRACT(MONTH FROM invoice_date), 
         TO_CHAR(invoice_date, 'YYYY-MM'), TO_CHAR(invoice_date, 'Month YYYY')
ORDER BY year, month;

-- 4. 월별 합계 (NULL 값 제외)
SELECT 
    entity,
    EXTRACT(YEAR FROM invoice_date) as year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst
FROM sales_data
WHERE entity = 'HQ'
  AND invoice_date IS NOT NULL
  AND line_amount_mst IS NOT NULL
GROUP BY entity, EXTRACT(YEAR FROM invoice_date), EXTRACT(MONTH FROM invoice_date), 
         TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY year DESC, month;

-- 5. 최근 12개월 합계
SELECT 
    entity,
    EXTRACT(YEAR FROM invoice_date) as year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst
FROM sales_data
WHERE entity = 'HQ'
  AND invoice_date IS NOT NULL
  AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY entity, EXTRACT(YEAR FROM invoice_date), EXTRACT(MONTH FROM invoice_date), 
         TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY year DESC, month DESC
LIMIT 12;
