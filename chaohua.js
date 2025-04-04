// ==UserScript==
// @name         微博超话助手专业版
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  专业级超话管理工具，支持内容池管理与实时监控
// @author       YourName
// @match        https://weibo.com/p/10080867e85b80401d7e932176493991acf1e7/super_index*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_log
// @connect      weibo.com
// ==/UserScript==

(function() {
    'use strict';

    // 样式系统
    GM_addStyle(`
        :root {
            --primary-color: #ff8140;
            --bg-color: #fff;
            --border-color: #e4e7ed;
            --text-color: #606266;
        }
    
        .super-dialog {
            position: fixed;
            width: 1200px; /* 增大宽度 */
            height: 900px; /* 增加高度 */
            background: var(--bg-color);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            z-index: 99999;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            user-select: none;
            overflow-y: auto; /* 添加滚动条 */
        }
    
        .dialog-header {
            padding: 16px;
            background: var(--primary-color);
            color: white;
            border-radius: 12px 12px 0 0;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    
        .dialog-body {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(2, 1fr); /* 两列布局 */
            grid-template-rows: repeat(3, minmax(200px, auto)); /* 自适应行高 */
            gap: 10px;
            padding: 2px 10px 2px 10px;
            overflow: hidden;
        }
    
        .list-panel {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            flex: 1;
        }
    
        .list-title {
            font-weight: 500;
            margin-bottom: 10px;
            color: var(--text-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    
        .list-content {
            flex: 1;
            margin-bottom: 10px;
            max-height: 180px; /* 设置最大高度 */
            overflow-y: auto;
            overflow-x: hidden;
        }
    
        .list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px;
            margin: 2px 0;
            background: #f8f9fa;
            border-radius: 4px;
            transition: 0.2s;
        }
    
        .list-item:hover {
            transform: translateX(4px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
    
        .item-text {
            display: inline-block; /* 确保宽度限制生效 */
            max-width: 470px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    
        .item-actions button {
            margin-left: 4px;
            padding: 3px 6px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    
        .stats-bar {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 10px;
            background: #f5f7fa;
            border-radius: 8px;
            margin-bottom: 10px;
        }
    
        .stat-item {
            text-align: center;
            padding: 6px;
            background: white;
            border-radius: 6px;
        }
    
        .log-panel {
            grid-column: 1 / -1; /* 跨四列 */
            height: 200px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px;
        }
    
        .log-item {
            display: flex;
            justify-content: space-between;
            padding: 6px;
            font-size: 13px;
            border-bottom: 1px solid var(--border-color);
        }
    
        .log-item-time {
            flex: 0 0 100px;
        }
    
        .log-item-content {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    
        .control-buttons {
            display: flex;
            gap: 10px;
            margin: 10px;
            flex-direction: row-reverse;
        }
    
        .start-btn {
            background: #67c23a;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            transition: 0.3s;
        }
    
        .clear-log-btn {
            background:rgb(5, 133, 253);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            transition: 0.3s;
        }
    
        .stop-btn {
            background: #f56c6c;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            transition: 0.3s;
        }
    
        .add-btn, .edit-btn, .delete-btn {
            background: var(--primary-color);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            transition: 0.2s;
            border: none;
        }
    
        .edit-btn {
            background: #409eff;
        }
    
        .delete-btn {
            background: #f56c6c;
        }
    `);

    class ConfigManager {
        static DEFAULT_CONFIG = {
            hashtags: [
                "#虞书欣卫枝#",
                "#虞书欣嘘国王在冬眠#",
                "#雀巢咖啡即饮品牌代言人虞书欣#",
                "#虞书欣腾讯地图品牌代言人#",
                "#虞书欣姜暮#",
                "#虞书欣双轨#",
                "#ubras品牌代言人虞书欣#",
                "#真果粒品牌代言人虞书欣#"
            ],
            separators: ["ysx", "✨"],
            bodies: [
                "比起天赋，我更相信反复练习的力量@虞书欣Esther ​​​",
                "有我们再，你不再是一个人了@虞书欣Esther ​​​​",
                "谢谢你的出现 让我黯淡无光的世界有了一丝光亮@虞书欣Esther ​​​​",
                "烟花绽放的声音 是我无声的告白@虞书欣Esther ​​​​",
                "盛不盛开，花都是花，那片海的浪不会停，我对你的爱也是@虞书欣Esther ​​​​",
                "“你是乱花欲渐中唯一用青睐燃烧的星火燎原 𝙔𝙤𝙪 𝙖𝙧𝙚 𝙩𝙚 𝙤𝙣𝙡𝙮 𝙨𝙥𝙖𝙧𝙠 𝙩𝙖𝙩 𝙗𝙪𝙧𝙣𝙨 𝙬𝙞𝙩𝙝 𝙡𝙤𝙫𝙚 𝙞𝙣 𝙩𝙝𝙚 𝙘𝙝𝙖𝙤𝙨.”@虞书欣Esther"
            ],
            links: [
                "https://video.weibo.com/show?fid=1034:5024618210066442",
                "https://video.weibo.com/show?fid=1034:5117942338355255",
                "https://video.weibo.com/show?fid=1034:5109019426095150",
                "https://video.weibo.com/show?fid=1034:4861018984349795",
                "https://video.weibo.com/show?fid=1034:5151756573933662",
                "https://video.weibo.com/show?fid=1034:5126647238557722"

            ],
            isRunning: false,
            interval: 5 // 默认5分钟
        };

        static getConfig() {
            const userConfig = GM_getValue('user_config') || {};
            return {...this.DEFAULT_CONFIG, ...userConfig};
        }

        static updateConfig(key, value) {
            const config = this.getConfig();
            config[key] = value;
            GM_setValue('user_config', config);
            return config;
        }
    }

    class SuperDialog {
        static instance = null;
        timerId = null;
    
        constructor() {
            if (SuperDialog.instance) return SuperDialog.instance;
    
            this.dialog = null;
            this.isDragging = false;
            this.startX = 0;
            this.startY = 0;
            this.init();
    
            SuperDialog.instance = this;
        }
    
        init() {
            this.createDialog();
            this.bindEvents();
            this.checkAutoStart();
        }
    
        checkAutoStart() {
            const config = ConfigManager.getConfig();
            if (config.isRunning) {
                this.startPosting(config.interval);
            }
        }
    
        createDialog() {
            this.dialog = document.createElement('div');
            this.dialog.className = 'super-dialog';
            this.dialog.innerHTML = `
                <div class="dialog-header">
                    <span>超话管理控制台</span>
                    <span>📅 ${new Date().toLocaleDateString()}</span>
                </div>
                <div class="stats-bar">
                    ${this.createStats()}
                </div>
                <div class="control-buttons">
                    <button class="start-btn" id="toggleBtn">${ConfigManager.getConfig().isRunning ? '停止任务' : '启动任务'}</button>
                    <button class="clear-log-btn">清除日志</button>
                </div>
                <div class="dialog-body">
                    ${this.createListPanel('hashtags', '话题标签')}
                    ${this.createListPanel('separators', '分隔符')}
                    ${this.createListPanel('bodies', '正文内容')}
                    ${this.createListPanel('links', '视频链接')}
                    <div class="log-panel">
                        <div class="list-title">操作日志</div>
                        <div class="list-content" id="log-list"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.dialog);
            this.renderAllLists();
            this.updateButtonState();
        }
    
        createStats() {
            const logs = GM_getValue('post_logs', []);
            // 过滤掉包含特定关键词的日志条目
            const filteredLogs = logs.filter(log => !log.content.includes('定时任务已启动') && !log.content.includes('定时任务已停止'));
            const successCount = filteredLogs.filter(l => l.success).length;
            const statsHTML = `
                <div class="stat-item">
                    <div>总发送数</div>
                    <div>${filteredLogs.length}</div>
                </div>
                <div class="stat-item">
                    <div>成功数</div>
                    <div>${successCount}</div>
                </div>
                <div class="stat-item">
                    <div>成功率</div>
                    <div>${filteredLogs.length ? (successCount / filteredLogs.length * 100).toFixed(1) : 0}%</div>
                </div>
            `;
    
            // 获取 .stats-bar 元素并更新其内容
            const statsBar = this.dialog.querySelector('.stats-bar');
            if (statsBar) {
                statsBar.innerHTML = statsHTML;
            } else {
                console.error('.stats-bar element not found');
            }
    
            // 添加调试信息
            console.log('createStats called, statsHTML:', statsHTML);
            return statsHTML;
        }
    
        createListPanel(key, title) {
            return `
                <div class="list-panel">
                    <div class="list-title">
                        <span>${title}</span>
                        <button class="add-btn" data-key="${key}">+ 添加</button>
                    </div>
                    <div class="list-content" id="${key}-list"></div>
                </div>
            `;
        }
    
        updateButtonState() {
            const btn = this.dialog.querySelector('#toggleBtn');
            if (ConfigManager.getConfig().isRunning) {
                btn.classList.add('stop-btn');
                btn.classList.remove('start-btn');
                btn.textContent = '停止任务';
            } else {
                btn.classList.add('start-btn');
                btn.classList.remove('stop-btn');
                btn.textContent = '启动任务';
            }
        }
    
        bindEvents() {
            // 拖动处理
            const header = this.dialog.querySelector('.dialog-header');
            header.addEventListener('mousedown', this.startDrag.bind(this));
            document.addEventListener('mousemove', this.handleDrag.bind(this));
            document.addEventListener('mouseup', this.stopDrag.bind(this));
    
            // 按钮事件
            this.dialog.addEventListener('click', (e) => {
                if (e.target.id === 'toggleBtn') {
                    this.handleToggleTask();
                }
                if (e.target.classList.contains('add-btn')) {
                    this.handleAddItem(e.target.dataset.key);
                }
                if (e.target.classList.contains('edit-btn')) {
                    this.handleEditItem(e.target.closest('.list-item'));
                }
                if (e.target.classList.contains('delete-btn')) {
                    this.handleDeleteItem(e.target.closest('.list-item'));
                }
                if (e.target.classList.contains('clear-log-btn')) {
                    this.clearLogs();
                }
            });
        }
    
        handleToggleTask() {
            const config = ConfigManager.getConfig();
            if (config.isRunning) {
                this.stopPosting();
            } else {
                const input = prompt('请输入定时任务间隔时间（分钟）:', config.interval);
                const minutes = parseInt(input);
                if (!isNaN(minutes) && minutes > 0) {
                    this.startPosting(minutes);
                } else {
                    alert('请输入有效的数字');
                }
            }
        }
    
        startPosting(minutes) {
            this.stopPosting(); // 停止现有定时器
    
            ConfigManager.updateConfig('interval', minutes);
            ConfigManager.updateConfig('isRunning', true);
    
            this.timerId = setInterval(() => {
                WeiboPublisher.post();
            }, minutes * 60 * 1000);
    
            this.updateButtonState();
            this.addLog(`定时任务已启动，间隔 ${minutes} 分钟`);
        }
    
        stopPosting() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
            ConfigManager.updateConfig('isRunning', false);
            this.updateButtonState();
            this.addLog('定时任务已停止');
        }
    
        addLog(message) {
            const logs = GM_getValue('post_logs', []);
            logs.push({
                time: Date.now(),
                content: message,
                success: true
            });
            GM_setValue('post_logs', logs.slice(-100));
            this.renderLogs();
        }
    
        // 拖动逻辑
        startDrag(e) {
            this.isDragging = true;
            this.startX = e.clientX - this.dialog.offsetLeft;
            this.startY = e.clientY - this.dialog.offsetTop;
        }
    
        handleDrag(e) {
            if (this.isDragging) {
                const x = e.clientX - this.startX;
                const y = e.clientY - this.startY;
                this.dialog.style.left = `${x}px`;
                this.dialog.style.top = `${y}px`;
            }
        }
    
        stopDrag() {
            this.isDragging = false;
        }
    
        // 列表操作
        handleAddItem(key) {
            const chineseName = this.getChineseName(key);
            const newItem = prompt(`请输入新的${chineseName}:`, "").trim();
            if (newItem) {
                const config = ConfigManager.getConfig();
                config[key].push(newItem);
                ConfigManager.updateConfig(key, config[key]);
                this.renderList(key);
            } else {
                alert(`${chineseName}不能为空`);
            }
        }
    
        handleEditItem(item) {
            const key = item.parentElement.id.replace('-list', '');
            const index = [...item.parentElement.children].indexOf(item);
            const currentValue = item.querySelector('.item-text').textContent;
            const newValue = prompt('修改内容:', currentValue).trim();
            if (newValue) {
                const config = ConfigManager.getConfig();
                config[key][index] = newValue;
                ConfigManager.updateConfig(key, config[key]);
                this.renderList(key);
            }
        }
    
        handleDeleteItem(item) {
            if (confirm('确定要删除此项吗？')) {
                const key = item.parentElement.id.replace('-list', '');
                const index = [...item.parentElement.children].indexOf(item);
                const config = ConfigManager.getConfig();
                config[key].splice(index, 1);
                ConfigManager.updateConfig(key, config[key]);
                this.renderList(key);
            }
        }
    
        // 渲染逻辑
        renderAllLists() {
            ['hashtags', 'separators', 'bodies', 'links'].forEach(key => {
                this.renderList(key);
            });
            this.renderLogs();
        }
    
        renderList(key) {
            const list = this.dialog.querySelector(`#${key}-list`);
            const items = ConfigManager.getConfig()[key];
            list.innerHTML = items.map((item, index) => `
                <div class="list-item">
                    <span class="item-text">${item}</span>
                    <div class="item-actions">
                        <button class="edit-btn">✎</button>
                        <button class="delete-btn">×</button>
                    </div>
                </div>
            `).join('');
        }
    
        renderLogs() {
            const logList = this.dialog.querySelector('#log-list');
            const logs = GM_getValue('post_logs', []).sort((a, b) => b.time - a.time);
            logList.innerHTML = logs.map(log => `
                <div class="log-item">
                    <span class="log-item-time">${new Date(log.time).toLocaleTimeString()}</span>
                    <span class="log-item-content" style="color:${log.success ? 'green' : 'red'}">${log.content}</span>
                </div>
            `).join('');
        }
    
        getChineseName(key) {
            const names = {
                hashtags: '话题标签',
                separators: '分隔符',
                bodies: '正文内容',
                links: '视频链接'
            };
            return names[key];
        }
    
        clearLogs() {
            GM_setValue('post_logs', []); // 清除日志
            this.renderLogs(); // 重新渲染日志
            this.createStats(); // 重新渲染统计信息
        }
    }
    class ContentGenerator {
        static recentChoices = [];

        static generate() {
            const config = ConfigManager.getConfig();
            let content;
            do {
                content = this.combineContent(
                    this.pickRandom(config.hashtags, 2),
                    this.pickRandom(config.separators),
                    this.pickRandom(config.bodies),
                    this.pickRandom(config.links)
                );
            } while (this.recentChoices.includes(content));

            // 更新最近选择的内容队列
            this.recentChoices.push(content);
            if (this.recentChoices.length > 3) {
                this.recentChoices.shift();
            }

            return content;
        }

        static pickRandom(array, count = 1) {
            return [...array].sort(() => Math.random() - 0.5).slice(0, count);
        }

        static combineContent(tags, separator, body, link) {
            return `${tags.join(separator)}\n\n${body}\n\n${link}`;
        }
    }

    class WeiboPublisher {
        static post() {
            const content = ContentGenerator.generate();
            const params = new URLSearchParams({
                ...this.getBaseParams(),
                ...this.getDynamicParams(),
                text: content
            });

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://weibo.com/p/aj/proxy',
                headers: this.getHeaders(),
                data: params.toString(),
                onload: (res) => this.handleResponse(res, content)
            });
        }

        static getPageId() {
            const match = window.location.pathname.match(/\/p\/(100808\w+)/);
            return match ? match[1] : '';
        }

        static getBaseParams() {
            const pageId = window.location.pathname.match(/\/p\/(100808\w+)/)?.[1] || '';
            return {
                location: 'page_100808_super_index',
                appkey: '',
                style_type: 1,
                pic_id: '',
                tid: '',
                pdetail: this.getPageId(),
                mid: '',
                isReEdit: false,
                sync_wb: 1,
                pub_source: 'page_1',
                api: `http://i.huati.weibo.com/pcpage/operation/publisher/sendcontent?sign=super&page_id=${this.getPageId()}`,
                object_id: `1022:${this.getPageId()}`,
                module: 'publish_913',
                page_module_id: '913',
                longtext: 1,
                topic_id: `1022:${this.getPageId()}`,
                pub_type: 'dialog',
                _t: 0
            };
        }

        static getDynamicParams() {
            return {
                __rnd: Date.now(),
                ajwvr: 6,
                _t: Date.now()
            };
        }

        static getHeaders() {
            return {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': document.cookie,
                'Referer': window.location.href
            };
        }

        static handleResponse(res, content) {
            const logs = GM_getValue('post_logs', []);
            logs.push({
                time: Date.now(),
                content: content,
                success: res.status === 200
            });
            GM_setValue('post_logs', logs.slice(-100));

            // 获取SuperDialog的实例并调用renderLogs和createStats方法
            const superDialogInstance = SuperDialog.instance;
            if (superDialogInstance) {
                superDialogInstance.renderLogs();
                superDialogInstance.createStats();
            } else {
                console.error('SuperDialog instance not found');
            }
        }
    }

    // 初始化逻辑简化
    setTimeout(() => {
        new SuperDialog();
    }, 3000);
})();
