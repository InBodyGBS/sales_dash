-- ============================================
-- 진단 스크립트: UPDATE가 안 되는 원인 찾기
-- ============================================

-- Step 1: RLS (Row Level Security) 정책 확인
SELECT 
    'RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'sales_data'
ORDER BY policyname;

-- Step 2: RLS 활성화 여부 확인
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'sales_data';

-- Step 3: 트리거 확인
SELECT 
    'Triggers' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales_data'
ORDER BY trigger_name;

-- Step 4: 제약 조건 확인
SELECT 
    'Constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'sales_data'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Step 5: Foreign Key 확인
SELECT 
    'Foreign Keys' as check_type,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'sales_data';

-- Step 6: 현재 사용자 권한 확인
SELECT 
    'Current User' as check_type,
    current_user as username,
    current_database() as database,
    session_user as session_username;

-- Step 7: 테이블 권한 확인
SELECT 
    'Table Permissions' as check_type,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'sales_data'
ORDER BY grantee, privilege_type;

-- Step 8: 샘플 데이터 확인 (업데이트 가능 여부 테스트)
SELECT 
    'Sample Data' as check_type,
    id,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product
FROM sales_data
WHERE entity = 'Japan'
  AND item_number LIKE '270S%'
LIMIT 5;
