import mongoose from 'mongoose'

const KnowledgeSchema = new mongoose.Schema({
  // Content Information
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Categorization
  category: {
    type: String,
    required: true,
    enum: [
      'installation_guide',
      'troubleshooting', 
      'part_specification',
      'vehicle_compatibility',
      'maintenance_tip',
      'safety_warning',
      'supplier_info',
      'pricing_info',
      'general_automotive',
      'other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Vehicle/Part Context
  applicableVehicles: [{
    make: String,
    model: String,
    year: [Number],
    engine: String
  }],
  applicableParts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Part'
  }],
  partNumbers: [String],
  
  // Source Information
  sources: [{
    type: {
      type: String,
      enum: ['user_input', 'web_scrape', 'manual_entry', 'api_response', 'verified_link'],
      required: true
    },
    url: String,
    title: String,
    reliability_score: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    },
    verified: {
      type: Boolean,
      default: false
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verified_at: Date,
    notes: String
  }],
  
  // Learning Data
  usefulness_score: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  usage_count: {
    type: Number,
    default: 0
  },
  feedback: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: String,
    helpful: Boolean,
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Search Optimization
  search_keywords: [String],
  related_queries: [String],
  
  // Status and Management
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'rejected', 'archived'],
    default: 'pending_review'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: Date,
  
  // Auto-generated fields
  auto_generated: {
    type: Boolean,
    default: false
  },
  confidence_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  
  // Metadata
  language: {
    type: String,
    default: 'en'
  },
  version: {
    type: Number,
    default: 1
  },
  previous_versions: [{
    content: String,
    updated_at: Date,
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
})

// Indexes for search performance
KnowledgeSchema.index({ title: 'text', content: 'text', summary: 'text', search_keywords: 'text' })
KnowledgeSchema.index({ category: 1, subcategory: 1 })
KnowledgeSchema.index({ status: 1 })
KnowledgeSchema.index({ usefulness_score: -1 })
KnowledgeSchema.index({ usage_count: -1 })
KnowledgeSchema.index({ 'applicableVehicles.make': 1, 'applicableVehicles.model': 1 })
KnowledgeSchema.index({ tags: 1 })

// Methods
KnowledgeSchema.methods.incrementUsage = function() {
  this.usage_count += 1
  return this.save()
}

KnowledgeSchema.methods.addFeedback = function(user: any, rating: number, comment?: string, helpful?: boolean) {
  this.feedback.push({
    user: user._id,
    rating,
    comment,
    helpful,
    created_at: new Date()
  })
  
  // Recalculate usefulness score
  const totalRatings = this.feedback.length
  const sumRatings = this.feedback.reduce((sum: number, fb: any) => sum + fb.rating, 0)
  this.usefulness_score = Math.round((sumRatings / totalRatings) * 2) // Convert 1-5 to 1-10 scale
  
  return this.save()
}

KnowledgeSchema.methods.addSource = function(sourceData: any) {
  this.sources.push(sourceData)
  return this.save()
}

// Static methods for search
KnowledgeSchema.statics.searchByQuery = function(query: string, options: any = {}) {
  const searchOptions: any = {
    $text: { $search: query },
    status: 'approved'
  }
  
  if (options.category) {
    searchOptions.category = options.category
  }
  
  if (options.vehicleMake) {
    searchOptions['applicableVehicles.make'] = new RegExp(options.vehicleMake, 'i')
  }
  
  return this.find(searchOptions)
    .sort({ 
      score: { $meta: 'textScore' },
      usefulness_score: -1,
      usage_count: -1 
    })
    .limit(options.limit || 10)
}

KnowledgeSchema.statics.findByVehicle = function(make: string, model?: string, year?: number) {
  const query: any = {
    status: 'approved',
    $or: [
      { 'applicableVehicles.make': new RegExp(make, 'i') },
      { tags: new RegExp(make, 'i') }
    ]
  }
  
  if (model) {
    query.$or.push({ 'applicableVehicles.model': new RegExp(model, 'i') })
    query.$or.push({ tags: new RegExp(model, 'i') })
  }
  
  if (year) {
    query['applicableVehicles.year'] = year
  }
  
  return this.find(query)
    .sort({ usefulness_score: -1, usage_count: -1 })
    .limit(20)
}

const Knowledge = mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema)

export default Knowledge 