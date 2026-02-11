import { DEFAULT_PROVIDERS, DEFAULT_CATEGORIES, DEFAULT_APPEARANCE } from '../../shared/constants.js';

let currentQuery = '';
let currentCategory = 'Unsorted';
let savedScrollPosition = 0;
let wheelTimeout;

document.addEventListener('DOMContentLoaded', () => {
    window.electronAPI.onSelectedText((text) => {
        currentQuery = text;
        savedScrollPosition = 0; // Always start from the first category

        // Reset to first available category if needed, respecting settings
        const { activeCategories } = getFilteredData();

        if (!activeCategories.includes(currentCategory)) {
            currentCategory = activeCategories[0] || 'Unsorted';
        }

        applyTheme();
        renderPopup();
    });

    // Add context menu listener
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.electronAPI.showPopupContextMenu();
    });
});

function getCategories() {
    return JSON.parse(localStorage.getItem('searchCategories') || JSON.stringify(DEFAULT_CATEGORIES));
}

function getProviders() {
    return JSON.parse(localStorage.getItem('searchProviders') || JSON.stringify(DEFAULT_PROVIDERS));
}

/**
 * Centrally managed filtering logic for providers and categories
 * Respects 'showUnsorted' and 'enabled' flags
 */
function getFilteredData() {
    const showUnsorted = localStorage.getItem('showUnsorted') !== 'false';
    const allProviders = getProviders();
    const enabledProviders = allProviders.filter(p => p.enabled);

    const filteredProviders = enabledProviders.filter(p => {
        const cat = p.category || 'Unsorted';
        return showUnsorted || cat !== 'Unsorted';
    });

    const activeCategories = [...new Set(filteredProviders.map(p => p.category || 'Unsorted'))];

    return { filteredProviders, activeCategories };
}

function applyTheme() {
    const fontWeight = localStorage.getItem('fontWeight') || '500';
    const fontColor = localStorage.getItem('fontColor');
    const bgColor = localStorage.getItem('bgColor');
    const accentColor = localStorage.getItem('accentColor');
    const tabActiveBg = localStorage.getItem('tabActiveBg');

    // Always signal dark theme to main process if needed
    if (window.electronAPI) window.electronAPI.setTheme('dark');

    // Inject custom styles as CSS variables
    const root = document.documentElement;
    root.style.setProperty('--popup-font-weight', fontWeight);

    if (fontColor) {
        root.style.setProperty('--label-color', fontColor);
        root.style.setProperty('--popup-text', fontColor);
    }
    if (bgColor) {
        root.style.setProperty('--popup-bg', bgColor);
    }
    if (accentColor) {
        root.style.setProperty('--tab-indicator', accentColor);
        root.style.setProperty('--accent-color', accentColor);

        // Dynamic glow shadow using accent color
        // If it's a hex, we add transparency. If not, we fallback to a standard glow.
        const glowColor = accentColor.startsWith('#') ? `${accentColor}33` : 'rgba(255, 255, 255, 0.1)';
        root.style.setProperty('--shadow', `0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px ${glowColor}`);
    }
    if (tabActiveBg) {
        root.style.setProperty('--tab-active-bg', tabActiveBg);
    }

    // Grid spacing and width logic
    const iconSize = parseInt(localStorage.getItem('iconSize') || DEFAULT_APPEARANCE.iconSize);
    const iconsPerRow = parseInt(localStorage.getItem('iconsPerRow') || DEFAULT_APPEARANCE.iconsPerRow);
    const gridGapX = parseInt(localStorage.getItem('gridGapX') || DEFAULT_APPEARANCE.gridGapX);
    const gridGapY = parseInt(localStorage.getItem('gridGapY') || DEFAULT_APPEARANCE.gridGapY);

    const wrapperPadding = 12; // 6px padding on each side
    const wrapperSize = iconSize + wrapperPadding;

    root.style.setProperty('--grid-gap-x', `${gridGapX}px`);
    root.style.setProperty('--grid-gap-y', `${gridGapY}px`);
    root.style.setProperty('--wrapper-size', `${wrapperSize}px`);

    // Width = (num_icons * wrapper_size) + ((num_icons - 1) * gap) + padding_left + padding_right
    // Total horizontal padding in the grid container is 32px (16px on each side)
    let maxWidth = (wrapperSize * iconsPerRow) + (gridGapX * (iconsPerRow - 1)) + 32;

    root.style.setProperty('--popup-max-width', `${maxWidth}px`);
}

