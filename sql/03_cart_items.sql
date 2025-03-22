-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON cart_items(product_id);

-- RLS Policies for cart_items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Create a function to check if a cart belongs to the authenticated user
CREATE OR REPLACE FUNCTION public.cart_belongs_to_auth_user(cart_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM carts
    WHERE id = cart_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy: Users can view their own cart items
CREATE POLICY "Users can view their own cart items"
  ON cart_items FOR SELECT
  USING (cart_belongs_to_auth_user(cart_id));

-- Policy: Users can insert items into their own carts
CREATE POLICY "Users can insert items into their own carts"
  ON cart_items FOR INSERT
  WITH CHECK (cart_belongs_to_auth_user(cart_id));

-- Policy: Users can update items in their own carts
CREATE POLICY "Users can update items in their own carts"
  ON cart_items FOR UPDATE
  USING (cart_belongs_to_auth_user(cart_id));

-- Policy: Users can delete items from their own carts
CREATE POLICY "Users can delete items from their own carts"
  ON cart_items FOR DELETE
  USING (cart_belongs_to_auth_user(cart_id)); 