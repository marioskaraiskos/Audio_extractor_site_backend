# Use a slim Node image as our base
FROM node:20-slim

# Install system dependencies: Python3 and FFmpeg
# Added 'python-is-python3' to fix the binary naming mismatch
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python-is-python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Explicitly ensure /usr/bin/python points directly to python3 as a fallback
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Download the latest yt-dlp binary directly into the system execution path
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

# Set up working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port Render will route traffic to
EXPOSE 5000

# Start the production backend server
CMD ["node", "server.js"]