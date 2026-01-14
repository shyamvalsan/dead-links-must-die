const axios = require('axios');

/**
 * Check all links and images for broken/dead links
 */
async function checkLinks(pages, onProgress) {
  // Collect all unique links to check
  const linksToCheck = new Map(); // url -> [{ page, linkData }]

  for (const page of pages) {
    for (const link of page.links) {
      if (!linksToCheck.has(link.url)) {
        linksToCheck.set(link.url, []);
      }
      linksToCheck.get(link.url).push({
        page: page.url,
        link
      });
    }
  }

  const results = {
    summary: {
      totalPages: pages.length,
      totalLinks: Array.from(linksToCheck.keys()).length,
      brokenLinks: 0,
      workingLinks: 0,
      redirects: 0
    },
    pages: [],
    brokenLinks: [],
    redirects: []
  };

  let checked = 0;
  let broken = 0;

  // Check each unique link
  for (const [url, occurrences] of linksToCheck.entries()) {
    const checkResult = await checkUrl(url);
    checked++;

    // Update progress
    if (onProgress) {
      onProgress({ checked, broken });
    }

    if (!checkResult.ok) {
      broken++;
      results.brokenLinks.push({
        url,
        status: checkResult.status,
        message: checkResult.message,
        occurrences: occurrences.map(o => ({
          page: o.page,
          text: o.link.text,
          type: o.link.type
        }))
      });
    } else if (checkResult.redirected) {
      results.redirects.push({
        url,
        redirectTo: checkResult.finalUrl,
        occurrences: occurrences.map(o => ({
          page: o.page,
          text: o.link.text,
          type: o.link.type
        }))
      });
    }
  }

  // Organize results by page
  for (const page of pages) {
    const pageBrokenLinks = [];

    for (const link of page.links) {
      const brokenLink = results.brokenLinks.find(bl => bl.url === link.url);
      if (brokenLink) {
        pageBrokenLinks.push({
          url: link.url,
          text: link.text,
          type: link.type,
          status: brokenLink.status,
          message: brokenLink.message
        });
      }
    }

    results.pages.push({
      url: page.url,
      title: page.title,
      totalLinks: page.links.length,
      brokenLinks: pageBrokenLinks.length,
      brokenLinksList: pageBrokenLinks
    });
  }

  results.summary.brokenLinks = results.brokenLinks.length;
  results.summary.workingLinks = results.summary.totalLinks - results.brokenLinks.length - results.redirects.length;
  results.summary.redirects = results.redirects.length;

  return results;
}

/**
 * Check if a single URL is accessible
 */
async function checkUrl(url) {
  try {
    const response = await axios.head(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: null, // Don't throw on any status
      headers: {
        'User-Agent': 'DeadLinksMustDie/1.0'
      }
    });

    const redirected = response.request.res.responseUrl !== url;

    if (response.status >= 200 && response.status < 400) {
      return {
        ok: true,
        status: response.status,
        redirected,
        finalUrl: response.request.res.responseUrl
      };
    } else {
      return {
        ok: false,
        status: response.status,
        message: getStatusMessage(response.status)
      };
    }
  } catch (error) {
    // If HEAD fails, try GET (some servers don't support HEAD)
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: null,
        headers: {
          'User-Agent': 'DeadLinksMustDie/1.0'
        }
      });

      const redirected = response.request.res.responseUrl !== url;

      if (response.status >= 200 && response.status < 400) {
        return {
          ok: true,
          status: response.status,
          redirected,
          finalUrl: response.request.res.responseUrl
        };
      } else {
        return {
          ok: false,
          status: response.status,
          message: getStatusMessage(response.status)
        };
      }
    } catch (getError) {
      return {
        ok: false,
        status: 0,
        message: getError.code || getError.message || 'Request failed'
      };
    }
  }
}

function getStatusMessage(status) {
  const messages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    410: 'Gone',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };

  return messages[status] || `HTTP ${status}`;
}

module.exports = { checkLinks };
