const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')
const { Log, InsertLog, ErrorLog } = require('../modules/mongoDb')

/**
 * Централизованный сервис логирования
 * Управляет всеми типами логов в системе
 */
class LogService {
  constructor(telegramBot = null, adminChatId = null) {
    this.bot = telegramBot
    this.adminChatId = adminChatId || 498318670
  }

  /**
   * Логирование поисковых запросов пользователей
   * @param {Number} chatId - ID пользователя
   * @param {String} name - Имя пользователя
   * @param {String} type - Тип поиска (Лсчет, в/м, фио)
   * @param {String} data - Поисковый запрос
   * @param {Object} ctx - Контекст Telegraf (опционально)
   */
  async logSearch(chatId, name, type, data, ctx = null) {
    try {
      const logEntry = new Log({
        chatId,
        name,
        type,
        data,
      })
      await logEntry.save()

      console.log(`[SEARCH] ${name} [${type}] - ${data}`)

      // Отправка уведомления админу (опционально)
      if (this.bot && this.bot.telegram && ctx) {
        await this.bot.telegram.sendMessage(
          this.adminChatId,
          `${name} [${type}] - ${data}`
        )
      }

      return true
    } catch (error) {
      console.error('Ошибка при логировании поиска:', error)
      await this.logError(error, 'LogService.logSearch', chatId, name)
      return false
    }
  }

  /**
   * Логирование показаний абонентов
   * @param {Object} insertData - Данные о показаниях
   */
  async logInsert(insertData, ctx = null) {
    try {
      const {
        inspectorName,
        inspectorId,
        conscode,
        consname,
        streetName,
        house,
        WCODE,
        CURRCOUNT,
        LASTCOUNT,
      } = insertData

      const diff = LASTCOUNT - CURRCOUNT

      const logEntry = new InsertLog({
        inspectorName,
        inspectorId,
        conscode,
        consname,
        streetName,
        house,
        WCODE,
        CURRCOUNT,
        LASTCOUNT,
        diff,
      })

      await logEntry.save()

      const now = new Date()
      const formattedTime = `${now.getDate()}/${now.getMonth() + 1} ${now.getHours()}:${now.getMinutes()}`

      console.log(`[INSERT] ${inspectorName} - [${conscode}] ${formattedTime}`)

      // Уведомление админу если разница больше 100 м3
      if (diff >= 100 && this.bot && this.bot.telegram && ctx) {
        const message = `${inspectorName} поставил абоненту \n[${conscode}] ${consname} ${diff} м3`
        await this.bot.telegram.sendMessage(this.adminChatId, message)
      }

      return true
    } catch (error) {
      console.error('Ошибка при логировании показаний:', error)
      await this.logError(
        error,
        'LogService.logInsert',
        insertData.inspectorId,
        insertData.inspectorName,
        insertData
      )
      return false
    }
  }

  /**
   * Логирование ошибок
   * @param {Error} error - Объект ошибки
   * @param {String} context - Контекст (функция/модуль)
   * @param {Number} userId - ID пользователя (опционально)
   * @param {String} userName - Имя пользователя (опционально)
   * @param {Object} additionalData - Дополнительные данные (опционально)
   */
  async logError(error, context, userId = null, userName = null, additionalData = null) {
    try {
      const errorLog = new ErrorLog({
        errorMessage: error.message || String(error),
        errorStack: error.stack || '',
        context,
        userId,
        userName,
        additionalData,
      })

      await errorLog.save()

      console.error(`[ERROR] ${context}: ${error.message}`)

      return true
    } catch (err) {
      // Если не удалось залогировать ошибку, выводим в консоль
      console.error('КРИТИЧЕСКАЯ ОШИБКА: Не удалось залогировать ошибку:', err)
      console.error('Оригинальная ошибка:', error)
      return false
    }
  }

