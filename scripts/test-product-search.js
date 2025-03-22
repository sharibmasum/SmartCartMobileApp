// Test script for product search functionality
import { getProducts } from '../services/products';

// Sample food items to search for
const TEST_FOOD_ITEMS = [
  'Apple',
  'Banana',
  'Orange',
  'Chicken',
  'Tomato',
  'NonExistentFood' // This should not find a match
];

// Function to run the test
async function testProductSearch() {
  console.log('Testing product search functionality...');
  
  for (const foodName of TEST_FOOD_ITEMS) {
    console.log(`\nSearching for "${foodName}"`);
    
    try {
      // Search by name
      const products = await getProducts({ name: foodName });
      
      if (products && products.length > 0) {
        console.log(`Found ${products.length} products:`);
        products.forEach(product => {
          console.log(`- ${product.name} (${product.category}): $${product.price}`);
        });
      } else {
        console.log('No products found.');
        
        // If no exact match, try a more fuzzy search by getting the first word
        const firstWord = foodName.split(/\s+/)[0];
        const wordProducts = await getProducts({ name: firstWord });
        
        if (wordProducts && wordProducts.length > 0) {
          console.log(`Found ${wordProducts.length} products by first word "${firstWord}":`);
          wordProducts.forEach(product => {
            console.log(`- ${product.name} (${product.category}): $${product.price}`);
          });
        } else {
          console.log(`No products found by first word "${firstWord}" either.`);
          
          // Try searching by category as last resort
          // Common categories: Fruit, Vegetable, Meat, Dairy, Bakery
          for (const category of ['Fruit', 'Vegetable', 'Meat', 'Dairy', 'Bakery']) {
            const categoryProducts = await getProducts({ category });
            
            if (categoryProducts && categoryProducts.length > 0) {
              console.log(`Found ${categoryProducts.length} products in category "${category}":`);
              console.log(`Sample product: ${categoryProducts[0].name}: $${categoryProducts[0].price}`);
              console.log('... (more products available)');
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error searching for "${foodName}":`, error);
    }
  }
}

// Run the test
testProductSearch(); 