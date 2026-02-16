-- ============================================
-- Add New Entities: Netherlands, Germany, UK, Asia, Europe
-- Dashboard: USA 방식
-- Upload/Mapping: Japan 방식
-- ============================================

-- 1. Entity Currency Mapping 추가
-- 참고: Asia는 MYR과 SGD를 모두 사용하므로 주 통화로 MYR 설정

-- 1-1. 먼저 entity_currency 테이블이 있는지 확인하고 없으면 생성
CREATE TABLE IF NOT EXISTS entity_currency (
    entity VARCHAR(50) PRIMARY KEY,
    currency VARCHAR(10) NOT NULL
);

-- 1-2. 권한 부여
GRANT SELECT ON entity_currency TO authenticated, anon, service_role;

-- 1-3. 데이터 삽입 (중복 시 업데이트)
INSERT INTO entity_currency (entity, currency) VALUES
('Netherlands', 'EUR'),
('Germany', 'EUR'),
('UK', 'EUR'),
('Asia', 'MYR'),  -- Asia는 MYR, SGD 혼용 (주 통화: MYR)
('Europe', 'EUR')
ON CONFLICT (entity) DO UPDATE SET currency = EXCLUDED.currency;

-- 2. Exchange Rate 테이블 확인 (필요시 추가)
-- Netherlands, Germany, UK, Europe은 EUR 사용
-- Asia는 MYR, SGD 사용 (주 통화: MYR)

-- 2-1. exchange_rate 테이블이 있는지 확인하고 없으면 생성
CREATE TABLE IF NOT EXISTS exchange_rate (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL,
    rate DECIMAL(15, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(year, currency)
);

-- 2-2. 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_rate TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE exchange_rate_id_seq TO authenticated, anon, service_role;

-- 2-3. 샘플 환율 데이터 (실제 환율로 업데이트 필요)
INSERT INTO exchange_rate (year, currency, rate) VALUES
(2024, 'EUR', 1450),
(2024, 'MYR', 300),
(2024, 'SGD', 950),
(2025, 'EUR', 1450),
(2025, 'MYR', 300),
(2025, 'SGD', 950),
(2026, 'EUR', 1450),
(2026, 'MYR', 300),
(2026, 'SGD', 950)
ON CONFLICT (year, currency) DO UPDATE SET rate = EXCLUDED.rate;

-- 3. Sales Data, Column Mapping, Item Mapping 제약 조건 업데이트
-- 주의: 이 스크립트는 초기 설정용입니다.
-- 실행 후에는 각 entity의 매핑을 독립적으로 관리하세요.
-- 이 스크립트를 다시 실행하면 기존 커스텀 매핑이 모두 삭제되고 Japan 매핑으로 덮어씌워집니다!

-- 3-1. sales_data 테이블 CHECK 제약 조건 업데이트 (새 entity 허용)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity'
          AND conrelid = 'sales_data'::regclass
    ) THEN
        -- 기존 CHECK 제약 조건 삭제
        ALTER TABLE sales_data DROP CONSTRAINT valid_entity;
        RAISE NOTICE '✅ sales_data: 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- 새 CHECK 제약 조건 추가 (새 entity 포함)
    ALTER TABLE sales_data 
    ADD CONSTRAINT valid_entity 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe'));
    
    RAISE NOTICE '✅ sales_data: 새 CHECK 제약 조건이 추가되었습니다 (새 entity 포함).';
END $$;

-- 3-2. item_mapping 테이블 CHECK 제약 조건 업데이트 (새 entity 허용)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity_item_mapping'
          AND conrelid = 'item_mapping'::regclass
    ) THEN
        -- 기존 CHECK 제약 조건 삭제
        ALTER TABLE item_mapping DROP CONSTRAINT valid_entity_item_mapping;
        RAISE NOTICE '✅ item_mapping: 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- 새 CHECK 제약 조건 추가 (새 entity 포함)
    ALTER TABLE item_mapping 
    ADD CONSTRAINT valid_entity_item_mapping 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe'));
    
    RAISE NOTICE '✅ item_mapping: 새 CHECK 제약 조건이 추가되었습니다 (새 entity 포함).';
END $$;

-- 3-3. column_mapping 테이블 제약 조건 업데이트
DO $$ 
BEGIN
    -- Step 1: CHECK 제약 조건 업데이트 (새 entity 허용)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_entity_mapping'
          AND conrelid = 'column_mapping'::regclass
    ) THEN
        -- 기존 CHECK 제약 조건 삭제
        ALTER TABLE column_mapping DROP CONSTRAINT valid_entity_mapping;
        RAISE NOTICE '✅ 기존 CHECK 제약 조건이 삭제되었습니다.';
    END IF;
    
    -- 새 CHECK 제약 조건 추가 (새 entity 포함)
    ALTER TABLE column_mapping 
    ADD CONSTRAINT valid_entity_mapping 
    CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe'));
    
    RAISE NOTICE '✅ 새 CHECK 제약 조건이 추가되었습니다 (새 entity 포함).';
    
    -- Step 2: UNIQUE 제약 조건 추가
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'column_mapping_entity_excel_column_key'
          AND conrelid = 'column_mapping'::regclass
    ) THEN
        -- 중복 데이터 제거 (ctid를 사용하여 하나만 남김)
        DELETE FROM column_mapping
        WHERE ctid NOT IN (
            SELECT MIN(ctid)
            FROM column_mapping
            GROUP BY entity, excel_column
        );
        
        RAISE NOTICE '✅ 중복 데이터가 제거되었습니다.';
        
        -- UNIQUE 제약 조건 추가
        ALTER TABLE column_mapping 
        ADD CONSTRAINT column_mapping_entity_excel_column_key 
        UNIQUE (entity, excel_column);
        
        RAISE NOTICE '✅ UNIQUE 제약 조건이 추가되었습니다: (entity, excel_column)';
    ELSE
        RAISE NOTICE 'ℹ️ UNIQUE 제약 조건이 이미 존재합니다.';
    END IF;
END $$;

-- 4. 기존 매핑 삭제 (새로 추가할 entity들만)
-- ⚠️ 주의: 이미 커스터마이징한 매핑이 있다면 삭제됩니다!
DELETE FROM column_mapping 
WHERE entity IN ('Netherlands', 'Germany', 'UK', 'Asia', 'Europe');

-- 5. Japan 매핑을 복사하여 초기 매핑 생성
-- 각 entity는 이후 독립적으로 관리됩니다.

-- Netherlands
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'Netherlands', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true;

-- Germany
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'Germany', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true;

-- UK
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'UK', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true;

-- Asia
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'Asia', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true;

-- Europe
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'Europe', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan'
  AND is_active = true;

-- 6. 결과 확인
SELECT entity, COUNT(*) as mapping_count
FROM column_mapping
WHERE entity IN ('Netherlands', 'Germany', 'UK', 'Asia', 'Europe')
  AND is_active = true
GROUP BY entity
ORDER BY entity;

-- 7. Entity Currency 확인
SELECT * FROM entity_currency
WHERE entity IN ('Netherlands', 'Germany', 'UK', 'Asia', 'Europe')
ORDER BY entity;

-- 8. Exchange Rate 확인
SELECT * FROM exchange_rate
WHERE currency IN ('EUR', 'GBP', 'MYR', 'SGD')
ORDER BY year, currency;

