let isPaused = false;

document.getElementById('pauseButton').addEventListener('click', () => {
  isPaused = !isPaused;
  const button = document.getElementById('pauseButton');
  button.textContent = isPaused ? 'Resume' : 'Pause';
  chrome.runtime.sendMessage({ action: isPaused ? 'pause' : 'resume' });
});

document.getElementById('exportButton').addEventListener('click', () => {
  chrome.storage.local.get(['businesses'], (result) => {
    if (!result.businesses || !result.businesses.length) {
      alert('No data available to export');
      return;
    }

    const csv = convertToCSV(result.businesses);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    chrome.downloads.download({
      url: url,
      filename: `google_maps_data_${timestamp}.csv`
    });
  });
});

function convertToCSV(businesses) {
  const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Hours'];
  const rows = businesses.map(b => [
    b.name,
    b.category,
    b.address,
    b.phone,
    b.website,
    b.rating,
    b.reviews,
    b.hours
  ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

function updateTable(businesses) {
  const tbody = document.getElementById('businessData');
  tbody.innerHTML = '';
  
  businesses.forEach(business => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${business.name || ''}</td>
      <td>${business.category || ''}</td>
      <td>${business.address || ''}</td>
      <td>${business.phone || ''}</td>
      <td>${business.rating || ''}</td>
      <td>${business.reviews || ''}</td>
      <td>${business.website ? `<a href="${business.website}" target="_blank">Visit</a>` : ''}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateMetrics(metrics) {
  document.getElementById('totalListings').textContent = metrics.total;
  document.getElementById('processedCount').textContent = metrics.processed;
  document.getElementById('dataCollected').textContent = metrics.found;
}

// Listen for updates from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateMetrics') {
    updateMetrics(message.metrics);
  } else if (message.type === 'updateData') {
    updateTable(message.data);
  }
});

// Initial load of data
chrome.storage.local.get(['businesses'], (result) => {
  if (result.businesses) {
    updateTable(result.businesses);
  }
});