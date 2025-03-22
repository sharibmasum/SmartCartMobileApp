import { Product } from './product.types';

export interface CartItem {
  id: string;
  product_id: string;
  cart_id: string;
  quantity: number;
  product: Product;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
  checkout_at: string | null;
  items: CartItem[];
}

export interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;
}

export interface CartContextProps {
  state: CartState;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  checkout: () => Promise<void>;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

export interface Payment {
  id: string;
  cart_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
} 