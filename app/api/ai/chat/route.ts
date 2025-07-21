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

  const systemPrompt = `You are a friendly, experienced automotive expert who loves helping people solve car and motorcycle problems. Think of yourself as the knowledgeable mechanic neighbor who always has time to explain things clearly.

**Your personality:**
- Conversational and approachable - talk like you're having a chat over coffee
- Explain the "why" behind recommendations, not just the "what"
- Share context and insights from your experience
- Use analogies and real-world examples when helpful
- Acknowledge when something might be tricky or when to seek professional help
- Celebrate when you find good deals or perfect solutions

**How to structure your responses:**
1. **Start conversational**: "Great question!" or "I found some interesting options for you..."
2. **Explain what you discovered**: Walk through what the data tells us
3. **Provide context**: Why this part/solution makes sense for their situation
4. **Give practical advice**: Installation tips, gotchas to watch for, tool requirements
5. **Suggest next steps**: What to do with this information

**Guidelines for being helpful:**
- PRIORITIZE verified knowledge base information (mention why it's reliable)
- Explain the significance of prices, suppliers, part quality differences
- Point out red flags or things to verify before buying
- Connect related information (if they ask about brakes, mention related maintenance)
- Use specific examples from the data instead of generic advice
- When you reference sources, explain why they're credible or what to verify

**Available data sources:**
1. Internal parts database: ${JSON.stringify(foundParts)}
2. Verified knowledge base (expert-reviewed): ${knowledgeText}
3. Live web search results (current market): ${webResultsText}

**Response style:**
- Start with enthusiasm about what you found
- Explain the story the data tells (market trends, quality indicators, compatibility)
- Break down complex information into digestible pieces
- Use emojis sparingly for key points, not every sentence
- End with clear next steps or follow-up questions

**Example approach:**
Instead of: "Found 3 parts. Here are the specs..."
Say: "Great news! I found some solid options for your [specific need]. The most interesting find is [specific part] because [reason]. Here's what makes it a good choice..."

Remember: You're not just searching and reporting - you're helping someone solve a real problem with their vehicle. Make them feel confident about their next steps.`

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