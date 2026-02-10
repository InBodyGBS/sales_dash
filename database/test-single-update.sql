-- ============================================
-- 단일 레코드 업데이트 테스트
-- 이게 작동하면 다른 문제가 있는 것
-- ============================================

-- Step 1: 테스트할 레코드 하나 선택
SELECT 
    id,
    entity,
    item_number,
    fg_classification as current_fg,
    category,
    model,
    product
FROM sales_data
WHERE entity = 'Japan'
  AND item_number = '270S_0'
LIMIT 1;

-- Step 2: 해당 ID로 직접 업데이트 시도
-- 위 쿼리 결과에서 id를 복사해서 아래에 넣으세요
-- UPDATE sales_data
-- SET fg_classification = 'FG'
-- WHERE id = '여기에-id-넣기';

-- Step 3: 업데이트 확인
-- SELECT 
--     id,
--     item_number,
--     fg_classification,
--     category
-- FROM sales_data
-- WHERE id = '여기에-id-넣기';

-- ============================================
-- 만약 이것도 안 되면 RLS나 권한 문제입니다
-- ============================================
