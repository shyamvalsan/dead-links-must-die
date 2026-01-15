// DOM Elements
const scanForm = document.getElementById('scan-form');
const urlInput = document.getElementById('url-input');
const scanButton = document.getElementById('scan-button');
const inputSection = document.getElementById('input-section');
const progressSection = document.getElementById('progress-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

// Progress elements
const stageText = document.getElementById('stage-text');
const pagesFoundEl = document.getElementById('pages-found');
const pagesCrawledEl = document.getElementById('pages-crawled');
const linksCheckedEl = document.getElementById('links-checked');
const brokenCountEl = document.getElementById('broken-count');
const progressBar = document.getElementById('progress-bar');
const etaText = document.getElementById('eta-text');
const elapsedTimeEl = document.getElementById('elapsed-time');
const liveBrokenLinksSection = document.getElementById('live-broken-links-section');
const liveBrokenLinksContainer = document.getElementById('live-broken-links-container');

// Dashboard elements
const dashPages = document.getElementById('dash-pages');
const dashLinks = document.getElementById('dash-links');
const dashWorking = document.getElementById('dash-working');
const dashBroken = document.getElementById('dash-broken');

// Results elements
const resultElapsed = document.getElementById('result-elapsed');
const resultPages = document.getElementById('result-pages');
const resultLinks = document.getElementById('result-links');
const resultWorking = document.getElementById('result-working');
const resultRedirects = document.getElementById('result-redirects');
const resultWarnings = document.getElementById('result-warnings');
const resultBroken = document.getElementById('result-broken');
const brokenLinksContainer = document.getElementById('broken-links-container');
const warningsContainer = document.getElementById('warnings-container');
const redirectsContainer = document.getElementById('redirects-container');
const pagesContainer = document.getElementById('pages-container');
const newScanButton = document.getElementById('new-scan-button');

// Error elements
const errorMessage = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');

// State
let currentEventSource = null;
let displayedBrokenLinks = 0; // Track how many broken links we've already displayed

// Event Listeners
scanForm.addEventListener('submit', handleScanSubmit);
newScanButton.addEventListener('click', resetToInput);
retryButton.addEventListener('click', resetToInput);

async function handleScanSubmit(e) {
  e.preventDefault();
  const url = urlInput.value.trim();

  if (!url) return;

  // Disable input
  scanButton.disabled = true;
  scanButton.innerHTML = '<span class="button-text">Starting...</span>';

  try {
    // Start scan
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start scan');
    }

    const { scanId } = await response.json();

    // Show progress section
    inputSection.classList.add('hidden');
    progressSection.classList.remove('hidden');

    // Connect to SSE for progress updates
    connectToProgress(scanId);

  } catch (error) {
    showError(error.message);
    scanButton.disabled = false;
    scanButton.innerHTML = '<span class="button-text">Start Scan</span>';
  }
}

function connectToProgress(scanId) {
  currentEventSource = new EventSource(`/api/scan/${scanId}/progress`);

  currentEventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateProgress(data);

    if (data.status === 'completed') {
      currentEventSource.close();
      showResults(data);
    } else if (data.status === 'error') {
      currentEventSource.close();
      showError(data.error || 'Scan failed');
    }
  };

  currentEventSource.onerror = (error) => {
    console.error('SSE error:', error);
    currentEventSource.close();
  };
}

