import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const debug = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      MONGODB_URI: !!process.env.MONGODB_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL
    },
    headers: {
      'user-agent': request.headers.get('user-agent'),
      'authorization': request.headers.get('authorization') ? 'present' : 'missing',
      'cookie': request.headers.get('cookie') ? 'present' : 'missing'
    },
    cookies: {
      'auth-token': request.cookies.get('auth-token') ? 'present' : 'missing'
    },
    mongodb: {
      connected: false,
      error: null as string | null
    }
  }

  // Test MongoDB connection
  try {
    await connectToDatabase()
    debug.mongodb.connected = true
  } catch (error) {
    debug.mongodb.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return NextResponse.json(debug, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
} 