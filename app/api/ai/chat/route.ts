import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Part from '@/models/Part'
import Knowledge from '@/models/Knowledge'
import { getUserFromRequest } from '@/lib/auth'
import OpenAI from 'openai'
import { webSearchService, SearchResult } from '@/lib/webSearch'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Mock AI responses as fallback
const mockResponses = {
  'cam chain tensioner': {
    parts: [
      {
        name: 'Cam Chain Tensioner Assembly',
        partNumber: 'CCT-001',
        description: 'OEM replacement cam chain tensioner for Honda CB750',
        compatibleVehicles: [{ make: 'Honda', model: 'CB750', year: [1979, 1980, 1981] }],
        externalLinks: [
          { supplier: 'BikeBandit', url: 'https://example.com/part1', price: 89.99 },
          { supplier: 'Rocky Mountain ATV', url: 'https://example.com/part2', price: 95.50 }
        ]
      }
    ],
    installation: 'To replace the cam chain tensioner on your 1980 CB750:\n\n1. Remove the fuel tank and side covers\n2. Locate the tensioner on the front of the cylinder head\n3. Remove the old tensioner assembly\n4. Install the new tensioner with proper torque specs\n5. Check chain tension and timing',
    tips: 'Make sure to use genuine Honda parts or high-quality aftermarket alternatives. The cam chain tensioner is crucial for proper timing.'
  }
}

// Conversation memory storage (in production, use Redis or database)
const conversationMemory = new Map<string, {
  messages: Array<{role: string, content: string, timestamp: string}>,
  userPreferences: {
    vehicleMake?: string,
    vehicleModel?: string,
    vehicleYear?: number,
    experienceLevel?: 'beginner' | 'intermediate' | 'expert',
    interests: string[]
  },
  searchHistory: string[],
  lastActive: string
}>()

// Intelligent relevance scoring
function scoreResultRelevance(result: any, userQuery: string, userPreferences: any): number {
  let score = 0
  
  // Base score from title/description match
  const queryTerms = userQuery.toLowerCase().split(' ')
  const resultText = `${result.title} ${result.description || ''}`.toLowerCase()
  
  queryTerms.forEach(term => {
    if (resultText.includes(term)) score += 10
  })
  
  // Vehicle-specific scoring
  if (userPreferences.vehicleMake) {
    if (resultText.includes(userPreferences.vehicleMake.toLowerCase())) score += 20
  }
  if (userPreferences.vehicleModel) {
    if (resultText.includes(userPreferences.vehicleModel.toLowerCase())) score += 15
  }
  
  // Source reliability scoring
  if (result.supplier === 'RockAuto') score += 10
  if (result.supplier === 'eBay' && result.price) score += 5
  if (result.supplier === 'Amazon') score += 8
  
  // Recency scoring for web results
  if (result.timestamp) {
    const hoursSinceFound = (Date.now() - new Date(result.timestamp).getTime()) / (1000 * 60 * 60)
    if (hoursSinceFound < 24) score += 5
  }
  
  return score
}

// Extract user preferences from conversation
function extractUserPreferences(messages: any[]): any {
  const preferences = {
    vehicleMake: '',
    vehicleModel: '', 
    vehicleYear: 0,
    experienceLevel: 'intermediate' as 'beginner' | 'intermediate' | 'expert',
    interests: [] as string[]
  }
  
  const allText = messages.map(m => m.content).join(' ').toLowerCase()
  
  // Common vehicle makes
  const makes = ['honda', 'yamaha', 'kawasaki', 'suzuki', 'bmw', 'harley', 'ducati', 'ford', 'toyota', 'bmw', 'mercedes', 'audi']
  for (const make of makes) {
    if (allText.includes(make)) {
      preferences.vehicleMake = make
      break
    }
  }
  
  // Extract year (simple regex)
  const yearMatch = allText.match(/\b(19|20)\d{2}\b/)
  if (yearMatch) {
    preferences.vehicleYear = parseInt(yearMatch[0])
  }
  
  // Experience level indicators
  if (allText.includes('beginner') || allText.includes('new to') || allText.includes('first time')) {
    preferences.experienceLevel = 'beginner'
  } else if (allText.includes('expert') || allText.includes('professional') || allText.includes('mechanic')) {
    preferences.experienceLevel = 'expert'
  }
  
  return preferences
}

