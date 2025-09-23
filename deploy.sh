#!/bin/bash

echo "🚀 Deploying VibeStage Remote Controller to Firebase Hosting..."

# Copy the remote controller to public directory as index.html
echo "📁 Preparing files for deployment..."
mkdir -p public
cp remote-controller.html public/index.html

echo "✅ Files prepared successfully!"

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy --only hosting

echo "🎉 Deployment complete!"
echo "Your app should be available at: https://vibestage-d76c5.web.app"