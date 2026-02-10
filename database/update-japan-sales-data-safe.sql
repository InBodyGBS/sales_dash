-- ============================================
-- 안전한 업데이트 스크립트 (트랜잭션 사용)
-- 테스트 후 COMMIT 또는 ROLLBACK 가능
-- ============================================

BEGIN;

-- Step 1: 백업 생성 (선택사항 - 큰 테이블의 경우 시간이 걸릴 수 있음)
-- CREATE TABLE sales_data_backup_japan AS
-- SELECT * FROM sales_data WHERE entity = 'Japan';

-- Step 2: 업데이트 전 상태 확인
SELECT 
    'BEFORE UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as with_fg,
    COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as with_category,
    COUNT(CASE WHEN model IS NOT NULL THEN 1 END) as with_model,
    COUNT(CASE WHEN product IS NOT NULL THEN 1 END) as with_product
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL;

-- Step 3: item_master에서 업데이트
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(im.fg_classification, sd.fg_classification),
    category = COALESCE(im.category, sd.category),
    model = COALESCE(im.model, sd.model),
    product = COALESCE(im.product, sd.product)
FROM item_master im
WHERE sd.item_number = im.item_number
  AND sd.entity = 'Japan'
  AND sd.item_number IS NOT NULL
  AND im.is_active = true
  AND (
    im.fg_classification IS NOT NULL OR
    im.category IS NOT NULL OR
    im.model IS NOT NULL OR
    im.product IS NOT NULL
  );

-- Step 4: item_mapping에서 업데이트
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(imap.fg_classification, sd.fg_classification),
    category = COALESCE(imap.category, sd.category),
    model = COALESCE(imap.model, sd.model),
    product = COALESCE(imap.product, sd.product)
FROM item_mapping imap
WHERE sd.item_number = imap.item_number
  AND sd.entity = imap.entity
  AND sd.entity = 'Japan'
  AND sd.item_number IS NOT NULL
  AND imap.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM item_master im
    WHERE im.item_number = sd.item_number
      AND im.is_active = true
  )
  AND (
    imap.fg_classification IS NOT NULL OR
    imap.category IS NOT NULL OR
    imap.model IS NOT NULL OR
    imap.product IS NOT NULL
  );

-- Step 5: 업데이트 후 상태 확인
SELECT 
    'AFTER UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as with_fg,
    COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as with_category,
    COUNT(CASE WHEN model IS NOT NULL THEN 1 END) as with_model,
    COUNT(CASE WHEN product IS NOT NULL THEN 1 END) as with_product
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL;

-- Step 6: 비교 결과 확인 (직접 SELECT로 비교)
-- BEFORE와 AFTER를 직접 비교
SELECT 
    'BEFORE' as status,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL) as total_records,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND fg_classification IS NOT NULL) as with_fg,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND category IS NOT NULL) as with_category,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND model IS NOT NULL) as with_model,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND product IS NOT NULL) as with_product
UNION ALL
SELECT 
    'AFTER' as status,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL) as total_records,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND fg_classification IS NOT NULL) as with_fg,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND category IS NOT NULL) as with_category,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND model IS NOT NULL) as with_model,
    (SELECT COUNT(*) FROM sales_data WHERE entity = 'Japan' AND item_number IS NOT NULL AND product IS NOT NULL) as with_product;

-- Step 7: 샘플 확인
SELECT 
    'Sample Check' as info,
    item_number,
    fg_classification,
    category,
    model,
    product
FROM sales_data
WHERE entity = 'Japan'
  AND item_number LIKE '270S%'
LIMIT 5;

-- ============================================
-- 여기서 결과를 확인한 후:
-- 만족스러우면: COMMIT;
-- 문제가 있으면: ROLLBACK;
-- ============================================

-- COMMIT;
-- ROLLBACK;
