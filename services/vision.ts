// Import the environment variable
import { GOOGLE_CLOUD_VISION_API_KEY } from "@env";
import { getProducts } from "./products";
import { Product } from "../types/product.types";

// Log key format for debugging (without exposing the full key)
if (GOOGLE_CLOUD_VISION_API_KEY) {
  console.log(`API Key loaded, starts with: ${GOOGLE_CLOUD_VISION_API_KEY.substring(0, 4)}...`);
  console.log(`API Key length: ${GOOGLE_CLOUD_VISION_API_KEY.length} characters`);
  
  // Check if it has quotes that need to be removed
  if (GOOGLE_CLOUD_VISION_API_KEY.startsWith('"') || GOOGLE_CLOUD_VISION_API_KEY.startsWith("'")) {
    console.warn('Warning: API key has quotation marks that need to be removed from your .env file');
  }
  
  // Check if key has the correct format (Google API keys start with AIza)
  if (!GOOGLE_CLOUD_VISION_API_KEY.replace(/["']/g, '').startsWith('AIza')) {
    console.error('ERROR: Your API key doesn\'t match the expected format for Google Cloud API keys.');
    console.error('Google Cloud API keys typically start with "AIza". Please check your key in the Google Cloud Console.');
    console.error('Your key appears to be a different type of credential that won\'t work with the Vision API.');
  }
} else {
  console.error('No Google Cloud Vision API key found in environment variables. Please check your .env file.');
}

// Clean the API key by removing any quotes that might have been included
const cleanApiKey = GOOGLE_CLOUD_VISION_API_KEY ? 
  GOOGLE_CLOUD_VISION_API_KEY.replace(/["']/g, '') : '';

// Setup the API URL with the cleaned key from environment variables
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${cleanApiKey}`;

// Flag to enable mock mode when API key is invalid
const MOCK_MODE = !cleanApiKey.startsWith('AIza');

// Mock data for testing without a valid API key
const MOCK_FOOD_ITEMS = [
  { name: 'Apple', confidence: 0.95, price: 1.49, category: 'Fruit', productId: 'mock-001' },
  { name: 'Banana', confidence: 0.92, price: 0.99, category: 'Fruit', productId: 'mock-002' },
  { name: 'Orange', confidence: 0.88, price: 1.29, category: 'Fruit', productId: 'mock-003' },
  { name: 'Tomato', confidence: 0.85, price: 2.99, category: 'Vegetable', productId: 'mock-004' },
  { name: 'Carrot', confidence: 0.82, price: 1.19, category: 'Vegetable', productId: 'mock-005' }
];

interface VisionApiResponse {
  responses: Array<{
    labelAnnotations?: Array<{
      description: string;
      score: number;
      topicality: number;
    }>;
    webDetection?: {
      webEntities?: Array<{
        description: string;
        score: number;
      }>;
      bestGuessLabels?: Array<{
        label: string;
      }>;
    };
  }>;
}

interface RecognizedFoodItem {
  name: string;
  confidence: number;
  price?: number;
  category?: string;
  productId?: string;
  description?: string;
  image_url?: string;
}

interface RecognitionResult {
  items: RecognizedFoodItem[];
  rawResponse: any;
  isMocked?: boolean;
}

/**
 * Determines if a detected label is a food product
 */
function isFood(label: string): boolean {
  // List of common food keywords
  const foodKeywords = [
    'fruit', 'vegetable', 'food', 'produce', 'grocery', 'edible',
    'apple', 'banana', 'orange', 'grape', 'berry', 'citrus',
    'strawberry', 'blueberry', 'raspberry', 'blackberry', 'melon',
    'watermelon', 'cantaloupe', 'pineapple', 'mango', 'peach', 'pear',
    'plum', 'cherry', 'kiwi', 'fig', 'date', 'apricot', 'lemon', 'lime',
    'tomato', 'potato', 'carrot', 'broccoli', 'lettuce', 'spinach', 'kale',
    'onion', 'garlic', 'pepper', 'cucumber', 'zucchini', 'eggplant',
    'bread', 'pasta', 'rice', 'cereal', 'oats', 'meat', 'chicken', 'beef',
    'pork', 'fish', 'seafood', 'dairy', 'milk', 'cheese', 'yogurt',
    'beverage', 'drink', 'juice', 'water', 'soda', 'coffee', 'tea',
    'snack', 'candy', 'chocolate', 'cookies', 'crackers', 'chips',
    'natural food', 'organic', 'product', 'grocery item', 'supermarket'
  ];
  
  // Normalize the label
  const normalizedLabel = label.toLowerCase().trim();
  
  // Check if the label contains a food keyword
  return foodKeywords.some(keyword => 
    normalizedLabel.includes(keyword.toLowerCase())
  );
}

/**
 * Normalize a label for more consistent matching
 */
function normalizeLabel(label: string): string {
  let normalized = label.toLowerCase().trim();
  
  // Remove trailing 's' for plurals (except for certain words)
  if (normalized.endsWith('s') && 
      !['grapes', 'chips', 'oats', 'cookies', 'crackers'].includes(normalized)) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  
  return normalized;
}

/**
 * Get product from the database based on recognized name
 */
async function getProductFromDatabase(productName: string): Promise<Product | null> {
  try {
    // Normalize the product name
    const normalizedProductName = normalizeLabel(productName);
    
    console.log(`Searching for product: "${normalizedProductName}" (original: "${productName}")`);
    
    // First try a direct match by name
    const exactProducts = await getProducts({ name: normalizedProductName });
    
    if (exactProducts && exactProducts.length > 0) {
      console.log(`Direct match found in database for "${normalizedProductName}"`);
      return exactProducts[0];
    }
    
    // Try case-insensitive matching by checking if any product name contains our normalized product name
    const allProducts = await getProducts({});
    
    if (allProducts && allProducts.length > 0) {
      // First look for exact matches
      const exactMatch = allProducts.find(product => 
        product.name.toLowerCase() === normalizedProductName);
      
      if (exactMatch) {
        console.log(`Exact name match found for "${normalizedProductName}"`);
        return exactMatch;
      }
      
      // Then look for substring matches
      const containsMatches = allProducts.filter(product => {
        const productNameLower = product.name.toLowerCase();
        return productNameLower.includes(normalizedProductName) || 
               normalizedProductName.includes(productNameLower);
      });
      
      if (containsMatches.length > 0) {
        console.log(`Substring match found: "${containsMatches[0].name}" matches "${normalizedProductName}"`);
        return containsMatches[0];
      }
      
      // Try matching by words
      const words = normalizedProductName.split(/\s+/).filter(word => word.length > 3);
      for (const word of words) {
        // Skip common words that aren't useful for product identification
        if (['food', 'fresh', 'ripe', 'juicy', 'sweet', 'product', 'item', 'natural'].includes(word.toLowerCase())) {
          continue;
        }
        
        const wordMatch = allProducts.find(product => 
          product.name.toLowerCase().includes(word)
        );
        
        if (wordMatch) {
          console.log(`Word match found: "${wordMatch.name}" matches word "${word}" from "${normalizedProductName}"`);
          return wordMatch;
        }
      }
      
      // Try matching by category
      if (normalizedProductName.includes('fruit')) {
        const fruitProducts = allProducts.filter(product => 
          product.category.toLowerCase() === 'fruit');
        
        if (fruitProducts.length > 0) {
          console.log(`Category match found: using first item in "Fruit" category`);
          return fruitProducts[0];
        }
      }
      
      if (normalizedProductName.includes('vegetable')) {
        const vegetableProducts = allProducts.filter(product => 
          product.category.toLowerCase() === 'vegetable');
        
        if (vegetableProducts.length > 0) {
          console.log(`Category match found: using first item in "Vegetable" category`);
          return vegetableProducts[0];
        }
      }
    }
    
    console.log(`No specific match found for "${normalizedProductName}"`);
    return null;
  } catch (error) {
    console.error(`Error getting product from database for "${productName}":`, error);
    return null;
  }
}

/**
 * Recognize food items in an image using Google Cloud Vision API
 */
export async function recognizeFoodWithVision(base64Image: string): Promise<RecognitionResult> {
  // If MOCK_MODE is enabled, return mock data instead of calling the API
  if (MOCK_MODE) {
    console.log('Using MOCK mode because API key appears invalid. Returning test data.');
    return {
      items: MOCK_FOOD_ITEMS,
      rawResponse: { mock: true },
      isMocked: true
    };
  }

  try {
    // Prepare the request data
    const requestData = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'LABEL_DETECTION',
              maxResults: 15
            },
            {
              type: 'WEB_DETECTION',
              maxResults: 10
            }
          ]
        }
      ]
    };
    
    // Call the Vision API
    const response = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Vision API error: ${response.status} ${errorText}`);
      
      // If API key is invalid, suggest using a proper key
      if (response.status === 400 && errorText.includes('API key')) {
        console.error('It appears your Google Cloud Vision API key is invalid.');
        console.error('Please obtain a valid key from the Google Cloud Console.');
        
        // Return mock data for testing purposes
        console.log('Returning mock data for testing. Please fix your API key for production use.');
        return {
          items: MOCK_FOOD_ITEMS,
          rawResponse: { error: errorText, mock: true },
          isMocked: true
        };
      }
      
      throw new Error(`Vision API error: ${response.status} ${errorText}`);
    }
    
    const data: VisionApiResponse = await response.json();
    console.log('Vision API response:', JSON.stringify(data));
    
    // Log all labels for debugging
    console.log('Detected labels:');
    if (data.responses[0].labelAnnotations) {
      data.responses[0].labelAnnotations.forEach(label => {
        console.log(`- ${label.description} (score: ${label.score})`);
      });
    }
    
    // Check for best guess labels
    let bestGuessLabel = '';
    if (data.responses[0].webDetection?.bestGuessLabels?.[0]?.label) {
      bestGuessLabel = data.responses[0].webDetection.bestGuessLabels[0].label;
      console.log(`Vision API best guess: "${bestGuessLabel}"`);
    }
    
    // Initialize results array
    const recognizedItems: RecognizedFoodItem[] = [];
    
    // First, try to match the best guess label directly
    if (bestGuessLabel && isFood(bestGuessLabel)) {
      // Get product from database
      const product = await getProductFromDatabase(bestGuessLabel);
      
      if (product) {
        recognizedItems.push({
          name: product.name,
          confidence: 0.98, // High confidence since it's the best guess
          price: product.price,
          category: product.category,
          productId: product.id,
          description: product.description,
          image_url: product.image_url
        });
        console.log(`Added best guess match: ${product.name} from "${bestGuessLabel}"`);
        
        // Return early with just this match
        return {
          items: recognizedItems,
          rawResponse: data
        };
      }
    }
    
    // If best guess didn't match, try with top label annotations
    if (recognizedItems.length === 0 && data.responses[0].labelAnnotations) {
      // Sort by confidence score
      const sortedLabels = [...data.responses[0].labelAnnotations].sort((a, b) => b.score - a.score);
      
      // Only try the top 3 labels with highest confidence
      for (let i = 0; i < Math.min(3, sortedLabels.length); i++) {
        const label = sortedLabels[i];
        
        if (isFood(label.description)) {
          // Get product from database
          const product = await getProductFromDatabase(label.description);
          
          if (product) {
            recognizedItems.push({
              name: product.name,
              confidence: label.score,
              price: product.price,
              category: product.category,
              productId: product.id,
              description: product.description,
              image_url: product.image_url
            });
            console.log(`Added label match: ${product.name} from "${label.description}"`);
            
            // Return as soon as we find a match
            return {
              items: recognizedItems,
              rawResponse: data
            };
          }
        }
      }
    }
    
    // If still no match, try with web entities
    if (recognizedItems.length === 0 && data.responses[0].webDetection?.webEntities) {
      const webEntities = data.responses[0].webDetection.webEntities;
      
      // Only try the top 3 web entities
      for (let i = 0; i < Math.min(3, webEntities.length); i++) {
        const entity = webEntities[i];
        if (!entity.description) continue;
        
        if (isFood(entity.description)) {
          // Get product from database
          const product = await getProductFromDatabase(entity.description);
          
          if (product) {
            recognizedItems.push({
              name: product.name,
              confidence: entity.score,
              price: product.price,
              category: product.category,
              productId: product.id,
              description: product.description,
              image_url: product.image_url
            });
            console.log(`Added web entity match: ${product.name} from "${entity.description}"`);
            
            // Return as soon as we find a match
            return {
              items: recognizedItems,
              rawResponse: data
            };
          }
        }
      }
    }
    
    // If no items were found, return "not in database" instead of a default product
    if (recognizedItems.length === 0) {
      console.log('No items detected in the image. Returning "not in database" message.');
      
      recognizedItems.push({
        name: "Not in database",
        confidence: 0.5, // Low confidence since it's a fallback
        price: 0,
        category: "Unknown",
        productId: "unknown",
        description: "This item was recognized but not found in the database."
      });
      console.log(`Added "Not in database" message instead of fallback product`);
    }
    
    return {
      items: recognizedItems,
      rawResponse: data
    };
  } catch (error) {
    console.error('Error calling Vision API:', error);
    throw error;
  }
} 