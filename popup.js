document.addEventListener('DOMContentLoaded', () => {
  const toggleBlockerButton = document.getElementById('toggleBlocker');
  const openOptionsButton = document.getElementById('openOptions');
  const openHelpButton = document.getElementById('openHelp');
  const blockStatusHeading = document.getElementById('blockStatus');
  const blockedList = document.getElementById('blockedSitesList');
  const currentSiteSection = document.getElementById('currentSiteSection');
  const currentSiteMessage = document.getElementById('currentSiteMessage');
  const reblockCurrentSiteButton = document.getElementById('reblockCurrentSite');

  // Load the current state of the blocker and favorited blocked items
  chrome.storage.sync.get(['blockerEnabled', 'enabled', 'favorites', 'hardMode', 'blocked'], (data) => {
    const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
    const enabled = data.enabled || [];
    const favorites = data.favorites || [];
    const hardMode = data.hardMode || [];
    const blocked = data.blocked || [];
    updateButton(blockerEnabled);
    updateBlockedList(blockerEnabled, favorites, enabled, hardMode);
    updateCurrentSiteStatus(blockerEnabled, blocked, enabled);
  });

  toggleBlockerButton.addEventListener('click', () => {
    chrome.storage.sync.get(['blockerEnabled', 'enabled', 'hardMode'], (data) => {
      const blockerEnabled = data.blockerEnabled !== false;
      const enabled = data.enabled || [];
      const hardMode = data.hardMode || [];
      const overlap = enabled.filter(site => hardMode.includes(site));
      if (blockerEnabled && overlap.length > 0) {
        launchDisableChallenge();
      } else {
        toggleBlockerState(blockerEnabled);
      }
    });
  });

  function launchDisableChallenge() {
    window.open('challenge.html', '_blank');
  }

  function toggleBlockerState(blockerEnabled) {
    chrome.storage.sync.set({ blockerEnabled: !blockerEnabled }, () => {
      updateButton(!blockerEnabled);
      chrome.storage.sync.get(['favorites', 'enabled', 'hardMode', 'blocked'], (data) => {
        updateBlockedList(!blockerEnabled, data.favorites || [], data.enabled || [], data.hardMode || []);
        updateCurrentSiteStatus(!blockerEnabled, data.blocked || [], data.enabled || []);
        console.log(blockerEnabled ? "BLOCKER DISABLED" : "BLOCKER ENABLED");
        if(blockerEnabled) {
          chrome.alarms.clearAll(() => {
            chrome.storage.sync.get(null, (items) => {
              let allKeys = Object.keys(items);
              let keysToRemove = allKeys.filter(key => key.startsWith('reblock'));
            
              chrome.storage.sync.remove(keysToRemove, () => {
                if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
                } else {
                  console.log(`Removed keys: ${keysToRemove}`);
                }
              });
            });
          });
        } else if(!blockerEnabled) {
          // Add back timers from an array. Go through each one and add timers. Drop the array when done.
          chrome.storage.sync.get(['toTimestampWhenEnabled'], (data) => {
            const toTimestampWhenEnabled = data.toTimestampWhenEnabled || [];
            toTimestampWhenEnabled.forEach(item => {
              chrome.storage.sync.set({ [`blockedTimestamp_${getDisplayText(item)}`]: Date.now() });
            });
          });
          chrome.storage.sync.remove('toTimestampWhenEnabled');
        }
      });
    });
  }

  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openHelpButton.addEventListener('click', () => {
    window.open('help.html', '_blank');
  });

  function updateButton(blockerEnabled) {
    toggleBlockerButton.textContent = blockerEnabled ? 'Disable Blocker' : 'Enable Blocker';
    blockStatusHeading.textContent = blockerEnabled ? 'ENABLED' : 'DISABLED';
  }

  function updateCurrentSiteStatus(blockerEnabled, blocked, enabled) {
    if (!blockerEnabled) {
      currentSiteSection.style.display = 'none';
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.url) {
        currentSiteSection.style.display = 'none';
        return;
      }

      const url = activeTab.url.toLowerCase();
      if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
        currentSiteSection.style.display = 'none';
        return;
      }

      const matchingBlocked = blocked.filter(blockedItem => {
        try {
          const regex = new RegExp(blockedItem);
          return regex.test(url);
        } catch (e) {
          console.error('Invalid regex pattern:', blockedItem);
          return false;
        }
      });

      if (matchingBlocked.length === 0) {
        currentSiteSection.style.display = 'none';
        return;
      }

      const matchingEnabled = matchingBlocked.filter(item => enabled.includes(item));
      if (matchingEnabled.length > 0) {
        currentSiteSection.style.display = 'none';
        return;
      }

      const displayName = getDisplayText(matchingBlocked[0]);
      currentSiteSection.style.display = 'block';
      currentSiteMessage.textContent = 'Checking reblock time...';

      getNextReblockTime(matchingBlocked).then((nextReblockTime) => {
        if (nextReblockTime) {
          const remainingMs = Math.max(nextReblockTime - Date.now(), 0);
          const remainingText = formatRemainingTime(remainingMs);
          currentSiteMessage.innerHTML = `Unblocked for <b>${displayName}</b>. Reblocks in ${remainingText}.`;
        } else {
          currentSiteMessage.innerHTML = `Unblocked for <b>${displayName}</b>. It will stay unblocked until you reblock it.`;
        }
      });

      reblockCurrentSiteButton.onclick = () => {
        reblockCurrentSite(matchingBlocked, enabled);
      };
    });
  }

  function getNextReblockTime(patterns) {
    const alarmPromises = patterns.map(pattern => new Promise(resolve => {
      const alarmName = `reblock_${getDisplayText(pattern)}`;
      chrome.alarms.get(alarmName, (alarm) => {
        resolve(alarm ? alarm.scheduledTime : null);
      });
    }));

    return Promise.all(alarmPromises).then((times) => {
      const validTimes = times.filter(time => typeof time === 'number' && time > 0);
      if (validTimes.length === 0) {
        return null;
      }
      return Math.min(...validTimes);
    });
  }

  function formatRemainingTime(remainingMs) {
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (remainingMs < minute) {
      return 'less than a minute';
    }
    if (remainingMs < hour) {
      const minutes = Math.ceil(remainingMs / minute);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    if (remainingMs < day) {
      const hours = Math.floor(remainingMs / hour);
      const minutes = Math.ceil((remainingMs % hour) / minute);
      if (minutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(remainingMs / day);
    const hours = Math.ceil((remainingMs % day) / hour);
    if (hours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  function reblockCurrentSite(patterns, enabled) {
    const updatedEnabled = [...enabled];
    patterns.forEach(pattern => {
      if (!updatedEnabled.includes(pattern)) {
        updatedEnabled.push(pattern);
      }
    });

    chrome.storage.sync.set({ enabled: updatedEnabled }, () => {
      patterns.forEach(pattern => {
        const displayPattern = getDisplayText(pattern);
        const alarmName = `reblock_${displayPattern}`;
        chrome.alarms.clear(alarmName, () => {
          chrome.storage.sync.remove(alarmName);
        });
        chrome.storage.sync.set({ [`blockedTimestamp_${displayPattern}`]: Date.now() });
      });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        if (!activeTab || !activeTab.url) {
          updateCurrentSiteStatus(true, patterns, updatedEnabled);
          return;
        }
        const activeUrl = activeTab.url.toLowerCase();
        const shouldClose = patterns.some(pattern => {
          try {
            const regex = new RegExp(pattern);
            return regex.test(activeUrl);
          } catch (e) {
            console.error('Invalid regex pattern:', pattern);
            return false;
          }
        });
        if (shouldClose) {
          chrome.tabs.remove(activeTab.id);
        } else {
          updateCurrentSiteStatus(true, patterns, updatedEnabled);
        }
      });
    });
  }

  function updateBlockedList(blockerEnabled, favorites, enabled, hardMode) {
    blockedList.innerHTML = '';
    if (blockerEnabled) {
      blockedList.style.display = 'block';
      favorites.forEach(item => {
        if (hardMode.includes(item) && enabled.includes(item)) {
          return; // Skip enabled items in hard mode
        }
        const isEnabled = enabled.includes(item);
        addListItem(item, isEnabled);
      });
    } else {
      blockedList.style.display = 'none';
    }
  }

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

  function addListItem(pattern, isEnabled) {
    const listItem = document.createElement('li');

    const itemText = document.createElement('span');
    const type = pattern.includes('^https?://') ? '🌐' : '🔍';
    const displayText = getDisplayText(pattern);
    itemText.textContent = `${type} ${displayText}`;
    if (!isEnabled) {
      itemText.classList.add('disabled');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleBlockedItem(pattern, checkbox.checked, itemText);
    });

    listItem.prepend(checkbox);
    listItem.appendChild(itemText);
    blockedList.appendChild(listItem);
  }

  function toggleBlockedItem(pattern, isEnabled, itemText) {
    const displayPattern = getDisplayText(pattern);
    chrome.storage.sync.get(['enabled', `blockedTimestamp_${displayPattern}`], (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
          if (!data[`blockedTimestamp_${displayPattern}`]) {
            chrome.storage.sync.set({ [`blockedTimestamp_${displayPattern}`]: Date.now() });
          }
        }
        itemText.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== pattern);
        itemText.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled }, () => {
        if (isEnabled) {
          const alarmName = `reblock_${displayPattern}`;
          chrome.alarms.clear(alarmName, (wasCleared) => {
            if (wasCleared) {
              console.log(`Cleared ${alarmName}`);
              chrome.storage.sync.remove(alarmName);
            }
          });
        }
      });
    });
  }
});
