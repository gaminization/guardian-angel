/******/ (() => { // webpackBootstrap
/*!****************************!*\
  !*** ./src/popup/popup.js ***!
  \****************************/
  document.addEventListener('DOMContentLoaded', () => {
    const enableDetection = document.getElementById('enableDetection');
    const sensitivity = document.getElementById('sensitivity');
    const detectionCount = document.getElementById('detectionCount');
    const trainingDataCount = document.getElementById('trainingDataCount');
    const excessiveCount = document.getElementById('excessiveCount');
    const clearStats = document.getElementById('clearStats');
  
    // Load saved settings
    chrome.storage.local.get(
      ['enabled', 'sensitivity', 'detectionCount', 'trainingDataCount', 'excessiveCount'], 
      (result) => {
        enableDetection.checked = result.enabled !== false;
        sensitivity.value = result.sensitivity || 'medium';
        detectionCount.textContent = result.detectionCount || 0;
        trainingDataCount.textContent = result.trainingDataCount || 0;
        excessiveCount.textContent = result.excessiveCount || 0;
      }
    );
  
    // Save settings when changed
    enableDetection.addEventListener('change', () => {
      chrome.storage.local.set({ enabled: enableDetection.checked });
    });
  
    sensitivity.addEventListener('change', () => {
      chrome.storage.local.set({ sensitivity: sensitivity.value });
    });
  
    clearStats.addEventListener('click', () => {
      chrome.storage.local.set({ 
        detectionCount: 0,
        trainingDataCount: 0,
        excessiveCount: 0
      });
      detectionCount.textContent = '0';
      trainingDataCount.textContent = '0';
      excessiveCount.textContent = '0';
    });
  });
    
  /******/ })()
  ;
  //# sourceMappingURL=popup.js.map
  