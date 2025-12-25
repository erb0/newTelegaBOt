const ADODB = require('node-adodb');
require('dotenv').config();

/**
 * AccessDbManager - Класс для управления соединением с Access Database
 * и кешированием справочных данных
 */
class AccessDbManager {
  constructor() {
    this.connection = null;
    this.isInitialized = false;
    this.isLoading = false;

    // Кеш данных с метаинформацией
    this.cache = {
      deskCodes: { data: {}, timestamp: null },
      paymentCodes: { data: {}, timestamp: null },
      streetCodes: { data: {}, timestamp: null },
      locationCodes: { data: {}, timestamp: null }
    };

    // Конфигурация
    this.CACHE_TTL = parseInt(process.env.DB_CACHE_TTL) || 3600000; // 1 час по умолчанию
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000; // 1 секунда

    // Автообновление
    this.refreshIntervalId = null;
  }

  /**
   * Инициализация соединения с базой данных
   */
  async initialize() {
    if (this.isInitialized && this.connection) {
      console.log('[AccessDB] Уже инициализирован');
      return;
    }

    try {
      this._validateEnvironmentVariables();
      this._createConnection();
      await this._testConnection();

      this.isInitialized = true;
      console.log('[AccessDB] ✅ Соединение установлено');

      // Загрузить справочники при старте
      await this.populateAllCodes();

    } catch (error) {
      console.error('[AccessDB] ❌ Ошибка инициализации:', error.message);
      this.isInitialized = false;
      this.connection = null;
      throw new Error(`Не удалось инициализировать AccessDB: ${error.message}`);
    }
  }

  /**
   * Проверка наличия всех необходимых переменных окружения
   */
  _validateEnvironmentVariables() {
    const required = ['DB_PROVIDER', 'DB_DATA_SOURCE', 'DB_SYSTEM_DATABASE', 'DB_USER_ID', 'DB_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Отсутствуют переменные окружения: ${missing.join(', ')}`);
    }
  }

  /**
   * Создание соединения с базой данных
   */
  _createConnection() {
    const isDebug = process.env.DB_DEBUG === 'true';
    ADODB.debug = isDebug;

    const connectionString = `Provider=${process.env.DB_PROVIDER};Data Source=${process.env.DB_DATA_SOURCE};Jet OLEDB:System Database=${process.env.DB_SYSTEM_DATABASE};User ID=${process.env.DB_USER_ID};Password=${process.env.DB_PASSWORD};`;

    this.connection = ADODB.open(connectionString);

    if (isDebug) {
      console.log('[AccessDB] Debug режим включен');
    }
  }

  /**
   * Тестирование соединения с базой данных
   */
  async _testConnection() {
    try {
      await this.connection.execute('SELECT 1');
      return true;
    } catch (error) {
      throw new Error(`Ошибка тестирования соединения: ${error.message}`);
    }
  }

  /**
   * Проверка соединения с базой данных
   */
  async checkConnection() {
    // Если соединение не инициализировано, пытаемся восстановить
    if (!this.connection || !this.isInitialized) {
      console.log('[AccessDB] Соединение потеряно, попытка восстановления...');
      try {
        await this.initialize();
        return true;
      } catch (error) {
        console.error('[AccessDB] Не удалось восстановить соединение:', error.message);
        throw new Error('Соединение не инициализировано и не удалось восстановить');
      }
    }

    try {
      await this.connection.execute('SELECT 1');
      return true;
    } catch (error) {
      console.error('[AccessDB] Ошибка проверки соединения:', error.message);
      // Пытаемся переподключиться один раз
      console.log('[AccessDB] Попытка переподключения...');
      this.isInitialized = false;
      this.connection = null;
      await this.initialize();
      return true;
    }
  }

