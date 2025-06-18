import express, { type Request, type Response } from "express"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { z } from "zod"
import { ContentModel, UserModel } from "./db"
import { GOOGLE_CLIENT_ID, JWT_PASSWORD, MONGO_URI } from "./config"
import { userMiddleware } from "./middleware"
import crypto from "crypto"
import cors from "cors"
import { OAuth2Client } from "google-auth-library"
function generateShareId() {
  return crypto.randomBytes(8).toString("hex")
}

const app = express()

// Enhanced CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    console.log("CORS request from origin:", origin)

    const allowedOrigins = [
      "https://second-brain-frontend-woad.vercel.app",
      "https://brainly-frontend-woad.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
    ]

    // Allow any Vercel domain
    if (origin.includes(".vercel.app") || allowedOrigins.includes(origin)) {
      console.log("CORS allowed for origin:", origin)
      return callback(null, true)
    }

    console.log("CORS blocked for origin:", origin)
    callback(new Error("Not allowed by CORS"))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())

// Handle preflight requests
app.options("*", cors(corsOptions))

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

const signupSchema = z.object({
  username: z.string().min(3, "Username is short"),
  password: z.string().min(6, "Password is short"),
  email: z.string().email(),
})

const signinSchema = z.object({
  username: z.string().min(3, "Username is short"),
  password: z.string().min(6, "Password is short"),
})
const client = new OAuth2Client("52074276999-hivborjh21pho32erp3jg6l7es1f3qc5.apps.googleusercontent.com");

app.post('/api/v1/google-signin', async (req: Request, res: Response) => {
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  console.log('📥 Hit /api/v1/google-signin');
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  const { token } = req.body;
  console.log('Extracted token:', token);

  if (!token) {
    console.error('No token provided in request body');
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "52074276999-hivborjh21pho32erp3jg6l7es1f3qc5.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(400).json({ error: 'Invalid Token' });
      return;
    }

    const { email, name, sub: googleId } = payload;
    console.log('Google payload:', { email, name, googleId });

    let user = await UserModel.findOne({ username: name });

    if (!user) {
      user = await UserModel.create({
        username: name,
        email,
        googleId,
      });
      console.log('Created new user:', user);
    } else {
      console.log('Found existing user:', user);
    }

    if (!user || !user._id) {
      console.error("User creation or fetch failed:", user);
      res.status(500).json({ error: "User creation failed" });
      return;
    }

    console.log('About to generate JWT token for user ID:', user._id);
    console.log('JWT_PASSWORD:', JWT_PASSWORD);

    const jwtToken = jwt.sign({ id: user._id }, JWT_PASSWORD, {
      expiresIn: '24h',
    });

    console.log('Generated JWT token successfully');
    console.log('Generated JWT token for user:', user._id);
    res.json({ token: jwtToken });
  } catch (err) {
    console.error("Google Sign-In Failed:", err);
    res.status(401).json({ error: 'Google Sign-In Failed' });
  }
});


// Signup
app.post("/api/v1/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = signupSchema.safeParse(req.body)
    console.log("Signup attempt:", result)

    if (!result.success) {
      res.status(400).json({ message: "Invalid Inputs", errors: result.error.errors })
      return
    }

    const { username, password,email} = result.data
    const hashPass = await bcrypt.hash(password, 10)

    const user = await UserModel.create({ username, password: hashPass,email })
    const token = jwt.sign({ id: user._id }, JWT_PASSWORD, { expiresIn: "24h" })

    console.log("User created successfully:", user._id)
    res.json({ token, message: "User created successfully" })
  } catch (e: any) {
    console.error("Signup error:", e)
    if (e.code === 11000) {
      res.status(411).json({ message: "User already exists" })
    } else {
      res.status(500).json({ message: "Internal server error" })
    }
  }
})

