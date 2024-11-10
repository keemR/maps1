document.getElementById('startScraping').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url?.includes('google.com/maps')) {
      showStatus('Please navigate to Google Maps first', true);
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
    } catch (error) {
      showStatus('Please refresh the page and try again', true);
      return;
    }

    const button = document.getElementById('startScraping');
    button.disabled = true;
    showStatus('Scraping started. Open dashboard to view progress.');

    chrome.tabs.sendMessage(tab.id, { action: 'startScraping' });
  } catch (error) {
    showStatus('An error occurred. Please try again.', true);
    console.error('Start scraping error:', error);
  }
});

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: 'dashboard.html' });
});

function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = isError ? 'error' : '';
}