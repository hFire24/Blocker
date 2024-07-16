document.addEventListener('DOMContentLoaded', () => {
  const blockedList = document.getElementById('blockedSitesList');
  const addUrlInput = document.getElementById('addUrlInput');
  const addUrlButton = document.getElementById('addUrlButton');
  const openHelpButton = document.getElementById('openHelp');

  let draggedItem = null;

  // Load blocked items from storage
  chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];
    const favorites = data.favorites || [];

    blocked.forEach(item => {
      addItemToList(item, enabled.includes(item), favorites.includes(item));
    });
  });

  addUrlButton.addEventListener('click', () => {
    const url = addUrlInput.value.trim().toLowerCase();
    const type = url.includes('.') ? 'website' : 'keyword';
    if (url) {
      addBlockedPattern(url, type);
    }
  });

  openHelpButton.addEventListener('click', () => {
    window.open('help.html', '_blank');
  });

  function validateRegex(pattern) {
    try {
      new RegExp(pattern);
      return true;
    } catch (e) {
      return false;
    }
  }

  function formatPattern(pattern, type) {
    if (type === 'website') {
      pattern = `^https?://+([^:/]+\\.)?${escapePattern(pattern)}[:/]`;
    } else if (type === 'keyword') {
      pattern = `(?:q|s|search_query)=(.*${escapePattern(pattern)}[^&]*)`;
    }
    return pattern;
  }

  function escapePattern(input) {
    return input.replace(/\./g, '\\.').replace(/ /g, '+');
  }
  
  function isPatternTooBroad(pattern) {
    return pattern.length < 3 || pattern.includes('.*') || pattern.includes('.*?') || pattern.includes('.+');
  }
  
  function addBlockedPattern(pattern, type) {
    pattern = formatPattern(pattern, type);

    if (!validateRegex(pattern)) {
      alert("Invalid regular expression. Please try again.");
      return;
    }
    /*if (isPatternTooBroad(pattern)) {
      alert("This pattern is too broad and may block unintended URLs. Please make it more specific.");
      return;
    }*/
    // Add the pattern to the blocked list and the enabled list
    chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
      const blocked = data.blocked || [];
      let enabled = data.enabled || [];
      if (!blocked.includes(pattern)) {
        blocked.push(pattern);
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
        }
        chrome.storage.sync.set({ blocked, enabled }, () => {
          addItemToList(pattern, true);
        });
      }
    });
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

  function addItemToList(pattern, isEnabled, isFavorite) {
    const listItem = document.createElement('li');
    listItem.draggable = true;

    const dragHandle = document.createElement('span');
    dragHandle.textContent = '☰';
    dragHandle.className = 'drag-handle';

    const itemText = document.createElement('span');
    const type = pattern.includes('^https?://') ? '🌐' : '🔍';
    const displayText = getDisplayText(pattern);
    itemText.textContent = `${type} ${displayText}`;
    itemText.classList.add('text');
    if (!isEnabled) {
      itemText.classList.add('disabled');
    }

    const favoriteButton = document.createElement('span');
    favoriteButton.textContent = isFavorite ? '★' : '☆';
    favoriteButton.className = 'star';
    favoriteButton.addEventListener('click', () => {
      toggleFavorite(pattern, favoriteButton)
    })

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleItem(pattern, checkbox.checked, itemText);
    });

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
      editItem(pattern, listItem, itemText);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      deleteItem(pattern, listItem);
    });

    listItem.appendChild(dragHandle);
    listItem.appendChild(favoriteButton);
    listItem.appendChild(checkbox);
    listItem.appendChild(itemText);
    listItem.appendChild(editButton);
    listItem.appendChild(deleteButton);

    listItem.addEventListener('dragstart', handleDragStart);
    listItem.addEventListener('dragover', handleDragOver);
    listItem.addEventListener('drop', handleDrop);
    listItem.addEventListener('dragend', handleDragEnd);

    blockedList.appendChild(listItem);
  }

  function toggleFavorite(pattern, button) {
    chrome.storage.sync.get(['blocked', 'favorites'], (data) => {
      let blocked = data.blocked || [];
      let favorites = data.favorites || [];
      if (button.textContent === '☆') {
        if (!favorites.includes(pattern)) {
          favorites.push(pattern);
          favorites.sort((a, b) => blocked.indexOf(a) - blocked.indexOf(b));
        }
        button.textContent = '★';
      } else {
        favorites = favorites.filter(item => item !== pattern);
        button.textContent = '☆';
      }
      chrome.storage.sync.set({ favorites });
    });
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

  function editItem(oldPattern, listItem, itemText) {
    const displayText = getDisplayText(oldPattern);
    const type = oldPattern.includes('^https?://') ? '🌐' : '🔍';
    
    // Create edit input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = displayText;
    editInput.className = 'edit-input';

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => {
      const newDisplayText = editInput.value.trim();
      if (newDisplayText && newDisplayText !== displayText) {
        const newPattern = newDisplayText.includes('.') ? 
          formatPattern(newDisplayText, 'website') : 
          formatPattern(newDisplayText, 'keyword');

        updatePattern(oldPattern, newPattern, listItem, itemText);
      } else {
        // If no changes, revert back to display mode
        revertToDisplayMode();
      }
    });

    // Replace text and buttons with edit input and save button
    listItem.replaceChild(editInput, itemText);
    listItem.replaceChild(saveButton, listItem.querySelector('button:nth-of-type(1)'));
    listItem.removeChild(listItem.querySelector('button:nth-of-type(2)'));

    // Focus on the input
    editInput.focus();

    function revertToDisplayMode() {
      listItem.replaceChild(itemText, editInput);
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        editItem(oldPattern, listItem, itemText);
      });
      listItem.replaceChild(editButton, saveButton);
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        deleteItem(oldPattern, listItem);
      });
      listItem.appendChild(deleteButton);
    }
  }

  function updatePattern(oldPattern, newPattern, listItem, itemText) {
    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      let blocked = data.blocked || [];
      let enabled = data.enabled || [];
      let favorites = data.favorites || [];

      const oldIndex = blocked.indexOf(oldPattern);
      if (oldIndex !== -1) {
        blocked[oldIndex] = newPattern;
      }

      const enabledIndex = enabled.indexOf(oldPattern);
      if (enabledIndex !== -1) {
        enabled[enabledIndex] = newPattern;
      }

      const favoritesIndex = favorites.indexOf(oldPattern);
      if (favoritesIndex !== -1) {
        favorites[favoritesIndex] = newPattern;
      }

      chrome.storage.sync.set({ blocked, enabled, favorites }, () => {
        const type = newPattern.includes('^https?://') ? '🌐' : '🔍';
        const displayText = getDisplayText(newPattern);
        itemText.textContent = `${type} ${displayText}`;
        listItem.replaceChild(itemText, listItem.querySelector('.edit-input'));
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => {
          editItem(newPattern, listItem, itemText);
        });
        listItem.replaceChild(editButton, listItem.querySelector('button:nth-of-type(1)'));
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
          deleteItem(newPattern, listItem);
        });
        listItem.appendChild(deleteButton);
      });
    });
  }

  function deleteItem(pattern, listItem) {
    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      const blocked = data.blocked.filter(item => item !== pattern);
      const enabled = data.enabled.filter(item => item !== pattern);
      const favorites = data.favorites.filter(item => item !== pattern)
      chrome.storage.sync.set({ blocked, enabled, favorites }, () => {
        listItem.remove();
      });
    });
  }

  function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.style.opacity = '0.4';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const targetItem = e.target.closest('li');
    if (targetItem && draggedItem !== targetItem) {
      const rect = targetItem.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      if (e.clientY > middleY) {
        targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
      } else {
        targetItem.parentNode.insertBefore(draggedItem, targetItem);
      }
    } else if (!targetItem) {
      // If dropped on empty space, append to the end of the list
      blockedList.appendChild(draggedItem);
    }
    updateBlockedOrder();
    return false;
  }

  function handleDragEnd() {
    this.style.opacity = '1';
    draggedItem = null;
  }

  function updateBlockedOrder() {
    const newOrder = Array.from(blockedList.children).map(li => {
      const itemText = li.querySelector('.text').textContent;
      return itemText.slice(2).trim(); // Remove emoji and trim
    });

    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      const oldBlocked = data.blocked || [];
      const enabled = data.enabled || [];
      const favorites = data.favorites || [];

      // Create a map of display text to original pattern
      const patternMap = new Map(oldBlocked.map(pattern => [getDisplayText(pattern), pattern]));

      // Create the new blocked array based on the new order
      const newBlocked = newOrder.map(displayText => patternMap.get(displayText));

      favorites.sort((a, b) => newBlocked.indexOf(a) - newBlocked.indexOf(b));

      chrome.storage.sync.set({ blocked: newBlocked, enabled, favorites }, () => {
        console.log('Blocked list order updated');
      });
    });
  }
});