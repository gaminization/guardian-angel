document.addEventListener('DOMContentLoaded', () => {
    const enableDetection = document.getElementById('enableDetection');
    const sensitivity = document.getElementById('sensitivity');
    const detectionCount = document.getElementById('detectionCount');
    const clearStats = document.getElementById('clearStats');
  
    // Load saved settings
    chrome.storage.local.get(['enabled', 'sensitivity', 'detectionCount'], (result) => {
      enableDetection.checked = result.enabled !== false;
      sensitivity.value = result.sensitivity || 'medium';
      detectionCount.textContent = result.detectionCount || 0;
    });
  
    // Save settings when changed
    enableDetection.addEventListener('change', () => {
      chrome.storage.local.set({ enabled: enableDetection.checked });
    });
  
    sensitivity.addEventListener('change', () => {
      chrome.storage.local.set({ sensitivity: sensitivity.value });
    });
  
    clearStats.addEventListener('click', () => {
      chrome.storage.local.set({ detectionCount: 0 });
      detectionCount.textContent = '0';
    });
  });
  