// Generate proactive search queries based on context
function generateProactiveSearches(userMessage: string, preferences: any): string[] {
  const searches = []
  
  // If asking about a specific part, also search for installation
  if (userMessage.includes('tensioner') || userMessage.includes('brake') || userMessage.includes('clutch')) {
    const partName = userMessage.match(/\b(tensioner|brake|clutch|chain|gear|oil|filter|spark plug|tire)\b/i)?.[0]
    if (partName) {
      searches.push(`${partName} installation guide ${preferences.vehicleMake || ''}`)
      searches.push(`${partName} troubleshooting ${preferences.vehicleMake || ''}`)
      searches.push(`${partName} replacement cost ${preferences.vehicleMake || ''}`)
    }
  }
  
  // If vehicle-specific, search for common issues
  if (preferences.vehicleMake && preferences.vehicleModel) {
    searches.push(`${preferences.vehicleMake} ${preferences.vehicleModel} common problems`)
    searches.push(`${preferences.vehicleMake} ${preferences.vehicleModel} maintenance schedule`)
  }
  
  return searches.slice(0, 2) // Limit to 2 proactive searches
}

async function searchPartsInDatabase(query: string) {
  try {
    await connectToDatabase()
    const parts = await Part.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { 'compatibleVehicles.make': { $regex: query, $options: 'i' } },
        { 'compatibleVehicles.model': { $regex: query, $options: 'i' } },
        { tags: { $in: [query] } }
      ]
    }).limit(5).lean()
    
    return parts
  } catch (error) {
    console.error('Database search error:', error)
    return []
  }
}

async function searchKnowledgeBase(query: string) {
  try {
    await connectToDatabase()
    
    // Extract vehicle info for better targeting
    const vehicleInfo = webSearchService.extractVehicleInfo(query)
    
    // Search knowledge base
    const knowledge = await (Knowledge as any).searchByQuery(query, {
      limit: 5,
      vehicleMake: vehicleInfo?.make
    })
    
    // Also search by vehicle if vehicle info detected
    let vehicleKnowledge: any[] = []
    if (vehicleInfo?.make) {
      vehicleKnowledge = await (Knowledge as any).findByVehicle(
        vehicleInfo.make,
        vehicleInfo.model,
        vehicleInfo.year ? parseInt(vehicleInfo.year) : undefined
      )
    }
    
    // Combine and deduplicate
    const allKnowledge = [...knowledge, ...vehicleKnowledge]
    const uniqueKnowledge = allKnowledge.filter((item, index, self) => 
      index === self.findIndex(k => k._id.toString() === item._id.toString())
    ).slice(0, 5)
    
    return uniqueKnowledge
  } catch (error) {
    console.error('Knowledge search error:', error)
    return []
  }
}

async function searchWebForParts(query: string): Promise<SearchResult[]> {
  try {
    // Extract vehicle info for better targeting
    const vehicleInfo = webSearchService.extractVehicleInfo(query)
    
    // Search with enhanced targeting
    const webResults = await webSearchService.searchParts(query, {
      maxResults: 8,
      includePrice: true,
      vehicleInfo
    })

    return webResults
  } catch (error) {
    console.error('Web search error:', error)
    return []
  }
}

