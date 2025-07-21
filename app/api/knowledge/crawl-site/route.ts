import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Knowledge from '@/models/Knowledge'
import { getUserFromRequest, requireAdmin } from '@/lib/auth'
import * as cheerio from 'cheerio'

export const dynamic = 'force-dynamic'

// Global crawl state (in production, use Redis or database)
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

// Extract all links from HTML content
function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const links: string[] = []
  
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href) {
      try {
        const absoluteUrl = new URL(href, baseUrl).href
        links.push(absoluteUrl)
      } catch (error) {
        // Skip invalid URLs
      }
    }
  })
  
  return Array.from(new Set(links)) // Remove duplicates
}

// Check if URL matches include/exclude patterns
function shouldProcessUrl(url: string, config: any): boolean {
  const { includePatterns, excludePatterns, onlyDomain, baseUrl } = config
  
  // Check domain restriction
  if (onlyDomain) {
    try {
      const urlDomain = new URL(url).hostname
      const baseDomain = new URL(baseUrl).hostname
      if (urlDomain !== baseDomain) return false
    } catch {
      return false
    }
  }
  
  // Check exclude patterns
  if (excludePatterns) {
    const excludes = excludePatterns.split(',').map((p: string) => p.trim()).filter(Boolean)
    if (excludes.some((pattern: string) => url.includes(pattern))) {
      return false
    }
  }
  
  // Check include patterns
  if (includePatterns) {
    const includes = includePatterns.split(',').map((p: string) => p.trim()).filter(Boolean)
    if (includes.length > 0 && !includes.some((pattern: string) => url.includes(pattern))) {
      return false
    }
  }
  
  return true
}

