-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS payments_cart_id_idx ON payments(cart_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);

-- RLS Policies for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payments
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    cart_id IN (
      SELECT id FROM carts
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own payments
CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT
  WITH CHECK (
    cart_id IN (
      SELECT id FROM carts
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update their own payments
CREATE POLICY "Users can update their own payments"
  ON payments FOR UPDATE
  USING (
    cart_id IN (
      SELECT id FROM carts
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own payments (though typically payments should not be deleted)
CREATE POLICY "Users can delete their own payments"
  ON payments FOR DELETE
  USING (
    cart_id IN (
      SELECT id FROM carts
      WHERE user_id = auth.uid()
    )
  ); 