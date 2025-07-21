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
  knowledgeBase: any[] = []
) {
  const webResultsText = webResults.length > 0 
    ? `\n\nRECENT WEB SEARCH RESULTS:\n${webResults.map(result => 
        `• ${result.title}\n  Supplier: ${result.supplier || 'Unknown'}\n  Price: ${result.price || 'Not specified'}\n  URL: ${result.url}\n  Description: ${result.description}`
      ).join('\n\n')}`
    : ''

  const knowledgeText = knowledgeBase.length > 0
    ? `\n\nVERIFIED KNOWLEDGE BASE:\n${knowledgeBase.map(kb => 
        `• ${kb.title}\n  Category: ${kb.category}\n  Usefulness: ${kb.usefulness_score}/10\n  Content: ${kb.summary}\n  ${kb.sources?.[0]?.url ? `Source: ${kb.sources[0].url}` : ''}`
      ).join('\n\n')}`
    : ''

  const systemPrompt = `You are an expert vehicle parts assistant with access to real-time web search capabilities and a verified knowledge base. Your role is to help users find the right parts for their vehicles and provide comprehensive guidance.

**Your capabilities:**
- Expert knowledge of automotive and motorcycle parts
- Access to live web search results from major parts suppliers
- Database of catalogued parts
- Verified knowledge base with installation guides, troubleshooting, and expert tips
- Installation guidance and safety recommendations
- Price comparison and supplier recommendations

**Guidelines:**
- PRIORITIZE verified knowledge base information when available (higher reliability)
- Provide specific part recommendations with real pricing when available
- Include installation tips and safety warnings
- Reference web search results when they contain relevant parts/pricing
- Suggest multiple suppliers for price comparison
- Be honest about limitations and recommend professional help when needed
- Always prioritize safety in recommendations
- When using knowledge base info, mention the source reliability

**Available data sources:**
1. Internal parts database: ${JSON.stringify(foundParts)}
2. Verified knowledge base (most reliable): ${knowledgeText}
3. Live web search results: ${webResultsText}

**Instructions:**
- Start with knowledge base information if relevant (these are verified sources)
- Analyze the user's query for vehicle make/model/year if provided
- Combine all sources for comprehensive recommendations
- Provide specific part numbers and prices when available
- Include direct purchase links from the web results
- Give installation guidance appropriate to the user's skill level
- Mention safety considerations and tools needed
- If knowledge base has installation guides, prioritize those instructions

Keep responses informative but concise. Structure your response with clear sections for parts, pricing, installation, and safety tips.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Upgraded to GPT-4 Turbo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1500, // Increased for more detailed responses with knowledge base
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response at the moment."
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

    // Step 1: Search internal database
    const foundParts = await searchPartsInDatabase(message)

    // Step 2: Search knowledge base (verified information)
    const knowledgeBase = await searchKnowledgeBase(message)

    // Step 3: Search web for current parts/pricing
    const webResults = await searchWebForParts(message)

    let response: {
      message: string
      parts: any[]
      knowledgeBase?: any[]
      webResults?: SearchResult[]
      installation: string | null
      tips: string | null
    }

    // Step 4: Get enhanced AI response with all data
    if (process.env.OPENAI_API_KEY) {
      const aiResponse = await getEnhancedAIResponse(message, foundParts, webResults, knowledgeBase)
      
      if (aiResponse) {
        const structuredResponse = await parseAIResponseStructure(aiResponse, webResults, knowledgeBase)
        
        response = {
          ...structuredResponse,
          webResults, // Include web results separately for UI
          parts: foundParts // Keep database parts separate
        }
        
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
        response = getFallbackResponse(message, foundParts, webResults, knowledgeBase)
      }
    } else {
      // No OpenAI API key, use enhanced fallback with all sources
      response = getFallbackResponse(message, foundParts, webResults, knowledgeBase)
    }

    return NextResponse.json({
      response: response.message,
      parts: response.parts || [],
      knowledgeBase: response.knowledgeBase || [],
      webResults: response.webResults || [],
      installation: response.installation,
      tips: response.tips,
      timestamp: new Date().toISOString(),
      aiPowered: !!process.env.OPENAI_API_KEY,
      webSearchEnabled: true,
      knowledgeBaseEnabled: true,
      sources: {
        database: foundParts.length,
        knowledge: knowledgeBase.length,
        web: webResults.length
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
    let responseMessage = `I found information for your query:`
    
    if (knowledgeBase.length > 0) {
      responseMessage += `\n\nFrom verified knowledge base: ${knowledgeBase.length} expert entries`
    }
    
    if (foundParts.length > 0) {
      responseMessage += `\n\nFrom our database: ${foundParts.length} catalogued parts`
    }
    
    if (webResults.length > 0) {
      responseMessage += `\n\nFrom web search: ${webResults.length} current listings with prices`
      responseMessage += `\n\nTop recommendations:\n${webResults.slice(0, 3).map(result => 
        `• ${result.title} - ${result.supplier} ${result.price ? `($${result.price})` : ''}`
      ).join('\n')}`
    }

    return {
      message: responseMessage,
      parts: foundParts,
      knowledgeBase,
      webResults,
      installation: knowledgeBase.find(kb => kb.category === 'installation_guide')?.content || 
                   "Please refer to your vehicle's service manual for specific installation procedures.",
      tips: knowledgeBase.find(kb => kb.category === 'safety_warning')?.content || 
           "Always use quality parts and follow proper torque specifications for safety."
    }
  }
  
  // Check for key phrases in mock responses
  if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
    return {
      message: "I found some cam chain tensioner information. Let me search for current pricing and verified guidance:",
      ...mockResponses['cam chain tensioner'],
      knowledgeBase,
      webResults
    }
  }
  
  return {
    message: "I'd be happy to help you find the right parts! Could you provide more details about your vehicle (make, model, year) and the specific part you're looking for? I can search our database, verified knowledge base, and current online listings for the best options.",
    parts: [],
    knowledgeBase,
    webResults,
    installation: null,
    tips: null
  }
} 