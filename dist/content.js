/******/ (() => { // webpackBootstrap
/*!********************************!*\
  !*** ./src/content/content.js ***!
  \********************************/
/******/ (() => { // webpackBootstrap
/*!********************************!*\
  !*** ./src/content/content.js ***!
  \********************************/
// Initialize settings
let enabled = true;
let sensitivity = 'medium';

// Load settings
chrome.storage.local.get(['enabled', 'sensitivity'], (result) => {
  enabled = result.enabled !== false;
  sensitivity = result.sensitivity || 'medium';
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    enabled = changes.enabled.newValue;
  }
  if (changes.sensitivity) {
    sensitivity = changes.sensitivity.newValue;
  }
});

// Function to extract text from a node
function extractText(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent.trim();
  }
  
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  // Skip script, style, and hidden elements
  const tagName = node.tagName.toLowerCase();
  if (tagName === 'script' || tagName === 'style' || node.style.display === 'none') {
    return '';
  }
  
  let text = '';
  for (const child of node.childNodes) {
    text += ' ' + extractText(child);
  }
  return text.trim();
}

// Function to analyze text chunks
function analyzeTextChunks(node) {
  if (!enabled) return;
  
  const text = extractText(node);
  if (text.length < 10) return;
  
  // Split long text into manageable chunks (max 500 chars)
  const chunks = [];
  let currentChunk = '';
  
  text.split(/\s+/).forEach(word => {
    if ((currentChunk + ' ' + word).length > 500) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  // Send chunks to background script for analysis
  chunks.forEach(chunk => {
    chrome.runtime.sendMessage({
      action: 'analyzeText',
      text: chunk,
      sensitivity: sensitivity
    });
  });
}

// Observe DOM changes
const observer = new MutationObserver(mutations => {
  if (!enabled) return;
  
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        analyzeTextChunks(node);
      });
    }
  });
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial scan of the page
analyzeTextChunks(document.body);

// Listen for harassment alerts from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'harassmentDetected') {
    highlightHarassment(message.text, message.confidence);
  }
});

// Function to highlight harassment
function highlightHarassment(text, confidence) {
  // Implementation to highlight or warn about harassment
  // This could create a warning banner, highlight text, etc.
  console.log(`Harassment detected (${confidence.toFixed(2)}): ${text}`);
  
  // Create a notification banner
  const banner = document.createElement('div');
  banner.style.position = 'fixed';
  banner.style.top = '10px';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
  banner.style.color = 'white';
  banner.style.padding = '10px 20px';
  banner.style.borderRadius = '5px';
  banner.style.zIndex = '10000';
  banner.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  banner.textContent = `⚠️ Potential harassment detected (${(confidence * 100).toFixed(0)}% confidence)`;
  
  document.body.appendChild(banner);
  
  // Remove after 5 seconds
  setTimeout(() => {
    banner.remove();
  }, 5000);
}

/******/ })()
;
//# sourceMappingURL=content.js.map
/******/ })()
;
//# sourceMappingURL=content.js.map