-- Instead of renaming a non-existent column, add the new one
ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Enable Row Level Security for carts and cart_items
ALTER TABLE IF EXISTS carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS allow_user_cart_read ON carts;
DROP POLICY IF EXISTS allow_user_cart_insert ON carts;
DROP POLICY IF EXISTS allow_user_cart_update ON carts;
DROP POLICY IF EXISTS allow_user_cart_delete ON carts;

DROP POLICY IF EXISTS allow_user_cart_items_read ON cart_items;
DROP POLICY IF EXISTS allow_user_cart_items_insert ON cart_items;
DROP POLICY IF EXISTS allow_user_cart_items_update ON cart_items;
DROP POLICY IF EXISTS allow_user_cart_items_delete ON cart_items;

-- Create new policies for carts table
-- Allow users to read their own carts
CREATE POLICY allow_user_cart_read ON carts 
FOR SELECT USING (auth.uid() = user_id);

-- Allow users to create carts for themselves
CREATE POLICY allow_user_cart_insert ON carts 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own carts
CREATE POLICY allow_user_cart_update ON carts 
FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own carts
CREATE POLICY allow_user_cart_delete ON carts 
FOR DELETE USING (auth.uid() = user_id);

-- Create new policies for cart_items table
-- Allow users to read items in their own carts
CREATE POLICY allow_user_cart_items_read ON cart_items 
FOR SELECT USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

-- Allow users to add items to their own carts
CREATE POLICY allow_user_cart_items_insert ON cart_items 
FOR INSERT WITH CHECK (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

-- Allow users to update items in their own carts
CREATE POLICY allow_user_cart_items_update ON cart_items 
FOR UPDATE USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

-- Allow users to delete items from their own carts
CREATE POLICY allow_user_cart_items_delete ON cart_items 
FOR DELETE USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

-- Ensure products table is accessible by all authenticated users
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_products_read ON products;
CREATE POLICY allow_products_read ON products FOR SELECT USING (true);

-- Create a view for cart items with products for easier querying
DROP VIEW IF EXISTS cart_items_with_products CASCADE;
CREATE VIEW cart_items_with_products AS
SELECT 
    ci.id,
    ci.cart_id,
    ci.product_id,
    ci.quantity,
    ci.created_at,
    ci.updated_at,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image_url,
    p.description as product_description,
    p.barcode as product_barcode,
    p.category as product_category
FROM cart_items ci
JOIN products p ON ci.product_id = p.id;

-- Create a policy to allow users to view their own cart items with products
ALTER VIEW cart_items_with_products OWNER TO postgres;
DROP POLICY IF EXISTS allow_cart_items_with_products_read ON cart_items_with_products;
COMMENT ON VIEW cart_items_with_products IS 'View for cart items with product details';

-- Create a function to return active cart for a user
DROP FUNCTION IF EXISTS get_active_cart(uuid);
CREATE OR REPLACE FUNCTION get_active_cart(user_id uuid)
RETURNS SETOF carts
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM carts 
    WHERE user_id = get_active_cart.user_id 
    AND status = 'active' 
    ORDER BY created_at DESC 
    LIMIT 1;
$$;

-- Create a function to insert a new cart item
DROP FUNCTION IF EXISTS create_cart_item(uuid, uuid, int);
CREATE OR REPLACE FUNCTION create_cart_item(p_cart_id uuid, p_product_id uuid, p_quantity int)
RETURNS SETOF cart_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cart_user_id uuid;
    v_new_item_id uuid;
BEGIN
    -- Check if the cart belongs to the current user
    SELECT user_id INTO v_cart_user_id 
    FROM carts 
    WHERE id = p_cart_id;
    
    IF v_cart_user_id IS NULL OR v_cart_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cart not found or not owned by the current user';
    END IF;
    
    -- Insert the cart item
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (p_cart_id, p_product_id, p_quantity)
    RETURNING id INTO v_new_item_id;
    
    -- Return the created item with product information
    RETURN QUERY
    SELECT ci.* 
    FROM cart_items ci
    WHERE ci.id = v_new_item_id;
END;
$$;

-- Add the payment_method column if it doesn't exist
ALTER TABLE carts 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50); 