// Signin
app.post("/api/v1/signin", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = signinSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ message: "Invalid Inputs" })
      return
    }

    const { username, password } = result.data

    const existingUser = await UserModel.findOne({ username })
    if (existingUser && existingUser.password && (await bcrypt.compare(password, existingUser.password))) {
      const token = jwt.sign({ id: existingUser._id }, JWT_PASSWORD, { expiresIn: "24h" })
      res.json({ token, message: "Login successful" })
    } else {
      res.status(403).json({ message: "Incorrect credentials" })
    }
  } catch (e) {
    console.error("Signin error:", e)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Signin Using Google
// app.post("api/v1/google-signIn",async (req:Request,res:Response):Promise<voide> =>{

// })

// Add content
app.post("/api/v1/content", userMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, link, type, tags = [] } = req.body
    //@ts-ignore
    const userId = req.userId

    console.log("Creating content:", { title, link, type, tags, userId })

    await ContentModel.create({
      title,
      link,
      type,
      userId,
      tags,
    })

    res.json({ message: "Content added successfully" })
  } catch (err) {
    console.error("Add content error:", err)
    res.status(500).json({ message: "Failed to add content" })
  }
})

// Get content
app.get("/api/v1/content", userMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    //@ts-ignore
    const userId = req.userId

    const content = await ContentModel.find({ userId }).populate("userId", "username")
    console.log("Fetched content for user:", userId, "Count:", content.length)
    res.json({ content })
  } catch (err) {
    console.error("Get content error:", err)
    res.status(500).json({ message: "Failed to fetch content" })
  }
})

// Delete content
app.delete("/api/v1/content", userMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.body
    console.log("Deleting content:", contentId)

    //@ts-ignore
    const userId = req.userId

    if (!contentId) {
      res.status(400).json({ error: "Content ID is required" })
      return
    }

    const result = await ContentModel.deleteOne({ _id: contentId, userId })

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Content not found or not authorized" })
      return
    }

    res.json({ message: "Content deleted successfully" })
  } catch (error) {
    console.error("Delete error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Share endpoints
app.post("/api/v1/brain/share", userMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    //@ts-ignore
    const userId = req.userId
    console.log(userId);
    const user = await UserModel.findById(userId)

    if (!user) {
      res.status(404).json({ message: "User not found" })
      return
    }

    // @ts-ignore
    if (user.shareId) {
      // @ts-ignore
      res.json({
        shareLink: `${process.env.VERCEL_URL || "http://localhost:5173"}/share/${user.shareId}`,
      })
      return
    }

    const shareId = generateShareId()
    // @ts-ignore
    user.shareId = shareId
    await user.save()
    res.json({ shareLink: `${process.env.VERCEL_URL || "http://localhost:3000"}/share/${shareId}` })
  } catch (err) {
    console.error("Share error:", err)
    res.status(500).json({ message: "Failed to create share link" })
  }
})

app.get("/api/v1/brain/:shareId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { shareId } = req.params

    const user = await UserModel.findOne({ shareId })

    if (!user) {
      res.status(404).json({ message: "Invalid share link" })
      return
    }

    const content = await ContentModel.find({ userId: user._id })

    res.json({
      username: user.username,
      content,
    })
  } catch (err) {
    console.error("Get shared content error:", err)
    res.status(500).json({ message: "Failed to fetch shared content" })
  }
})

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// CORS test endpoint
app.get("/api/cors-test", (req: Request, res: Response) => {
  res.json({
    status: "CORS OK",
    message: "CORS is working",
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
  })
})

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Second Brain API is running",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      signup: "/api/v1/signup",
      signin: "/api/v1/signin",
      content: "/api/v1/content",
      share: "/api/v1/brain/share",
      googleSignIn: "/api/v1/google-signin",
    },
  })
})

// Test endpoint for debugging
app.post('/api/v1/test', (req: Request, res: Response) => {
  console.log('Test endpoint hit');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  res.json({ message: 'Test endpoint working', body: req.body });
});

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})

export default app
