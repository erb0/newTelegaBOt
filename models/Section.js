const mongoose = require('mongoose')

const sectionSchema = new mongoose.Schema({
  GRCODE: Number,
  FSBDVCODE: {
    type: Number,
    unique: true,
    required: true
  },
  SBDVCODE: Number,      // код сельского округа
  SECTCODE: String,
  SECTNAME: String,      // название с/о
  CHIEFNAME: String,     // имя контролера

  is_active: {
    type: Boolean,
    default: true
  },

  updated_at: { type: Date, default: Date.now }
}, {
  collection: 'sections'
})

// Индексы для быстрого поиска
sectionSchema.index({ FSBDVCODE: 1 })
sectionSchema.index({ SBDVCODE: 1 })
sectionSchema.index({ SECTNAME: 'text', CHIEFNAME: 'text' })

const Section = mongoose.model('Section', sectionSchema)

module.exports = { Section }
