const { User, ROLES, PERMISSIONS } = require('../models/User')
const { Section } = require('../models/Section')
const { AuditLog } = require('../models/AuditLog')

class UserService {
  // Создать пользователя
  async createUser(data, createdBy) {
    const {
      user_id,
      first_name,
      username,
      role,
      sections = [],
      district_code = null,
      can_insert_readings = true
    } = data

    // Проверка существования
    const existing = await User.findOne({ user_id })
    if (existing) {
      throw new Error('Пользователь уже существует')
    }

    // Права по умолчанию для роли
    const permissions = User.getDefaultPermissions(role)

    const user = new User({
      user_id,
      first_name,
      username,
      role,
      sections,
      district_code,
      permissions,
      can_insert_readings,
      is_active: true,
      created_by: createdBy
    })

    await user.save()

    await this.logAction(createdBy, 'CREATE_USER', {
      target_user: user_id,
      role,
      sections
    })

    return user
  }

  // Обновить роль
  async updateRole(userId, newRole, updatedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    user.role = newRole
    user.permissions = User.getDefaultPermissions(newRole)
    await user.save()

    await this.logAction(updatedBy, 'UPDATE_ROLE', {
      target_user: userId,
      new_role: newRole
    })

    return user
  }

  // Добавить участок
  async addSection(userId, sectionCode, updatedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    // Проверка существования участка
    const section = await Section.findOne({ FSBDVCODE: sectionCode })
    if (!section) throw new Error('Участок не найден')

    if (!user.sections.includes(sectionCode)) {
      user.sections.push(sectionCode)
      await user.save()
    }

    await this.logAction(updatedBy, 'ADD_SECTION', {
      target_user: userId,
      section_code: sectionCode
    })

    return user
  }

  // Удалить участок
  async removeSection(userId, sectionCode, updatedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    user.sections = user.sections.filter(s => s !== sectionCode)
    await user.save()

    await this.logAction(updatedBy, 'REMOVE_SECTION', {
      target_user: userId,
      section_code: sectionCode
    })

    return user
  }

  // Изменить право внесения показаний
  async toggleInsertReadings(userId, canInsert, updatedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    user.can_insert_readings = canInsert
    await user.save()

    await this.logAction(updatedBy, 'TOGGLE_INSERT_READINGS', {
      target_user: userId,
      can_insert: canInsert
    })

    return user
  }

  // Заблокировать/разблокировать
  async toggleBlock(userId, isBlocked, updatedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    user.is_blocked = isBlocked
    await user.save()

    await this.logAction(updatedBy, isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER', {
      target_user: userId
    })

    return user
  }

  // Удалить пользователя (мягкое удаление)
  async deleteUser(userId, deletedBy) {
    const user = await User.findOne({ user_id: userId })
    if (!user) throw new Error('Пользователь не найден')

    user.is_active = false
    await user.save()

    await this.logAction(deletedBy, 'DELETE_USER', {
      target_user: userId
    })

    return user
  }

  // Получить список пользователей
  async listUsers(filters = {}) {
    const query = { is_active: true }

    if (filters.role) query.role = filters.role
    if (filters.section) query.sections = filters.section

    return await User.find(query)
      .select('-data -state')
      .sort({ created_at: -1 })
  }

  // Получить информацию о пользователе
  async getUser(userId) {
    return await User.findOne({ user_id: userId, is_active: true })
  }

  // Логирование действий
  async logAction(userId, action, details) {
    try {
      await AuditLog.create({
        user_id: userId,
        action,
        details,
        timestamp: new Date()
      })
    } catch (err) {
      console.error('Ошибка логирования:', err)
    }
  }

  // Получить историю действий пользователя
  async getUserHistory(userId, limit = 50) {
    return await AuditLog.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
  }

  // Получить все действия над конкретным пользователем
  async getUserAudit(targetUserId, limit = 50) {
    return await AuditLog.find({ 'details.target_user': targetUserId })
      .sort({ timestamp: -1 })
      .limit(limit)
  }
}

module.exports = new UserService()
