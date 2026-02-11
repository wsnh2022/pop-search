import { Store } from './store';
import { DEFAULT_APPEARANCE } from '../../shared/constants';

let providers = Store.getProviders();
let categories = Store.getCategories();
let editingIndex = -1;
let editingCatName = null;
let searchQuery = '';

export function initUI() {
    try {
        console.log('Initializing Settings UI...');

        // Data Migration: General -> Unsorted
        if (categories['General']) {
            categories['Unsorted'] = categories['General'] === '🔍' ? '🔴' : categories['General'];
            delete categories['General'];
            providers.forEach(p => {
                if (p.category === 'General' || !p.category) p.category = 'Unsorted';
            });
            Store.saveCategories(categories);
            Store.saveProviders(providers);
            console.log('Migrated data from General to Unsorted');
        }

        const settings = Store.getAppearance();

        const elements = ['iconSize', 'iconsPerRow', 'gridGapX', 'gridGapY', 'fontColor', 'bgColor', 'toggleDummyBtn', 'importDummyBtn', 'providerCategory', 'providers', 'categories'];
        elements.forEach(id => {
            if (!document.getElementById(id)) console.warn(`Missing DOM element: ${id}`);
        });

        // Map appearance settings to DOM
        document.getElementById('iconSize').value = settings.iconSize;
        document.getElementById('iconsPerRow').value = settings.iconsPerRow;
        document.getElementById('gridGapX').value = settings.gridGapX || DEFAULT_APPEARANCE.gridGapX;
        document.getElementById('gridGapY').value = settings.gridGapY || DEFAULT_APPEARANCE.gridGapY;
        document.getElementById('fontWeight').value = settings.fontWeight || DEFAULT_APPEARANCE.fontWeight;
        document.getElementById('fontColor').value = settings.fontColor || DEFAULT_APPEARANCE.fontColor;
        document.getElementById('bgColor').value = settings.bgColor || DEFAULT_APPEARANCE.bgColor;
        document.getElementById('accentColor').value = settings.accentColor || DEFAULT_APPEARANCE.accentColor;
        document.getElementById('tabActiveBg').value = settings.tabActiveBg || DEFAULT_APPEARANCE.tabActiveBg;

        // Update color previews
        updateColorPreview('fontColor', 'fontColorPreview');
        updateColorPreview('bgColor', 'bgColorPreview');
        updateColorPreview('accentColor', 'accentColorPreview');
        updateColorPreview('tabActiveBg', 'tabActiveBgPreview');

        // Add color input listeners
        document.getElementById('fontColor').addEventListener('input', (e) => {
            updateColorPreview('fontColor', 'fontColorPreview');
        });
        document.getElementById('bgColor').addEventListener('input', (e) => {
            updateColorPreview('bgColor', 'bgColorPreview');
        });
        document.getElementById('accentColor').addEventListener('input', (e) => {
            updateColorPreview('accentColor', 'accentColorPreview');
        });
        document.getElementById('tabActiveBg').addEventListener('input', (e) => {
            updateColorPreview('tabActiveBg', 'tabActiveBgPreview');
        });


        // Apply dark theme immediately
        applyTheme('dark');
        if (window.electronAPI) window.electronAPI.setTheme('dark');

        updateCategorySelects();
        renderProviders();
        renderCategories();

        // Toggle Helper (Reusable for simple on/off toggles)
        const setupToggle = (id, initialState, callback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('active', initialState);
            el.onclick = () => {
                const isActive = el.classList.toggle('active');
                if (callback) callback(isActive);
            };
        };

        // Dummy Button Toggle Logic
        setupToggle('toggleDummyBtn', settings.showDummyBtn, (isActive) => {
            const dummyBtn = document.getElementById('importDummyBtn');
            if (dummyBtn) dummyBtn.style.display = isActive ? 'block' : 'none';
        });

        // Unsorted Toggling Logic
        setupToggle('toggleUnsortedBtn', settings.showUnsorted !== false, (isActive) => {
            // No immediate UI action needed in settings, but state is saved on "Save Changes"
        });

        // Bulk Import Live Preview
        const bulkPad = document.getElementById('bulkImportPad');
        if (bulkPad) {
            bulkPad.addEventListener('input', () => {
                const items = parseBulkImport(bulkPad.value);
                renderBulkPreview(items);
            });
        }

        // Provider Search Logic
        const providerSearch = document.getElementById('providerSearch');
        if (providerSearch) {
            providerSearch.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                renderProviders();
            });
        }

        console.log('Settings UI Initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize UI:', err);
        if (window.electronAPI) window.electronAPI.logToTerminal(`UI Init Error: ${err.message}`);
    }
}

