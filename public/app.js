/**
 * FactLens — Frontend Controller (Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    documents: [],
    facts: [],
    relationships: [],
    activeFilter: 'ALL',
    searchQuery: '',
    stagedFiles: [],
    isProcessing: false,
  };

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const stagedFilesContainer = document.getElementById('stagedFilesContainer');
  const stagedList = document.getElementById('stagedList');
  const stagedCount = document.getElementById('stagedCount');
  const btnClearStaged = document.getElementById('btnClearStaged');
  const btnUploadSubmit = document.getElementById('btnUploadSubmit');
  const processingOverlay = document.getElementById('processingOverlay');
  const processingText = document.getElementById('processingText');
  const btnLoadDelhivery = document.getElementById('btnLoadDelhivery');
  const btnLoadMacro = document.getElementById('btnLoadMacro');
  const btnReset = document.getElementById('btnReset');
  const docListContainer = document.getElementById('docListContainer');
  const docCountBadge = document.getElementById('docCountBadge');
  const findingsContainer = document.getElementById('findingsContainer');
  const findingsCountPill = document.getElementById('findingsCountPill');
  const factsTableBody = document.getElementById('factsTableBody');
  const factSearchInput = document.getElementById('factSearchInput');
  const factsTotalBadge = document.getElementById('factsTotalBadge');
  const classificationTabs = document.getElementById('classificationTabs');

  // Stats Elements
  const statDocCount = document.getElementById('statDocCount');
  const statFactCount = document.getElementById('statFactCount');
  const statCorroborated = document.getElementById('statCorroborated');
  const statContradiction = document.getElementById('statContradiction');
  const statContextual = document.getElementById('statContextual');
  const statUncertain = document.getElementById('statUncertain');

  // Tab Count Badges
  const tabCountAll = document.getElementById('tabCountAll');
  const tabCountCorrob = document.getElementById('tabCountCorrob');
  const tabCountContra = document.getElementById('tabCountContra');
  const tabCountContext = document.getElementById('tabCountContext');
  const tabCountUncert = document.getElementById('tabCountUncert');

  // Modals
  const evidenceModal = document.getElementById('evidenceModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const singleFactModal = document.getElementById('singleFactModal');
  const singleFactCloseBtn = document.getElementById('singleFactCloseBtn');

  // Initialize
  fetchInitialData();
  setupEventListeners();

  // -------------------------------------------------------------
  // Data Fetching & Syncing
  // -------------------------------------------------------------
  async function fetchInitialData() {
    try {
      const [docsRes, factsRes, relsRes, statsRes] = await Promise.all([
        fetch('/api/documents').then(r => r.json()),
        fetch('/api/facts').then(r => r.json()),
        fetch('/api/relationships').then(r => r.json()),
        fetch('/api/stats').then(r => r.json()),
      ]);

      state.documents = Array.isArray(docsRes) ? docsRes : [];
      state.facts = Array.isArray(factsRes) ? factsRes : [];
      state.relationships = Array.isArray(relsRes) ? relsRes : [];

      renderAll(statsRes);
    } catch (err) {
      console.error('Error fetching initial FactLens data:', err);
    }
  }

  function renderAll(stats) {
    renderStats(stats);
    renderDocuments(state.documents);
    renderFindings(state.relationships, state.activeFilter);
    renderFactsTable(state.facts, state.searchQuery);
  }

  // -------------------------------------------------------------
  // Renderers
  // -------------------------------------------------------------
  function renderStats(stats) {
    if (!stats || !stats.breakdown) {
      const corrob = state.relationships.filter(r => r.classification === 'CORROBORATED').length;
      const contra = state.relationships.filter(r => r.classification === 'CONTRADICTION').length;
      const context = state.relationships.filter(r => r.classification === 'CONTEXTUAL_DIFFERENCE').length;
      const uncert = state.relationships.filter(r => r.classification === 'UNCERTAIN').length;

      statDocCount.textContent = state.documents.length;
      statFactCount.textContent = state.facts.length;
      statCorroborated.textContent = corrob;
      statContradiction.textContent = contra;
      statContextual.textContent = context;
      statUncertain.textContent = uncert;

      tabCountAll.textContent = state.relationships.length;
      tabCountCorrob.textContent = corrob;
      tabCountContra.textContent = contra;
      tabCountContext.textContent = context;
      tabCountUncert.textContent = uncert;
      return;
    }

    statDocCount.textContent = stats.documentsCount || 0;
    statFactCount.textContent = stats.factsCount || 0;
    statCorroborated.textContent = stats.breakdown.CORROBORATED || 0;
    statContradiction.textContent = stats.breakdown.CONTRADICTION || 0;
    statContextual.textContent = stats.breakdown.CONTEXTUAL_DIFFERENCE || 0;
    statUncertain.textContent = stats.breakdown.UNCERTAIN || 0;

    tabCountAll.textContent = stats.relationshipsCount || 0;
    tabCountCorrob.textContent = stats.breakdown.CORROBORATED || 0;
    tabCountContra.textContent = stats.breakdown.CONTRADICTION || 0;
    tabCountContext.textContent = stats.breakdown.CONTEXTUAL_DIFFERENCE || 0;
    tabCountUncert.textContent = stats.breakdown.UNCERTAIN || 0;
  }

  function renderDocuments(docs) {
    docCountBadge.textContent = docs.length;

    if (!docs || docs.length === 0) {
      docListContainer.innerHTML = `
        <div class="empty-placeholder">
          <p>No documents in knowledge layer.</p>
          <p class="sub-hint">Upload PDFs or load the Starter Dataset above.</p>
        </div>
      `;
      return;
    }

    docListContainer.innerHTML = docs
      .map(
        d => `
      <div class="doc-item-card">
        <div class="doc-item-top">
          <span class="doc-item-title" title="${escapeHtml(d.original_name || d.filename)}">${escapeHtml(d.original_name || d.filename)}</span>
          <span class="doc-badge-pill">${d.dataset_category || 'PDF'}</span>
        </div>
        <div class="doc-item-meta">
          <span>${d.page_count || '?'} Pages</span>
          <span>•</span>
          <span>${formatBytes(d.file_size)}</span>
        </div>
      </div>
    `
      )
      .join('');
  }

  function renderFindings(relationships, filter) {
    let filtered = relationships;
    if (filter && filter !== 'ALL') {
      filtered = relationships.filter(r => r.classification === filter);
    }

    findingsCountPill.textContent = `${filtered.length} finding${filtered.length === 1 ? '' : 's'}`;

    if (!filtered || filtered.length === 0) {
      findingsContainer.innerHTML = `
        <div class="empty-placeholder large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <h3>No ${filter !== 'ALL' ? filter.replace(/_/g, ' ') : ''} Relationships Found</h3>
          <p>Upload documents or switch filter tabs to inspect cross-document findings.</p>
        </div>
      `;
      return;
    }

    findingsContainer.innerHTML = filtered
      .map(r => {
        const classBadge = getClassificationBadge(r.classification);
        const cardClass = getCardClass(r.classification);

        return `
        <div class="finding-card ${cardClass}" data-rel-id="${r.id}">
          <div class="finding-card-header">
            <div class="finding-title-group">
              ${classBadge}
              <span class="finding-predicate">${formatPredicate(r.factA?.predicate)}</span>
              <span class="finding-subject">(${escapeHtml(r.factA?.subject || '')})</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-view-evidence" data-id="${r.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              View Evidence
            </button>
          </div>

          <div class="finding-reasoning">
            ${escapeHtml(r.reasoning)}
          </div>

          <div class="finding-comparison-preview">
            <div class="doc-snippet-preview">
              <span class="preview-tag">${escapeHtml(r.factA?.documentFilename || 'Doc A')} (Page ${r.factA?.page})</span>
              <span class="preview-val">${escapeHtml(r.factA?.value || '')}</span>
            </div>
            <div class="doc-snippet-preview">
              <span class="preview-tag">${escapeHtml(r.factB?.documentFilename || 'Doc B')} (Page ${r.factB?.page})</span>
              <span class="preview-val">${escapeHtml(r.factB?.value || '')}</span>
            </div>
          </div>

          <div class="finding-card-footer">
            <span class="confidence-indicator">Confidence: ${Math.round((r.confidence || 0.85) * 100)}%</span>
            ${r.contextDiffType && r.contextDiffType !== 'NONE' ? `<span class="badge badge-indigo">Context: ${r.contextDiffType}</span>` : ''}
          </div>
        </div>
      `;
      })
      .join('');

    // Attach click listeners to "View Evidence" buttons
    document.querySelectorAll('.btn-view-evidence').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const relId = btn.getAttribute('data-id');
        openEvidenceModal(relId);
      });
    });
  }

  function renderFactsTable(facts, query) {
    factsTotalBadge.textContent = facts.length;

    let filtered = facts;
    if (query && query.trim().length > 0) {
      const q = query.toLowerCase().trim();
      filtered = facts.filter(
        f =>
          (f.subject && f.subject.toLowerCase().includes(q)) ||
          (f.predicate && f.predicate.toLowerCase().includes(q)) ||
          (f.value && f.value.toLowerCase().includes(q)) ||
          (f.evidence && f.evidence.toLowerCase().includes(q)) ||
          (f.period && f.period.toLowerCase().includes(q))
      );
    }

    if (!filtered || filtered.length === 0) {
      factsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center empty-cell">No matching facts found.</td>
        </tr>
      `;
      return;
    }

    factsTableBody.innerHTML = filtered
      .map(
        f => `
      <tr>
        <td><strong>${escapeHtml(f.subject)}</strong></td>
        <td><span class="pred-tag">${escapeHtml(f.predicate)}</span></td>
        <td><span class="fact-val-badge">${escapeHtml(f.value)}</span></td>
        <td>${escapeHtml(f.period || '-')}</td>
        <td>${escapeHtml(f.scope || '-')}</td>
        <td title="${escapeHtml(f.document_filename || '')}">${escapeHtml(truncate(f.document_filename || 'Doc', 24))}</td>
        <td><span class="page-num-pill">P. ${f.page}</span></td>
        <td>${Math.round((f.confidence || 0.8) * 100)}%</td>
        <td>
          <button class="evidence-btn-link" data-fact-id="${f.id}">Inspect</button>
        </td>
      </tr>
    `
      )
      .join('');

    // Attach click listeners to single fact inspect links
    document.querySelectorAll('.evidence-btn-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const fId = btn.getAttribute('data-fact-id');
        const fact = state.facts.find(x => x.id === fId);
        if (fact) openSingleFactModal(fact);
      });
    });
  }

  // -------------------------------------------------------------
  // Modals Implementation
  // -------------------------------------------------------------
  function openEvidenceModal(relId) {
    const rel = state.relationships.find(r => r.id === relId);
    if (!rel) return;

    const classBadgeEl = document.getElementById('modalClassBadge');
    classBadgeEl.className = `badge ${getBadgeClass(rel.classification)}`;
    classBadgeEl.textContent = rel.classification.replace(/_/g, ' ');

    const diffTypeEl = document.getElementById('modalDiffType');
    diffTypeEl.textContent = rel.contextDiffType && rel.contextDiffType !== 'NONE' ? `• Context Dimension: ${rel.contextDiffType}` : '';

    document.getElementById('modalConfidence').textContent = `Confidence: ${Math.round((rel.confidence || 0.85) * 100)}%`;
    document.getElementById('modalReasoningText').textContent = rel.reasoning;

    // Doc A
    document.getElementById('modalDocAName').textContent = rel.factA?.documentFilename || 'Document A';
    document.getElementById('modalDocAPage').textContent = `Page ${rel.factA?.page || '?'}`;
    document.getElementById('modalDocASubject').textContent = rel.factA?.subject || '';
    document.getElementById('modalDocAPredicate').textContent = rel.factA?.predicate || '';
    document.getElementById('modalDocAValue').textContent = rel.factA?.value || '';
    document.getElementById('modalDocAPeriodScope').textContent = `${rel.factA?.period || '-'} • ${rel.factA?.scope || 'Consolidated'}`;
    document.getElementById('modalDocAQuote').textContent = `"${rel.factA?.evidence || ''}"`;

    // Doc B
    document.getElementById('modalDocBName').textContent = rel.factB?.documentFilename || 'Document B';
    document.getElementById('modalDocBPage').textContent = `Page ${rel.factB?.page || '?'}`;
    document.getElementById('modalDocBSubject').textContent = rel.factB?.subject || '';
    document.getElementById('modalDocBPredicate').textContent = rel.factB?.predicate || '';
    document.getElementById('modalDocBValue').textContent = rel.factB?.value || '';
    document.getElementById('modalDocBPeriodScope').textContent = `${rel.factB?.period || '-'} • ${rel.factB?.scope || 'Consolidated'}`;
    document.getElementById('modalDocBQuote').textContent = `"${rel.factB?.evidence || ''}"`;

    evidenceModal.style.display = 'flex';
  }

  function openSingleFactModal(fact) {
    document.getElementById('singleFactDocTitle').textContent = `${fact.document_filename || 'Document'} (Page ${fact.page})`;
    document.getElementById('sfSubject').textContent = fact.subject;
    document.getElementById('sfPredicate').textContent = fact.predicate;
    document.getElementById('sfValue').textContent = fact.value;
    document.getElementById('sfPeriod').textContent = `${fact.period || '-'} (${fact.scope || 'Consolidated'})`;
    document.getElementById('sfPageNum').textContent = fact.page;
    document.getElementById('sfEvidenceQuote').textContent = `"${fact.evidence}"`;

    singleFactModal.style.display = 'flex';
  }

  // -------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------
  function setupEventListeners() {
    // Dropzone events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFilesSelected(Array.from(fileInput.files));
      }
    });

    btnClearStaged.addEventListener('click', () => {
      state.stagedFiles = [];
      renderStagedFiles();
    });

    btnUploadSubmit.addEventListener('click', () => uploadStagedFiles());

    // Dataset Quick Loaders
    btnLoadDelhivery.addEventListener('click', async () => {
      await loadDataset('/api/demo/load-delhivery', 'Delhivery Starter Dataset (3 PDFs)');
    });

    btnLoadMacro.addEventListener('click', async () => {
      await loadDataset('/api/demo/load-macroeconomy', 'India Macroeconomy Dataset (3 PDFs)');
    });

    btnReset.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all data and start fresh?')) {
        await fetch('/api/reset', { method: 'POST' });
        await fetchInitialData();
      }
    });

    // Classification Filter Tabs
    classificationTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        classificationTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.getAttribute('data-filter');
        renderFindings(state.relationships, state.activeFilter);
      });
    });

    // Stat Cards Filter Triggers
    document.querySelectorAll('.stat-card.filter-trigger').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.getAttribute('data-filter');
        const targetBtn = classificationTabs.querySelector(`[data-filter="${filter}"]`);
        if (targetBtn) {
          targetBtn.click();
          findingsContainer.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Search Input
    factSearchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      renderFactsTable(state.facts, state.searchQuery);
    });

    // Modal Close buttons
    modalCloseBtn.addEventListener('click', () => (evidenceModal.style.display = 'none'));
    singleFactCloseBtn.addEventListener('click', () => (singleFactModal.style.display = 'none'));
    window.addEventListener('click', e => {
      if (e.target === evidenceModal) evidenceModal.style.display = 'none';
      if (e.target === singleFactModal) singleFactModal.style.display = 'none';
    });
  }

  // -------------------------------------------------------------
  // File Upload Handlers
  // -------------------------------------------------------------
  function handleFilesSelected(files) {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      alert('Please select valid PDF files.');
      return;
    }

    state.stagedFiles = [...state.stagedFiles, ...pdfs];
    renderStagedFiles();
  }

  function renderStagedFiles() {
    if (state.stagedFiles.length === 0) {
      stagedFilesContainer.style.display = 'none';
      return;
    }

    stagedCount.textContent = state.stagedFiles.length;
    stagedList.innerHTML = state.stagedFiles
      .map(
        f => `
      <li class="staged-item">
        <span class="staged-name">${escapeHtml(f.name)}</span>
        <span class="staged-size">${formatBytes(f.size)}</span>
      </li>
    `
      )
      .join('');

    stagedFilesContainer.style.display = 'block';
  }

  async function uploadStagedFiles() {
    if (state.stagedFiles.length === 0 || state.isProcessing) return;

    setProcessing(true, `Ingesting and extracting facts from ${state.stagedFiles.length} PDF(s)...`);

    const formData = new FormData();
    for (const f of state.stagedFiles) {
      formData.append('files', f);
    }

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      state.stagedFiles = [];
      renderStagedFiles();
      await fetchInitialData();
    } catch (err) {
      alert(`Error uploading documents: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function loadDataset(endpoint, datasetName) {
    if (state.isProcessing) return;
    setProcessing(true, `Loading & processing ${datasetName}...`);

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load dataset');
      }
      await fetchInitialData();
    } catch (err) {
      alert(`Error loading dataset: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  function setProcessing(active, message = 'Processing...') {
    state.isProcessing = active;
    if (active) {
      processingText.textContent = message;
      processingOverlay.style.display = 'block';
      stagedFilesContainer.style.display = 'none';
    } else {
      processingOverlay.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function getClassificationBadge(classification) {
    switch (classification) {
      case 'CORROBORATED':
        return '<span class="badge badge-corroborated">🟢 Corroborated</span>';
      case 'CONTRADICTION':
        return '<span class="badge badge-contradiction">🔴 Contradiction</span>';
      case 'CONTEXTUAL_DIFFERENCE':
        return '<span class="badge badge-contextual">🟠 Contextual Diff</span>';
      case 'UNCERTAIN':
        return '<span class="badge badge-uncertain">⚠️ Uncertain</span>';
      default:
        return `<span class="badge">${escapeHtml(classification)}</span>`;
    }
  }

  function getBadgeClass(classification) {
    switch (classification) {
      case 'CORROBORATED':
        return 'badge-corroborated';
      case 'CONTRADICTION':
        return 'badge-contradiction';
      case 'CONTEXTUAL_DIFFERENCE':
        return 'badge-contextual';
      case 'UNCERTAIN':
        return 'badge-uncertain';
      default:
        return '';
    }
  }

  function getCardClass(classification) {
    switch (classification) {
      case 'CORROBORATED':
        return 'corroborated';
      case 'CONTRADICTION':
        return 'contradiction';
      case 'CONTEXTUAL_DIFFERENCE':
        return 'contextual';
      case 'UNCERTAIN':
        return 'uncertain';
      default:
        return '';
    }
  }

  function formatPredicate(pred) {
    if (!pred) return '';
    return pred.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function truncate(str, maxLen = 30) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }
});
