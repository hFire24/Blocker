document.addEventListener('DOMContentLoaded', () => {
  const toggleBlockerButton = document.getElementById('toggleBlocker');
  const openOptionsButton = document.getElementById('openOptions');
  const openHelpButton = document.getElementById('openHelp');
  const blockStatusHeading = document.getElementById('blockStatus');
  const blockedList = document.getElementById('blockedSitesList');

  // Load the current state of the blocker and favorited blocked items
  chrome.storage.sync.get(['blockerEnabled', 'enabled', 'favorites'], (data) => {
    const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
    const enabled = data.enabled || [];
    const favorites = data.favorites || [];
    updateButton(blockerEnabled);
    updateBlockedList(blockerEnabled, favorites, enabled);
  });

  toggleBlockerButton.addEventListener('click', () => {
    chrome.storage.sync.get('blockerEnabled', (data) => {
      const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
      chrome.storage.sync.set({ blockerEnabled: !blockerEnabled }, () => {
        updateButton(!blockerEnabled);
        chrome.storage.sync.get(['favorites', 'enabled'], (data) => {
          updateBlockedList(!blockerEnabled, data.favorites || [], data.enabled || []);
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
          }
        });
      });
    });
  });

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

  function updateBlockedList(blockerEnabled, favorites, enabled) {
    blockedList.innerHTML = '';
    if (blockerEnabled) {
      blockedList.style.display = 'block';
      favorites.forEach(item => {
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
