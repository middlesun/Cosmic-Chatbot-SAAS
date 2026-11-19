// Debug Configuration for Web Form Tester
class DebugConfig {
  constructor() {
    this.debugMode = false;
    this.performanceMonitoring = true;
    this.verboseLogging = false;
    this.testMode = false;
    this.mockApiResponses = false;
    this.slowModeDelay = 0;
    this.maxRetries = 3;
    this.timeouts = {
      apiCall: 30000,
      formSubmission: 10000,
      pageLoad: 15000,
      fieldInteraction: 5000
    };
    this.featureFlags = {
      enableImplicitForms: true,
      enableCalculatorDetection: true,
      enableAdvancedSubmission: true,
      enableResponseMonitoring: true,
      enableFieldValidation: true,
      enableProgressTracking: true
    };
    this.performance = {
      metrics: [],
      startTime: null,
      lastAction: null
    };
  }

  async loadConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['debugConfig']);
        if (stored && stored.debugConfig) {
          Object.assign(this, stored.debugConfig);
        }
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('sp_debug_config');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.assign(this, parsed);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load debug config:', error);
    }
  }

  async saveConfig() {
    const configPayload = {
      debugMode: this.debugMode,
      performanceMonitoring: this.performanceMonitoring,
      verboseLogging: this.verboseLogging,
      testMode: this.testMode,
      mockApiResponses: this.mockApiResponses,
      slowModeDelay: this.slowModeDelay,
      maxRetries: this.maxRetries,
      timeouts: this.timeouts,
      featureFlags: this.featureFlags
    };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ debugConfig: configPayload });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sp_debug_config', JSON.stringify(configPayload));
      }
    } catch (error) {
      console.error('Failed to save debug config:', error);
    }
  }

  log(level, message, ...args) {
    if (!this.debugMode && level === 'debug') return;
    if (!this.verboseLogging && level === 'verbose') return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      args: args.length > 0 ? args : undefined,
      stack: new Error().stack
    };

    // Store in performance metrics if enabled
    if (this.performanceMonitoring) {
      this.performance.metrics.push(logEntry);
      this.trimMetrics();
    }

    // Console output with styling
    const styles = {
      error: 'color: #ff4444; font-weight: bold;',
      warn: 'color: #ffaa00; font-weight: bold;',
      info: 'color: #0088ff;',
      debug: 'color: #888888;',
      verbose: 'color: #cccccc;'
    };

    console.log(
      `%c[${timestamp}] ${level.toUpperCase()}: ${message}`,
      styles[level] || '',
      ...args
    );
  }

  startPerformanceTracking(action) {
    if (!this.performanceMonitoring) return null;

    const perfEntry = {
      action,
      startTime: performance.now(),
      endTime: null,
      duration: null,
      timestamp: new Date().toISOString()
    };

    this.performance.lastAction = perfEntry;
    return perfEntry;
  }

  endPerformanceTracking(perfEntry, success = true, additionalData = {}) {
    if (!this.performanceMonitoring || !perfEntry) return;

    perfEntry.endTime = performance.now();
    perfEntry.duration = perfEntry.endTime - perfEntry.startTime;
    perfEntry.success = success;
    perfEntry.additionalData = additionalData;

    this.performance.metrics.push(perfEntry);
    this.trimMetrics();

    this.log('info', `Performance: ${perfEntry.action} took ${perfEntry.duration.toFixed(2)}ms`, perfEntry);
  }

  trimMetrics() {
    if (this.performance.metrics.length > 1000) {
      this.performance.metrics = this.performance.metrics.slice(-500);
    }
  }

  async exportDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      config: {
        debugMode: this.debugMode,
        performanceMonitoring: this.performanceMonitoring,
        verboseLogging: this.verboseLogging,
        testMode: this.testMode,
        featureFlags: this.featureFlags
      },
      performance: {
        metrics: this.performance.metrics,
        totalActions: this.performance.metrics.filter(m => m.action).length,
        averageDuration: this.calculateAverageDuration(),
        slowestActions: this.getSlowestActions(5)
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      extension: (() => {
        const manifest = (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function')
          ? chrome.runtime.getManifest()
          : { version: 'preview', permissions: [], host_permissions: [] };
        return {
          version: manifest.version,
          permissions: manifest.permissions,
          hostPermissions: manifest.host_permissions
        };
      })()
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          diagnostics: diagnostics,
          diagnosticsTimestamp: new Date().toISOString()
        });
      }
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `web-form-tester-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return diagnostics;
    } catch (error) {
      console.error('Failed to export diagnostics:', error);
      return null;
    }
  }

  calculateAverageDuration() {
    const durations = this.performance.metrics
      .filter(m => m.duration)
      .map(m => m.duration);
    
    if (durations.length === 0) return 0;
    
    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  getSlowestActions(count = 5) {
    return this.performance.metrics
      .filter(m => m.duration && m.action)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count)
      .map(m => ({
        action: m.action,
        duration: m.duration,
        timestamp: m.timestamp,
        success: m.success
      }));
  }

  async delay(ms) {
    if (this.slowModeDelay > 0) {
      ms += this.slowModeDelay;
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shouldMockApiResponse() {
    return this.testMode && this.mockApiResponses;
  }

  getMockApiResponse(type) {
    const mockResponses = {
      analyzeWebApp: {
        purpose: 'Test Financial Calculator',
        theme: 'Finance',
        business_type: 'Financial Services',
        realistic_data_types: ['income', 'expenses', 'rate'],
        industry: 'Financial Services',
        common_fields: ['amount', 'percentage'],
        validation_patterns: ['numeric', 'percentage'],
        is_financial_app: true
      },
      generateFormData: {
        income: 75000,
        expenses: 2500,
        rate: 15,
        amount: 10000,
        name: 'Test User',
        email: 'test@example.com'
      }
    };

    return mockResponses[type] || {};
  }

  isFeatureEnabled(feature) {
    return this.featureFlags[feature] !== false;
  }

  getTimeout(type) {
    return this.timeouts[type] || 10000;
  }

  // Environment detection
  isLocalEnvironment() {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('192.168.') ||
           window.location.hostname.includes('10.0.') ||
           window.location.protocol === 'file:';
  }

  isProductionEnvironment() {
    return !this.isLocalEnvironment() && !this.testMode;
  }

  // Error handling helpers
  handleError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.log('error', `Error in ${context}:`, errorInfo);
    
    // Store error for diagnostics
    if (this.performanceMonitoring) {
      this.performance.metrics.push({
        type: 'error',
        ...errorInfo
      });
    }

    return errorInfo;
  }

  // Validation helpers
  validateFormData(formData, fields) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    fields.forEach(field => {
      const value = formData[field.name];
      
      if (field.required && (!value || value === '')) {
        validation.valid = false;
        validation.errors.push(`Required field ${field.name} is empty`);
      }

      if (field.type === 'email' && value && !value.includes('@')) {
        validation.warnings.push(`Email field ${field.name} may not be valid`);
      }

      if (field.type === 'number' && value && isNaN(Number(value))) {
        validation.valid = false;
        validation.errors.push(`Numeric field ${field.name} has non-numeric value`);
      }
    });

    return validation;
  }
}

// Global debug instance
window.debugConfig = new DebugConfig();

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.debugConfig.loadConfig();
  });
} else {
  window.debugConfig.loadConfig();
} 