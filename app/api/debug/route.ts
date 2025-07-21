import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const email = searchParams.get('email')
  const username = searchParams.get('username')

  try {
    await connectToDatabase()

    // Check environment variables
    const envCheck = {
      MONGODB_URI: !!process.env.MONGODB_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      BRAVE_SEARCH_API_KEY: !!process.env.BRAVE_SEARCH_API_KEY,
      NODE_ENV: process.env.NODE_ENV
    }

    // Migration action - Add missing fields to all users
    if (action === 'migrate-users') {
      try {
        // First, let's get all users and see what fields they're missing
        const allUsers = await User.find({})
        let updatedCount = 0

        for (const user of allUsers) {
          let needsUpdate = false
          const updates: any = {}

          if (user.isAdmin === undefined || user.isAdmin === null) {
            updates.isAdmin = false
            needsUpdate = true
          }
          if (user.isVerified === undefined || user.isVerified === null) {
            updates.isVerified = false
            needsUpdate = true
          }
          if (user.isSeller === undefined || user.isSeller === null) {
            updates.isSeller = false
            needsUpdate = true
          }
          if (user.bio === undefined || user.bio === null) {
            updates.bio = ''
            needsUpdate = true
          }
          if (user.avatar === undefined) {
            updates.avatar = null
            needsUpdate = true
          }

          if (needsUpdate) {
            await User.findByIdAndUpdate(user._id, { $set: updates })
            updatedCount++
          }
        }

        return NextResponse.json({
          message: '🔄 User migration completed successfully!',
          total_users: allUsers.length,
          updated_users: updatedCount,
          details: 'Added missing isAdmin, isVerified, isSeller, bio, and avatar fields to users that were missing them',
          fields_added: ['isAdmin', 'isVerified', 'isSeller', 'bio', 'avatar']
        })
      } catch (error) {
        return NextResponse.json({
          error: 'Migration failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Make user admin action
    if (action === 'make-admin' && (email || username)) {
      try {
        const query = email ? { email: email.toLowerCase() } : { username }
        const user = await User.findOne(query)
        
        if (!user) {
          return NextResponse.json({
            error: 'User not found',
            searched: query,
            suggestion: 'Try using: /api/debug?action=list-users to see all available users'
          }, { status: 404 })
        }

        if (user.isAdmin) {
          return NextResponse.json({
            message: 'User is already an admin',
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              displayName: user.displayName,
              isAdmin: user.isAdmin
            }
          })
        }

        // Update user to admin
        user.isAdmin = true
        await user.save()

        return NextResponse.json({
          message: '🎉 User promoted to admin successfully!',
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            isAdmin: user.isAdmin
          }
        })
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to promote user to admin',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Remove admin action
    if (action === 'remove-admin' && (email || username)) {
      try {
        const query = email ? { email: email.toLowerCase() } : { username }
        const user = await User.findOne(query)
        
        if (!user) {
          return NextResponse.json({
            error: 'User not found',
            searched: query
          }, { status: 404 })
        }

        if (!user.isAdmin) {
          return NextResponse.json({
            message: 'User is not an admin',
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              displayName: user.displayName,
              isAdmin: user.isAdmin
            }
          })
        }

        // Remove admin privileges
        user.isAdmin = false
        await user.save()

        return NextResponse.json({
          message: '🔒 Admin privileges removed successfully!',
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            isAdmin: user.isAdmin
          }
        })
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to remove admin privileges',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // List all users action
    if (action === 'list-users') {
      try {
        const users = await User.find({})
          .sort({ createdAt: -1 })
          .limit(20)

        return NextResponse.json({
          users: users.map(user => ({
            id: user._id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            isAdmin: user.isAdmin || false,
            isVerified: user.isVerified || false,
            isSeller: user.isSeller || false,
            bio: user.bio || '',
            avatar: user.avatar || null,
            createdAt: user.createdAt
          })),
          total: users.length,
          admin_count: users.filter(u => u.isAdmin).length
        })
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to list users',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Database health check
    if (action === 'db-health') {
      try {
        const userCount = await User.countDocuments()
        const adminCount = await User.countDocuments({ isAdmin: true })
        const verifiedCount = await User.countDocuments({ isVerified: true })

        return NextResponse.json({
          database_health: 'OK',
          statistics: {
            total_users: userCount,
            admin_users: adminCount,
            verified_users: verifiedCount,
            regular_users: userCount - adminCount
          },
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        return NextResponse.json({
          error: 'Database health check failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Default debug info
    return NextResponse.json({
      message: 'FindMe Debug & Admin Management API',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database_status: 'Connected successfully',
      available_actions: [
        {
          action: 'migrate-users',
          description: 'Add missing fields (isAdmin, isVerified, etc.) to all users',
          usage: '/api/debug?action=migrate-users',
          recommended: 'Run this first if upgrading from older version'
        },
        {
          action: 'make-admin',
          description: 'Promote a user to admin',
          usage: '/api/debug?action=make-admin&email=user@example.com',
          alternative: '/api/debug?action=make-admin&username=testuser'
        },
        {
          action: 'remove-admin',
          description: 'Remove admin privileges from a user',
          usage: '/api/debug?action=remove-admin&email=user@example.com'
        },
        {
          action: 'list-users',
          description: 'List all users with their roles and status',
          usage: '/api/debug?action=list-users'
        },
        {
          action: 'db-health',
          description: 'Check database health and user statistics',
          usage: '/api/debug?action=db-health'
        }
      ],
      quick_setup: {
        step1: 'Run migration: /api/debug?action=migrate-users',
        step2: 'Make yourself admin: /api/debug?action=make-admin&email=your-email@example.com',
        step3: 'Check health: /api/debug?action=db-health',
        step4: 'Access admin panel: /admin/knowledge'
      },
      security_note: '⚠️ This endpoint should be secured/removed in production!'
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        MONGODB_URI: !!process.env.MONGODB_URI,
        NODE_ENV: process.env.NODE_ENV
      }
    }, { status: 500 })
  }
} 