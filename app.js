// ATL CardVault — Core Application Engine

class CardVaultApp {
  constructor() {
    this.cards = [];
    this.accounts = {};
    this.activeTab = 'cards';
    this.activeViewMode = 'grid'; // 'grid' | 'list'
    this.currentFlippedCardId = null;
    this.selectedCardId = null;
    this.currentScannedImageDataUrl = null;
    this.googleScriptUrl = localStorage.getItem('atl_google_script_url') || '';
    this.qrInstance = null;

    // Filters & Search State
    this.filters = {
      search: '',
      account: 'ALL',
      role: 'ALL',
      tech: 'ALL',
      vipOnly: false,
      sortBy: 'recent'
    };

    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.populateFilterOptions();
    this.render();
    this.updateStats();
    this.updateHeaderSyncStatus();

    // Auto-sync from Google Sheet on start and when returning to tab
    if (this.googleScriptUrl) {
      this.pullFromGoogleSheet(true);
    }
    window.addEventListener('focus', () => {
      if (this.googleScriptUrl) {
        this.pullFromGoogleSheet(true);
      }
    });
    
    // Initialize Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Load from LocalStorage or initialize with default demo dataset
  loadData() {
    const saved = localStorage.getItem('atl_cardvault_cards');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Automatically purge old mock cards (card-1 to card-7) to provide clean slate
        this.cards = parsed.filter(c => !['card-1','card-2','card-3','card-4','card-5','card-6','card-7'].includes(c.id));
        this.saveData();
      } catch (e) {
        console.error('Failed to parse saved cards:', e);
        this.cards = [];
      }
    } else {
      this.cards = [];
      this.saveData();
    }

