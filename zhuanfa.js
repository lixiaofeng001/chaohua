// ==UserScript==
// @name         微博智能转发工具
// @version      5.0
// @description  微博智能转发工具
// @author       路过的香菜丶
// @match        *://weibo.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置中心 =================
    const CONFIG = {
        // 最大循环次数，表示工具运行的最大循环次数
        maxCycles: 20,
        // 当前循环次数，记录当前已执行的循环次数
        currentCycle: GM_getValue('currentCycle', 0),
        // 刷新延迟时间（毫秒），控制每次操作之间的延迟时间
        refreshDelay: 10000,
        // 请求延迟范围（毫秒），用于随机生成请求延迟时间
        requestRange: [800, 2500],
        // 数字池大小，表示可用数字的数量
        numberPoolSize: 100
    };
    GM_setValue('maxCycles', CONFIG.maxCycles);

    // ================= 状态管理 =================
    // 是否正在运行，记录工具的运行状态
    let isRunning = GM_getValue('isRunning', false);
    // 定时器，用于控制循环操作
    let timer = null;
    // 可用数字池，存储当前可用的数字
    let availableNumbers = GM_getValue('availableNumbers', initNumberPool());
    // 已使用数字池，存储已使用的数字
    let usedNumbers = GM_getValue('usedNumbers', []);

    // ================= 核心功能 =================
    function initNumberPool() {
        const pool = Array.from({length: CONFIG.numberPoolSize}, (_, i) => i + 1);
        return shuffleArray(pool);
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    async function performRepost() {
        if (CONFIG.currentCycle >= CONFIG.maxCycles) {
            stopOperation();
            showNotification(`✅ 已完成 ${CONFIG.maxCycles} 次循环`);
            return;
        }

        try {
            const repostBtn = await findElement('.toolbar_retweet_1L_U5', 10);
            await humanClick(repostBtn);

            const textarea = await findElement('textarea.Form_input_3JT2Q', 5);
            const newContent = `${generateNumber()} ${textarea.value.trim()}`;
            await humanType(textarea, newContent);

            const confirmBtn = await findElement('button.Composer_btn_2XFOD:not([disabled])', 5);
            await humanClick(confirmBtn);

            CONFIG.currentCycle++;
            GM_setValue('currentCycle', CONFIG.currentCycle);
            updatePanel();
        } catch (error) {
            handleError(error);
        }
    }

    // ================= UI系统 =================
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'ds-control-panel';
        panel.style = `position:fixed;top:100px;right:20px;background:#fff;
            padding:15px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);
            z-index:9999;min-width:220px;`;

        panel.innerHTML = `
            <div style="margin-bottom:12px;font-weight:500;border-bottom:1px solid #eee;padding-bottom:8px;">
                循环控制 (${CONFIG.currentCycle}/${CONFIG.maxCycles})
            </div>

            <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">当前可用数字</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <progress value="${availableNumbers.length}" max="${CONFIG.numberPoolSize}"
                        style="flex:1;height:8px;"></progress>
                    <span style="font-size:12px;">${availableNumbers.length}/${CONFIG.numberPoolSize}</span>
                </div>
            </div>
            <button id="ds-toggleBtn" style="width:100%;padding:8px;background:${isRunning ? '#dc3545' : '#28a745'};
                color:#fff;border:none;border-radius:4px;cursor:pointer;">
                ${isRunning ? '停止运行' : '开始运行'}
            </button>
        `;

        panel.querySelector('#ds-toggleBtn').addEventListener('click', function() {
            isRunning = !isRunning;
            GM_setValue('isRunning', isRunning);
            updatePanel();
            if (isRunning) startOperation();
            else stopOperation();
        });

        document.body.appendChild(panel);
    }

    // ================= 工具函数 =================
    function generateNumber() {
        if (availableNumbers.length < 10) {
            availableNumbers = [...shuffleArray(usedNumbers), ...availableNumbers];
            usedNumbers = [];
        }
        const num = availableNumbers.pop();
        usedNumbers.push(num);
        GM_setValue('availableNumbers', availableNumbers);
        GM_setValue('usedNumbers', usedNumbers);
        return num;
    }

    async function findElement(selector, retries = 5) {
        for (let i = 0; i < retries; i++) {
            const el = document.querySelector(selector);
            if (el) return el;
            await new Promise(r => setTimeout(r, 800 + i * 200));
        }
        throw new Error('元素查找失败: ' + selector);
    }

    async function humanClick(el) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
        const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

        el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
        el.click();
    }

    async function humanType(element, text) {
        await element.focus();
        await delay(50);
        element.value = '';
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(50 + Math.random() * 20);
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ================= 生命周期管理 =================
    function startOperation() {
        if (timer) clearTimeout(timer);
        timer = setInterval(() => {
            if (!isRunning) return;
            performRepost();
            setTimeout(() => window.location.reload(), CONFIG.refreshDelay);
        }, CONFIG.refreshDelay + getRandomDelay());
    }

    function stopOperation() {
        clearInterval(timer);
        isRunning = false;
        GM_setValue('isRunning', false);
        updatePanel();
    }

    function getRandomDelay() {
        return Math.floor(Math.random() * (CONFIG.requestRange[1] - CONFIG.requestRange[0])) + CONFIG.requestRange[0];
    }

    function updatePanel() {
        const panel = document.getElementById('ds-control-panel');
        if (panel) {
            panel.querySelector('#ds-toggleBtn').textContent = isRunning ? '停止运行' : '开始运行';
            panel.querySelector('#ds-toggleBtn').style.background = isRunning ? '#dc3545' : '#28a745';
            panel.querySelector('progress').value = availableNumbers.length;
            panel.querySelector('span').textContent = `${availableNumbers.length}/${CONFIG.numberPoolSize}`;
            panel.querySelector('div:first-child').textContent =
                `循环控制 (${CONFIG.currentCycle}/${CONFIG.maxCycles})`;
        }
    }

    function showNotification(text, color = '#4CAF50') {
        const notice = document.createElement('div');
        notice.style = `position:fixed;top:20px;right:20px;padding:12px;background:${color};
            color:#fff;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:10000;`;
        notice.textContent = text;
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 3000);
    }

    function handleError(error) {
        console.error('[系统错误]', error);
        showNotification('⚠️ 操作失败: ' + error.message, '#ff5722');
        CONFIG.currentCycle = Math.max(0, CONFIG.currentCycle - 1);
        GM_setValue('currentCycle', CONFIG.currentCycle);
        updatePanel();
    }

    function resetAllState() {
        GM_setValue('isRunning', false);
        GM_setValue('usedNumbers', []);
        GM_setValue('currentCycle', 0)
        GM_setValue('availableNumbers', initNumberPool());
        window.location.reload();
    }


    // ================= 初始化 =================
    function init() {
        createControlPanel();
        GM_registerMenuCommand('清除所有状态', resetAllState);
        if (isRunning) startOperation();
    }

    // 启动系统
    init();

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
            stopOperation();
            showNotification('⚠️ 触发频率限制，已自动停止', '#ff5722');
            CONFIG.currentCycle = Math.max(0, CONFIG.currentCycle - 1);
            GM_setValue('currentCycle', CONFIG.currentCycle);
            updatePanel();
        }
    });
})();
