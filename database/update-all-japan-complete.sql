-- Complete Japan sales_data update from item_mapping and item_master
-- This updates ALL Japan records, not just 270S_O
-- Trigger is disabled to prevent override

-- Step 1: Check current status BEFORE update
SELECT 
    'BEFORE UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as with_fg,
    COUNT(CASE WHEN fg_classification = 'FG' THEN 1 END) as fg_count,
    COUNT(CASE WHEN fg_classification = 'NonFG' THEN 1 END) as nonfg_count,
    COUNT(CASE WHEN fg_classification IS NULL THEN 1 END) as null_count
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL;

-- Step 2: Disable the trigger (if not already disabled)
ALTER TABLE sales_data DISABLE TRIGGER trg_calculate_derived_columns;

-- Step 3: Verify trigger is disabled
SELECT 
    'Trigger Status' as check_type,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN 'ENABLED'
        WHEN tgenabled = 'D' THEN 'DISABLED ✅'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgrelid = 'sales_data'::regclass
  AND tgname = 'trg_calculate_derived_columns';

-- Step 4: Update from item_master (applies to ALL entities, but we filter for Japan)
-- Priority 1: item_master (global mappings)
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

-- Step 5: Update from item_mapping (entity-specific, only if not in item_master)
-- Priority 2: item_mapping (entity-specific mappings)
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(imap.fg_classification, sd.fg_classification),
    category = COALESCE(imap.category, sd.category),
    model = COALESCE(imap.model, sd.model),
    product = COALESCE(imap.product, sd.product)
FROM item_mapping imap
WHERE sd.item_number = imap.item_number
  AND sd.entity = 'Japan'
  AND imap.entity = 'Japan'
  AND imap.is_active = true
  AND NOT EXISTS (
    -- Skip if item_master has this item_number (item_master has priority)
    SELECT 1 FROM item_master im
    WHERE im.item_number = sd.item_number
      AND im.is_active = true
  )
  AND (
    imap.fg_classification IS NOT NULL OR
    imap.category IS NOT NULL OR
    imap.model IS NOT NULL OR
    imap.product IS NOT NULL
  );

-- Step 6: Check status AFTER update
SELECT 
    'AFTER UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as with_fg,
    COUNT(CASE WHEN fg_classification = 'FG' THEN 1 END) as fg_count,
    COUNT(CASE WHEN fg_classification = 'NonFG' THEN 1 END) as nonfg_count,
    COUNT(CASE WHEN fg_classification IS NULL THEN 1 END) as null_count
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL;

-- Step 7: Check specific item 270S_O to verify
SELECT 
    '270S_O Check' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category, model;

-- Step 8: Sample of updated records (top 10)
SELECT 
    'Sample Updated Records' as status,
    item_number,
    fg_classification,
    category,
    model,
    product,
    COUNT(*) as record_count
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL
  AND fg_classification IS NOT NULL
GROUP BY item_number, fg_classification, category, model, product
ORDER BY record_count DESC
LIMIT 10;

-- Step 9: Next steps - Modify function and re-enable trigger
-- After this update is successful, run: fix-and-re-enable-trigger.sql
-- This will:
--   1. Modify the auto_calculate_derived_columns function to preserve item_mapping values
--   2. Re-enable the trigger
--   3. Test that 270S_O still has 'FG' after re-enabling
