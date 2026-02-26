-- Add India, Mexico, Oceania, Samhan to entity check constraints
-- This enables item mapping for these new entities

-- 1. Check existing entities in item_mapping table (for debugging)
SELECT DISTINCT entity FROM item_mapping ORDER BY entity;

-- 1. Update item_mapping table constraint
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity_item_mapping'
          AND conrelid = 'item_mapping'::regclass
    ) THEN
        ALTER TABLE item_mapping DROP CONSTRAINT valid_entity_item_mapping;
        RAISE NOTICE '✅ item_mapping: 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- Add new constraint with all entities including Samhan
    -- Note: This includes all entities that might exist in the table
    ALTER TABLE item_mapping 
    ADD CONSTRAINT valid_entity_item_mapping 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore', 'Samhan'));
    
    RAISE NOTICE '✅ item_mapping: 새 CHECK 제약 조건이 추가되었습니다 (Samhan 포함).';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE '⚠️ 경고: item_mapping 테이블에 constraint를 위반하는 데이터가 있습니다.';
        RAISE NOTICE '   다음 쿼리로 위반하는 entity를 확인하세요:';
        RAISE NOTICE '   SELECT DISTINCT entity FROM item_mapping WHERE entity NOT IN (''HQ'', ''USA'', ''BWA'', ''Vietnam'', ''Healthcare'', ''Korot'', ''Japan'', ''China'', ''India'', ''Mexico'', ''Oceania'', ''Netherlands'', ''Germany'', ''UK'', ''Asia'', ''Europe'', ''Singapore'', ''Samhan'');';
        RAISE;
END $$;

-- 2. Check existing entities in column_mapping table (for debugging)
SELECT DISTINCT entity FROM column_mapping ORDER BY entity;

-- 2. Update column_mapping table constraint
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity_mapping'
          AND conrelid = 'column_mapping'::regclass
    ) THEN
        ALTER TABLE column_mapping DROP CONSTRAINT valid_entity_mapping;
        RAISE NOTICE '✅ column_mapping: 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- Add new constraint with all entities including Samhan
    ALTER TABLE column_mapping 
    ADD CONSTRAINT valid_entity_mapping 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore', 'Samhan'));
    
    RAISE NOTICE '✅ column_mapping: 새 CHECK 제약 조건이 추가되었습니다 (Samhan 포함).';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE '⚠️ 경고: column_mapping 테이블에 constraint를 위반하는 데이터가 있습니다.';
        RAISE NOTICE '   다음 쿼리로 위반하는 entity를 확인하세요:';
        RAISE NOTICE '   SELECT DISTINCT entity FROM column_mapping WHERE entity NOT IN (''HQ'', ''USA'', ''BWA'', ''Vietnam'', ''Healthcare'', ''Korot'', ''Japan'', ''China'', ''India'', ''Mexico'', ''Oceania'', ''Netherlands'', ''Germany'', ''UK'', ''Asia'', ''Europe'', ''Singapore'', ''Samhan'');';
        RAISE;
END $$;

-- 3. Update sales_data table constraint (if exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity'
          AND conrelid = 'sales_data'::regclass
    ) THEN
        ALTER TABLE sales_data DROP CONSTRAINT valid_entity;
        RAISE NOTICE '✅ sales_data: 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- Add new constraint with all entities including Samhan
    ALTER TABLE sales_data 
    ADD CONSTRAINT valid_entity 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe', 'Singapore', 'Samhan'));
    
    RAISE NOTICE '✅ sales_data: 새 CHECK 제약 조건이 추가되었습니다 (Samhan 포함).';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE '⚠️ 경고: sales_data 테이블에 constraint를 위반하는 데이터가 있습니다.';
        RAISE NOTICE '   다음 쿼리로 위반하는 entity를 확인하세요:';
        RAISE NOTICE '   SELECT DISTINCT entity FROM sales_data WHERE entity NOT IN (''HQ'', ''USA'', ''BWA'', ''Vietnam'', ''Healthcare'', ''Korot'', ''Japan'', ''China'', ''India'', ''Mexico'', ''Oceania'', ''Netherlands'', ''Germany'', ''UK'', ''Asia'', ''Europe'', ''Singapore'', ''Samhan'');';
        RAISE;
END $$;

-- 4. Update upload_history table constraint (if exists)
-- Note: upload_history might not have entity constraint, so we check first
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'upload_history' 
        AND constraint_name = 'valid_entity_upload_history'
    ) THEN
        ALTER TABLE upload_history DROP CONSTRAINT valid_entity_upload_history;
    END IF;
END $$;

-- Verify the changes
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname LIKE '%valid_entity%'
ORDER BY table_name, constraint_name;

