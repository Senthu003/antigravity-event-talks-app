// --- State Management ---
let state = {
    title: "BigQuery Release Notes",
    updated: "",
    entries: [],
    selectedUpdates: new Map(), // key: "entryIndex_itemIndex", value: { entry, item }
    activeFilter: "all",
    searchQuery: ""
};

// --- DOM Elements ---
const DOM = {
    refreshBtn: document.getElementById('refresh-btn'),
    syncTime: document.getElementById('sync-time'),
    syncDot: document.getElementById('sync-dot'),
    searchInput: document.getElementById('search-input'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    feedLoader: document.getElementById('feed-loader'),
    feedError: document.getElementById('feed-error'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    feedEmpty: document.getElementById('feed-empty'),
    timeline: document.getElementById('timeline'),
    timelineStream: document.getElementById('timeline-stream'),
    floatingDrawer: document.getElementById('floating-drawer'),
    selectedCount: document.getElementById('selected-count'),
    clearSelectedBtn: document.getElementById('clear-selected-btn'),
    tweetSelectedBtn: document.getElementById('tweet-selected-btn'),
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    sendTweetBtn: document.getElementById('send-tweet-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    
    // X Live Preview elements
    progressRingCircle: document.getElementById('progress-ring-circle'),
    xTweetText: document.getElementById('x-tweet-text'),
    xLinkCard: document.getElementById('x-link-card'),
    xCardImage: document.getElementById('x-card-image'),
    xCardTypeText: document.getElementById('x-card-type-text'),
    xCardTitle: document.getElementById('x-card-title'),
    xCardDescription: document.getElementById('x-card-description'),
    
    // Stats counters
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statChanges: document.getElementById('stat-changes'),
    statBreaking: document.getElementById('stat-breaking')
};

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
});

// --- API Calls ---
async function fetchReleases() {
    showLoading();
    try {
        const response = await fetch('/api/releases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
            state.entries = data.entries;
            state.title = data.title;
            state.updated = data.updated;
            
            // Clear selections on refresh
            state.selectedUpdates.clear();
            updateFloatingDrawer();
            
            // Render UI
            updateSyncStatus();
            calculateAndAnimateStats();
            renderTimeline();
            showTimeline();
        } else {
            throw new Error(data.message || 'Unknown backend error.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
    }
}

// --- Render Functions ---
function renderTimeline() {
    DOM.timelineStream.innerHTML = '';
    
    let visibleEntriesCount = 0;
    
    state.entries.forEach((entry, entryIdx) => {
        // Filter items in the entry
        const filteredItems = entry.items.filter(item => {
            const matchesFilter = state.activeFilter === 'all' || item.type === state.activeFilter;
            
            let matchesSearch = true;
            if (state.searchQuery) {
                const searchLower = state.searchQuery.toLowerCase();
                const typeMatches = item.type.toLowerCase().includes(searchLower);
                const contentMatches = item.content.toLowerCase().includes(searchLower);
                matchesSearch = typeMatches || contentMatches;
            }
            
            return matchesFilter && matchesSearch;
        });
        
        // Only render the block if there are matching updates for this date
        if (filteredItems.length > 0) {
            visibleEntriesCount++;
            
            const timelineBlock = document.createElement('div');
            timelineBlock.className = 'timeline-block';
            
            // Dynamic node circle
            const node = document.createElement('div');
            node.className = 'timeline-node';
            timelineBlock.appendChild(node);
            
            // Date Title
            const dateHeader = document.createElement('h3');
            dateHeader.className = 'timeline-date';
            dateHeader.textContent = entry.date;
            timelineBlock.appendChild(dateHeader);
            
            // Cards Container
            const cardsList = document.createElement('div');
            cardsList.className = 'timeline-cards-list';
            
            filteredItems.forEach(item => {
                const selectionKey = `${entryIdx}_${item.id}`;
                const isSelected = state.selectedUpdates.has(selectionKey);
                
                const card = document.createElement('div');
                card.className = `card ${item.type} ${isSelected ? 'selected' : ''}`;
                card.setAttribute('data-key', selectionKey);
                
                // Card Header (Badge & Checkbox)
                const header = document.createElement('div');
                header.className = 'card-header';
                
                const badge = document.createElement('span');
                badge.className = `card-badge badge-${item.type.toLowerCase()}`;
                badge.textContent = item.type;
                
                const label = document.createElement('label');
                label.className = 'checkbox-container';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isSelected;
                checkbox.addEventListener('change', (e) => handleCheckboxChange(e, entry, item, selectionKey, card));
                
                const customCheckbox = document.createElement('span');
                customCheckbox.className = 'custom-checkbox';
                
                label.appendChild(checkbox);
                label.appendChild(customCheckbox);
                
                header.appendChild(badge);
                header.appendChild(label);
                card.appendChild(header);
                
                // Card Body (Parsed HTML Content)
                const body = document.createElement('div');
                body.className = 'card-body';
                body.innerHTML = item.content;
                card.appendChild(body);
                
                // Card Actions (Single Tweet Button)
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'card-tweet-btn';
                tweetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                `;
                tweetBtn.addEventListener('click', () => openTweetModalSingle(entry, item));
                
                actions.appendChild(tweetBtn);
                card.appendChild(actions);
                
                cardsList.appendChild(card);
            });
            
            timelineBlock.appendChild(cardsList);
            DOM.timelineStream.appendChild(timelineBlock);
        }
    });
    
    // Manage empty states
    if (visibleEntriesCount === 0) {
        DOM.timeline.classList.add('hidden');
        DOM.feedEmpty.classList.remove('hidden');
    } else {
        DOM.feedEmpty.classList.add('hidden');
    }
}

// --- Selection Handlers ---
function handleCheckboxChange(event, entry, item, selectionKey, cardElement) {
    const isChecked = event.target.checked;
    
    if (isChecked) {
        state.selectedUpdates.set(selectionKey, { entry, item });
        cardElement.classList.add('selected');
    } else {
        state.selectedUpdates.delete(selectionKey);
        cardElement.classList.remove('selected');
    }
    
    updateFloatingDrawer();
}

function updateFloatingDrawer() {
    const count = state.selectedUpdates.size;
    DOM.selectedCount.textContent = count;
    
    if (count > 0) {
        DOM.floatingDrawer.classList.add('active');
        DOM.floatingDrawer.classList.remove('hidden');
    } else {
        DOM.floatingDrawer.classList.remove('active');
        // Let animation finish before hiding
        setTimeout(() => {
            if (state.selectedUpdates.size === 0) {
                DOM.floatingDrawer.classList.add('hidden');
            }
        }, 400);
    }
}

function clearAllSelections() {
    state.selectedUpdates.clear();
    updateFloatingDrawer();
    
    // Uncheck all checkboxes on screen and remove card highlight classes
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
        const cb = card.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
    });
}

// --- Tweet Generating Helpers ---
function cleanHtmlToPlaintext(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    
    // Format links nicely: Text (URL)
    const links = temp.querySelectorAll("a");
    links.forEach(link => {
        let href = link.getAttribute("href") || "";
        if (href.startsWith("/")) {
            href = "https://docs.cloud.google.com" + href;
        }
        link.replaceWith(`${link.textContent} (${href})`);
    });
    
    // Format inline code: `code`
    const codes = temp.querySelectorAll("code");
    codes.forEach(c => {
        c.replaceWith(`\`${c.textContent}\``);
    });
    
    let text = temp.textContent || temp.innerText || "";
    
    // Standardize spacing/newlines
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

function generateSingleTweetText(entry, item) {
    const dateStr = entry.date; // e.g. "July 01, 2026"
    const typeStr = item.type; // e.g. "Feature"
    const plaintext = cleanHtmlToPlaintext(item.content);
    const notesUrl = entry.url || "https://docs.cloud.google.com/bigquery/docs/release-notes";
    
    const prefix = `BigQuery Update (${dateStr}) | #${typeStr}\n\n`;
    const suffix = `\n\nRead more: ${notesUrl}`;
    
    const maxPlaintextLen = 280 - prefix.length - suffix.length;
    
    let tweetBody = plaintext;
    if (plaintext.length > maxPlaintextLen) {
        tweetBody = plaintext.slice(0, maxPlaintextLen - 3) + "...";
    }
    
    return `${prefix}${tweetBody}${suffix}`;
}

function generateMultipleTweetText() {
    if (state.selectedUpdates.size === 0) return "";
    
    if (state.selectedUpdates.size === 1) {
        const singleVal = state.selectedUpdates.values().next().value;
        return generateSingleTweetText(singleVal.entry, singleVal.item);
    }
    
    // Multiple updates composition
    // Format: BigQuery Updates Summary:
    // - [Date] [Type]: [Text]
    let prefix = `BigQuery Releases Summary:\n`;
    const notesUrl = "https://docs.cloud.google.com/bigquery/docs/release-notes";
    const suffix = `\n\nFull details: ${notesUrl}`;
    
    // Calculate remaining budget
    let availableLen = 280 - prefix.length - suffix.length;
    
    let lines = [];
    const itemsArray = Array.from(state.selectedUpdates.values());
    
    // Group updates or just list them
    itemsArray.forEach(val => {
        const cleanText = cleanHtmlToPlaintext(val.item.content);
        const linePrefix = `• [${val.entry.date}] #${val.item.type}: `;
        lines.push({ linePrefix, cleanText });
    });
    
    // Try to fit as much text as possible
    let finalLines = [];
    let itemsCount = lines.length;
    let budgetPerItem = Math.floor(availableLen / itemsCount) - 3; // buffer
    
    lines.forEach(item => {
        let textPart = item.cleanText;
        let lineLengthLimit = budgetPerItem;
        if (lineLengthLimit < 20) lineLengthLimit = 20; // absolute minimum
        
        if (textPart.length > lineLengthLimit) {
            textPart = textPart.slice(0, lineLengthLimit - 3) + "...";
        }
        finalLines.push(`${item.linePrefix}${textPart}`);
    });
    
    let fullBody = prefix + finalLines.join('\n') + suffix;
    
    // If somehow it still overflows (due to very small budgetPerItem or headers), force truncate overall
    if (fullBody.length > 280) {
        fullBody = fullBody.slice(0, 277) + "...";
    }
    
    return fullBody;
}

// --- Modal Handlers ---
function openTweetModal(tweetText, releaseType = 'Update') {
    DOM.tweetTextarea.value = tweetText;
    updateLinkCardVisual(releaseType);
    updateCharCounter();
    DOM.tweetModal.classList.add('active');
    DOM.tweetModal.classList.remove('hidden');
}

function openTweetModalSingle(entry, item) {
    const text = generateSingleTweetText(entry, item);
    openTweetModal(text, item.type);
}

function openTweetModalSelected() {
    const text = generateMultipleTweetText();
    let dominantType = 'Summary';
    if (state.selectedUpdates.size === 1) {
        const singleVal = state.selectedUpdates.values().next().value;
        dominantType = singleVal.item.type;
    }
    openTweetModal(text, dominantType);
}

function closeTweetModal() {
    DOM.tweetModal.classList.remove('active');
    setTimeout(() => {
        DOM.tweetModal.classList.add('hidden');
    }, 300);
}

function updateCharCounter() {
    const text = DOM.tweetTextarea.value;
    const len = text.length;
    
    // X layout counts down from 280
    const remaining = 280 - len;
    DOM.charCounter.textContent = remaining;
    
    // Circular Progress Ring Math
    const radius = 10;
    const circumference = 2 * Math.PI * radius; // 62.8
    const percentage = Math.min(len, 280) / 280;
    const offset = circumference - (percentage * circumference);
    DOM.progressRingCircle.style.strokeDashoffset = offset;
    
    DOM.charCounter.className = 'char-counter';
    
    if (len === 0) {
        DOM.progressRingCircle.style.stroke = 'var(--color-primary)';
        DOM.sendTweetBtn.disabled = true;
    } else if (len < 260) {
        DOM.progressRingCircle.style.stroke = 'var(--color-primary)';
        DOM.sendTweetBtn.disabled = false;
    } else if (len >= 260 && len <= 280) {
        DOM.progressRingCircle.style.stroke = 'var(--color-issue)';
        DOM.charCounter.classList.add('warning');
        DOM.sendTweetBtn.disabled = false;
    } else {
        // Overflow
        DOM.progressRingCircle.style.stroke = 'var(--color-breaking)';
        DOM.charCounter.classList.add('error');
        DOM.sendTweetBtn.disabled = true;
    }
    
    updateLivePreview(text);
}

function updateLivePreview(text) {
    if (!text) {
        DOM.xTweetText.innerHTML = `<span style="color: #71767b">What is happening?</span>`;
        DOM.xLinkCard.classList.add('hidden');
        return;
    }
    
    // HTML Escape to prevent injection
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
        
    // Split text into valid & overflow parts (to highlight overflow in red)
    let styledHtml = "";
    if (escaped.length > 280) {
        const validPart = escaped.substring(0, 280);
        const overflowPart = escaped.substring(280);
        styledHtml = formatTweetTextEntities(validPart) + `<span class="x-overflow-text">${overflowPart}</span>`;
    } else {
        styledHtml = formatTweetTextEntities(escaped);
    }
    
    DOM.xTweetText.innerHTML = styledHtml;
    
    // URL detector for link card preview
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const hasUrls = text.match(urlPattern);
    
    if (hasUrls) {
        DOM.xLinkCard.classList.remove('hidden');
        const firstUrl = hasUrls[0];
        try {
            const domain = new URL(firstUrl).hostname;
            document.querySelector('.x-card-domain').textContent = domain;
        } catch(e) {
            document.querySelector('.x-card-domain').textContent = 'cloud.google.com';
        }
    } else {
        DOM.xLinkCard.classList.add('hidden');
    }
}

function formatTweetTextEntities(text) {
    // Highlight Hashtags in Twitter blue
    let formatted = text.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1<span class="x-hashtag">$2</span>');
    // Highlight Links in Twitter blue
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<span class="x-link">$1</span>');
    return formatted;
}

function updateLinkCardVisual(releaseType) {
    const textEl = DOM.xCardTypeText;
    if (!textEl) return;
    
    const typeLabel = (releaseType || 'Update').toUpperCase();
    
    // Choose dynamic gradient stop colors for the preview image
    let colorStart = '#6366f1'; // Indigo
    let colorEnd = '#38bdf8';   // Sky
    textEl.textContent = 'SYSTEM RELEASE';
    
    if (releaseType === 'Feature') {
        colorStart = '#10b981'; // Emerald
        colorEnd = '#059669';   // Dark Emerald
        textEl.textContent = 'FEATURE RELEASE';
    } else if (releaseType === 'Change') {
        colorStart = '#3b82f6'; // Blue
        colorEnd = '#1d4ed8';   // Dark Blue
        textEl.textContent = 'SYSTEM CHANGE';
    } else if (releaseType === 'Announcement') {
        colorStart = '#a855f7'; // Purple
        colorEnd = '#6d28d9';   // Dark Purple
        textEl.textContent = 'ANNOUNCEMENT';
    } else if (releaseType === 'Breaking') {
        colorStart = '#ef4444'; // Red
        colorEnd = '#b91c1c';   // Dark Red
        textEl.textContent = 'BREAKING UPDATE';
    } else if (releaseType === 'Issue') {
        colorStart = '#f59e0b'; // Amber
        colorEnd = '#d97706';   // Dark Amber
        textEl.textContent = 'KNOWN ISSUE';
    } else if (releaseType === 'Summary') {
        colorStart = '#6366f1'; // Indigo
        colorEnd = '#a855f7';   // Purple
        textEl.textContent = 'RELEASES SUMMARY';
    }
    
    const grad = document.getElementById('accentGrad');
    if (grad) {
        grad.children[0].setAttribute('stop-color', colorStart);
        grad.children[1].setAttribute('stop-color', colorEnd);
    }
}


function handleTweetPost() {
    const tweetText = DOM.tweetTextarea.value;
    if (tweetText.length > 280) {
        alert("Your Tweet exceeds the 280 character limit. Please shorten it.");
        return;
    }
    
    // Generate Twitter Web Intent URL
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    
    // Open Twitter in new tab
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    clearAllSelections();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Refresh button
    DOM.refreshBtn.addEventListener('click', () => {
        if (!DOM.refreshBtn.classList.contains('spinning')) {
            fetchReleases();
        }
    });
    
    // Search input (Debounced search input)
    let searchTimeout;
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            renderTimeline();
        }, 250);
    });
    
    // Filter buttons
    DOM.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilter = btn.getAttribute('data-filter');
            renderTimeline();
        });
    });
    
    // Error Retry
    DOM.retryBtn.addEventListener('click', fetchReleases);
    
    // Drawer buttons
    DOM.clearSelectedBtn.addEventListener('click', clearAllSelections);
    DOM.tweetSelectedBtn.addEventListener('click', openTweetModalSelected);
    
    // Modal buttons
    DOM.closeModalBtn.addEventListener('click', closeTweetModal);
    DOM.cancelTweetBtn.addEventListener('click', closeTweetModal);
    DOM.sendTweetBtn.addEventListener('click', handleTweetPost);
    
    // Character limit tracking on keyup/change
    DOM.tweetTextarea.addEventListener('input', updateCharCounter);
}

