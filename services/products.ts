import { supabase } from './supabase';
import { Product, ProductSearchParams } from '../types/product.types';

// Get a product by barcode
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .single();
  
  if (error) {
    console.error('Error fetching product by barcode:', error);
    return null;
  }
  
  return data as Product;
};

// Get products with optional filtering
export const getProducts = async (params?: ProductSearchParams): Promise<Product[]> => {
  let query = supabase.from('products').select('*');
  
  if (params) {
    if (params.barcode) {
      query = query.eq('barcode', params.barcode);
    }
    
    if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    }
    
    if (params.category) {
      query = query.eq('category', params.category);
    }
  }
  
  const { data, error } = await query.order('name');
  
  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  
  return data as Product[];
};

// Get product by ID
export const getProductById = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching product by ID:', error);
    return null;
  }
  
  return data as Product;
};

// Get product categories
export const getProductCategories = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .order('category');
  
  if (error) {
    console.error('Error fetching product categories:', error);
    return [];
  }
  
  // Extract unique categories
  const categories = new Set<string>();
  data.forEach(item => {
    if (item.category) {
      categories.add(item.category);
    }
  });
  
  return Array.from(categories);
}; 