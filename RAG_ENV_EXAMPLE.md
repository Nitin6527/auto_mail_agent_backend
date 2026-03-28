# RAG Configuration - Copy to secrets/.env and fill in your values

# ============================================================================
# EMBEDDINGS PROVIDER CONFIGURATION
# ============================================================================
# Choose one: openai, google, or local
EMBEDDINGS_PROVIDER=openai

# OpenAI Configuration (if using OpenAI)
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-api-key-here

# Google Gemini Configuration (if using Google)
# Get your API key from: https://ai.google.dev/
GOOGLE_API_KEY=your-google-api-key-here

# ============================================================================
# QDRANT VECTOR DATABASE CONFIGURATION
# ============================================================================

# For Local Development (Docker)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=test-key

# For Qdrant Cloud Production
# QDRANT_HOST=your-cluster.qdrant.io
# QDRANT_PORT=443
# QDRANT_API_KEY=your-cloud-api-key

# Collection settings
QDRANT_COLLECTION_NAME=emails

# Vector size depends on embeddings provider:
# - OpenAI text-embedding-3-small: 1536
# - OpenAI text-embedding-3-large: 3072
# - Google embedding-001: 768
# - Local all-MiniLM-L6-v2: 384
QDRANT_VECTOR_SIZE=1536

# ============================================================================
# PORT & FRONTEND CONFIGURATION (other services)
# ============================================================================
PORT=4000
FRONTEND_URL=http://localhost:5173

# ============================================================================
# GMAIL/GOOGLE AUTHENTICATION (existing configuration)
# ============================================================================
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
