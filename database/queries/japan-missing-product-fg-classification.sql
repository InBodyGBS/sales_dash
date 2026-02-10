-- Japan entity에서 product와 fg_classification이 공란인 레코드 조회
-- item_number와 product_name 확인

-- 1. 기본 조회 (중복 제거, item_number별 집계)
SELECT DISTINCT
    item_number,
    product_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT invoice) as invoice_count,
    MIN(invoice_date) as first_invoice_date,
    MAX(invoice_date) as last_invoice_date
FROM sales_data
WHERE entity = 'Japan'
  AND (
    (product IS NULL OR TRIM(product) = '')
    AND (fg_classification IS NULL OR TRIM(fg_classification) = '')
  )
  AND item_number IS NOT NULL
GROUP BY item_number, product_name
ORDER BY record_count DESC, item_number;

-- 2. 상세 조회 (모든 레코드)
SELECT 
    id,
    invoice,
    invoice_date,
    item_number,
    product_name,
    product,
    fg_classification,
    category,
    model,
    line_amount_mst,
    quantity,
    created_at
FROM sales_data
WHERE entity = 'Japan'
  AND (
    (product IS NULL OR TRIM(product) = '')
    AND (fg_classification IS NULL OR TRIM(fg_classification) = '')
  )
  AND item_number IS NOT NULL
ORDER BY invoice_date DESC, item_number, invoice;

-- 3. 통계 요약
SELECT 
    COUNT(DISTINCT item_number) as unique_item_numbers,
    COUNT(DISTINCT product_name) as unique_product_names,
    COUNT(*) as total_records,
    COUNT(DISTINCT invoice) as unique_invoices,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst,
    SUM(COALESCE(quantity, 0)) as total_quantity
FROM sales_data
WHERE entity = 'Japan'
  AND (
    (product IS NULL OR TRIM(product) = '')
    AND (fg_classification IS NULL OR TRIM(fg_classification) = '')
  )
  AND item_number IS NOT NULL;

-- 4. item_number별 상세 통계
SELECT 
    item_number,
    product_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT invoice) as invoice_count,
    COUNT(DISTINCT invoice_date) as date_count,
    SUM(COALESCE(line_amount_mst, 0)) as total_line_amount_mst,
    SUM(COALESCE(quantity, 0)) as total_quantity,
    MIN(invoice_date) as first_date,
    MAX(invoice_date) as last_date
FROM sales_data
WHERE entity = 'Japan'
  AND (
    (product IS NULL OR TRIM(product) = '')
    AND (fg_classification IS NULL OR TRIM(fg_classification) = '')
  )
  AND item_number IS NOT NULL
GROUP BY item_number, product_name
ORDER BY record_count DESC;

-- 5. item_master 또는 item_mapping에 매핑이 있는지 확인
SELECT 
    sd.item_number,
    sd.product_name,
    COUNT(*) as sales_data_count,
    CASE WHEN im.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_master,
    CASE WHEN imap.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_mapping
FROM sales_data sd
LEFT JOIN item_master im ON sd.item_number = im.item_number AND im.is_active = true
LEFT JOIN item_mapping imap ON sd.item_number = imap.item_number 
    AND sd.entity = imap.entity 
    AND imap.is_active = true
WHERE sd.entity = 'Japan'
  AND (
    (sd.product IS NULL OR TRIM(sd.product) = '')
    AND (sd.fg_classification IS NULL OR TRIM(sd.fg_classification) = '')
  )
  AND sd.item_number IS NOT NULL
GROUP BY sd.item_number, sd.product_name, im.item_number, imap.item_number
ORDER BY sales_data_count DESC;

