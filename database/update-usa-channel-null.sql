-- USA 엔티티에서 Channel이 NULL인 데이터 업데이트
-- 대소문자 구분 없이 Group 값을 비교하여 Channel 계산

UPDATE sales_data
SET channel = calculate_channel(entity, "group", invoice_account)
WHERE entity = 'USA'
  AND channel IS NULL;

-- 업데이트 결과 확인
SELECT 
    channel,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'USA'
GROUP BY channel
ORDER BY count DESC;

-- 여전히 NULL인 데이터 확인 (있다면)
SELECT 
    "group",
    invoice_account,
    COUNT(*) as null_count
FROM sales_data
WHERE entity = 'USA'
  AND channel IS NULL
GROUP BY "group", invoice_account
ORDER BY null_count DESC;