export function applyTheme() {
    document.documentElement.classList.add('dark-mode');
}

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `visible ${type}`;

    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

function updateCategorySelects() {
    const select = document.getElementById('providerCategory');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Default (Unsorted)</option>';
    Object.keys(categories).forEach(cat => {
        if (cat === 'Unsorted') return; // Handled by default option
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    if (categories[currentVal]) select.value = currentVal;
    else if (!currentVal) select.value = '';
}

export function renderCategories() {
    const container = document.getElementById('categories');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(categories).forEach(([name, icon]) => {
        const div = document.createElement('div');
        div.className = 'search-provider'; // Reuse styling

        div.innerHTML = `
            <div class="provider-info" style="flex-grow: 1;">
                <div style="font-weight: bold;">${name}</div>
            </div>
            <button class="edit-btn" onclick="window.ui.editCategory('${name}')">Edit</button>
            <button class="remove-btn" onclick="window.ui.removeCategory('${name}')">Remove</button>
        `;

        if (isImageSource(icon)) {
            const img = document.createElement('img');
            img.src = icon;
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.objectFit = 'contain';
            img.style.marginRight = '15px';
            img.style.borderRadius = '4px';
            div.prepend(img);
        } else {
            const iconDiv = document.createElement('div');
            iconDiv.style.fontSize = '24px';
            iconDiv.style.marginRight = '15px';
            iconDiv.textContent = icon;
            div.prepend(iconDiv);
        }
        container.appendChild(div);
    });
}

export function editCategory(name) {
    editingCatName = name;
    document.getElementById('catName').value = name;
    document.getElementById('catIcon').value = categories[name];
    updateIconPreview('catIcon', 'catIconPreview');
    updateGetIconLink('cat');
    document.getElementById('categoryFormTitle').textContent = 'Edit Category';
    document.getElementById('saveCatBtn').textContent = 'Save Changes';
    document.getElementById('cancelCatBtn').style.display = 'inline-block';
    toggleAddSection('catAddSection', true);
    document.querySelector('#categories-list .add-section').scrollIntoView({ behavior: 'smooth' });
}

export function saveCategory() {
    const name = document.getElementById('catName').value.trim();
    let icon = document.getElementById('catIcon').value.trim();

    if (!name || !icon) return alert('Please fill in both Name and Icon');

    if (editingCatName && editingCatName !== name) {
        delete categories[editingCatName];
        // Relink all providers to the new category name
        providers.forEach(p => {
            if (p.category === editingCatName) p.category = name;
        });
        Store.saveProviders(providers);
    }

    categories[name] = icon;
    Store.saveCategories(categories);
    renderCategories();
    updateCategorySelects();
    cancelCatEdit();
}

export function cancelCatEdit() {
    editingCatName = null;
    document.getElementById('catName').value = '';
    document.getElementById('catIcon').value = '';
    updateIconPreview('catIcon', 'catIconPreview');
    updateGetIconLink('cat');
    document.getElementById('categoryFormTitle').textContent = 'Add Category';
    document.getElementById('saveCatBtn').textContent = 'Save Category';
    document.getElementById('cancelCatBtn').style.display = 'none';

    toggleAddSection('catAddSection', false);
}

export function removeCategory(name) {
    if (Object.keys(categories).length <= 1) return alert('Must have at least one category.');
    if (confirm(`Remove category "${name}"? Providers in this category will move to "Unsorted".`)) {
        delete categories[name];
        // Relink providers
        const fallback = Object.keys(categories)[0] || 'Unsorted';
        providers.forEach(p => { if (p.category === name) p.category = fallback; });
        Store.saveCategories(categories);
        Store.saveProviders(providers);
        renderCategories();
        renderProviders();
        updateCategorySelects();
    }
}

export function searchIcons8() {
    const name = document.getElementById('catName').value.trim();
    if (!name) return alert('Please enter a category name first.');
    const url = `https://icons8.com/icons/set/${encodeURIComponent(name)}`;
    window.bridge.openExternal(url);
}

export function searchProviderIcons8() {
    const name = document.getElementById('providerName').value.trim();
    if (!name) return alert('Please enter a provider name first.');
    const url = `https://icons8.com/icons/set/${encodeURIComponent(name)}`;
    window.bridge.openExternal(url);
}

export function renderProviders() {
    const container = document.getElementById('providers');
    if (!container) return;
    container.innerHTML = '';

    const filteredProviders = providers.filter(p => {
        if (!searchQuery) return true;

        // Category-specific search (#category)
        if (searchQuery.startsWith('#')) {
            const catQuery = searchQuery.slice(1).trim().toLowerCase();
            if (!catQuery) return true; // Show all if just "#"

            // Special Keyword: #nil or #none to find ungrouped items
            if (catQuery === 'nil' || catQuery === 'none') {
                const cat = (p.category || 'Unsorted').toLowerCase();
                return cat === 'unsorted' || cat === 'none';
            }

            return (p.category || 'Unsorted').toLowerCase().includes(catQuery);
        }

        const nameMatch = p.name.toLowerCase().includes(searchQuery);
        const urlMatch = p.url.toLowerCase().includes(searchQuery);
        const catMatch = (p.category || 'Unsorted').toLowerCase().includes(searchQuery);

        // Simple fuzzy search: check if characters of searchQuery appear in sequence in provider name
        const fuzzyMatch = (str, query) => {
            let i = 0, j = 0;
            while (i < str.length && j < query.length) {
                if (str[i].toLowerCase() === query[j]) j++;
                i++;
            }
            return j === query.length;
        };

        return nameMatch || urlMatch || catMatch || fuzzyMatch(p.name, searchQuery);
    });

    filteredProviders.forEach((provider) => {
        // Find original index for actions
        const originalIndex = providers.findIndex(p => p === provider);

        const div = document.createElement('div');
        div.className = 'search-provider';
        div.draggable = !searchQuery; // Disable drag during search to prevent confusion
        div.dataset.index = originalIndex;

        const favicon = provider.icon || getFaviconUrl(provider.url);
        const iconValue = categories[provider.category] || (provider.category === 'Unsorted' ? '🔴' : '🔍');
        let catIconHtml = '';
        if (isImageSource(iconValue)) {
            catIconHtml = `<img src="${iconValue}" style="width: 12px; height: 12px; object-fit: contain; vertical-align: middle;">`;
        } else {
            catIconHtml = iconValue;
        }

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '12px';
        row.style.width = '100%';

        const img = document.createElement('img');
        img.src = favicon;
        img.className = 'favicon';
        img.onerror = () => {
            img.src = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>${provider.name[0]}</text></svg>`;
        };

        div.innerHTML = `
      <div class="provider-info" style="flex-grow: 1; cursor: pointer;" onclick="window.ui.editProvider(${originalIndex})" title="Click to Edit">
        <div style="font-weight: bold;">${provider.name} <span style="font-size: 10px; font-weight: normal; color: var(--subtitle-color);">(${catIconHtml} ${provider.category || 'General'})</span></div>
        <div style="font-size: 12px; color: var(--url-color);">${provider.url}</div>
      </div>
      <div class="toggle ${provider.enabled ? 'active' : ''}" onclick="window.ui.toggleProvider(${originalIndex})"></div>
      <button class="edit-btn" onclick="window.ui.editProvider(${originalIndex})" draggable="false">Edit</button>
      <button class="remove-btn" onclick="window.ui.removeProvider(${originalIndex})" draggable="false">Remove</button>
    `;

        div.prepend(img);

        if (!searchQuery) {
            setupDragAndDrop(div, originalIndex);
        }
        container.appendChild(div);
    });

    // Update Search Count
    const countEl = document.getElementById('searchCount');
    if (countEl) {
        if (searchQuery) {
            countEl.textContent = `${filteredProviders.length} result${filteredProviders.length !== 1 ? 's' : ''}`;
        } else {
            countEl.textContent = '';
        }
    }
}

function isImageSource(str) {
    if (!str) return false;
    const s = str.trim();
    return s.startsWith('http') || s.startsWith('data:image') || s.startsWith('./') || s.startsWith('../');
}

function getFaviconUrl(searchUrl) {
    try {
        const url = new URL(searchUrl.replace(/{query}|%s|{{searchTerms}}/g, ''));
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    } catch { return ''; }
}

function setupDragAndDrop(div, index) {
    div.ondragstart = (e) => { e.dataTransfer.setData('text/plain', index); };
    div.ondragover = (e) => { e.preventDefault(); };
    div.ondrop = (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;
        if (fromIndex !== toIndex) {
            const [item] = providers.splice(fromIndex, 1);
            providers.splice(toIndex, 0, item);
            Store.saveProviders(providers);
            renderProviders();
        }
    };
}

// Exposed to window for legacy HTML onclicks (Vite handles this differently than plain JS)
export function toggleProvider(index) {
    providers[index].enabled = !providers[index].enabled;
    Store.saveProviders(providers);
    renderProviders();
}

export function toggleAddSection(containerId, forceExpand = null) {
    const section = document.getElementById(containerId);
    if (!section) return;

    if (forceExpand === true) {
        section.classList.add('expanded');
    } else if (forceExpand === false) {
        section.classList.remove('expanded');
    } else {
        section.classList.toggle('expanded');
    }
}

export function updateIconPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    let value = input.value.trim();

    // Auto-clean Base64: If user pastes a full <img src="..."> tag
    if (value.toLowerCase().startsWith('<img')) {
        const match = value.match(/src=["']([^"']+)["']/i);
        if (match && match[1]) {
            value = match[1];
            input.value = value; // Update input field instantly
        }
    }

    if (!value) {
        // Fallback: Check if URL field has a value (only for providers)
        if (inputId === 'providerIcon') {
            const urlInput = document.getElementById('providerUrl');
            if (urlInput && urlInput.value.trim()) {
                const favicon = getFaviconUrl(urlInput.value.trim());
                if (favicon) {
                    preview.innerHTML = `<img src="${favicon}" style="width: 24px; height: 24px; object-fit: contain;">`;
                    return;
                }
            }
        }
        preview.innerHTML = '';
        return;
    }

    if (isImageSource(value)) {
        preview.innerHTML = `<img src="${value}" style="width: 24px; height: 24px; object-fit: contain;">`;
    } else {
        preview.textContent = value;
        preview.style.fontSize = '20px';
    }
}

export function updateGetIconLink(prefix) {
    const nameInput = document.getElementById(prefix === 'provider' ? 'providerName' : 'catName');
    const link = document.getElementById(prefix === 'provider' ? 'providerGetIconLink' : 'catGetIconLink');
    if (!nameInput || !link) return;

    const name = nameInput.value.trim();
    if (name) {
        link.textContent = `Find one for "${name}" on Icons8`;
    } else {
        link.textContent = `Find one for this name on Icons8`;
    }
}

export function editProvider(index) {
    showSection('providers-list', document.getElementById('nav-providers'));
    editingIndex = index;
    const p = providers[index];
    document.getElementById('providerName').value = p.name;
    document.getElementById('providerUrl').value = p.url;
    document.getElementById('providerIcon').value = p.icon || '';
    document.getElementById('providerCategory').value = p.category || 'Unsorted';
    updateIconPreview('providerIcon', 'providerIconPreview');
    updateGetIconLink('provider');
    document.getElementById('formTitle').textContent = 'Edit Search Provider';
    document.getElementById('submitBtn').textContent = 'Save Changes';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    toggleAddSection('providerAddSection', true);

    // Focus and scroll to form
    const nameInput = document.getElementById('providerName');
    nameInput.focus();
    nameInput.select(); // Highlight name for quick editing

    document.querySelector('#providers-list .add-section').scrollIntoView({ behavior: 'smooth' });
}

export function addProvider() {
    const name = document.getElementById('providerName').value.trim();
    const url = document.getElementById('providerUrl').value.trim();
    const category = document.getElementById('providerCategory').value || 'Unsorted';
    let icon = document.getElementById('providerIcon').value.trim();

    if (!name || !url) return alert('Please fill in both Name and URL');

    if (editingIndex >= 0) {
        providers[editingIndex] = { ...providers[editingIndex], name, url, icon, category };
    } else {
        providers.push({ name, url, icon, enabled: true, category });
    }

    Store.saveProviders(providers);
    renderProviders();
    cancelEdit();
}

export function cancelEdit() {
    editingIndex = -1;
    document.getElementById('providerName').value = '';
    document.getElementById('providerUrl').value = '';
    document.getElementById('providerIcon').value = '';
    document.getElementById('providerCategory').value = ''; // Reset to Default
    updateIconPreview('providerIcon', 'providerIconPreview');
    updateGetIconLink('provider');
    document.getElementById('formTitle').textContent = 'Add Custom Search Provider';
    document.getElementById('submitBtn').textContent = 'Add Provider';
    document.getElementById('cancelBtn').style.display = 'none';

    toggleAddSection('providerAddSection', false);
}

export function removeProvider(index) {
    if (confirm(`Remove ${providers[index].name}?`)) {
        providers.splice(index, 1);
        Store.saveProviders(providers);
        renderProviders();
    }
}

export function saveAppearance() {
    const iconSize = document.getElementById('iconSize')?.value || DEFAULT_APPEARANCE.iconSize;
    const iconsPerRow = document.getElementById('iconsPerRow')?.value || DEFAULT_APPEARANCE.iconsPerRow;
    const popupMaxWidth = '0';

    const fontWeight = document.getElementById('fontWeight')?.value || DEFAULT_APPEARANCE.fontWeight;
    const fontColor = document.getElementById('fontColor')?.value || DEFAULT_APPEARANCE.fontColor;
    const bgColor = document.getElementById('bgColor')?.value || DEFAULT_APPEARANCE.bgColor;
    const accentColor = document.getElementById('accentColor')?.value || DEFAULT_APPEARANCE.accentColor;
    const tabActiveBg = document.getElementById('tabActiveBg')?.value || DEFAULT_APPEARANCE.tabActiveBg;
    const gridGapX = document.getElementById('gridGapX')?.value || DEFAULT_APPEARANCE.gridGapX;
    const gridGapY = document.getElementById('gridGapY')?.value || DEFAULT_APPEARANCE.gridGapY;
    const showDummyBtn = document.getElementById('toggleDummyBtn')?.classList.contains('active') || false;
    const showUnsorted = document.getElementById('toggleUnsortedBtn')?.classList.contains('active') || false;

    Store.saveAppearance({
        iconSize,
        iconsPerRow,
        gridGapX,
        gridGapY,
        theme: 'dark',
        fontWeight,
        fontColor,
        bgColor,
        accentColor,
        tabActiveBg,
        showDummyBtn,
        showUnsorted,
        customCSS: ''
    });
    applyTheme();
    showToast('Settings saved!', 'success');
}


export function resetConfig() {
    if (confirm('Are you sure you want to reset ALL settings, categories, and providers to default? This cannot be undone.')) {
        localStorage.clear();
        window.location.reload();
    }
}

export function showSection(sectionId, element) {
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

export function getProviders() { return providers; }
export function setProviders(p) { providers = p; renderProviders(); }
export function getCategories() { return categories; }
export function setCategories(c) { categories = c; renderCategories(); updateCategorySelects(); }

export async function loadDummyData() {
    try {
        // Try multiple paths to find dummy.json depending on dev/prod environment
        const paths = ['../../../dummy.json', '../../dummy.json', './dummy.json', '/dummy.json'];
        let imported = null;

        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    imported = await response.json();
                    break;
                }
            } catch (e) { /* continue */ }
        }

        if (!imported) {
            // If fetch fails (common in Electron with file://), try bridge-based approach or fallback
            showToast('Searching for dummy.json...', 'info');
            // Fallback: we know the structure, let's just use it if fetch fails
            throw new Error('Could not find dummy.json in root. Please ensure it exists in the project root.');
        }

        if (imported.providers && imported.categories) {
            setProviders(imported.providers);
            Store.saveProviders(imported.providers);
            setCategories(imported.categories);
            Store.saveCategories(imported.categories);
            showToast('Dummy data loaded successfully!', 'success');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function updateColorPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (input && preview) {
        preview.style.backgroundColor = input.value;
    }
}

export function parseBulkImport(text) {
    const lines = text.split('\n');
    const items = [];
    let currentCategory = 'General';

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 1. Spreadsheet Format Check (Category\tName\tURL[\tIcon])
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim());

            if (parts.length >= 3) {
                // Category | Name | URL | [Icon]
                const [cat, name, rawUrl, icon] = parts;
                if (name && rawUrl) {
                    items.push({
                        name,
                        url: rawUrl.replace(/%s|{{searchTerms}}/g, '{query}'),
                        category: cat || 'General',
                        enabled: true,
                        icon: icon || ''
                    });
                }
                return;
            } else if (parts.length === 2) {
                // Name | URL (Uses current category)
                const [name, rawUrl] = parts;
                if (name && rawUrl) {
                    items.push({
                        name,
                        url: rawUrl.replace(/%s|{{searchTerms}}/g, '{query}'),
                        category: currentCategory,
                        enabled: true,
                        icon: ''
                    });
                }
                return;
            }
        }

        // 2. Markdown Category Check
        if (trimmed.startsWith('#')) {
            currentCategory = trimmed.replace(/^#+\s*/, '').trim();
            return;
        }

        // 3. Line Format Check (Name: URL [| Icon])
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
            const name = trimmed.substring(0, colonIndex).trim();
            let urlPart = trimmed.substring(colonIndex + 1).trim();

            // Optional Icon check (Name: URL | IconURL)
            let icon = '';
            if (urlPart.includes('|')) {
                const [url, iconUrl] = urlPart.split('|').map(p => p.trim());
                urlPart = url;
                icon = iconUrl;
            }

            if (name && urlPart) {
                urlPart = urlPart.replace(/%s|{{searchTerms}}/g, '{query}');
                items.push({
                    name,
                    url: urlPart,
                    category: currentCategory,
                    enabled: true,
                    icon: icon
                });
            }
        }
    });

    return items;
}

export function renderBulkPreview(items) {
    const previewArea = document.getElementById('bulkPreview');
    const previewList = document.getElementById('bulkPreviewList');
    if (!previewArea || !previewList) return;

    if (items.length === 0) {
        previewArea.style.display = 'none';
        return;
    }

    previewArea.style.display = 'block';
    previewList.innerHTML = items.map(item => `
        <div style="margin-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 2px;">
            <strong>${item.name}</strong> <span style="opacity: 0.6">(${item.category})</span><br>
            <span style="font-size: 10px; color: var(--url-color); opacity: 0.8">${item.url}</span>
        </div>
    `).join('');
}

export async function executeBulkImport() {
    const bulkPad = document.getElementById('bulkImportPad');
    if (!bulkPad) return;

    const newItems = parseBulkImport(bulkPad.value);
    if (newItems.length === 0) return alert('No valid providers found to import.');

    if (!confirm(`Import ${newItems.length} providers? This will merge them with your existing list.`)) return;

    // 1. Update Categories if they don't exist
    const existingCats = Store.getCategories();
    newItems.forEach(item => {
        const catName = item.category === 'General' ? 'Unsorted' : (item.category || 'Unsorted');
        if (!existingCats[catName]) {
            existingCats[catName] = '📁'; // Default icon for new categories
        }
        item.category = catName;
    });
    Store.saveCategories(existingCats);
    setCategories(existingCats);

    // 2. Add Favicons in background
    showToast(`Importing ${newItems.length} items...`, 'info');

    const processedItems = newItems.map(item => {
        return {
            ...item,
            icon: item.icon || getFaviconUrl(item.url)
        };
    });

    // 3. Merge and Save
    const currentProviders = Store.getProviders();
    const merged = [...currentProviders, ...processedItems];

    Store.saveProviders(merged);
    setProviders(merged);

    // UI feedback
    bulkPad.value = '';
    renderBulkPreview([]);
    showToast('Bulk import completed!', 'success');

    // Scroll to providers list to show the new items
    setTimeout(() => {
        showSection('providers-list', document.getElementById('nav-providers'));
    }, 1000);
}
