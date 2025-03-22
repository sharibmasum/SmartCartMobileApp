# Supabase Setup Guide for SmartCart

This document provides step-by-step instructions for setting up the Supabase backend for the SmartCart application.

## 1. Create a Supabase Account and Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or log in.
2. Click on "New Project" to create a new Supabase project.
3. Name your project (e.g., "SmartCart").
4. Set a secure database password (make sure to remember it).
5. Choose a region closest to your users.
6. Click "Create New Project" and wait for it to initialize (this may take a few minutes).

## 2. Configure Environment Variables

1. Once your project is created, go to the project dashboard.
2. Navigate to "Settings" → "API" in the sidebar.
3. Under "Project API keys", you will find:
   - `URL`: Your Supabase project URL
   - `anon` / `public`: Your public API key
4. Create a `.env` file in your project root (if not already created) and add these values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Replace the placeholder values with your actual Supabase URL and anon key.

## 3. Set Up Database Tables

1. In the Supabase dashboard, go to the "SQL Editor" section.
2. Create new database tables by executing the SQL files from the `sql` directory in the following order:
   - 01_products.sql
   - 02_carts.sql
   - 03_cart_items.sql
   - 04_payments.sql
   - 05_triggers.sql
   - 06_views.sql

You can do this by:
1. Clicking "New Query"
2. Copying the content of each SQL file
3. Pasting into the SQL editor
4. Clicking "Run" to execute the query
5. Repeat for each SQL file in the order listed above

## 4. Configure Authentication

1. In the Supabase dashboard, go to "Authentication" → "Providers".
2. Email Auth is enabled by default (you can customize settings if needed).
3. If you want to add other auth providers (like Google, Facebook, etc.), you can enable them here.
4. Under "Email Templates", you can customize the emails sent for password resets, confirmations, etc.

## 5. Row Level Security (RLS)

The SQL scripts have already set up Row Level Security policies for your tables. These policies ensure that:
- Users can only access their own data
- Data is properly secured
- Unauthorized access is prevented

## 6. Test Your Configuration

1. In the Supabase SQL Editor, you can query the tables to make sure they were created correctly.
   ```sql
   SELECT * FROM products;
   ```
2. You should see the sample products that were added by the SQL script.

## 7. Next Steps

With your Supabase backend configured, you can now proceed to implement the frontend of your application. The services files (`auth.ts`, `products.ts`, `cart.ts`) are already set up to interact with your Supabase backend.

## Troubleshooting

If you encounter any issues:
1. Check that your SQL queries executed without errors
2. Verify your environment variables are correct
3. Test API calls using the Supabase dashboard "API Docs" section
4. Check for any console errors in your application 