const mongoose = require('mongoose')

// Роли
const ROLES = {
  ADMIN: 'admin',
  REVISOR: 'revisor',
  CHIEF: 'chief',           // начальник участка
  CONTROLLER: 'controller'   // контролер
}

// Права
const PERMISSIONS = {
  VIEW_ALL: 'view_all',
  VIEW_OWN_SECTION: 'view_own_section',
  VIEW_OWN_DISTRICT: 'view_own_district',
  INSERT_READINGS: 'insert_readings',
  MANAGE_USERS: 'manage_users',
  GENERATE_REPORTS: 'generate_reports',
  EXPORT_DATA: 'export_data'
}

const userSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  username: String,
  first_name: String,
  last_name: String,
  language_code: String,

  // === АВТОРИЗАЦИЯ ===
  role: {
    type: String,
    enum: Object.values(ROLES),
    required: true,
    default: ROLES.CONTROLLER
  },

  // Массив кодов участков (FSBDVCODE)
  sections: [{
    type: Number
  }],

  // Код сельского округа (для начальника участка)
  district_code: {
    type: Number,  // SBDVCODE
    default: null
  },

  // === ПРАВА ===
  permissions: [{
    type: String,
    enum: Object.values(PERMISSIONS)
  }],

  // Может ли вносить показания
  can_insert_readings: {
    type: Boolean,
    default: true
  },

  // Статус
  is_active: {
    type: Boolean,
    default: true
  },
  is_blocked: {
    type: Boolean,
    default: false
  },

  // === СОСТОЯНИЕ БОТА ===
  state: String,
  data: Object,

  // === МЕТАДАННЫЕ ===
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  created_by: { type: Number }, // кто создал
  last_login: Date
})

// Middleware для обновления updated_at
userSchema.pre('save', function(next) {
  this.updated_at = new Date()
  next()
})

// === МЕТОДЫ ===

// Проверка права
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission)
}

// Проверка доступа к участку
userSchema.methods.canAccessSection = function(sectionCode) {
  if (this.role === ROLES.ADMIN || this.role === ROLES.REVISOR) {
    return true
  }
  return this.sections.includes(sectionCode)
}

// Получить список доступных участков
userSchema.methods.getAccessibleSections = async function() {
  if (this.role === ROLES.ADMIN || this.role === ROLES.REVISOR) {
    // Доступ ко всем участкам
    return null // null = все участки
  }

  if (this.role === ROLES.CHIEF && this.district_code) {
    // Получить все участки сельского округа
    const Section = mongoose.model('Section')
    const sections = await Section.find({
      SBDVCODE: this.district_code
    }).distinct('FSBDVCODE')
    return sections
  }

  // Контролер - только свои участки
  return this.sections
}

// Права по ролям
userSchema.statics.getDefaultPermissions = function(role) {
  const permissionMap = {
    [ROLES.ADMIN]: [
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.INSERT_READINGS,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.GENERATE_REPORTS,
      PERMISSIONS.EXPORT_DATA
    ],
    [ROLES.REVISOR]: [
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.GENERATE_REPORTS,
      PERMISSIONS.EXPORT_DATA
    ],
    [ROLES.CHIEF]: [
      PERMISSIONS.VIEW_OWN_DISTRICT,
      PERMISSIONS.INSERT_READINGS,
      PERMISSIONS.GENERATE_REPORTS
    ],
    [ROLES.CONTROLLER]: [
      PERMISSIONS.VIEW_OWN_SECTION,
      PERMISSIONS.INSERT_READINGS
    ]
  }
  return permissionMap[role] || []
}

const User = mongoose.model('User', userSchema)

module.exports = {
  User,
  ROLES,
  PERMISSIONS
}
