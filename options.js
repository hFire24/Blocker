document.addEventListener('DOMContentLoaded', () => {
  const blockedList = document.getElementById('blockedSitesList');
  const addUrlInput = document.getElementById('addUrlInput');
  const addUrlButton = document.getElementById('addUrlButton');

  // Load blocked items from storage
  chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];

    blocked.forEach(item => {
      addItemToList(item, enabled.includes(item));
    });
  });

  addUrlButton.addEventListener('click', () => {
    const url = addUrlInput.value.trim();
    if (url) {
      chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
        const blocked = data.blocked || [];
        let enabled = data.enabled || [];
        if (!blocked.includes(url)) {
          blocked.push(url);
          if (!enabled.includes(url)) {
            enabled.push(url);
          }
          chrome.storage.sync.set({ blocked, enabled }, () => {
            addItemToList(url, true);
          });
          addUrlInput.value = '';
        }
      });
    }
  });

  function addItemToList(url, isEnabled) {
    const listItem = document.createElement('li');

    const urlText = document.createElement('span');
    urlText.textContent = url;
    if (!isEnabled) {
      urlText.classList.add('disabled');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleItem(url, checkbox.checked, urlText);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      deleteItem(url, listItem);
    });

    listItem.prepend(checkbox);
    listItem.appendChild(urlText);
    listItem.appendChild(deleteButton);
    blockedList.appendChild(listItem);
  }

  function toggleItem(url, isEnabled, urlText) {
    chrome.storage.sync.get('enabled', (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(url)) {
          enabled.push(url);
        }
        urlText.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== url);
        urlText.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled });
    });
  }

  function deleteItem(url, listItem) {
    chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
      const blocked = data.blocked.filter(item => item !== url);
      const enabled = data.enabled.filter(item => item !== url);
      chrome.storage.sync.set({ blocked, enabled }, () => {
        listItem.remove();
      });
    });
  }
});
