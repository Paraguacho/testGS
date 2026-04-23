/**
 * API Interface Wrapper - Enhanced Version
 * Includes complete Polyfill support to ensure proper operation in all environments
 */

(function() {
    if (typeof globalThis.AbortController === 'undefined') {
        globalThis.AbortSignal = class AbortSignal {
            constructor() {
                this.aborted = false;
                this.reason = undefined;
                this._listeners = [];
            }
            
            addEventListener(type, listener) {
                if (type === 'abort') {
                    this._listeners.push(listener);
                }
            }
            
            removeEventListener(type, listener) {
                if (type === 'abort') {
                    const index = this._listeners.indexOf(listener);
                    if (index > -1) {
                        this._listeners.splice(index, 1);
                    }
                }
            }
            
            dispatchEvent(event) {
                if (event.type === 'abort') {
                    this.aborted = true;
                    this.reason = event.reason;
                    this._listeners.forEach(listener => {
                        try {
                            listener.call(this, event);
                        } catch (e) {
                            console.error('Error in AbortSignal listener:', e);
                        }
                    });
                }
            }
            
            throwIfAborted() {
                if (this.aborted) {
                    throw new Error(this.reason || 'The operation was aborted');
                }
            }
        };
        
        globalThis.AbortController = class AbortController {
            constructor() {
                this.signal = new globalThis.AbortSignal();
            }
            
            abort(reason) {
                if (!this.signal.aborted) {
                    const event = {
                        type: 'abort',
                        reason: reason || 'The operation was aborted'
                    };
                    this.signal.dispatchEvent(event);
                }
            }
        };
    }
})();

(function() {
    if (typeof globalThis.URLSearchParams === 'undefined') {
        globalThis.URLSearchParams = class URLSearchParams {
            constructor(init) {
                this._params = new Map();
                
                if (typeof init === 'string') {
                    if (init.startsWith('?')) {
                        init = init.slice(1);
                    }
                    if (init) {
                        init.split('&').forEach(pair => {
                            const [key, value = ''] = pair.split('=');
                            if (key) {
                                this._params.set(
                                    decodeURIComponent(key),
                                    decodeURIComponent(value)
                                );
                            }
                        });
                    }
                } else if (init && typeof init === 'object') {
                    for (const key in init) {
                        if (init.hasOwnProperty(key)) {
                            this.append(key, init[key]);
                        }
                    }
                }
            }
            
            append(name, value) {
                const key = String(name);
                const val = String(value);
                if (this._params.has(key)) {
                    const existing = this._params.get(key);
                    this._params.set(key, existing + ',' + val);
                } else {
                    this._params.set(key, val);
                }
            }
            
            delete(name) {
                this._params.delete(String(name));
            }
            
            get(name) {
                const value = this._params.get(String(name));
                return value === undefined ? null : value;
            }
            
            getAll(name) {
                const value = this._params.get(String(name));
                return value === undefined ? [] : value.split(',');
            }
            
            has(name) {
                return this._params.has(String(name));
            }
            
            set(name, value) {
                this._params.set(String(name), String(value));
            }
            
            toString() {
                const pairs = [];
                for (const [key, value] of this._params) {
                    if (value.includes(',')) {
                        value.split(',').forEach(v => {
                            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
                        });
                    } else {
                        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
                    }
                }
                return pairs.join('&');
            }
            
            entries() {
                return this._params.entries();
            }
            
            keys() {
                return this._params.keys();
            }
            
            values() {
                return this._params.values();
            }
            
            forEach(callback, thisArg) {
                for (const [key, value] of this._params) {
                    callback.call(thisArg, value, key, this);
                }
            }
        };
    }
})();

