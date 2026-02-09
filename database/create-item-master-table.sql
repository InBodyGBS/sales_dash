-- Item Master Table
-- Master mapping table for Item Number to fg_classification, category, model, product
-- Can be used across all entities without entity-specific mapping

CREATE TABLE IF NOT EXISTS item_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_number VARCHAR(200) NOT NULL UNIQUE,
    fg_classification VARCHAR(100),
    category VARCHAR(200),
    model VARCHAR(200),
    product VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_master_item_number ON item_master(item_number);
CREATE INDEX IF NOT EXISTS idx_item_master_active ON item_master(item_number, is_active) WHERE is_active = true;

COMMENT ON TABLE item_master IS 'Master mapping table for Item Number to fg_classification, category, model, product. Used across all entities.';

