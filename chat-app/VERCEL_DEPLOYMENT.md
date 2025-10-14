# Vercel Deployment Guide for Chat App

This guide will help you deploy your real-time chat application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas Account**: Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas)
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Set Up MongoDB Atlas

1. Create a new cluster in MongoDB Atlas
2. Create a database user with read/write permissions
3. Whitelist your IP address (or use 0.0.0.0/0 for all IPs)
4. Get your connection string (it should look like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/chatapp?retryWrites=true&w=majority
   ```

## Step 2: Prepare Your Environment Variables

Create the following environment variables in your Vercel dashboard:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-app-name.vercel.app
DB_NAME=chatapp
```

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Set the root directory to `chat-app`
5. Add your environment variables
6. Click "Deploy"

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your chat-app directory:
   ```bash
   cd chat-app
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Follow the prompts and add environment variables when asked

## Step 4: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add all the variables listed in Step 2
4. Make sure to update `CLIENT_URL` with your actual Vercel domain

## Step 5: Build and Test

1. Build your project locally first:
   ```bash
   npm run build
   ```

2. Test the production build:
   ```bash
   npm start
   ```

## Important Notes

### Socket.IO Considerations

This app uses Socket.IO for real-time features. While Vercel supports WebSockets, there are some limitations:

- **Serverless Functions**: Vercel uses serverless functions which may not maintain persistent connections
- **Polling Fallback**: The app is configured to use polling as a fallback transport
- **Connection Limits**: Be aware of Vercel's function execution time limits

### Alternative Deployment Options

If you experience issues with Socket.IO on Vercel, consider these alternatives:

1. **Split Deployment**:
   - Deploy frontend to Vercel
   - Deploy backend to Railway, Render, or Heroku

2. **Use External WebSocket Service**:
   - Replace Socket.IO with Pusher, Ably, or similar service
   - Keep the REST API on Vercel

## Troubleshooting

### Common Issues

1. **MongoDB Connection Errors**:
   - Verify your connection string
   - Check IP whitelist in MongoDB Atlas
   - Ensure database user has proper permissions

2. **CORS Errors**:
   - Update `CLIENT_URL` environment variable
   - Check CORS configuration in server.js

3. **Build Errors**:
   - Run `npm run build` locally first
   - Check for any missing dependencies
   - Verify webpack configuration

4. **Socket.IO Connection Issues**:
   - Check browser console for WebSocket errors
   - Verify the app falls back to polling
   - Consider using alternative real-time solutions

### Environment Variables Checklist

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` (MongoDB Atlas connection string)
- [ ] `JWT_SECRET` (strong, unique secret)
- [ ] `JWT_EXPIRES_IN=7d`
- [ ] `CLIENT_URL` (your Vercel domain)
- [ ] `DB_NAME=chatapp`

## Post-Deployment

1. Test all features:
   - User registration/login
   - Real-time messaging
   - Room functionality
   - User presence

2. Monitor logs in Vercel dashboard for any errors

3. Set up custom domain if needed

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify MongoDB Atlas connection
3. Test locally with production environment variables
4. Consider the alternative deployment options mentioned above
