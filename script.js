// IMDb Movie Scraper - Frontend JavaScript

const API_BASE_URL = 'http://localhost:5000/api';

// State Management
let moviesData = [];
let filteredMovies = [];
let currentFilters = {
    search: '',
    year: '',
    minRating: '',
    maxRating: ''
};

// DOM Elements
const elements = {
    moviesBody: document.getElementById('moviesBody'),
    loadingContainer: document.getElementById('loadingContainer'),
    errorContainer: document.getElementById('errorContainer'),
    movieCount: document.getElementById('movieCount'),
    totalMovies: document.getElementById('totalMovies'),
    avgRating: document.getElementById('avgRating'),
    lastUpdated: document.getElementById('lastUpdated'),
    searchInput: document.getElementById('searchInput'),
    yearInput: document.getElementById('yearInput'),
    minRating: document.getElementById('minRating'),
    maxRating: document.getElementById('maxRating'),
    filterBtn: document.getElementById('filterBtn'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),
    ratingChart: document.getElementById('ratingChart'),
    decadeChart: document.getElementById('decadeChart')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMovies();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    elements.filterBtn.addEventListener('click', applyFilters);
    elements.clearFiltersBtn.addEventListener('click', clearFilters);
    elements.refreshBtn.addEventListener('click', () => loadMovies(true));
    elements.exportBtn.addEventListener('click', exportData);
    
    // Real-time search
    let searchTimeout;
    elements.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });
    
    elements.yearInput.addEventListener('change', applyFilters);
    elements.minRating.addEventListener('change', applyFilters);
    elements.maxRating.addEventListener('change', applyFilters);
    
    // Enter key support
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
}

// Load Movies
async function loadMovies(forceRefresh = false) {
    showLoading(true);
    hideError();
    
    try {
        const url = new URL(`${API_BASE_URL}/movies`);
        if (forceRefresh) {
            url.searchParams.append('refresh', 'true');
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load movies');
        }
        
        moviesData = data.data;
        filteredMovies = [...moviesData];
        updateStats(data);
        renderMovies(filteredMovies);
        loadStatistics();
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading movies:', error);
        showError(error.message);
        showLoading(false);
    }
}