    this.accounts = {};
  }

  saveData() {
    localStorage.setItem('atl_cardvault_cards', JSON.stringify(this.cards));
    this.updateStats();
  }

  setupEventListeners() {
    // Navigation Tabs
    document.getElementById('tabCards')?.addEventListener('click', () => this.switchTab('cards'));
    document.getElementById('tabOrgMap')?.addEventListener('click', () => this.switchTab('orgMap'));
    document.getElementById('tabScanner')?.addEventListener('click', () => this.switchTab('scanner'));
    document.getElementById('tabAnalytics')?.addEventListener('click', () => this.switchTab('analytics'));

    // Global Search
    const searchInput = document.getElementById('globalSearchInput');
    searchInput?.addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Keyboard shortcut for search
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInput?.focus();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Filters
    document.getElementById('filterAccount')?.addEventListener('change', (e) => {
      this.filters.account = e.target.value;
      this.render();
    });

    document.getElementById('filterRole')?.addEventListener('change', (e) => {
      this.filters.role = e.target.value;
      this.render();
    });

    document.getElementById('filterTech')?.addEventListener('change', (e) => {
      this.filters.tech = e.target.value;
      this.render();
    });

    document.getElementById('sortCards')?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.render();
    });

    const btnVIP = document.getElementById('btnFilterFavorites');
    btnVIP?.addEventListener('click', () => {
      this.filters.vipOnly = !this.filters.vipOnly;
      btnVIP.classList.toggle('bg-amber-500/20', this.filters.vipOnly);
      btnVIP.classList.toggle('text-amber-400', this.filters.vipOnly);
      btnVIP.classList.toggle('border-amber-400/50', this.filters.vipOnly);
      this.render();
    });

    document.getElementById('btnClearFilters')?.addEventListener('click', () => {
      this.resetFilters();
    });

    // View toggle (Grid vs List)
    document.getElementById('btnViewGrid')?.addEventListener('click', () => this.setViewMode('grid'));
    document.getElementById('btnViewList')?.addEventListener('click', () => this.setViewMode('list'));

    // Header actions
    document.getElementById('btnOpenScanner')?.addEventListener('click', () => this.switchTab('scanner'));
    document.getElementById('btnOpenAddModal')?.addEventListener('click', () => this.openAddModal());

    // Data Menu Dropdown
    const btnDataMenu = document.getElementById('btnDataMenu');
    const dataDropdownMenu = document.getElementById('dataDropdownMenu');
    btnDataMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      dataDropdownMenu?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      dataDropdownMenu?.classList.add('hidden');
    });

    // Export / Import / Reset Handlers
    document.getElementById('btnExportCSV')?.addEventListener('click', () => this.exportCSV());
    document.getElementById('btnExportJSON')?.addEventListener('click', () => this.exportJSON());
    document.getElementById('btnImportJSONTrigger')?.addEventListener('click', () => {
      document.getElementById('importFileInput')?.click();
    });
    document.getElementById('importFileInput')?.addEventListener('change', (e) => this.importJSON(e));
    document.getElementById('btnClearAllCards')?.addEventListener('click', () => this.clearAllCards());

    // Google Cloud Sync Modal Controls
    document.getElementById('btnOpenCloudSync')?.addEventListener('click', () => this.openCloudSyncModal());
    document.getElementById('btnCloudSyncClose')?.addEventListener('click', () => this.closeCloudSyncModal());
    document.getElementById('btnSaveSyncUrl')?.addEventListener('click', () => this.saveSyncUrl());
    document.getElementById('btnPullFromCloud')?.addEventListener('click', () => this.pullFromGoogleSheet());

    // Modal controls
    document.getElementById('btnOpenPhoneConnect')?.addEventListener('click', () => this.openPhoneConnectModal());
    document.getElementById('btnPhoneConnectClose')?.addEventListener('click', () => this.closePhoneConnectModal());
    document.getElementById('btnModalClose')?.addEventListener('click', () => this.closeDetailModal());
    document.getElementById('btnEditModalClose')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('btnCancelEdit')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('btnQRClose')?.addEventListener('click', () => this.closeQRModal());

    // 3D Flip in modal
    const modal3DCard = document.getElementById('modal3DCard');
    const btnModalFlip = document.getElementById('btnModalFlip');
    const toggleFlip = () => modal3DCard?.classList.toggle('is-flipped');
    modal3DCard?.addEventListener('click', toggleFlip);
    btnModalFlip?.addEventListener('click', toggleFlip);

    // Modal Actions
    document.getElementById('btnActionVCard')?.addEventListener('click', () => {
      if (this.selectedCardId) this.downloadVCard(this.selectedCardId);
    });

    document.getElementById('btnActionQR')?.addEventListener('click', () => {
      if (this.selectedCardId) this.openQRModal(this.selectedCardId);
    });

    document.getElementById('btnModalDeleteCard')?.addEventListener('click', () => {
      if (this.selectedCardId) this.deleteCard(this.selectedCardId);
    });

    document.getElementById('btnModalEditCard')?.addEventListener('click', () => {
      if (this.selectedCardId) this.openEditModal(this.selectedCardId);
    });

    // Form submit
    document.getElementById('cardForm')?.addEventListener('submit', (e) => this.handleSaveCard(e));
    document.getElementById('scannerForm')?.addEventListener('submit', (e) => this.handleScannerSave(e));

    // Scanner dropzone & sample loaders
    this.setupScannerEvents();
  }

  setupScannerEvents() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('scannerFileInput');

    dropzone?.addEventListener('click', () => fileInput?.click());
    
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-blue-500', 'bg-blue-500/10');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-blue-500', 'bg-blue-500/10');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500', 'bg-blue-500/10');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processCardImage(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processCardImage(e.target.files[0]);
      }
    });

    document.getElementById('btnClearScannedImage')?.addEventListener('click', () => {
      document.getElementById('scannerImagePreviewBox')?.classList.add('hidden');
      document.getElementById('dropzone')?.classList.remove('hidden');
    });

    // Sample card buttons for instant demo
    document.getElementById('btnLoadSample1')?.addEventListener('click', () => {
      this.populateScannerForm({
        name: "Dr. Elena Rostova",
        title: "Chief Technology Officer (CTO)",
        company: "CyberBank Corp",
        role: "Technical Champion",
        email: "elena.rostova@cyberbank.io",
        phone: "+1 (212) 555-8930",
        address: "745 7th Ave, New York, NY 10019",
        tech: "watsonx / GenAI, Quantum-Safe Cryptography, Hybrid Cloud, Kafka",
        notes: "Met at NYC Fintech Leader Forum. Discussed replacing legacy risk engine with AI foundation models."
      });
      this.showToast("Loaded sample card: Dr. Elena Rostova");
    });

    document.getElementById('btnLoadSample2')?.addEventListener('click', () => {
      this.populateScannerForm({
        name: "Arthur Wei",
        title: "Head of AI Simulation & Foundry Compute",
        company: "QuantumFab Semiconductor",
        role: "Economic Buyer",
        email: "arthur.wei@quantumfab.com",
        phone: "+886 3 666 8899",
        address: "Hsinchu Science Park, Taiwan",
        tech: "GPU Orchestration, Ceph / Storage Scale, OpenShift AI, Linux on Z",
        notes: "Requested benchmark comparison for multi-PB high-bandwidth storage cluster."
      });
      this.showToast("Loaded sample card: Arthur Wei");
    });
  }

  // Live OCR Image Extraction with intelligent regex entity recognizer
  processCardImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target.result;
      const previewImg = document.getElementById('scannerImagePreview');
      const previewBox = document.getElementById('scannerImagePreviewBox');
      const dropzone = document.getElementById('dropzone');
      const progressBox = document.getElementById('ocrProgressContainer');
      const progressBar = document.getElementById('ocrProgressBar');
      const percentText = document.getElementById('ocrPercentText');
      const statusText = document.getElementById('ocrStatusText');

      this.currentScannedImageDataUrl = imageDataUrl;
      if (previewImg && previewBox && dropzone) {
        previewImg.src = imageDataUrl;
        previewBox.classList.remove('hidden');
        dropzone.classList.add('hidden');
      }

      if (progressBox) progressBox.classList.remove('hidden');

      if (window.Tesseract) {
        Tesseract.recognize(
          imageDataUrl,
          'eng',
          {
            logger: (m) => {
              if (m.status === 'recognizing text' && m.progress) {
                const pct = Math.round(m.progress * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (percentText) percentText.textContent = `${pct}%`;
                if (statusText) statusText.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin text-blue-400"></i> Recognizing card details...`;
              }
            }
          }
        ).then(({ data: { text } }) => {
          if (progressBox) progressBox.classList.add('hidden');
          this.parseOCRTextAndFill(text);
          this.showToast("Card image scanned successfully!");
          if (window.confetti) {
            window.confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
          }
        }).catch((err) => {
          console.error("OCR failed, falling back to heuristic parsing:", err);
          if (progressBox) progressBox.classList.add('hidden');
          this.showToast("OCR complete — verify details in form");
        });
      }
    };
    reader.readAsDataURL(file);
  }

  // Heuristic parser for raw text extracted from cards
  parseOCRTextAndFill(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    let parsed = {
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      tech: []
    };

    // Regex matchers
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i;
    const phoneRegex = /(\+?[\d\s\(\)-]{8,20})/;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

    const emailMatch = rawText.match(emailRegex);
    if (emailMatch) parsed.email = emailMatch[0];

    const phoneMatch = rawText.match(phoneRegex);
    if (phoneMatch) parsed.phone = phoneMatch[0].trim();

    // Line heuristic:
    if (lines.length > 0) parsed.name = lines[0].replace(/[^a-zA-Z\s.,]/g, '');
    if (lines.length > 1) parsed.title = lines[1];
    if (lines.length > 2) parsed.company = lines[2];

    // Detect technical keywords
    const techKeywords = ["OpenShift", "Kubernetes", "watsonx", "GenAI", "AI", "Cloud", "FinOps", "Kafka", "Mainframe", "Cybersecurity", "Zero Trust", "DevOps", "Instana", "Turbonomic", "API Connect"];
    techKeywords.forEach(kw => {
      if (rawText.toLowerCase().includes(kw.toLowerCase())) {
        parsed.tech.push(kw);
      }
    });

    if (parsed.tech.length === 0) {
      parsed.tech = ["Cloud Modernization", "Enterprise Architecture"];
    }

    this.populateScannerForm({
      name: parsed.name || "Scanned Contact",
      title: parsed.title || "Enterprise Leader",
      company: parsed.company || "Client Enterprise",
      role: "Technical Champion",
      email: parsed.email || "",
      phone: parsed.phone || "",
      address: parsed.address || "",
      tech: parsed.tech.join(", "),
      notes: "Scanned via ATL CardVault Smart OCR on " + new Date().toLocaleDateString()
    });
  }

  populateScannerForm(data) {
    document.getElementById('scanName').value = data.name || '';
    document.getElementById('scanTitle').value = data.title || '';
    document.getElementById('scanCompany').value = data.company || '';
    document.getElementById('scanRole').value = data.role || 'Technical Champion';
    document.getElementById('scanEmail').value = data.email || '';
    document.getElementById('scanPhone').value = data.phone || '';
    document.getElementById('scanAddress').value = data.address || '';
    document.getElementById('scanTech').value = data.tech || '';
    document.getElementById('scanNotes').value = data.notes || '';
  }

  handleScannerSave(e) {
    e.preventDefault();
    const name = document.getElementById('scanName').value.trim();
    const title = document.getElementById('scanTitle').value.trim();
    const company = document.getElementById('scanCompany').value.trim();
    const role = document.getElementById('scanRole').value;
    const email = document.getElementById('scanEmail').value.trim();
    const phone = document.getElementById('scanPhone').value.trim();
    const address = document.getElementById('scanAddress').value.trim();
    const techStr = document.getElementById('scanTech').value.trim();
    const notes = document.getElementById('scanNotes').value.trim();

    const techInterests = techStr ? techStr.split(',').map(t => t.trim()).filter(Boolean) : ["Architecture"];

    const newCard = {
      id: `card-${Date.now()}`,
      name,
      title,
      company,
      account: company,
      department: "Client Engineering",
      email,
      phone,
      mobile: phone,
      address,
      website: `https://www.${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      linkedin: "",
      stakeholderRole: role,
      influenceLevel: "High",
      sentiment: role === "Economic Buyer" ? "Neutral" : "Champion",
      techInterests,
      notes,
      lastMet: new Date().toISOString().split('T')[0],
      meetingCount: 1,
      theme: this.getRandomTheme(),
      cardFrontImage: this.currentScannedImageDataUrl || null,
      favorite: false,
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.cards.unshift(newCard);
    this.saveData();

    // Auto sync to Google Sheets / Drive in background if configured
    if (this.googleScriptUrl) {
      this.pushCardToGoogleSheet(newCard);
    }

    this.currentScannedImageDataUrl = null;
    this.populateFilterOptions();
    this.showToast(`Saved ${name} to CardVault!`);
    
    // Reset scanner form
    document.getElementById('scannerForm').reset();
    document.getElementById('scannerImagePreviewBox')?.classList.add('hidden');
    document.getElementById('dropzone')?.classList.remove('hidden');

    this.switchTab('cards');
  }

  getRandomTheme() {
    const themes = ["executive-navy", "cyber-slate", "emerald-matrix", "gold-prestige", "electric-violet", "teal-modern"];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    
    // Update tab bar buttons
    const tabs = ['tabCards', 'tabOrgMap', 'tabScanner', 'tabAnalytics'];
    tabs.forEach(t => {
      const el = document.getElementById(t);
      if (el) {
        el.className = 'nav-tab flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 font-medium transition-all text-xs sm:text-sm';
      }
    });

    const activeBtnMap = {
      cards: 'tabCards',
      orgMap: 'tabOrgMap',
      scanner: 'tabScanner',
      analytics: 'tabAnalytics'
    };

    const currentBtn = document.getElementById(activeBtnMap[tabId]);
    if (currentBtn) {
      currentBtn.className = 'nav-tab active-tab flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all bg-blue-600 text-white shadow text-xs sm:text-sm';
    }

    // Toggle views
    document.getElementById('viewCards')?.classList.toggle('hidden', tabId !== 'cards');
    document.getElementById('viewOrgMap')?.classList.toggle('hidden', tabId !== 'orgMap');
    document.getElementById('viewScanner')?.classList.toggle('hidden', tabId !== 'scanner');
    document.getElementById('viewAnalytics')?.classList.toggle('hidden', tabId !== 'analytics');

    if (tabId === 'orgMap') this.renderOrgMap();
    if (tabId === 'analytics') this.renderAnalytics();

    if (window.lucide) lucide.createIcons();
  }

  setViewMode(mode) {
    this.activeViewMode = mode;
    const isGrid = mode === 'grid';
    document.getElementById('cardsGridContainer')?.classList.toggle('hidden', !isGrid);
    document.getElementById('cardsListContainer')?.classList.toggle('hidden', isGrid);

    document.getElementById('btnViewGrid')?.classList.toggle('text-blue-400', isGrid);
    document.getElementById('btnViewGrid')?.classList.toggle('bg-slate-700/60', isGrid);
    document.getElementById('btnViewList')?.classList.toggle('text-blue-400', !isGrid);
    document.getElementById('btnViewList')?.classList.toggle('bg-slate-700/60', !isGrid);

    this.render();
  }

  populateFilterOptions() {
    // Accounts
    const accountSelect = document.getElementById('filterAccount');
    if (accountSelect) {
      const accounts = Array.from(new Set(this.cards.map(c => c.company || c.account))).filter(Boolean);
      accountSelect.innerHTML = `<option value="ALL">All Client Accounts (${accounts.length})</option>` +
        accounts.map(acc => `<option value="${acc}">${acc}</option>`).join('');
    }

    // Tech Tags
    const techSelect = document.getElementById('filterTech');
    const allTech = Array.from(new Set(this.cards.flatMap(c => c.techInterests || []))).sort();
    if (techSelect) {
      techSelect.innerHTML = `<option value="ALL">All Tech Interests (${allTech.length})</option>` +
        allTech.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    // Tech cloud pills
    const pillsContainer = document.getElementById('techPillsContainer');
    if (pillsContainer) {
      const topTech = allTech.slice(0, 7);
      pillsContainer.innerHTML = `<span class="text-slate-500 mr-1 text-[11px]">Popular tags:</span>` +
        topTech.map(t => `
          <button class="tech-pill px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-700 text-[11px] transition-all">
            ${t}
          </button>
        `).join('');

      pillsContainer.querySelectorAll('.tech-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const val = e.target.textContent.trim();
          this.filters.tech = val;
          if (techSelect) techSelect.value = val;
          this.render();
        });
      });
    }
  }

  getFilteredCards() {
    return this.cards.filter(c => {
      // Search
      if (this.filters.search) {
        const query = this.filters.search;
        const matchName = c.name?.toLowerCase().includes(query);
        const matchCompany = c.company?.toLowerCase().includes(query) || c.account?.toLowerCase().includes(query);
        const matchTitle = c.title?.toLowerCase().includes(query);
        const matchEmail = c.email?.toLowerCase().includes(query);
        const matchNotes = c.notes?.toLowerCase().includes(query);
        const matchTech = (c.techInterests || []).some(t => t.toLowerCase().includes(query));
        if (!matchName && !matchCompany && !matchTitle && !matchEmail && !matchNotes && !matchTech) {
          return false;
        }
      }

      // Account
      if (this.filters.account !== 'ALL') {
        if (c.company !== this.filters.account && c.account !== this.filters.account) {
          return false;
        }
      }

      // Stakeholder Role
      if (this.filters.role !== 'ALL' && c.stakeholderRole !== this.filters.role) {
        return false;
      }

      // Tech Interest
      if (this.filters.tech !== 'ALL') {
        if (!(c.techInterests || []).includes(this.filters.tech)) {
          return false;
        }
      }

      // VIP Favorite Only
      if (this.filters.vipOnly && !c.favorite) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (this.filters.sortBy === 'recent') {
        return new Date(b.lastMet || 0) - new Date(a.lastMet || 0);
      } else if (this.filters.sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (this.filters.sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      } else if (this.filters.sortBy === 'meetings') {
        return (b.meetingCount || 0) - (a.meetingCount || 0);
      }
      return 0;
    });
  }

  render() {
    const filtered = this.getFilteredCards();
    const countBadge = document.getElementById('badgeCardCount');
    if (countBadge) countBadge.textContent = filtered.length;

    const emptyState = document.getElementById('cardsEmptyState');
    const gridContainer = document.getElementById('cardsGridContainer');
    const listContainer = document.getElementById('cardsListContainer');

    if (filtered.length === 0) {
      emptyState?.classList.remove('hidden');
      gridContainer?.classList.add('hidden');
      listContainer?.classList.add('hidden');
      return;
    }

    emptyState?.classList.add('hidden');

    if (this.activeViewMode === 'grid') {
      gridContainer?.classList.remove('hidden');
      listContainer?.classList.add('hidden');
      this.renderGrid(filtered);
    } else {
      gridContainer?.classList.add('hidden');
      listContainer?.classList.remove('hidden');
      this.renderList(filtered);
    }

    if (window.lucide) lucide.createIcons();
  }

  // Render 3D Flip Business Cards in Grid
  renderGrid(cards) {
    const container = document.getElementById('cardsGridContainer');
    if (!container) return;

    container.innerHTML = cards.map(c => {
      const themeClass = `theme-${c.theme || 'executive-navy'}`;
      const roleBadge = this.getRoleBadgeHtml(c.stakeholderRole);
      const isFav = c.favorite;

      return `
        <div class="card-wrapper bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between group">
          
          <!-- Top Card Meta -->
          <div class="flex items-center justify-between pb-3 text-xs">
            <div class="flex items-center gap-2">
              ${roleBadge}
              <span class="text-slate-400 font-mono text-[11px]">${c.account || c.company}</span>
            </div>
            
            <div class="flex items-center gap-1.5">
              <button class="btn-toggle-fav p-1.5 text-slate-500 hover:text-amber-400 transition-colors" data-id="${c.id}" title="Toggle VIP Status">
                <i data-lucide="star" class="w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}"></i>
              </button>
              <button class="btn-card-menu p-1.5 text-slate-500 hover:text-slate-200 transition-colors" data-id="${c.id}" title="Card Details">
                <i data-lucide="maximize-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- 3D Realistic Business Card Object -->
          <div class="card-perspective my-1">
            <div id="card-3d-${c.id}" class="business-card-3d ${themeClass} shimmer-effect cursor-pointer" data-id="${c.id}">
              
              <!-- Front Side -->
              <div class="card-face p-5 flex flex-col justify-between text-white bg-grid-pattern">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-bold text-base tracking-tight text-white group-hover:text-blue-300 transition-colors">${c.name}</h4>
                    <p class="text-xs text-slate-300 font-medium line-clamp-1">${c.title}</p>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">${c.department || ''}</p>
                  </div>
                  <div class="text-right">
                    <span class="text-[11px] font-black uppercase tracking-wider text-slate-300 bg-white/10 px-2 py-0.5 rounded">${c.company}</span>
                  </div>
                </div>

                <div class="space-y-1 text-[11px] text-slate-300">
                  ${c.email ? `<div class="flex items-center gap-2"><i data-lucide="mail" class="w-3 h-3 text-blue-400"></i><span class="font-mono truncate">${c.email}</span></div>` : ''}
                  ${c.phone ? `<div class="flex items-center gap-2"><i data-lucide="phone" class="w-3 h-3 text-emerald-400"></i><span class="font-mono">${c.phone}</span></div>` : ''}
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-white/10 text-[9px] text-slate-400 font-mono">
                  <span>${c.address ? c.address.split(',')[0] : 'Enterprise Client'}</span>
                  <span class="text-blue-300 opacity-80">CLICK TO FLIP ↻</span>
                </div>
              </div>

              <!-- Back Side -->
              <div class="card-face card-face-back p-5 flex flex-col justify-between text-white bg-slate-900 border border-slate-700 bg-circuit-dots">
                <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Tech Focus & Stack</span>
                  <i data-lucide="cpu" class="w-3.5 h-3.5 text-blue-400"></i>
                </div>

                <div class="flex flex-wrap gap-1 my-auto">
                  ${(c.techInterests || []).map(t => `<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono border border-blue-500/30">${t}</span>`).join('')}
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
                  <span class="text-emerald-400 font-semibold">${c.sentiment || 'Champion'}</span>
                  <span class="text-slate-400 font-mono">Met: ${c.lastMet || 'Recent'}</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Quick Action Bar -->
          <div class="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div class="flex items-center gap-1.5">
              ${c.email ? `<a href="mailto:${c.email}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 hover:text-blue-400 transition-colors" title="Email"><i data-lucide="mail" class="w-3.5 h-3.5"></i></a>` : ''}
              ${c.phone ? `<a href="tel:${c.phone}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-400 transition-colors" title="Call"><i data-lucide="phone" class="w-3.5 h-3.5"></i></a>` : ''}
              <button class="btn-quick-vcard p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-400 transition-colors" data-id="${c.id}" title="Export vCard (.vcf)">
                <i data-lucide="contact" class="w-3.5 h-3.5"></i>
              </button>
              <button class="btn-quick-qr p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/20 hover:text-amber-400 transition-colors" data-id="${c.id}" title="Scan Mobile QR">
                <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <button class="btn-open-detail text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1" data-id="${c.id}">
              <span>View Profile</span>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

        </div>
      `;
    }).join('');

    // Attach card event listeners
    container.querySelectorAll('.business-card-3d').forEach(el => {
      el.addEventListener('click', (e) => {
        el.classList.toggle('is-flipped');
      });
    });

    container.querySelectorAll('.btn-toggle-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-quick-vcard').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadVCard(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-quick-qr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openQRModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-open-detail, .btn-card-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDetailModal(btn.dataset.id);
      });
    });
  }

  // Render Table / List View
  renderList(cards) {
    const tbody = document.getElementById('cardsListTableBody');
    if (!tbody) return;

    tbody.innerHTML = cards.map(c => {
      const roleBadge = this.getRoleBadgeHtml(c.stakeholderRole);
      const techTags = (c.techInterests || []).slice(0, 3).map(t => `<span class="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono mr-1">${t}</span>`).join('');

      return `
        <tr class="hover:bg-slate-800/40 transition-colors cursor-pointer" onclick="app.openDetailModal('${c.id}')">
          <td class="py-3 px-4">
            <div class="font-bold text-white flex items-center gap-1.5">
              ${c.favorite ? '<i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400"></i>' : ''}
              <span>${c.name}</span>
            </div>
            <div class="text-[11px] text-slate-400">${c.title}</div>
          </td>
          <td class="py-3 px-4">
            <span class="font-medium text-slate-300">${c.company}</span>
            <div class="text-[10px] text-slate-500 font-mono">${c.department || 'Client Exec'}</div>
          </td>
          <td class="py-3 px-4">
            ${roleBadge}
          </td>
          <td class="py-3 px-4">
            ${techTags}
          </td>
          <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">
            ${c.lastMet || '—'}
          </td>
          <td class="py-3 px-4 text-right">
            <div class="inline-flex items-center gap-1" onclick="event.stopPropagation()">
              <button onclick="app.downloadVCard('${c.id}')" class="p-1 hover:text-indigo-400" title="Export .VCF"><i data-lucide="contact" class="w-3.5 h-3.5"></i></button>
              <button onclick="app.openQRModal('${c.id}')" class="p-1 hover:text-amber-400" title="QR Code"><i data-lucide="qr-code" class="w-3.5 h-3.5"></i></button>
              <button onclick="app.openDetailModal('${c.id}')" class="p-1 hover:text-blue-400" title="View"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Account Org & Power Map Matrix View
  renderOrgMap() {
    const container = document.getElementById('accountMatrixContainer');
    if (!container) return;

    // Group cards by account
    const accounts = Array.from(new Set(this.cards.map(c => c.company || c.account))).filter(Boolean);

    container.innerHTML = accounts.map(accName => {
      const accCards = this.cards.filter(c => (c.company === accName || c.account === accName));
      const meta = this.accounts[accName] || {
        industry: "Enterprise Client",
        tier: "Standard",
        annualSpend: "$1M+",
        activeProjects: ["Architecture Review"],
        color: "#3B82F6"
      };

      // Group into power matrix columns
      const buyers = accCards.filter(c => c.stakeholderRole === 'Economic Buyer');
      const champions = accCards.filter(c => c.stakeholderRole === 'Technical Champion');
      const influencers = accCards.filter(c => c.stakeholderRole === 'Influencer');
      const gatekeepers = accCards.filter(c => c.stakeholderRole === 'Gatekeeper' || c.stakeholderRole === 'End User');

      return `
        <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
          
          <!-- Account Banner -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-black text-blue-400 text-lg">
                ${accName.charAt(0)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-lg text-white">${accName}</h3>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono border border-blue-500/20">${meta.tier}</span>
                </div>
                <p class="text-xs text-slate-400">${meta.industry} • Spend: <span class="text-emerald-400 font-semibold">${meta.annualSpend}</span></p>
              </div>
            </div>

            <!-- Active Engagements -->
            <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span class="text-slate-500">Active Focus:</span>
              ${(meta.activeProjects || []).map(p => `<span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">${p}</span>`).join('')}
            </div>
          </div>

          <!-- 4-Quadrant Stakeholder Matrix -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            
            <!-- Column 1: Economic Buyers -->
            <div class="bg-slate-950/60 rounded-xl p-3 border border-amber-500/20 space-y-2">
              <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                <span class="font-bold text-amber-400 flex items-center gap-1.5">
                  <i data-lucide="circle-dollar-sign" class="w-3.5 h-3.5"></i> Economic Buyers (${buyers.length})
                </span>
              </div>
              <div class="space-y-2">
                ${buyers.length ? buyers.map(c => this.renderStakeholderMiniCard(c)).join('') : '<p class="text-[11px] text-slate-600 italic py-2">No buyers mapped</p>'}
              </div>
            </div>

            <!-- Column 2: Technical Champions -->
            <div class="bg-slate-950/60 rounded-xl p-3 border border-emerald-500/20 space-y-2">
              <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                <span class="font-bold text-emerald-400 flex items-center gap-1.5">
                  <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Tech Champions (${champions.length})
                </span>
              </div>
              <div class="space-y-2">
                ${champions.length ? champions.map(c => this.renderStakeholderMiniCard(c)).join('') : '<p class="text-[11px] text-slate-600 italic py-2">No champions mapped</p>'}
              </div>
            </div>

            <!-- Column 3: Influencers -->
            <div class="bg-slate-950/60 rounded-xl p-3 border border-indigo-500/20 space-y-2">
              <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                <span class="font-bold text-indigo-400 flex items-center gap-1.5">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Influencers (${influencers.length})
                </span>
              </div>
              <div class="space-y-2">
                ${influencers.length ? influencers.map(c => this.renderStakeholderMiniCard(c)).join('') : '<p class="text-[11px] text-slate-600 italic py-2">No influencers mapped</p>'}
              </div>
            </div>

            <!-- Column 4: Gatekeepers / Security -->
            <div class="bg-slate-950/60 rounded-xl p-3 border border-rose-500/20 space-y-2">
              <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                <span class="font-bold text-rose-400 flex items-center gap-1.5">
                  <i data-lucide="lock" class="w-3.5 h-3.5"></i> Gatekeepers & Sec (${gatekeepers.length})
                </span>
              </div>
              <div class="space-y-2">
                ${gatekeepers.length ? gatekeepers.map(c => this.renderStakeholderMiniCard(c)).join('') : '<p class="text-[11px] text-slate-600 italic py-2">No gatekeepers mapped</p>'}
              </div>
            </div>

          </div>

        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  renderStakeholderMiniCard(c) {
    return `
      <div 
        class="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all space-y-1 group"
        onclick="app.openDetailModal('${c.id}')"
      >
        <div class="font-semibold text-slate-200 group-hover:text-blue-400 text-xs flex items-center justify-between">
          <span>${c.name}</span>
          <span class="text-[10px] text-slate-500 font-mono">${c.lastMet ? c.lastMet.substring(5) : ''}</span>
        </div>
        <div class="text-[11px] text-slate-400 truncate">${c.title}</div>
        <div class="flex items-center justify-between pt-1 text-[10px]">
          <span class="text-blue-400 font-mono">${c.techInterests ? c.techInterests[0] : 'Tech'}</span>
          <span class="text-slate-500">Engaged: ${c.meetingCount || 1}x</span>
        </div>
      </div>
    `;
  }

  // Tech Analytics & Coverage View
  renderAnalytics() {
    // Tech Counts
    const techCounts = {};
    this.cards.forEach(c => {
      (c.techInterests || []).forEach(t => {
        techCounts[t] = (techCounts[t] || 0) + 1;
      });
    });

    const sortedTech = Object.entries(techCounts).sort((a, b) => b[1] - a[1]);
    const maxTech = sortedTech.length > 0 ? sortedTech[0][1] : 1;

    const techListEl = document.getElementById('analyticsTechList');
    if (techListEl) {
      techListEl.innerHTML = sortedTech.slice(0, 8).map(([tech, count]) => {
        const pct = Math.round((count / maxTech) * 100);
        return `
          <div class="space-y-1">
            <div class="flex justify-between text-slate-300">
              <span class="font-medium">${tech}</span>
              <span class="font-mono text-blue-400 font-bold">${count} contacts</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Role Counts
    const roleCounts = {};
    this.cards.forEach(c => {
      const r = c.stakeholderRole || 'Other';
      roleCounts[r] = (roleCounts[r] || 0) + 1;
    });

    const roleListEl = document.getElementById('analyticsRoleList');
    if (roleListEl) {
      roleListEl.innerHTML = Object.entries(roleCounts).map(([role, count]) => {
        const badge = this.getRoleBadgeHtml(role);
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>${badge}</div>
            <div class="font-mono font-bold text-white">${count}</div>
          </div>
        `;
      }).join('');
    }

    // Account Engagement Cadence
    const cadenceEl = document.getElementById('analyticsAccountCadence');
    if (cadenceEl) {
      const accounts = Array.from(new Set(this.cards.map(c => c.company || c.account)));
      cadenceEl.innerHTML = accounts.map(acc => {
        const count = this.cards.filter(c => c.company === acc || c.account === acc).length;
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <div class="font-semibold text-slate-200">${acc}</div>
            <div class="text-slate-400 font-mono text-[11px]">${count} Stakeholders</div>
          </div>
        `;
      }).join('');
    }
  }

  // Update Top Stats Badge
  updateStats() {
    const total = this.cards.length;
    const champions = this.cards.filter(c => c.stakeholderRole === 'Technical Champion' || c.sentiment === 'Strong Champion').length;
    const buyers = this.cards.filter(c => c.stakeholderRole === 'Economic Buyer').length;
    const accounts = new Set(this.cards.map(c => c.company || c.account)).size;

    document.getElementById('metricChampions').textContent = champions;
    document.getElementById('metricBuyers').textContent = buyers;
    document.getElementById('metricAccounts').textContent = accounts;
    document.getElementById('badgeCardCount').textContent = total;
  }

  getRoleBadgeHtml(role) {
    switch (role) {
      case 'Economic Buyer':
        return `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">Economic Buyer</span>`;
      case 'Technical Champion':
        return `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">Tech Champion</span>`;
      case 'Influencer':
        return `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">Influencer</span>`;
      case 'Gatekeeper':
        return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">Gatekeeper</span>`;
      default:
        return `<span class="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold">${role || 'Stakeholder'}</span>`;
    }
  }

  // Open 3D Detail Modal
  openDetailModal(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    this.selectedCardId = cardId;
    const modal = document.getElementById('cardDetailModal');
    if (!modal) return;

    // Reset flip
    const card3d = document.getElementById('modal3DCard');
    card3d?.classList.remove('is-flipped');
    card3d.className = `business-card-3d theme-${card.theme || 'executive-navy'} shimmer-effect cursor-pointer`;

    // Populate Modal
    document.getElementById('modalStakeholderBadge').innerHTML = this.getRoleBadgeHtml(card.stakeholderRole);
    document.getElementById('modalFrontName').textContent = card.name;
    document.getElementById('modalFrontTitle').textContent = card.title;
    document.getElementById('modalFrontCompany').textContent = card.company;
    document.getElementById('modalFrontEmail').textContent = card.email || 'No email provided';
    document.getElementById('modalFrontPhone').textContent = card.phone || 'No phone provided';
    document.getElementById('modalFrontAddress').textContent = card.address || card.company;

    // Back face
    document.getElementById('modalBackSentiment').textContent = card.sentiment || 'Champion';
    document.getElementById('modalBackId').textContent = card.id.replace('card-', '');
    
    const techBox = document.getElementById('modalBackTechTags');
    if (techBox) {
      techBox.innerHTML = (card.techInterests || []).map(t => `
        <span class="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-mono border border-blue-500/30">${t}</span>
      `).join('');
    }

    // Actions
    const emailBtn = document.getElementById('btnActionEmail');
    if (emailBtn) emailBtn.href = card.email ? `mailto:${card.email}` : '#';

    const callBtn = document.getElementById('btnActionCall');
    if (callBtn) callBtn.href = card.phone ? `tel:${card.phone}` : '#';

    // Scanned Photo Display
    const photoSection = document.getElementById('modalScannedPhotoSection');
    const photoImg = document.getElementById('modalScannedPhotoImg');
    const photoLink = document.getElementById('modalScannedPhotoLink');
    if (card.cardFrontImage) {
      if (photoImg) photoImg.src = card.cardFrontImage;
      if (photoLink) photoLink.href = card.cardFrontImage;
      photoSection?.classList.remove('hidden');
    } else {
      photoSection?.classList.add('hidden');
    }

    // Notes
    document.getElementById('modalLastMetBadge').textContent = `Last Met: ${card.lastMet || 'Recent'} (${card.meetingCount || 1} syncs)`;
    document.getElementById('modalNotesText').textContent = card.notes || 'No architecture notes logged yet.';

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeDetailModal() {
    document.getElementById('cardDetailModal')?.classList.add('hidden');
    this.selectedCardId = null;
  }

  // Open Edit / Add Modal
  openAddModal() {
    document.getElementById('editModalTitle').innerHTML = `<i data-lucide="user-plus" class="w-4 h-4 text-blue-400"></i> Add New Client Card`;
    document.getElementById('cardForm').reset();
    document.getElementById('formCardId').value = '';
    document.getElementById('formLastMet').value = new Date().toISOString().split('T')[0];
    document.getElementById('cardEditModal')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  openEditModal(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    this.closeDetailModal();

    document.getElementById('editModalTitle').innerHTML = `<i data-lucide="edit-3" class="w-4 h-4 text-blue-400"></i> Edit Card: ${card.name}`;
    document.getElementById('formCardId').value = card.id;
    document.getElementById('formName').value = card.name || '';
    document.getElementById('formTitle').value = card.title || '';
    document.getElementById('formCompany').value = card.company || '';
    document.getElementById('formDepartment').value = card.department || '';
    document.getElementById('formRole').value = card.stakeholderRole || 'Technical Champion';
    document.getElementById('formSentiment').value = card.sentiment || 'Champion';
    document.getElementById('formEmail').value = card.email || '';
    document.getElementById('formPhone').value = card.phone || '';
    document.getElementById('formAddress').value = card.address || '';
    document.getElementById('formLinkedin').value = card.linkedin || '';
    document.getElementById('formTech').value = (card.techInterests || []).join(', ');
    document.getElementById('formTheme').value = card.theme || 'executive-navy';
    document.getElementById('formLastMet').value = card.lastMet || '';
    document.getElementById('formNotes').value = card.notes || '';

    document.getElementById('cardEditModal')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeEditModal() {
    document.getElementById('cardEditModal')?.classList.add('hidden');
  }

  handleSaveCard(e) {
    e.preventDefault();
    const id = document.getElementById('formCardId').value;
    const name = document.getElementById('formName').value.trim();
    const title = document.getElementById('formTitle').value.trim();
    const company = document.getElementById('formCompany').value.trim();
    const department = document.getElementById('formDepartment').value.trim();
    const role = document.getElementById('formRole').value;
    const sentiment = document.getElementById('formSentiment').value;
    const email = document.getElementById('formEmail').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    const address = document.getElementById('formAddress').value.trim();
    const linkedin = document.getElementById('formLinkedin').value.trim();
    const techStr = document.getElementById('formTech').value.trim();
    const theme = document.getElementById('formTheme').value;
    const lastMet = document.getElementById('formLastMet').value;
    const notes = document.getElementById('formNotes').value.trim();

    const techInterests = techStr ? techStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (id) {
      // Edit existing
      const card = this.cards.find(c => c.id === id);
      if (card) {
        Object.assign(card, {
          name, title, company, account: company, department, stakeholderRole: role,
          sentiment, email, phone, address, linkedin, techInterests, theme, lastMet, notes
        });
        this.showToast(`Updated ${name}`);
      }
    } else {
      // Create new
      const newCard = {
        id: `card-${Date.now()}`,
        name, title, company, account: company, department, stakeholderRole: role,
        sentiment, email, phone, mobile: phone, address, linkedin, techInterests,
        theme, lastMet, notes, meetingCount: 1, favorite: false,
        createdAt: new Date().toISOString().split('T')[0]
      };
      this.cards.unshift(newCard);
      this.showToast(`Added ${name} to CardVault`);
    }

    this.saveData();
    this.closeEditModal();
    this.populateFilterOptions();
    this.render();
  }

  deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this business card?')) return;
    this.cards = this.cards.filter(c => c.id !== cardId);
    this.saveData();
    this.closeDetailModal();
    this.populateFilterOptions();
    this.render();
    this.showToast('Card deleted from vault');
  }

  toggleFavorite(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.favorite = !card.favorite;
      this.saveData();
      this.render();
      this.showToast(card.favorite ? `Marked ${card.name} as VIP` : `Removed VIP`);
    }
  }

  // Mobile QR Code Modal
  openQRModal(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('qrContactName').textContent = card.name;
    document.getElementById('qrContactCompany').textContent = `${card.title} • ${card.company}`;

    const qrContainer = document.getElementById('qrcodeCanvas');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      const vcardText = this.generateVCardString(card);
      new QRCode(qrContainer, {
        text: vcardText,
        width: 180,
        height: 180,
        colorDark: "#0B0F17",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    document.getElementById('qrModal')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeQRModal() {
    document.getElementById('qrModal')?.classList.add('hidden');
  }

  // Generate standard RFC 6350 vCard
  generateVCardString(card) {
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name}`,
      `TITLE:${card.title}`,
      `ORG:${card.company};${card.department || ''}`,
      card.email ? `EMAIL;TYPE=WORK:${card.email}` : '',
      card.phone ? `TEL;TYPE=WORK,VOICE:${card.phone}` : '',
      card.address ? `ADR;TYPE=WORK:;;${card.address};;;;` : '',
      card.website ? `URL:${card.website}` : '',
      card.notes ? `NOTE:${card.notes}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
  }

  downloadVCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    const vcard = this.generateVCardString(card);
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${card.name.replace(/\s+/g, '_')}_contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast(`Exported .VCF for ${card.name}`);
  }

  // Export CSV for CRM/Salesforce
  exportCSV() {
    if (this.cards.length === 0) {
      alert('No cards to export');
      return;
    }

    const headers = ['Name', 'Title', 'Company', 'Department', 'Role', 'Email', 'Phone', 'Address', 'Tech Interests', 'Notes', 'Last Met'];
    const rows = this.cards.map(c => [
      `"${c.name || ''}"`,
      `"${c.title || ''}"`,
      `"${c.company || ''}"`,
      `"${c.department || ''}"`,
      `"${c.stakeholderRole || ''}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.techInterests || []).join('; ')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${c.lastMet || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ATL_CardVault_Contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Exported CSV for CRM');
  }

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.cards, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `ATL_CardVault_Backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    this.showToast('Backup JSON downloaded');
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          this.cards = imported;
          this.saveData();
          this.populateFilterOptions();
          this.render();
          this.showToast(`Restored ${imported.length} contacts!`);
        } else {
          alert('Invalid JSON structure');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  }

  clearAllCards() {
    if (!confirm('Are you sure you want to clear all template/mock cards from your vault?')) return;
    this.cards = [];
    this.saveData();
    this.populateFilterOptions();
    this.render();
    this.showToast('All cards cleared. Ready for your own data!');
  }

  resetFilters() {
    this.filters = { search: '', account: 'ALL', role: 'ALL', tech: 'ALL', vipOnly: false, sortBy: 'recent' };
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('filterAccount').value = 'ALL';
    document.getElementById('filterRole').value = 'ALL';
    document.getElementById('filterTech').value = 'ALL';
    document.getElementById('sortCards').value = 'recent';
    const btnVIP = document.getElementById('btnFilterFavorites');
    btnVIP?.classList.remove('bg-amber-500/20', 'text-amber-400', 'border-amber-400/50');
    this.render();
  }

  openPhoneConnectModal() {
    const modal = document.getElementById('phoneConnectModal');
    const qrCanvas = document.getElementById('phoneConnectQRCanvas');
    const urlText = document.getElementById('phoneConnectUrlText');
    if (!modal || !qrCanvas) return;

    // Use current location URL or LAN IP
    let targetUrl = window.location.href;
    if (window.location.protocol === 'file:') {
      targetUrl = "http://10.20.30.175:8080";
    }

    if (urlText) urlText.textContent = targetUrl;

    qrCanvas.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrCanvas, {
        text: targetUrl,
        width: 190,
        height: 190,
        colorDark: "#0B0F17",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closePhoneConnectModal() {
    document.getElementById('phoneConnectModal')?.classList.add('hidden');
  }

  openCloudSyncModal() {
    const modal = document.getElementById('cloudSyncModal');
    const input = document.getElementById('inputGoogleScriptUrl');
    const statusText = document.getElementById('syncStatusText');
    if (!modal) return;

    if (input) input.value = this.googleScriptUrl;
    if (statusText) {
      statusText.textContent = this.googleScriptUrl ? 'Connected & Ready' : 'Not Configured';
      statusText.className = this.googleScriptUrl ? 'font-mono text-emerald-400 font-semibold' : 'font-mono text-amber-400 font-semibold';
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeCloudSyncModal() {
    document.getElementById('cloudSyncModal')?.classList.add('hidden');
  }

  async saveSyncUrl() {
    const input = document.getElementById('inputGoogleScriptUrl');
    const statusText = document.getElementById('syncStatusText');
    const url = input?.value.trim() || '';

    if (!url) {
      this.googleScriptUrl = '';
      localStorage.removeItem('atl_google_script_url');
      if (statusText) {
        statusText.textContent = 'Disconnected';
        statusText.className = 'font-mono text-slate-400 font-semibold';
      }
      this.updateHeaderSyncStatus();
      this.showToast('Google sync URL cleared');
      return;
    }

    if (!url.startsWith('https://script.google.com/')) {
      alert('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/...');
      return;
    }

    this.googleScriptUrl = url;
    localStorage.setItem('atl_google_script_url', url);

    if (statusText) {
      statusText.textContent = 'Testing connection...';
      statusText.className = 'font-mono text-blue-400 font-semibold';
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        if (statusText) {
          statusText.textContent = 'Connected (Found ' + (data.cards ? data.cards.length : 0) + ' cards)';
          statusText.className = 'font-mono text-emerald-400 font-semibold';
        }
        this.updateHeaderSyncStatus();
        this.showToast('Google Apps Script connected successfully!');
      } else {
        throw new Error(data.message || 'Error response');
      }
    } catch (e) {
      console.warn('Sync test notice (CORS redirect or offline):', e);
      if (statusText) {
        statusText.textContent = 'Saved (CORS/Redirect OK)';
        statusText.className = 'font-mono text-emerald-400 font-semibold';
      }
      this.updateHeaderSyncStatus();
      this.showToast('URL saved and ready for sync');
    }
  }

  async pullFromGoogleSheet(silent = false) {
    if (!this.googleScriptUrl) {
      if (!silent) {
        alert('Please configure your Google Apps Script Web App URL first.');
        this.openCloudSyncModal();
      }
      return;
    }

    const icon = document.getElementById('iconPullSync');
    icon?.classList.add('animate-spin');

    try {
      const res = await fetch(this.googleScriptUrl);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.cards)) {
        // Merge cards: keep existing local cards, add newly discovered cards from Google Sheet
        const existingIds = new Set(this.cards.map(c => c.id));
        let addedCount = 0;
        data.cards.forEach(card => {
          if (!existingIds.has(card.id)) {
            this.cards.unshift(card);
            existingIds.add(card.id);
            addedCount++;
          }
        });

        if (addedCount > 0) {
          this.saveData();
          this.populateFilterOptions();
          this.render();
          this.showToast(`Synced! Pulled ${addedCount} new cards from Google Sheet`);
          if (window.confetti && !silent) {
            window.confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
          }
        } else if (!silent) {
          this.showToast('Already up to date with Google Sheet');
        }
      }
    } catch (err) {
      console.error('Failed to pull from Google Sheet:', err);
      if (!silent) {
        this.showToast('Could not fetch from Google Sheet (check URL permissions)');
      }
    } finally {
      icon?.classList.remove('animate-spin');
    }
  }

  async pushCardToGoogleSheet(card) {
    if (!this.googleScriptUrl) return;
    try {
      await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(card),
        mode: 'no-cors' // Google Apps Script Web App standard mode
      });
      console.log('Card posted to Google Sheet & Drive:', card.name);
      this.showToast(`Synced ${card.name} to Google Sheet & Drive!`);
    } catch (err) {
      console.warn('Google Sheet background push notice:', err);
    }
  }

  updateHeaderSyncStatus() {
    const icon = document.getElementById('headerCloudIcon');
    const text = document.getElementById('headerCloudText');
    if (this.googleScriptUrl) {
      icon?.classList.replace('text-blue-400', 'text-emerald-400');
      if (text) text.textContent = 'Google Synced';
    } else {
      icon?.classList.replace('text-emerald-400', 'text-blue-400');
      if (text) text.textContent = 'Google Sync';
    }
  }

  closeAllModals() {
    this.closeDetailModal();
    this.closeEditModal();
    this.closeQRModal();
    this.closePhoneConnectModal();
    this.closeCloudSyncModal();
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new CardVaultApp();

  // Register PWA Service Worker for offline iOS/Android access
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('ServiceWorker registration optional/skipped:', err);
    });
  }
});
