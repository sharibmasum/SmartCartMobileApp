-- Special handling for demo user
-- This script contains functions needed to handle a demo user without authentication

-- Demo user UUID
-- 550e8400-e29b-41d4-a716-446655440000

-- Function to create a cart for the demo user
CREATE OR REPLACE FUNCTION create_demo_cart(demo_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_cart_id UUID;
BEGIN
  -- Check if demo user already has an active cart
  SELECT id INTO new_cart_id FROM carts 
  WHERE user_id = demo_user_id AND status = 'active'
  LIMIT 1;
  
  -- If no cart exists, create one
  IF new_cart_id IS NULL THEN
    INSERT INTO carts (user_id, status)
    VALUES (demo_user_id, 'active')
    RETURNING id INTO new_cart_id;
  END IF;
  
  RETURN new_cart_id;
END;
$$;

-- Function to add an item to the demo user's cart
CREATE OR REPLACE FUNCTION add_demo_cart_item(
  demo_cart_id UUID,
  demo_product_id UUID,
  demo_quantity INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_item_id UUID;
  new_item_id UUID;
BEGIN
  -- Check if item already exists in cart
  SELECT id INTO existing_item_id
  FROM cart_items
  WHERE cart_id = demo_cart_id AND product_id = demo_product_id;
  
  IF existing_item_id IS NOT NULL THEN
    -- Update quantity of existing item
    UPDATE cart_items
    SET quantity = quantity + demo_quantity
    WHERE id = existing_item_id;
    
    RETURN existing_item_id;
  ELSE
    -- Insert new item
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (demo_cart_id, demo_product_id, demo_quantity)
    RETURNING id INTO new_item_id;
    
    RETURN new_item_id;
  END IF;
END;
$$;

-- Function to remove an item from the demo user's cart
CREATE OR REPLACE FUNCTION remove_demo_cart_item(demo_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM cart_items
  WHERE id = demo_item_id;
  
  RETURN FOUND;
END;
$$;

-- Function to update the quantity of an item in the demo user's cart
CREATE OR REPLACE FUNCTION update_demo_cart_item_quantity(
  demo_item_id UUID,
  new_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF new_quantity <= 0 THEN
    -- Remove item if quantity is 0 or negative
    RETURN (SELECT * FROM remove_demo_cart_item(demo_item_id));
  ELSE
    -- Update quantity
    UPDATE cart_items
    SET quantity = new_quantity
    WHERE id = demo_item_id;
    
    RETURN FOUND;
  END IF;
END;
$$;

-- Create a special RLS policy that allows the demo user ID to access products
-- This ensures the demo user can browse products without authentication
CREATE POLICY "Allow public read access to products"
  ON products FOR SELECT
  TO PUBLIC
  USING (true);
