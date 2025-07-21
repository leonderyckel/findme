import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Part from '@/models/Part'
import { getUserFromRequest } from '@/lib/auth'
import OpenAI from 'openai'

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

async function getAIResponse(userMessage: string, foundParts: any[] = []) {
  const systemPrompt = `You are an expert vehicle parts assistant. Your role is to help users find the right parts for their vehicles and provide installation guidance.

Guidelines:
- Be helpful and knowledgeable about automotive and motorcycle parts
- Provide specific part recommendations when possible
- Include installation tips and safety warnings
- Suggest where to buy parts (online retailers, local shops)
- If you don't know something specific, be honest about it
- Always prioritize safety in your recommendations

The user's database contains these relevant parts: ${JSON.stringify(foundParts)}

Format your response to include:
1. A helpful answer to their question
2. Specific part recommendations if relevant
3. Basic installation guidance if requested
4. Safety tips and considerations
5. Suggested suppliers or where to find parts

Keep responses concise but informative.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 800,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response at the moment."
  } catch (error) {
    console.error('OpenAI API error:', error)
    return null
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

    // Search for relevant parts in database
    const foundParts = await searchPartsInDatabase(message)

    let response: {
      message: string
      parts: any[]
      installation: string | null
      tips: string | null
    }

    // Try OpenAI API first
    if (process.env.OPENAI_API_KEY) {
      const aiResponse = await getAIResponse(message, foundParts)
      
      if (aiResponse) {
        // Parse AI response to extract structured information
        let installation = null
        let tips = null
        
        // Look for installation instructions in the response
        if (aiResponse.toLowerCase().includes('install') || aiResponse.toLowerCase().includes('replace')) {
          const installMatch = aiResponse.match(/(?:installation|install|replace)[\s\S]*?(?=\n\n|\.|$)/i)
          if (installMatch) {
            installation = installMatch[0]
          }
        }
        
        // Look for tips or warnings
        if (aiResponse.toLowerCase().includes('tip') || aiResponse.toLowerCase().includes('warning') || aiResponse.toLowerCase().includes('safety')) {
          const tipMatch = aiResponse.match(/(?:tip|warning|safety|important)[\s\S]*?(?=\n\n|\.|$)/i)
          if (tipMatch) {
            tips = tipMatch[0]
          }
        }

        response = {
          message: aiResponse,
          parts: foundParts,
          installation,
          tips
        }
      } else {
        // Fallback to mock response if OpenAI fails
        response = getFallbackResponse(message, foundParts)
      }
    } else {
      // No OpenAI API key, use fallback
      response = getFallbackResponse(message, foundParts)
    }

    return NextResponse.json({
      response: response.message,
      parts: response.parts || [],
      installation: response.installation,
      tips: response.tips,
      timestamp: new Date().toISOString(),
      aiPowered: !!process.env.OPENAI_API_KEY
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getFallbackResponse(message: string, foundParts: any[]) {
  const lowerMessage = message.toLowerCase()
  
  if (foundParts.length > 0) {
    return {
      message: `I found ${foundParts.length} relevant parts in our database for your query. Here are the details:`,
      parts: foundParts,
      installation: "Please refer to your vehicle's service manual for specific installation procedures.",
      tips: "Always use quality parts and follow proper torque specifications for safety."
    }
  }
  
  // Check for key phrases in mock responses
  if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
    return {
      message: "I found some cam chain tensioner options for your bike. Here are the compatible parts and installation guidance:",
      ...mockResponses['cam chain tensioner']
    }
  }
  
  return {
    message: "I'd be happy to help you find the right parts! Could you provide more details about your vehicle (make, model, year) and the specific part you're looking for?",
    parts: [],
    installation: null,
    tips: null
  }
} 