(function() {
    if (typeof globalThis.FormData === 'undefined') {
        globalThis.FormData = class FormData {
            constructor() {
                this._data = [];
            }
            
            append(name, value, filename) {
                const entry = {
                    name: String(name),
                    value: value,
                    filename: filename
                };
                this._data.push(entry);
            }
            
            delete(name) {
                const nameStr = String(name);
                this._data = this._data.filter(entry => entry.name !== nameStr);
            }
            
            get(name) {
                const nameStr = String(name);
                const entry = this._data.find(entry => entry.name === nameStr);
                return entry ? entry.value : null;
            }
            
            getAll(name) {
                const nameStr = String(name);
                return this._data
                    .filter(entry => entry.name === nameStr)
                    .map(entry => entry.value);
            }
            
            has(name) {
                const nameStr = String(name);
                return this._data.some(entry => entry.name === nameStr);
            }
            
            set(name, value, filename) {
                this.delete(name);
                this.append(name, value, filename);
            }
            
            entries() {
                return this._data.map(entry => [entry.name, entry.value])[Symbol.iterator]();
            }
            
            keys() {
                return this._data.map(entry => entry.name)[Symbol.iterator]();
            }
            
            values() {
                return this._data.map(entry => entry.value)[Symbol.iterator]();
            }
            
            forEach(callback, thisArg) {
                this._data.forEach(entry => {
                    callback.call(thisArg, entry.value, entry.name, this);
                });
            }
        };
    }
})();

(function() {
    if (typeof globalThis.fetch === 'undefined') {
        globalThis.fetch = function(url, options = {}) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const method = options.method || 'GET';
                
                xhr.open(method, url, true);
                
                if (options.headers) {
                    for (const key in options.headers) {
                        if (options.headers.hasOwnProperty(key)) {
                            xhr.setRequestHeader(key, options.headers[key]);
                        }
                    }
                }
                
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        xhr.abort();
                        reject(new Error('The operation was aborted'));
                    });
                }
                
                xhr.onload = function() {
                    const response = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: {
                            get: function(name) {
                                return xhr.getResponseHeader(name);
                            }
                        },
                        json: function() {
                            return Promise.resolve(JSON.parse(xhr.responseText));
                        },
                        text: function() {
                            return Promise.resolve(xhr.responseText);
                        }
                    };
                    resolve(response);
                };
                
                xhr.onerror = function() {
                    reject(new Error('Network request failed'));
                };
                
                xhr.ontimeout = function() {
                    reject(new Error('Network request timeout'));
                };
                
                if (options.body) {
                    xhr.send(options.body);
                } else {
                    xhr.send();
                }
            });
        };
    }
})();

(function() {
    if (typeof globalThis.Map === 'undefined') {
        globalThis.Map = function() {
            this._keys = [];
            this._values = [];
            this.size = 0;
        };
        
        globalThis.Map.prototype.set = function(key, value) {
            const index = this._keys.indexOf(key);
            if (index > -1) {
                this._values[index] = value;
            } else {
                this._keys.push(key);
                this._values.push(value);
                this.size++;
            }
            return this;
        };
        
        globalThis.Map.prototype.get = function(key) {
            const index = this._keys.indexOf(key);
            return index > -1 ? this._values[index] : undefined;
        };
        
        globalThis.Map.prototype.has = function(key) {
            return this._keys.indexOf(key) > -1;
        };
        
        globalThis.Map.prototype.delete = function(key) {
            const index = this._keys.indexOf(key);
            if (index > -1) {
                this._keys.splice(index, 1);
                this._values.splice(index, 1);
                this.size--;
                return true;
            }
            return false;
        };
        
        globalThis.Map.prototype.entries = function() {
            const entries = [];
            for (let i = 0; i < this._keys.length; i++) {
                entries.push([this._keys[i], this._values[i]]);
            }
            return entries[Symbol.iterator]();
        };
        
        globalThis.Map.prototype.keys = function() {
            return this._keys[Symbol.iterator]();
        };
        
        globalThis.Map.prototype.values = function() {
            return this._values[Symbol.iterator]();
        };
        
        globalThis.Map.prototype.forEach = function(callback, thisArg) {
            for (let i = 0; i < this._keys.length; i++) {
                callback.call(thisArg, this._values[i], this._keys[i], this);
            }
        };
    }
})();

/**
 * API Interface Wrapper
 */

function getBaseURL() {
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;
    
    //     // if (currentHost.includes('ceshi.cc')) {
    //     // In external server mode, try using localhost:8000
    //     return 'http://localhost:8000';
    // }
    
    // If accessing via localhost, use current protocol and host
    return currentProtocol + '//' + currentHost;
}