function updateIconGrid() {
    const providers = getProviders();
    const enabledProviders = providers.filter(p => p.enabled);
    const iconSize = parseInt(localStorage.getItem('iconSize') || '32');

    const root = document.documentElement;
    const maxWidthStr = root.style.getPropertyValue('--popup-max-width') || '400px';
    const maxWidth = parseInt(maxWidthStr);

    const container = document.getElementById('icons-container');
    if (!container) return;

    // Find existing grid
    let grid = container.querySelector('.icon-grid');
    if (!grid) return; // Grid doesn't exist yet

    // Update widths
    grid.style.maxWidth = `${maxWidth}px`;
    grid.style.width = 'max-content';
    const tabsWrapper = container.querySelector('.category-tabs-wrapper');
    if (tabsWrapper) tabsWrapper.style.maxWidth = `${maxWidth}px`;

    // Clear and rebuild grid with current category
    grid.innerHTML = '';

    const { filteredProviders } = getFilteredData();

    filteredProviders
        .filter(p => (p.category || 'Unsorted') === currentCategory)
        .forEach(provider => {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'provider-icon-wrapper';
            iconContainer.setAttribute('data-tooltip', provider.name);

            const img = document.createElement('img');
            img.src = provider.icon || getFaviconUrl(provider.url);
            img.className = 'provider-icon';
            img.style.width = `${iconSize}px`;
            img.style.height = `${iconSize}px`;

            // Error handling for icons to prevent blank spots
            img.onerror = () => {
                img.src = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>${provider.name[0]}</text></svg>`;
            };

            img.onclick = () => {
                window.electronAPI.search(provider.url, currentQuery);
            };

            // Middle click support
            img.onmousedown = (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    window.electronAPI.copyAndSearch(provider.url, currentQuery);
                }
            };

            iconContainer.appendChild(img);
            grid.appendChild(iconContainer);
        });

    // Resize after grid is updated (in case content height changed)
    requestAnimationFrame(() => {
        resizePopup();
        // Force a second resize after a brief moment to catch any late layout changes or image rendering
        setTimeout(resizePopup, 50);
    });
}

function resizePopup() {
    const wrapper = document.getElementById('main-wrapper');
    if (wrapper && window.electronAPI && window.electronAPI.resizePopup) {
        // Use offsetWidth/Height to get precise measurements including padding
        const width = wrapper.offsetWidth;
        const height = wrapper.offsetHeight;
        window.electronAPI.resizePopup(width, height);
    }
}

function updateCategoryLabel() {
    const label = document.getElementById('category-name-label');
    if (label) {
        label.textContent = currentCategory;
    }
}

function renderPopup() {
    const categories = getCategories();
    const { filteredProviders, activeCategories } = getFilteredData();
    const iconSize = parseInt(localStorage.getItem('iconSize') || '32');

    const container = document.getElementById('icons-container');
    if (!container) return;

    // Save current scroll position before clearing
    const existingTabs = container.querySelector('.category-tabs');
    if (existingTabs) {
        savedScrollPosition = existingTabs.scrollLeft;
    }

    container.innerHTML = '';

    // Use calculated maxWidth from root
    const maxWidth = parseInt(document.documentElement.style.getPropertyValue('--popup-max-width')) || 400;

    // 0. Search Bar
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-input';
    searchInput.placeholder = 'Pop Search...';
    searchInput.value = currentQuery;

    searchInput.oninput = (e) => {
        currentQuery = e.target.value;
        updateIconGrid(); // Update icons as user types
    };

    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const { filteredProviders } = getFilteredData();
            const firstProvider = filteredProviders.filter(p => (p.category || 'Unsorted') === currentCategory)[0];
            if (firstProvider) {
                window.electronAPI.search(firstProvider.url, currentQuery);
            }
        }
    };

    searchContainer.appendChild(searchInput);
    container.appendChild(searchContainer);

    // Auto-focus the search bar
    requestAnimationFrame(() => {
        setTimeout(() => searchInput.focus(), 50);
    });

    // Shared wheel event handler for category switching
    const handleWheelEvent = (e) => {
        if (activeCategories.length <= 1) return;
        e.preventDefault();
        clearTimeout(wheelTimeout);

        // deadzone to prevent accidental triggers on sensitive wheels/trackpads
        if (Math.abs(e.deltaY) < 5 && Math.abs(e.deltaX) < 5) return;

        wheelTimeout = setTimeout(() => {
            const categoryTabs = Array.from(container.querySelectorAll('.category-tab'));
            const currentIndex = categoryTabs.findIndex(t => t.title === currentCategory);

            // Use deltaY primarily, fallback to deltaX for horizontal-only scrolling
            const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

            if (delta > 0 && currentIndex < categoryTabs.length - 1) {
                categoryTabs[currentIndex + 1].click();
            } else if (delta < 0 && currentIndex > 0) {
                categoryTabs[currentIndex - 1].click();
            }
        }, 40); // 40ms debounce
    };

    // 1. Category Bar
    if (activeCategories.length > 1) {
        const wrapper = document.createElement('div');
        wrapper.className = 'category-tabs-wrapper';

        // Set max-width to match icon grid
        wrapper.style.maxWidth = `${maxWidth}px`;

        const tabs = document.createElement('div');
        tabs.className = 'category-tabs';

        activeCategories.forEach(cat => {
            const tab = document.createElement('div');
            tab.className = `category-tab ${cat === currentCategory ? 'active' : ''}`;
            let icon = categories[cat];
            if (!icon) {
                icon = cat === 'Unsorted' ? '🔴' : '❓';
            }

            if (isImageSource(icon)) {
                const iconImg = document.createElement('img');
                iconImg.src = icon;
                iconImg.style.width = '18px';
                iconImg.style.height = '18px';
                iconImg.style.objectFit = 'contain';
                tab.appendChild(iconImg);
            } else {
                tab.textContent = icon;
            }

            tab.title = cat;
            tab.onclick = (e) => {
                e.stopPropagation();
                if (cat === currentCategory) return;

                currentCategory = cat;

                // Update tab styles
                tabs.querySelectorAll('.category-tab').forEach(t => {
                    t.classList.toggle('active', t.title === currentCategory);
                });

                // Scroll the clicked tab to the start (edge)
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });

                updateCategoryLabel();
                updateIconGrid();
            };
            tabs.appendChild(tab);
        });


        const label = document.createElement('div');
        label.id = 'category-name-label';
        label.textContent = currentCategory;
        wrapper.appendChild(label);

        wrapper.appendChild(tabs);
        container.appendChild(wrapper);
    }

    // 2. Icon Grid
    const grid = document.createElement('div');
    grid.className = 'icon-grid';
    grid.style.maxWidth = `${maxWidth}px`;
    grid.style.width = 'max-content';

    // Add global wheel support for category switching
    if (activeCategories.length > 1) {
        container.addEventListener('wheel', handleWheelEvent, { passive: false });
    }

    container.appendChild(grid);

    // Initial grid render
    updateIconGrid();

    // Restore scroll position
    if (activeCategories.length > 1) {
        setTimeout(() => {
            const tabs = container.querySelector('.category-tabs');
            if (tabs) {
                tabs.scrollLeft = savedScrollPosition;
            }
        }, 50);
    }
}

function isImageSource(str) {
    if (!str) return false;
    const s = str.trim();
    return s.startsWith('http') || s.startsWith('data:image') || s.startsWith('./') || s.startsWith('../');
}

function getFaviconUrl(url) {
    try {
        // Strip common placeholders to extract valid domain
        const cleanUrl = url.replace(/{query}|%s|{{searchTerms}}/g, '');
        const domain = new URL(cleanUrl).hostname;
        return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch {
        return '';
    }
}
