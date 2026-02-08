-- Korot 엔티티의 Invoice별 Line Amount_MST 금액 조회 쿼리

-- 0. 대시보드 Total Amount 확인용 (연도별 합계)
SELECT 
    entity,
    year,
    COUNT(*) as total_rows,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN line_amount_mst IS NOT NULL THEN 1 END) as not_null_count
FROM sales_data
WHERE entity = 'Korot'
  AND year = 2025  -- 연도를 변경하여 확인
GROUP BY entity, year;

-- 0-1. 연도별 상세 확인 (year가 NULL인 경우도 포함)
SELECT 
    entity,
    year,
    EXTRACT(YEAR FROM invoice_date) as invoice_date_year,
    COUNT(*) as row_count,
    SUM(line_amount_mst) as total_line_amount_mst
FROM sales_data
WHERE entity = 'Korot'
  AND (
    year = 2025 
    OR (year IS NULL AND EXTRACT(YEAR FROM invoice_date) = 2025)
  )
GROUP BY entity, year, EXTRACT(YEAR FROM invoice_date)
ORDER BY year NULLS LAST, invoice_date_year;

-- 1. Invoice별 합계 (가장 중요)
SELECT 
    invoice,
    invoice_date,
    COUNT(*) as line_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    AVG(line_amount_mst) as avg_amount
FROM sales_data
WHERE entity = 'Korot'
GROUP BY invoice, invoice_date
ORDER BY total_line_amount_mst DESC NULLS LAST;

-- 2. Invoice별 상세 (라인별 내역)
SELECT 
    invoice,
    invoice_date,
    sales_order,
    item_number,
    line_number,
    quantity,
    line_amount_mst,
    net_amount,
    product_name,
    created_at
FROM sales_data
WHERE entity = 'Korot'
ORDER BY invoice, line_number, item_number;

-- 3. 전체 합계 및 통계
SELECT 
    COUNT(*) as total_rows,
    COUNT(DISTINCT invoice) as unique_invoices,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN line_amount_mst IS NOT NULL THEN 1 END) as not_null_count,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    AVG(line_amount_mst) as avg_amount
FROM sales_data
WHERE entity = 'Korot';

-- 4. NULL 값이 있는 행 확인
SELECT 
    invoice,
    invoice_date,
    sales_order,
    item_number,
    line_number,
    quantity,
    line_amount_mst,
    net_amount,
    invoice_amount_mst,
    invoice_amount
FROM sales_data
WHERE entity = 'Korot' 
  AND line_amount_mst IS NULL
ORDER BY invoice, line_number;

-- 5. Invoice별 비교 (Line Amount_MST vs Invoice Amount_MST)
SELECT 
    invoice,
    invoice_date,
    SUM(line_amount_mst) as total_line_amount_mst,
    MAX(invoice_amount_mst) as invoice_amount_mst,
    MAX(invoice_amount) as invoice_amount,
    SUM(line_amount_mst) - MAX(invoice_amount_mst) as difference_mst,
    COUNT(*) as line_count
FROM sales_data
WHERE entity = 'Korot'
GROUP BY invoice, invoice_date
HAVING ABS(SUM(line_amount_mst) - MAX(invoice_amount_mst)) > 0.01
ORDER BY ABS(SUM(line_amount_mst) - MAX(invoice_amount_mst)) DESC;

-- 6. 연도별 합계
SELECT 
    year,
    COUNT(*) as total_rows,
    COUNT(DISTINCT invoice) as unique_invoices,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero
FROM sales_data
WHERE entity = 'Korot'
GROUP BY year
ORDER BY year DESC;

-- 7. 최근 업로드된 데이터 확인
SELECT 
    invoice,
    invoice_date,
    COUNT(*) as line_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    MAX(created_at) as last_uploaded
FROM sales_data
WHERE entity = 'Korot'
GROUP BY invoice, invoice_date
ORDER BY last_uploaded DESC
LIMIT 20;
