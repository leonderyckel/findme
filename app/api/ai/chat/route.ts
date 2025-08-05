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

  const systemPrompt = `You are a friendly, experienced automotive expert who loves helping people solve car and motorcycle problems. Think of yourself as the knowledgeable mechanic neighbor who always has time to explain things clearly.

**IMPORTANT - You have conversation memory and user context:**
- User's Vehicle: ${userPreferences.vehicleMake || 'Not specified'} ${userPreferences.vehicleModel || ''} ${userPreferences.vehicleYear || ''}
- Experience Level: ${userPreferences.experienceLevel || 'intermediate'}
- Past Interests: ${userPreferences.interests?.join(', ') || 'General automotive'}

**Your enhanced personality:**
- Remember what the user told you before - reference previous conversation
- Adapt your explanations to their experience level (${userPreferences.experienceLevel})
- Be more specific since you know their vehicle type
- Ask follow-up questions to help them better
- Suggest related maintenance or parts they might need
- Celebrate when you find perfect matches for their specific vehicle

**How to use conversation context:**
- Reference previous messages naturally: "As we discussed earlier..." or "Building on what you mentioned about..."
- Connect current request to past conversations
- Suggest next logical steps based on conversation flow
- Point out patterns or related issues from their history

**Enhanced search capabilities:**
- I performed additional proactive searches based on our conversation
- Results are now intelligently filtered and scored for relevance
- Higher relevance scores mean better matches for your specific needs
- I prioritize results that match your vehicle and experience level

**Available data sources:**
1. Internal parts database: ${JSON.stringify(foundParts)}
2. Verified knowledge base (expert-reviewed): ${knowledgeText}
3. Intelligently filtered web search results: ${webResultsText}
4. Our conversation history: ${conversationContext}

**Response style - Enhanced:**
- Start by acknowledging our ongoing conversation
- Reference their specific vehicle when relevant
- Explain why certain results are more relevant than others
- Ask clarifying questions to continue the conversation
- Suggest what to discuss next or what information would be helpful
- Be proactive about related topics they might want to explore

**Example enhanced approach:**
"Looking at your ${userPreferences.vehicleMake || 'vehicle'}, and building on what we discussed about [previous topic], I found some interesting options. The top result has a high relevance score because it specifically matches your ${userPreferences.experienceLevel} experience level and your vehicle type..."

Remember: You're having an ongoing conversation with someone who trusts your expertise. Make them feel like you remember them and care about solving their specific problems.`

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

    // Step 3: Search web for current parts/pricing
    const webResults = await searchWebForParts(message)
    
    // Step 4: Proactive searches based on context
    const proactiveSearches = generateProactiveSearches(message, userMemory.userPreferences)
    let proactiveResults: SearchResult[] = []
    
    for (const searchQuery of proactiveSearches) {
      try {
        const results = await searchWebForParts(searchQuery)
        proactiveResults.push(...results)
      } catch (error) {
        console.error('Proactive search error:', error)
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
  
  if (foundParts.length > 0 || webResults.length > 0 || knowledgeBase.length > 0) {
    let responseMessage = `Great! I found some helpful information for your query. Let me walk you through what I discovered:`
    
    // Knowledge base findings
    if (knowledgeBase.length > 0) {
      responseMessage += `\n\n🧠 **From our expert knowledge base** (${knowledgeBase.length} verified entries):`
      
      const topKnowledge = knowledgeBase[0]
      responseMessage += `\n\nThe most relevant entry is about "${topKnowledge.title}" - this comes from our verified sources with a reliability score of ${topKnowledge.sources?.[0]?.reliability_score || 'high'}/10. `
      
      if (topKnowledge.category === 'installation_guide') {
        responseMessage += `Since this is an installation guide, you can trust these step-by-step instructions.`
      } else if (topKnowledge.category === 'troubleshooting') {
        responseMessage += `This troubleshooting guide has helped other users resolve similar issues.`
      } else if (topKnowledge.category === 'safety_warning') {
        responseMessage += `Important: This contains safety information you'll want to review before proceeding.`
      }
    }
    
    // Web results findings
    if (webResults.length > 0) {
      responseMessage += `\n\n🛒 **Current market options** (${webResults.length} live listings):`
      
      const topResults = webResults.slice(0, 3)
      const pricesAvailable = topResults.filter(r => r.price)
      
      if (pricesAvailable.length > 0) {
        const lowestPrice = Math.min(...pricesAvailable.map(r => parseFloat(r.price?.replace(/[^0-9.]/g, '') || '0')))
        const highestPrice = Math.max(...pricesAvailable.map(r => parseFloat(r.price?.replace(/[^0-9.]/g, '') || '0')))
        
        responseMessage += `\n\nPrice range I found: ${lowestPrice.toFixed(2)} to ${highestPrice.toFixed(2)}. `
        
        if (highestPrice / lowestPrice > 1.5) {
          responseMessage += `There's quite a price spread here - the higher-priced options might be OEM or premium quality, while lower prices could be aftermarket alternatives.`
        }
      }
      
      responseMessage += `\n\nTop recommendations:\n`
      topResults.forEach((result, idx) => {
        responseMessage += `• **${result.title}** from ${result.supplier}${result.price ? ` (${result.price})` : ''}\n`
        if (idx === 0 && result.description) {
          responseMessage += `  └ ${result.description.substring(0, 100)}${result.description.length > 100 ? '...' : ''}\n`
        }
      })
    }
    
    // Database parts
    if (foundParts.length > 0) {
      responseMessage += `\n\n📚 **From our parts database** (${foundParts.length} catalogued parts):`
      responseMessage += `\n\nI also found ${foundParts.length} matching parts in our internal database. These are parts we've catalogued and verified for compatibility.`
    }
    
    // Next steps
    responseMessage += `\n\n**What I'd suggest next:**`
    
    if (webResults.length > 0) {
      responseMessage += `\n• Check out the top listings above - I'd start with the ${webResults[0].supplier} option`
    }
    if (knowledgeBase.length > 0) {
      const installGuide = knowledgeBase.find(kb => kb.category === 'installation_guide')
      if (installGuide) {
        responseMessage += `\n• Review the installation guide below - it'll help you understand what you're getting into`
      }
    }
    responseMessage += `\n• Double-check compatibility with your specific vehicle year and model before ordering`
    
    return {
      message: responseMessage,
      parts: foundParts,
      knowledgeBase,
      webResults,
      installation: knowledgeBase.find(kb => kb.category === 'installation_guide')?.content || 
                   "I'd recommend checking your vehicle's service manual for specific installation procedures. Every model can have its quirks!",
      tips: knowledgeBase.find(kb => kb.category === 'safety_warning')?.content || 
           "Always use quality parts and follow proper torque specifications. When in doubt, have a professional double-check your work - safety first!"
    }
  }
  
  // Handle specific queries with mock responses
  if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
    return {
      message: `Ah, cam chain tensioner issues! That's a common concern, especially on older bikes. Let me search for current pricing and verified guidance for you. The CCT is crucial for maintaining proper timing, so you'll want to get this sorted out properly.`,
      ...mockResponses['cam chain tensioner'],
      knowledgeBase,
      webResults
    }
  }
  
  // Default helpful response
  return {
    message: `I'd love to help you find the right parts! 🔧 

To give you the most accurate recommendations, could you share a bit more about:
• Your vehicle details (make, model, year)
• The specific part or problem you're dealing with
• Whether you're planning to install it yourself or have a shop do it

With those details, I can search our expert knowledge base, current market listings, and parts database to find exactly what you need. I'm here to make sure you get the right part at a good price! 

What's going on with your ride?`,
    parts: [],
    knowledgeBase,
    webResults,
    installation: null,
    tips: null
  }
} 