// Enhanced content extraction with better categorization
async function extractPageContent(url: string) {
  try {
    console.log('🕷️ Crawling:', url)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FindMe-Crawler/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .advertisement, .ads, .sidebar, .menu, .navigation, .breadcrumb').remove()
    
    // Extract title with fallbacks
    const title = $('title').text().trim() || 
                 $('h1').first().text().trim() || 
                 $('meta[property="og:title"]').attr('content') ||
                 $('meta[name="title"]').attr('content') ||
                 'Page Content'
    
    // Extract meta description
    const metaDesc = $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content') ||
                    ''
    
    // Extract main content with improved selectors
    let content = ''
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content', 
      '.entry-content',
      '.article-content',
      '.page-content',
      '.documentation',
      '.tutorial',
      '.guide',
      '#content',
      '.main-content'
    ]
    
    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length && element.text().trim().length > 200) {
        content = element.text().trim()
        break
      }
    }
    
    // Fallback to body content if no main content found
    if (!content || content.length < 100) {
      content = $('body').text().trim()
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 8000) // Limit content length
    
    // Extract headings for better context
    const headings: string[] = []
    $('h1, h2, h3, h4').each((_, el) => {
      const heading = $(el).text().trim()
      if (heading && heading.length > 3) {
        headings.push(heading)
      }
    })
    
    // Extract keywords from various sources
    const keywords: string[] = []
    $('meta[name="keywords"]').attr('content')?.split(',').forEach(kw => {
      const keyword = kw.trim()
      if (keyword) keywords.push(keyword)
    })
    
    // Add title and headings as keywords
    keywords.push(...title.split(' ').filter(word => word.length > 3))
    keywords.push(...headings.join(' ').split(' ').filter(word => word.length > 3))
    
    return {
      title: title.substring(0, 200),
      content,
      metaDescription: metaDesc.substring(0, 500),
      headings,
      keywords: Array.from(new Set(keywords)),
      links: extractLinks(html, url),
      success: true
    }
    
  } catch (error) {
    console.error('❌ Error extracting content from', url, ':', error)
    return {
      title: '',
      content: '',
      metaDescription: '',
      headings: [] as string[],
      keywords: [] as string[],
      links: [] as string[],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Intelligent categorization based on content analysis
function intelligentCategorization(title: string, content: string, headings: string[], url: string): string {
  const text = (title + ' ' + content + ' ' + headings.join(' ') + ' ' + url).toLowerCase()
  
  // Installation and setup
  if (text.match(/install|installation|setup|getting.started|how.to.install|step.by.step|configure|configuration/)) {
    return 'installation_guide'
  }
  
  // Troubleshooting and problem solving
  if (text.match(/troubleshoot|problem|issue|error|fix|repair|solve|debug|not.working|failed/)) {
    return 'troubleshooting'
  }
  
  // Technical specifications
  if (text.match(/specification|specs|technical|manual|documentation|api|reference|parameter|config/)) {
    return 'part_specification'
  }
  
  // Maintenance and care
  if (text.match(/maintenance|service|care|cleaning|upkeep|periodic|routine|schedule/)) {
    return 'maintenance_tip'
  }
  
  // Safety information
  if (text.match(/safety|warning|caution|danger|important|notice|alert|risk/)) {
    return 'safety_warning'
  }
  
  // Pricing and purchasing
  if (text.match(/price|cost|buy|purchase|order|payment|shop|store|discount|sale/)) {
    return 'pricing_info'
  }
  
  // Vehicle compatibility
  if (text.match(/compatible|compatibility|fits|vehicle|model|year|make|support/)) {
    return 'vehicle_compatibility'
  }
  
  return 'general_automotive'
}

// Extract vehicle information from content
function extractVehicleInfo(title: string, content: string, headings: string[]) {
  const text = (title + ' ' + content + ' ' + headings.join(' ')).toLowerCase()
  const vehicles = []
  
  // Common vehicle makes with better pattern matching
  const makes = [
    'honda', 'toyota', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 
    'volkswagen', 'subaru', 'mazda', 'hyundai', 'kia', 'lexus', 'acura', 'infiniti',
    'porsche', 'jeep', 'dodge', 'chrysler', 'buick', 'cadillac', 'gmc', 'volvo'
  ]
  
  for (const make of makes) {
    const makeRegex = new RegExp(`\\b${make}\\b`, 'gi')
    if (makeRegex.test(text)) {
      // Extract year range
      const yearMatches = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/g)
      const years = yearMatches ? Array.from(new Set(yearMatches.map(y => parseInt(y)))).sort() : []
      
      // Extract model (simplified)
      const modelRegex = new RegExp(`${make}\\s+([a-z0-9\\-]{2,15})`, 'gi')
      const modelMatch = modelRegex.exec(text)
      const model = modelMatch ? modelMatch[1].trim() : ''
      
      vehicles.push({
        make: make.charAt(0).toUpperCase() + make.slice(1),
        model: model.charAt(0).toUpperCase() + model.slice(1),
        year: years.slice(0, 10) // Limit to 10 years max
      })
      break // Only take first match to avoid duplicates
    }
  }
  
  return vehicles
}

// Process crawl queue
async function processCrawlQueue(userId: string) {
  if (!global.crawlState.isActive || global.crawlState.urlQueue.length === 0) {
    global.crawlState.isActive = false
    global.crawlState.status = 'Completed'
    return
  }
  
  const { url, depth } = global.crawlState.urlQueue.shift()!
  
  if (global.crawlState.processedUrls.has(url) || depth > global.crawlState.config.maxDepth) {
    // Skip already processed or too deep
    setImmediate(() => processCrawlQueue(userId))
    return
  }
  
  global.crawlState.processedUrls.add(url)
  global.crawlState.currentUrl = url
  global.crawlState.processedCount++
  global.crawlState.status = `Processing: ${url.substring(0, 50)}...`
  
  try {
    await connectToDatabase()
    
    // Extract content from page
    const extraction = await extractPageContent(url)
    
    if (extraction.success && extraction.content.length > 100) {
      // Categorize content
      const category = intelligentCategorization(
        extraction.title, 
        extraction.content, 
        extraction.headings, 
        url
      )
      
      // Extract vehicle info
      const vehicles = extractVehicleInfo(extraction.title, extraction.content, extraction.headings)
      
      // Create summary (first 500 chars of content or meta description)
      const summary = extraction.metaDescription || 
                     extraction.content.substring(0, 500) + 
                     (extraction.content.length > 500 ? '...' : '')
      
      // Check if similar content already exists
      const existingEntry = await Knowledge.findOne({
        $or: [
          { 'sources.url': url },
          { 
            title: extraction.title,
            summary: { $regex: summary.substring(0, 100), $options: 'i' }
          }
        ]
      })
      
      if (!existingEntry) {
        // Create new knowledge entry
        const knowledge = new Knowledge({
          title: extraction.title,
          content: `${extraction.content}\n\nSource: ${url}`,
          summary,
          category,
          tags: [
            'crawled',
            'auto_extracted',
            category.replace('_', ' '),
            ...extraction.keywords.slice(0, 10)
          ],
          applicableVehicles: vehicles,
          sources: [{
            type: 'verified_link',
            url,
            title: extraction.title,
            reliability_score: global.crawlState.config.reliability_score,
            verified: true,
            verified_by: userId,
            verified_at: new Date(),
            notes: `Auto-crawled from site: ${new URL(url).hostname}`
          }],
          search_keywords: [
            ...extraction.title.split(' ').filter(word => word.length > 3),
            ...extraction.keywords.slice(0, 20)
          ],
          auto_generated: true,
          confidence_score: global.crawlState.config.reliability_score / 10,
          created_by: userId,
          status: global.crawlState.config.reliability_score >= 7 ? 'approved' : 'pending_review'
        })
        
        await knowledge.save()
        global.crawlState.savedEntries++
        console.log('✅ Saved knowledge entry:', extraction.title)
      }
      
      // Add new URLs to queue if not too deep
      if (depth < global.crawlState.config.maxDepth) {
        for (const link of extraction.links) {
          if (!global.crawlState.processedUrls.has(link) && 
              shouldProcessUrl(link, global.crawlState.config) && 
              global.crawlState.urlQueue.length < global.crawlState.config.maxPages) {
            global.crawlState.urlQueue.push({ url: link, depth: depth + 1 })
          }
        }
        global.crawlState.foundUrls = global.crawlState.urlQueue.length + global.crawlState.processedUrls.size
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing', url, ':', error)
    global.crawlState.errors++
  }
  
  // Continue processing if under limits
  if (global.crawlState.processedUrls.size < global.crawlState.config.maxPages && global.crawlState.urlQueue.length > 0) {
    // Add small delay to be respectful
    setTimeout(() => processCrawlQueue(userId), 1000)
  } else {
    global.crawlState.isActive = false
    global.crawlState.status = 'Completed'
  }
}

// POST - Start site crawl
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    await requireAdmin(request)
    
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 })
    }
    
    // Check if crawl is already active
    if (global.crawlState.isActive) {
      return NextResponse.json({ 
        error: 'A crawl is already in progress. Please wait for it to complete.' 
      }, { status: 409 })
    }
    
    const config = await request.json()
    const { baseUrl, maxPages = 10, maxDepth = 2, onlyDomain = true, includePatterns = '', excludePatterns = '', reliability_score = 8 } = config
    
    if (!baseUrl) {
      return NextResponse.json({ error: 'Base URL is required' }, { status: 400 })
    }
    
    // Validate URL
    try {
      new URL(baseUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid base URL' }, { status: 400 })
    }
    
    // Initialize crawl state
    global.crawlState = {
      isActive: true,
      currentUrl: baseUrl,
      foundUrls: 1,
      processedCount: 0,
      savedEntries: 0,
      errors: 0,
      status: 'Starting crawl...',
      urlQueue: [{ url: baseUrl, depth: 0 }],
      processedUrls: new Set(),
      config: { baseUrl, maxPages, maxDepth, onlyDomain, includePatterns, excludePatterns, reliability_score }
    }
    
    // Start processing queue asynchronously
    setImmediate(() => processCrawlQueue(userPayload.userId))
    
    return NextResponse.json({
      message: 'Site crawl started successfully',
      config: {
        baseUrl,
        maxPages,
        maxDepth,
        onlyDomain,
        reliability_score
      }
    })
    
  } catch (error) {
    console.error('❌ Site crawl error:', error)
    return NextResponse.json({
      error: 'Failed to start site crawl',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 