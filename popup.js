document.addEventListener('DOMContentLoaded', () => {
  const toggleBlockerButton = document.getElementById('toggleBlocker');
  const openSitesButton = document.getElementById('openSites');
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
        });
      });
    });
  });

  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openSitesButton.addEventListener('click', () => {
    window.open('sites.html', '_blank');
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
      toggleItem(pattern, checkbox.checked, itemText);
    });

    listItem.prepend(checkbox);
    listItem.appendChild(itemText);
    blockedList.appendChild(listItem);
  }

  function toggleItem(pattern, isEnabled, itemText) {
    chrome.storage.sync.get('enabled', (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
        }
        itemText.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== pattern);
        itemText.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled });
    });
  }
});
