import { supabase } from '../lib/supabase';
import { Product } from '../types/product.types';

/**
 * Fetch all products or products filtered by category
 */
export async function getProducts(category?: string): Promise<Product[]> {
  try {
    let query = supabase.from('products').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) {
      console.error('Error fetching products:', error);
      throw new Error(error.message);
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception in getProducts:', error);
    return [];
  }
}

/**
 * Fetch a single product by id
 */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception in getProductById:', error);
    return null;
  }
}

/**
 * Search products by name or description
 */
export async function searchProducts(query: string, limit: number = 5): Promise<Product[]> {
  try {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const searchTerm = query.trim().toLowerCase();
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order('name')
      .limit(limit);
    
    if (error) {
      console.error('Error searching products:', error);
      throw new Error(error.message);
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception in searchProducts:', error);
    return [];
  }
}

/**
 * Get product categories 
 */
export async function getCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .order('category');
    
    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(error.message);
    }
    
    // Extract unique categories
    const categories = new Set(data.map(item => item.category));
    return Array.from(categories);
  } catch (error) {
    console.error('Exception in getCategories:', error);
    return [];
  }
} 