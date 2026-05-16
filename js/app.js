/* ============================================================
   المدقق الذكي - Smart Auditor Platform
   Application Logic v2.0 — Clean Code Architecture
   ============================================================ */

/* ---- Strict Mode ---- */
'use strict';

/* ---- App Configuration ---- */
const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DISPLAY_ROWS: 50,
  AUDIT_STEPS: 20,
  AUDIT_INTERVAL_MS: 100,
  TOAST_DURATION: 3500,
  ANIMATION_DURATION: 800,
  DEFAULT_LOCALE: 'ar-SA',
  CURRENCY: 'ر.س',
  STORAGE_KEY_PREFIX: 'smart_audit_',
};

/* ============================================================
   STATE MANAGEMENT
   ============================================================ */

const Store = {
  _state: {
    currentPage: 'dashboard',
    theme: localStorage.getItem(CONFIG.STORAGE_KEY_PREFIX + 'theme') || 'dark',
    importedData: [],
    auditFindings: [],
    auditCompleted: false,
    isAuditing: false,
    clients: [
      { name: 'شركة التقنية المتطورة', lastAudit: '2026-05-10', status: 'نشط', email: '', phone: '' },
      { name: 'مؤسسة البناء الحديث', lastAudit: '2026-04-28', status: 'قيد المراجعة', email: '', phone: '' },
      { name: 'شركة التجارة الدولية', lastAudit: '2026-03-15', status: 'نشط', email: '', phone: '' },
      { name: 'مجموعة الاستثمار المالي', lastAudit: '2026-05-01', status: 'متأخر', email: '', phone: '' },
    ],
    charts: {},
  },

  _listeners: [],

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;
    this._notify(key, value);
  },

  on(key, fn) {
    this._listeners.push({ key, fn });
  },

  _notify(key, value) {
    this._listeners
      .filter(l => l.key === key)
      .forEach(l => l.fn(value, key));
  },
};

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

const Utils = {
  formatCurrency(num) {
    if (num == null || isNaN(num)) return '0 ' + CONFIG.CURRENCY;
    return Number(num).toLocaleString(CONFIG.DEFAULT_LOCALE) + ' ' + CONFIG.CURRENCY;
  },

  formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    return Number(num).toLocaleString(CONFIG.DEFAULT_LOCALE);
  },

  sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  throttle(fn, limit = 200) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  getEl(id) {
    return document.getElementById(id);
  },

  getElSafe(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('Element not found:', id);
    return el;
  },

  query(selector, parent = document) {
    return parent.querySelector(selector);
  },

  queryAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
  },

  animateNumber(el, target, duration = CONFIG.ANIMATION_DURATION) {
    const start = performance.now();
    const initial = parseFloat(el.textContent.replace(/[^0-9.-]/g, '')) || 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = initial + (target - initial) * eased;
      el.textContent = Utils.formatNumber(Math.round(current));
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },
};

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */

const Toast = {
  container: null,

  init() {
    this.container = Utils.getEl('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  _icons: {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  },

  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span class="toast-icon">' + (this._icons[type] || '') +
      '</span><span>' + message + '</span>';
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, CONFIG.TOAST_DURATION);
  },
};

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */

const Confirm = {
  _overlay: null,

  create() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'modal-overlay confirm-overlay';
    this._overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '<div class="modal-body">' +
      '<div class="confirm-icon" id="confirmIcon">⚠️</div>' +
      '<div class="confirm-title" id="confirmTitle">تأكيد</div>' +
      '<div class="confirm-message" id="confirmMessage">هل أنت متأكد؟</div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="confirmCancel">إلغاء</button>' +
      '<button class="btn btn-danger" id="confirmOk">تأكيد</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(this._overlay);
  },

  show({ title = 'تأكيد', message = 'هل أنت متأكد؟', confirmText = 'تأكيد', danger = true } = {}) {
    return new Promise((resolve) => {
      if (!this._overlay) this.create();

      this._overlay.querySelector('#confirmIcon').textContent = danger ? '⚠️' : 'ℹ️';
      this._overlay.querySelector('#confirmTitle').textContent = title;
      this._overlay.querySelector('#confirmMessage').textContent = message;
      const okBtn = this._overlay.querySelector('#confirmOk');
      okBtn.textContent = confirmText;
      okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      this._overlay.classList.add('show');

      const cleanup = () => {
        this._overlay.classList.remove('show');
        this._overlay.querySelector('#confirmOk').onclick = null;
        this._overlay.querySelector('#confirmCancel').onclick = null;
      };

      this._overlay.querySelector('#confirmOk').onclick = () => { cleanup(); resolve(true); };
      this._overlay.querySelector('#confirmCancel').onclick = () => { cleanup(); resolve(false); };
    });
  },
};

/* ============================================================
   MODAL MANAGEMENT
   ============================================================ */

const Modal = {
  open(id) {
    const el = Utils.getEl(id);
    if (el) el.classList.add('show');
  },

  close(id) {
    const el = Utils.getEl(id);
    if (el) el.classList.remove('show');
  },
};

/* ============================================================
   THEME MANAGER
   ============================================================ */

