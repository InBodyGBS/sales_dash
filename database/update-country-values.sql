-- Update Country values based on business rules
-- 
-- Rule 1: HQ, Healthcare, Korot
--   - If Group = 'CG12' and contains "(", extract text before "(" as Country
--   - Example: "USA (something)" -> "USA"
--   - Otherwise (Group != 'CG12' or Group = 'CG12' without "("), set Country = 'KOREA'
--
-- Rule 2: Asia, Singapore, Japan, China, Vietnam, India, Mexico, Oceania
--   - Use Region value as Country
--   - If Region is empty/null, use Entity name as Country
--
-- Rule 3: Samhan
--   - Always set Country = 'Korea'

-- ============================================
-- STEP 1: Create function to calculate Country value
-- ============================================
CREATE OR REPLACE FUNCTION calculate_country(
    p_entity VARCHAR(50),
    p_group VARCHAR(100),
    p_region VARCHAR(100)
) RETURNS VARCHAR(100) AS $$
DECLARE
    v_country VARCHAR(100);
BEGIN
    -- Initialize as NULL
    v_country := NULL;
    
    -- Rule 1: HQ, Healthcare, Korot
    -- If Group = 'CG12' and contains "(", extract text before "("
    -- Otherwise, set to 'KOREA'
    IF p_entity IN ('HQ', 'Healthcare', 'Korot') THEN
        IF p_group = 'CG12' AND p_group IS NOT NULL AND p_group LIKE '%(%' THEN
            v_country := TRIM(SPLIT_PART(p_group, '(', 1));
        ELSE
            v_country := 'KOREA';
        END IF;
    
    -- Rule 2: Asia, Singapore, Japan, China, Vietnam, India, Mexico, Oceania
    -- Use Region value, or Entity name if Region is empty/null
    ELSIF p_entity IN ('Asia', 'Singapore', 'Japan', 'China', 'Vietnam', 'India', 'Mexico', 'Oceania') THEN
        v_country := COALESCE(
            NULLIF(TRIM(p_region), ''),  -- Use region if not empty/null
            p_entity  -- Fallback to entity name
        );
    
    -- Rule 3: Samhan
    -- Always set Country = 'Korea'
    ELSIF p_entity = 'Samhan' THEN
        v_country := 'Korea';
    END IF;
    
    RETURN v_country;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Create indexes first for better performance
-- ============================================
-- NOTE: Run these one at a time if timeout occurs
-- CREATE INDEX IF NOT EXISTS idx_sales_entity ON sales_data(entity);
-- CREATE INDEX IF NOT EXISTS idx_sales_group ON sales_data("group");
-- CREATE INDEX IF NOT EXISTS idx_sales_region ON sales_data(region);
-- CREATE INDEX IF NOT EXISTS idx_sales_country ON sales_data(country);

-- Check if indexes exist first (optional)
-- SELECT indexname FROM pg_indexes WHERE tablename = 'sales_data' AND indexname LIKE 'idx_sales%';

-- ============================================
-- STEP 3: Update existing records with calculated Country values (BATCHED)
-- ============================================
-- Update in very small batches to avoid timeout
-- Run each step separately if timeout occurs

-- ============================================
-- IMPORTANT: If timeout occurs, run each Step 3-X block separately!
-- ============================================

-- Step 3-1: Update HQ
-- 3-1a: Update HQ (Group = 'CG12' with "(")
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = TRIM(SPLIT_PART("group", '(', 1))
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'HQ'
              AND "group" = 'CG12'
              AND "group" LIKE '%(%'
              AND (country IS NULL OR country != TRIM(SPLIT_PART("group", '(', 1)))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for HQ (CG12 with parenthesis) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed HQ (CG12 with parenthesis) updates. Total: % records', total_updated;
END $$;

-- Step 3-1b: Update HQ (all other cases -> 'KOREA')
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = 'KOREA'
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'HQ'
              AND (country IS NULL OR country != 'KOREA')
              AND NOT ("group" = 'CG12' AND "group" LIKE '%(%')
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for HQ (set to KOREA) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed HQ (KOREA) updates. Total: % records', total_updated;
END $$;

-- Step 3-2: Update Healthcare
-- 3-2a: Update Healthcare (Group = 'CG12' with "(")
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = TRIM(SPLIT_PART("group", '(', 1))
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Healthcare'
              AND "group" = 'CG12'
              AND "group" LIKE '%(%'
              AND (country IS NULL OR country != TRIM(SPLIT_PART("group", '(', 1)))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Healthcare (CG12 with parenthesis) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Healthcare (CG12 with parenthesis) updates. Total: % records', total_updated;
END $$;

-- Step 3-2b: Update Healthcare (all other cases -> 'KOREA')
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = 'KOREA'
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Healthcare'
              AND (country IS NULL OR country != 'KOREA')
              AND NOT ("group" = 'CG12' AND "group" LIKE '%(%')
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Healthcare (set to KOREA) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Healthcare (KOREA) updates. Total: % records', total_updated;
END $$;