async function getEnhancedAIResponse(
  userMessage: string, 
  foundParts: any[] = [], 
  webResults: SearchResult[] = [],
  knowledgeBase: any[] = [],
  conversationHistory: any[] = [],
  userPreferences: any
) {
  const webResultsText = webResults.length > 0 
    ? `\n\nRECENT WEB SEARCH RESULTS:\n${webResults.map(result => 
        `• ${result.title}\n  Supplier: ${result.supplier || 'Unknown'}\n  Price: ${result.price || 'Not specified'}\n  Relevance Score: ${(result as any).relevanceScore || 'N/A'}\n  URL: ${result.url}\n  Description: ${result.description}`
      ).join('\n\n')}`
    : ''

  const knowledgeText = knowledgeBase.length > 0
    ? `\n\nVERIFIED KNOWLEDGE BASE:\n${knowledgeBase.map(kb => 
        `• ${kb.title}\n  Category: ${kb.category}\n  Usefulness: ${kb.usefulness_score}/10\n  Content: ${kb.summary}\n  ${kb.sources?.[0]?.url ? `Source: ${kb.sources[0].url}` : ''}`
      ).join('\n\n')}`
    : ''

  const conversationContext = conversationHistory.length > 0
    ? `\n\nCONVERSATION HISTORY:\n${conversationHistory.slice(-5).map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n')}`
    : ''

  const systemPrompt = `You are Alex, a seasoned mechanic with 15 years of experience who loves helping people with their vehicles. You're known for being direct, asking good questions, and not wasting people's time with irrelevant info.

**CRITICAL: THINK BEFORE YOU SPEAK**

Before responding, you MUST analyze:
1. What is the user ACTUALLY trying to accomplish?
2. What information do they really need vs. what's just noise?
3. What questions should I ask to help them better?
4. Is this person looking for specific parts, general advice, or just exploring?

**YOUR PERSONALITY:**
- Talk like a real person having a conversation
- Ask follow-up questions when something's unclear
- Don't dump information - be selective and relevant
- React naturally: "Hmm, that's interesting..." or "Wait, let me understand..."
- Admit when you need more context: "Hold on, what exactly are you trying to fix?"
- Be skeptical of irrelevant results: "Most of this stuff doesn't seem related to what you need"

**CONVERSATION RULES:**
1. **START WITH UNDERSTANDING**: If the query is vague (like just "honda"), ask what they're actually trying to do
2. **BE SELECTIVE**: Only mention results that are genuinely helpful for their specific situation
3. **EXPLAIN YOUR REASONING**: "I'm focusing on X because Y, but ignoring Z because it's not relevant"
4. **ASK CLARIFYING QUESTIONS**: "Are you looking for parts for a specific problem, or just browsing?"
5. **CONNECT THE DOTS**: Link information together logically instead of listing separately

**USER CONTEXT:**
- Vehicle: ${userPreferences.vehicleMake || 'Not specified'} ${userPreferences.vehicleModel || ''} ${userPreferences.vehicleYear || ''}
- Experience: ${userPreferences.experienceLevel || 'Not specified'}
- Past conversation: ${conversationHistory.length > 0 ? 'We\'ve been talking about automotive stuff' : 'First conversation'}

**AVAILABLE INFORMATION:**
Knowledge Base: ${knowledgeText ? 'I have some verified technical guides' : 'No specific guides found'}
Web Results: ${webResultsText ? 'Found some current listings and info online' : 'No current web results'}
Database Parts: ${foundParts.length > 0 ? `Found ${foundParts.length} parts in our catalog` : 'No parts in our database match'}

**HOW TO RESPOND:**

BAD Example (robotic):
"Great! I found some helpful information for your query. Let me walk you through what I discovered: 🧠 From our expert knowledge base (5 verified entries)..."

GOOD Example (conversational):
"Hmm, you just said 'honda' - that's pretty broad! Are you looking for parts for a specific Honda vehicle, trying to troubleshoot a problem, or just browsing around? 

I did find some stuff, but I want to make sure I'm pointing you in the right direction. What's your Honda and what's going on with it?"

**RESPONSE STRUCTURE:**
1. **Acknowledge & Analyze**: Show you understand (or need to understand) their situation
2. **Ask Questions**: If unclear, ask what they really need
3. **Be Selective**: Only share the most relevant info
4. **Explain Why**: Tell them why you're recommending specific things
5. **Next Steps**: What should they do with this info?

**CONVERSATION MEMORY:**
${conversationHistory.length > 0 ? 
  `Previous context: ${conversationHistory.slice(-2).map(msg => `${msg.role}: ${msg.content.substring(0, 100)}`).join(' | ')}` : 
  'This is our first conversation'}

Remember: You're having a real conversation with someone who needs help. Don't be a search engine - be a helpful human who thinks before they speak and cares about solving the actual problem.`

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY as string
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Current question: ${userMessage}\n\nPlease provide a comprehensive, conversational response that takes into account our conversation history and my vehicle preferences.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })

    return completion.choices[0]?.message?.content || null
  } catch (error) {
    console.error('OpenAI API error:', error)
    return null
  }
}

