// ==UserScript==
// @name         智能投票
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  智能投票
// @match        https://finance.sina.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_log
// @grant        GM_cookie
// ==/UserScript==

(function() {
    'use strict';

    // 增强配置项
    const CONFIG = {
        MAX_CLICKS: 10,
        INTERVAL: 1800,
        RETRY_LIMIT: 5,
        TARGET_ID: 'yinyue110'
    };

    // 持久化状态
    let system = {
        running: GM_getValue('running', false),
        counter: GM_getValue('counter', 0),
        retries: 0
    };

    let intervalHandle = null;
    let domObserver = null;

    /* 控制台系统 */
    function buildControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'voteControl';
        panel.innerHTML = `
            <div class="header">投票控制台 v3.0</div>
            <div class="status">
                <span>状态：</span>
                <span id="stateText">${system.running ? '运行中' : '待机'}</span>
            </div>
            <div class="counter">
                执行次数：<span id="counterView">${system.counter}</span>/${CONFIG.MAX_CLICKS}
            </div>
            <div class="controls">
                <button id="startBtn">▶ 启动</button>
                <button id="stopBtn">⏹ 停止</button>
            </div>
            <div class="debug" id="debugInfo"></div>
        `;

        GM_addStyle(`
            #voteControl {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2147483647;
                background: rgba(30,30,30,0.93);
                border: 1px solid #444;
                border-radius: 8px;
                padding: 15px;
                color: #fff;
                font-family: 'Segoe UI', system-ui;
                min-width: 200px;
                backdrop-filter: blur(4px);
            }
            .header {
                font-size: 16px;
                margin-bottom: 12px;
                color: #4CAF50;
            }
            .status, .counter {
                margin: 8px 0;
                font-size: 14px;
                opacity: 0.9;
            }
            #stateText {
                color: ${system.running ? '#4CAF50' : '#F44336'};
                font-weight: 500;
            }
            .controls {
                margin-top: 15px;
                display: flex;
                gap: 8px;
            }
            button {
                flex: 1;
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            #startBtn {
                background: #2196F3;
            }
            #startBtn:hover { background: #1976D2; }
            #stopBtn {
                background: #F44336;
            }
            #stopBtn:hover { background: #D32F2F; }
            .debug {
                margin-top: 12px;
                font-size: 12px;
                color: #9E9E9E;
            }
        `);

        document.body.appendChild(panel);
        document.getElementById('startBtn').addEventListener('click', startEngine);
        document.getElementById('stopBtn').addEventListener('click', stopEngine);
    }

    /* DOM监听系统 */
    function initializeObserver() {
        const observerConfig = {
            attributes: true,
            attributeFilter: ['style'],
            subtree: true
        };

        const targetFinder = () => {
            const nodes = document.querySelectorAll('.vote-msg.ok');
            if (nodes.length >= 0) {
                domObserver = new MutationObserver(handleMutations);
                nodes.forEach(node => domObserver.observe(node, observerConfig));
                GM_log('DOM观察者已激活');
            } else if (system.retries++ < CONFIG.RETRY_LIMIT) {
                setTimeout(targetFinder, 500);
            }
        };

        targetFinder();
    }

    function handleMutations(mutations) {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'style') {
                const element = mutation.target;
                if (window.getComputedStyle(element).display !== 'none') {
                    processStatusMessage(element.textContent.trim());
                }
            }
        });
    }

    /* 业务逻辑 */
    function executeVote() {
        const selector = `div.btn.btn-vote[data-id="${CONFIG.TARGET_ID}"]:not([disabled])`;
        const button = document.querySelector(selector);
        if (button) {
            simulateClick(button);
            updateCounter(++system.counter);
            GM_setValue('counter', system.counter);
            
            if (system.counter >= CONFIG.MAX_CLICKS) {
                resetSystem();
            }
        }
    }

    function simulateClick(element) {
        const eventConfig = {
            bubbles: true,
            cancelable: true,   // 增加可取消属性
            composed: true      // 启用跨Shadow DOM传播
        };
    
        // 创建完整事件序列
        const downEvent = new MouseEvent('mousedown', eventConfig);
        const upEvent = new MouseEvent('mouseup', eventConfig);
        const clickEvent = new MouseEvent('click', eventConfig);
    
        // 分派事件
        element.dispatchEvent(downEvent);
        element.dispatchEvent(upEvent);
        
        // 添加人类操作延迟
        setTimeout(() => {
            element.dispatchEvent(clickEvent);
            element.style.transform = 'scale(0.98)';
            setTimeout(() => element.style.transform = '', 80);
        }, 120 + Math.random() * 80);
    }

    /* 控制系统 */
    function startEngine() {
        system.running = true;
        GM_setValue('running', true);
        intervalHandle = setInterval(executeVote, CONFIG.INTERVAL);
        initializeObserver();
        updateStatus('运行中', '#4CAF50');
        GM_log('系统启动');
    }

    function stopEngine() {
        if (system.running) {
            system.running = false;
            GM_setValue('running', false);
            clearInterval(intervalHandle);
            domObserver?.disconnect();
            updateStatus('已停止', '#F44336');
            GM_log('系统停止');
        }
    }

    function clearAllCookies() {
        if (typeof GM_cookie !== 'undefined') {
            GM_cookie.list({}, (cookies) => {
                cookies.forEach(cookie => {
                    GM_cookie.delete(cookie);
                });
            });
        }
    
        return new Promise(resolve => setTimeout(resolve, 500)); // 延长延迟
    }

    function resetSystem() {
        GM_log('触发系统重置');
        // stopEngine();
        system.counter = 0;
        GM_setValue('counter', 0);
        clearAllCookies().then(() => window.location.reload());
    }

    /* 辅助函数 */
    function processStatusMessage(text) {
        const debugPanel = document.getElementById('debugInfo');
        if (text.includes('次数已用尽')) {
            debugPanel.textContent = '检测到次数限制，准备重置...';
            setTimeout(resetSystem, 2500);
        } else if (text.includes('投票成功')) {
            debugPanel.textContent = `最近操作：${new Date().toLocaleTimeString()} 投票成功`;
        }
    }

    function updateStatus(text, color) {
        const elem = document.getElementById('stateText');
        if (elem) {
            elem.textContent = text;
            elem.style.color = color;
        }
    }

    function updateCounter(value) {
        const elem = document.getElementById('counterView');
        if (elem) elem.textContent = value;
    }

    /* 初始化 */
    window.addEventListener('load', () => {
        buildControlPanel();
        GM_log(system.running);
        if (system.running) {
            setTimeout(() => {
                initializeObserver();
                startEngine();
            }, 3000);
        }
    });
})();