const BASE_URL = getBaseURL();

// Request timeout (milliseconds) - Optimized for faster response
const TIMEOUT = 8000; // Default 8 seconds
const TIMEOUT_REGISTER = 5000; // Registration operation 5 seconds
const TIMEOUT_LOGIN = 5000; // Login operation 5 seconds

/**
 * Wrapped request function
 * @param {string} url - Request URL
 * @param {string} method - Request method
 * @param {object} data - Request data
 * @param {boolean} needToken - Whether token is required
 * @returns {Promise} Promise object
 */
function request(url, method = 'GET', data = null, needToken = true) {
    return new Promise((resolve, reject) => {
        // Build request options
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const token = getToken();
        if (token) {
            options.headers['token'] = token;
        } else {
            // If token is required, add to request headers
            if (needToken) {
                window.location.href = 'login.html';
                return;
            }
        }

        // Add request body
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }
        
        // Add query parameters
        if (data && method === 'GET') {
            const params = new URLSearchParams();
            for (const key in data) {
                if (data[key] !== undefined && data[key] !== null) {
                    params.append(key, data[key]);
                }
            }
            const queryString = params.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }
        
        // Set different timeout based on URL
        let timeoutDuration = TIMEOUT;
        if (url.includes('/api/user/register')) {
            timeoutDuration = TIMEOUT_REGISTER;
        } else if (url.includes('/api/user/login')) {
            timeoutDuration = TIMEOUT_LOGIN;
        }
        
        // Set request timeout
        const controller = new AbortController();
        options.signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        console.log('Network request ' + method + '[' + BASE_URL + url + ']', data)
        console.log('Request options:', options)
        
        // Record API call time (for intelligent activity detection)
        if (window.deviceSessionManager && typeof window.deviceSessionManager.recordApiCall === 'function') {
            window.deviceSessionManager.recordApiCall();
        }

        fetch(BASE_URL + url, options)
            .then(response => {
                clearTimeout(timeoutId);
                
                // Handle unauthorized status (token expired) - Simplified handling
                if (response.status === 401) {
                    console.log('[API] Token invalid, redirecting to login');
                    
                    // Clear token and redirect (only when truly invalid)
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_token');
                    if (typeof sessionStorage !== 'undefined') {
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('user_token');
                    }
                    
                    // Redirect to login page
                    window.location.href = 'login.html';
                    return null;
                }
                
                // Parse JSON response
                return response.json();
            })
            .then(result => {
                console.log('Network request ' + method + '[' + BASE_URL + url + '] success', result)
                if (!result) {
                    console.log('Response is empty');
                    reject({
                        code: -1,
                        message: 'Server response is empty'
                    });
                    return;
                }
                
                // Check if result is a valid JSON object
                if (typeof result !== 'object') {
                    console.log('Response is not a valid JSON object:', result);
                    reject({
                        code: -1,
                        message: 'Invalid server response format'
                    });
                    return;
                }
                
                // Handle API returned errors
                if (result.code !== 1) {
                    // Check for redirect flag (usually indicates need to re-login)
                    if (result.redirect) {
                        // Immediately clear token and redirect for fast response
                        console.log('[API] Detected redirect needed, token expired, immediately redirect to login page');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user_token');
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.removeItem('token');
                            sessionStorage.removeItem('user_token');
                        }
                        window.location.href = result.redirect || 'login.html';
                        return;
                    }
                    
                    // For login and register interface errors, don't redirect, return error directly
                    if (url.includes('/api/user/login') || url.includes('/api/user/register')) {
                        reject({
                            code: result.code,
                            message: result.msg || 'Server error'
                        });
                        return;
                    }
                    
                    // For other authenticated interfaces, if 401 error, handle redirect
                    if (result.code === 401) {
                        // Immediately clear token and redirect for fast response
                        console.log('[API] Detected 401 authentication failed, token expired, possibly logged in on another device');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user_token');
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.removeItem('token');
                            sessionStorage.removeItem('user_token');
                        }
                        
                        // Notify device session manager that token is invalid
                        if (window.deviceSessionManager && typeof window.deviceSessionManager.forceCheckTokenChange === 'function') {
                            window.deviceSessionManager.forceCheckTokenChange();
                        }
                        
                        window.location.href = 'login.html';
                        return;
                    }
                    
                    reject({
                        code: result.code,
                        message: result.msg || 'Server error'
                    });
                    return;
                }
                
                // Successfully return data
                resolve(result.data || {});
            })
            .catch(error => {
                console.log('Network request ' + method + '[' + BASE_URL + url + '] error', error)
                clearTimeout(timeoutId);
                
                if (error.name === 'AbortError') {
                    console.log('Request timeout');
                    reject({
                        code: -1,
                        message: 'Request timeout, please check network connection'
                    });
                    return;
                }
                
                // Handle network connection errors
                if (error.message && (error.message.includes('Failed to fetch') || 
                    error.message.includes('Network Error') || 
                    error.message.includes('ERR_CONNECTION_REFUSED'))) {
                    console.log('Network connection failed');
                    reject({
                        code: -1,
                        message: 'Network connection failed, please check if server is running'
                    });
                    return;
                }
                
                // Handle other errors
                reject({
                    code: -1,
                    message: error.message || 'Network error'
                });
            });
    });
}

