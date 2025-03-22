// App route definitions

export const routes = {
  // Auth routes
  auth: {
    login: '/(auth)/login',
    register: '/(auth)/register',
  },
  
  // Main app routes
  main: {
    scanner: '/(main)/scanner',
    cart: '/(main)/cart',
    profile: '/(main)/profile',
  },
  
  // Root redirect
  root: '/',
}; 