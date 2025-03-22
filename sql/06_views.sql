-- View for getting cart items with product details
CREATE OR REPLACE VIEW cart_items_with_products AS
SELECT
  ci.id,
  ci.cart_id,
  ci.product_id,
  ci.quantity,
  p.name as product_name,
  p.price as product_price,
  p.image_url as product_image,
  p.barcode as product_barcode,
  p.category as product_category,
  (p.price * ci.quantity) as total_price,
  ci.created_at,
  ci.updated_at
FROM
  cart_items ci
JOIN
  products p ON ci.product_id = p.id;

-- View for getting active carts with their total price and item count
CREATE OR REPLACE VIEW active_carts_summary AS
SELECT
  c.id as cart_id,
  c.user_id,
  c.status,
  c.created_at,
  c.updated_at,
  c.checkout_at,
  COALESCE(SUM(p.price * ci.quantity), 0) as total_price,
  COALESCE(SUM(ci.quantity), 0) as total_items
FROM
  carts c
LEFT JOIN
  cart_items ci ON c.id = ci.cart_id
LEFT JOIN
  products p ON ci.product_id = p.id
WHERE
  c.status = 'active'
GROUP BY
  c.id, c.user_id, c.status, c.created_at, c.updated_at, c.checkout_at; 