// Render Movies
function renderMovies(movies) {
    if (!movies || movies.length === 0) {
        elements.moviesBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    No movies found matching your filters
                </td>
            </tr>
        `;
        elements.movieCount.textContent = 'Showing 0 movies';
        return;
    }
    
    let html = '';
    movies.forEach((movie, index) => {
        const rating = parseFloat(movie.rating) || 0;
        let ratingClass = 'low';
        if (rating >= 8) ratingClass = 'high';
        else if (rating >= 7) ratingClass = 'medium';
        
        html += `
            <tr>
                <td><span class="rank-badge">${movie.rank || index + 1}</span></td>
                <td>
                    <span class="movie-title">${escapeHtml(movie.title)}</span>
                </td>
                <td><span class="movie-year">${movie.year || 'N/A'}</span></td>
                <td><span class="rating-badge ${ratingClass}">${movie.rating || 'N/A'}</span></td>
                <td><span class="votes-text">${movie.votes || 'N/A'}</span></td>
                <td>
                    ${movie.url && movie.url !== 'N/A' ? 
                        `<a href="${movie.url}" target="_blank" class="view-link">View</a>` : 
                        '<span style="color: var(--text-light); font-size: 0.8rem;">N/A</span>'
                    }
                </td>
            </tr>
        `;
    });
    
    elements.moviesBody.innerHTML = html;
    elements.movieCount.textContent = `Showing ${movies.length} movies`;
}

// Update Statistics
function updateStats(data) {
    if (data.total) {
        elements.totalMovies.textContent = data.total;
    }
    
    if (data.last_updated) {
        const date = new Date(data.last_updated);
        elements.lastUpdated.textContent = date.toLocaleDateString();
    }
}

// Load Statistics
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/statistics`);
        const data = await response.json();
        
        if (data.success) {
            const stats = data.data;
            elements.avgRating.textContent = stats.average_rating.toFixed(1);
            
            // Render charts
            renderRatingChart(stats.rating_distribution);
            renderDecadeChart(stats.decade_distribution);
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Render Rating Chart
function renderRatingChart(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
        elements.ratingChart.innerHTML = '<p style="color: var(--text-light);">No data available</p>';
        return;
    }
    
    const maxValue = Math.max(...Object.values(distribution));
    let html = '';
    const entries = Object.entries(distribution).slice(0, 10);
    
    entries.forEach(([range, count]) => {
        const percentage = (count / maxValue) * 100;
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <div style="width: 100%; height: 150px; display: flex; align-items: flex-end;">
                    <div style="width: 100%; height: ${percentage}%; background: linear-gradient(180deg, #f5c518, #e6b800); border-radius: 4px 4px 0 0; transition: height 1s ease;"></div>
                </div>
                <span style="font-size: 0.7rem; color: var(--text-light);">${range}</span>
            </div>
        `;
    });
    
    elements.ratingChart.innerHTML = html;
}

// Render Decade Chart
function renderDecadeChart(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
        elements.decadeChart.innerHTML = '<p style="color: var(--text-light);">No data available</p>';
        return;
    }
    
    const maxValue = Math.max(...Object.values(distribution));
    let html = '';
    const entries = Object.entries(distribution);
    
    entries.forEach(([decade, count]) => {
        const percentage = (count / maxValue) * 100;
        const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2c3e50'];
        const colorIndex = entries.indexOf([decade, count]) % colors.length;
        
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <div style="width: 100%; height: 150px; display: flex; align-items: flex-end;">
                    <div style="width: 100%; height: ${percentage}%; background: ${colors[colorIndex]}; border-radius: 4px 4px 0 0; transition: height 1s ease;"></div>
                </div>
                <span style="font-size: 0.7rem; color: var(--text-light);">${decade}</span>
            </div>
        `;
    });
    
    elements.decadeChart.innerHTML = html;
}

// Apply Filters
function applyFilters() {
    const search = elements.searchInput.value.trim().toLowerCase();
    const year = elements.yearInput.value.trim();
    const minRating = elements.minRating.value.trim();
    const maxRating = elements.maxRating.value.trim();
    
    currentFilters = { search, year, minRating, maxRating };
    
    filteredMovies = moviesData.filter(movie => {
        // Search filter
        if (search && !movie.title.toLowerCase().includes(search)) {
            return false;
        }
        
        // Year filter
        if (year && movie.year && movie.year !== 'N/A') {
            if (parseInt(movie.year) !== parseInt(year)) {
                return false;
            }
        } else if (year) {
            return false;
        }
        
        // Rating filters
        const rating = parseFloat(movie.rating);
        if (!isNaN(rating)) {
            if (minRating && rating < parseFloat(minRating)) {
                return false;
            }
            if (maxRating && rating > parseFloat(maxRating)) {
                return false;
            }
        } else {
            if (minRating || maxRating) {
                return false;
            }
        }
        
        return true;
    });
    
    renderMovies(filteredMovies);
}

// Clear Filters
function clearFilters() {
    elements.searchInput.value = '';
    elements.yearInput.value = '';
    elements.minRating.value = '';
    elements.maxRating.value = '';
    
    currentFilters = { search: '', year: '', minRating: '', maxRating: '' };
    filteredMovies = [...moviesData];
    renderMovies(filteredMovies);
}

// Export Data
async function exportData() {
    try {
        const response = await fetch(`${API_BASE_URL}/movies/export`);
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `imdb_top250_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('CSV exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export CSV', 'error');
    }
}

// Show/Hide Loading
function showLoading(show) {
    if (show) {
        elements.loadingContainer.classList.add('active');
        elements.moviesBody.innerHTML = '';
    } else {
        elements.loadingContainer.classList.remove('active');
    }
}

// Show/Hide Error
function showError(message) {
    elements.errorContainer.style.display = 'block';
    elements.errorContainer.querySelector('.error-message').textContent = `❌ ${message}`;
}

function hideError() {
    elements.errorContainer.style.display = 'none';
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideIn 0.5s ease;
        font-weight: 500;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}