function updateProgress(data) {
  const { progress } = data;

  // Update stage
  const stageMessages = {
    initializing: '🔍 Initializing scan...',
    scanning: '🕷️ Crawling website...',
    crawling: '🕷️ Crawling website...',
    checking_links: '🔗 Checking links...',
    checking: '🔗 Checking links...',
    completed: '✅ Scan complete!'
  };

  stageText.textContent = stageMessages[progress.stage] || progress.stage;

  // Update stats
  pagesFoundEl.textContent = progress.pagesFound || 0;
  pagesCrawledEl.textContent = progress.pagesCrawled || 0;
  linksCheckedEl.textContent = progress.linksChecked || 0;
  brokenCountEl.textContent = progress.brokenLinks || 0;

  // Update progress bar
  if (progress.stage === 'checking' && progress.totalLinks > 0) {
    const percentage = (progress.linksChecked / progress.totalLinks) * 100;
    progressBar.style.width = `${percentage}%`;
  } else if (progress.stage === 'crawling') {
    progressBar.style.width = '50%';
  } else {
    progressBar.style.width = '10%';
  }

  // Update ETA
  if (progress.eta !== null && progress.eta > 0) {
    const seconds = Math.ceil(progress.eta / 1000);
    if (seconds < 60) {
      etaText.textContent = `Estimated time remaining: ${seconds} seconds`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      etaText.textContent = `Estimated time remaining: ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  } else if (progress.stage === 'checking' || progress.stage === 'checking_links') {
    etaText.textContent = 'Calculating time remaining...';
  } else {
    etaText.textContent = 'Scanning...';
  }

  // Update elapsed time
  if (progress.elapsedTime) {
    const seconds = Math.floor(progress.elapsedTime / 1000);
    if (seconds < 60) {
      elapsedTimeEl.textContent = `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSecs = seconds % 60;
      elapsedTimeEl.textContent = `${minutes}m ${remainingSecs}s`;
    }
  }

  // Update live broken links (REAL-TIME!)
  if (data.liveBrokenLinks && data.liveBrokenLinks.length > 0) {
    // Show section if hidden
    if (liveBrokenLinksSection.classList.contains('hidden')) {
      liveBrokenLinksSection.classList.remove('hidden');
    }

    // Display any new broken links
    const newBrokenLinks = data.liveBrokenLinks.slice(displayedBrokenLinks);

    newBrokenLinks.forEach(link => {
      const linkElement = document.createElement('div');
      linkElement.className = 'live-broken-item';

      const occurrencesText = link.occurrences.length > 3
        ? `Found on ${link.occurrences.length} pages`
        : link.occurrences.map(occ => occ.page).join(', ');

      linkElement.innerHTML = `
        <span class="live-broken-url">${escapeHtml(link.url)}</span>
        <span class="live-broken-status">${escapeHtml(link.status)} - ${escapeHtml(link.message)}</span>
        <div class="live-broken-pages">
          ${escapeHtml(occurrencesText)}
        </div>
      `;

      // Add to top of container (most recent first)
      liveBrokenLinksContainer.insertBefore(linkElement, liveBrokenLinksContainer.firstChild);
    });

    displayedBrokenLinks = data.liveBrokenLinks.length;
  }
}

