// ==UserScript==
// @name         微博智能转发工具
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  微博自动化工具
// @author       路过的香菜丶
// @match        *://weibo.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // ================= 增强配置系统 =================
    const CONFIG = {
        initDelay: 10 * 1000,
        refreshDelay: 15 * 1000,
        minDelay: 800,
        maxDelay: 2500,
        maxAttempts: 8,
        poolSize: 100,
        countdownColor: 'linear-gradient(135deg, #4CAF50 0%, #FFC107 50%, #F44336 100%)',
        maxCycles: 20
    };

    // ================= 全局状态管理 =================
    let isRunning = GM_getValue('autoRepostStatus', false);
    let operationTimer = null;
    let countdownInterval = null;
    let usedNumbers = GM_getValue('usedNumbers', []);
    let availableNumbers = GM_getValue('availableNumbers', initializeNumberPool());

    // ================= 核心业务模块 =================
    function initializeNumberPool() {
        const pool = Array.from({length: CONFIG.poolSize}, (_, i) => i + 1);
        shuffleArray(pool);
        return pool;
    }

    async function performRepostFlow() {
        try {

            const repostBtn = await retryableFind('.toolbar_retweet_1L_U5');
            await humanizedClick(repostBtn);

            const textarea = await retryableFind('textarea.Form_input_3JT2Q');
            const newContent = `${generateUniqueNumber()} ${textarea.value.trim()}`;
            await humanizedType(textarea, newContent);

            const confirmBtn = await retryableFind('button.Composer_btn_2XFOD:not([disabled])');
            await humanizedClick(confirmBtn);

            GM_setValue('usedNumbers', usedNumbers);
            GM_setValue('availableNumbers', availableNumbers);
        } catch (error) {
            throwError(error.message);
        }
    }

    // ================= 异常管理系统 =================
    function throwError(reason) {
        emergencyStop(`接口异常: ${reason}`);
        console.error({
            timestamp: new Date().toISOString(),
            reason
        });
    }

    // ================= UI管理系统 =================
    const CountdownManager = {
        element: null,
        progress: null,
        text: null,
        isVisible: false,

        init() {
            this.createCountdownElement();
            if (GM_getValue('countdownRemaining', 0) > 0) this.show();
        },

        createCountdownElement() {
            const container = document.createElement('div');
            container.id = 'countdown-overlay';
            Object.assign(container.style, {
                position: 'fixed',
                bottom: '80px',
                right: '30px',
                zIndex: '9998',
                width: '220px',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)',
                padding: '16px',
                transform: 'translateY(20px)',
                opacity: '0',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                backdropFilter: 'blur(8px)'
            });

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="flex-shrink: 0;">
                        <div class="countdown-dial" style="
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            background: ${CONFIG.countdownColor};
                            position: relative;
                            overflow: hidden;
                        ">
                            <div class="countdown-progress" style="
                                position: absolute;
                                top: 2px;
                                left: 2px;
                                width: calc(100% - 4px);
                                height: calc(100% - 4px);
                                background: #fff;
                                border-radius: 50%;
                                transition: transform 0.1s linear;
                            "></div>
                        </div>
                    </div>
                    <div>
                        <div style="
                            font-family: system-ui;
                            font-size: 14px;
                            color: #666;
                            margin-bottom: 4px;
                        ">
                            下次刷新剩余
                        </div>
                        <div class="countdown-text" style="
                            font-family: 'Segoe UI', monospace;
                            font-size: 18px;
                            font-weight: 600;
                            color: #333;
                            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
                        ">15.0s</div>
                    </div>
                </div>
            `;

            document.body.appendChild(container);
            this.element = container;
            this.progress = container.querySelector('.countdown-progress');
            this.text = container.querySelector('.countdown-text');

            container.addEventListener('click', () => {
                if (confirm('立即停止自动循环？')) {
                    stopOperation();
                }
            });
        },

        show() {
            if (!this.isVisible && this.element) {
                this.element.style.transform = 'translateY(0)';
                this.element.style.opacity = '1';
                this.isVisible = true;
            }
        },

        hide() {
            if (this.isVisible && this.element) {
                this.element.style.transform = 'translateY(20px)';
                this.element.style.opacity = '0';
                this.isVisible = false;
            }
        },

        update(remaining) {
            if (this.element && this.progress && this.text) {
                const progress = remaining / CONFIG.refreshDelay;
                this.progress.style.transform = `scale(${progress})`;
                this.text.textContent = `${(remaining / 1000).toFixed(1)}s`;
                const hue = 120 * progress;
                this.text.style.color = `hsl(${hue}, 70%, 40%)`;
            }
        },

    };

    function createControlButton() {
        const btn = document.createElement('button');
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: '9999',
            padding: '12px 24px',
            background: isRunning ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontSize: '14px',
            fontWeight: '500'
        });

        btn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
                <span class="status-led" style="
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: ${isRunning ? '#4CAF50' : '#f44336'};
                    box-shadow: 0 0 8px ${isRunning ? '#4CAF50' : '#f44336'};
                    transition: all 0.3s ease;
                "></span>
                ${isRunning ? '停止运行' : '启动自动'}
            </span>
        `;

        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        btn.addEventListener('click', debounce(() => {
            isRunning = !isRunning;
            GM_setValue('autoRepostStatus', isRunning);
            updateButtonState(btn);
            if (isRunning) initializeOperation();
            else stopOperation();
        }, 300));

        document.body.appendChild(btn);
        return btn;
    }

    // ================= 工具函数库 =================

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function retryableFind(selector) {
        let attempts = 0;
        while (attempts++ < CONFIG.maxAttempts) {
            const element = document.querySelector(selector);
            if (element) return element;
            await delay(CONFIG.minDelay + attempts * 200);
        }
        throw new Error(`元素查找失败: ${selector}`);
    }

    async function humanizedClick(element) {
        const rect = element.getBoundingClientRect();
        const [x, y] = [
            rect.left + rect.width * (0.3 + Math.random() * 0.4),
            rect.top + rect.height * (0.3 + Math.random() * 0.4)
        ];

        await delay(getRandomDelay());
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await delay(50 + Math.random() * 100);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await delay(100 + Math.random() * 200);
        element.click();
    }

    async function humanizedType(element, text) {
        await element.focus();
        await delay(200);
        element.value = '';
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(50 + Math.random() * 150);
        }
    }

    function getRandomDelay() {
        return CONFIG.minDelay + Math.random() * (CONFIG.maxDelay - CONFIG.minDelay);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function generateUniqueNumber() {
        if (availableNumbers.length < CONFIG.poolSize * 0.2) {
            availableNumbers = [...availableNumbers, ...shuffleArray([...usedNumbers])];
            usedNumbers = [];
            shuffleArray(availableNumbers);
        }
        return availableNumbers.pop();
    }

    // ================= 系统初始化 =================
    (function init() {
        CountdownManager.init();
        const btn = createControlButton();
        GM_addValueChangeListener('autoRepostStatus', handleStatusChange);
        GM_registerMenuCommand('重置数字池', resetNumberPool);
        GM_registerMenuCommand('清除所有状态', resetAllState);

        if (isRunning) initializeOperation();
    })();

    function handleStatusChange(key, oldVal, newVal) {
        isRunning = newVal;
        updateButtonState(document.querySelector('#control-btn'));
        if (newVal) initializeOperation();
    }

    function initializeOperation() {
        clearTimeout(operationTimer);
        operationTimer = setTimeout(() => {
            performRepostFlow().then(schedulePageRefresh).catch(console.error);
        }, CONFIG.initDelay);
    }

    function schedulePageRefresh() {
        let remaining = CONFIG.refreshDelay;
        CountdownManager.show();
        GM_setValue('countdownRemaining', remaining);

        let lastUpdate = Date.now();
        countdownInterval = setInterval(() => {
            const now = Date.now();
            remaining -= now - lastUpdate;
            lastUpdate = now;

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                CountdownManager.hide();
                GM_setValue('countdownRemaining', 0);

                window.location.reload();
                return;
            }

            CountdownManager.update(remaining);
            GM_setValue('countdownRemaining', remaining);
        }, 100);
    }

    function showCompletionNotice() {
        const notice = document.createElement('div');
        notice.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; 
                padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ✅ 已完成预设的 ${CONFIG.maxCycles} 次循环
            </div>
        `;
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 5000);
    }

    function resetNumberPool() {
        usedNumbers = [];
        availableNumbers = initializeNumberPool();
        GM_setValue('usedNumbers', usedNumbers);
        GM_setValue('availableNumbers', availableNumbers);
        alert('数字池已重置');
    }

    function resetAllState() {
        GM_setValue('autoRepostStatus', false);
        GM_setValue('usedNumbers', []);
        GM_setValue('availableNumbers', initializeNumberPool());
        GM_setValue('countdownRemaining', 0);
        window.location.reload();
    }

    function emergencyStop(reason) {
        stopOperation();
        console.error(`[Emergency Stop] ${reason}`);
    }

    function stopOperation() {
        clearTimeout(operationTimer);
        clearInterval(countdownInterval);
        CountdownManager.hide();
        GM_setValue('countdownRemaining', 0);
        GM_setValue('autoRepostStatus', false);
        isRunning = false;
    }

    function updateButtonState(btn) {
        if (!btn) {
            console.error('Button element is null');
            return;
        }
        btn.style.background = isRunning ? '#dc3545' : '#28a745';
        const statusLed = btn.querySelector('.status-led');
        if (statusLed) {
            statusLed.style.background = isRunning ? '#4CAF50' : '#f44336';
            statusLed.style.boxShadow = `0 0 8px ${isRunning ? '#4CAF50' : '#f44336'}`;
        }
        const span = btn.querySelector('span');
        if (span) {
            span.innerHTML = isRunning ? '停止运行' : '启动自动';
        }
    }

    const injectCode = () => {
        // 拦截 XMLHttpRequest
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (url.includes('/ajax/statuses/normal_repost')) {
                this.addEventListener('load', () => {
                    window.dispatchEvent(new CustomEvent('WeiboAPIResponse', {
                        detail: this.response
                    }));
                });
            }
            originalXhrOpen.apply(this, arguments);
        };

        // 拦截 Fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [input] = args;
            if (typeof input === 'string' && input.includes('/ajax/statuses/normal_repost')) {
                const response = await originalFetch(...args);
                response.clone().json().then(data => {
                    window.dispatchEvent(new CustomEvent('WeiboAPIResponse', { detail: data }));
                });
                return response;
            }
            return originalFetch(...args);
        };
    };

    // 注入代码到页面上下文
    const script = document.createElement('script');
    script.textContent = `(${injectCode})();`;
    document.documentElement.appendChild(script);
    script.remove();

    // 监听自定义事件（在油猴环境中处理数据）
    window.addEventListener('WeiboAPIResponse', (e) => {
        if (e.detail.includes('频繁') || e.detail.includes('验证码')) {
            const btn = createControlButton();
            btn.click();
        }
    });
})();