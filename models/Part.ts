import mongoose, { Document, Schema } from 'mongoose'

export interface IPart extends Document {
  _id: string
  name: string
  description: string
  partNumber: string
  category: string
  subcategory: string
  compatibleVehicles: {
    make: string
    model: string
    year: number[]
    engine?: string
  }[]
  specifications: {
    [key: string]: string
  }
  images: string[]
  installationGuide?: string
  externalLinks: {
    supplier: string
    url: string
    price?: number
  }[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

const PartSchema = new Schema<IPart>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  partNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  subcategory: {
    type: String,
    required: true,
    trim: true
  },
  compatibleVehicles: [{
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    year: [{
      type: Number,
      required: true
    }],
    engine: String
  }],
  specifications: {
    type: Map,
    of: String
  },
  images: [String],
  installationGuide: String,
  externalLinks: [{
    supplier: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    price: Number
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
})

// Indexes for performance and search
PartSchema.index({ partNumber: 1 })
PartSchema.index({ category: 1, subcategory: 1 })
PartSchema.index({ 'compatibleVehicles.make': 1, 'compatibleVehicles.model': 1 })
PartSchema.index({ tags: 1 })
PartSchema.index({ name: 'text', description: 'text' })

export default mongoose.models.Part || mongoose.model<IPart>('Part', PartSchema) 