/**
 * GET request
 * @param {string} url - Request URL
 * @param {object} params - Request parameters
 * @param {boolean} needToken - Whether token is required
 * @returns {Promise} Promise object
 */
function get(url, params = null, needToken = true) {
    return request(url, 'GET', params, needToken);
}

/**
 * POST request
 * @param {string} url - Request URL
 * @param {object} data - Request data
 * @param {boolean} needToken - Whether token is required
 * @returns {Promise} Promise object
 */
function post(url, data = null, needToken = true) {
    return request(url, 'POST', data, needToken);
}

/**
 * PUT request
 * @param {string} url - Request URL
 * @param {object} data - Request data
 * @param {boolean} needToken - Whether token is required
 * @returns {Promise} Promise object
 */
function put(url, data = null, needToken = true) {
    return request(url, 'PUT', data, needToken);
}

/**
 * DELETE request
 * @param {string} url - Request URL
 * @param {object} data - Request data
 * @param {boolean} needToken - Whether token is required
 * @returns {Promise} Promise object
 */
function del(url, data = null, needToken = true) {
    return request(url, 'DELETE', data, needToken);
}

const RequestDuplicateManager = {
    pendingRequests: new Map(),
    
    generateRequestKey(url, method, data) {
        const dataStr = data ? JSON.stringify(data) : '';
        return `${method}:${url}:${dataStr}`;
    },
    
    isDuplicateRequest(url, method, data) {
        const key = this.generateRequestKey(url, method, data);
        return this.pendingRequests.has(key);
    },
    
    addPendingRequest(url, method, data) {
        const key = this.generateRequestKey(url, method, data);
        const timestamp = Date.now();
        this.pendingRequests.set(key, timestamp);
        
        setTimeout(() => {
            this.removePendingRequest(url, method, data);
        }, 30000);
        
        return key;
    },
    
    removePendingRequest(url, method, data) {
        const key = this.generateRequestKey(url, method, data);
        this.pendingRequests.delete(key);
    },
    
    clearAllPendingRequests() {
        this.pendingRequests.clear();
    }
};

const WithdrawLockManager = {
    isWithdrawing: false,
    lastWithdrawTime: 0,
    minInterval: 3000,
    
    canWithdraw() {
        const now = Date.now();
        if (this.isWithdrawing) {
            console.log('Withdrawal request in progress, rejecting duplicate request');
            return false;
        }
        
        if (now - this.lastWithdrawTime < this.minInterval) {
            console.log(`Withdrawal interval too short, need to wait ${Math.ceil((this.minInterval - (now - this.lastWithdrawTime)) / 1000)} seconds`);
            return false;
        }
        
        return true;
    },
    
    startWithdraw() {
        this.isWithdrawing = true;
        this.lastWithdrawTime = Date.now();
    },
    
    endWithdraw() {
        this.isWithdrawing = false;
    },
    
    reset() {
        this.isWithdrawing = false;
        this.lastWithdrawTime = 0;
    }
};

