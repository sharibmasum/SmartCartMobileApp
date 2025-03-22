// Script to populate the database with fruit products
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase URL and anon key from .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { 
    url: supabaseUrl ? 'set' : 'missing', 
    key: supabaseAnonKey ? 'set' : 'missing' 
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Array of fruit products to insert
const fruitProducts = [
  {
    name: 'Apple',
    description: 'Fresh red apple',
    price: 1.49,
    image_url: 'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'APPLE001',
    category: 'Fruit',
  },
  {
    name: 'Green Apple',
    description: 'Fresh Granny Smith apple',
    price: 1.59,
    image_url: 'https://images.unsplash.com/photo-1606006360326-c1d49cf5f1af?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'APPLE002',
    category: 'Fruit',
  },
  {
    name: 'Banana',
    description: 'Ripe yellow banana',
    price: 0.99,
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'BANANA001',
    category: 'Fruit',
  },
  {
    name: 'Orange',
    description: 'Juicy navel orange',
    price: 1.29,
    image_url: 'https://images.unsplash.com/photo-1547514701-42782101795e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'ORANGE001',
    category: 'Fruit',
  },
  {
    name: 'Strawberry',
    description: 'Sweet red strawberries (pack)',
    price: 3.99,
    image_url: 'https://images.unsplash.com/photo-1564518098628-c8012031d8b6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'STRAW001',
    category: 'Fruit',
  },
  {
    name: 'Blueberry',
    description: 'Fresh blueberries (pack)',
    price: 4.99,
    image_url: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'BLUE001',
    category: 'Fruit',
  },
  {
    name: 'Grapes',
    description: 'Red seedless grapes (bunch)',
    price: 2.99,
    image_url: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'GRAPE001',
    category: 'Fruit',
  },
  {
    name: 'Pineapple',
    description: 'Tropical pineapple',
    price: 3.49,
    image_url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'PINE001',
    category: 'Fruit',
  },
  {
    name: 'Mango',
    description: 'Sweet ripe mango',
    price: 2.49,
    image_url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'MANGO001',
    category: 'Fruit',
  },
  {
    name: 'Watermelon',
    description: 'Juicy watermelon (whole)',
    price: 5.99,
    image_url: 'https://images.unsplash.com/photo-1563114773-84221bd62daa?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'WATER001',
    category: 'Fruit',
  },
  {
    name: 'Kiwi',
    description: 'Green kiwi fruit (pack of 4)',
    price: 2.79,
    image_url: 'https://images.unsplash.com/photo-1618897996318-5a901fa6ca71?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'KIWI001',
    category: 'Fruit',
  },
  {
    name: 'Peach',
    description: 'Sweet juicy peach',
    price: 1.89,
    image_url: 'https://images.unsplash.com/photo-1595743825637-cdaef780622e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    barcode: 'PEACH001',
    category: 'Fruit',
  }
];

// Function to insert products
async function populateProducts() {
  console.log('Starting to populate products database...');
  
  for (const product of fruitProducts) {
    try {
      // Check if product already exists (by barcode)
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', product.barcode);
        
      if (existingProducts && existingProducts.length > 0) {
        console.log(`Product with barcode ${product.barcode} already exists. Updating...`);
        
        // Update the existing product
        const { error: updateError } = await supabase
          .from('products')
          .update(product)
          .eq('barcode', product.barcode);
          
        if (updateError) {
          console.error(`Error updating product ${product.name}:`, updateError);
        } else {
          console.log(`Updated product: ${product.name}`);
        }
      } else {
        // Insert new product
        const { error: insertError } = await supabase
          .from('products')
          .insert([product]);
          
        if (insertError) {
          console.error(`Error inserting product ${product.name}:`, insertError);
        } else {
          console.log(`Added new product: ${product.name}`);
        }
      }
    } catch (error) {
      console.error(`Error processing product ${product.name}:`, error);
    }
  }
  
  console.log('Database population completed!');
}

// Run the populate function
populateProducts()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed with error:', err);
    process.exit(1);
  }); 