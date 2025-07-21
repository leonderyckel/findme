import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Part from '@/models/Part'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    // Sample parts data
    const sampleParts = [
      {
        name: 'Cam Chain Tensioner Assembly',
        description: 'OEM replacement cam chain tensioner for Honda CB750. Maintains proper chain tension and timing.',
        partNumber: 'CCT-001-HONDA',
        category: 'Engine',
        subcategory: 'Timing Components',
        compatibleVehicles: [
          { make: 'Honda', model: 'CB750', year: [1979, 1980, 1981, 1982] },
          { make: 'Honda', model: 'CB750F', year: [1979, 1980, 1981] }
        ],
        specifications: {
          material: 'Steel',
          finish: 'Zinc plated',
          weight: '0.5 lbs'
        },
        images: ['https://example.com/cct-image.jpg'],
        installationGuide: 'Remove fuel tank and side covers. Locate tensioner on front of cylinder head. Remove old tensioner assembly. Install new tensioner with proper torque specifications. Check chain tension.',
        externalLinks: [
          { supplier: 'BikeBandit', url: 'https://example.com/part1', price: 89.99 },
          { supplier: 'Rocky Mountain ATV', url: 'https://example.com/part2', price: 95.50 }
        ],
        tags: ['cam chain', 'tensioner', 'timing', 'honda', 'cb750', 'engine']
      },
      {
        name: 'Front Brake Pads Set',
        description: 'High-performance ceramic brake pads for improved stopping power and reduced brake dust.',
        partNumber: 'BP-F001-CERAMIC',
        category: 'Brakes',
        subcategory: 'Brake Pads',
        compatibleVehicles: [
          { make: 'Honda', model: 'CB750', year: [1975, 1976, 1977, 1978, 1979, 1980, 1981] },
          { make: 'Honda', model: 'CB550', year: [1974, 1975, 1976, 1977] }
        ],
        specifications: {
          material: 'Ceramic',
          friction_coefficient: '0.45',
          temperature_range: '0-600°C'
        },
        images: ['https://example.com/brake-pads.jpg'],
        installationGuide: '1. Remove wheel 2. Remove brake caliper 3. Remove old pads 4. Clean caliper and rotor 5. Install new pads 6. Reassemble and test',
        externalLinks: [
          { supplier: 'EBC Brakes', url: 'https://example.com/brakes1', price: 45.99 },
          { supplier: 'Vesrah', url: 'https://example.com/brakes2', price: 52.00 }
        ],
        tags: ['brake pads', 'ceramic', 'front', 'honda', 'cb750', 'safety']
      },
      {
        name: 'Oil Filter',
        description: 'Premium oil filter for Honda motorcycles. Removes contaminants and protects engine components.',
        partNumber: 'OF-HONDA-001',
        category: 'Engine',
        subcategory: 'Filtration',
        compatibleVehicles: [
          { make: 'Honda', model: 'CB750', year: [1979, 1980, 1981, 1982, 1983] },
          { make: 'Honda', model: 'CB900', year: [1980, 1981, 1982] },
          { make: 'Honda', model: 'CB1100', year: [1983] }
        ],
        specifications: {
          filter_media: 'Paper',
          micron_rating: '10',
          bypass_valve: 'Yes'
        },
        images: ['https://example.com/oil-filter.jpg'],
        installationGuide: 'Warm engine slightly. Drain oil. Remove old filter with filter wrench. Apply thin layer of oil to new filter gasket. Install new filter hand-tight plus 3/4 turn. Refill with fresh oil.',
        externalLinks: [
          { supplier: 'K&N Filters', url: 'https://example.com/kn-filter', price: 12.99 },
          { supplier: 'Purolator', url: 'https://example.com/purolator', price: 8.99 }
        ],
        tags: ['oil filter', 'engine', 'maintenance', 'honda', 'filtration']
      },
      {
        name: 'Spark Plugs Set (4)',
        description: 'Iridium spark plugs for improved ignition and fuel efficiency. Set of 4 for inline-4 engines.',
        partNumber: 'SP-IR-4SET',
        category: 'Engine',
        subcategory: 'Ignition',
        compatibleVehicles: [
          { make: 'Honda', model: 'CB750', year: [1979, 1980, 1981, 1982] },
          { make: 'Suzuki', model: 'GS750', year: [1977, 1978, 1979] },
          { make: 'Kawasaki', model: 'Z750', year: [1976, 1977, 1978] }
        ],
        specifications: {
          electrode: 'Iridium',
          gap: '0.028-0.031 inches',
          heat_range: '7'
        },
        images: ['https://example.com/spark-plugs.jpg'],
        installationGuide: 'Remove fuel tank for access. Remove plug caps. Use spark plug socket to remove old plugs. Check gap on new plugs. Install new plugs with proper torque (18-22 ft-lbs). Reconnect plug caps.',
        externalLinks: [
          { supplier: 'NGK', url: 'https://example.com/ngk-plugs', price: 35.99 },
          { supplier: 'Denso', url: 'https://example.com/denso-plugs', price: 32.99 }
        ],
        tags: ['spark plugs', 'iridium', 'ignition', 'performance', '4-cylinder']
      },
      {
        name: 'Drive Chain 520 O-Ring',
        description: 'Heavy-duty O-ring drive chain for sport and standard motorcycles. 120 links.',
        partNumber: 'CHAIN-520-OR-120',
        category: 'Drivetrain',
        subcategory: 'Chain & Sprockets',
        compatibleVehicles: [
          { make: 'Honda', model: 'CB750', year: [1979, 1980, 1981, 1982] },
          { make: 'Yamaha', model: 'XJ750', year: [1981, 1982, 1983] },
          { make: 'Suzuki', model: 'GS750', year: [1977, 1978, 1979, 1980] }
        ],
        specifications: {
          pitch: '520',
          links: '120',
          tensile_strength: '8800 lbs',
          seal_type: 'O-ring'
        },
        images: ['https://example.com/drive-chain.jpg'],
        installationGuide: 'Put bike on center stand. Remove rear wheel. Remove old chain. Install new chain ensuring proper direction. Set proper tension (1.5-2 inches slack). Lubricate chain.',
        externalLinks: [
          { supplier: 'DID Chain', url: 'https://example.com/did-chain', price: 89.99 },
          { supplier: 'RK Chain', url: 'https://example.com/rk-chain', price: 92.50 }
        ],
        tags: ['drive chain', 'o-ring', '520', 'drivetrain', 'maintenance']
      }
    ]

    // Clear existing sample parts
    await Part.deleteMany({ partNumber: { $in: sampleParts.map(p => p.partNumber) } })

    // Insert new sample parts
    const result = await Part.insertMany(sampleParts)

    return NextResponse.json({
      message: `Successfully seeded ${result.length} parts`,
      parts: result.map(p => ({ name: p.name, partNumber: p.partNumber }))
    })

  } catch (error) {
    console.error('Seed parts error:', error)
    return NextResponse.json(
      { error: 'Failed to seed parts database' },
      { status: 500 }
    )
  }
} 