-- 간단한 트리거 확인 스크립트
-- array_agg 에러 없이 실행 가능

-- 1. sales_data 테이블의 모든 트리거 확인
SELECT 
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    SUBSTRING(action_statement, 1, 200) as action_preview
FROM information_schema.triggers
WHERE event_object_table = 'sales_data'
ORDER BY trigger_name;

-- 2. 트리거 함수 이름 확인
SELECT DISTINCT
    t.tgname as trigger_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'sales_data'::regclass
ORDER BY t.tgname;

-- 3. fg_classification 관련 트리거 확인
SELECT 
    t.tgname as trigger_name,
    t.tgtype::text as trigger_type,
    CASE 
        WHEN t.tgtype::integer & 2 = 2 THEN 'BEFORE'
        WHEN t.tgtype::integer & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as timing,
    CASE 
        WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'
        WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
        ELSE 'UNKNOWN'
    END as event
FROM pg_trigger t
WHERE t.tgrelid = 'sales_data'::regclass
  AND t.tgisinternal = false
ORDER BY t.tgname;
