import { NextResponse } from 'next/server'

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    mongodb: !!process.env.MONGODB_URI,
    jwt: !!process.env.JWT_SECRET,
    nextauth: !!process.env.NEXTAUTH_SECRET,
    node_env: process.env.NODE_ENV
  }

  return NextResponse.json({
    status: 'ok',
    environment: checks,
    message: checks.mongodb && checks.jwt ? 'All critical env vars present' : 'Missing critical env vars'
  })
} 