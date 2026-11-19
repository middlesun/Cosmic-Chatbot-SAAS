// Production Configuration for Web Form Tester
class ProductionConfig {
  constructor() {
    this.version = '1.0.0';
    this.environment = this.detectEnvironment();
    this.initialized = false;
    this.failsafeMode = false;
    
    // Rate limiting configuration
    this.rateLimits = {
      apiCallsPerMinute: 60,
      formSubmissionsPerMinute: 30,
      tabsPerSession: 50,
      maxConcurrentTabs: 5
    };
    
    // Timeout configurations
    this.timeouts = {
      apiCall: 30000,
      formSubmission: 15000,
      pageLoad: 20000,
      fieldInteraction: 5000,
      tabSwitch: 3000,
      responseWait: 10000
    };
    
    // Retry configurations
    this.retrySettings = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBackoff: true,
      jitterEnabled: true
    };
    
    // Security settings
    this.security = {
      allowFileUploads: false,
      allowPasswordFields: false,
      allowCreditCardFields: false,
      sanitizeInputs: true,
      validateUrls: true,
      blockSuspiciousPatterns: true
    };
    
    // Performance settings
    this.performance = {
      enableBatching: true,
      maxBatchSize: 10,
      enableCaching: true,
      cacheExpiry: 3600000, // 1 hour
      enableCompression: true,
      optimizeMemory: true
    };
    
    // Error handling
    this.errorHandling = {
      enableGlobalErrorHandler: true,
      enableRecoveryMode: true,
      maxErrors: 10,
      errorCooldown: 60000,
      enableErrorReporting: false
    };
    
    // Feature flags
    this.features = {
      enableAdvancedFormDetection: true,
      enableFinancialCalculators: true,
      enableImplicitForms: true,
      enableProgressTracking: true,
      enablePerformanceMonitoring: true,
      enableDebugMode: false,
      enableTestMode: false
    };
    
    // Form detection patterns
    this.formPatterns = {
      financial: [
        'calculator', 'budget', 'tax', 'loan', 'mortgage', 'investment',
        'income', 'expense', 'savings', 'retirement', 'insurance'
      ],
      contact: [
        'contact', 'inquiry', 'message', 'feedback', 'support', 'help'
      ],
      registration: [
        'register', 'signup', 'join', 'create', 'account', 'member'
      ],
      commerce: [
        'checkout', 'payment', 'billing', 'shipping', 'cart', 'order'
      ]
    };
    
