const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'UPDATE_ROLE',
      'ADD_SECTION',
      'REMOVE_SECTION',
      'TOGGLE_INSERT_READINGS',
      'BLOCK_USER',
      'UNBLOCK_USER',
      'DELETE_USER',
      'CREATE_USER',
      'LOGIN'
    ]
  },
  details: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  collection: 'audit_logs'
})

// Индексы для поиска
auditLogSchema.index({ user_id: 1, timestamp: -1 })
auditLogSchema.index({ action: 1, timestamp: -1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

module.exports = { AuditLog }
