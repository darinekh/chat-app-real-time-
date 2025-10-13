# MongoDB Setup Guide

This guide will help you set up MongoDB for your chat application. Choose one of the options below:

## Option 1: Local MongoDB Installation (Recommended for Development)

### Windows:
1. **Download MongoDB Community Server:**
   - Go to https://www.mongodb.com/try/download/community
   - Download the Windows installer (.msi file)
   - Run the installer and follow the setup wizard

2. **Start MongoDB:**
   ```bash
   # Method 1: Start as Windows Service (recommended)
   net start MongoDB

   # Method 2: Start manually
   mongod --dbpath "C:\data\db"
   ```

3. **Verify Installation:**
   ```bash
   mongo --version
   ```

### macOS:
1. **Install using Homebrew:**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB:**
   ```bash
   brew services start mongodb/brew/mongodb-community
   ```

### Linux (Ubuntu/Debian):
1. **Install MongoDB:**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   ```

2. **Start MongoDB:**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

## Option 2: MongoDB Atlas (Cloud Database - Free Tier Available)

### Steps:
1. **Create Account:**
   - Go to https://cloud.mongodb.com
   - Sign up for a free account

2. **Create Cluster:**
   - Click "Build a Database"
   - Choose "FREE" shared cluster
   - Select your preferred cloud provider and region
   - Click "Create Cluster"

3. **Set up Database Access:**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Create a username and password
   - Set privileges to "Read and write to any database"

4. **Set up Network Access:**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0) for development
   - Or add your specific IP address for better security

5. **Get Connection String:**
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

6. **Update .env file:**
   ```env
   # Comment out the local MongoDB URI
   # MONGODB_URI=mongodb://localhost:27017/chatapp

   # Add your Atlas connection string
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chatapp?retryWrites=true&w=majority
   ```

## Option 3: Docker MongoDB (Alternative)

### Steps:
1. **Install Docker:**
   - Download and install Docker Desktop from https://www.docker.com/products/docker-desktop

2. **Run MongoDB Container:**
   ```bash
   docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest
   ```

3. **Update .env file:**
   ```env
   MONGODB_URI=mongodb://admin:password@localhost:27017/chatapp?authSource=admin
   ```

## Testing Your Connection

After setting up MongoDB, test your connection:

1. **Start your chat application:**
   ```bash
   npm start
   ```

2. **Look for these success messages:**
   ```
   ✅ Successfully connected to MongoDB
   📊 Database: chatapp
   🔗 Mongoose connected to MongoDB
   Server running on port 3000
   ```

3. **If you see connection errors:**
   - Check that MongoDB is running
   - Verify your connection string in .env
   - Check firewall settings
   - For Atlas: verify IP whitelist and credentials

## Troubleshooting

### Common Issues:

1. **ECONNREFUSED Error:**
   - MongoDB is not running
   - Wrong port or host in connection string

2. **Authentication Failed:**
   - Wrong username/password
   - User doesn't have proper permissions

3. **Network Timeout:**
   - Firewall blocking connection
   - IP not whitelisted (Atlas)
   - Internet connection issues

4. **Database Not Found:**
   - This is normal - MongoDB will create the database automatically when first used

### Getting Help:
- MongoDB Documentation: https://docs.mongodb.com/
- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- Community Forums: https://community.mongodb.com/

## Recommended Setup for Different Environments:

- **Development:** Local MongoDB or MongoDB Atlas Free Tier
- **Testing:** Docker MongoDB or MongoDB Atlas
- **Production:** MongoDB Atlas or self-hosted MongoDB with proper security

Choose the option that best fits your needs and follow the corresponding setup instructions!