// --- Stats Calculation & Counters Animate ---
function calculateAndAnimateStats() {
    let total = 0;
    let features = 0;
    let changes = 0;
    let breakingAndIssues = 0;
    
    state.entries.forEach(entry => {
        entry.items.forEach(item => {
            total++;
            if (item.type === 'Feature') {
                features++;
            } else if (item.type === 'Change' || item.type === 'Announcement') {
                changes++;
            } else if (item.type === 'Breaking' || item.type === 'Issue') {
                breakingAndIssues++;
            }
        });
    });
    
    // Animate stats counting
    animateValue(DOM.statTotal, 0, total, 1000);
    animateValue(DOM.statFeatures, 0, features, 1000);
    animateValue(DOM.statChanges, 0, changes, 1000);
    animateValue(DOM.statBreaking, 0, breakingAndIssues, 1000);
}

function animateValue(obj, start, end, duration) {
    if (start === end) {
        obj.textContent = end;
        return;
    }
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// --- View State Helpers ---
function showLoading() {
    DOM.feedLoader.classList.remove('hidden');
    DOM.feedError.classList.add('hidden');
    DOM.timeline.classList.add('hidden');
    DOM.feedEmpty.classList.add('hidden');
    
    DOM.refreshBtn.classList.add('spinning');
    DOM.syncDot.className = 'pulse-indicator yellow';
    DOM.syncTime.textContent = 'Syncing...';
}

function showTimeline() {
    DOM.feedLoader.classList.add('hidden');
    DOM.feedError.classList.add('hidden');
    DOM.timeline.classList.remove('hidden');
    
    DOM.refreshBtn.classList.remove('spinning');
    DOM.syncDot.className = 'pulse-indicator green';
}

function showError(msg) {
    DOM.feedLoader.classList.add('hidden');
    DOM.timeline.classList.add('hidden');
    DOM.feedEmpty.classList.add('hidden');
    DOM.feedError.classList.remove('hidden');
    
    DOM.errorMessage.textContent = msg || 'Could not connect to the BigQuery update feed.';
    DOM.refreshBtn.classList.remove('spinning');
    DOM.syncDot.className = 'pulse-indicator red';
    DOM.syncTime.textContent = 'Sync failed';
}

function updateSyncStatus() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    DOM.syncTime.textContent = `Last Refreshed: ${timeStr}`;
}
