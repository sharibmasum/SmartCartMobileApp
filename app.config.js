import 'dotenv/config';

export default {
  expo: {
    extra: {
      // The API key will be loaded from .env file
      googleCloudVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY
    }
  }
}; 