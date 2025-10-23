// Shared color map (used by styling and legend)
// Keys are normalized (ASCII-only) to avoid IDE warnings about non-ASCII identifiers
const COLORS = {
    'dyl': '#1f77b4',
    'pozdeji': '#d62728'
};
// Human-friendly labels (original words with diacritics) for the legend
const LABELS = {
    'dyl': 'dýl',
    'pozdeji': 'později'
};

// Import from data.csv (word, region)
let csvData = [];

function parseCSVText(text) {
    const lines = text.split('\n');
    const out = [];
    for (let line of lines) {
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 2) continue;
        const word = parts[0] && parts[0].trim();
        const region = parts[1] && parts[1].trim();
        if (word && region) out.push({ word, region });
    }
    return out;
}

function normalizeKey(s) {
    if (!s) return '';
    return s.toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

function getFeatureName(feature) {
    // Try common property names, fallback to feature.name if present
    if (!feature) return null;
    const p = feature.properties || {};
    return p.name || p.NAZEV || p.Nazev || p.nazev || p.okres || feature.name || null;
}

function wordToColor(region) {
    if (!region) return '#ffffff';
    const regionData = csvData.filter(entry => entry.region === region);
    let counts = {};
    regionData.forEach(entry => {
        const key = normalizeKey(entry.word);
        if (!key) return;
        if (!counts[key]) counts[key] = 0;
        counts[key]++;
    });
    let maxKey = null, maxCount = 0;
    for (let k in counts) {
        if (counts[k] > maxCount) {
            maxCount = counts[k];
            maxKey = k;
        }
    }
    return COLORS[maxKey] || '#cccccc';
}

function toolbindHTML(region) {
    if (!region) return '<em>Unknown region</em>';
    const regionData = csvData.filter(entry => entry.region === region);
    let counts = {};
    regionData.forEach(entry => {
        if (!counts[entry.word]) counts[entry.word] = 0;
        counts[entry.word]++;
    });
    let html = `<strong>${region}</strong><br/>`;
    for (let word in counts) html += `${word}: ${counts[word]}<br/>`;
    if (Object.keys(counts).length === 0) html += '<em>No data</em>';
    return html;
}

// Initialize map variable (we'll set view after creating the map)
const map = L.map('map').setView([49.8, 15.5], 8);

// Light / white basemap (CartoDB Positron)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Named functions for styling and per-feature behavior to avoid analyzer warnings
function styleFeature(feature) {
    return {
        color: '#333',
        weight: 1,
        fillColor: wordToColor(getFeatureName(feature)),
        fillOpacity: 0.4
    };
}

// Load CSV, then load GeoJSON and render
fetch('data.csv')
    .then(r => r.text())
    .then(text => {
        csvData = parseCSVText(text);
    })
    .then(() => fetch('okresy.json'))
    .then(r => r.json())
    .then(data => {
        // Create GeoJSON layer with styling
        const geojsonLayer = L.geoJSON(data, {
            style: styleFeature
        }).addTo(map);

        // Attach per-layer behavior (tooltips, events) after creation
        geojsonLayer.eachLayer(layer => {
            const feature = layer.feature;
            const name = getFeatureName(feature) || 'Unknown';
            layer.bindTooltip(toolbindHTML(name));
            layer.on('click', () => {
                // Build counts object for this region (word -> count)
                const regionData = csvData.filter(entry => entry.region === name);
                const counts = {};
                regionData.forEach(e => {
                    counts[e.word] = (counts[e.word] || 0) + 1;
                });
                // HTML details (reuse existing helper)
                const detailsHtml = toolbindHTML(name);
                // Use graph.js function to show modal and chart
                if (typeof window.showRegionModal === 'function') {
                    window.showRegionModal(name, counts, detailsHtml);
                } else {
                    // Fallback: alert if graph.js isn't loaded
                    alert('Clicked: ' + name + '\n' + JSON.stringify(counts));
                }
            });
            layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.8 }));
            layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.4 }));
        });

        // Add Bootstrap-styled legend in bottom-left
        const legend = L.control({ position: 'bottomleft' });
        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'card p-2 legend-card');
            // Prevent clicks on the legend from propagating to the map
            L.DomEvent.disableClickPropagation(div);

            let inner = '<div class="card-body p-2">';
            inner += '<h6 class="card-title mb-2">Legenda</h6>';
            inner += '<div class="card-text">';
            for (const key of Object.keys(COLORS)) {
                const label = LABELS[key] || key;
                const color = COLORS[key];
                inner += `<div class="d-flex align-items-center mb-1"><span class="legend-swatch" style="background:${color}"></span><span>${label}</span></div>`;
            }
            inner += '</div></div>';
            inner += '<a class="btn btn-outline-primary" href="https://docs.google.com/forms/d/e/1FAIpQLSdQa9-3ygqWKbs_nBXb0UjPG2cN0GW_7Eo0APm6pfpSIjjx2g/viewform?usp=dialog">Vyplnit dotazník</a>'
            div.innerHTML = inner;
            return div;
        };
        legend.addTo(map);
    })
    .catch(err => console.error('Data load error:', err));
