'use strict';
const CENO_ICON = "icons/ceno-logo-32.png";
const CACHE_MAX_ENTRIES = 500;
const OUINET_RESPONSE_VERSION_MIN = 1  // protocol versions accepted
const OUINET_RESPONSE_VERSION_MAX = 6


// <https://stackoverflow.com/a/4835406>
const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => htmlEscapes[c]);
}

function removeFragmentFromURL(url) {
    return url.replace(/#.*$/, "");
}

function removeSchemeFromURL(url) {
    return url.replace(/^[a-z][-+.0-9a-z]*:\/\//i, "");
}

function removeTrailingSlashes(s) {
    return s.replace(/\/+$/, "");
}

function removeLeadingWWW(s) {
    return s.replace(/^www\./i, "");
}

function getDhtGroup(e) {
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeSendHeaders
    let url = e.documentUrl ? e.documentUrl : e.url;
    if (!url) return url;
    url = removeFragmentFromURL(url);
    url = removeSchemeFromURL(url);
    url = removeTrailingSlashes(url);
    url = removeLeadingWWW(url);
    return url;
}

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeSendHeaders
function onBeforeSendHeaders(e) {
  if (e.tabId < 0) {
    return;
  }

  // tabs.get returns a Promise
  return browser.tabs.get(e.tabId).then(tab => {
      // The `tab` structure is described here:
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab

      let is_private = tab.incognito ? "True" : "False";
      e.requestHeaders.push({name: "X-Ouinet-Private", value: is_private});

      if (!tab.incognito) {
        e.requestHeaders.push({name: "X-Ouinet-Group", value: getDhtGroup(e)});
      }

      return {requestHeaders: e.requestHeaders};
  });
}

function redirect403ToHttps(e) {
  if (e.statusCode == 403 && e.url.startsWith('http:')) {
    console.log("Redirecting to HTTPS");
    var redirect = new URL(e.url);
    redirect.protocol = 'https';
    redirect.port = '';
    return {redirectUrl: redirect.href};
  }
}

// Useful links:
// https://github.com/mdn/webextensions-examples/tree/master/http-response
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived
// Chrome's webRequest doc is a bit better ATM
// https://developer.chrome.com/extensions/webRequest
var versionError = false;
function redirectWhenUpdateRequired(e) {
  if (!versionError) {
    for (var i in e.responseHeaders) {
        var h = e.responseHeaders[i];
        if (h.name.toUpperCase() === "X-OUINET-ERROR") {
            var ec = h.value.substring(0, 2);
            if (ec === "0 " || ec === "1 ") {
                versionError = true;
            }
        }
    }
  }
  if (versionError && !isAppStoreUrl(e.url)) {
    return {
      redirectUrl: browser.extension.getURL("update-page/index.html"),
    };
  }
}

function isValidProtocolVersion(p) {
    var pn = Number(p);
    if (isNaN(pn) || pn % 1 > 0) {
        return false;
    }
    return (OUINET_RESPONSE_VERSION_MIN <= pn) && (pn <= OUINET_RESPONSE_VERSION_MAX);
}

function findHeader(headers, name) {
  var name_u = name.toUpperCase();

  for (var i in headers) {
    var h = headers[i];
    if (h.name.toUpperCase() == name_u) {
      return h.value;
    }
  }

  return null;
}

const WARN_THROTTLE_MILLIS = 5 * 60 * 1000
var warningLastShownOn = {}  // warning string -> time in milliseconds
function warnWhenUpdateDetected(e) {
  var isOuinetMessage = false;
  for (var i in e.responseHeaders) {
    var h = e.responseHeaders[i];
    var hn = h.name.toUpperCase();
    if (hn === "X-OUINET-VERSION" && isValidProtocolVersion(h.value)) {
      isOuinetMessage = true  // hope this comes before other `X-Ouinet-*` headers
    } else if (isOuinetMessage && hn === "X-OUINET-WARNING") {
      var hv = h.value
      // Do not show the same warning if already shown
      // in the last `WARN_THROTTLE_MILLIS` milliseconds.
      var now = Date.now()
      var lastShown = warningLastShownOn[hv] || 0
      if (now - lastShown < WARN_THROTTLE_MILLIS) {
        continue
      }
      warningLastShownOn[hv] = now
      browser.notifications.create("", {
        type: "basic",
        title: browser.i18n.getMessage("bgCenoWarning"),
        message: escapeHtml(hv)})
    }
  }
}

var gOuinetStats = {};
const gOuinetSources = ['origin', 'proxy', 'injector', 'dist-cache', 'local-cache'];

browser.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId != 0) return;
  const tabId = details.tabId;
  gOuinetStats[tabId] = {};
});

function updateCenoStats(e) {
  const tabId = e.tabId;


  if (tabId < 0) return;
  var src = findHeader(e.responseHeaders, "X-Ouinet-Source");
  if (!src) src = "unknown";
  if (e.fromCache) src = "local-cache";

  if (!gOuinetStats[tabId]) gOuinetStats[tabId] = {};

  if (!gOuinetStats[tabId][src]) {
    gOuinetStats[tabId][src] = 1;
  } else {
    gOuinetStats[tabId][src] += 1;
  }

  browser.storage.local.get('stats', function(data) {
    if (!data.stats) { data.stats = {}; }
    if (!data.stats[tabId]) { data.stats[tabId] = {}; }

    var stats = data.stats[tabId];

    if (!gOuinetStats[tabId]) return;

    for (const i in gOuinetSources) {
      const name = gOuinetSources[i];
      const v = gOuinetStats[tabId][name];
      stats[name] = v ? v : 0;
    }

    data.stats[e.tabId] = stats;
    browser.storage.local.set(data);
  });
}

