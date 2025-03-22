-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables to update the updated_at column
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to update timestamps on update
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update product timestamps
CREATE TRIGGER update_product_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Trigger to update cart timestamps
CREATE TRIGGER update_cart_timestamp
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Trigger to update cart item timestamps
CREATE TRIGGER update_cart_item_timestamp
BEFORE UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Function to create a cart for demo user (bypassing RLS)
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