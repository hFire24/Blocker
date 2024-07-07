document.addEventListener('DOMContentLoaded', () => {
  const toggleBlockerButton = document.getElementById('toggleBlocker');
  const openOptionsButton = document.getElementById('openOptions');
  const blockStatusHeading = document.getElementById('blockStatus');
  const blockedList = document.getElementById('blockedSitesList');

  // Load the current state of the blocker and blocked items
  chrome.storage.sync.get(['blockerEnabled', 'blocked', 'enabled'], (data) => {
    const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];
    updateButton(blockerEnabled);
    updateBlockedList(blockerEnabled, blocked, enabled);
  });

  toggleBlockerButton.addEventListener('click', () => {
    chrome.storage.sync.get('blockerEnabled', (data) => {
      const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
      chrome.storage.sync.set({ blockerEnabled: !blockerEnabled }, () => {
        updateButton(!blockerEnabled);
        chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
          updateBlockedList(!blockerEnabled, data.blocked || [], data.enabled || []);
        });
      });
    });
  });

  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function updateButton(blockerEnabled) {
    toggleBlockerButton.textContent = blockerEnabled ? 'Disable Blocker' : 'Enable Blocker';
    blockStatusHeading.textContent = blockerEnabled ? 'ENABLED' : 'DISABLED';
  }

  function updateBlockedList(blockerEnabled, blocked, enabled) {
    blockedList.innerHTML = '';
    if (blockerEnabled) {
      blockedList.style.display = 'block';
      blocked.forEach(item => {
        addItemToList(item, enabled.includes(item));
      });
    } else {
      blockedList.style.display = 'none';
    }
  }

  function addItemToList(url, isEnabled) {
    const listItem = document.createElement('li');
    listItem.textContent = url;
    if (!isEnabled) {
      listItem.classList.add('disabled');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleItem(url, checkbox.checked, listItem);
    });

    listItem.prepend(checkbox);
    blockedList.appendChild(listItem);
  }

  function toggleItem(url, isEnabled, listItem) {
    chrome.storage.sync.get('enabled', (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(url)) {
          enabled.push(url);
        }
        listItem.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== url);
        listItem.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled });
    });
  }
});
