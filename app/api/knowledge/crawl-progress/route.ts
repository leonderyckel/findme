import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// This would ideally be shared state or stored in Redis/database
// For now, we'll use a simple module-level variable that matches the crawl-site API
declare global {
  var crawlState: {
    isActive: boolean
    currentUrl: string
    foundUrls: number
    processedCount: number
    savedEntries: number
    errors: number
    status: string
    urlQueue: Array<{url: string, depth: number}>
    processedUrls: Set<string>
    config: any
  }
}

// Initialize if not exists
if (!global.crawlState) {
  global.crawlState = {
    isActive: false,
    currentUrl: '',
    foundUrls: 0,
    processedCount: 0,
    savedEntries: 0,
    errors: 0,
    status: 'Idle',
    urlQueue: [],
    processedUrls: new Set(),
    config: null
  }
}

// GET - Get crawl progress
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    await requireAdmin(request)
    
    // Return current crawl state
    return NextResponse.json({
      isActive: global.crawlState.isActive,
      currentUrl: global.crawlState.currentUrl,
      foundUrls: global.crawlState.foundUrls,
      processedUrls: global.crawlState.processedCount,
      savedEntries: global.crawlState.savedEntries,
      errors: global.crawlState.errors,
      status: global.crawlState.status,
      queueLength: global.crawlState.urlQueue.length,
      config: global.crawlState.config ? {
        baseUrl: global.crawlState.config.baseUrl,
        maxPages: global.crawlState.config.maxPages,
        maxDepth: global.crawlState.config.maxDepth,
        reliability_score: global.crawlState.config.reliability_score
      } : null
    })
    
  } catch (error) {
    console.error('❌ Progress check error:', error)
    return NextResponse.json({
      error: 'Failed to get crawl progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Control crawl (pause/resume/stop)
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    await requireAdmin(request)
    
    const { action } = await request.json()
    
    switch (action) {
      case 'stop':
        global.crawlState.isActive = false
        global.crawlState.status = 'Stopped by user'
        global.crawlState.urlQueue = []
        return NextResponse.json({ 
          message: 'Crawl stopped successfully',
          finalStats: {
            processedUrls: global.crawlState.processedCount,
            savedEntries: global.crawlState.savedEntries,
            errors: global.crawlState.errors
          }
        })
        
      case 'pause':
        if (global.crawlState.isActive) {
          global.crawlState.isActive = false
          global.crawlState.status = 'Paused by user'
          return NextResponse.json({ message: 'Crawl paused successfully' })
        } else {
          return NextResponse.json({ error: 'No active crawl to pause' }, { status: 400 })
        }
        
      case 'resume':
        if (!global.crawlState.isActive && global.crawlState.urlQueue.length > 0) {
          global.crawlState.isActive = true
          global.crawlState.status = 'Resumed by user'
          return NextResponse.json({ message: 'Crawl resumed successfully' })
        } else {
          return NextResponse.json({ 
            error: 'Cannot resume - no paused crawl or empty queue' 
          }, { status: 400 })
        }
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ Crawl control error:', error)
    return NextResponse.json({
      error: 'Failed to control crawl',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 