const BalanceCache = {
    cache: {
        balance: null,
        timestamp: 0,
        version: 0
    },
    
    CACHE_DURATIONS: {
        recharge_balance: 2 * 1000,
        withdraw_balance: 2 * 1000,
        default: 2 * 1000
    },
    
    BALANCE_CHANGE_EVENTS: {
        recharge_balance: [
            'recharge_success',
            'invest_success'
        ],
        withdraw_balance: [
            'profit_received',
            'commission_received',
            'withdraw_success',
            'withdraw_failed',
            'recharge_bonus'
        ],
        all: [
            'balance_manual_adjust'
        ]
    },
    
    init() {
        this.BALANCE_CHANGE_EVENTS.recharge_balance.forEach(event => {
            document.addEventListener(event, () => {
                this.invalidate();
            });
        });
        
        this.BALANCE_CHANGE_EVENTS.withdraw_balance.forEach(event => {
            document.addEventListener(event, () => {
                this.invalidate();
            });
        });
        
        this.BALANCE_CHANGE_EVENTS.all.forEach(event => {
            document.addEventListener(event, () => {
                this.invalidate();
            });
        });
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                if (this.shouldRefreshOnVisible()) {
                    this.invalidate();
                }
                setTimeout(() => {
                    this.checkForCommissionUpdate();
                }, 1000);
            }
        });
        
        this.restoreFromStorage();
    },
    
    isValid(balanceType = 'default') {
        if (!this.cache.balance) return false;
        const age = Date.now() - this.cache.timestamp;
        const duration = this.CACHE_DURATIONS[balanceType] || this.CACHE_DURATIONS.default;
        return age < duration;
    },
    
    shouldRefresh(balanceType = 'withdraw_balance') {
        if (!this.cache.balance) return true;
        const age = Date.now() - this.cache.timestamp;
        const duration = this.CACHE_DURATIONS[balanceType] || this.CACHE_DURATIONS.default;
        return age >= duration;
    },
    
    set(balance) {
        this.cache = {
            balance: balance,
            timestamp: Date.now(),
            version: this.cache.version + 1
        };
        
        try {
            localStorage.setItem('balance_cache', JSON.stringify({
                ...this.cache,
                expiry: Date.now() + (2 * 1000)
            }));
        } catch (e) {
            console.warn('余额缓存存储失败:', e);
        }
    },
    
    get() {
        return this.cache.balance;
    },
    
    invalidate() {
        this.cache.balance = null;
        this.cache.timestamp = 0;
        try {
            localStorage.removeItem('balance_cache');
        } catch (e) {
            console.warn('清除余额缓存失败:', e);
        }
    },
    
    restoreFromStorage() {
        try {
            const stored = localStorage.getItem('balance_cache');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.expiry && Date.now() < data.expiry) {
                    this.cache = {
                        balance: data.balance,
                        timestamp: data.timestamp,
                        version: data.version || 0
                    };
                }
            }
        } catch (e) {
            console.warn('恢复余额缓存失败:', e);
        }
    },
    
    shouldRefreshOnVisible() {
        const age = Date.now() - this.cache.timestamp;
        return age > (2 * 1000);
    },
    
    triggerChangeEvent(eventType, data = {}) {
        const event = new CustomEvent(eventType, { detail: data });
        document.dispatchEvent(event);
    },
    
    setupGlobalBalanceListener() {
        document.addEventListener('profit_received', () => {
            this.refreshAllBalanceDisplays();
        });
        
        document.addEventListener('commission_received', () => {
            this.refreshAllBalanceDisplays();
        });
        
        document.addEventListener('withdraw_success', () => {
            this.refreshAllBalanceDisplays();
        });
        
        document.addEventListener('withdraw_failed', () => {
            this.refreshAllBalanceDisplays();
        });
        
        document.addEventListener('recharge_success', () => {
            setTimeout(() => {
                this.checkForCommissionUpdate();
            }, 2000);
        });
    },
    
    async checkForCommissionUpdate() {
        try {
            const currentBalance = this.cache.balance ? this.cache.balance.withdraw_balance : 0;
            const newBalance = await API.user.getBalance(true);
            
            if (newBalance.withdraw_balance > currentBalance) {
                this.triggerChangeEvent('commission_received', {
                    increase: newBalance.withdraw_balance - currentBalance
                });
            }
        } catch (error) {
            console.warn('佣金检测失败:', error);
        }
    },
    
    async refreshAllBalanceDisplays() {
        try {
            const balance = await API.user.getBalance(true);
            
            const balanceElements = [
                { id: 'headerBalance', field: 'recharge_balance' },
                { id: 'withdrawBalance', field: 'withdraw_balance' },
                { id: 'currentBalance', field: 'recharge_balance' }
            ];
            
            balanceElements.forEach(({ id, field }) => {
                const element = document.getElementById(id);
                if (element && balance[field] !== undefined) {
                    const amount = parseFloat(balance[field]) || 0;
                    const formattedAmount = Math.floor(amount).toLocaleString('id-ID');
                    element.textContent = `Rp${formattedAmount}`;
                }
            });
        } catch (error) {
            console.warn('全局余额刷新失败:', error);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BalanceCache.init();
    BalanceCache.setupGlobalBalanceListener();
});

