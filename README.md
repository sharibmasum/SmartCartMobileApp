# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Database Migration

To apply the Row-Level Security policies and ensure each user's cart is properly secured, you need to run the migration script:

1. Make sure you have the Supabase CLI installed:
```
npm install -g supabase
```

2. Login to your Supabase account:
```
supabase login
```

3. Link your project (if not already linked):
```
supabase link --project-ref <your-project-ref>
```

4. Push the migration to your Supabase project:
```
supabase db push
```

The migration will:
- Enable Row-Level Security on the carts and cart_items tables
- Create policies to ensure users can only access their own carts and cart items
- Create a view and helper functions to make cart operations easier
- Ensure the products table is readable by all authenticated users

After applying this migration, each user will only be able to see and modify their own carts.
