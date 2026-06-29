const ICON_SIZES = [16, 32, 48, 128];
const DNR_RULE_ID_START = 1000;
const MAX_DNR_REGEX_RULES = 500;
const PENDING_BLOCKED_URL_TTL_MS = 30000;
const RECENT_BLOCKED_ATTEMPT_TTL_MS = 5000;
let cachedActionIcons = null;
const pendingBlockedUrlsByTab = new Map();
const recentBlockedAttemptsByTab = new Map();
let declarativeRuleRefreshInProgress = false;
let declarativeRuleRefreshQueued = false;
let declarativeRuleRefreshCallbacks = [];

async function loadBaseIconBitmap() {
  const response = await fetch(chrome.runtime.getURL('icon48.png'));
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function tintImageData(imageData, modifier) {
  const data = new Uint8ClampedArray(imageData.data); // copy
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = (r + g + b) / 3;
    const [nr, ng, nb] = modifier({ r, g, b, gray });
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
  return new ImageData(data, imageData.width, imageData.height);
}

async function buildActionIcons() {
  if (cachedActionIcons) return cachedActionIcons;

  const bitmap = await loadBaseIconBitmap();
  const enabled = {};
  const disabled = {};

  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(bitmap, 0, 0, size, size);
    const base = ctx.getImageData(0, 0, size, size);

    enabled[size] = tintImageData(base, ({ r, g, b }) => [r, g, b]);
    disabled[size] = tintImageData(base, ({ gray }) => [gray * 0.6, gray * 0.6, gray * 0.6]);
  }

  cachedActionIcons = { enabled, disabled };
  return cachedActionIcons;
}

async function applyActionIcon(blockerEnabled) {
  try {
    const { enabled, disabled } = await buildActionIcons();
    const imageData = blockerEnabled ? enabled : disabled;
    chrome.action.setIcon({ imageData });
    chrome.action.setBadgeText({ text: '' });
  } catch (err) {
    console.error('Failed to set action icon', err);
  }
}

function initActionIcon() {
  chrome.storage.sync.get(['blockerEnabled'], (data) => {
    applyActionIcon(data.blockerEnabled !== false);
  });
}

function resetDailyGoalsIfNeeded(callback) {
  const today = getLocalDate();
  chrome.storage.sync.get(['dailyGoals', 'dailyGoalsLastResetDate'], (data) => {
    const dailyGoals = data.dailyGoals || [];

    if (data.dailyGoalsLastResetDate === today) {
      if (callback) callback();
      return;
    }

    const resetGoals = dailyGoals.map(goal => ({
      ...goal,
      completedDate: ''
    }));

    chrome.storage.sync.set({
      dailyGoals: resetGoals,
      dailyGoalsLastResetDate: today
    }, () => {
      if (callback) callback();
    });
  });
}

function initDailyState() {
  initActionIcon();
  resetDailyGoalsIfNeeded();
}

chrome.runtime.onStartup.addListener(initDailyState);
chrome.runtime.onInstalled.addListener(initDailyState);
refreshDeclarativeBlockRules();

