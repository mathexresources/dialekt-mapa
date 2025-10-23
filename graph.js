// graph.js
// Renders a Chart.js bar chart inside the modal with id 'regionModal'.
// Exposes showRegionModal(name, counts, htmlDetails)

let _regionChart = null;

function _makeChart(ctx, labels, data) {
    // Destroy previous chart if exists
    if (_regionChart) {
        try { _regionChart.destroy(); } catch (e) { /* ignore */ }
        _regionChart = null;
    }

    const colors = [
        '#1f77b4', '#d62728'
    ];

    _regionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Počet',
                data: data,
                borderWidth: 1,
                backgroundColor: labels.map((_, i) => colors[i % colors.length])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    align: 'start' // align legend to the left of the bottom area
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const v = context.parsed !== undefined ? context.parsed : context.raw;
                            return `${context.label}: ${v}`;
                        }
                    }
                }
            },
            layout: {
                padding: 8
            }
        }
    });
}

function showRegionModal(name, counts, htmlDetails) {
    const modalEl = document.getElementById('regionModal');
    if (!modalEl) {
        console.warn('Modal element #regionModal not found');
        return;
    }

    // Set title and details html
    const titleEl = modalEl.querySelector('#regionModalLabel');
    const detailsEl = modalEl.querySelector('#regionDetails');
    const canvas = modalEl.querySelector('#regionChart');

    if (titleEl) titleEl.textContent = name;
    if (detailsEl) detailsEl.innerHTML = htmlDetails || '';

    // Prepare chart data from counts object (word -> number)
    const labels = Object.keys(counts || {});
    const data = labels.map(k => counts[k]);

    // If there's no canvas, just show modal with details
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    if (!canvas) {
        modal.show();
        return;
    }

    // Give the canvas parent a height if not set so Chart.js can measure when modal shown
    const parent = canvas.parentElement;
    if (parent && !parent.style.height) parent.style.height = '300px';

    // Attach a one-time handler to create the chart after modal is visible so sizing is correct
    modalEl.addEventListener('shown.bs.modal', function handler() {
        try { if (_regionChart) { _regionChart.destroy(); _regionChart = null; } } catch (e) { /* ignore */ }
        const ctx = canvas.getContext('2d');
        _makeChart(ctx, labels, data);
    }, { once: true });

    // Ensure we clean up the chart when modal is hidden to free resources; attach only once
    if (!modalEl._chartCleanupAttached) {
        modalEl.addEventListener('hidden.bs.modal', function() {
            if (_regionChart) {
                try { _regionChart.destroy(); } catch (e) { /* ignore */ }
                _regionChart = null;
            }
        });
        modalEl._chartCleanupAttached = true;
    }

    modal.show();
}

// Expose globally
window.showRegionModal = showRegionModal;
