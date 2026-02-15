-- Item Mapping Table
-- Maps Entity + Item Number to fg_classification, category, model, product
-- Used for Japan, China, India, Mexico, Oceania (entities requiring FG classification)

CREATE TABLE IF NOT EXISTS item_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity VARCHAR(50) NOT NULL,
    item_number VARCHAR(200) NOT NULL,
    fg_classification VARCHAR(100),
    category VARCHAR(200),
    model VARCHAR(200),
    product VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity, item_number),
    CONSTRAINT valid_entity_item_mapping CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania'))
);

CREATE INDEX IF NOT EXISTS idx_item_mapping_entity_item ON item_mapping(entity, item_number);
CREATE INDEX IF NOT EXISTS idx_item_mapping_active ON item_mapping(entity, item_number, is_active) WHERE is_active = true;

COMMENT ON TABLE item_mapping IS 'Maps Entity + Item Number to fg_classification, category, model, product for Japan, China, India, Mexico, Oceania';