const ThemeManager = {
  init() {
    const theme = Store.get('theme');
    this.apply(theme);
    const btn = Utils.getEl('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = Utils.getEl('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '🌙' : '☀️';
      btn.setAttribute('aria-label', theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي');
    }
    localStorage.setItem(CONFIG.STORAGE_KEY_PREFIX + 'theme', theme);
  },

  toggle() {
    const current = Store.get('theme');
    const next = current === 'dark' ? 'light' : 'dark';
    Store.set('theme', next);
    this.apply(next);
  },
};

/* ============================================================
   NAVIGATION / ROUTER
   ============================================================ */

const Router = {
  _pages: {},

  init() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });
  },

  register(page, { title, breadcrumb, onEnter } = {}) {
    this._pages[page] = { title, breadcrumb, onEnter };
  },

  navigate(page) {
    if (page === Store.get('currentPage')) return;
    Store.set('currentPage', page);

    const info = this._pages[page] || {};
    const titleEl = Utils.getEl('pageTitle');
    const breadcrumbEl = Utils.getEl('breadcrumb');
    if (titleEl) titleEl.textContent = info.title || page;
    if (breadcrumbEl) breadcrumbEl.textContent = info.breadcrumb || '';

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    document.querySelectorAll('.content > section').forEach(el => {
      el.style.display = el.id === 'page-' + page ? 'block' : 'none';
    });

    if (typeof info.onEnter === 'function') {
      info.onEnter();
    }

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

/* ============================================================
   DATA INGESTION MODULE
   ============================================================ */

const DataIngestion = {
  _fileInput: null,
  _dropZone: null,

  init() {
    this._fileInput = Utils.getEl('fileInput');
    this._dropZone = Utils.getEl('fileDropZone');
    if (!this._fileInput || !this._dropZone) return;

    // Drag & Drop events
    this._dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone.classList.add('dragover');
    });

    this._dropZone.addEventListener('dragleave', () => {
      this._dropZone.classList.remove('dragover');
    });

    this._dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this._fileInput.files = e.dataTransfer.files;
        this._onFileSelect();
      }
    });

    this._fileInput.addEventListener('change', () => this._onFileSelect());
  },

  _onFileSelect() {
    const file = this._fileInput.files[0];
    if (!file) return;

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      Toast.show('حجم الملف يتجاوز الحد المسموح (١٠ ميجابايت)', 'error');
      this._fileInput.value = '';
      return;
    }

    this._dropZone.classList.add('has-file');
    this._dropZone.querySelector('.upload-text').textContent = file.name;
    this._dropZone.querySelector('.upload-hint').textContent = 'تم اختيار الملف (' + (file.size / 1024).toFixed(1) + ' كيلوبايت)';
  },

  processFile() {
    const file = this._fileInput?.files[0];
    if (!file) {
      Toast.show('الرجاء اختيار ملف أولاً', 'error');
      return;
    }

    const btn = document.querySelector('.btn-process-file');
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length < 2) {
          Toast.show('الملف لا يحتوي على بيانات كافية', 'error');
          return;
        }

        const records = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row.length >= 3) {
            records.push({
              account: String(row[0] || ''),
              description: String(row[1] || ''),
              debit: parseFloat(row[2]) || 0,
              credit: parseFloat(row[3]) || 0,
              date: String(row[4] || ''),
            });
          }
        }

        Store.set('importedData', records);
        this._renderTable(records);
        this._updateStats(records);
        this._resetUploadUI();

        Toast.show('تم استيراد ' + records.length + ' سجل بنجاح', 'success');
      } catch (err) {
        Toast.show('فشل في قراءة الملف: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.classList.remove('loading');
          btn.disabled = false;
        }
      }
    };

    reader.onerror = () => {
      Toast.show('حدث خطأ أثناء قراءة الملف', 'error');
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    };

    reader.readAsArrayBuffer(file);
  },

  _renderTable(data) {
    const tbody = Utils.getEl('importedDataTable');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = this._emptyRow(5);
      return;
    }

    const sample = data.slice(0, CONFIG.MAX_DISPLAY_ROWS);
    tbody.innerHTML = sample.map((r, i) =>
      '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + Utils.escapeHtml(r.account) + '</td>' +
      '<td>' + Utils.escapeHtml(r.description) + '</td>' +
      '<td>' + Utils.formatCurrency(r.debit) + '</td>' +
      '<td>' + Utils.formatCurrency(r.credit) + '</td>' +
      '</tr>'
    ).join('');
  },

  _updateStats(data) {
    const container = Utils.getEl('importStats');
    if (!container) return;

    const totalDebit = data.reduce((s, r) => s + r.debit, 0);
    const totalCredit = data.reduce((s, r) => s + r.credit, 0);
    const diff = Math.abs(totalDebit - totalCredit);

    container.innerHTML =
      '<span class="badge badge-info">إجمالي السجلات: ' + data.length + '</span>' +
      '<span class="badge badge-correct">إجمالي المدين: ' + Utils.formatCurrency(totalDebit) + '</span>' +
      '<span class="badge badge-warning">إجمالي الدائن: ' + Utils.formatCurrency(totalCredit) + '</span>' +
      (diff > 0
        ? '<span class="badge badge-critical">فرق: ' + Utils.formatCurrency(diff) + '</span>'
        : '<span class="badge badge-correct">متوازن ✓</span>');
  },

  _resetUploadUI() {
    if (!this._dropZone) return;
    this._dropZone.classList.remove('has-file');
    this._dropZone.querySelector('.upload-text').textContent = 'ارفع ملف البيانات المالية هنا';
    this._dropZone.querySelector('.upload-hint').textContent = 'يدعم: .xlsx, .xls, .csv - أقصى حجم ١٠ ميجابايت';
    if (this._fileInput) this._fileInput.value = '';
  },

  clearData() {
    Store.set('importedData', []);
    Store.set('auditFindings', []);
    Store.set('auditCompleted', false);
    const tbody = Utils.getEl('importedDataTable');
    if (tbody) tbody.innerHTML = this._emptyRow(5);
    const stats = Utils.getEl('importStats');
    if (stats) stats.innerHTML = '';
    Toast.show('تم مسح جميع البيانات', 'info');
  },

  _emptyRow(colspan) {
    return '<tr><td colspan="' + colspan + '" class="table-empty">' +
      '<div class="table-empty-icon">📂</div>' +
      '<div class="table-empty-text">لم يتم استيراد بيانات بعد</div>' +
      '<div class="table-empty-hint">قم برفع ملف Excel أو CSV للبدء</div>' +
      '</td></tr>';
  },

  exportData() {
    const data = Store.get('importedData');
    if (data.length === 0) {
      Toast.show('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data.map(r => ({
      'الحساب': r.account,
      'الوصف': r.description,
      'مدين': r.debit,
      'دائن': r.credit,
      'التاريخ': r.date,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات التدقيق');
    XLSX.writeFile(wb, 'audit_data_' + Date.now() + '.xlsx');
    Toast.show('تم تصدير البيانات بنجاح', 'success');
  },
};

/* ============================================================
   AI AUDITOR MODULE
   ============================================================ */

const AIAuditor = {
  _interval: null,

  init() {
    // Sensitivity change handler
    const sel = Utils.getEl('auditSensitivity');
    if (sel) {
      sel.addEventListener('change', () => {
        if (Store.get('auditCompleted')) {
          this._rerunWithSettings();
        }
      });
    }
  },

  run() {
    const data = Store.get('importedData');
    if (data.length === 0) {
      Toast.show('الرجاء استيراد البيانات أولاً', 'warning');
      return;
    }

    if (Store.get('isAuditing')) {
      Toast.show('جاري التدقيق بالفعل...', 'warning');
      return;
    }

    Store.set('isAuditing', true);
    Store.set('auditFindings', []);
    this._updateProgress(0, 'جاري تحليل البيانات...');

    this._resetStats(data.length);

    let step = 0;
    this._interval = setInterval(() => {
      step++;
      const pct = Math.round((step / CONFIG.AUDIT_STEPS) * 100);
      this._updateProgress(pct, 'جاري التدقيق... ' + pct + '%');

      if (step >= CONFIG.AUDIT_STEPS) {
        clearInterval(this._interval);
        this._interval = null;
        this._performAudit(data);
      }
    }, CONFIG.AUDIT_INTERVAL_MS);
  },

  _resetStats(total) {
    const totalEl = Utils.getEl('auditTotalTxns');
    const correctEl = Utils.getEl('auditCorrectTxns');
    const suspiciousEl = Utils.getEl('auditSuspiciousTxns');

    if (totalEl) totalEl.textContent = Utils.formatNumber(total);
    if (correctEl) correctEl.textContent = '٠';
    if (suspiciousEl) suspiciousEl.textContent = '٠';
  },

  _updateProgress(pct, label) {
    const bar = Utils.getEl('auditProgress');
    const labelEl = Utils.getEl('auditProgressLabel');
    if (bar) bar.style.width = pct + '%';
    if (labelEl) labelEl.textContent = label;
  },

  _performAudit(data) {
    const sensitivity = (Utils.getEl('auditSensitivity')?.value) || 'medium';
    const findings = [];
    const multiplier = sensitivity === 'low' ? 0.5 : sensitivity === 'high' ? 2 : 1;

    // 1. Duplicate entries
    this._findDuplicates(data, findings);

    // 2. Unbalanced entries
    this._findUnbalanced(data, findings);

    // 3. Tax errors
    this._findTaxErrors(data, findings, multiplier);

    // 4. Round-number suspicious entries
    this._findRoundNumbers(data, findings, multiplier);

    // 5. Large variations
    this._findLargeVariations(data, findings, multiplier);

    // 6. Simulated findings for demo if none found
    if (findings.length === 0 && data.length > 0) {
      this._generateSimulatedFindings(data, findings);
    }

    Store.set('auditFindings', findings);
    Store.set('auditCompleted', true);
    Store.set('isAuditing', false);

    const correctCount = data.length - findings.length;
    const correctEl = Utils.getEl('auditCorrectTxns');
    const suspiciousEl = Utils.getEl('auditSuspiciousTxns');
    if (correctEl) correctEl.textContent = Utils.formatNumber(correctCount);
    if (suspiciousEl) suspiciousEl.textContent = Utils.formatNumber(findings.length);

    this._updateBadge(findings.length);
    this._updateProgress(100, 'اكتمل التدقيق - تم اكتشاف ' + findings.length + ' حالة');
    this._renderFindings(findings);

    Toast.show(
      'اكتمل التدقيق: تم اكتشاف ' + findings.length + ' حالة',
      findings.length > 0 ? 'warning' : 'success'
    );
  },

  _findDuplicates(data, findings) {
    const seen = new Map();
    data.forEach((row, idx) => {
      const key = row.account + '|' + row.description + '|' + row.debit + '|' + row.credit;
      if (seen.has(key)) {
        findings.push({
          id: Utils.generateId(),
          type: 'duplicate',
          title: 'قيود مكررة',
          desc: 'تم اكتشاف قيد مكرر للحساب: ' + row.account + ' - ' + row.description,
          amount: row.debit || row.credit,
          severity: 'critical',
        });
      }
      seen.set(key, idx);
    });
  },

  _findUnbalanced(data, findings) {
    data.forEach((row) => {
      if (row.debit > 0 && row.credit > 0 && Math.abs(row.debit - row.credit) > 0.01) {
        findings.push({
          id: Utils.generateId(),
          type: 'unbalanced',
          title: 'قيد غير متوازن',
          desc: 'الحساب: ' + row.account + ' - المدين (' + row.debit + ') لا يساوي الدائن (' + row.credit + ')',
          amount: Math.abs(row.debit - row.credit),
          severity: 'critical',
        });
      }
    });
  },

  _findTaxErrors(data, findings, multiplier) {
    const taxKeywords = ['ضريبة', 'ض.', 'vat', 'tax', 'ضريبة'];
    data.forEach((row) => {
      const desc = (row.description || '').toLowerCase();
      if (taxKeywords.some(k => desc.includes(k))) {
        if (row.debit > 100000 * multiplier) {
          findings.push({
            id: Utils.generateId(),
            type: 'tax',
            title: 'اشتباه ضريبي',
            desc: 'مبلغ ضريبي كبير يحتاج للتحقق: ' + row.account + ' - ' + row.description,
            amount: row.debit,
            severity: Math.random() > 0.5 ? 'warning' : 'critical',
          });
        }
      }
    });
  },

  _findRoundNumbers(data, findings, multiplier) {
    data.forEach((row) => {
      const amt = row.debit || row.credit;
      if (amt > 0 && amt % 1000 === 0 && amt > 50000 * multiplier) {
        findings.push({
          id: Utils.generateId(),
          type: 'suspicious',
          title: 'مبلغ مستدير مشبوه',
          desc: 'مبلغ ' + Utils.formatCurrency(amt) + ' للحساب: ' + row.account + ' قد يكون مبلغاً مقدراً',
          amount: amt,
          severity: 'warning',
        });
      }
    });
  },

  _findLargeVariations(data, findings, multiplier) {
    const amounts = data.map(r => r.debit || r.credit).filter(a => a > 0);
    if (amounts.length === 0) return;

    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const threshold = avg * 3 * multiplier;

    data.forEach((row) => {
      const amt = row.debit || row.credit;
      if (amt > threshold && amt > 0) {
        findings.push({
          id: Utils.generateId(),
          type: 'large_variation',
          title: 'تباين كبير في المبلغ',
          desc: 'المبلغ ' + Utils.formatCurrency(amt) + ' يتجاوز متوسط المعاملات (' + Utils.formatCurrency(avg) + ')',
          amount: amt,
          severity: 'warning',
        });
      }
    });
  },

  _generateSimulatedFindings(data, findings) {
    const numSim = Math.min(3, Math.max(1, Math.floor(data.length * 0.1)));
    const indices = [];
    const used = new Set();

    while (indices.length < numSim) {
      const idx = Utils.randomBetween(0, data.length - 1);
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
    }

    indices.forEach(idx => {
      const row = data[idx];
      const amt = row.debit || row.credit || 0;
      const isCritical = Math.random() > 0.6;
      findings.push({
        id: Utils.generateId(),
        type: 'simulated',
        title: isCritical ? 'خطأ محاسبي محتمل' : 'ملاحظة تدقيق',
        desc: 'الحساب: ' + (row.account || 'غير محدد') + ' - يوصى بمراجعة هذا القيد',
        amount: amt,
        severity: isCritical ? 'critical' : 'warning',
      });
    });
  },

  _updateBadge(count) {
    const badge = Utils.getEl('findingsBadge');
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
  },

  _renderFindings(findings) {
    const container = Utils.getEl('findingsList');
    const countEl = Utils.getEl('findingsCount');
    if (!container) return;

    if (countEl) {
      countEl.textContent = findings.length + ' نتيجة';
    }

    if (findings.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon">✅</div>' +
        '<div class="empty-state-title">جميع القيود سليمة</div>' +
        '<div class="empty-state-desc">لم يتم اكتشاف أي مشاكل في البيانات المالية</div>' +
        '</div>';
      return;
    }

    container.innerHTML = findings.map(f => {
      const sevClass = f.severity === 'critical' ? 'badge-critical' : 'badge-warning';
      const sevLabel = f.severity === 'critical' ? '✘ خطأ' : '⚠ تنبيه';
      const borderColor = f.severity === 'critical' ? 'var(--red)' : 'var(--gold)';
      const pulseClass = f.severity === 'critical' ? 'red' : 'gold';
      return '<div class="finding-item" style="border-right:3px solid ' + borderColor + '">' +
        '<div class="finding-header">' +
        '<span class="status-pulse ' + pulseClass + '"></span>' +
        '<span class="finding-title">' + f.title + '</span>' +
        '<span class="badge ' + sevClass + '" style="margin-right:auto">' + sevLabel + '</span>' +
        '</div>' +
        '<div class="finding-desc">' + f.desc + '</div>' +
        '<div class="finding-amount">' + Utils.formatCurrency(f.amount) + '</div>' +
        '</div>';
    }).join('');
  },

  _rerunWithSettings() {
    const data = Store.get('importedData');
    if (data.length > 0) {
      this._performAudit(data);
    }
  },
};

/* ============================================================
   DASHBOARD / CHARTS MODULE
   ============================================================ */

const Dashboard = {
  _finChart: null,
  _cashChart: null,

  init() {
    this._initCharts();
    this._animateStats();
  },

  _initCharts() {
    this._initFinHealthChart();
    this._initCashFlowChart();
  },

  _initFinHealthChart() {
    const canvas = Utils.getEl('finHealthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (this._finChart) this._finChart.destroy();

    this._finChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['الأصول', 'الخصوم', 'حقوق الملكية', 'الإيرادات', 'صافي الربح'],
        datasets: [{
          label: 'القيمة (ر.س)',
          data: [1250000, 780000, 470000, 1250000, 470000],
          backgroundColor: [
            'rgba(46,204,113,0.8)', 'rgba(231,76,60,0.8)',
            'rgba(52,152,219,0.8)', 'rgba(243,156,18,0.8)',
            'rgba(46,204,113,0.8)',
          ],
          borderColor: ['#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#2ECC71'],
          borderWidth: 2,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: getComputedStyle(document.documentElement)
                .getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.06)' },
            ticks: { color: 'var(--text-secondary)' },
          },
          x: {
            grid: { display: false },
            ticks: { color: 'var(--text-secondary)' },
          },
        },
      },
    });
  },

  _initCashFlowChart() {
    const canvas = Utils.getEl('cashFlowChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (this._cashChart) this._cashChart.destroy();

    this._cashChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
        datasets: [
          {
            label: 'التدفقات الداخلة',
            data: [320000, 280000, 350000, 300000, 380000, 340000],
            borderColor: '#2ECC71',
            backgroundColor: 'rgba(46,204,113,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'التدفقات الخارجة',
            data: [250000, 270000, 240000, 260000, 230000, 280000],
            borderColor: '#E74C3C',
            backgroundColor: 'rgba(231,76,60,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'var(--text-secondary)' },
          },
        },
        scales: {
          y: {
            grid: { color: 'var(--chart-grid)' },
            ticks: { color: 'var(--text-secondary)' },
          },
          x: {
            grid: { display: false },
            ticks: { color: 'var(--text-secondary)' },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  },

  _animateStats() {
    const targets = [
      { id: 'totalAssets', val: 1250000 },
      { id: 'totalLiabilities', val: 780000 },
      { id: 'netProfit', val: 470000 },
      { id: 'discrepancyCount', val: 12 },
    ];

    targets.forEach(({ id, val }) => {
      const el = Utils.getEl(id);
      if (el) {
        const numEl = el;
        const currentText = numEl.textContent;
        const currentNum = parseFloat(currentText.replace(/[^0-9]/g, '')) || 0;
        if (currentNum !== val) {
          Utils.animateNumber(numEl, val);
        }
      }
    });
  },
};

/* ============================================================
   CALCULATORS MODULE
   ============================================================ */

const Calculators = {
  _ratiosChart: null,

  init() {
    this._initTabs();
    this.calcVAT();
    this.calcDepreciation();
    this.calcRatios();
  },

  _initTabs() {
    document.querySelectorAll('#calcTabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#calcTabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.calc-pane').forEach(p => p.style.display = 'none');
        const pane = Utils.getEl('calc-' + tab.dataset.calc);
        if (pane) pane.style.display = 'block';
        if (tab.dataset.calc === 'ratios') this._initRatiosChart();
      });
    });
  },

  calcVAT() {
    const amount = parseFloat(Utils.getEl('vatAmount')?.value) || 0;
    const rate = parseFloat(Utils.getEl('vatRate')?.value) || 0;
    const type = Utils.getEl('vatType')?.value || 'exclude';

    let tax, base;
    if (type === 'exclude') {
      tax = amount * (rate / 100);
      base = amount;
    } else {
      const total = amount;
      base = total / (1 + rate / 100);
      tax = total - base;
    }

    const totalInc = amount + (type === 'exclude' ? tax : 0);

    const resultEl = Utils.getEl('vatResultValue');
    if (resultEl) resultEl.textContent = Utils.formatCurrency(tax);
    this._setText('vatBaseDisplay', Utils.formatCurrency(base));
    this._setText('vatTaxDisplay', Utils.formatCurrency(tax));
    this._setText('vatTotalDisplay', Utils.formatCurrency(totalInc));
  },

  calcDepreciation() {
    const cost = parseFloat(Utils.getEl('depCost')?.value) || 0;
    const salvage = parseFloat(Utils.getEl('depSalvage')?.value) || 0;
    const life = parseFloat(Utils.getEl('depLife')?.value) || 1;

    const base = cost - salvage;
    const annual = base / life;
    const monthly = annual / 12;

    this._setText('depResultValue', Utils.formatCurrency(annual));
    this._setText('depBaseDisplay', Utils.formatCurrency(base));
    this._setText('depMonthlyDisplay', Utils.formatCurrency(monthly));
    this._setText('depAnnualDisplay', Utils.formatCurrency(annual));
  },

  calcRatios() {
    const assets = parseFloat(Utils.getEl('ratioAssets')?.value) || 0;
    const liabilities = parseFloat(Utils.getEl('ratioLiabilities')?.value) || 0;
    const equity = parseFloat(Utils.getEl('ratioEquity')?.value) || 1;
    const netProfit = parseFloat(Utils.getEl('ratioNetProfit')?.value) || 0;
    const revenue = parseFloat(Utils.getEl('ratioRevenue')?.value) || 1;
    const currAssets = parseFloat(Utils.getEl('ratioCurrentAssets')?.value) || 0;
    const currLiab = parseFloat(Utils.getEl('ratioCurrentLiabilities')?.value) || 1;

    const de = liabilities / equity;
    const pm = (netProfit / revenue) * 100;
    const cr = currAssets / currLiab;
    const roa = (netProfit / assets) * 100;
    const roe = (netProfit / equity) * 100;

    this._setText('rDebtEquity', de.toFixed(2));
    this._setText('rProfitMargin', pm.toFixed(1) + '%');
    this._setText('rCurrentRatio', cr.toFixed(2));
    this._setText('rROA', roa.toFixed(1) + '%');
    this._setText('rROE', roe.toFixed(1) + '%');
    this._setText('debtEquityRatio', de.toFixed(2));
    this._setText('profitMargin', pm.toFixed(1) + '%');

    this._initRatiosChart();
  },

  _initRatiosChart() {
    const canvas = Utils.getEl('ratiosChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (this._ratiosChart) this._ratiosChart.destroy();

    const de = parseFloat(Utils.getEl('rDebtEquity')?.textContent) || 0;
    const pm = parseFloat(Utils.getEl('rProfitMargin')?.textContent) || 0;
    const cr = parseFloat(Utils.getEl('rCurrentRatio')?.textContent) || 0;

    this._ratiosChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['المديونية', 'هامش الربح', 'التداول'],
        datasets: [{
          label: 'النسب المالية',
          data: [
            Math.min(de * 50, 100),
            Math.min(pm, 100),
            Math.min(cr * 30, 100),
          ],
          backgroundColor: 'rgba(46,204,113,0.2)',
          borderColor: '#2ECC71',
          borderWidth: 2,
          pointBackgroundColor: '#2ECC71',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, color: 'var(--text-secondary)' },
            grid: { color: 'var(--chart-grid)' },
            pointLabels: { color: 'var(--text-secondary)' },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  },

  _setText(id, text) {
    const el = Utils.getEl(id);
    if (el) el.textContent = text;
  },
};

/* ============================================================
   REPORT / PDF MODULE
   ============================================================ */

const Report = {
  preview() {
    const client = Utils.getEl('reportClient')?.value || 'العميل';
    const period = Utils.getEl('reportPeriod')?.value || 'الفترة';
    const notes = Utils.getEl('reportNotes')?.value || '';
    const findings = Store.get('auditFindings') || [];

    const preview = Utils.getEl('reportPreview');
    if (!preview) return;

    const de = Utils.getEl('rDebtEquity')?.textContent || '٠';
    const pm = Utils.getEl('rProfitMargin')?.textContent || '٠';
    const cr = Utils.getEl('rCurrentRatio')?.textContent || '٠';

    preview.innerHTML =
      '<div class="rep-header">' +
      '<h3>تقرير التدقيق المالي</h3>' +
      '<div style="color:var(--text-secondary);font-size:12px">' + client + ' - ' + period + '</div></div>' +
      '<div class="rep-section"><strong>ملخص التدقيق:</strong><br>تم إجراء التدقيق على البيانات المالية للفترة المنتهية. ' +
      (findings.length > 0
        ? 'أظهرت نتائج التدقيق وجود ' + findings.length + ' حالة عدم تطابق.'
        : 'جميع القيود سليمة ولم يتم اكتشاف أي مشاكل.') +
      '</div>' +
      '<div class="rep-section"><strong>تفاصيل نتائج التدقيق:</strong><br>' +
      (findings.length > 0
        ? findings.slice(0, 5).map(f => '• ' + f.title + ' - ' + f.desc).join('<br>')
        : '• لا توجد ملاحظات') +
      '</div>' +
      '<div class="rep-section"><strong>النسب المالية الرئيسية:</strong><br>' +
      'نسبة المديونية: ' + de + ' | هامش الربح: ' + pm + ' | نسبة التداول: ' + cr +
      '</div>' +
      (notes ? '<div class="rep-section"><strong>ملاحظات:</strong><br>' + notes + '</div>' : '') +
      '<div class="rep-footer">' +
      'تقرير تم إنشاؤه بواسطة منصة المدقق الذكي - ' + new Date().toLocaleDateString('ar-SA') +
      '</div>';

    Toast.show('تم إنشاء معاينة التقرير', 'success');
  },

  async generatePDF() {
    Toast.show('جاري إنشاء ملف PDF...', 'info');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Title block
    doc.setFillColor(10, 25, 47);
    doc.rect(0, 0, pw, 50, 'F');
    doc.setFontSize(22);
    doc.setTextColor(46, 204, 113);
    doc.text('تقرير التدقيق المالي', pw - 20, 30, { align: 'right' });
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('منصة المدقق الذكي - للتدقيق المالي الاحترافي', pw - 20, 42, { align: 'right' });

    // Client info
    const client = Utils.getEl('reportClient')?.value || 'العميل';
    const period = Utils.getEl('reportPeriod')?.value || 'الفترة';
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.text('العميل: ' + client, pw - 20, 65, { align: 'right' });
    doc.text('الفترة: ' + period, pw - 20, 75, { align: 'right' });
    doc.text('تاريخ التقرير: ' + new Date().toLocaleDateString('ar-SA'), pw - 20, 85, { align: 'right' });

    // Divider
    doc.setDrawColor(46, 204, 113);
    doc.setLineWidth(0.5);
    doc.line(20, 92, pw - 20, 92);

    const findings = Store.get('auditFindings') || [];
    let y = 105;

    // Summary
    doc.setFontSize(14);
    doc.setTextColor(10, 25, 47);
    doc.text('ملخص التدقيق', pw - 20, y, { align: 'right' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const summaryText = findings.length > 0
      ? 'تم إجراء التدقيق على البيانات المالية للفترة المذكورة. أظهرت النتائج وجود ' + findings.length + ' حالة عدم تطابق.'
      : 'تم إجراء التدقيق على البيانات المالية للفترة المذكورة. جميع القيود سليمة.';
    doc.text(summaryText, pw - 20, y, { align: 'right', maxWidth: 160 });
    y += 12;

    // Ratios
    const de = Utils.getEl('rDebtEquity')?.textContent || '٠';
    const pm = Utils.getEl('rProfitMargin')?.textContent || '٠';
    const cr = Utils.getEl('rCurrentRatio')?.textContent || '٠';
    doc.setFontSize(14);
    doc.setTextColor(10, 25, 47);
    doc.text('النسب المالية الرئيسية', pw - 20, y, { align: 'right' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('نسبة المديونية: ' + de + ' | هامش الربح: ' + pm + ' | نسبة التداول: ' + cr, pw - 20, y, { align: 'right' });
    y += 12;

    // Findings table
    if (findings.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(10, 25, 47);
      doc.text('نتائج التدقيق', pw - 20, y, { align: 'right' });
      y += 8;

      // Table header
      doc.setFillColor(10, 25, 47);
      doc.rect(20, y, pw - 40, 7, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('الوصف', pw - 25, y + 5, { align: 'right' });
      doc.text('النوع', 100, y + 5, { align: 'right' });
      doc.text('المبلغ', 50, y + 5, { align: 'right' });
      y += 10;

      // Check if we need a new page
      const maxRows = Math.min(findings.length, 8);
      for (let i = 0; i < maxRows; i++) {
        if (y > ph - 30) {
          doc.addPage();
          y = 20;
        }
        const f = findings[i];
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        if (i % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(20, y - 2, pw - 40, 7, 'F');
        }
        const desc = f.title.length > 35 ? f.title.substring(0, 35) + '..' : f.title;
        doc.text(desc, pw - 25, y + 3, { align: 'right' });
        doc.text(f.severity === 'critical' ? 'خطأ' : 'تنبيه', 100, y + 3, { align: 'right' });
        doc.text(Utils.formatCurrency(f.amount), 50, y + 3, { align: 'right' });
        y += 7;
      }
      y += 8;
    }

    // Notes
    const notes = Utils.getEl('reportNotes')?.value || '';
    if (notes) {
      if (y > ph - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(10, 25, 47);
      doc.text('ملاحظات إضافية', pw - 20, y, { align: 'right' });
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(notes, pw - 20, y, { align: 'right', maxWidth: 160 });
      y += 12;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'تم الإنشاء بواسطة منصة المدقق الذكي - جميع الحقوق محفوظة © ' + new Date().getFullYear(),
      pw / 2, ph - 15, { align: 'center' }
    );

    // Watermark
    doc.setFontSize(40);
    doc.setTextColor(230, 230, 230);
    doc.text('المدقق الذكي', pw / 2, ph / 2, { align: 'center', angle: 45 });

    doc.save('audit_report_' + Date.now() + '.pdf');
    Toast.show('تم تصدير التقرير بنجاح', 'success');
  },
};

/* ============================================================
   ADMIN MODULE
   ============================================================ */

const Admin = {
  init() {
    this._renderClients();
  },

  showAddClientModal() {
    Modal.open('addClientModal');
    ['newClientName', 'newClientEmail', 'newClientPhone', 'newClientNotes'].forEach(id => {
      const el = Utils.getEl(id);
      if (el) el.value = '';
    });
  },

  addClient() {
    const name = Utils.getEl('newClientName')?.value.trim();
    if (!name) {
      Toast.show('الرجاء إدخال اسم العميل', 'error');
      return;
    }

    const clients = Store.get('clients');
    clients.push({
      name,
      lastAudit: new Date().toISOString().split('T')[0],
      status: 'نشط',
      email: Utils.getEl('newClientEmail')?.value || '',
      phone: Utils.getEl('newClientPhone')?.value || '',
    });
    Store.set('clients', clients);
    this._renderClients();
    Modal.close('addClientModal');
    Toast.show('تم إضافة العميل ' + name + ' بنجاح', 'success');
  },

  async deleteClient(index) {
    const client = Store.get('clients')[index];
    if (!client) return;

    const confirmed = await Confirm.show({
      title: 'حذف العميل',
      message: 'هل أنت متأكد من حذف العميل "' + client.name + '"؟',
      confirmText: 'حذف',
      danger: true,
    });

    if (confirmed) {
      const clients = Store.get('clients');
      clients.splice(index, 1);
      Store.set('clients', clients);
      this._renderClients();
      Toast.show('تم حذف العميل بنجاح', 'success');
    }
  },

  _renderClients() {
    const tbody = Utils.getEl('clientTableBody');
    if (!tbody) return;

    const clients = Store.get('clients');
    if (clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">' +
        '<div class="table-empty-icon">👥</div>' +
        '<div class="table-empty-text">لا يوجد عملاء</div>' +
        '<div class="table-empty-hint">قم بإضافة عميل جديد للبدء</div>' +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = clients.map((c, i) => {
      const badgeClass = c.status === 'نشط' ? 'badge-correct'
        : c.status === 'قيد المراجعة' ? 'badge-warning'
        : 'badge-critical';
      return '<tr>' +
        '<td>' + Utils.escapeHtml(c.name) + '</td>' +
        '<td>' + c.lastAudit + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + c.status + '</span></td>' +
        '<td>' +
        '<button class="btn btn-sm btn-ghost" data-action="view-client" data-index="' + i + '" title="فتح الملف">📂</button>' +
        '<button class="btn btn-sm btn-ghost" data-action="delete-client" data-index="' + i + '" title="حذف">🗑️</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    // Attach event listeners using delegation
    tbody.querySelectorAll('[data-action="delete-client"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteClient(parseInt(btn.dataset.index)));
    });
    tbody.querySelectorAll('[data-action="view-client"]').forEach(btn => {
      btn.addEventListener('click', () => Toast.show('تم فتح ملف العميل', 'info'));
    });
  },

  saveSettings() {
    Toast.show('تم حفظ الإعدادات بنجاح', 'success');
  },
};

/* ============================================================
   APP INITIALIZATION
   ============================================================ */

const App = {
  init() {
    // Init core systems
    Toast.init();
    Confirm.create();
    ThemeManager.init();
    Router.init();
    DataIngestion.init();
    AIAuditor.init();

    // Register routes
    Router.register('dashboard', {
      title: 'لوحة التحكم',
      breadcrumb: 'الرئيسية / لوحة التحكم',
      onEnter: () => Dashboard.init(),
    });
    Router.register('ingestion', {
      title: 'استيراد البيانات',
      breadcrumb: 'الرئيسية / استيراد البيانات',
    });
    Router.register('auditor', {
      title: 'المدقق الآلي',
      breadcrumb: 'الرئيسية / المدقق الآلي',
    });
    Router.register('reports', {
      title: 'تقارير التدقيق',
      breadcrumb: 'الرئيسية / تقارير التدقيق',
    });
    Router.register('calculators', {
      title: 'الحاسبات المالية',
      breadcrumb: 'الرئيسية / الحاسبات المالية',
      onEnter: () => Calculators.init(),
    });
    Router.register('admin', {
      title: 'لوحة الإدارة',
      breadcrumb: 'الرئيسية / لوحة الإدارة',
      onEnter: () => Admin.init(),
    });

    // Global event delegation for data-action buttons
    this._setupEventDelegation();

    // Hamburger
    const hamburger = Utils.getEl('hamburgerBtn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
      });
    }

    // Click outside sidebar to close (mobile)
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('sidebar');
      const hamburgerBtn = document.getElementById('hamburgerBtn');
      if (window.innerWidth <= 768 &&
          sidebar?.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !hamburgerBtn?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(el => {
          el.classList.remove('show');
        });
      }
    });

    // Apply theme
    ThemeManager.apply(Store.get('theme'));

    // Load demo data
    this._loadDemoData();

    // Init calculators
    Calculators.init();

    // Navigate to default
    Router.navigate('dashboard');
  },

  _setupEventDelegation() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      switch (action) {
        case 'navigate':
          Router.navigate(btn.dataset.page);
          break;
        case 'process-file':
          DataIngestion.processFile();
          break;
        case 'clear-data':
          DataIngestion.clearData();
          break;
        case 'export-data':
          DataIngestion.exportData();
          break;
        case 'run-audit':
          AIAuditor.run();
          break;
        case 'generate-pdf':
          Report.generatePDF();
          break;
        case 'preview-report':
          Report.preview();
          break;
        case 'add-client':
          Admin.showAddClientModal();
          break;
        case 'confirm-add-client':
          Admin.addClient();
          break;
        case 'close-modal':
          Modal.close(btn.dataset.modal);
          break;
        case 'save-settings':
          Admin.saveSettings();
          break;
        default:
          if (action.startsWith('view-client') || action.startsWith('delete-client')) {
            // handled inline in Admin._renderClients
          }
      }
    });

    // Calculator input handlers (debounced)
    const calcInputs = document.querySelectorAll(
      '#vatAmount, #vatRate, #vatType, ' +
      '#depCost, #depSalvage, #depLife, ' +
      '#ratioAssets, #ratioLiabilities, #ratioEquity, #ratioNetProfit, ' +
      '#ratioRevenue, #ratioCurrentAssets, #ratioCurrentLiabilities'
    );
    calcInputs.forEach(input => {
      const eventType = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(eventType, Utils.debounce(() => {
        if (input.id.startsWith('vat')) Calculators.calcVAT();
        else if (input.id.startsWith('dep')) Calculators.calcDepreciation();
        else if (input.id.startsWith('ratio')) Calculators.calcRatios();
      }, 150));
    });
  },

  _loadDemoData() {
    const demoData = [
      { account: '١١١٠٠١', description: 'مشتريات مواد خام', debit: 45000, credit: 0, date: '2026-05-10' },
      { account: '٢١١٠٠٢', description: 'مصروفات تشغيلية', debit: 12500, credit: 0, date: '2026-05-09' },
      { account: '٣١١٠٠٣', description: 'إيرادات مبيعات', debit: 0, credit: 98000, date: '2026-05-08' },
      { account: '٤١١٠٠٤', description: 'مصروف ضرائب', debit: 22300, credit: 0, date: '2026-05-07' },
      { account: '٥١١٠٠٥', description: 'إهلاك أصول', debit: 8750, credit: 0, date: '2026-05-06' },
      { account: '١١١٠٠٦', description: 'مشتريات مواد خام', debit: 45000, credit: 0, date: '2026-05-10' },
      { account: '٦١١٠٠٧', description: 'مرتبات موظفين', debit: 32000, credit: 0, date: '2026-05-05' },
      { account: '٧١١٠٠٨', description: 'إيرادات استشارات', debit: 0, credit: 15000, date: '2026-05-04' },
      { account: '٨١١٠٠٩', description: 'مصروف صيانة', debit: 5000, credit: 0, date: '2026-05-03' },
      { account: '٩١١٠١٠', description: 'ضريبة مبيعات', debit: 18000, credit: 0, date: '2026-05-02' },
    ];

    Store.set('importedData', demoData);

    // Render imported table
    DataIngestion._renderTable(demoData);
    DataIngestion._updateStats(demoData);

    // Set recent transactions on dashboard
    const recentTbody = Utils.getEl('recentTransactions');
    if (recentTbody) {
      recentTbody.innerHTML = demoData.slice(0, 5).map(r =>
        '<tr><td>' + r.date + '</td><td>' + r.description + '</td><td>' +
        Utils.formatCurrency(r.debit || r.credit) +
        '</td><td><span class="badge badge-correct">✔ سليم</span></td><td>النظام</td></tr>'
      ).join('');
    }
  },
};

/* ---- DOM Ready ---- */
document.addEventListener('DOMContentLoaded', () => App.init());
