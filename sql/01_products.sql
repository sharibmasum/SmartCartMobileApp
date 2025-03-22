-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  image_url TEXT,
  barcode TEXT UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on barcode for faster lookups
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

-- Enable RLS but allow public read access
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read products
CREATE POLICY "Allow public read access to products"
  ON products FOR SELECT
  TO PUBLIC
  USING (true);

-- Insert all products, including basic items and fruits 
INSERT INTO products (name, description, price, barcode, category, image_url)
VALUES 
  -- Basic products
  ('Apple', 'Fresh red apple', 0.99, '123456789', 'Fruits', 'https://example.com/apple.jpg'),
  ('Banana', 'Yellow banana bunch', 1.29, '234567890', 'Fruits', 'https://example.com/banana.jpg'),
  ('Milk', 'Whole milk 1 gallon', 3.49, '345678901', 'Dairy', 'https://example.com/milk.jpg'),
  ('Bread', 'Whole wheat bread', 2.49, '456789012', 'Bakery', 'https://example.com/bread.jpg'),
  ('Eggs', 'Large eggs, dozen', 3.99, '567890123', 'Dairy', 'https://example.com/eggs.jpg'),
  ('Chicken', 'Boneless chicken breast', 5.99, '678901234', 'Meat', 'https://example.com/chicken.jpg'),
  ('Rice', 'White rice, 2 lb bag', 3.29, '789012345', 'Grains', 'https://example.com/rice.jpg'),
  ('Pasta', 'Spaghetti, 16 oz', 1.79, '890123456', 'Grains', 'https://example.com/pasta.jpg'),
  ('Tomatoes', 'Roma tomatoes, 1 lb', 2.49, '901234567', 'Vegetables', 'https://example.com/tomatoes.jpg'),
  ('Cheese', 'Cheddar cheese block', 4.99, '012345678', 'Dairy', 'https://example.com/cheese.jpg')
ON CONFLICT (barcode) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  updated_at = now(); 