const APP_STORES = ["play.google.com", "paskoocheh.com", "s3.amazonaws.com"];
function isAppStoreUrl(url) {
  const hostname = new URL(url).hostname;
  return APP_STORES.includes(hostname);
}

function updateOuinetDetailsFromHeaders(e) {
  if (e.tabId < 0) {
    return;
  }
  // Use the URL from the request as the key instead of the URL
  // from the tab because if there is a redirect the tab URL has not been updated
  // yet
  insertCacheEntry(e.tabId, e.url, getOuinetDetails(e.responseHeaders));
}

const INJ_TS_RE = /\bts=([0-9]+)\b/;
function getOuinetDetails(headers) {
  var details = {
    isProxied: false,
    injectionTime: null,
    requestTime: Date.now() / 1000,  // seconds
  };
  var no_details = Object.assign({}, details);
  var valid_proto = false;
  for (var i = 0; i < headers.length; i++) {
    switch (headers[i].name.toUpperCase()) {
      case "X-OUINET-VERSION":
        valid_proto = isValidProtocolVersion(headers[i].value);
        break;
      case "X-OUINET-INJECTION":
        details.isProxied = true;
        var ts_match = INJ_TS_RE.exec(headers[i].value);
        if (ts_match) {
          details.injectionTime = ts_match[1] - 0;
        }
        break;
    }
  }
  return (valid_proto ? details : no_details);
}

function insertCacheEntry(tabId, url, details) {
  browser.storage.local.get('cache', function(data) {
    if (!data.cache) {
      data.cache = {};
    }
    if (!data.cache[tabId]) {
      data.cache[tabId] = {};
    }
    if (size(data.cache[tabId]) >= CACHE_MAX_ENTRIES) {
      removeOldestEntries(data.cache[tabId]);
    }
    data.cache[tabId][url] = details;
    // Store an entry for the origin as well because single-page-apps,
    // change the URL without causing requests.
    data.cache[tabId][new URL(url).origin] = details;
    browser.storage.local.set(data);
  });
}

function removeOldestEntries(entries) {
  var array = Object.entries(entries);
  array.sort(([k1,v1],[k2,v2]) => v1.requestTime - v2.requestTime);
  var i = 0;
  while (size(entries) > CACHE_MAX_ENTRIES) {
    delete entries[array[i++][0]];
  }
}

function size(o) {
  return Object.keys(o).length;
}

function setPageActionIcon(tabId, isUsingOuinet) {
  if (isUsingOuinet) {
    browser.pageAction.show(tabId);
  } else {
    browser.pageAction.hide(tabId);
  }
}

/**
 * Updates the icon for the page action using the details
 * about the page from local storage.
 */
function setPageActionForTab(tabId) {
  getCacheEntry(tabId, (ouinetDetails) => {
      var isUsingOuinet = ouinetDetails && ouinetDetails.isProxied;
      setPageActionIcon(tabId, true /* isUsingOuinet */);
  });
}

function getCacheEntry(tabId, callback) {
  return browser.storage.local.get('cache', function(data) {
    if (!data.cache || !data.cache[tabId]) {
      callback(undefined);
      return;
    }
    browser.tabs.get(tabId)
      .then((tab) => {
        var fromUrl = data.cache[tabId][tab.url];
        if (fromUrl) {
          callback(fromUrl);
          return;
        }
        var origin = new URL(tab.url).origin;
        callback(data.cache[tabId][origin]);
      });
  });
}

/**
 * Remove entries from local storage when tab is removed.
 */
function removeCacheForTab(tabId) {
  browser.storage.local.get('cache', function(data) {
    if (!data.cache) {
      return;
    }
    // Remove all entries for the tab.
    delete data.cache[tabId];
    browser.storage.local.set(data);
  });
};

function clearLocalStorage() {
  browser.storage.local.get('cache', function(data) {
    if (!data.cache) {
      return;
    }
    browser.tabs.query({}).then((tabs) => {
      var tabIds = tabs.map((tab) => tab.id);
      for (let key of Object.keys(data.cache)) {
        if (!tabIds.includes(key)) {
          delete data.cache[key];
        }
      }
      browser.storage.local.set(data);
    });
  });
}

browser.browserAction.onClicked.addListener(function() {
  var url = browser.extension.getURL("settings.html");
  browser.tabs.create({url: url});
})

browser.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders,
  {urls: ["<all_urls>"]},
  ["blocking", "requestHeaders"]);

browser.webRequest.onHeadersReceived.addListener(
  redirect403ToHttps,
  {urls: ["<all_urls>"]},
  ["blocking", "responseHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  redirectWhenUpdateRequired,
  {urls: ["<all_urls>"]},
  ["blocking", "responseHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  warnWhenUpdateDetected,
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  updateCenoStats,
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  updateOuinetDetailsFromHeaders,
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

browser.runtime.onMessage.addListener(
  (request, sender, sendResponse) => setPageActionForTab(sender.tab.id, sender));

browser.runtime.onStartup.addListener(clearLocalStorage);

/**
 * Each time a tab is updated, reset the page action for that tab.
 */
browser.tabs.onUpdated.addListener(
  (id, changeInfo, tab) => setPageActionForTab(id));

/**
 * Initialize all tabs.
 */
browser.tabs.query({}).then(
  (tabs) => tabs.map((tab) => setPageActionForTab(tab.id)));

browser.tabs.onRemoved.addListener(
  (id) => removeCacheForTab(id));

browser.pageAction.onClicked.addListener(browser.pageAction.openPopup);
