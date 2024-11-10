let isScrapingActive = false;
let businessesFound = 0;
let totalVisibleListings = 0;
let processedListings = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (message.action === 'startScraping') {
    isScrapingActive = true;
    scrapeBusinesses();
  }
  
  return true;
});

async function updateMetrics() {
  chrome.runtime.sendMessage({
    type: 'updateMetrics',
    metrics: {
      total: totalVisibleListings,
      processed: processedListings,
      found: businessesFound
    }
  });
}

async function waitForElement(selector, timeout = 5000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element ${selector} not found after ${timeout}ms`);
}

function getListings() {
  // Multiple selectors to find business listings
  const selectors = [
    'div[role="article"]', // Modern listing container
    'div.Nv2PK', // Alternative listing container
    'a[href^="/maps/place"]', // Direct place links
    'div[jsaction*="mouseover:pane"]' // Clickable listing elements
  ];
  
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length > 0) {
      return elements;
    }
  }
  
  return [];
}

async function scrapeBusinesses() {
  const businesses = [];
  let retryCount = 0;

  try {
    // Wait for the results container to load
    await waitForElement('div[role="feed"]', 10000);
    
    while (isScrapingActive) {
      // Get all business listings using multiple selectors
      const listings = getListings();
      totalVisibleListings = listings.length;
      updateMetrics();
      
      if (listings.length === 0) {
        retryCount++;
        if (retryCount > 3) {
          throw new Error('No business listings found. Please ensure you have search results visible.');
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }

      for (let i = 0; i < listings.length; i++) {
        if (!isScrapingActive) break;

        const listing = listings[i];
        try {
          // Find and click the clickable element
          const clickableElement = listing.querySelector('a[href^="/maps/place"]') || listing;
          clickableElement.click();
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          const business = await extractBusinessData();
          
          if (business && business.name && !businesses.some(b => b.name === business.name)) {
            businesses.push(business);
            businessesFound = businesses.length;
            
            // Update storage and notify dashboard
            chrome.storage.local.set({ businesses });
            chrome.runtime.sendMessage({
              type: 'updateData',
              data: businesses
            });
          }
          
          processedListings++;
          updateMetrics();
          
          // Close the business details panel
          const closeButton = document.querySelector('button[jsaction*="pane.back"], button[aria-label="Back"]');
          if (closeButton) {
            closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
        } catch (error) {
          console.error('Error processing listing:', error);
          processedListings++;
          updateMetrics();
        }
      }

      // Scroll to load more results
      const lastListing = listings[listings.length - 1];
      if (lastListing) {
        lastListing.scrollIntoView({ behavior: 'smooth', block: 'end' });
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
      
      retryCount++;
      if (retryCount > 5) {
        console.log('Reached end of results or maximum retries');
        break;
      }
    }
  } catch (error) {
    console.error('Scraping error:', error);
    chrome.runtime.sendMessage({
      type: 'error',
      message: error.message
    });
  }
}

async function extractBusinessData() {
  try {
    // Wait for the business details panel to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const data = {
      name: '',
      address: '',
      phone: '',
      website: '',
      rating: '',
      reviews: '',
      category: '',
      hours: ''
    };

    // Name (multiple possible selectors)
    const nameSelectors = [
      'h1.DUwDvf',
      'h1.fontHeadlineLarge',
      '.DUwDvf',
      'h1[jsan*="fontHeadlineLarge"]'
    ];
    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.name = element.textContent.trim();
        break;
      }
    }

    // Category
    const categorySelectors = ['.DkEaL', 'button[jsaction*="category"] .fontBodyMedium'];
    for (const selector of categorySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.category = element.textContent.trim();
        break;
      }
    }

    // Address
    const addressSelectors = [
      'button[data-item-id*="address"] .fontBodyMedium',
      'button[data-tooltip="Copy address"] .fontBodyMedium',
      '[data-item-id*="address"]'
    ];
    for (const selector of addressSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.address = element.textContent.replace('Address:', '').trim();
        break;
      }
    }

    // Phone
    const phoneSelectors = [
      'button[data-item-id*="phone:tel"] .fontBodyMedium',
      'button[data-tooltip="Copy phone number"] .fontBodyMedium',
      '[data-item-id*="phone"]'
    ];
    for (const selector of phoneSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.phone = element.textContent.replace('Phone:', '').trim();
        break;
      }
    }

    // Website
    const websiteSelectors = [
      'a[data-item-id*="authority"]',
      'a[data-tooltip="Open website"]',
      'a[href^="http"]'
    ];
    for (const selector of websiteSelectors) {
      const element = document.querySelector(selector);
      if (element && element.href) {
        data.website = element.href;
        break;
      }
    }

    // Rating
    const ratingSelectors = ['div.fontDisplayLarge', '.F7nice'];
    for (const selector of ratingSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.rating = element.textContent.trim();
        break;
      }
    }

    // Reviews
    const reviewsSelectors = ['.HHrUdb', 'span[aria-label*="review"]'];
    for (const selector of reviewsSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const reviewsText = element.textContent.trim();
        const reviewsMatch = reviewsText.match(/\d+/);
        if (reviewsMatch) {
          data.reviews = reviewsMatch[0];
          break;
        }
      }
    }

    // Hours
    const hoursSelectors = ['div[data-item-id*="oh"] .fontBodyMedium', '[aria-label*="Hours"]'];
    for (const selector of hoursSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        data.hours = element.textContent.trim();
        break;
      }
    }

    if (!data.name) {
      throw new Error('Business name not found');
    }

    console.log('Extracted business data:', data);
    return data;
  } catch (error) {
    console.error('Data extraction error:', error);
    return null;
  }
}