function showResults(data) {
  progressSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  const { results, progress } = data;

  // Calculate final elapsed time
  const elapsedSeconds = Math.floor((progress.elapsedTime || 0) / 1000);
  let elapsedText;
  if (elapsedSeconds < 60) {
    elapsedText = `${elapsedSeconds}s`;
  } else {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    elapsedText = `${minutes}m ${seconds}s`;
  }

  // Update dashboard
  dashPages.textContent = results.summary.totalPages;
  dashLinks.textContent = results.summary.totalLinks;
  dashWorking.textContent = results.summary.workingLinks;
  dashBroken.textContent = results.summary.brokenLinks;

  // Update summary
  resultElapsed.textContent = elapsedText;
  resultPages.textContent = results.summary.totalPages;
  resultLinks.textContent = results.summary.totalLinks;
  resultWorking.textContent = results.summary.workingLinks;
  resultRedirects.textContent = results.summary.redirects;
  resultWarnings.textContent = results.summary.warnings || 0;
  resultBroken.textContent = results.summary.brokenLinks;

  // Show broken links
  if (results.brokenLinks.length > 0) {
    const brokenLinksHtml = `
      <div class="results-group">
        <h3>🔴 Broken Links (${results.brokenLinks.length})</h3>
        ${results.brokenLinks.map(link => `
          <div class="link-item">
            <span class="link-url">${escapeHtml(link.url)}</span>
            <span class="link-status">${escapeHtml(link.status)} - ${escapeHtml(link.message)}</span>
            <div class="occurrences">
              <div class="occurrences-title">Found on ${link.occurrences.length} page${link.occurrences.length > 1 ? 's' : ''}:</div>
              ${link.occurrences.slice(0, 5).map(occ => `
                <div class="occurrence">
                  • <span class="occurrence-page">${escapeHtml(occ.page)}</span>
                  ${occ.type === 'image' ? '(image)' : `- ${escapeHtml(occ.text.substring(0, 60))}${occ.text.length > 60 ? '...' : ''}`}
                </div>
              `).join('')}
              ${link.occurrences.length > 5 ? `<div class="occurrence">... and ${link.occurrences.length - 5} more</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    brokenLinksContainer.innerHTML = brokenLinksHtml;
  }

  // Show warnings (403/401)
  if (results.warnings && results.warnings.length > 0) {
    const warningsHtml = `
      <div class="results-group">
        <h3>⚠️ Warnings - Access Denied (${results.warnings.length})</h3>
        <p class="group-description">These links returned 403/401 status codes. They may be accessible to users but blocked for crawlers.</p>
        ${results.warnings.map(link => `
          <div class="link-item warning">
            <span class="link-url">${escapeHtml(link.url)}</span>
            <span class="link-status">${escapeHtml(link.status)} - ${escapeHtml(link.message)}</span>
            <div class="occurrences">
              <div class="occurrences-title">Found on ${link.occurrences.length} page${link.occurrences.length > 1 ? 's' : ''}:</div>
              ${link.occurrences.slice(0, 3).map(occ => `
                <div class="occurrence">
                  • <span class="occurrence-page">${escapeHtml(occ.page)}</span>
                </div>
              `).join('')}
              ${link.occurrences.length > 3 ? `<div class="occurrence">... and ${link.occurrences.length - 3} more</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    warningsContainer.innerHTML = warningsHtml;
  }

  // Show redirects
  if (results.redirects.length > 0) {
    const redirectsHtml = `
      <div class="results-group">
        <h3>🔄 Redirects (${results.redirects.length})</h3>
        <p class="group-description">These URLs redirect to different locations. Consider updating links to point directly to the final destination. (Trivial redirects like www vs non-www are filtered out.)</p>
        ${results.redirects.map(link => `
          <div class="link-item redirect">
            <span class="link-url">${escapeHtml(link.url)}</span>
            <span class="link-status">Redirects to: ${escapeHtml(link.redirectTo)}</span>
            <div class="occurrences">
              <div class="occurrences-title">Found on ${link.occurrences.length} page${link.occurrences.length > 1 ? 's' : ''}:</div>
              ${link.occurrences.slice(0, 3).map(occ => `
                <div class="occurrence">
                  • <span class="occurrence-page">${escapeHtml(occ.page)}</span>
                </div>
              `).join('')}
              ${link.occurrences.length > 3 ? `<div class="occurrence">... and ${link.occurrences.length - 3} more</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    redirectsContainer.innerHTML = redirectsHtml;
  }

  // Show pages summary
  const pagesWithIssues = results.pages.filter(p => p.brokenLinks > 0);
  if (pagesWithIssues.length > 0) {
    const pagesHtml = `
      <div class="results-group">
        <h3>📄 Pages with Broken Links (${pagesWithIssues.length})</h3>
        <p class="group-description">These pages contain one or more broken links. Fix the broken links listed above to resolve issues on these pages.</p>
        ${pagesWithIssues.map(page => `
          <div class="page-item">
            <div class="page-title">${escapeHtml(page.title)}</div>
            <div class="page-url">${escapeHtml(page.url)}</div>
            <div class="page-stats">
              ${page.totalLinks} total links | <span class="broken">${page.brokenLinks} broken</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    pagesContainer.innerHTML = pagesHtml;
  }
}

function showError(message) {
  inputSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.remove('hidden');
  errorMessage.textContent = message;
}

function resetToInput() {
  // Reset UI
  inputSection.classList.remove('hidden');
  progressSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');

  // Reset form
  urlInput.value = '';
  scanButton.disabled = false;
  scanButton.innerHTML = '<span class="button-text">Start Scan</span>';

  // Clear results
  brokenLinksContainer.innerHTML = '';
  warningsContainer.innerHTML = '';
  redirectsContainer.innerHTML = '';
  pagesContainer.innerHTML = '';

  // Clear live broken links
  liveBrokenLinksContainer.innerHTML = '';
  liveBrokenLinksSection.classList.add('hidden');
  displayedBrokenLinks = 0;

  // Close SSE connection if active
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