  /**
   * Экспорт логов поиска в Excel
   * @param {Object} filters - Фильтры (startDate, endDate, userId, type)
   * @returns {String} - Путь к файлу
   */
  async exportSearchLogs(filters = {}) {
    try {
      const query = this._buildSearchQuery(filters)
      const logs = await Log.find(query).sort({ timestamp: -1 }).lean()

      if (logs.length === 0) {
        throw new Error('Нет данных для экспорта')
      }

      const headers = ['Chat ID', 'Имя', 'Тип', 'Данные', 'Дата', 'Время']
      const rows = logs.map((log) => {
        const dateObj = new Date(log.timestamp)
        const date = dateObj.toLocaleDateString('ru-RU')
        const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
        return [log.chatId, log.name, log.type, log.data, date, time]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Logs')

      const exportPath = this._getExportPath('search_logs')
      XLSX.writeFile(workbook, exportPath)

      console.log('[EXPORT] Логи поиска экспортированы:', exportPath)
      return exportPath
    } catch (error) {
      await this.logError(error, 'LogService.exportSearchLogs', null, null, filters)
      throw error
    }
  }

  /**
   * Экспорт логов показаний в Excel
   * @param {Object} filters - Фильтры
   * @returns {String} - Путь к файлу
   */
  async exportInsertLogs(filters = {}) {
    try {
      const query = this._buildInsertQuery(filters)
      const logs = await InsertLog.find(query).sort({ timestamp: -1 }).lean()

      if (logs.length === 0) {
        throw new Error('Нет данных для экспорта')
      }

      const headers = [
        'Контролер',
        'Лсчет',
        'ФИО',
        'Улица',
        'Дом',
        'Код водомера',
        'Текущие показания',
        'Последние показания',
        'Разница',
        'Дата',
        'Время',
      ]

      const rows = logs.map((log) => {
        const dateObj = new Date(log.timestamp)
        const date = dateObj.toLocaleDateString('ru-RU')
        const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
        return [
          log.inspectorName,
          log.conscode,
          log.consname,
          log.streetName || '',
          log.house || '',
          log.WCODE || '',
          log.CURRCOUNT,
          log.LASTCOUNT,
          log.diff,
          date,
          time,
        ]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Insert Logs')

      const exportPath = this._getExportPath('insert_logs')
      XLSX.writeFile(workbook, exportPath)

      console.log('[EXPORT] Логи показаний экспортированы:', exportPath)
      return exportPath
    } catch (error) {
      await this.logError(error, 'LogService.exportInsertLogs', null, null, filters)
      throw error
    }
  }

  /**
   * Экспорт логов ошибок в Excel
   * @param {Object} filters - Фильтры
   * @returns {String} - Путь к файлу
   */
  async exportErrorLogs(filters = {}) {
    try {
      const query = this._buildErrorQuery(filters)
      const logs = await ErrorLog.find(query).sort({ timestamp: -1 }).lean()

      if (logs.length === 0) {
        throw new Error('Нет данных для экспорта')
      }

      const headers = [
        'Дата',
        'Время',
        'Контекст',
        'Сообщение об ошибке',
        'Пользователь ID',
        'Имя пользователя',
        'Стек ошибки',
      ]

      const rows = logs.map((log) => {
        const dateObj = new Date(log.timestamp)
        const date = dateObj.toLocaleDateString('ru-RU')
        const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
        return [
          date,
          time,
          log.context,
          log.errorMessage,
          log.userId || '',
          log.userName || '',
          log.errorStack || '',
        ]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Error Logs')

      const exportPath = this._getExportPath('error_logs')
      XLSX.writeFile(workbook, exportPath)

      console.log('[EXPORT] Логи ошибок экспортированы:', exportPath)
      return exportPath
    } catch (error) {
      await this.logError(error, 'LogService.exportErrorLogs', null, null, filters)
      throw error
    }
  }

  /**
   * Экспорт всех логов в один файл Excel (несколько листов)
   * @param {Object} filters - Фильтры
   * @returns {String} - Путь к файлу
   */
  async exportAllLogs(filters = {}) {
    try {
      const workbook = XLSX.utils.book_new()

      // Лист 1: Поисковые запросы
      const searchLogs = await Log.find(this._buildSearchQuery(filters))
        .sort({ timestamp: -1 })
        .lean()
      if (searchLogs.length > 0) {
        const searchHeaders = ['Chat ID', 'Имя', 'Тип', 'Данные', 'Дата', 'Время']
        const searchRows = searchLogs.map((log) => {
          const dateObj = new Date(log.timestamp)
          const date = dateObj.toLocaleDateString('ru-RU')
          const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
          return [log.chatId, log.name, log.type, log.data, date, time]
        })
        const searchSheet = XLSX.utils.aoa_to_sheet([searchHeaders, ...searchRows])
        XLSX.utils.book_append_sheet(workbook, searchSheet, 'Search Logs')
      }

      // Лист 2: Показания абонентов
      const insertLogs = await InsertLog.find(this._buildInsertQuery(filters))
        .sort({ timestamp: -1 })
        .lean()
      if (insertLogs.length > 0) {
        const insertHeaders = [
          'Контролер',
          'Лсчет',
          'ФИО',
          'Улица',
          'Дом',
          'Код водомера',
          'Текущие показания',
          'Последние показания',
          'Разница',
          'Дата',
          'Время',
        ]
        const insertRows = insertLogs.map((log) => {
          const dateObj = new Date(log.timestamp)
          const date = dateObj.toLocaleDateString('ru-RU')
          const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
          return [
            log.inspectorName,
            log.conscode,
            log.consname,
            log.streetName || '',
            log.house || '',
            log.WCODE || '',
            log.CURRCOUNT,
            log.LASTCOUNT,
            log.diff,
            date,
            time,
          ]
        })
        const insertSheet = XLSX.utils.aoa_to_sheet([insertHeaders, ...insertRows])
        XLSX.utils.book_append_sheet(workbook, insertSheet, 'Insert Logs')
      }

      // Лист 3: Ошибки
      const errorLogs = await ErrorLog.find(this._buildErrorQuery(filters))
        .sort({ timestamp: -1 })
        .lean()
      if (errorLogs.length > 0) {
        const errorHeaders = [
          'Дата',
          'Время',
          'Контекст',
          'Сообщение об ошибке',
          'Пользователь ID',
          'Имя пользователя',
        ]
        const errorRows = errorLogs.map((log) => {
          const dateObj = new Date(log.timestamp)
          const date = dateObj.toLocaleDateString('ru-RU')
          const time = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
          return [
            date,
            time,
            log.context,
            log.errorMessage,
            log.userId || '',
            log.userName || '',
          ]
        })
        const errorSheet = XLSX.utils.aoa_to_sheet([errorHeaders, ...errorRows])
        XLSX.utils.book_append_sheet(workbook, errorSheet, 'Error Logs')
      }

      const exportPath = this._getExportPath('all_logs')
      XLSX.writeFile(workbook, exportPath)

      console.log('[EXPORT] Все логи экспортированы:', exportPath)
      return exportPath
    } catch (error) {
      await this.logError(error, 'LogService.exportAllLogs', null, null, filters)
      throw error
    }
  }

  /**
   * Получить статистику по логам
   */
  async getStatistics(filters = {}) {
    try {
      const searchCount = await Log.countDocuments(this._buildSearchQuery(filters))
      const insertCount = await InsertLog.countDocuments(this._buildInsertQuery(filters))
      const errorCount = await ErrorLog.countDocuments(this._buildErrorQuery(filters))

      return {
        searchLogs: searchCount,
        insertLogs: insertCount,
        errorLogs: errorCount,
        total: searchCount + insertCount + errorCount,
      }
    } catch (error) {
      await this.logError(error, 'LogService.getStatistics', null, null, filters)
      throw error
    }
  }

  // ========== Приватные методы ==========

  _buildSearchQuery(filters) {
    const query = {}
    if (filters.startDate || filters.endDate) {
      query.timestamp = {}
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate)
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate)
    }
    if (filters.userId) query.chatId = filters.userId
    if (filters.type) query.type = filters.type
    return query
  }

  _buildInsertQuery(filters) {
    const query = {}
    if (filters.startDate || filters.endDate) {
      query.timestamp = {}
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate)
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate)
    }
    if (filters.inspectorId) query.inspectorId = filters.inspectorId
    if (filters.inspectorName) query.inspectorName = new RegExp(filters.inspectorName, 'i')
    if (filters.conscode) query.conscode = filters.conscode
    return query
  }

  _buildErrorQuery(filters) {
    const query = {}
    if (filters.startDate || filters.endDate) {
      query.timestamp = {}
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate)
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate)
    }
    if (filters.userId) query.userId = filters.userId
    if (filters.context) query.context = new RegExp(filters.context, 'i')
    return query
  }

  _getExportPath(filename) {
    const logDir = path.join(__dirname, '..', 'modules', 'log')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    return path.join(logDir, `${filename}_${timestamp}.xlsx`)
  }
}

module.exports = LogService
