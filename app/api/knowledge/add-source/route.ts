import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Knowledge from '@/models/Knowledge'
import { getUserFromRequest, requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Simple content extraction without external dependencies
async function extractBasicInfo(url: string) {
  try {
    console.log('🌐 Attempting to fetch URL:', url)
    
    // Use native fetch instead of node-fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FindMe Bot/1.0)'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('✅ Content fetched, length:', html.length)
    
    // Basic title extraction
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Extracted from URL'
    
    // Basic meta description extraction
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    const description = descMatch ? descMatch[1].trim() : 'Content extracted from web source'
    
    return {
      title: title.substring(0, 200), // Limit title length
      description: description.substring(0, 500), // Limit description
      success: true
    }
    
  } catch (error) {
    console.log('⚠️ Content extraction failed:', error instanceof Error ? error.message : 'Unknown error')
    return {
      title: 'Manual Entry',
      description: 'Content could not be extracted automatically',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Smart categorization based on URL and title
function smartCategorization(url: string, title: string, userCategory?: string) {
  if (userCategory) return userCategory
  
  const text = (url + ' ' + title).toLowerCase()
  
  if (text.includes('install') || text.includes('how-to') || text.includes('tutorial')) {
    return 'installation_guide'
  }
  if (text.includes('troubleshoot') || text.includes('problem') || text.includes('fix') || text.includes('repair')) {
    return 'troubleshooting'
  }
  if (text.includes('spec') || text.includes('technical') || text.includes('manual')) {
    return 'part_specification'
  }
  if (text.includes('maintenance') || text.includes('service')) {
    return 'maintenance_tip'
  }
  if (text.includes('safety') || text.includes('warning')) {
    return 'safety_warning'
  }
  if (text.includes('price') || text.includes('buy') || text.includes('shop')) {
    return 'pricing_info'
  }
  
  return 'general_automotive'
}

// Extract basic vehicle info from URL and title
function extractVehicleInfo(url: string, title: string) {
  const text = (url + ' ' + title).toLowerCase()
  const vehicles = []
  
  // Common makes
  const makes = ['honda', 'toyota', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'subaru', 'mazda', 'hyundai', 'kia']
  
  for (const make of makes) {
    if (text.includes(make)) {
      // Try to extract year
      const yearMatch = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/)
      const year = yearMatch ? [parseInt(yearMatch[1])] : []
      
      vehicles.push({
        make: make.charAt(0).toUpperCase() + make.slice(1),
        model: '', // Leave empty for now
        year
      })
      break // Only take first match
    }
  }
  
  return vehicles
}

// POST - Add a reliable source with smart extraction (admin only)
export async function POST(request: NextRequest) {
  try {
    console.log('🔑 Starting source addition process...')
    
    // Step 1: Check admin permissions
    try {
      await requireAdmin(request)
      console.log('✅ Admin permissions verified')
    } catch (error) {
      console.log('❌ Admin access denied')
      return NextResponse.json({ 
        error: 'Admin access required. Only administrators can add knowledge sources to train the AI.' 
      }, { status: 403 })
    }

    // Step 2: Database connection
    console.log('🗄️ Connecting to database...')
    await connectToDatabase()
    console.log('✅ Database connected')

    // Step 3: Parse and validate input
    console.log('📝 Parsing request data...')
    const data = await request.json()
    const { url, category, notes, reliability_score = 7 } = data
    console.log('✅ Request data:', { url, category, reliability_score })

    if (!url) {
      console.log('❌ URL is required')
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      console.log('❌ Invalid URL format')
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Step 4: Check for duplicates
    console.log('🔍 Checking for existing URL...')
    const existingKnowledge = await Knowledge.findOne({
      'sources.url': url
    })

    if (existingKnowledge) {
      console.log('❌ URL already exists')
      return NextResponse.json({
        error: 'This URL has already been added to the knowledge base'
      }, { status: 400 })
    }
    console.log('✅ URL is unique')

    // Step 5: Extract content information
    console.log('🌐 Extracting content info...')
    const extraction = await extractBasicInfo(url)
    
    // Step 6: Smart categorization and vehicle detection
    console.log('🤖 Processing extracted info...')
    const finalCategory = smartCategorization(url, extraction.title, category)
    const vehicles = extractVehicleInfo(url, extraction.title)
    
    // Step 7: Get admin user info
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 })
    }
    
    // Step 8: Create knowledge entry
    console.log('📚 Creating knowledge entry...')
    const knowledge = new Knowledge({
      title: extraction.title,
      content: `Source: ${url}\n\nDescription: ${extraction.description}\n\nNotes: ${notes || 'No additional notes provided'}`,
      summary: extraction.description,
      category: finalCategory,
      tags: [
        extraction.success ? 'auto_extracted' : 'manual_entry',
        'web_source',
        url.includes('youtube') ? 'video' : 'article',
        'admin_added'
      ],
      applicableVehicles: vehicles,
      sources: [{
        type: 'verified_link',
        url,
        title: extraction.title,
        reliability_score,
        verified: true,
        verified_by: userPayload.userId,
        verified_at: new Date(),
        notes: notes || 'Added via admin interface'
      }],
      search_keywords: [
        ...extraction.title.split(' ').filter((word: string) => word.length > 3),
        ...url.split('/').filter((word: string) => word.length > 3)
      ],
      auto_generated: extraction.success,
      confidence_score: extraction.success ? reliability_score / 10 : (reliability_score - 2) / 10,
      created_by: userPayload.userId,
      status: 'approved' // Auto-approve admin entries
    })

    console.log('💾 Saving knowledge entry...')
    await knowledge.save()
    console.log('✅ Knowledge entry saved successfully:', knowledge._id)

    return NextResponse.json({
      message: extraction.success 
        ? 'Source added and content extracted successfully' 
        : 'Source added successfully (manual entry)',
      knowledge: {
        id: knowledge._id,
        title: knowledge.title,
        category: knowledge.category,
        status: knowledge.status,
        vehicles: vehicles.length,
        confidence_score: knowledge.confidence_score,
        auto_extracted: extraction.success
      },
      extraction_info: {
        success: extraction.success,
        error: extraction.error || null
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Critical error in add-source:', error)
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json({
      error: 'Failed to add source',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
} 