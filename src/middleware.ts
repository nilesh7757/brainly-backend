import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { JWT_PASSWORD } from "./config"

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers["authorization"]

    if (!header) {
      return res.status(403).json({
        message: "Authorization header missing",
      })
    }

    const decoded = jwt.verify(header, JWT_PASSWORD) as { id: string }

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
    res.status(403).json({
      message: "You are not logged in",
    })
  }
}
