-- Japan entity의 2025년 월별 line_amount_mst 집계 쿼리

-- 1. 기본 월별 집계 (invoice_date 기준)
SELECT 
    EXTRACT(YEAR FROM invoice_date) as year,
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    COUNT(*) as row_count,
    SUM(line_amount_mst) as total_line_amount_mst,
    SUM(COALESCE(line_amount_mst, 0)) as total_with_null_as_zero,
    COUNT(CASE WHEN line_amount_mst IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN line_amount_mst IS NOT NULL THEN 1 END) as not_null_count,
    MIN(line_amount_mst) as min_amount,
    MAX(line_amount_mst) as max_amount,
    AVG(line_amount_mst) as avg_amount
FROM sales_data
WHERE entity = 'Japan'
  AND (
    EXTRACT(YEAR FROM invoice_date) = 2025
    OR (invoice_date IS NULL AND year = 2025)
  )
GROUP BY 
    EXTRACT(YEAR FROM invoice_date),
    EXTRACT(MONTH FROM invoice_date),
    TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY 
    EXTRACT(YEAR FROM invoice_date),
    EXTRACT(MONTH FROM invoice_date);

-- 2. 간단한 버전 (월별 합계만)
SELECT 
    EXTRACT(MONTH FROM invoice_date) as month,
    TO_CHAR(invoice_date, 'YYYY-MM') as year_month,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst
FROM sales_data
WHERE entity = 'Japan'
  AND EXTRACT(YEAR FROM invoice_date) = 2025
GROUP BY 
    EXTRACT(MONTH FROM invoice_date),
    TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY month;

-- 3. 모든 월 포함 (데이터가 없는 월도 0으로 표시)
WITH months AS (
    SELECT generate_series(1, 12) as month
),
monthly_data AS (
    SELECT 
        EXTRACT(MONTH FROM invoice_date) as month,
        SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst
    FROM sales_data
    WHERE entity = 'Japan'
      AND EXTRACT(YEAR FROM invoice_date) = 2025
    GROUP BY EXTRACT(MONTH FROM invoice_date)
)
SELECT 
    m.month,
    TO_CHAR(TO_DATE('2025-' || LPAD(m.month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') as year_month,
    COALESCE(md.total_line_amount_mst, 0) as total_line_amount_mst
FROM months m
LEFT JOIN monthly_data md ON m.month = md.month
ORDER BY m.month;

-- 4. invoice_date가 NULL인 경우도 포함 (year 컬럼 사용)
SELECT 
    CASE 
        WHEN invoice_date IS NOT NULL THEN EXTRACT(MONTH FROM invoice_date)
        ELSE NULL
    END as month,
    CASE 
        WHEN invoice_date IS NOT NULL THEN TO_CHAR(invoice_date, 'YYYY-MM')
        ELSE '2025-XX'
    END as year_month,
    COUNT(*) as row_count,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst
FROM sales_data
WHERE entity = 'Japan'
  AND (
    (invoice_date IS NOT NULL AND EXTRACT(YEAR FROM invoice_date) = 2025)
    OR (invoice_date IS NULL AND year = 2025)
  )
GROUP BY 
    CASE 
        WHEN invoice_date IS NOT NULL THEN EXTRACT(MONTH FROM invoice_date)
        ELSE NULL
    END,
    CASE 
        WHEN invoice_date IS NOT NULL THEN TO_CHAR(invoice_date, 'YYYY-MM')
        ELSE '2025-XX'
    END
ORDER BY 
    CASE 
        WHEN invoice_date IS NOT NULL THEN EXTRACT(MONTH FROM invoice_date)
        ELSE 99
    END;

