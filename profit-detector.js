/**
 * Unified Profit Management System - Smart Detection + Auto Refresh
 * Merged functionality of ProfitDetector and AutoProfitRefresh
 * Provides complete profit detection, distribution and refresh mechanism
 */

// Compatibility check and enhancement
(function() {
    // Ensure CustomEvent is available
    if (typeof window.CustomEvent !== 'function') {
        function CustomEvent(event, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        }
        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    }
    
    // Ensure Notification API compatibility check
    if (typeof window.Notification === 'undefined') {
        window.Notification = {
            permission: 'denied',
            requestPermission: function() {
                return Promise.resolve('denied');
            }
        };
    }
    
    // Ensure fetch API is available
    if (typeof window.fetch === 'undefined') {
        console.warn('fetch API not available, profit functionality may be limited');
    }
})();

class UnifiedProfitManager {
    constructor(options = {}) {
        // Basic configuration
        this.storageKey = 'profit_detector_data';
        this.lastCheckKey = 'profit_last_check_time';
        this.checkCooldown = options.checkCooldown || 30000; // 30 second check cooldown
        this.maxRetries = 3;
        this.isChecking = false;
        this.isDebugMode = options.isDebugMode || false;
        
        // Auto refresh configuration
        this.options = {
            // Auto refresh interval (milliseconds)
            refreshInterval: options.refreshInterval || 900000, // 15 minutes
            // Whether to check immediately on page load
            checkOnLoad: options.checkOnLoad !== false,
            // Whether to check when page gains focus
            checkOnFocus: options.checkOnFocus !== false,
            // Whether to check on user actions
            checkOnAction: options.checkOnAction !== false,
            // API endpoint configuration
            detectorApiEndpoint: options.detectorApiEndpoint || '/api/profit/check',
            autoRefreshApiEndpoint: options.autoRefreshApiEndpoint || '/api/system/auto-profit-distribute',
            // Callback functions
            onProfitUpdated: options.onProfitUpdated || null,
            onError: options.onError || null,
            // Compatibility options
            enablePolyfill: options.enablePolyfill !== false
        };
        
        // Auto refresh status
        this.isRunning = false;
        this.lastCheckTime = 0;
        this.intervalId = null;
        this.retryCount = 0;
        
        // Compatibility status
        this.compatibility = this.checkCompatibility();
        
        // Initialize system
        this.init();
    }

    /**
     * Check browser compatibility
     */
    checkCompatibility() {
        const features = {
            localStorage: this.isLocalStorageAvailable(),
            fetch: typeof fetch !== 'undefined',
            promise: typeof Promise !== 'undefined',
            customEvent: typeof CustomEvent === 'function',
            notification: 'Notification' in window
        };
        
        const isCompatible = features.localStorage && features.fetch && features.promise;
        
        if (!isCompatible) {
            console.warn('Browser compatibility check:', features);
        }
        
        return {
            features,
            isCompatible
        };
    }

    /**
     * Check if localStorage is available
     */
    isLocalStorageAvailable() {
        try {
            const test = '__unified_profit_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize unified profit management system
     */
    init() {
        // Check compatibility
        if (!this.compatibility.isCompatible) {
            console.error('Browser incompatible, profit functionality disabled');
            if (this.options.onError) {
                this.options.onError(new Error('Insufficient browser compatibility'));
            }
            return;
        }
        
        // Check on page load
        if (this.options.checkOnLoad) {
            // Delayed execution to ensure page is fully loaded
            setTimeout(() => {
                this.smartProfitCheck('page_load');
            }, 1000);
        }
        
        // Start timer
        this.startAutoRefresh();
        
        // Check when page gains focus
        if (this.options.checkOnFocus) {
            this.addEventListenerSafe(window, 'focus', () => {
                this.smartProfitCheck('page_focus');
            });
        }
        
        // Check when page visibility changes
        this.addEventListenerSafe(document, 'visibilitychange', () => {
            if (!document.hidden) {
                this.smartProfitCheck('visibility_change');
            }
        });
        
        // Check on user interaction (click, scroll, etc.)
        if (this.options.checkOnAction) {
            let actionTimer = null;
            const checkOnAction = () => {
                clearTimeout(actionTimer);
                actionTimer = setTimeout(() => {
                    this.smartProfitCheck('user_action');
                }, 2000); // Check 2 seconds after user stops action
            };
            
            this.addEventListenerSafe(document, 'click', checkOnAction);
            this.addEventListenerSafe(document, 'scroll', checkOnAction);
            this.addEventListenerSafe(document, 'touchend', checkOnAction);
        }
    }

    addEventListenerSafe(element, event, handler) {
        try {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, handler);
            }
        } catch (error) {
            console.error('Failed to add event listener:', event, error);
        }
    }

    startAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        try {
            this.intervalId = setInterval(() => {
                this.smartProfitCheck('auto_refresh');
            }, this.options.refreshInterval);
            
            this.isRunning = true;
            if (this.isDebugMode) {
                console.log('✅ Unified profit management started, interval:', this.options.refreshInterval + 'ms');
            }
        } catch (error) {
            console.error('Failed to start auto refresh:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }

    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        if (this.isDebugMode) {
            console.log('🛑 Unified profit management stopped');
        }
    }

    async smartProfitCheck(trigger = 'manual') {
        const now = Date.now();
        
        // Avoid frequent checks
        if (now - this.lastCheckTime < this.checkCooldown) {
            if (this.isDebugMode) console.log(`Profit check: Cooldown not expired, skip check (${trigger})`);
            return false;
        }

        this.lastCheckTime = now;

        try {
            // Get token
            const token = this.getToken();
            if (!token) {
                if (this.isDebugMode) console.log('Not logged in, skip profit check');
                return false;
            }

            // 1. First perform smart local analysis
            const shouldCheck = await this.shouldTriggerCheck(trigger);
            if (!shouldCheck) {
                return false;
            }

            // 2. Execute profit detection and distribution
            return await this.executeUnifiedProfitCheck(trigger);

        } catch (error) {
            if (this.isDebugMode) console.error('Smart profit detection error:', error);
            return false;
        }
    }

    async shouldTriggerCheck(trigger) {
        try {
            // For auto refresh and login success, execute directly
            if (trigger === 'auto_refresh' || trigger === 'login_success') {
                return true;
            }

            // For other trigger methods, perform local smart analysis
            const investOrders = await this.getUserInvestOrders();
            if (!investOrders || investOrders.length === 0) {
                if (this.isDebugMode) console.log('Profit check: No investment orders, skip check');
                return false;
            }

            // Local analysis for pending profits
            const pendingOrders = this.analyzePendingProfits(investOrders);
            if (pendingOrders.length === 0) {
                if (this.isDebugMode) console.log('Profit check: No pending profits, skip check');
                return false;
            }

            if (this.isDebugMode) console.log(`Profit check: Found ${pendingOrders.length} pending orders`);
            return true;

        } catch (error) {
            if (this.isDebugMode) console.error('Smart analysis failed:', error);
            // When analysis fails, still execute detection for important trigger sources
            return ['page_load', 'auto_refresh', 'login_success'].includes(trigger);
        }
    }

    async executeUnifiedProfitCheck(trigger) {
        if (this.isChecking) {
            if (this.isDebugMode) console.log('Profit check: In progress, skip duplicate request');
            return false;
        }

        this.isChecking = true;
        
        try {
            if (this.isDebugMode) console.log(`🔍 Execute profit check (${trigger})`);
            
            // Select API endpoint based on trigger method
            const apiEndpoint = trigger === 'auto_refresh' 
                ? this.options.autoRefreshApiEndpoint 
                : this.options.detectorApiEndpoint;
            
            const response = await this.makeUnifiedRequest(apiEndpoint, trigger);
            
            if (response.code === 1 && response.data.distributed > 0) {
                // Profit distributed, handle result
                if (this.isDebugMode) console.log('💰 Profit distribution successful:', response.data);
                
                // Trigger callback
                if (this.options.onProfitUpdated) {
                    this.options.onProfitUpdated(response.data);
                }
                
                // Clear related cache
                this.clearRelatedCache();
                
                // Trigger page data update event
                this.dispatchProfitUpdateEvent(response.data);
                
                // Refresh page data
                this.refreshPageData();
                
                // Reset retry count
                this.retryCount = 0;
                
                return true;
            } else {
                if (this.isDebugMode) console.log('📊 No profit distribution currently');
                return false;
            }

        } catch (error) {
            console.warn('Profit detection failed:', error);
            
            // Retry mechanism
            if (this.retryCount < this.maxRetries && !error.name === 'AbortError') {
                this.retryCount++;
                if (this.isDebugMode) console.log(`🔄 Will retry in 30 seconds (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => {
                    this.smartProfitCheck(trigger + '_retry');
                }, 30000);
            } else {
                // Reset retry count
                this.retryCount = 0;
                
                if (this.options.onError) {
                    this.options.onError(error);
                }
            }
            
            return false;
            
        } finally {
            this.isChecking = false;
        }
    }

    async makeUnifiedRequest(apiEndpoint, trigger) {
        // Generate auth key
        const authKey = this.generateAuthKey();
        const token = this.getToken();
        
        // Build request options
        const requestOptions = {
            method: trigger === 'auto_refresh' ? 'GET' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Key': authKey,
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        // For detection API, add request body
        if (trigger !== 'auto_refresh') {
            requestOptions.body = JSON.stringify({
                trigger_source: 'unified_profit_manager',
                trigger_type: trigger
            });
        }
        
        // Use unified timeout control
        const response = window.CommonUtils && window.CommonUtils.createTimeoutFetch 
            ? await window.CommonUtils.createTimeoutFetch(apiEndpoint, requestOptions)
            : await fetch(apiEndpoint, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async checkProfitTrigger(pageName) {
        // Compatible with old interface, convert to new smart detection
        const trigger = `page_${pageName}`;
        return await this.smartProfitCheck(trigger);
    }

    isCooldownExpired() {
        const lastCheck = localStorage.getItem(this.lastCheckKey);
        if (!lastCheck) return true;
        
        const elapsed = Date.now() - parseInt(lastCheck);
        return elapsed > this.checkCooldown;
    }

    async getUserInvestOrders() {
        try {
            // Try to get from local cache
            const cached = this.getCachedOrders();
            if (cached && this.isCacheValid(cached.timestamp)) {
                return cached.orders;
            }

            // Cache expired, fetch from server
            const response = await this.fetchFromServer('/api/invest/records');
            if (response.code === 1 && response.data && response.data.records) {
                // Cache data
                this.cacheOrders(response.data.records);
                return response.data.records;
            }
            
            return [];
        } catch (error) {
            // Handle error silently
            if (this.isDebugMode) console.error('Failed to get investment orders:', error);
            // Try to use expired cache when error occurs
            const cached = this.getCachedOrders();
            return cached ? cached.orders : [];
        }
    }

    analyzePendingProfits(orders) {
        const now = Date.now();
        return orders.filter(order => {
            // Only check active orders
            if (order.status !== 1 && order.status !== 'active') {
                return false;
            }

            // Check if there are still undistributed days
            const issuedDays = parseInt(order.issued_days || 0);
            const totalDays = parseInt(order.period || order.total_days || 0);
            if (issuedDays >= totalDays) {
                return false;
            }

            // Check next profit distribution time
            let nextProfitTime;
            if (order.next_profit_time) {
                // If it's a timestamp (number)
                if (typeof order.next_profit_time === 'number') {
                    nextProfitTime = order.next_profit_time * 1000; // Convert to milliseconds
                } else if (typeof order.next_profit_time === 'string') {
                    // If it's a time string
                    nextProfitTime = new Date(order.next_profit_time).getTime();
                }
            } else {
                // No explicit next_profit_time, calculate based on creation time and issued days
                const createTime = new Date(order.create_time).getTime();
                nextProfitTime = createTime + (issuedDays + 1) * 24 * 60 * 60 * 1000;
            }

            // Check if distribution time is reached (detect 5 minutes early)
            return nextProfitTime && (now >= nextProfitTime - 5 * 60 * 1000);
        });
    }

    shouldTriggerForPage(pageName) {
        const triggerPages = ['my', 'invest']; // My page and invest page
        const nonTriggerPages = ['invest-create']; // Invest creation page does not trigger

        return triggerPages.includes(pageName) && !nonTriggerPages.includes(pageName);
    }

    async triggerServerProfitCheck(pendingOrders) {
        if (this.isChecking) {
            if (this.isDebugMode) console.log('Profit check: In progress, skip duplicate request');
            return;
        }

        this.isChecking = true;
        
        try {
            // Only send necessary order IDs to reduce data transmission
            const orderIds = pendingOrders.map(order => order.id);
            
            const response = await this.fetchFromServer('/api/profit/check', {
                method: 'POST',
                data: {
                    order_ids: orderIds.slice(0, 10), // Check at most 10 orders
                    trigger_source: 'frontend_detector'
                }
            });

            if (response.code === 1) {
                if (this.isDebugMode) console.log('Profit check: Server detection completed', response.data);
                
                // If profit is distributed, refresh related cache
                if (response.data && response.data.distributed > 0) {
                    this.clearRelatedCache();
                    
                    // Trigger page data update event (silent)
                    this.dispatchProfitUpdateEvent(response.data);
                }
            }

        } catch (error) {
            // Handle error silently
            if (this.isDebugMode) console.error('Server profit detection failed:', error);
        } finally {
            this.isChecking = false;
        }
    }

    getCachedOrders() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            // Handle cache error silently
            if (this.isDebugMode) console.error('Failed to read cache:', error);
            return null;
        }
    }

    cacheOrders(orders) {
        try {
            const data = {
                orders: orders,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            // Handle cache error silently
            if (this.isDebugMode) console.error('Failed to save cache:', error);
        }
    }

    isCacheValid(timestamp) {
        const cacheExpiry = 10 * 60 * 1000; // 10 minutes cache validity
        return Date.now() - timestamp < cacheExpiry;
    }

    clearRelatedCache() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('user_balance_cache');
        localStorage.removeItem('user_info_cache');
    }

    updateLastCheckTime() {
        localStorage.setItem(this.lastCheckKey, Date.now().toString());
    }

    async fetchFromServer(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        const config = { ...defaultOptions, ...options };
        
        // Add auth token
        const token = this.getToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Handle POST data
        if (config.data) {
            config.body = JSON.stringify(config.data);
        }

        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    generateAuthKey() {
        try {
            // 🔧 Fix date format to ensure consistency with backend (YYYY-MM-DD)
            const date = new Date();
            const dateStr = date.getFullYear() + '-' + 
                          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(date.getDate()).padStart(2, '0');
            if (this.isDebugMode) console.log('🔑 Generate AuthKey, date:', dateStr);
            return this.md5('profit_auto_' + dateStr);
        } catch (error) {
            console.error('Failed to generate auth key:', error);
            // Fallback: use simple timestamp
            return 'fallback_' + Math.floor(Date.now() / 1000);
        }
    }

    md5(string) {
        try {
            // Simplified MD5 implementation, recommend using professional MD5 library in actual projects
            let hash = 0;
            if (string.length === 0) return hash.toString();
            for (let i = 0; i < string.length; i++) {
                const char = string.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(16);
        } catch (error) {
            console.error('MD5 calculation failed:', error);
            return 'hash_error_' + Date.now();
        }
    }

    showProfitNotification(data) {
        // Check if browser notification is supported
        if ('Notification' in window && Notification.permission === 'granted') {
            const amount = data.pending_amount || 'Unknown';
            new Notification('Profit Arrival Reminder', {
                body: `You have ${data.distributed} profits credited! Total: ¥${amount}`,
                icon: '/favicon.ico'
            });
        }
        
        // In-page notification - includes amount information
        const amountText = data.pending_amount ? ` Total: ¥${data.pending_amount}` : '';
        this.showPageNotification(`🎉 You have ${data.distributed} profits automatically credited!${amountText}`, 'success');
    }

    showPageNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background-color: ${type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto disappear after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    refreshPageData() {
        // Trigger custom event to notify other components to update data
        const event = new CustomEvent('profitUpdated', {
            detail: { timestamp: Date.now() }
        });
        window.dispatchEvent(event);
        
        // If page has specific refresh functions, call them
        if (typeof window.refreshUserBalance === 'function') {
            window.refreshUserBalance();
        }
        if (typeof window.refreshInvestRecords === 'function') {
            window.refreshInvestRecords();
        }
        if (typeof window.refreshProfitRecords === 'function') {
            window.refreshProfitRecords();
        }
        if (typeof refreshPageData === 'function') {
            refreshPageData();
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    destroy() {
        this.stopAutoRefresh();
        
        // Clean up event listeners
        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        } catch (error) {
            console.error('Error destroying instance:', error);
        }
    }

    dispatchProfitUpdateEvent(data) {
        const event = new CustomEvent('profitUpdated', {
            detail: data
        });
        window.dispatchEvent(event);
    }

    getToken() {
        return localStorage.getItem('token') || 
               localStorage.getItem('user_token') || 
               sessionStorage.getItem('token');
    }

    static async initPageDetector(pageName) {
        const manager = UnifiedProfitManager.getInstance();
        
        // Delayed detection to avoid affecting page loading
        setTimeout(async () => {
            await manager.checkProfitTrigger(pageName);
        }, 2000);

        return manager;
    }

    static getInstance() {
        if (!window.unifiedProfitManagerInstance) {
            window.unifiedProfitManagerInstance = new UnifiedProfitManager();
        }
        return window.unifiedProfitManagerInstance;
    }
}

// Compatibility alias - maintain backward compatibility
class ProfitDetector extends UnifiedProfitManager {
    constructor(options = {}) {
        super(options);
    }
}

// Export to global
window.UnifiedProfitManager = UnifiedProfitManager;
window.ProfitDetector = ProfitDetector; // Maintain compatibility

// Auto initialize (if page is logged in)
document.addEventListener('DOMContentLoaded', function() {
    // Check if logged in
    const token = localStorage.getItem('token') || localStorage.getItem('user_token') || sessionStorage.getItem('token');
    if (token) {
        // Create unified profit management instance
        window.unifiedProfitManager = new UnifiedProfitManager({
            refreshInterval: 900000, // 15 minutes
            checkOnLoad: true,
            checkOnFocus: true,
            checkOnAction: true,
            isDebugMode: false // Production environment silent mode
        });
        
        // Request notification permission
        window.unifiedProfitManager.requestNotificationPermission();
        
        // Auto identify page type based on page URL and trigger detection
        const path = window.location.pathname;
        let pageName = '';
        
        if (path.includes('my.html')) {
            pageName = 'my';
        } else if (path.includes('invest.html')) {
            pageName = 'invest';
        }
        
        if (pageName) {
            // Delayed trigger page-specific detection
            setTimeout(() => {
                window.unifiedProfitManager.checkProfitTrigger(pageName);
            }, 3000);
        }
    }
});

// Listen to profit update events (silent handling)
window.addEventListener('profitUpdated', (event) => {
    // Silent record profit update (only show in debug mode)
    if (window.unifiedProfitManager && window.unifiedProfitManager.isDebugMode) {
        console.log('Profit updated:', event.detail);
    }
    
    // Silent refresh page data without any prompts
    if (typeof refreshPageData === 'function') {
        refreshPageData();
    }
});

// Export classes for use by other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UnifiedProfitManager, ProfitDetector };
}