async function parseAIResponseStructure(aiResponse: string, webResults: SearchResult[], knowledgeBase: any[]) {
  // Extract structured information from AI response
  let installation = null
  let tips = null
  let recommendedParts = webResults

  // Look for installation instructions (prioritize knowledge base)
  const knowledgeInstallation = knowledgeBase.find(kb => 
    kb.category === 'installation_guide'
  )
  
  if (knowledgeInstallation) {
    installation = knowledgeInstallation.content
  } else {
    const installationMatch = aiResponse.match(/(?:installation|install|replace|procedure)[\s\S]*?(?=\n\n|$)/i)
    if (installationMatch) {
      installation = installationMatch[0]
    }
  }

  // Look for tips or warnings (prioritize knowledge base)
  const knowledgeTips = knowledgeBase.find(kb => 
    kb.category === 'safety_warning' || kb.category === 'maintenance_tip'
  )
  
  if (knowledgeTips) {
    tips = knowledgeTips.content
  } else {
    const tipsMatch = aiResponse.match(/(?:tip|warning|safety|important|note)[\s\S]*?(?=\n\n|$)/i)
    if (tipsMatch) {
      tips = tipsMatch[0]
    }
  }

  return {
    message: aiResponse,
    parts: recommendedParts,
    knowledgeBase,
    installation,
    tips
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { message, context } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const userId = userPayload.userId
    
    // Get or initialize conversation memory
    if (!conversationMemory.has(userId)) {
      conversationMemory.set(userId, {
        messages: [],
        userPreferences: {
          vehicleMake: '',
          vehicleModel: '',
          vehicleYear: 0,
          experienceLevel: 'intermediate',
          interests: []
        },
        searchHistory: [],
        lastActive: new Date().toISOString()
      })
    }
    
    const userMemory = conversationMemory.get(userId)!
    
    // Add user message to memory
    userMemory.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    })
    
    // Update user preferences from conversation history
    const updatedPreferences = extractUserPreferences(userMemory.messages)
    userMemory.userPreferences = { ...userMemory.userPreferences, ...updatedPreferences }
    userMemory.searchHistory.push(message)
    userMemory.lastActive = new Date().toISOString()

    // Step 1: Search internal database
    const foundParts = await searchPartsInDatabase(message)

    // Step 2: Search knowledge base (verified information)
    const knowledgeBase = await searchKnowledgeBase(message)

    // Step 3: Only do web search if query is specific enough
    let webResults: SearchResult[] = []
    let proactiveResults: SearchResult[] = []
    
    // Detect if query is too vague for web search
    const isVague = message.length < 15 ||
                    message.toLowerCase().includes('information about') ||
                    message.toLowerCase().includes('tell me about') ||
                    message.toLowerCase().includes('how to install them') ||
                    /\b(honda|toyota|bmw|ford)\s+(motors?|parts?|info)\b/i.test(message) ||
                    /\b(want|need|looking for)\s+(info|information|help)\b/i.test(message)
    
    const isSpecific = /\b(brake pad|oil filter|spark plug|cam chain tensioner|alternator|starter|water pump)\b/i.test(message) ||
                      /\b(19|20)\d{2}\b/.test(message) ||
                      /\b(civic|accord|camry|corolla|f150|mustang|cb750)\b/i.test(message)
    
    let proactiveSearches: string[] = []
    
    if (!isVague && isSpecific) {
      // Only search web for specific, clear queries
      webResults = await searchWebForParts(message)
      
      // Step 4: Proactive searches only for specific queries
      proactiveSearches = generateProactiveSearches(message, userMemory.userPreferences)
      
      for (const searchQuery of proactiveSearches) {
        try {
          const results = await searchWebForParts(searchQuery)
          proactiveResults.push(...results)
        } catch (error) {
          console.error('Proactive search error:', error)
        }
      }
    }
    
    // Step 5: Intelligent filtering and scoring
    const allWebResults = [...webResults, ...proactiveResults]
    const scoredResults = allWebResults.map(result => ({
      ...result,
      relevanceScore: scoreResultRelevance(result, message, userMemory.userPreferences)
    }))
    
    // Filter and sort by relevance
    const filteredResults = scoredResults
      .filter(result => result.relevanceScore > 15) // Minimum relevance threshold
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8) // Top 8 most relevant results

    let response: {
      message: string
      parts: any[]
      knowledgeBase?: any[]
      webResults?: SearchResult[]
      installation: string | null
      tips: string | null
      conversationContext?: {
        userPreferences: any
        proactiveSearchesPerformed: string[]
        totalResultsFound: number
        filteredResultsCount: number
      }
    }

    // Step 6: Get enhanced AI response with all data and conversation context
    if (process.env.OPENAI_API_KEY) {
      const aiResponse = await getEnhancedAIResponse(
        message, 
        foundParts, 
        filteredResults, 
        knowledgeBase,
        userMemory.messages.slice(-10), // Last 10 messages for context
        userMemory.userPreferences
      )
      
      if (aiResponse) {
        const structuredResponse = await parseAIResponseStructure(aiResponse, filteredResults, knowledgeBase)
        
        response = {
          ...structuredResponse,
          webResults: filteredResults, // Include filtered results
          parts: foundParts,
          conversationContext: {
            userPreferences: userMemory.userPreferences,
            proactiveSearchesPerformed: proactiveSearches,
            totalResultsFound: allWebResults.length,
            filteredResultsCount: filteredResults.length
          }
        }
        
        // Add AI response to memory
        userMemory.messages.push({
          role: 'assistant',
          content: structuredResponse.message,
          timestamp: new Date().toISOString()
        })
        
        // Update usage count for used knowledge entries
        for (const kb of knowledgeBase) {
          try {
            await (Knowledge.findById(kb._id) as any)?.incrementUsage()
          } catch (error) {
            console.error('Error updating knowledge usage:', error)
          }
        }
        
      } else {
        // Fallback if AI fails
        response = getFallbackResponse(message, foundParts, filteredResults, knowledgeBase)
      }
    } else {
      // No OpenAI API key, use enhanced fallback with all sources
      response = getFallbackResponse(message, foundParts, filteredResults, knowledgeBase)
    }

    return NextResponse.json({
      response: response.message,
      parts: response.parts || [],
      knowledgeBase: response.knowledgeBase || [],
      webResults: response.webResults || [],
      installation: response.installation,
      tips: response.tips,
      conversationContext: response.conversationContext,
      timestamp: new Date().toISOString(),
      aiPowered: !!process.env.OPENAI_API_KEY,
      webSearchEnabled: true,
      knowledgeBaseEnabled: true,
      sources: {
        database: foundParts.length,
        knowledge: knowledgeBase.length,
        web: filteredResults.length,
        proactiveSearches: proactiveSearches.length
      }
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getFallbackResponse(message: string, foundParts: any[], webResults: SearchResult[] = [], knowledgeBase: any[] = []) {
  const lowerMessage = message.toLowerCase()
  
  // Much more aggressive vague query detection
  const isVague = 
    lowerMessage.length < 15 || // Very short queries
    lowerMessage.includes('information about') ||
    lowerMessage.includes('tell me about') ||
    lowerMessage.includes('how to install them') ||
    lowerMessage.includes('motors') && !lowerMessage.includes('specific') ||
    /\b(honda|toyota|bmw|ford)\s+(motors?|parts?|info)\b/i.test(message) ||
    /\b(want|need|looking for)\s+(info|information|help)\b/i.test(message) ||
    lowerMessage.split(' ').length < 4 && !lowerMessage.includes('tensioner') ||
    lowerMessage.includes('how to install') && !lowerMessage.includes('brake') && !lowerMessage.includes('filter') && !lowerMessage.includes('part')
  
  const isSpecificPart = /\b(brake pad|oil filter|spark plug|air filter|cam chain tensioner|clutch plate|timing belt|water pump|alternator|starter)\b/i.test(message)
  const isSpecificProblem = /\b(won't start|making noise|overheating|leaking|grinding|squealing|rough idle)\b/i.test(message)
  const hasVehicleDetails = /\b(19|20)\d{2}\b/.test(message) || /\b(civic|accord|camry|corolla|f150|mustang)\b/i.test(message)
  
  if (isVague) {
    // Don't even show web results for vague queries
    return {
      message: `Whoa there! 🛑

"${message}" is way too broad for me to help effectively.

Here's the thing - installing Honda motors could mean:
• Swapping an engine in a car?
• Installing a small Honda generator motor?
• Replacing a motor mount?
• Something completely different?

I need to know:
🚗 **What vehicle** are we talking about? (year, make, model)
🔧 **What specific motor/engine** are you dealing with?
⚙️ **What exactly** are you trying to install or fix?
🎯 **What's the context** - is something broken, are you upgrading, etc.?

Give me the real details and I'll give you proper guidance instead of generic fluff! 💪`,
      parts: [],
      knowledgeBase: [],
      webResults: [],
      installation: null,
      tips: "The more specific you are, the better help I can give you. Vague questions get vague (useless) answers!"
    }
  }

  // Only proceed with searches if query is specific enough
  if (!isSpecificPart && !isSpecificProblem && !hasVehicleDetails) {
    return {
      message: `I can see you're asking about "${message}", but I need more specifics to really help you.

What I'm missing:
• **Specific vehicle** (year, make, model)
• **Exact part** you're working with
• **What problem** you're trying to solve

For example, instead of "honda motors", tell me:
• "2015 Honda Civic engine mount replacement"
• "Honda CB750 cam chain tensioner install"
• "Honda Accord V6 alternator removal"

Give me those details and I'll find you exactly what you need! 🎯`,
      parts: [],
      knowledgeBase: [],
      webResults: [],
      installation: null,
      tips: null
    }
  }

  // Only show results if we actually have good, relevant data
  if (foundParts.length > 0 || webResults.length > 0 || knowledgeBase.length > 0) {
    // Filter out garbage results
    const relevantKnowledge = knowledgeBase.filter(kb => 
      kb.category === 'installation_guide' && kb.usefulness_score >= 7 ||
      kb.category === 'troubleshooting' && kb.usefulness_score >= 6
    )
    
    const relevantWebResults = webResults.filter(result => 
      (result.price && parseFloat(result.price.replace(/[^0-9.]/g, '')) > 5) ||
      ['RockAuto', 'Amazon', 'AutoZone'].includes(result.supplier || '') &&
      !result.title.toLowerCase().includes(lowerMessage.toLowerCase()) // Filter out exact query matches
    ).slice(0, 3)
    
    // Don't show anything if we don't have quality results
    if (relevantKnowledge.length === 0 && relevantWebResults.length === 0 && foundParts.length === 0) {
      return {
        message: `I searched for "${message}" but didn't find anything specific enough to be helpful.

This usually means:
• The query is too general
• You need to be more specific about your vehicle
• The part/issue name might be different

Try being more specific - what exact vehicle and what exact problem or part? 🎯`,
        parts: [],
        knowledgeBase: [],
        webResults: [],
        installation: null,
        tips: null
      }
    }
    
    let responseMessage = `Got it - looking into "${message}".`
    
    if (relevantKnowledge.length > 0) {
      responseMessage += `\n\n💡 Found ${relevantKnowledge.length} solid technical guide(s) that actually look relevant.`
      
      if (relevantKnowledge[0].category === 'installation_guide') {
        responseMessage += ` The main one is a proper installation guide - could be exactly what you need.`
      }
    }
    
    if (relevantWebResults.length > 0) {
      const pricesAvailable = relevantWebResults.filter(r => r.price)
      
      responseMessage += `\n\n🛒 Found ${relevantWebResults.length} current listings that look legitimate.`
      
      if (pricesAvailable.length > 0) {
        const prices = pricesAvailable.map(r => parseFloat(r.price?.replace(/[^0-9.]/g, '') || '0'))
        const lowestPrice = Math.min(...prices)
        responseMessage += ` Prices start around $${lowestPrice.toFixed(2)}.`
      }
    }
    
    if (foundParts.length > 0) {
      responseMessage += `\n\n📚 Also found ${foundParts.length} parts in our catalog that might match.`
    }
    
    responseMessage += `\n\n**Next move:** Check the details below, but if this isn't what you meant, be more specific about your vehicle and what you're actually trying to do.`
    
    return {
      message: responseMessage,
      parts: foundParts,
      knowledgeBase: relevantKnowledge,
      webResults: relevantWebResults,
      installation: relevantKnowledge.find(kb => kb.category === 'installation_guide')?.content || null,
      tips: "Still not finding what you need? Be more specific about your exact vehicle and the specific part or problem."
    }
  }
  
  // Handle specific common queries with personality
  if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
    return {
      message: `Cam chain tensioner - now we're talking! 🔧

But I still need specifics:
• What bike/car? (Honda CB750? Civic? Something else?)
• What's the problem? (Noisy? Preventive maintenance?)
• What year?

CCTs are bike/engine specific and range from $50-$200+ depending on OEM vs aftermarket. Give me the details and I'll point you to the right part and approach!`,
      parts: [],
      knowledgeBase: [],
      webResults: [],
      installation: null,
      tips: null
    }
  }
  
  // Default for truly unclear queries
  return {
    message: `Hey! 👋 

I couldn't find anything useful for "${message}" - it's probably too vague or I need more context.

I'm good at helping with:
• Specific parts (brake pads, oil filters, etc.)
• Specific problems (won't start, making noise, etc.)
• Specific vehicles (2015 Honda Civic, Honda CB750, etc.)

What's your exact vehicle and what are you trying to accomplish? Give me something concrete to work with! 🔧`,
    parts: [],
    knowledgeBase: [],
    webResults: [],
    installation: null,
    tips: null
  }
} 