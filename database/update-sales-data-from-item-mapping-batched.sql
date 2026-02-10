-- Update sales_data from item_mapping and item_master (BATCHED VERSION)
-- This script updates fg_classification, category, model, and product fields
-- Priority: item_master > item_mapping (entity-specific)
-- Uses batched updates to avoid timeout

-- ============================================
-- STEP 1: Update from item_master (ALL entities)
-- ============================================
-- Update in batches of 1000 records at a time
DO $$
DECLARE
    batch_size INTEGER := 1000;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        -- Update a batch
        WITH batch_to_update AS (
            SELECT DISTINCT sd.id
            FROM sales_data sd
            INNER JOIN item_master im ON sd.item_number = im.item_number
            WHERE im.is_active = true
              AND (
                im.fg_classification IS NOT NULL OR
                im.category IS NOT NULL OR
                im.model IS NOT NULL OR
                im.product IS NOT NULL
              )
              AND (
                sd.fg_classification IS DISTINCT FROM im.fg_classification OR
                sd.category IS DISTINCT FROM im.category OR
                sd.model IS DISTINCT FROM im.model OR
                sd.product IS DISTINCT FROM im.product
              )
            LIMIT batch_size
        )
        UPDATE sales_data sd
        SET 
            fg_classification = COALESCE(im.fg_classification, sd.fg_classification),
            category = COALESCE(im.category, sd.category),
            model = COALESCE(im.model, sd.model),
            product = COALESCE(im.product, sd.product)
        FROM item_master im
        WHERE sd.id IN (SELECT id FROM batch_to_update)
          AND sd.item_number = im.item_number
          AND im.is_active = true;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records from item_master (total: %)', updated_count, total_updated;
        
        -- Exit if no more records to update
        EXIT WHEN updated_count = 0;
        
        -- Small delay to avoid overwhelming the database
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RAISE NOTICE '✅ Completed item_master updates. Total: % records', total_updated;
END $$;

-- ============================================
-- STEP 2: Update from item_mapping (entity-specific)
-- ============================================
-- Update in batches of 1000 records at a time
DO $$
DECLARE
    batch_size INTEGER := 1000;
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    LOOP
        -- Update a batch
        WITH batch_to_update AS (
            SELECT DISTINCT sd.id
            FROM sales_data sd
            INNER JOIN item_mapping imap ON sd.item_number = imap.item_number AND sd.entity = imap.entity
            WHERE imap.is_active = true
              AND NOT EXISTS (
                -- Skip if item_master has this item_number
                SELECT 1 FROM item_master im
                WHERE im.item_number = sd.item_number
                  AND im.is_active = true
              )
              AND (
                imap.fg_classification IS NOT NULL OR
                imap.category IS NOT NULL OR
                imap.model IS NOT NULL OR
                imap.product IS NOT NULL
              )
              AND (
                sd.fg_classification IS DISTINCT FROM imap.fg_classification OR
                sd.category IS DISTINCT FROM imap.category OR
                sd.model IS DISTINCT FROM imap.model OR
                sd.product IS DISTINCT FROM imap.product
              )
            LIMIT batch_size
        )
        UPDATE sales_data sd
        SET 
            fg_classification = COALESCE(imap.fg_classification, sd.fg_classification),
            category = COALESCE(imap.category, sd.category),
            model = COALESCE(imap.model, sd.model),
            product = COALESCE(imap.product, sd.product)
        FROM item_mapping imap
        WHERE sd.id IN (SELECT id FROM batch_to_update)
          AND sd.item_number = imap.item_number
          AND sd.entity = imap.entity
          AND imap.is_active = true;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        
        RAISE NOTICE 'Updated % records from item_mapping (total: %)', updated_count, total_updated;
        
        -- Exit if no more records to update
        EXIT WHEN updated_count = 0;
        
        -- Small delay to avoid overwhelming the database
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RAISE NOTICE '✅ Completed item_mapping updates. Total: % records', total_updated;
END $$;

-- ============================================
-- STEP 3: Check specific item (270S_0)
-- ============================================
SELECT 
    'After Update' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_0'
GROUP BY entity, item_number, fg_classification, category, model, product
ORDER BY entity;
