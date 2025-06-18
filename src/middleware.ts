import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { JWT_PASSWORD } from "./config"

export const userMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const header = req.headers["authorization"]
    console.log("Authorization header:", header);
    
    if (!header) {
      res.status(403).json({
        message: "Authorization header missing",
      })
      return
    }

    // Handle both "Bearer <token>" and direct token formats
    let token = header
    if (header.startsWith('Bearer ')) {
      token = header.substring(7) // Remove "Bearer " prefix
    }

    const decoded = jwt.verify(token, JWT_PASSWORD) as { id: string }
    if (decoded && decoded.id) {
      // @ts-ignore
      req.userId = decoded.id
      next()
    } else {
      res.status(403).json({
        message: "Invalid token",
      })
    }
  } catch (error) {
    console.error("Middleware error:", error)
    res.status(403).json({
      message: "You are not logged in",
    })
  }
}
