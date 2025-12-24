'use strict';
const CACHE_MAX_ENTRIES = 500;
const OUINET_RESPONSE_VERSION_MIN = 1  // protocol versions accepted
const OUINET_RESPONSE_VERSION_MAX = 6

// Requests for URLs matching the following regular expressions
// will always be considered private (thus non-cacheable).
const NO_CACHE_URL_REGEXPS = [
    /^https?:\/\/(www\.)?google\.com\/complete\//,  // Google Search completion
    /^https?:\/\/(www\.)?duckduckgo\.com\/ac\//,  // DuckDuckGo Search completion
]

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

function isUrlCacheable(url) {
    for (const rx of NO_CACHE_URL_REGEXPS)
        if (rx.test(url))
            return false;
    return true;
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
    return browser.storage.local.get("mode").then(item => {
      let is_private = tab.incognito || !isUrlCacheable(e.url) || item.mode == "personal" ;
      e.requestHeaders.push({name: "X-Ouinet-Private", value: (is_private ? "True" : "False")});

      if (!is_private) {
        e.requestHeaders.push({name: "X-Ouinet-Group", value: getDhtGroup(e)});
      }

      return {requestHeaders: e.requestHeaders};
    });
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

var gActiveTabId = 0;
var gOuinetStats = {};
const gOuinetSources = ['origin', 'proxy', 'injector', 'dist-cache', 'local-cache'];

browser.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId != 0) return;
  const tabId = details.tabId;
  gOuinetStats[tabId] = {};
  gOuinetStats[tabId]['url'] = details.url;
});

browser.webRequest.onBeforeRedirect.addListener(
  details => {
    const tabId = details.tabId;
    gOuinetStats[tabId]['url'] = details.redirectUrl;
  },
  {urls: ["<all_urls>"]}
)

browser.webNavigation.onHistoryStateUpdated.addListener(
  details => {
    const tabId = details.tabId;
    if (details.url != gOuinetStats[tabId]['url']) {
      gOuinetStats[tabId]['url'] = details.url;
    }
  }
)

browser.webNavigation.onCompleted.addListener(
  details => {
    const tabId = details.tabId;
    if (details.url != gOuinetStats[tabId]['url']) {
      gOuinetStats[tabId]['url'] = details.url;
    }
  }
)

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

  // capture current tab id, so stats for it can be sent via native message
  gActiveTabId = tabId
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
 * Updates the icon for the browser action using the details
 * about the page from local storage.
 */
function setBrowserActionForTab(tabId) {
  browser.tabs.get(tabId).then(tab => {
    browser.storage.local.get("mode").then(item => {
      let isPersonal = tab.incognito || item.mode == "personal" ;
      setBrowserAction(isPersonal)
    });
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

/**
 * Configure the Ouinet client as a proxy.
 *
 * As of 2022-02-22, and according
 * to @url{https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/settings},
 * this only works on Desktop Firefox >= 60.
 */
function setOuinetClientAsProxy(proxyEndpoint) {
  browser.proxy.settings.set({value: {
    proxyType: "manual",
    http: proxyEndpoint,
    ssl: proxyEndpoint,
  }}).then(function() {
    console.log(`Ouinet client (${proxyEndpoint}) configured as proxy for HTTP and HTTPS.`);
  }).catch(function(e) {
    // This does not work on Android:
    // check occurrences of "proxy.settings is not supported on android"
    // in `gecko-dev/toolkit/components/extensions/parent/ext-proxy.js`.
    console.error("Failed to configure HTTP and HTTPS proxies:", e);
  });
}

browser.browserAction.onClicked.addListener(browser.browserAction.openPopup);

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
  (request, sender, sendResponse) => setBrowserActionForTab(sender.tab.id, sender));

browser.runtime.onStartup.addListener(clearLocalStorage);

/**
 * Each time a tab is updated, reset the page action for that tab.
 */
browser.tabs.onUpdated.addListener(
  (id, changeInfo, tab) => setBrowserActionForTab(id));

if (browser.windows != null) {
  browser.windows.onFocusChanged.addListener(
    (id) => {
      browser.tabs.query({currentWindow:true, active:true}).then(
        (tabs) => {
          const tabId = tabs[0].id;
          setBrowserActionForTab(tabId)
      });
  });
}

/**
 * Initialize all tabs.
 */
browser.tabs.query({}).then(
  (tabs) => tabs.map((tab) => setBrowserActionForTab(tab.id)));

browser.tabs.onRemoved.addListener(
  (id) => removeCacheForTab(id));

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired#permissions
let proxy_user_; let proxy_pass_;
function onAuthRequired(details) {
  // Make sure that auth is performed only for proxy
  // not just for any website that requests auth
  if (details.isProxy) {
    return {"authCredentials": {username: proxy_user_, password: proxy_pass_}};
  }
}

browser.runtime.getPlatformInfo().then(info => {
  if (info.os === "android") {
    // Establish connection with application
    const port = browser.runtime.connectNative("browser");
    // Set up listener for native messages
    port.onMessage.addListener(response => {
      // Send back ouinet statistics
      port.postMessage(`${JSON.stringify(gOuinetStats[gActiveTabId])}`);
    });

    // @TODO: get proxy_user and proxy_pass from kotlin
    proxy_user_ = "user";
    proxy_pass_ = "pass";
    browser.webRequest.onAuthRequired.addListener(onAuthRequired, {urls: ["<all_urls>"]}, ["blocking"]);
  } else if (info.os === "win") {
    browser.ouinet.onConnect.addListener((proxy_endpoint, proxy_user, proxy_pass) => {
      setOuinetClientAsProxy(proxy_endpoint);
      proxy_user_ = proxy_user;
      proxy_pass_ = proxy_pass;

      browser.webRequest.onAuthRequired.addListener(onAuthRequired, {urls: ["<all_urls>"]}, ["blocking"]);
    });

    browser.ouinet.onDisconnect.addListener(_ => {
      browser.proxy.settings.set({value: {
        proxyType: "system",
        http: "",
        ssl: ""
      }}).catch(function(e) {
        console.error("Failed to remove HTTP and HTTPS proxies:", e);
      });
      browser.webRequest.onAuthRequired.removeListener(onAuthRequired);
      proxy_user_ = "";
      proxy_pass_ = "";
    });
  }
});
