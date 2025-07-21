import axios from 'axios'
import * as cheerio from 'cheerio'

export interface SearchResult {
  title: string
  url: string
  description: string
  price?: string
  supplier?: string
  partNumber?: string
  compatibility?: string
  imageUrl?: string
  source: 'brave' | 'ebay' | 'amazon' | 'rockauto' | 'scraped'
}

export interface WebSearchOptions {
  maxResults?: number
  includePrice?: boolean
  vehicleInfo?: {
    make?: string
    model?: string
    year?: string
  }
}

class WebSearchService {
  private braveApiKey: string

  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY || ''
  }

  async searchParts(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const maxResults = options.maxResults || 10

    try {
      // 1. Brave Search API for general web search
      if (this.braveApiKey) {
        const braveResults = await this.searchWithBrave(query, options)
        results.push(...braveResults)
      }

      // 2. Targeted scrapers for popular parts sites
      const scrapedResults = await Promise.allSettled([
        this.searchEbayMotors(query, options),
        this.searchAmazonAutomotive(query, options),
        this.searchRockAuto(query, options)
      ])

      scrapedResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value)
        }
      })

      // 3. Sort by relevance and return top results
      return this.rankResults(results, query).slice(0, maxResults)

    } catch (error) {
      console.error('Web search error:', error)
      return []
    }
  }

  private async searchWithBrave(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQuery(query, options)
      
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json'
        },
        params: {
          q: enhancedQuery,
          count: 10,
          search_lang: 'en',
          country: 'US',
          safesearch: 'moderate'
        }
      })

      return response.data.web?.results?.map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description,
        source: 'brave' as const,
        supplier: this.extractSupplier(result.url)
      })) || []

    } catch (error) {
      console.error('Brave Search error:', error)
      return []
    }
  }

  private async searchEbayMotors(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query + ' automotive parts')}&_sacat=6028`
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 5000
      })

      const $ = cheerio.load(response.data)
      const results: SearchResult[] = []

      $('.s-item').slice(0, 5).each((i, element) => {
        const title = $(element).find('.s-item__title').text().trim()
        const url = $(element).find('.s-item__link').attr('href')
        const price = $(element).find('.s-item__price').text().trim()
        const imageUrl = $(element).find('.s-item__image img').attr('src')

        if (title && url && !title.toLowerCase().includes('shop on ebay')) {
          results.push({
            title,
            url,
            description: `eBay listing: ${title}`,
            price: price || undefined,
            supplier: 'eBay Motors',
            imageUrl,
            source: 'ebay'
          })
        }
      })

      return results
    } catch (error) {
      console.error('eBay scraping error:', error)
      return []
    }
  }

  private async searchAmazonAutomotive(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query + ' automotive')}&rh=n%3A15684181`
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 5000
      })

      const $ = cheerio.load(response.data)
      const results: SearchResult[] = []

      $('[data-component-type="s-search-result"]').slice(0, 5).each((i, element) => {
        const title = $(element).find('h2 a span').text().trim()
        const url = 'https://amazon.com' + $(element).find('h2 a').attr('href')
        const price = $(element).find('.a-price-whole').first().text().trim()
        const imageUrl = $(element).find('.s-image').attr('src')

        if (title && url) {
          results.push({
            title,
            url,
            description: `Amazon listing: ${title}`,
            price: price ? `$${price}` : undefined,
            supplier: 'Amazon Automotive',
            imageUrl,
            source: 'amazon'
          })
        }
      })

      return results
    } catch (error) {
      console.error('Amazon scraping error:', error)
      return []
    }
  }

  private async searchRockAuto(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      // RockAuto has anti-bot protection, so we'll do a simpler approach
      const searchTerms = query.split(' ').slice(0, 3).join(' ')
      const searchUrl = `https://www.rockauto.com/en/catalog/universal,${encodeURIComponent(searchTerms)}`
      
      // For now, return a structured search result pointing to RockAuto
      return [{
        title: `${query} - RockAuto Parts Catalog`,
        url: searchUrl,
        description: `Search for ${query} on RockAuto's comprehensive parts catalog`,
        supplier: 'RockAuto',
        source: 'rockauto'
      }]
    } catch (error) {
      console.error('RockAuto search error:', error)
      return []
    }
  }

  private enhanceQuery(query: string, options: WebSearchOptions): string {
    let enhancedQuery = query

    // Add vehicle-specific terms
    if (options.vehicleInfo) {
      const { make, model, year } = options.vehicleInfo
      if (make) enhancedQuery += ` ${make}`
      if (model) enhancedQuery += ` ${model}`
      if (year) enhancedQuery += ` ${year}`
    }

    // Add context for better results
    enhancedQuery += ' automotive parts buy online'

    // Add price context if needed
    if (options.includePrice) {
      enhancedQuery += ' price cost purchase'
    }

    return enhancedQuery
  }

  private extractSupplier(url: string): string {
    const domain = new URL(url).hostname.toLowerCase()
    
    if (domain.includes('ebay')) return 'eBay'
    if (domain.includes('amazon')) return 'Amazon'
    if (domain.includes('rockauto')) return 'RockAuto'
    if (domain.includes('autozone')) return 'AutoZone'
    if (domain.includes('advanceauto')) return 'Advance Auto Parts'
    if (domain.includes('oreillyauto')) return "O'Reilly Auto Parts"
    if (domain.includes('napaonline')) return 'NAPA Auto Parts'
    if (domain.includes('carparts')) return 'CarParts.com'
    if (domain.includes('partsgeek')) return 'PartsGeek'
    if (domain.includes('1aauto')) return '1A Auto'
    
    return domain.replace('www.', '').split('.')[0]
  }

  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    const queryTerms = query.toLowerCase().split(' ')
    
    return results.sort((a, b) => {
      let scoreA = 0
      let scoreB = 0

      // Title relevance
      queryTerms.forEach(term => {
        if (a.title.toLowerCase().includes(term)) scoreA += 3
        if (b.title.toLowerCase().includes(term)) scoreB += 3
        if (a.description.toLowerCase().includes(term)) scoreA += 1
        if (b.description.toLowerCase().includes(term)) scoreB += 1
      })

      // Boost known automotive suppliers
      const trustedSuppliers = ['rockauto', 'autozone', 'advanceauto', 'oreillyauto', 'napaonline']
      if (trustedSuppliers.some(supplier => a.url.includes(supplier))) scoreA += 2
      if (trustedSuppliers.some(supplier => b.url.includes(supplier))) scoreB += 2

      // Boost results with prices
      if (a.price) scoreA += 1
      if (b.price) scoreB += 1

      return scoreB - scoreA
    })
  }

  // Extract vehicle info from query for better targeting
  extractVehicleInfo(query: string): WebSearchOptions['vehicleInfo'] {
    const lowerQuery = query.toLowerCase()
    
    // Common makes
    const makes = ['honda', 'toyota', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'subaru', 'mazda', 'hyundai', 'kia', 'jeep', 'dodge', 'ram', 'gmc', 'cadillac', 'lexus', 'infiniti', 'acura', 'volvo', 'jaguar', 'land rover', 'porsche', 'ferrari', 'lamborghini', 'maserati', 'tesla', 'mini', 'fiat', 'alfa romeo', 'mitsubishi', 'suzuki', 'yamaha', 'kawasaki', 'harley', 'ducati']
    
    // Extract year (4 digits between 1950-2030)
    const yearMatch = lowerQuery.match(/\b(19[5-9]\d|20[0-2]\d|203[0])\b/)
    const year = yearMatch ? yearMatch[1] : undefined

    // Extract make
    const make = makes.find(m => lowerQuery.includes(m))

    // Extract model (this is trickier, would need a comprehensive database)
    // For now, we'll try to detect common patterns
    let model = undefined
    if (make) {
      const makeIndex = lowerQuery.indexOf(make)
      const afterMake = lowerQuery.substring(makeIndex + make.length).trim()
      const modelMatch = afterMake.match(/^(\w+(?:\s+\w+)?)/)?.[1]
      if (modelMatch && !['parts', 'part', 'automotive', 'car', 'truck'].includes(modelMatch)) {
        model = modelMatch
      }
    }

    return year || make || model ? { year, make, model } : undefined
  }
}

export const webSearchService = new WebSearchService() 