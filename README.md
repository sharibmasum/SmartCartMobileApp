# SmartCart

## Overview

SmartCart is a mobile application designed to eliminate the frustration of waiting in long checkout lines. Key features include:

- **Item scanning** using your smartphone camera
- **Automatic food recognition** powered by Google Cloud Vision API
- **Digital shopping cart** for easy management of items
- **Seamless checkout** directly from your phone

The app provides a superior shopping experience by:
- Leveraging devices customers already own
- Allowing shoppers to scan and checkout at their convenience
- Completely eliminating wait times at checkout counters
- Offering a clean and intuitive user interface

## Demo

Watch our application demo: [SmartCart Demo Video](https://drive.google.com/file/d/1JoovLuut6xmu3UefGn3Au9ES9P_sRl6I/view?usp=sharing)
https://github.com/user-attachments/assets/a45fe29f-09d2-4792-a655-e6fb16f7414f
## Screenshots

Below are screenshots showcasing the app's intuitive user interface:

**User authentication screen**
<img src="https://github.com/user-attachments/assets/736c858c-d14d-43a0-8e9a-6e52e9dd68a9" alt="IMG_7101" width="500"/>

**Item scanning and detection**
<img src="https://github.com/user-attachments/assets/a45fe29f-09d2-4792-a655-e6fb16f7414f" alt="IMG_7101" width="500"/>
<img src="https://github.com/user-attachments/assets/2487cccf-7a75-4a85-88a0-9bccd3c93273" alt="IMG_7101" width="500"/>

**Shopping cart management with item quantities**
<img src="https://github.com/user-attachments/assets/7c606292-20c9-4482-bfb0-9247c7420fcd" alt="IMG_7101" width="500"/>


## API Setup

### Google Cloud Vision API

The application uses Google Cloud Vision API for image recognition. Here's how it's configured:

1. **API Key Configuration**:
   - The API key is stored in `.env` file as `GOOGLE_CLOUD_VISION_API_KEY`
   - The system validates that the key:
     - Is properly loaded
     - Has the correct format (starts with 'AIza')
     - Doesn't contain quotation marks
   - If issues are detected, appropriate warning messages are logged

2. **API Integration Details**:
   - Endpoint: `https://vision.googleapis.com/v1/images:annotate`
   - Features used:
     - `LABEL_DETECTION` - Detects objects, locations, activities, etc.
     - `WEB_DETECTION` - Identifies similar web images and best guess labels

3. **Food Recognition Process**:
   - Images are processed through the Vision API
   - Results are filtered using food-related keywords
   - The system attempts to match detected items with products in the database
   - Matching uses several strategies:
     - Exact name matches
     - Partial name matches
     - Word-level matches
     - Category-based matching

### Supabase Setup

The application uses Supabase for backend services and database storage.

1. **Configuration**:
   - Supabase URL: Stored as `EXPO_PUBLIC_SUPABASE_URL` in environment variables
   - Anonymous Key: Stored as `EXPO_PUBLIC_SUPABASE_ANON_KEY` in environment variables

2. **Client Setup**:
   - Uses AsyncStorage for local data persistence
   - Configured with:
     - Auto refresh token
     - Persistent sessions
     - No URL session detection

3. **Validation**:
   - The system checks if Supabase URL and anonymous key are properly set
   - Warning messages are logged if configuration is missing or invalid

## Environment Variables

Make sure to set up the following environment variables in your `.env` file:

```
GOOGLE_CLOUD_VISION_API_KEY=your_google_cloud_vision_api_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup Instructions

Follow these steps to set up the Supabase database for SmartCart:

1. **Create a Supabase Project**:
   - Sign up or log in at [supabase.com](https://supabase.com)
   - Create a new project and note your project URL and anon key
   - Add these credentials to your `.env` file as described above

2. **Enable UUID Extension**:
   - In the Supabase dashboard, go to the SQL Editor
   - Run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

3. **Run SQL Scripts**:
   The SQL scripts in the `sql/` folder need to be executed in numerical order:

   1. **01_products.sql** - Creates the products table with initial seed data:
      - Sets up the products table with fields for id, name, description, price, etc.
      - Creates indexes on barcode and category for faster lookups
      - Sets up Row Level Security (RLS) with public read access
      - Inserts 10 sample products (apples, bananas, milk, etc.)

   2. **02_carts.sql** - Creates the carts table:
      - Sets up the carts table with user_id, status fields
      - Creates a reference to the auth.users table for user management
      - Defines a function to handle the demo user
      - Sets up RLS policies for cart access control

   3. **03_cart_items.sql** - Creates the cart_items junction table:
      - Links products to carts with quantity information
      - Sets up RLS policies for cart items access control

   4. **04_payments.sql** - Creates payments tracking:
      - Tracks payment information for completed carts

   5. **05_triggers.sql** - Sets up database triggers:
      - Updates timestamps automatically
      - Handles cart total calculations

   6. **06_views.sql** - Creates database views:
      - Provides convenient ways to query cart data with products

   7. **07_demo_user.sql** - Sets up demo user functionality:
      - Creates functions for managing a demo user's cart
      - Allows for using the app without authentication
      - Demo user UUID: 550e8400-e29b-41d4-a716-446655440000

   8. **08_fix_cart_policies.sql** - Enhances Row Level Security and adds functionality:
      - Adds missing columns (completed_at and payment_method) to carts table
      - Ensures Row Level Security is properly enabled for all tables
      - Sets up comprehensive RLS policies for carts and cart_items
      - Creates a cart_items_with_products view for easier querying
      - Adds utility functions:
        - get_active_cart: Retrieves a user's active cart
        - create_cart_item: Securely adds items to a user's cart

4. **Verify Setup**:
   - In the Table Editor, confirm that the following tables exist:
     - products (with 10 sample items)
     - carts
     - cart_items
     - payments
   - Test the database by querying: `SELECT * FROM products LIMIT 5;`

5. **Storage Setup** (Optional):
   - If you need to store product images, create a public bucket named 'product-images'
   - Set up a policy to allow public read access:
     ```sql
     CREATE POLICY "Allow public read access to product images"
     ON storage.objects FOR SELECT
     USING (bucket_id = 'product-images');
     ```

6. **Authentication Setup** (Optional):
   - Enable Email authentication in the Authentication settings
   - Set up any additional authentication providers as needed

## Tables Structure

The database consists of the following main tables:

1. **products**:
   - id (UUID, primary key)
   - name (TEXT)
   - description (TEXT)
   - price (DECIMAL)
   - image_url (TEXT)
   - barcode (TEXT, unique)
   - category (TEXT)
   - created_at, updated_at (TIMESTAMPTZ)

2. **carts**:
   - id (UUID, primary key)
   - user_id (UUID, foreign key to auth.users)
   - status (TEXT: 'active', 'completed', 'abandoned')
   - created_at, updated_at, checkout_at, completed_at (TIMESTAMPTZ)
   - payment_method (VARCHAR(50))

3. **cart_items**:
   - id (UUID, primary key)
   - cart_id (UUID, foreign key to carts)
   - product_id (UUID, foreign key to products)
   - quantity (INTEGER)
   - created_at, updated_at (TIMESTAMPTZ)

4. **payments**:
   - id (UUID, primary key)
   - cart_id (UUID, foreign key to carts)
   - amount (DECIMAL)
   - status (TEXT)
   - payment_method (TEXT)
   - created_at, updated_at (TIMESTAMPTZ) 