function isBlockableNavigationUrl(url) {
  if (!url || url.startsWith(chrome.runtime.getURL("blocked.html"))) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function getMatchingPatterns(patterns, lowercaseUrl) {
  return patterns.filter(pattern => {
    return doesPatternMatchUrl(pattern, lowercaseUrl);
  });
}

function setPendingBlockedUrl(tabId, url) {
  pendingBlockedUrlsByTab.set(tabId, {
    url,
    timestamp: Date.now()
  });
}

function takePendingBlockedUrl(tabId) {
  const pending = pendingBlockedUrlsByTab.get(tabId);
  pendingBlockedUrlsByTab.delete(tabId);

  if (!pending) {
    return '';
  }

  const url = typeof pending === 'string' ? pending : pending.url;
  const timestamp = typeof pending === 'string' ? 0 : pending.timestamp;

  if (!url || !timestamp || Date.now() - timestamp > PENDING_BLOCKED_URL_TTL_MS) {
    return '';
  }

  return url;
}

function getWebsiteDomainFromPattern(pattern) {
  if (!pattern.startsWith('^https?://')) {
    return null;
  }

  let domainPart = pattern
    .replace(/^\^https\?:\/\/\+\(\[\^:\/\]\+\\\.\)\?/, '')
    .replace(/^\^https\?:\/\/\(\[\^\/\?#\]\*\\\.\)\?/, '')
    .replace(/\[:\/\]$/, '')
    .replace(/\(\[\/:\?#\]\|\$\)$/, '')
    .replace(/\\\./g, '.');

  if (!/^[a-z0-9.-]+$/i.test(domainPart)) {
    return null;
  }

  return domainPart || null;
}

function getWebsiteDisplayTextFromPattern(pattern) {
  if (!pattern.startsWith('^https?://')) {
    return null;
  }

  let displayText = pattern
    .replace(/^\^https\?:\/\/\+\(\[\^:\/\]\+\\\.\)\?/, '')
    .replace(/^\^https\?:\/\/\(\[\^\/\?#\]\*\\\.\)\?/, '')
    .replace(/\(\[\/:\?#\]\|\$\)$/, '')
    .replace(/\(\?:\[\/:\?#\]\.\*\)\?\$$/, '')
    .replace(/\[:\/\]$/, '')
    .replace(/\\\./g, '.')
    .replace(/\\\//g, '/');

  return displayText || null;
}

function doesPatternMatchUrl(pattern, lowercaseUrl) {
  const websiteDomain = getWebsiteDomainFromPattern(pattern);
  if (websiteDomain) {
    try {
      const hostname = new URL(lowercaseUrl).hostname;
      return hostname === websiteDomain || hostname.endsWith(`.${websiteDomain}`);
    } catch (e) {
      return false;
    }
  }

  try {
    const regex = new RegExp(pattern);
    return regex.test(lowercaseUrl);
  } catch (e) {
    console.error('Invalid regex pattern');
    return false;
  }
}

function getDeclarativeRegexForPattern(pattern) {
  const websiteDomain = getWebsiteDomainFromPattern(pattern);
  if (!websiteDomain) {
    const fullUrlPattern = pattern.startsWith('^https?://')
      ? pattern.replace(/\(\[\/:\?#\]\|\$\)$/, '(?:[/:?#].*)?$')
      : pattern;

    return fullUrlPattern.startsWith('^') ? `(${fullUrlPattern})` : `^(.*${fullUrlPattern}.*)$`;
  }

  const escapedDomain = websiteDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^(https?://(?:[^/?#]*\\.)?${escapedDomain}(?:[/:?#].*)?)$`;
}

function getDeclarativeRedirectForPattern() {
  return {
    regexSubstitution: `${chrome.runtime.getURL('blocked.html')}#blockedUrl=\\1`
  };
}

function getActiveBlockPatterns({ blocked = [], enabled = [], blockerEnabled = true }) {
  if (blockerEnabled === false) {
    return [];
  }

  return enabled.filter(pattern => blocked.includes(pattern));
}

function checkDeclarativeRegexSupport(pattern) {
  return new Promise((resolve) => {
    if (!chrome.declarativeNetRequest.isRegexSupported) {
      resolve(true);
      return;
    }

    chrome.declarativeNetRequest.isRegexSupported({
      regex: pattern,
      isCaseSensitive: false
    }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to check regex support:', chrome.runtime.lastError.message);
        resolve(false);
        return;
      }

      if (!result.isSupported) {
        console.error('Regex is not supported by declarative blocking:', result.reason);
      }

      resolve(result.isSupported);
    });
  });
}

async function buildDeclarativeBlockRules(patterns) {
  const rules = [];

  for (const pattern of patterns.slice(0, MAX_DNR_REGEX_RULES)) {
    try {
      const regexFilter = getDeclarativeRegexForPattern(pattern);
      new RegExp(regexFilter);

      const isSupported = await checkDeclarativeRegexSupport(regexFilter);
      if (!isSupported) {
        continue;
      }

      rules.push({
        id: DNR_RULE_ID_START + rules.length,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: getDeclarativeRedirectForPattern(pattern)
        },
        condition: {
          regexFilter,
          isUrlFilterCaseSensitive: false,
          resourceTypes: ['main_frame']
        }
      });
    } catch (e) {
      console.error('Invalid regex pattern');
    }
  }

  return rules;
}

function finishDeclarativeRuleRefresh() {
  declarativeRuleRefreshInProgress = false;

  if (declarativeRuleRefreshQueued) {
    declarativeRuleRefreshQueued = false;
    runDeclarativeBlockRuleRefresh();
    return;
  }

  const callbacks = declarativeRuleRefreshCallbacks;
  declarativeRuleRefreshCallbacks = [];
  callbacks.forEach(callback => callback());
}

function runDeclarativeBlockRuleRefresh() {
  declarativeRuleRefreshInProgress = true;

  if (!chrome.declarativeNetRequest) {
    finishDeclarativeRuleRefresh();
    return;
  }

  chrome.storage.sync.get(['blocked', 'enabled', 'blockerEnabled'], (data) => {
    buildDeclarativeBlockRules(getActiveBlockPatterns({
      blocked: data.blocked || [],
      enabled: data.enabled || [],
      blockerEnabled: data.blockerEnabled !== false
    })).then((rules) => {

      chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to read blocking rules:', chrome.runtime.lastError.message);
          finishDeclarativeRuleRefresh();
          return;
        }

        const removeRuleIds = existingRules
          .filter(rule => rule.id >= DNR_RULE_ID_START && rule.id < DNR_RULE_ID_START + MAX_DNR_REGEX_RULES)
          .map(rule => rule.id);

        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules: rules
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to update blocking rules:', chrome.runtime.lastError.message);
          }

          finishDeclarativeRuleRefresh();
        });
      });
    }).catch((error) => {
      console.error('Failed to build blocking rules:', error);
      finishDeclarativeRuleRefresh();
    });
  });
}

function refreshDeclarativeBlockRules(callback) {
  if (callback) {
    declarativeRuleRefreshCallbacks.push(callback);
  }

  if (declarativeRuleRefreshInProgress) {
    declarativeRuleRefreshQueued = true;
    return;
  }

  runDeclarativeBlockRuleRefresh();
}

function recordBlockedAttempt(fullUrl, matchingEnabledItems, callback) {
  chrome.storage.local.get(['blockedCounts'], (data) => {
    const today = getLocalDate();
    let blockedCounts = data.blockedCounts || {};

    // Remove entries older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    blockedCounts = Object.fromEntries(
      Object.entries(blockedCounts).filter(([date]) => date >= cutoffDate)
    );

    // Add new block counts
    if (!blockedCounts[today]) {
      blockedCounts[today] = {};
    }

    matchingEnabledItems.forEach(item => {
      const key = item || fullUrl;
      if (!blockedCounts[today][key]) {
        blockedCounts[today][key] = 0;
      }
      blockedCounts[today][key]++;
    });

    chrome.storage.local.set({ blockedCounts }, callback);
  });
}

function clearDisabledBlockTimestamps(matchingBlockedItems, matchingEnabledItems, blockerEnabled) {
  matchingBlockedItems.forEach(item => {
    chrome.storage.sync.remove(`blockedTimestamp_${getDisplayText(item)}`);
  });

  matchingEnabledItems.forEach(item => {
    if (!blockerEnabled) {
      chrome.storage.sync.get(['toTimestampWhenEnabled'], (data) => {
        const toTimestampWhenEnabled = data.toTimestampWhenEnabled || [];
        if (!toTimestampWhenEnabled.includes(item)) {
          toTimestampWhenEnabled.push(item);
          chrome.storage.sync.set({ toTimestampWhenEnabled });
        }
      });
    }
  });
}

function redirectToBlockedPage(tabId, fullUrl) {
  setPendingBlockedUrl(tabId, fullUrl);
  const blockedUrl = `${chrome.runtime.getURL("blocked.html")}#blockedUrl=${fullUrl}`;
  chrome.tabs.update(tabId, { url: blockedUrl });
}

function shouldRecordBlockedAttempt(tabId, fullUrl) {
  const recent = recentBlockedAttemptsByTab.get(tabId);
  if (recent && recent.url === fullUrl && Date.now() - recent.timestamp < RECENT_BLOCKED_ATTEMPT_TTL_MS) {
    return false;
  }

  recentBlockedAttemptsByTab.set(tabId, {
    url: fullUrl,
    timestamp: Date.now()
  });
  return true;
}

function handleBlockedNavigation(tabId, fullUrl, options = {}) {
  if (tabId < 0 || !isBlockableNavigationUrl(fullUrl)) {
    return;
  }

  const redirectIfMatched = options.redirectIfMatched === true;

  chrome.storage.sync.get(['blocked', 'enabled', 'blockerEnabled'], (data) => {
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];
    const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
    const lowercaseUrl = fullUrl.toLowerCase();

    const matchingBlockedItems = getMatchingPatterns(blocked, lowercaseUrl);
    if (matchingBlockedItems.length === 0) {
      pendingBlockedUrlsByTab.delete(tabId);
      return;
    }

    const matchingEnabledItems = getMatchingPatterns(enabled, lowercaseUrl);

    if (blockerEnabled && matchingEnabledItems.length > 0) {
      setPendingBlockedUrl(tabId, fullUrl);
      const afterAttemptRecorded = () => {
        if (redirectIfMatched) {
          redirectToBlockedPage(tabId, fullUrl);
        }
      };

      if (shouldRecordBlockedAttempt(tabId, fullUrl)) {
        recordBlockedAttempt(fullUrl, matchingEnabledItems, afterAttemptRecorded);
      } else {
        afterAttemptRecorded();
      }
    } else {
      clearDisabledBlockTimestamps(matchingBlockedItems, matchingEnabledItems, blockerEnabled);
    }
  });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  handleBlockedNavigation(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  handleBlockedNavigation(details.tabId, details.url, {
    redirectIfMatched: true
  });
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  handleBlockedNavigation(details.tabId, details.url, {
    redirectIfMatched: true
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith(chrome.runtime.getURL("blocked.html"))) {
    let blockedUrl = null;
    try {
      const urlObj = new URL(tab.url);
      blockedUrl = urlObj.searchParams.get('blockedUrl');
    } catch (e) {
      blockedUrl = null;
    }

    if (!blockedUrl) {
      blockedUrl = takePendingBlockedUrl(tabId) || null;
    }

    if (blockedUrl) {
      chrome.tabs.sendMessage(tabId, { action: 'setBlockedUrl', url: blockedUrl });
    }
  } else if (changeInfo.status === 'loading' && tab.url) {
    handleBlockedNavigation(tabId, tab.url, {
      redirectIfMatched: true
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.blockerEnabled) {
      applyActionIcon(changes.blockerEnabled.newValue !== false);
    }

    if (changes.blocked || changes.enabled || changes.blockerEnabled) {
      refreshDeclarativeBlockRules();
    }
  }
});

function saveBlockedUrl(url, patterns, reason) {
  const today = getLocalDate();
  chrome.storage.local.get(['savedUrls'], (data) => {
    let savedUrls = data.savedUrls || {};

    // Remove entries older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    savedUrls = Object.fromEntries(
      Object.entries(savedUrls).filter(([date]) => date >= cutoffDate)
    );

    if (!savedUrls[today]) {
      savedUrls[today] = [];
    }

    if (url.includes('&') && url.includes('google'))
      url = url.slice(0, url.indexOf('&'));

    let urlEntry = savedUrls[today].find(entry => entry.url === url);
    if (urlEntry) {
      if (reason) {
        const existingReasons = urlEntry.reason ? urlEntry.reason.split('; ') : [];
        if (!existingReasons.includes(reason)) {
          existingReasons.push(reason);
        }
        urlEntry.reason = existingReasons.join('; ');
      }
    } else {
      savedUrls[today].push({ url, patterns, reason });
    }

    chrome.storage.local.set({ savedUrls });
  });
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scheduleReblock') {
    const { url, duration, itemsToReblock } = message;
    scheduleReblock(url, duration, itemsToReblock);
    sendResponse(); // Immediately send response
  } else if (message.action === 'saveBlockedUrl') {
    const { url, patterns, reason } = message;
    saveBlockedUrl(url, patterns, reason);
    sendResponse(); // Immediately send response
  } else if (message.action === 'resetDailyGoals') {
    resetDailyGoalsIfNeeded(sendResponse);
    return true;
  } else if (message.action === 'getPendingBlockedUrl') {
    const tabId = sender.tab && sender.tab.id;
    const url = tabId !== undefined ? takePendingBlockedUrl(tabId) : '';
    sendResponse({
      url
    });
  } else if (message.action === 'setEnabledAndRefreshRules') {
    chrome.storage.sync.set({ enabled: message.enabled || [] }, () => {
      refreshDeclarativeBlockRules(() => {
        sendResponse();
      });
    });
    return true;
  }
});

function scheduleReblock(url, duration, itemsToReblock) {
  itemsToReblock.forEach(item => {
    const alarmName = `reblock_${getDisplayText(item)}`;

    // Clear any existing alarm for the same item
    chrome.alarms.clear(alarmName, () => {
      // Create a new alarm
      chrome.alarms.create(alarmName, { delayInMinutes: duration });

      // Save the reblock details
      chrome.storage.sync.set({ [alarmName]: { url, item } });
    });
  });
}

// Listener for the alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('reblock_')) {
    chrome.storage.sync.get([alarm.name], (data) => {
      const { url, item } = data[alarm.name] || {};

      if (url && item) {
        chrome.storage.sync.get(['blocked', 'enabled', 'enableNotiReblock'], (data) => {
          const currentBlocked = data.blocked || [];
          const currentEnabled = data.enabled || [];
          const notification = data.enableNotiReblock || false;

          // Check if the item is still in the blocked array
          const stillBlocked = currentBlocked.some(blockedItem => doesPatternMatchUrl(blockedItem, url.toLowerCase()));

          if (stillBlocked) {
            // Add the temporarily unblocked item back to the enabled array
            const updatedEnabled = [...currentEnabled, item];
            chrome.storage.sync.set({ enabled: updatedEnabled, [`blockedTimestamp_${getDisplayText(item)}`]: Date.now() }, () => {
              refreshDeclarativeBlockRules();
            });
            const now = Date.now();
            const alarmTime = alarm.scheduledTime;
            const bufferTime = 5000; // 5 seconds buffer

            if (now <= alarmTime + bufferTime && notification) {
              // Show notification
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'Website Reblocked',
                message: `${getDisplayText(item)} has been reblocked.`
              });
            }
          }
        });
      }

      // Clean up the storage
      chrome.storage.sync.remove(alarm.name);
    });
  }
});

function getDisplayText(pattern) {
  let displayText = pattern;
  if (pattern.startsWith('^https?://')) {
    displayText = getWebsiteDisplayTextFromPattern(pattern) || displayText;
  } else if (pattern.startsWith('(?:q|s|search_query)=')) {
    displayText = displayText.replace("(?:q|s|search_query)=(.*", '');
    displayText = displayText.replace("[^&]*)", '');
  }
  return displayText;
}
