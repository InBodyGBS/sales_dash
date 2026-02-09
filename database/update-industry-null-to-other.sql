-- Update NULL industry values to 'Other' in sales_data table
-- This script updates all existing NULL industry values to 'Other'

UPDATE sales_data
SET industry = 'Other'
WHERE industry IS NULL OR industry = '';

-- Verify the update
SELECT 
  COUNT(*) as total_rows,
  COUNT(CASE WHEN industry IS NULL THEN 1 END) as null_industry_count,
  COUNT(CASE WHEN industry = 'Other' THEN 1 END) as other_industry_count
FROM sales_data;