  /**
   * Выполнение запроса с повторными попытками
   */
  async _executeQueryWithRetry(query, retries = this.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.connection.query(query);
      } catch (error) {
        console.error(`[AccessDB] Попытка ${attempt}/${retries} не удалась:`, error.message);

        if (attempt === retries) {
          throw new Error(`Не удалось выполнить запрос после ${retries} попыток: ${error.message}`);
        }

        // Экспоненциальная задержка перед повторной попыткой
        const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
        await this._sleep(delay);
      }
    }
  }

  /**
   * Публичный метод для выполнения запросов с автоматической проверкой соединения
   */
  async query(queryString) {
    await this.checkConnection();
    return await this._executeQueryWithRetry(queryString);
  }

  /**
   * Загрузка всех справочников параллельно
   */
  async populateAllCodes() {
    if (this.isLoading) {
      console.log('[AccessDB] Загрузка уже выполняется...');
      return;
    }

    this.isLoading = true;
    console.log('[AccessDB] Начало загрузки справочников...');

    const startTime = Date.now();

    try {
      // Определение всех запросов
      const queries = [
        {
          name: 'deskCodes',
          query: `SELECT PDESKCODE, PDESKNAME FROM PAYDESK`,
          codeField: 'PDESKCODE',
          nameField: 'PDESKNAME'
        },
        {
          name: 'paymentCodes',
          query: `SELECT GROUPCODE, GROUPNAME FROM [GROUP]`,
          codeField: 'GROUPCODE',
          nameField: 'GROUPNAME'
        },
        {
          name: 'streetCodes',
          query: `SELECT STRTCODE, STRTNAME FROM STREET`,
          codeField: 'STRTCODE',
          nameField: 'STRTNAME'
        },
        {
          name: 'locationCodes',
          query: `SELECT [FSBDVCODE], [SECTNAME], [CHIEFNAME] FROM [SECTION] ORDER BY SECTNAME, CHIEFNAME`,
          codeField: 'FSBDVCODE',
          nameFields: ['SECTNAME', 'CHIEFNAME']
        }
      ];

      // Параллельное выполнение всех запросов
      const results = await Promise.all(
        queries.map(async (config) => {
          try {
            const data = await this._executeQueryWithRetry(config.query);
            return { config, data, success: true };
          } catch (error) {
            console.error(`[AccessDB] Ошибка загрузки ${config.name}:`, error.message);
            return { config, error, success: false };
          }
        })
      );

      // Обработка результатов
      results.forEach(({ config, data, success, error }) => {
        if (!success) {
          console.error(`[AccessDB] Пропуск ${config.name} из-за ошибки:`, error.message);
          return;
        }

        const cacheData = {};

        data.forEach((row) => {
          const code = row[config.codeField];

          if (config.nameFields) {
            // Несколько полей для имени
            cacheData[code] = config.nameFields
              .map(field => row[field])
              .filter(Boolean)
              .join(' - ');
          } else {
            // Одно поле для имени
            cacheData[code] = row[config.nameField];
          }
        });

        // Обновление кеша
        this.cache[config.name] = {
          data: cacheData,
          timestamp: Date.now()
        };

        console.log(`[AccessDB] ✅ ${config.name}: ${Object.keys(cacheData).length} записей`);
      });

      const duration = Date.now() - startTime;
      console.log(`[AccessDB] Загрузка завершена за ${duration}ms`);

    } catch (error) {
      console.error('[AccessDB] Критическая ошибка загрузки справочников:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Проверка актуальности кеша
   */
  _isCacheValid(cacheName) {
    const cache = this.cache[cacheName];

    if (!cache || !cache.timestamp) {
      return false;
    }

    const age = Date.now() - cache.timestamp;
    return age < this.CACHE_TTL;
  }

  /**
   * Получение данных из кеша с автоматическим обновлением
   */
  async _getCachedData(cacheName) {
    if (!this._isCacheValid(cacheName)) {
      console.log(`[AccessDB] Кеш ${cacheName} устарел, обновление...`);
      await this.populateAllCodes();
    }

    return this.cache[cacheName].data;
  }

  /**
   * Геттеры для справочников
   */
  async getDeskCodes() {
    return await this._getCachedData('deskCodes');
  }

  async getPaymentCodes() {
    return await this._getCachedData('paymentCodes');
  }

  async getStreetCodes() {
    return await this._getCachedData('streetCodes');
  }

  async getLocationCodes() {
    return await this._getCachedData('locationCodes');
  }

  /**
   * Синхронные геттеры (используют текущий кеш без проверки актуальности)
   */
  get deskCodes() {
    return this.cache.deskCodes.data;
  }

  get paymentCodes() {
    return this.cache.paymentCodes.data;
  }

  get streetCodes() {
    return this.cache.streetCodes.data;
  }

  get locationCodes() {
    return this.cache.locationCodes.data;
  }

  /**
   * Принудительное обновление кеша
   */
  async refreshCache() {
    console.log('[AccessDB] Принудительное обновление кеша...');

    // Сброс временных меток для принудительного обновления
    Object.keys(this.cache).forEach(key => {
      this.cache[key].timestamp = null;
    });

    await this.populateAllCodes();
  }

  /**
   * Запуск автоматического обновления кеша
   */
  startAutoRefresh(intervalMs = this.CACHE_TTL) {
    if (this.refreshIntervalId) {
      console.log('[AccessDB] Автообновление уже запущено');
      return;
    }

    console.log(`[AccessDB] Запуск автообновления каждые ${intervalMs / 1000 / 60} минут`);

    this.refreshIntervalId = setInterval(async () => {
      try {
        await this.refreshCache();
      } catch (error) {
        console.error('[AccessDB] Ошибка автообновления:', error.message);
      }
    }, intervalMs);
  }

  /**
   * Остановка автоматического обновления
   */
  stopAutoRefresh() {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
      console.log('[AccessDB] Автообновление остановлено');
    }
  }

  /**
   * Функция для парсинга объекта и поиска значений, содержащих текст
   */
  parseObjText(obj, text) {
    return Object.entries(obj)
      .filter(([key, value]) => value && value.includes(text))
      .map(([key, value]) => `${key} - ${value}`)
      .join('\n');
  }

  /**
   * Graceful shutdown - закрытие соединения
   */
  async close() {
    console.log('[AccessDB] Закрытие соединения...');

    this.stopAutoRefresh();

    // Очистка кеша
    Object.keys(this.cache).forEach(key => {
      this.cache[key] = { data: {}, timestamp: null };
    });

    this.isInitialized = false;
    this.connection = null;

    console.log('[AccessDB] ✅ Соединение закрыто');
  }

  /**
   * Вспомогательная функция для задержки
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Получение статистики кеша
   */
  getCacheStats() {
    const stats = {};

    Object.entries(this.cache).forEach(([name, cache]) => {
      const age = cache.timestamp ? Date.now() - cache.timestamp : null;
      stats[name] = {
        count: Object.keys(cache.data).length,
        ageSeconds: age ? Math.floor(age / 1000) : null,
        isValid: this._isCacheValid(name)
      };
    });

    return stats;
  }
}

// Создание singleton instance
const accessDbManager = new AccessDbManager();

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await accessDbManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await accessDbManager.close();
  process.exit(0);
});

// Экспорт
module.exports = {
  accessDbManager,

  // Обратная совместимость - экспорт объектов напрямую
  get connection() {
    return accessDbManager.connection;
  },

  checkConnection: () => accessDbManager.checkConnection(),

  // Безопасный метод для выполнения запросов
  query: (queryString) => accessDbManager.query(queryString),

  get deskCodes() {
    return accessDbManager.deskCodes;
  },

  get paymentCodes() {
    return accessDbManager.paymentCodes;
  },

  get streetCodes() {
    return accessDbManager.streetCodes;
  },

  get locationCodes() {
    return accessDbManager.locationCodes;
  },

  parseObjText: (obj, text) => accessDbManager.parseObjText(obj, text),

  // Для совместимости со старым кодом
  main: () => accessDbManager.populateAllCodes()
};
