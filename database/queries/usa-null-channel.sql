-- USA 엔티티에서 Channel이 NULL인 데이터 조회 쿼리

-- 1. Channel이 NULL인 USA 데이터 개수 확인
SELECT 
    COUNT(*) as null_channel_count
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL;

-- 2. Channel이 NULL인 USA 데이터 상세 조회 (샘플 100개)
SELECT 
    id,
    entity,
    "group",
    invoice_account,
    channel,
    invoice_date,
    invoice,
    sales_order,
    item_number,
    product_name,
    line_amount_mst,
    quantity
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
ORDER BY invoice_date DESC, invoice
LIMIT 100;

-- 3. Group별 NULL Channel 분포 확인
SELECT 
    "group",
    COUNT(*) as null_count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
GROUP BY "group"
ORDER BY null_count DESC;

-- 4. invoice_account별 NULL Channel 분포 확인
SELECT 
    invoice_account,
    COUNT(*) as null_count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
GROUP BY invoice_account
ORDER BY null_count DESC
LIMIT 20;

-- 5. Group과 invoice_account 조합별 NULL Channel 확인
SELECT 
    "group",
    invoice_account,
    COUNT(*) as null_count
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
GROUP BY "group", invoice_account
ORDER BY null_count DESC
LIMIT 50;

-- 6. USA 엔티티의 전체 Channel 분포 확인
SELECT 
    channel,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM sales_data
WHERE entity = 'USA'
GROUP BY channel
ORDER BY count DESC;

-- 7. USA 엔티티의 Group 값 전체 목록 확인
SELECT 
    "group",
    COUNT(*) as count,
    COUNT(DISTINCT invoice_account) as distinct_invoice_accounts
FROM sales_data
WHERE entity = 'USA'
GROUP BY "group"
ORDER BY count DESC;

-- 8. USA 엔티티에서 Channel이 NULL이고 Group이 NULL이 아닌 데이터
SELECT 
    "group",
    invoice_account,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
  AND "group" IS NOT NULL
GROUP BY "group", invoice_account
ORDER BY count DESC;

-- 9. USA 엔티티에서 Channel이 NULL이고 Group도 NULL인 데이터
SELECT 
    COUNT(*) as count
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
  AND "group" IS NULL;