const API = {
    request: request,
    
    requestFull: function(url, method = 'GET', data = null, needToken = true) {
        return new Promise((resolve, reject) => {
            // Build request options
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // If token is required, add to request headers
            if (needToken) {
                const token = localStorage.getItem('token');
                if (token) {
                    options.headers['token'] = token;
                } else {
                    window.location.href = 'login.html';
                    return;
                }
            }
            
            // Add request body
            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(data);
            }
            
            // Add query parameters
            if (data && method === 'GET') {
                const params = new URLSearchParams();
                for (const key in data) {
                    if (data[key] !== undefined && data[key] !== null) {
                        params.append(key, data[key]);
                    }
                }
                const queryString = params.toString();
                if (queryString) {
                    url += (url.includes('?') ? '&' : '?') + queryString;
                }
            }
            
            const timestampedUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
            
            fetch(BASE_URL + timestampedUrl, options)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.status);
                    }
                    return response.json();
                })
                .then(result => {
                    resolve(result);
                })
                .catch(error => {
                    console.error('API request error:', error);
                    reject({
                        code: -1,
                        message: error.message || 'Network error'
                    });
                });
        });
    },
    
    user: {
        login(params) {
            return this.loginWithRetry(params, 2);
        },
        
        register(params) {
            return this.registerWithRetry(params, 2);
        },
        
        async loginWithRetry(params, maxRetries = 2) {
            console.log('Starting login attempt, params:', params);
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Login attempt ${attempt + 1}/${maxRetries + 1}`);
                    const result = await post('/api/user/login', params, false);
                    console.log('Login successful:', result);
                    return result;
                } catch (error) {
                    console.log(`Login attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
                    
                    if (attempt === maxRetries) {
                        console.log('All login attempts failed, throwing final error:', error);
                        throw error;
                    }
                    
                    if (error.code === -1) {
                        console.log('Network error, will retry...');
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        continue;
                    } else {
                        console.log('Business logic error, throwing directly:', error);
                        throw error;
                    }
                }
            }
        },
        
        async registerWithRetry(params, maxRetries = 2) {
            console.log('Starting registration attempt, params:', params);
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Registration attempt ${attempt + 1}/${maxRetries + 1}`);
                    const result = await post('/api/user/register', params, false);
                    console.log('Registration successful:', result);
                    return result;
                } catch (error) {
                    console.log(`Registration attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
                    
                    if (attempt === maxRetries) {
                        console.log('All registration attempts failed, throwing final error:', error);
                        throw error;
                    }
                    
                    if (error.code === -1 || 
                        (error.message && error.message.includes('try again'))) {
                        console.log('Network error or server error, will retry...');
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        continue;
                    } else {
                        console.log('Business logic error, throwing directly:', error);
                        throw error;
                    }
                }
            }
        },
        
        getInfo() {
            return get('/api/user/info');
        },
        
        getBalance(forceRefresh = false, preferredType = 'withdraw_balance') {
            if (!forceRefresh) {
                if (preferredType === 'recharge_balance' && BalanceCache.isValid('recharge_balance')) {
                    return Promise.resolve(BalanceCache.get());
                }
                if (preferredType === 'withdraw_balance' && BalanceCache.isValid('withdraw_balance')) {
                    return Promise.resolve(BalanceCache.get());
                }
                if (BalanceCache.isValid('default')) {
                    return Promise.resolve(BalanceCache.get());
                }
            }
            
            return get('/api/user/balance').then(balance => {
                if (balance.profit_updated) {
                    BalanceCache.triggerChangeEvent('profit_received', {
                        message: balance.message || '收益已更新'
                    });
                }
                
                BalanceCache.set(balance);
                return balance;
            }).catch(error => {
                if (BalanceCache.get()) {
                    console.warn('余额API调用失败，使用缓存数据:', error);
                    return BalanceCache.get();
                }
                throw error;
            });
        },
        
        refreshBalance() {
            return this.getBalance(true);
        },
        
        changePassword(params) {
            return post('/api/user/change-password', params);
        },
        
        setTradePassword(params) {
            return post('/api/user/set-trade-password', params);
        },
        
        resetTradePassword(params) {
            return post('/api/user/reset-trade-password', params);
        },
        
        logout() {
            return post('/api/user/logout');
        },
        
        verifyInviteCode(code) {
            return post('/api/user/verify-invite-code', { invite_code: code }, false);
        }
    },
    
    bank: {
        getList() {
            return get('/api/bank/list', null, false);
        },
        
        getValidationConfig() {
            return get('/api/system/config/bank_account_validation');
        },
        
        bind(params) {
            return post('/api/bank/bind', params);
        },
        
        getBound() {
            return get('/api/bank/bound');
        },
        
        unbind(cardId) {
            return post('/api/bank/unbind', { card_id: cardId });
        }
    },
    
    recharge: {
        getOptions() {
            return get('/api/recharge/options');
        },
        
        create(params) {
            return post('/api/recharge/create', params);
        },
        
        confirm(params) {
            return post('/api/recharge/confirm', params);
        },
        
        getRecords(params) {
            return get('/api/recharge/records', params);
        },
        
        getBalance() {
            return get('/api/recharge/balance');
        },
        
        uploadVoucher(orderId, file) {
            const formData = new FormData();
            formData.append('order_id', orderId);
            formData.append('voucher', file);
            
            return fetch(BASE_URL + '/api/recharge/upload', {
                method: 'POST',
                headers: {
                    'token': getToken()
                },
                body: formData
            }).then(response => response.json());
        }
    },
    
    payment: {
        createOrder(params) {
            return post('/api/payment/create-order', params);
        },
        
        queryStatus(orderNo) {
            return get(`/api/payment/query-status/${orderNo}`);
        },
        
        simulateCallback(params) {
            return post('/api/payment/simulate-callback', params);
        },
        
        handleTimeout() {
            return post('/api/payment/handle-timeout');
        }
    },
    
    withdraw: {
        getConfig() {
            return get('/api/withdraw/status');
        },
        
        getStatus() {
            return get('/api/withdraw/status');
        },
        
        submit(params) {
            return new Promise((resolve, reject) => {
                if (!WithdrawLockManager.canWithdraw()) {
                    const now = Date.now();
                    const remainingTime = Math.ceil((WithdrawLockManager.minInterval - (now - WithdrawLockManager.lastWithdrawTime)) / 1000);
                    reject({
                        code: -1,
                        message: WithdrawLockManager.isWithdrawing ? 
                            'Withdrawal request is being processed, please do not submit repeatedly' : 
                            `Please wait ${remainingTime} seconds before withdrawing again`
                    });
                    return;
                }
                
                const url = '/api/withdraw/create';
                const method = 'POST';
                if (RequestDuplicateManager.isDuplicateRequest(url, method, params)) {
                    console.log('Detected duplicate withdrawal request, rejected');
                    reject({
                        code: -1,
                        message: 'Duplicate request detected, please do not click the withdrawal button repeatedly'
                    });
                    return;
                }
                
                WithdrawLockManager.startWithdraw();
                const requestKey = RequestDuplicateManager.addPendingRequest(url, method, params);
                
                console.log('Withdrawal request started, duplicate submission locked', {
                    params,
                    requestKey,
                    timestamp: new Date().toISOString()
                });
                
                post('/api/withdraw/create', params)
                    .then(result => {
                        console.log('Withdrawal request successful', result);
                        resolve(result);
                    })
                    .catch(error => {
                        console.log('Withdrawal request failed', error);
                        reject(error);
                    })
                    .finally(() => {
                        WithdrawLockManager.endWithdraw();
                        RequestDuplicateManager.removePendingRequest(url, method, params);
                        console.log('Withdrawal request ended, unlocked');
                    });
            });
        },
        
        getRecords(params) {
            return get('/api/withdraw/records', params);
        },
        
        getAvailableBalance() {
            return get('/api/withdraw/available-balance');
        },
        
        getBankCard() {
            return get('/api/bank/bound');
        },
        
        queryStatus(orderNo) {
            return get(`/api/withdraw/query-status/${orderNo}`);
        },
        
        simulateCallback(params) {
            return post('/api/withdraw/simulate-callback', params);
        }
    },
    
    product: {
        getList(params) {
            return get('/api/invest/products', params);
        },
        
        getDetail(id) {
            return get(`/api/invest/product/${id}`);
        },
        
        invest(params) {
            return post('/api/invest/create', params);
        },
        
        getMyInvests(params) {
            return get('/api/invest/records', params);
        },
        
        getProfits(params) {
            return get('/api/invest/profits', params);
        },
        
        checkBalance(productId) {
            return post('/api/invest/check-balance', { product_id: productId });
        }
    },
    
    invest: {
        getList(params) {
            return get('/api/invest/products', params);
        },
        
        getDetail(id) {
            return get(`/api/invest/product/${id}`);
        },
        
        create(params) {
            return post('/api/invest/create', params);
        },
        
        getRecords(params) {
            return get('/api/invest/records', params);
        },
        
        getProfits(params) {
            return get('/api/invest/profits', params);
        },
        
        checkBalance(productId) {
            return post('/api/invest/check-balance', { product_id: productId });
        },
        
        checkInvested(productId) {
            return post('/api/invest/check-invested', { product_id: productId });
        },
        
        getConfig() {
            return get('/api/invest/config');
        }
    },
    
    team: {
        getCompleteData() {
            return get('/api/team/complete-data');
        },
        
        getData() {
            return get('/api/team/data');
        },
        
        getRealtimeData() {
            return get('/api/team/realtime-data');
        },
        
        getLevelData(params) {
            return get('/api/team/level-data', params);
        },
        
        getCommissions(params) {
            return get('/api/team/commissions', params);
        }
    },
    
    invite: {
        getData() {
            return get('/api/team/invite-data');
        },
        
        getCode() {
            return get('/api/user/invite-code');
        },
        
        getRecords(params) {
            return get('/api/team/invite-records', params);
        },
        
        getCommissions(params) {
            return get('/api/team/commissions', params);
        },
        
        getTasks() {
            return get('/api/team/tasks');
        },
        
        checkTaskCompletion() {
            return post('/api/team/check-task-completion');
        }
    },
    
    redemption: {
        useCode(code) {
            return API.requestFull('/api/redemption/use-code', 'POST', { code });
        },
        
        getStatus() {
            return API.requestFull('/api/redemption/status', 'GET', null);
        }
    },
    
    system: {
        getBanners() {
            return get('/api/system/banners');
        },
        
        getConfig(group = 'basic') {
            return get('/api/system/config', { group });
        },
        
        getServerTime() {
            return get('/api/system/server-time');
        }
    }
};

window.API = API;
window.RequestDuplicateManager = RequestDuplicateManager;
window.WithdrawLockManager = WithdrawLockManager; 