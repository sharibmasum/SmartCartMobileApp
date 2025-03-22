// Test script to validate the Google Cloud Vision API key
import { GOOGLE_CLOUD_VISION_API_KEY } from '@env';

// Function to safely display part of the API key for validation
const displayPartialKey = (key) => {
  if (!key) return 'undefined';
  if (typeof key !== 'string') return `not a string: ${typeof key}`;
  
  // Remove any quotes that might be part of the string
  const cleanKey = key.replace(/['"]/g, '');
  
  // Display only first 4 chars and length
  return cleanKey.substring(0, 4) + '... (length: ' + cleanKey.length + ')';
};

console.log('API Key validation:');
console.log('---------------------');
console.log('Partial key:', displayPartialKey(GOOGLE_CLOUD_VISION_API_KEY));

// Check if key starts with "AIza" (typical for Google API keys)
const cleanKey = GOOGLE_CLOUD_VISION_API_KEY?.replace(/['"]/g, '') || '';
if (cleanKey.startsWith('AIza')) {
  console.log('✅ Key format appears correct (starts with AIza)');
} else {
  console.log('❌ Key format may be incorrect (should start with AIza)');
  if (cleanKey.startsWith('"') || cleanKey.endsWith('"') || 
      cleanKey.startsWith("'") || cleanKey.endsWith("'")) {
    console.log('   Issue: Key contains quote characters that should be removed');
  }
}

console.log('---------------------'); 