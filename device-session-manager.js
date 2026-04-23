/**
 * Device Session Manager - Handle multi-device login detection
 * Automatically redirect old devices to login page when user logs in on new device
 */

class DeviceSessionManager {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 60000,
            verifyTokenEndpoint: options.verifyTokenEndpoint || '/api/user/verify-token', // 已禁用
            loginPageUrl: options.loginPageUrl || 'login.html',
            debug: options.debug || false,
            onTokenExpired: options.onTokenExpired || null,
            onError: options.onError || null
        };
        
        this.isRunning = false;
        this.intervalId = null;
        this.lastCheckTime = 0;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
        
        this.currentToken = null;
        this.currentTokenHash = null;
        this.serverRequestCount = 0;
        this.userInteractionTimer = null;
        
        this.lastServerCheck = 0;
        this.maxNoCheckInterval = options.maxNoCheckInterval || 3600000;
        this.tokenCreationTime = Date.now();
        
        this.apiCallCount = 0;
        this.lastApiCall = 0;
        this.userActivityLevel = 'normal';
        
        this.lastLocalCheck = 0;
        this.minLocalCheckInterval = 5000;
        this.lastFocusCheck = 0;
        this.minFocusCheckInterval = 30000;
        
        this.init();
    }
    
    init() {
        const token = this.getToken();
        if (!token) {
            this.log('No token, skip session check');
            return;
        }
        
        this.currentToken = token;
        this.currentTokenHash = this.generateTokenHash(token);
        this.lastServerCheck = Date.now();
        this.lastApiCall = Date.now();
        this.tokenCreationTime = Date.now();
        this.log('Initial token hash:', this.currentTokenHash);
        
        this.startTokenChangeDetection();
        
        this.addEventListenerSafe(window, 'storage', (e) => {
            if (e.key === 'token' || e.key === 'user_token') {
                this.log('Detected token change in storage, handle immediately');
                
                if (!e.newValue) {
                    this.log('Token deleted, possibly logged in on another device, redirect immediately');
                    this.redirectToLogin();
                } else {
                    this.handleTokenChange();
                }
            }
        });
        
        this.addEventListenerSafe(window, 'focus', () => {
            const now = Date.now();
            if (now - this.lastFocusCheck < this.minFocusCheckInterval) {
                this.log('Focus check throttled, skipping');
                return;
            }
            this.lastFocusCheck = now;
            this.log('Page gained focus, check if token changed');
            this.checkTokenChangeLocal();
        });
        
        this.addEventListenerSafe(document, 'visibilitychange', () => {
            if (!document.hidden) {
                const now = Date.now();
                if (now - this.lastFocusCheck < this.minFocusCheckInterval) {
                    this.log('Visibility check throttled, skipping');
                    return;
                }
                this.lastFocusCheck = now;
                this.log('Page became visible, check if token changed');
                this.checkTokenChangeLocal();
            }
        });
        
        this.log('Device session manager initialized - using token change detection strategy');
    }
    
    startTokenChangeDetection() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        try {
            this.intervalId = setInterval(() => {
                this.checkTokenChange();
            }, this.options.checkInterval);
            
            this.isRunning = true;
            this.log(`Token change detection started, interval: ${this.options.checkInterval}ms (local check only)`);
        } catch (error) {
            this.log('Failed to start token change detection:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }
    
    stopTokenChangeDetection() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.log('Token change detection stopped');
    }
    
    checkTokenChangeLocal() {
        const currentToken = this.getToken();
        
        if (!currentToken) {
            this.log('Token has been deleted, redirecting to login page');
            this.redirectToLogin();
            return;
        }
        
        const currentTokenHash = this.generateTokenHash(currentToken);
        
        if (this.currentTokenHash !== currentTokenHash) {
            this.log(`Token change detected! Old hash: ${this.currentTokenHash}, New hash: ${currentTokenHash}`);
            this.handleTokenChange();
            return;
        }
        
        this.log('Local token check: no change detected');
    }
    
    checkTokenChange() {
        const now = Date.now();
        
        if (now - this.lastLocalCheck < this.minLocalCheckInterval) {
            return;
        }
        this.lastLocalCheck = now;
        
        const currentToken = this.getToken();
        
        if (!currentToken) {
            this.log('Token has been deleted, redirecting to login page');
            this.redirectToLogin();
            return;
        }
        
        const currentTokenHash = this.generateTokenHash(currentToken);
        
        if (this.currentTokenHash !== currentTokenHash) {
            this.log(`Token change detected! Old hash: ${this.currentTokenHash}, New hash: ${currentTokenHash}`);
            this.handleTokenChange();
            return;
        }
        
        const timeSinceLastCheck = now - this.lastServerCheck;
        const timeSinceLastApi = now - this.lastApiCall;
        
        this.updateUserActivityLevel(timeSinceLastApi);
        
        const dynamicCheckInterval = this.getDynamicCheckInterval();
        
        if (timeSinceLastCheck > dynamicCheckInterval) {
            this.log(`User activity level: ${this.userActivityLevel}, Dynamic check interval: ${Math.round(dynamicCheckInterval/60000)} minutes`);
            this.log(`Time since last server verification exceeded limit, performing session expiry check`);
            this.handleSessionExpiryCheck();
            return;
        }
    }
    
    async handleTokenChange() {
        const newToken = this.getToken();
        
        if (!newToken) {
            this.log('New token is empty, redirecting to login page');
            this.redirectToLogin();
            return;
        }
        
        this.log('Token has changed, performing server verification...');
        this.serverRequestCount++;
        
        try {
            const isValid = await this.verifyTokenWithServer(newToken);
            
            this.lastServerCheck = Date.now();
            
            if (isValid) {
                this.currentToken = newToken;
                this.currentTokenHash = this.generateTokenHash(newToken);
                this.consecutiveFailures = 0;
                this.log(`Token changed and valid, local record updated. Total server requests: ${this.serverRequestCount}`);
            } else {
                this.log('Token is invalid, possibly replaced by login from another device');
                this.handleTokenExpired();
            }
            
        } catch (error) {
            this.log('Token server verification failed:', error);
            
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.log(`${this.consecutiveFailures} consecutive verification failures, considering token invalid`);
                this.handleTokenExpired();
            }
            
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }
    
    async handleSessionExpiryCheck() {
        const currentToken = this.getToken();
        
        if (!currentToken) {
            this.log('Session expiry check: token is empty, redirecting to login page');
            this.redirectToLogin();
            return;
        }
        
        this.log('Performing session expiry check...');
        this.serverRequestCount++;
        
        try {
            const isValid = await this.verifyTokenWithServer(currentToken);
            
            this.lastServerCheck = Date.now();
            
            if (isValid) {
                this.consecutiveFailures = 0;
                this.log(`Session expiry check passed, token is still valid. Total server requests: ${this.serverRequestCount}`);
            } else {
                this.log('Session expiry check: token has expired');
                this.handleTokenExpired();
            }
            
        } catch (error) {
            this.log('Session expiry check failed:', error);
            
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.log(`${this.consecutiveFailures} consecutive verification failures, considering session expired`);
                this.handleTokenExpired();
            }
            
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }
    
    updateUserActivityLevel(timeSinceLastApi) {
        const oneHour = 3600000;
        const thirtyMinutes = 1800000;
        const fiveMinutes = 300000;
        
        if (timeSinceLastApi < fiveMinutes) {
            this.userActivityLevel = 'high';
        } else if (timeSinceLastApi < thirtyMinutes) {
            this.userActivityLevel = 'normal';
        } else {
            this.userActivityLevel = 'low';
        }
    }
    
    getDynamicCheckInterval() {
        switch (this.userActivityLevel) {
            case 'high':
                return 300000;
            case 'normal':
                return 900000;
            case 'low':
                return 1800000;
            default:
                return this.maxNoCheckInterval;
        }
    }
    
    recordApiCall() {
        this.lastApiCall = Date.now();
        this.apiCallCount++;
    }
    
    generateTokenHash(token) {
        if (!token) return null;
        
        let hash = 0;
        for (let i = 0; i < token.length; i++) {
            const char = token.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    
    async verifyTokenWithServer(token) {
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            }
        };
        
        const response = window.CommonUtils && window.CommonUtils.createTimeoutFetch 
            ? await window.CommonUtils.createTimeoutFetch(this.options.verifyTokenEndpoint, requestOptions)
            : await fetch(this.options.verifyTokenEndpoint, requestOptions);
        
        const data = await response.json();
        
        return response.status === 200 && data.code === 1;
    }
    
    handleTokenExpired() {
        this.log('Handling token expiration, preparing to redirect to login page');
        
        this.clearToken();
        
        this.stopTokenChangeDetection();
        
        if (this.options.onTokenExpired) {
            this.options.onTokenExpired();
        }
        
        this.redirectToLogin();
    }
    
    redirectToLogin() {
        try {
            this.log('Silently redirecting to login page');
            
            window.location.href = this.options.loginPageUrl;
        } catch (error) {
            this.log('Failed to redirect to login page:', error);
            window.location.reload();
        }
    }
    
    getToken() {
        if (typeof window.getToken === 'function') {
            return window.getToken();
        }
        
        if (window.CommonUtils && window.CommonUtils.getToken) {
            return window.CommonUtils.getToken();
        }
        
        if (typeof window.getToken === 'undefined') {
            console.warn('[DeviceSessionManager] getToken is undefined, possible script loading order issue');
        }
        
        try {
            let token = localStorage.getItem('token') || localStorage.getItem('user_token');
            
            if (!token && typeof sessionStorage !== 'undefined') {
                token = sessionStorage.getItem('token') || sessionStorage.getItem('user_token');
            }
            
            return token;
        } catch (error) {
            this.log('Failed to get token:', error);
            return null;
        }
    }
    
    clearToken() {
        try {
            this.log('Token is invalid, clearing local token and redirecting to login page');
            
            localStorage.removeItem('token');
            localStorage.removeItem('user_token');
            
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user_token');
            }
            
            this.log('Token cleared, other user cache data preserved');
        } catch (error) {
            this.log('Error occurred while clearing token:', error);
        }
    }
    
    addEventListenerSafe(element, event, handler) {
        try {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, handler);
            }
        } catch (error) {
            this.log('Failed to add event listener:', event, error);
        }
    }
    
    log(...args) {
        if (this.options.debug) {
            console.log('[DeviceSessionManager]', ...args);
        }
    }
    
    forceCheckTokenChange() {
        this.log('External trigger for token change check (possibly due to API call failure)');
        
        const currentToken = this.getToken();
        if (currentToken) {
            this.log('Force server verification to confirm token status');
            this.handleSessionExpiryCheck();
        } else {
            this.log('Token has been cleared, redirect to login page directly');
            this.redirectToLogin();
        }
    }
    
    getServerRequestCount() {
        return this.serverRequestCount;
    }
    
    getUserActivityStats() {
        const now = Date.now();
        return {
            activityLevel: this.userActivityLevel,
            apiCallCount: this.apiCallCount,
            timeSinceLastApi: Math.round((now - this.lastApiCall) / 1000),
            timeSinceLastServerCheck: Math.round((now - this.lastServerCheck) / 1000),
            nextCheckIn: Math.round((this.getDynamicCheckInterval() - (now - this.lastServerCheck)) / 1000),
            serverRequestCount: this.serverRequestCount
        };
    }
    
    destroy() {
        this.stopTokenChangeDetection();
        
        if (this.userInteractionTimer) {
            clearTimeout(this.userInteractionTimer);
            this.userInteractionTimer = null;
        }
        
        this.log(`Device session manager destroyed - Total server requests: ${this.serverRequestCount}`);
    }
}

// DeviceSessionManager已禁用 - 使用简化的token机制
// 只有管理员修改密码时才会清除token，无需频繁检查
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Auth] Using simplified token mechanism - no automatic checks');
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceSessionManager;
}

window.DeviceSessionManager = DeviceSessionManager;