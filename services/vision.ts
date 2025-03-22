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
  }
} else {
  console.error('No Google Cloud Vision API key found in environment variables. Please check your .env file.');
}

// Clean the API key by removing any quotes that might have been included
const cleanApiKey = GOOGLE_CLOUD_VISION_API_KEY ? 
  GOOGLE_CLOUD_VISION_API_KEY.replace(/["']/g, '') : '';

// Setup the API URL with the cleaned key from environment variables
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${cleanApiKey}`;

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
  confidence?: number;
  price?: number;
  category?: string;
  productId?: string;
  description?: string;
  image_url?: string;
}

interface RecognitionResult {
  items: RecognizedFoodItem[];
  rawResponse: any;
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
 * Find the best product match by name from all available products
 */
async function findBestProductMatch(name: string): Promise<Product | null> {
  try {
    const normalizedName = normalizeLabel(name);
    console.log(`Finding best match for: "${normalizedName}" (from: "${name}")`);
    
    // Get all products
    const allProducts = await getProducts();
    if (!allProducts || allProducts.length === 0) {
      console.log('No products available in database');
      return null;
    }
    
    // Try exact match first (case insensitive)
    const exactMatch = allProducts.find(
      p => normalizeLabel(p.name) === normalizedName
    );
    
    if (exactMatch) {
      console.log(`Found exact match: "${exactMatch.name}"`);
      return exactMatch;
    }
    
    // Try to find products containing the search term or search term containing product name
    let containsMatches = allProducts.filter(p => {
      const productName = normalizeLabel(p.name);
      return productName.includes(normalizedName) || normalizedName.includes(productName);
    });
    
    // If we have multiple matches, sort by closest match (preferring shorter names)
    if (containsMatches.length > 1) {
      containsMatches = containsMatches.sort((a, b) => {
        // Prefer products whose names are contained within the search term
        const aInSearch = normalizedName.includes(normalizeLabel(a.name));
        const bInSearch = normalizedName.includes(normalizeLabel(b.name));
        
        if (aInSearch && !bInSearch) return -1;
        if (!aInSearch && bInSearch) return 1;
        
        // Otherwise prefer closer length matches
        const aDiff = Math.abs(a.name.length - normalizedName.length);
        const bDiff = Math.abs(b.name.length - normalizedName.length);
        return aDiff - bDiff;
      });
      
      console.log(`Found multiple partial matches, best is: "${containsMatches[0].name}"`);
      return containsMatches[0];
    } else if (containsMatches.length === 1) {
      console.log(`Found one partial match: "${containsMatches[0].name}"`);
      return containsMatches[0];
    }
    
    // Try matching individual words (but only for multi-word labels)
    if (normalizedName.includes(' ')) {
      const words = normalizedName.split(/\s+/).filter(w => w.length > 3);
      for (const word of words) {
        // Skip common words
        if (['food', 'fresh', 'ripe', 'juicy', 'sweet'].includes(word)) continue;
        
        const wordMatches = allProducts.filter(p => 
          normalizeLabel(p.name).includes(word)
        );
        
        if (wordMatches.length > 0) {
          console.log(`Found word match for "${word}": "${wordMatches[0].name}"`);
          return wordMatches[0];
        }
      }
    }
    
    // Try category matches as a last resort
    if (normalizedName.includes('fruit')) {
      const fruitProducts = allProducts.filter(p => 
        p.category.toLowerCase() === 'fruits'
      );
      
      if (fruitProducts.length > 0) {
        console.log(`Using category match from Fruits: "${fruitProducts[0].name}"`);
        return fruitProducts[0];
      }
    }
    
    console.log(`No matches found for "${normalizedName}"`);
    return null;
    
  } catch (error) {
    console.error(`Error finding product match for "${name}":`, error);
    return null;
  }
}

/**
 * Create a RecognizedFoodItem from a Product and confidence score
 */
function createRecognizedItem(product: Product, confidence: number, label: string): RecognizedFoodItem {
  const item: RecognizedFoodItem = {
    name: product.name,
    price: product.price,
    category: product.category,
    productId: product.id,
    description: product.description
  };
  
  if (product.image_url) {
    item.image_url = product.image_url;
  }
  
  // Keep confidence for internal use only
  Object.defineProperty(item, 'confidence', {
    value: confidence,
    enumerable: false,
    writable: true,
    configurable: true
  });
  
  console.log(`Added match: ${product.name} from "${label}"`);
  return item;
}

/**
 * Create a "not in database" fallback item
 */
function createNotInDatabaseItem(): RecognizedFoodItem {
  console.log('No items detected in the image. Returning "not in database" message.');
  
  const item = {
    name: "Not in database",
    price: 0,
    category: "Unknown",
    productId: "unknown",
    description: "This item was recognized but not found in the database."
  };
  
  // Keep confidence for internal use only
  Object.defineProperty(item, 'confidence', {
    value: 1.0,
    enumerable: false,
    writable: true,
    configurable: true
  });
  
  return item;
}

/**
 * Recognize food items in an image using Google Cloud Vision API
 */
export async function recognizeFoodWithVision(base64Image: string): Promise<RecognitionResult> {
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
    
    // Store possible matches with their confidence scores
    const possibleMatches: {name: string, confidence: number, source: string}[] = [];
    
    // Process best guess labels first (these are usually the most accurate)
    const bestGuessLabels = data.responses[0]?.webDetection?.bestGuessLabels;
    if (bestGuessLabels && bestGuessLabels.length > 0 && bestGuessLabels[0]?.label) {
      const bestGuessLabel = bestGuessLabels[0].label;
      console.log(`Vision API best guess: "${bestGuessLabel}"`);
      
      // First try exact match with best guess
      const product = await findBestProductMatch(bestGuessLabel);
      if (product) {
        console.log(`Found product match for best guess "${bestGuessLabel}": "${product.name}"`);
        
        // We have a complete product object from the database that matches the Product interface
        return {
          items: [{
            name: product.name,
            price: product.price,
            category: product.category,
            productId: product.id,
            description: product.description,
            image_url: product.image_url
          }],
          rawResponse: data
        };
      }
      
      // If no direct match for best guess, add it to possible matches with high confidence
      if (isFood(bestGuessLabel)) {
        possibleMatches.push({
          name: bestGuessLabel,
          confidence: 0.95, // Assign high confidence to best guess
          source: 'best_guess'
        });
      }
    }
    
    // Add high-confidence label annotations
    if (data.responses[0].labelAnnotations) {
      data.responses[0].labelAnnotations
        .filter(label => label.score > 0.7 && isFood(label.description))
        .slice(0, 5) // Only use top 5 high-confidence labels
        .forEach(label => {
          possibleMatches.push({
            name: label.description,
            confidence: label.score,
            source: 'label'
          });
        });
    }
    
    // Add web entities with high confidence
    if (data.responses[0].webDetection?.webEntities) {
      data.responses[0].webDetection.webEntities
        .filter(entity => entity.score > 0.7 && entity.description && isFood(entity.description))
        .slice(0, 3) // Only use top 3 web entities
        .forEach(entity => {
          possibleMatches.push({
            name: entity.description!,
            confidence: entity.score,
            source: 'web_entity'
          });
        });
    }
    
    // Sort by confidence (descending)
    possibleMatches.sort((a, b) => b.confidence - a.confidence);
    
    console.log('Possible matches sorted by confidence:');
    possibleMatches.forEach(match => {
      console.log(`- ${match.name} (${match.confidence.toFixed(2)}) from ${match.source}`);
    });
    
    // Try to find products for each possible match
    const recognizedItems: RecognizedFoodItem[] = [];
    
    // Try each possible match in order
    for (const match of possibleMatches) {
      const product = await findBestProductMatch(match.name);
      if (product) {
        recognizedItems.push(createRecognizedItem(
          product,
          match.confidence,
          `${match.source}: ${match.name}`
        ));
        
        // Return on first match
        return {
          items: recognizedItems.map(item => ({
            ...item,
            confidence: undefined
          })),
          rawResponse: data
        };
      }
    }
    
    // If no items were found, return "not in database" message
    if (recognizedItems.length === 0) {
      recognizedItems.push(createNotInDatabaseItem());
    }
    
    return {
      items: recognizedItems.map(item => ({
        ...item,
        confidence: undefined
      })),
      rawResponse: data
    };
  } catch (error) {
    console.error('Error calling Vision API:', error);
    throw error;
  }
} 