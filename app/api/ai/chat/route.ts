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
  
  // Enhanced vehicle make detection
  const makeRegex = /\b(honda|yamaha|kawasaki|suzuki|bmw|harley|ducati|ford|toyota|mercedes|audi|nissan|mazda|subaru|volkswagen|vw|lexus|acura|infiniti|cadillac|chevrolet|chevy|gmc|dodge|ram|jeep|chrysler)\b/gi
  const makeMatches = allText.match(makeRegex)
  if (makeMatches) {
    preferences.vehicleMake = makeMatches[makeMatches.length - 1] // Use the most recent mention
  }
  
  // Enhanced model detection
  const modelRegex = /\b(civic|accord|camry|corolla|f150|f-150|mustang|focus|fiesta|explorer|cb750|cb650|cb500|cbr|ninja|gsxr|r6|r1|m3|m5|x3|x5|3 series|5 series|e46|e90|e92|prius|rav4|highlander|pilot|crv|cr-v|hrv|hr-v|wrx|sti|legacy|outback|forester|impreza|brz)\b/gi
  const modelMatches = allText.match(modelRegex)
  if (modelMatches) {
    preferences.vehicleModel = modelMatches[modelMatches.length - 1] // Use the most recent mention
  }
  
  // Enhanced year detection
  const yearRegex = /\b(19[89]\d|20[0-2]\d)\b/g
  const yearMatches = allText.match(yearRegex)
  if (yearMatches) {
    const years = yearMatches.map(y => parseInt(y))
    preferences.vehicleYear = Math.max(...years) // Use the most recent/highest year
  }
  
  // Experience level indicators
  if (allText.includes('beginner') || allText.includes('new to') || allText.includes('first time') || allText.includes('never done')) {
    preferences.experienceLevel = 'beginner'
  } else if (allText.includes('expert') || allText.includes('professional') || allText.includes('mechanic') || allText.includes('years of experience')) {
    preferences.experienceLevel = 'expert'
  }
  
  // Interest detection
  const interests = []
  if (/\b(brake|brakes)\b/i.test(allText)) interests.push('brakes')
  if (/\b(engine|motor|swap)\b/i.test(allText)) interests.push('engine')
  if (/\b(suspension|shock|strut)\b/i.test(allText)) interests.push('suspension')
  if (/\b(electrical|wiring|lights)\b/i.test(allText)) interests.push('electrical')
  if (/\b(exhaust|muffler|pipe)\b/i.test(allText)) interests.push('exhaust')
  preferences.interests = interests
  
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

  const systemPrompt = `You are Alex, a seasoned mechanic with 15 years of experience who loves helping people with their vehicles. You're known for being direct, asking good questions, and remembering what people tell you.

**CRITICAL: REMEMBER CONVERSATION CONTEXT**

${conversationHistory.length > 0 ? 
  `**IMPORTANT - We've been talking! Here's our conversation context:**
  ${conversationHistory.slice(-3).map(msg => `${msg.role.toUpperCase()}: ${msg.content.substring(0, 150)}...`).join('\n')}` : 
  'This is our first conversation together.'}

**USER'S VEHICLE & CONTEXT:**
- Vehicle: ${userPreferences.vehicleMake || 'Not specified'} ${userPreferences.vehicleModel || ''} ${userPreferences.vehicleYear || ''}
- Experience: ${userPreferences.experienceLevel || 'intermediate'}
- Interests: ${userPreferences.interests?.join(', ') || 'General automotive'}
- Search History: ${conversationHistory.slice(-3).map(msg => msg.content.substring(0, 50)).join(' | ') || 'None'}

**HOW TO USE CONVERSATION MEMORY:**
1. **Reference previous messages** - "As we discussed about your CB750..." or "Building on your BMW question..."
2. **Build on context** - If they mentioned a vehicle before, don't ask again
3. **Connect topics** - Link current questions to past discussions
4. **Remember specifics** - If they said 2015 Honda Civic, keep that in mind
5. **Follow-up appropriately** - "give me tips" should relate to what we've been discussing

**BEFORE YOU RESPOND, ASK YOURSELF:**
1. What vehicle were we talking about?
2. What specific problem or part was mentioned?
3. Is this a follow-up question to our previous discussion?
4. Can I build on what they told me before?

**CONVERSATION RULES:**
1. **USE CONTEXT FIRST**: If we've been talking about a Honda CB750, and they ask "give me tips", give CB750-specific tips
2. **REMEMBER DETAILS**: Don't ask for info they already gave you
3. **BUILD CONVERSATIONS**: Connect current query to previous messages
4. **BE SPECIFIC**: Use their vehicle details when giving advice
5. **ASK SMART FOLLOW-UPS**: Based on conversation history, suggest next logical steps

**AVAILABLE INFORMATION:**
Knowledge Base: ${knowledgeText ? 'I have verified technical guides available' : 'No specific guides found'}
Web Results: ${webResultsText ? 'Found current market information' : 'No current web results'}
Database Parts: ${foundParts.length > 0 ? `Found ${foundParts.length} relevant parts` : 'No direct parts matches'}

**RESPONSE STYLE:**
- Start by acknowledging our conversation context when relevant
- Reference their specific vehicle when you know it
- Connect current question to previous discussions
- Give targeted advice based on what you know about their situation
- Ask clarifying questions only when truly needed

**EXAMPLE GOOD RESPONSES:**
- "Based on our CB750 discussion, here are the specific tips for cam chain tensioner replacement..."
- "For your 2015 Civic engine mount job we talked about, here's what to watch out for..."
- "Following up on your BMW question - here are the installation steps..."

Remember: You're having an ongoing conversation with someone. Use what they've told you before!`

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
    const isVague = message.length < 10 ||  // Only extremely short queries
                    message.toLowerCase().includes('information about') && message.length < 50 ||  // Only short "info about" requests
                    message.toLowerCase().includes('tell me about') && message.length < 50 ||     // Only short "tell me" requests
                    /\b(honda|toyota|bmw|ford)\s+(motors?|parts?|info)$\b/i.test(message) ||     // Only if it ENDS with these generic terms
                    /^(want|need|looking for)\s+(info|information|help)$/i.test(message.trim())    // Only standalone requests
    
    const isSpecific = /\b(brake pad|oil filter|spark plug|cam chain tensioner|alternator|starter|water pump|boost control|solenoid|ebcs|turbo|intercooler|downpipe)\b/i.test(message) ||
                      /\b(19|20)\d{2}\b/.test(message) ||
                      /\b(civic|accord|camry|corolla|f150|mustang|cb750|wrx|sti|subaru|bmw|audi|mercedes|lexus|acura)\b/i.test(message) ||
                      message.length > 100  // Long detailed messages are probably specific
    
    // Allow follow-up questions if we have conversation context
    const isFollowUpQuestion = /\b(tips|advice|help|guide|how to|install|replace|fix)\b/i.test(message) && 
                              userMemory.messages.length > 2 &&
                              userMemory.userPreferences.vehicleMake
    
    const hasConversationContext = userMemory.messages.length > 0 && 
                                  (userMemory.userPreferences.vehicleMake || 
                                   userMemory.searchHistory.some(search => 
                                     /\b(19|20)\d{2}\b/.test(search) || 
                                     /\b(civic|accord|cb750|m3|camry|wrx|sti|subaru|bmw|audi|mercedes|lexus|acura)\b/i.test(search)
                                   ))
    
    let proactiveSearches: string[] = []
    
    if (!isVague && (isSpecific || isFollowUpQuestion || hasConversationContext)) {
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
  
  // Much more aggressive vague query detection, but consider conversation context
  const isVague = 
    lowerMessage.length < 8 || // Only very short queries
    lowerMessage.includes('information about') && lowerMessage.length < 30 ||
    lowerMessage.includes('tell me about') && lowerMessage.length < 30 ||
    lowerMessage === 'honda motors' || lowerMessage === 'toyota parts' || // Exact simple matches only
    /^(want|need|looking for)\s+(info|information|help)$/i.test(message.trim()) ||  // Only standalone requests
    (lowerMessage.split(' ').length < 3 && !lowerMessage.includes('tensioner') && !lowerMessage.includes('solenoid') && !lowerMessage.includes('ebcs'))  // Very short without specific parts

  const isSpecificPart = /\b(brake pad|oil filter|spark plug|air filter|cam chain tensioner|clutch plate|timing belt|water pump|alternator|starter|boost control|solenoid|ebcs|turbo|intercooler|downpipe)\b/i.test(message)
  const isSpecificProblem = /\b(won't start|making noise|overheating|leaking|grinding|squealing|rough idle|boost spikes|inconsistent boost)\b/i.test(message)
  const hasVehicleDetails = /\b(19|20)\d{2}\b/.test(message) || /\b(civic|accord|camry|corolla|f150|mustang|cb750|m3|m1|wrx|sti|subaru|bmw|audi|mercedes|lexus|acura|hatchback)\b/i.test(message)
  
  // Check for follow-up questions (tips, advice, etc.)
  const isFollowUpRequest = /\b(tips|advice|help|guide|more info|tell me more)\b/i.test(message)
  
  // Special handling for follow-up requests
  if (isFollowUpRequest && !isVague) {
    return {
      message: `Great question! Here are some general tips:

🔧 **Installation Best Practices:**
• Always disconnect the battery before starting electrical work
• Use the right tools - cheap tools break and can damage parts
• Take photos before disassembly so you remember how it goes back together
• Work in good lighting and have a clean workspace
• Keep track of bolts and small parts in labeled containers

⚠️ **Safety First:**
• Jack stands, never just a jack for safety
• Safety glasses when working under the hood
• Let the engine cool down before working on cooling system
• Use proper torque specifications - too tight can break, too loose can fail

💰 **Money-Saving Tips:**
• Compare OEM vs aftermarket - sometimes aftermarket is 80% as good for 50% the price
• Buy in bulk for maintenance items (oil, filters)
• YouTube is your friend for visual guides
• Don't be afraid to ask for help - better safe than sorry

🛠️ **Common Mistakes to Avoid:**
• Rushing the job - take your time
• Not having all parts before starting
• Forgetting to check compatibility with your specific year/trim
• Skipping the test drive after repairs

Need specific advice for a particular repair? Just ask! 🎯`,
      parts: foundParts,
      knowledgeBase,
      webResults,
      installation: `**General Installation Approach:**

1. **Preparation Phase:**
   - Gather all tools and parts
   - Read through entire procedure first
   - Ensure proper lighting and workspace
   - Have service manual or reliable guide ready

2. **Safety Setup:**
   - Disconnect battery negative terminal
   - Use proper jack stands if lifting vehicle
   - Wear safety glasses and gloves
   - Let engine cool if working on hot components

3. **Documentation:**
   - Take photos before disassembly
   - Note torque specifications
   - Keep hardware organized
   - Mark electrical connections

4. **Installation:**
   - Clean mating surfaces
   - Use appropriate sealants/gaskets
   - Torque to specification in proper sequence
   - Double-check all connections

5. **Testing:**
   - Reconnect battery
   - Check for leaks or unusual noises
   - Test drive if applicable
   - Monitor for first few days`,
      tips: `**Pro Tips from Experienced Mechanics:**

🎯 **Before You Start:**
- Check multiple sources for procedures - manuals can have errors
- Buy quality parts, especially for safety-critical components
- Have a backup plan if something goes wrong

🔧 **During Installation:**
- "Finger tight plus" - don't overtighten everything
- If it feels wrong, stop and double-check
- Clean threads prevent galling and ensure proper torque

⚠️ **Common Gotchas:**
- Some bolts are one-time use (stretch bolts)
- Direction matters on asymmetric parts
- Some parts need bedding-in period
- Always test before putting everything back together

💡 **Professional Secrets:**
- Penetrating oil is your friend for old bolts
- Heat helps with stuck components (carefully!)
- Sometimes the "15-minute job" takes 3 hours - plan accordingly
- Keep a detailed log of what you've done to your vehicle`
    }
  }

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

  // If we get here, the query was specific but didn't find good results
  if (isSpecificPart || isSpecificProblem || hasVehicleDetails || message.length > 50) {
    return {
      message: `I can see you're looking for specific help, but I didn't find great results in my current databases.

**Your query looks detailed and specific** - that's good! The issue might be:
• **Limited search results** - try different part names or model numbers
• **Regional availability** - some parts might not be available in your area  
• **Timing** - new or rare parts might take longer to find

**What I'd suggest:**
🔍 **Try alternative search terms** - different part numbers, brand names, or descriptions
🌐 **Check specialized forums** - vehicle-specific communities often have the best info
🛒 **Contact dealers directly** - they might have parts not listed online
📱 **Try mobile apps** - some part suppliers have better mobile catalogs

Want to try rephrasing your search or need help finding the right resources? 🎯`,
      parts: foundParts,
      knowledgeBase,
      webResults,
      installation: `**When You Do Find the Right Part:**

1. **Verify Compatibility:**
   - Double-check part numbers against your vehicle's VIN
   - Confirm year, trim level, and engine specifications
   - Look for any special installation requirements

2. **Preparation:**
   - Read through any available installation guides first
   - Gather all necessary tools before starting
   - Plan for proper disposal of old parts

3. **Installation Best Practices:**
   - Take photos before disassembly
   - Work in good lighting with proper safety equipment
   - Don't force anything - if it doesn't fit easily, double-check compatibility

4. **Testing:**
   - Test functionality before fully reassembling
   - Check for leaks, proper connections, or unusual noises
   - Monitor performance for the first few drives`,
      tips: `**For Hard-to-Find Parts:**

🎯 **Search Strategy:**
- Use multiple search terms and part numbers
- Check both OEM and aftermarket suppliers
- Look at similar model years or trim levels

🔧 **Alternative Sources:**
- Salvage yards for discontinued parts
- Aftermarket specialists for performance upgrades
- Import specialists for JDM or European parts

💡 **Community Resources:**
- Vehicle-specific Facebook groups
- Reddit communities (r/cars, r/MechanicAdvice)
- Manufacturer forums and owner clubs

⚠️ **Quality Considerations:**
- Read reviews before buying from unknown suppliers
- Verify return policies for expensive parts
- Consider professional installation for complex components`
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
  
  // General fallback for queries that don't fit other patterns
  return {
    message: `I see you're asking about "${message}" but I'm not quite sure how to help best.

Could you help me understand:
🚗 **What vehicle** are you working with? (year, make, model)
🔧 **What specific part or problem** are you dealing with?
🎯 **What's your goal** - are you troubleshooting, upgrading, or maintaining?

The more details you give me, the better I can point you in the right direction! 🛠️`,
    parts: foundParts,
    knowledgeBase,
    webResults,
    installation: null,
    tips: "Feel free to be as specific as possible - I work best with detailed questions!"
  }
} 