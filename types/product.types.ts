export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  barcode: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ProductSearchParams {
  id?: string;
  barcode?: string;
  name?: string;
  category?: string;
}

export interface ScanResult {
  type: string;
  data: string;
  bounds?: {
    origin: [number, number];
    size: [number, number];
  };
} 