-- ============================================
-- 간단한 업데이트 스크립트 (TEMP TABLE 없음)
-- 트랜잭션 사용으로 안전하게 업데이트
-- ============================================

BEGIN;

-- Step 1: 업데이트 전 상태 확인
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

-- Step 2: item_master에서 업데이트 (1차 우선순위)
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

-- Step 3: item_mapping에서 업데이트 (2차 우선순위)
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
  -- item_master에 없는 경우만
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

-- Step 4: 업데이트 후 상태 확인
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

-- Step 5: 샘플 결과 확인 (270S_0 예시)
SELECT 
    'Sample Result (270S_0)' as info,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'Japan'
  AND item_number LIKE '270S%'
GROUP BY entity, item_number, fg_classification, category, model, product
ORDER BY item_number
LIMIT 10;

-- ============================================
-- 여기서 결과를 확인한 후:
-- 만족스러우면: COMMIT;
-- 문제가 있으면: ROLLBACK;
-- ============================================

-- COMMIT;
-- ROLLBACK;
