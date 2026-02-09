-- Insert initial column mapping for Japan entity
-- Based on the template provided
-- Note: entity column is automatically set during upload, no mapping needed

INSERT INTO column_mapping (entity, excel_column, db_column, is_active) VALUES
-- Invoice and Date
('Japan', 'Invoice #', 'invoice', true),
('Japan', '計上日', 'invoice_date', true),

-- Industry
('Japan', 'Industry', 'industry', true),

-- Customer Information
('Japan', 'Customer Code', 'account_number', true),
('Japan', 'Customer Name', 'name', true),
('Japan', 'Customer Name', 'name2', true),
('Japan', 'Customer Name', 'customer_invoice_account', true),
('Japan', 'Customer Code', 'invoice_account', true),
('Japan', 'Customer Group', 'group', true),

-- Currency
('Japan', 'Currency', 'currency', true),

-- Location
('Japan', 'Region(Country)', 'street', true),
('Japan', 'Region(City)', 'city', true),

-- Product Information
('Japan', 'Item_code', 'item_number', true),
('Japan', 'Item_name', 'product_name', true),

-- Quantity and Amount
('Japan', 'Qty', 'quantity', true),
('Japan', 'Amount', 'line_amount_mst', true),

-- Sales Information
('Japan', 'Sales Rep', 'l_wk_name', true),
('Japan', 'Sales Department', 'l_dim_cc', true)

ON CONFLICT (entity, excel_column, db_column) 
DO UPDATE SET 
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

