chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith(chrome.runtime.getURL("blocked.html"))) {
    chrome.storage.sync.get(['lastBlockedUrl'], (data) => {
      if (data.lastBlockedUrl) {
        chrome.tabs.sendMessage(tabId, { action: 'setBlockedUrl', url: data.lastBlockedUrl });
        chrome.storage.sync.remove('lastBlockedUrl');
      }
    });
  } else if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.sync.get(['blocked', 'enabled', 'blockerEnabled', 'saveBlockedUrls'], (data) => {
      const blocked = data.blocked || [];
      const enabled = data.enabled || [];
      const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
      const saveBlockedUrls = data.saveBlockedUrls !== false; // default to true if not set
      const fullUrl = tab.url;
      const lowercaseUrl = fullUrl.toLowerCase();

      const isBlocked = blocked.some(blockedItem => {
        try {
          const regex = new RegExp(blockedItem);
          return regex.test(lowercaseUrl);
        } catch (e) {
          console.error('Invalid regex pattern:', blockedItem);
          return false;
        }
      });

      const matchingEnabledItems = enabled.filter(enabledItem => {
        try {
          const regex = new RegExp(enabledItem);
          return regex.test(lowercaseUrl);
        } catch (e) {
          console.error('Invalid regex pattern:', enabledItem);
          return false;
        }
      });

      if (blockerEnabled && isBlocked && matchingEnabledItems.length > 0) {
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

          chrome.storage.local.set({ blockedCounts }, () => {
            chrome.storage.sync.set({ lastBlockedUrl: fullUrl }, () => {
              chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
            });
          });
        });
      } else if (isBlocked && !(matchingEnabledItems.length > 0 && blockerEnabled)) {
        // Delete the blockedTimestamp item
        const matchingBlockedItems = blocked.filter(blockedItem => {
          try {
            const regex = new RegExp(blockedItem);
            return regex.test(lowercaseUrl);
          } catch (e) {
            console.error('Invalid regex pattern:', blockedItem);
            return false;
          }
        });

        matchingBlockedItems.forEach(item => {
          chrome.storage.sync.remove(`blockedTimestamp_${getDisplayText(item)}`);
        });

        matchingEnabledItems.forEach(item => {
          if(!blockerEnabled) {
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
    });
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

    if (url.includes('&') && (url.includes('google') || url.includes('youtube')))
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

    chrome.storage.local.set({ savedUrls }, () => {
      console.log('Saved URLs updated', savedUrls); // For debugging
    });
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
      console.log(`Scheduled reblock for ${item} in ${duration} minutes.`);
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
          const stillBlocked = currentBlocked.some(blockedItem => {
            try {
              const regex = new RegExp(blockedItem);
              return regex.test(url);
            } catch (e) {
              console.error('Invalid regex pattern:', blockedItem);
              return false;
            }
          });

          if (stillBlocked) {
            // Add the temporarily unblocked item back to the enabled array
            const updatedEnabled = [...currentEnabled, item];
            chrome.storage.sync.set({ enabled: updatedEnabled, [`blockedTimestamp_${getDisplayText(item)}`]: Date.now() }, () => {
              console.log(`Reblocked item: ${item}`);
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
    displayText = displayText.replace("^https?://+([^:/]+\\.)?", '');
    displayText = displayText.replace(/\\./g, '.');
    displayText = displayText.replace("[:/]", '');
  } else if (pattern.startsWith('(?:q|s|search_query)=')) {
    displayText = displayText.replace("(?:q|s|search_query)=(.*", '');
    displayText = displayText.replace("[^&]*)", '');
  }
  return displayText;
}