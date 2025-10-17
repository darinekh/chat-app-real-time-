# Render Deployment Guide

This guide will help you deploy your Chat App to Render.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to a GitHub repository
2. **MongoDB Atlas**: Your MongoDB database should be hosted on MongoDB Atlas
3. **Render Account**: Create a free account at [render.com](https://render.com)

## Step-by-Step Deployment

### 1. Prepare Your Environment Variables

You'll need to set up the following environment variables in Render:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/chatapp?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random-at-least-32-characters
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-app-name.onrender.com
```

### 2. Deploy to Render

1. **Connect GitHub Repository**:
   - Go to [render.com](https://render.com) and sign in
   - Click "New +" and select "Web Service"
   - Connect your GitHub account and select your repository
   - Choose the branch to deploy (usually `main`)

2. **Configure Build Settings**:
   - **Name**: `chat-app` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty (or `chat-app` if your code is in a subdirectory)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Set Environment Variables**:
   - In the Render dashboard, go to your service
   - Click on "Environment" tab
   - Add each environment variable from the list above
   - **Important**: Replace the placeholder values with your actual values

4. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - The build process will take a few minutes

### 3. Update Your MongoDB Atlas Network Access

1. Go to your MongoDB Atlas dashboard
2. Navigate to "Network Access"
3. Add `0.0.0.0/0` to allow connections from anywhere (Render's IP addresses change)
4. Or add Render's specific IP ranges if you prefer more security

### 4. Update CLIENT_URL

After deployment:
1. Note your Render app URL (e.g., `https://your-app-name.onrender.com`)
2. Update the `CLIENT_URL` environment variable in Render with this URL
3. Redeploy if necessary

## Environment Variables Details

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Render uses 10000) | `10000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/chatapp` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-32-character-secret-key` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `CLIENT_URL` | Your app's URL for CORS | `https://your-app.onrender.com` |

## Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check that all dependencies are in `package.json`
   - Ensure build command is correct: `npm install && npm run build`

2. **App Won't Start**:
   - Verify start command is: `npm start`
   - Check that `PORT` environment variable is set to `10000`

3. **Database Connection Issues**:
   - Verify `MONGODB_URI` is correct
   - Check MongoDB Atlas network access settings
   - Ensure your MongoDB Atlas cluster is running

4. **CORS Errors**:
   - Make sure `CLIENT_URL` matches your Render app URL exactly
   - Check that the URL doesn't have trailing slashes

5. **Socket.IO Issues**:
   - Render supports WebSocket connections
   - Make sure your app URL uses `https://` not `http://`

### Logs and Debugging:

- View logs in Render dashboard under "Logs" tab
- Check for any error messages during build or runtime
- Monitor the "Events" tab for deployment status

## Free Tier Limitations

Render's free tier has some limitations:
- Apps may sleep after 15 minutes of inactivity
- 750 hours per month of runtime
- Limited bandwidth and build minutes

For production apps with high traffic, consider upgrading to a paid plan.

## Post-Deployment

1. **Test Your App**: Visit your Render URL and test all features
2. **Monitor Performance**: Use Render's monitoring tools
3. **Set Up Custom Domain** (optional): Configure a custom domain in Render settings
4. **Enable Auto-Deploy**: Ensure auto-deploy is enabled for automatic updates

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- Check the logs in your Render dashboard for specific error messages
