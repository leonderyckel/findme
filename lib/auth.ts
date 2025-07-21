import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '@/models/User'
import { connectToDatabase } from './mongodb'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined')
}

export function generateToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET as string)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword)
}

export function getUserFromRequest(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return null

    const payload = verifyToken(token) as any
    return payload
  } catch (error) {
    return null
  }
}

// New admin authentication helpers
export async function getFullUserFromRequest(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) return null

    await connectToDatabase()
    const user = await User.findById(userPayload.userId).select('-password')
    return user
  } catch (error) {
    console.error('Error getting full user:', error)
    return null
  }
}

export async function isUserAdmin(request: NextRequest): Promise<boolean> {
  try {
    const user = await getFullUserFromRequest(request)
    return user?.isAdmin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

export async function requireAdmin(request: NextRequest) {
  const isAdmin = await isUserAdmin(request)
  if (!isAdmin) {
    throw new Error('Admin access required')
  }
  return true
} 