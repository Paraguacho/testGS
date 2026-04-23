/**
 * Common Function Library - Enhanced Version
 * Includes compatibility checks and enhanced error handling
 */

(function() {
    function isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    if (!isLocalStorageAvailable()) {
        console.warn('localStorage not available, using memory storage as fallback');
        const memoryStorage = {};
        
        window.localStorage = {
            getItem: function(key) {
                return memoryStorage[key] || null;
            },
            setItem: function(key, value) {
                memoryStorage[key] = String(value);
            },
            removeItem: function(key) {
                delete memoryStorage[key];
            },
            clear: function() {
                for (const key in memoryStorage) {
                    delete memoryStorage[key];
                }
            }
        };
    }
    
    if (typeof JSON === 'undefined') {
        console.error('JSON not supported, some features may not work properly');
    }
    
    if (typeof console === 'undefined') {
        window.console = {
            log: function() {},
            error: function() {},
            warn: function() {},
            info: function() {}
        };
    }
})();

function getToken() {
    try {
        let token = localStorage.getItem('token') || localStorage.getItem('user_token');
        
        if (!token && typeof sessionStorage !== 'undefined') {
            token = sessionStorage.getItem('token') || sessionStorage.getItem('user_token');
        }
        
        return token;
    } catch (e) {
        console.error('Failed to get token:', e);
        return null;
    }
}

function setToken(token) {
    try {
        localStorage.setItem('token', token);
        return true;
    } catch (e) {
        console.error('Failed to set token:', e);
        return false;
    }
}

function removeToken() {
    try {
        localStorage.removeItem('token');
        return true;
    } catch (e) {
        console.error('Failed to remove token:', e);
        return false;
    }
}

function getUserInfo() {
    try {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    } catch (e) {
        console.error('Failed to get user info:', e);
        return null;
    }
}

function setUserInfo(info) {
    try {
        localStorage.setItem('userInfo', JSON.stringify(info));
        return true;
    } catch (e) {
        console.error('Failed to set user info:', e);
        return false;
    }
}

function removeUserInfo() {
    try {
        localStorage.removeItem('userInfo');
        return true;
    } catch (e) {
        console.error('Failed to remove user info:', e);
        return false;
    }
}

function logout() {
    removeToken();
    removeUserInfo();
    window.location.href = 'login.html';
}

async function checkLogin(forceServerCheck = false) {
    const token = getToken();
    if (!token) {
        console.log('[Auth] No local token, redirecting to login page');
        const currentPath = window.location.pathname.toLowerCase();
        if (!currentPath.includes('login')) {
            window.location.href = 'login.html';
        }
        return false;
    }
    
    // forceServerCheck已禁用 - 使用简化token机制
    if (forceServerCheck) {
        console.log('[Auth] Server check disabled, using simplified token mechanism');
    }
    
    return true;
}

async function checkLoginOnPageLoad() {
    const token = getToken();
    if (!token) {
        console.log('[Auth] Page load: No local token, redirecting to login page');
        const currentPath = window.location.pathname.toLowerCase();
        if (!currentPath.includes('login')) {
            window.location.href = 'login.html';
        }
        return false;
    }
    
    console.log('[Auth] Page load: Token exists, proceeding without server validation');
    return true;
}

function getUrlParam(name) {
    const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    const search = window.location.search.substr(1);
    const r = search.match(reg);
    if (r != null) return decodeURIComponent(r[2]);
    return null;
}

function formatMoney(money, decimals = 0) {
    if (money === null || money === undefined || money === '') return '0';
    
    if (typeof money === 'string' && money.includes('.')) {
        const num = parseFloat(money);
        if (isNaN(num)) return '0';
        return Math.floor(num).toString();
    }
    
    const num = parseFloat(money);
    if (isNaN(num)) return '0';
    
    return Math.floor(num).toString();
}

function formatDate(dateTime, format = 'YYYY-MM-DD HH:mm:ss') {
    if (typeof formatDateTime === 'function') {
        return formatDateTime(dateTime, format);
    }
    
    if (!dateTime) return '';
    
    let date;
    
    if (typeof dateTime === 'number' || (typeof dateTime === 'string' && /^\d+$/.test(dateTime))) {
        const timestamp = parseInt(dateTime);
        date = new Date(timestamp * 1000);
    } else if (typeof dateTime === 'string') {
        date = new Date(dateTime.replace(/-/g, '/'));
    } else {
        return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());
    
    format = format.replace('YYYY', year);
    format = format.replace('MM', month);
    format = format.replace('DD', day);
    format = format.replace('HH', hours);
    format = format.replace('mm', minutes);
    format = format.replace('ss', seconds);
    
    return format;
}

