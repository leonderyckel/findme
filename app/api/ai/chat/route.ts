import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Part from '@/models/Part'
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
  webResults: SearchResult[] = []
) {
  const webResultsText = webResults.length > 0 
    ? `\n\nRECENT WEB SEARCH RESULTS:\n${webResults.map(result => 
        `• ${result.title}\n  Supplier: ${result.supplier || 'Unknown'}\n  Price: ${result.price || 'Not specified'}\n  URL: ${result.url}\n  Description: ${result.description}`
      ).join('\n\n')}`
    : ''

  const systemPrompt = `You are an expert vehicle parts assistant with access to real-time web search capabilities. Your role is to help users find the right parts for their vehicles and provide comprehensive guidance.

**Your capabilities:**
- Expert knowledge of automotive and motorcycle parts
- Access to live web search results from major parts suppliers
- Database of catalogued parts
- Installation guidance and safety recommendations
- Price comparison and supplier recommendations

**Guidelines:**
- Provide specific part recommendations with real pricing when available
- Include installation tips and safety warnings
- Reference web search results when they contain relevant parts/pricing
- Suggest multiple suppliers for price comparison
- Be honest about limitations and recommend professional help when needed
- Always prioritize safety in recommendations

**Available data sources:**
1. Internal parts database: ${JSON.stringify(foundParts)}
2. Live web search results: ${webResultsText}

**Instructions:**
- Analyze the user's query for vehicle make/model/year if provided
- Combine database and web results for comprehensive recommendations
- Provide specific part numbers and prices when available
- Include direct purchase links from the web results
- Give installation guidance appropriate to the user's skill level
- Mention safety considerations and tools needed

Keep responses informative but concise. Structure your response with clear sections for parts, pricing, installation, and safety tips.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Upgraded to GPT-4 Turbo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1200, // Increased for more detailed responses
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response at the moment."
  } catch (error) {
    console.error('OpenAI API error:', error)
    return null
  }
}

async function parseAIResponseStructure(aiResponse: string, webResults: SearchResult[]) {
  // Extract structured information from AI response
  let installation = null
  let tips = null
  let recommendedParts = webResults

  // Look for installation instructions
  const installationMatch = aiResponse.match(/(?:installation|install|replace|procedure)[\s\S]*?(?=\n\n|$)/i)
  if (installationMatch) {
    installation = installationMatch[0]
  }

  // Look for tips or warnings
  const tipsMatch = aiResponse.match(/(?:tip|warning|safety|important|note)[\s\S]*?(?=\n\n|$)/i)
  if (tipsMatch) {
    tips = tipsMatch[0]
  }

  return {
    message: aiResponse,
    parts: recommendedParts,
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

    // Step 2: Search web for current parts/pricing
    const webResults = await searchWebForParts(message)

    let response: {
      message: string
      parts: any[]
      webResults?: SearchResult[]
      installation: string | null
      tips: string | null
    }

    // Step 3: Get enhanced AI response with all data
    if (process.env.OPENAI_API_KEY) {
      const aiResponse = await getEnhancedAIResponse(message, foundParts, webResults)
      
      if (aiResponse) {
        const structuredResponse = await parseAIResponseStructure(aiResponse, webResults)
        
        response = {
          ...structuredResponse,
          webResults, // Include web results separately for UI
          parts: foundParts // Keep database parts separate
        }
      } else {
        // Fallback if AI fails
        response = getFallbackResponse(message, foundParts, webResults)
      }
    } else {
      // No OpenAI API key, use enhanced fallback with web results
      response = getFallbackResponse(message, foundParts, webResults)
    }

    return NextResponse.json({
      response: response.message,
      parts: response.parts || [],
      webResults: response.webResults || [],
      installation: response.installation,
      tips: response.tips,
      timestamp: new Date().toISOString(),
      aiPowered: !!process.env.OPENAI_API_KEY,
      webSearchEnabled: true,
      sources: {
        database: foundParts.length,
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

function getFallbackResponse(message: string, foundParts: any[], webResults: SearchResult[] = []) {
  const lowerMessage = message.toLowerCase()
  
  if (foundParts.length > 0 || webResults.length > 0) {
    let responseMessage = `I found information for your query:`
    
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
      webResults,
      installation: "Please refer to your vehicle's service manual for specific installation procedures.",
      tips: "Always use quality parts and follow proper torque specifications for safety."
    }
  }
  
  // Check for key phrases in mock responses
  if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
    return {
      message: "I found some cam chain tensioner options. Let me search for current pricing and availability:",
      ...mockResponses['cam chain tensioner'],
      webResults
    }
  }
  
  return {
    message: "I'd be happy to help you find the right parts! Could you provide more details about your vehicle (make, model, year) and the specific part you're looking for? I can search our database and current online listings for the best options.",
    parts: [],
    webResults,
    installation: null,
    tips: null
  }
} 