    // Field validation patterns
    this.validation = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      url: /^https?:\/\/.+/,
      number: /^-?\d*\.?\d+$/,
      currency: /^\$?\d+(\.\d{2})?$/,
      percentage: /^\d+(\.\d+)?%?$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      time: /^\d{2}:\d{2}(:\d{2})?$/
    };
    
    // API configuration
    this.api = {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat',
      maxTokens: 1500,
      temperature: 0.7,
      timeout: 30000,
      retries: 3
    };
    
    // Storage configuration
    this.storage = {
      syncKeys: ['apiKey', 'userPreferences', 'config'],
      localKeys: ['testResults', 'logs', 'cache', 'diagnostics'],
      maxStorageSize: 10485760, // 10MB
      cleanupInterval: 86400000 // 24 hours
    };
    
    this.counters = {
      apiCalls: 0,
      formSubmissions: 0,
      errors: 0,
      lastReset: Date.now()
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadStoredConfig();
      await this.setupGlobalErrorHandler();
      await this.initializeRateLimiting();
      this.setupPerformanceMonitoring();
      this.initialized = true;
      
      console.log('Production config initialized successfully');
    } catch (error) {
      console.error('Failed to initialize production config:', error);
      this.failsafeMode = true;
    }
  }

  detectEnvironment() {
    const hostname = window.location?.hostname || 'unknown';
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.')) {
      return 'development';
    }
    
    if (hostname.includes('staging') || hostname.includes('test')) {
      return 'staging';
    }
    
    return 'production';
  }

  async loadStoredConfig() {
    try {
      const result = await chrome.storage.sync.get(['productionConfig']);
      if (result.productionConfig) {
        // Merge stored config with defaults
        this.mergeConfig(result.productionConfig);
      }
    } catch (error) {
      console.error('Failed to load stored config:', error);
    }
  }

  mergeConfig(storedConfig) {
    // Deep merge stored config with defaults
    const mergeDeep = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          mergeDeep(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    mergeDeep(this, storedConfig);
  }

  async saveConfig() {
    try {
      const configToSave = {
        rateLimits: this.rateLimits,
        timeouts: this.timeouts,
        retrySettings: this.retrySettings,
        security: this.security,
        performance: this.performance,
        features: this.features,
        validation: this.validation
      };
      
      await chrome.storage.sync.set({ productionConfig: configToSave });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  async setupGlobalErrorHandler() {
    if (!this.errorHandling.enableGlobalErrorHandler) return;
    
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error, 'global');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason, 'promise');
    });
  }

  handleGlobalError(error, type) {
    this.counters.errors++;
    
    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      type,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    console.error('Global error caught:', errorInfo);
    
    // Store error for diagnostics
    this.storeError(errorInfo);
    
    // Enable recovery mode if too many errors
    if (this.counters.errors > this.errorHandling.maxErrors) {
      this.enableRecoveryMode();
    }
  }

  async storeError(errorInfo) {
    try {
      const stored = await chrome.storage.local.get(['errors']);
      const errors = stored.errors || [];
      
      errors.push(errorInfo);
      
      // Keep only last 100 errors
      if (errors.length > 100) {
        errors.splice(0, errors.length - 100);
      }
      
      await chrome.storage.local.set({ errors });
    } catch (error) {
      console.error('Failed to store error:', error);
    }
  }

  enableRecoveryMode() {
    console.warn('Enabling recovery mode due to excessive errors');
    this.failsafeMode = true;
    
    // Reset counters after cooldown
    setTimeout(() => {
      this.counters.errors = 0;
      this.failsafeMode = false;
      console.log('Recovery mode disabled');
    }, this.errorHandling.errorCooldown);
  }

  async initializeRateLimiting() {
    this.rateLimitState = {
      apiCalls: [],
      formSubmissions: [],
      lastCleanup: Date.now()
    };
    
    // Clean up old entries every minute
    setInterval(() => {
      this.cleanupRateLimitState();
    }, 60000);
  }

  cleanupRateLimitState() {
    const now = Date.now();
    const oneMinute = 60000;
    
    this.rateLimitState.apiCalls = this.rateLimitState.apiCalls.filter(
      timestamp => now - timestamp < oneMinute
    );
    
    this.rateLimitState.formSubmissions = this.rateLimitState.formSubmissions.filter(
      timestamp => now - timestamp < oneMinute
    );
    
    this.rateLimitState.lastCleanup = now;
  }

  async checkRateLimit(type) {
    if (!this.rateLimitState) return true;
    
    const now = Date.now();
    const limits = {
      apiCall: this.rateLimits.apiCallsPerMinute,
      formSubmission: this.rateLimits.formSubmissionsPerMinute
    };
    
    const stateKey = type === 'apiCall' ? 'apiCalls' : 'formSubmissions';
    const currentCount = this.rateLimitState[stateKey].length;
    
    if (currentCount >= limits[type]) {
      console.warn(`Rate limit exceeded for ${type}: ${currentCount}/${limits[type]}`);
      return false;
    }
    
    this.rateLimitState[stateKey].push(now);
    return true;
  }

  setupPerformanceMonitoring() {
    if (!this.performance.enablePerformanceMonitoring) return;
    
    // Monitor memory usage
    if (performance.memory) {
      setInterval(() => {
        const memoryInfo = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        };
        
        this.logPerformanceMetric('memory', memoryInfo);
        
        // Clean up if memory usage is high
        if (memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.9) {
          this.performMemoryCleanup();
        }
      }, 30000); // Check every 30 seconds
    }
  }

  logPerformanceMetric(type, data) {
    if (!this.performanceMetrics) {
      this.performanceMetrics = [];
    }
    
    this.performanceMetrics.push({
      type,
      data,
      timestamp: Date.now()
    });
    
    // Keep only last 100 metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - 100);
    }
  }

  performMemoryCleanup() {
    console.log('Performing memory cleanup');
    
    // Clear caches
    if (this.cache) {
      this.cache.clear();
    }
    
    // Clear old performance metrics
    if (this.performanceMetrics) {
      this.performanceMetrics = this.performanceMetrics.slice(-20);
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  async getTimeout(type) {
    return this.timeouts[type] || 10000;
  }

  async getRetrySettings() {
    return { ...this.retrySettings };
  }

  isFeatureEnabled(feature) {
    return this.features[feature] === true;
  }

  getValidationPattern(type) {
    return this.validation[type];
  }

  getFormPatterns(category) {
    return this.formPatterns[category] || [];
  }

  isSecurityRestricted(fieldType) {
    switch (fieldType) {
      case 'file':
        return !this.security.allowFileUploads;
      case 'password':
        return !this.security.allowPasswordFields;
      case 'credit-card':
        return !this.security.allowCreditCardFields;
      default:
        return false;
    }
  }

  sanitizeInput(input) {
    if (!this.security.sanitizeInputs) return input;
    
    if (typeof input !== 'string') return input;
    
    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  async validateUrl(url) {
    if (!this.security.validateUrls) return true;
    
    try {
      const parsedUrl = new URL(url);
      
      // Block suspicious protocols
      if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
        return false;
      }
      
      // Allow local development
      if (this.environment === 'development') {
        return true;
      }
      
      // Block private IP ranges in production
      if (this.environment === 'production') {
        const hostname = parsedUrl.hostname;
        if (hostname.includes('192.168.') || hostname.includes('10.0.') || 
            hostname.includes('127.0.') || hostname === 'localhost') {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async exportDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      version: this.version,
      environment: this.environment,
      failsafeMode: this.failsafeMode,
      config: {
        rateLimits: this.rateLimits,
        timeouts: this.timeouts,
        features: this.features,
        security: this.security,
        performance: this.performance
      },
      counters: { ...this.counters },
      performanceMetrics: this.performanceMetrics || [],
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      }
    };
    
    try {
      // Get stored errors
      const stored = await chrome.storage.local.get(['errors']);
      diagnostics.errors = stored.errors || [];
      
      return diagnostics;
    } catch (error) {
      console.error('Failed to export diagnostics:', error);
      return diagnostics;
    }
  }

  // Helper methods for production use
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryWithBackoff(fn, context = '') {
    const { maxRetries, baseDelay, maxDelay, exponentialBackoff, jitterEnabled } = this.retrySettings;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        let delay = baseDelay;
        if (exponentialBackoff) {
          delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        }
        
        if (jitterEnabled) {
          delay += Math.random() * 1000;
        }
        
        console.warn(`Retry attempt ${attempt + 1} for ${context} failed, retrying in ${delay}ms:`, error);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  getApiConfig() {
    return { ...this.api };
  }

  shouldUseCache(key) {
    if (!this.performance.enableCaching) return false;
    
    const cached = this.cache?.get(key);
    if (!cached) return false;
    
    return Date.now() - cached.timestamp < this.performance.cacheExpiry;
  }

  setCache(key, value) {
    if (!this.performance.enableCaching) return;
    
    if (!this.cache) {
      this.cache = new Map();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    if (!this.cache) return null;
    
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.timestamp > this.performance.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductionConfig;
} else {
  window.ProductionConfig = ProductionConfig;
} 