-- Insert column mappings for Mexico, India, Oceania
-- Same structure as Japan entity
-- This is a backup method if copying from Japan fails

-- Mexico Column Mapping
INSERT INTO column_mapping (entity, excel_column, db_column, is_active) VALUES
-- Invoice and Date
('Mexico', 'Invoice #', 'invoice', true),
('Mexico', '計上日', 'invoice_date', true),

-- Industry
('Mexico', 'Industry', 'industry', true),

-- Customer Information
('Mexico', 'Customer Code', 'account_number', true),
('Mexico', 'Customer Name', 'name', true),
('Mexico', 'Customer Name', 'name2', true),
('Mexico', 'Customer Name', 'customer_invoice_account', true),
('Mexico', 'Customer Code', 'invoice_account', true),
('Mexico', 'Customer Group', 'group', true),

-- Currency
('Mexico', 'Currency', 'currency', true),

-- Location
('Mexico', 'Region(Country)', 'street', true),
('Mexico', 'Region(City)', 'city', true),

-- Product Information
('Mexico', 'Item_code', 'item_number', true),
('Mexico', 'Item_name', 'product_name', true),

-- Quantity and Amount
('Mexico', 'Qty', 'quantity', true),
('Mexico', 'Amount', 'line_amount_mst', true),

-- Sales Information
('Mexico', 'Sales Rep', 'l_wk_name', true),
('Mexico', 'Sales Department', 'l_dim_cc', true),

-- India Column Mapping
-- Invoice and Date
('India', 'Invoice #', 'invoice', true),
('India', '計上日', 'invoice_date', true),

-- Industry
('India', 'Industry', 'industry', true),

-- Customer Information
('India', 'Customer Code', 'account_number', true),
('India', 'Customer Name', 'name', true),
('India', 'Customer Name', 'name2', true),
('India', 'Customer Name', 'customer_invoice_account', true),
('India', 'Customer Code', 'invoice_account', true),
('India', 'Customer Group', 'group', true),

-- Currency
('India', 'Currency', 'currency', true),

-- Location
('India', 'Region(Country)', 'street', true),
('India', 'Region(City)', 'city', true),

-- Product Information
('India', 'Item_code', 'item_number', true),
('India', 'Item_name', 'product_name', true),

-- Quantity and Amount
('India', 'Qty', 'quantity', true),
('India', 'Amount', 'line_amount_mst', true),

-- Sales Information
('India', 'Sales Rep', 'l_wk_name', true),
('India', 'Sales Department', 'l_dim_cc', true),

-- Oceania Column Mapping
-- Invoice and Date
('Oceania', 'Invoice #', 'invoice', true),
('Oceania', '計上日', 'invoice_date', true),

-- Industry
('Oceania', 'Industry', 'industry', true),

-- Customer Information
('Oceania', 'Customer Code', 'account_number', true),
('Oceania', 'Customer Name', 'name', true),
('Oceania', 'Customer Name', 'name2', true),
('Oceania', 'Customer Name', 'customer_invoice_account', true),
('Oceania', 'Customer Code', 'invoice_account', true),
('Oceania', 'Customer Group', 'group', true),

-- Currency
('Oceania', 'Currency', 'currency', true),

-- Location
('Oceania', 'Region(Country)', 'street', true),
('Oceania', 'Region(City)', 'city', true),

-- Product Information
('Oceania', 'Item_code', 'item_number', true),
('Oceania', 'Item_name', 'product_name', true),

-- Quantity and Amount
('Oceania', 'Qty', 'quantity', true),
('Oceania', 'Amount', 'line_amount_mst', true),

-- Sales Information
('Oceania', 'Sales Rep', 'l_wk_name', true),
('Oceania', 'Sales Department', 'l_dim_cc', true)

ON CONFLICT (entity, excel_column, db_column) 
DO UPDATE SET 
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verify the results
SELECT 
    entity,
    COUNT(*) as mapping_count
FROM column_mapping
WHERE entity IN ('Japan', 'Mexico', 'India', 'Oceania')
  AND is_active = true
GROUP BY entity
ORDER BY entity;

