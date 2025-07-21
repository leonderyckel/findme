import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Part from '@/models/Part'
import { getUserFromRequest } from '@/lib/auth'

// Mock AI responses for now - can be replaced with OpenAI integration later
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
  },
  'brake pads': {
    parts: [
      {
        name: 'Front Brake Pads Set',
        partNumber: 'BP-F001',
        description: 'High-performance ceramic brake pads',
        compatibleVehicles: [{ make: 'Honda', model: 'CB750', year: [1975, 1976, 1977, 1978, 1979, 1980, 1981] }],
        externalLinks: [
          { supplier: 'EBC Brakes', url: 'https://example.com/brakes1', price: 45.99 },
          { supplier: 'Vesrah', url: 'https://example.com/brakes2', price: 52.00 }
        ]
      }
    ],
    installation: 'Brake pad replacement steps:\n\n1. Remove wheel\n2. Remove brake caliper\n3. Remove old pads\n4. Clean caliper and rotor\n5. Install new pads\n6. Reassemble and test',
    tips: 'Always replace pads in pairs and bed them in properly for optimal performance.'
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

    await connectToDatabase()

    // Simple keyword matching for mock responses
    const lowerMessage = message.toLowerCase()
    let response: {
      message: string
      parts: any[]
      installation: string | null
      tips: string | null
    } = {
      message: "I'd be happy to help you find the right parts! Could you provide more details about your vehicle (make, model, year) and the specific part you're looking for?",
      parts: [],
      installation: null,
      tips: null
    }

    // Check for key phrases
    if (lowerMessage.includes('cam chain tensioner') || lowerMessage.includes('cct')) {
      response = {
        message: "I found some cam chain tensioner options for your bike. Here are the compatible parts and installation guidance:",
        ...mockResponses['cam chain tensioner']
      }
    } else if (lowerMessage.includes('brake pad') || lowerMessage.includes('brakes')) {
      response = {
        message: "Here are some brake pad options for your motorcycle:",
        ...mockResponses['brake pads']
      }
    } else if (lowerMessage.includes('cb750') || lowerMessage.includes('honda')) {
      // Try to search actual database
      try {
        const parts = await Part.find({
          $or: [
            { 'compatibleVehicles.make': { $regex: 'honda', $options: 'i' } },
            { 'compatibleVehicles.model': { $regex: 'cb750', $options: 'i' } }
          ]
        }).limit(5).lean()

        if (parts.length > 0) {
          response = {
            message: `I found ${parts.length} parts for Honda CB750. Here are some options:`,
            parts: parts,
            installation: "Installation steps vary by part. Please refer to your service manual for specific procedures.",
            tips: "Always use quality parts and follow proper torque specifications."
          }
        }
      } catch (dbError) {
        console.error('Database search error:', dbError)
        // Fall back to mock response
      }
    }

    return NextResponse.json({
      response: response.message,
      parts: response.parts || [],
      installation: response.installation,
      tips: response.tips,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 