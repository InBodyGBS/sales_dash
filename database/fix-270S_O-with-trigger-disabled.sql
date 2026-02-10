-- Fix 270S_O issue by disabling the trigger temporarily
-- This will allow the update to work without being overridden

-- Step 1: Disable the auto_calculate_derived_columns trigger
ALTER TABLE sales_data DISABLE TRIGGER trg_calculate_derived_columns;

-- Step 2: Verify trigger is disabled
SELECT 
    'Trigger Status' as check_type,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN 'ENABLED'
        WHEN tgenabled = 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgrelid = 'sales_data'::regclass
  AND tgname = 'trg_calculate_derived_columns';

-- Step 3: Check current value before update
SELECT 
    'BEFORE UPDATE' as status,
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

-- Step 4: Update from item_mapping (with trigger disabled)
UPDATE sales_data sd
SET 
    fg_classification = imap.fg_classification,
    category = imap.category,
    model = imap.model,
    product = imap.product
FROM item_mapping imap
WHERE sd.item_number = imap.item_number
  AND sd.entity = imap.entity
  AND imap.item_number = '270S_O'
  AND imap.entity = 'Japan'
  AND imap.is_active = true;

-- Step 5: Also try direct update as backup
UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number = '270S_O'
  AND entity = 'Japan'
  AND EXISTS (
    SELECT 1 FROM item_mapping imap
    WHERE imap.item_number = '270S_O'
      AND imap.entity = 'Japan'
      AND imap.is_active = true
      AND imap.fg_classification = 'FG'
  );

-- Step 6: Check value after update
SELECT 
    'AFTER UPDATE' as status,
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

-- Step 7: Re-enable the trigger (uncomment when ready)
-- ALTER TABLE sales_data ENABLE TRIGGER trg_calculate_derived_columns;

-- IMPORTANT: After re-enabling, the trigger will run on future INSERT/UPDATE
-- You may need to modify the function to preserve fg_classification from item_mapping
