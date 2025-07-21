import mongoose, { Document, Schema } from 'mongoose'

export interface IListing extends Document {
  _id: string
  title: string
  description: string
  seller: mongoose.Types.ObjectId
  partId?: mongoose.Types.ObjectId
  category: string
  condition: 'new' | 'used' | 'refurbished'
  price: number
  currency: string
  images: string[]
  externalUrl?: string
  vehicleCompatibility: {
    make: string
    model: string
    yearFrom: number
    yearTo: number
  }[]
  location: {
    city: string
    state: string
    country: string
  }
  isActive: boolean
  views: number
  contactCount: number
  createdAt: Date
  updatedAt: Date
}

const ListingSchema = new Schema<IListing>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  seller: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  partId: {
    type: Schema.Types.ObjectId,
    ref: 'Part'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  condition: {
    type: String,
    enum: ['new', 'used', 'refurbished'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  images: [String],
  externalUrl: String,
  vehicleCompatibility: [{
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    yearFrom: {
      type: Number,
      required: true
    },
    yearTo: {
      type: Number,
      required: true
    }
  }],
  location: {
    city: String,
    state: String,
    country: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Indexes for performance
ListingSchema.index({ seller: 1, isActive: 1 })
ListingSchema.index({ category: 1, isActive: 1 })
ListingSchema.index({ price: 1 })
ListingSchema.index({ 'vehicleCompatibility.make': 1, 'vehicleCompatibility.model': 1 })
ListingSchema.index({ createdAt: -1 })
ListingSchema.index({ title: 'text', description: 'text' })

export default mongoose.models.Listing || mongoose.model<IListing>('Listing', ListingSchema) 