-- Step 3-3: Update Korot
-- 3-3a: Update Korot (Group = 'CG12' with "(")
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = TRIM(SPLIT_PART("group", '(', 1))
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Korot'
              AND "group" = 'CG12'
              AND "group" LIKE '%(%'
              AND (country IS NULL OR country != TRIM(SPLIT_PART("group", '(', 1)))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Korot (CG12 with parenthesis) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Korot (CG12 with parenthesis) updates. Total: % records', total_updated;
END $$;

-- Step 3-3b: Update Korot (all other cases -> 'KOREA')
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = 'KOREA'
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Korot'
              AND (country IS NULL OR country != 'KOREA')
              AND NOT ("group" = 'CG12' AND "group" LIKE '%(%')
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Korot (set to KOREA) (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Korot (KOREA) updates. Total: % records', total_updated;
END $$;

-- Step 3-4: Update Asia
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Asia'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Asia (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Asia updates. Total: % records', total_updated;
END $$;

-- Step 3-5: Update Singapore
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Singapore'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Singapore (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Singapore updates. Total: % records', total_updated;
END $$;

-- Step 3-6: Update Japan
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Japan'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Japan (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Japan updates. Total: % records', total_updated;
END $$;

-- Step 3-7: Update China
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'China'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for China (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed China updates. Total: % records', total_updated;
END $$;

-- Step 3-8: Update Vietnam
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Vietnam'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Vietnam (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Vietnam updates. Total: % records', total_updated;
END $$;

-- Step 3-9: Update India
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'India'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for India (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed India updates. Total: % records', total_updated;
END $$;

-- Step 3-10: Update Mexico
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Mexico'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Mexico (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Mexico updates. Total: % records', total_updated;
END $$;

-- Step 3-11: Update Oceania
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = COALESCE(NULLIF(TRIM(region), ''), entity)
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Oceania'
              AND (country IS NULL OR country != COALESCE(NULLIF(TRIM(region), ''), entity))
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Oceania (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Oceania updates. Total: % records', total_updated;
END $$;

-- Step 3-12: Update Samhan (always set to 'Korea')
-- Run this block separately if needed
DO $$
DECLARE
    batch_size INTEGER := 200;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE sales_data
        SET country = 'Korea'
        WHERE id IN (
            SELECT id
            FROM sales_data
            WHERE entity = 'Samhan'
              AND (country IS NULL OR country != 'Korea')
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records for Samhan (total: %)', updated_count, total_updated;
        
        EXIT WHEN updated_count = 0;
        
        PERFORM pg_sleep(0.5);
    END LOOP;
    
    RAISE NOTICE '✅ Completed Samhan updates. Total: % records', total_updated;
END $$;

-- ============================================
-- STEP 4: Create trigger function to automatically update Country
-- ============================================
CREATE OR REPLACE FUNCTION update_country_on_change()
RETURNS TRIGGER AS $$
BEGIN
    NEW.country := calculate_country(NEW.entity, NEW."group", NEW.region);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: Create trigger to automatically update Country on INSERT/UPDATE
-- ============================================
-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_country ON sales_data;

-- Create trigger
CREATE TRIGGER trigger_update_country
    BEFORE INSERT OR UPDATE OF entity, "group", region ON sales_data
    FOR EACH ROW
    EXECUTE FUNCTION update_country_on_change();

-- ============================================
-- STEP 6: Verification queries (optional - can be run separately)
-- ============================================

-- Check Country distribution by Entity
SELECT 
    entity,
    country,
    COUNT(*) as record_count
FROM sales_data
WHERE country IS NOT NULL
GROUP BY entity, country
ORDER BY entity, country;

-- Check records with NULL country (should be minimal after update)
SELECT 
    entity,
    COUNT(*) as null_country_count
FROM sales_data
WHERE country IS NULL
GROUP BY entity
ORDER BY entity;

-- Check HQ, Healthcare, Korot with CG12 group
SELECT 
    entity,
    "group",
    country,
    COUNT(*) as record_count
FROM sales_data
WHERE entity IN ('HQ', 'Healthcare', 'Korot')
  AND "group" = 'CG12'
GROUP BY entity, "group", country
ORDER BY entity, country;

-- Check Asia, Singapore, Japan, China, Vietnam, India, Mexico, Oceania
SELECT 
    entity,
    region,
    country,
    COUNT(*) as record_count
FROM sales_data
WHERE entity IN ('Asia', 'Singapore', 'Japan', 'China', 'Vietnam', 'India', 'Mexico', 'Oceania')
GROUP BY entity, region, country
ORDER BY entity, country;

-- Check Samhan (should all be 'Korea')
SELECT 
    entity,
    country,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'Samhan'
GROUP BY entity, country
ORDER BY country;