function padZero(num) {
    return num < 10 ? '0' + num : num;
}

function copyText(text, callback) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                if (callback) callback(true);
                else alert('Successfully copied');
            })
            .catch(err => {
                console.error('Copy failed:', err);
                fallbackCopy();
            });
    } else {
        fallbackCopy();
    }
    
    function fallbackCopy() {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (callback) callback(successful);
            else alert('Copy ' + (successful ? 'successful' : 'failed'));
        } catch (err) {
            console.error('Copy failed:', err);
            if (callback) callback(false);
            else alert('Copy failed');
        }
        
        document.body.removeChild(textarea);
    }
}

function maskPhone(phone) {
    if (!phone) return '';
    return phone.toString().replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function maskCardNumber(cardNumber) {
    if (!cardNumber) return '';
    return cardNumber.toString().replace(/(\d{4})\d+(\d{4})$/, '$1 **** **** $2');
}

function showLoading() {
    const loadingMask = document.getElementById('loadingMask');
    if (loadingMask) {
        loadingMask.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingMask = document.getElementById('loadingMask');
    if (loadingMask) {
        loadingMask.style.display = 'none';
    }
}

function showToast(message, type = 'error', duration = 2000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function formatCardNumber(cardNumber) {
    if (!cardNumber) return '';
    return cardNumber.replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function limitNumberInput(input) {
    input.value = input.value.replace(/\D/g, '');
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (obj instanceof Object) {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }
    
    return obj;
}

function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

function throttle(func, wait = 300) {
    let last = 0;
    return function(...args) {
        const now = Date.now();
        if (now - last > wait) {
            func.apply(this, args);
            last = now;
        }
    };
}

function goBack() {
    try {
        if (document.referrer && document.referrer !== window.location.href) {
            console.log('Go back to previous page:', document.referrer);
            window.history.back();
        } else {
            console.log('No previous page, redirect to my page');
            window.location.href = 'my.html';
        }
    } catch (error) {
        console.error('Go back failed:', error);
        window.location.href = 'my.html';
    }
}

window.utils = {
    getToken,
    setToken,
    removeToken,
    getUserInfo,
    setUserInfo,
    removeUserInfo,
    logout,
    checkLogin,
    checkLoginOnPageLoad,
    getUrlParam,
    formatMoney,
    formatDate,
    padZero,
    copyText,
    maskPhone,
    maskCardNumber,
    showLoading,
    hideLoading,
    showToast,
    formatCardNumber,
    isMobile,
    limitNumberInput,
    generateUUID,
    deepClone,
    debounce,
    throttle,
    createTimeoutFetch,
    apiRequest,
    goBack
};

window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getUserInfo = getUserInfo;
window.setUserInfo = setUserInfo;
window.removeUserInfo = removeUserInfo;
window.logout = logout;
window.checkLogin = checkLogin;
window.getUrlParam = getUrlParam;
window.goBack = goBack;


function createTimeoutFetch(url, options = {}, timeout = 10000) {
    if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        options.signal = controller.signal;
        
        setTimeout(() => controller.abort(), timeout);
    }
    
    return fetch(url, options);
}

function apiRequest(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    const token = getToken();
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    options.headers = Object.assign(defaultHeaders, options.headers || {});
    
    return createTimeoutFetch(url, options);
}



document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        const currentPath = window.location.pathname.toLowerCase();
        const isLoginPage = currentPath.includes('login') || currentPath.includes('register');
        
        if (!isLoginPage && getToken()) {
            console.log('[Auth] Page visible again, checking login status');
            checkLogin(false).catch(error => {
                console.error('[Auth] Page visibility check failed:', error);
            });
        } else if (isLoginPage) {
            console.log('[Auth] Login page visible again, skipping login status check');
        }
    }
});

window.addEventListener('focus', function() {
    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.includes('login') || currentPath.includes('register');
    
    if (!isLoginPage && getToken()) {
        console.log('[Auth] Page gained focus, checking login status');
            checkLogin(false).catch(error => {
                console.error('[Auth] Page focus check failed:', error);
            });
    } else if (isLoginPage) {
        console.log('[Auth] Login page gained focus, skipping login status check');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.includes('login') || currentPath.includes('register');
    
    if (!isLoginPage && getToken()) {
        console.log('[Auth] Page loaded, starting authentication check');
        setTimeout(() => {
            checkLoginOnPageLoad().catch(error => {
                console.error('[Auth] Page load authentication check failed:', error);
            });
        }, 100);
    } else if (isLoginPage) {
        console.log('[Auth] Login page, skipping authentication check');
    }
}); 