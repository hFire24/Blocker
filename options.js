document.addEventListener('DOMContentLoaded', () => {
  const confirmMessage = document.getElementById('enableConfirmMessage');
  const reasonInput = document.getElementById('enableReasonInput');

  // Load saved options
  chrome.storage.sync.get(['enableConfirmMessage', 'enableReasonInput'], (data) => {
    confirmMessage.checked = data.enableConfirmMessage || false;
    reasonInput.checked = data.enableReasonInput || false;
    updateCheckboxState();
  });

  // Save options automatically when changed
  function saveOptions() {
    const enableConfirmMessage = confirmMessage.checked;
    const enableReasonInput = reasonInput.checked;

    chrome.storage.sync.set({ enableConfirmMessage, enableReasonInput });
  }

  // Update the state of the reason input checkbox based on the confirm message checkbox
  function updateCheckboxState() {
    if (!confirmMessage.checked) {
      reasonInput.checked = false;
      reasonInput.disabled = true;
    } else {
      reasonInput.disabled = false;
    }
    saveOptions();
  }

  // Attach event listeners to the checkboxes
  confirmMessage.addEventListener('change', updateCheckboxState);
  reasonInput.addEventListener('change', saveOptions);
});
