// Test script for vision service
import { recognizeFoodWithVision } from '../services/vision';
import fs from 'fs';
import path from 'path';

// Sample base64 image of food
// In a real test we would load this from a file
// For demo purposes, we'll use a small placeholder
const sampleBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==";

// Function to run the test
async function runVisionTest() {
  try {
    console.log('Testing vision service with database integration...');
    
    // Strip the data:image/jpeg;base64, prefix if present
    const base64Image = sampleBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Call the vision API
    const result = await recognizeFoodWithVision(base64Image);
    
    console.log('Recognition results:');
    console.log(JSON.stringify(result.items, null, 2));
    
    if (result.isMocked) {
      console.log('Warning: Using mock data. Please ensure your API key is set correctly.');
    }
    
    console.log('Testing if product IDs are present:');
    result.items.forEach(item => {
      console.log(`${item.name}: ${item.productId ? 'Has product ID' : 'No product ID'}`);
    });
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runVisionTest(); 