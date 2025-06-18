export const JWT_PASSWORD = process.env.JWT_PASSWORD || "fallback-secret-key"
export const PORT = process.env.PORT || 3000
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
export const FRONTEND_URL = process.env.VERCEL_URL;
// Validate required environment variables
if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI environment variable is required")
}

export const MONGO_URI = process.env.MONGO_URI
