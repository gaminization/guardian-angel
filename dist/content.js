/******/ (() => { // webpackBootstrap
/*!********************************!*\
  !*** ./src/content/content.js ***!
  \********************************/
// Initialize settings
let enabled = true;
let sensitivity = 'medium';
let recentDetections = []; // Track recent high-confidence detections

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
  
  // Analyze the entire text instead of chunking
  chrome.runtime.sendMessage({
    action: 'analyzeText',
    text: text,
    sensitivity: sensitivity
  }, response => {
    console.log('Response from background:', response);
    if (response && response.isHarassment && response.confidence >= 0.6) {
      showHarassmentPopup(text, response.confidence);
    }
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
  console.log('Message received in content script:', message);
  if (message.action === 'harassmentDetected') {
    if (message.confidence >= 0.6) { // Only show for confidence >= 60%
      showHarassmentPopup(message.text, message.confidence);
    }
  } else if (message.action === 'blockContent') {
    blockPageContent();
  }
});

// Function to show harassment popup with feedback options
function showHarassmentPopup(text, confidence) {
  // Check if we already have a popup
  if (document.getElementById('harassment-popup')) {
    return;
  }
  
  // Track high confidence detections
  if (confidence >= 0.85) {
    trackHighConfidenceDetection();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'harassment-popup';
  popup.style.position = 'fixed';
  popup.style.bottom = '20px';
  popup.style.right = '20px';
  popup.style.width = '350px';
  popup.style.zIndex = '10000';
  
  popup.innerHTML = `
  <div style="background-color: rgba(255, 255, 255, 0.98); border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); overflow: hidden; font-family: 'Segoe UI', Roboto, Arial, sans-serif; transition: all 0.3s ease;">
    <div style="background-color: #d32f2f; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; letter-spacing: 0.3px;">
        <svg viewBox="0 0 24 24" width="22" height="22" style="margin-right: 10px;">
          <path fill="currentColor" d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/>
        </svg>
        Potential Harassment Detected
      </h3>
      <button id="close-popup" style="background: none; border: none; cursor: pointer; font-size: 18px; color: white; padding: 0; transition: color 0.2s;">✕</button>
    </div>
    <div style="padding: 18px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="flex-grow: 1; height: 6px; background-color: #f5f5f5; border-radius: 3px;">
          <div style="width: ${(confidence * 100).toFixed(0)}%; height: 100%; background-color: ${confidence > 0.8 ? '#d32f2f' : confidence > 0.7 ? '#ff9800' : '#4caf50'}; border-radius: 3px;"></div>
        </div>
        <span style="margin-left: 10px; font-weight: 600; color: ${confidence > 0.8 ? '#d32f2f' : confidence > 0.7 ? '#ff9800' : '#4caf50'};">${(confidence * 100).toFixed(0)}%</span>
      </div>
      <div style="background-color: #f8f8f8; padding: 14px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; max-height: 80px; overflow-y: auto; color: #333; border: 1px solid #eee; line-height: 1.4;">
        "${text}"
      </div>
      <p style="margin: 0 0 12px; font-size: 14px; color: #555;">Was this correctly identified as harassment?</p>
      <div style="display: flex; justify-content: space-between; gap: 10px;">
        <button id="feedback-yes" style="flex: 1; background-color: #4caf50; color: white; border: none; padding: 10px 0; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">Correct</button>
        <button id="feedback-no" style="flex: 1; background-color: #f44336; color: white; border: none; padding: 10px 0; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">Incorrect</button>
      </div>
    </div>
  </div>
`;
  
  document.body.appendChild(popup);
  
  // Add hover effects for buttons
  const yesBtn = document.getElementById('feedback-yes');
  yesBtn.addEventListener('mouseover', function() {
    this.style.backgroundColor = '#45a049';
  });
  yesBtn.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#4caf50';
  });

  const noBtn = document.getElementById('feedback-no');
  noBtn.addEventListener('mouseover', function() {
    this.style.backgroundColor = '#d32f2f';
  });
  noBtn.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#f44336';
  });
  
  // Add event listeners
  document.getElementById('close-popup').addEventListener('click', () => {
    popup.remove();
  });
  
  document.getElementById('feedback-yes').addEventListener('click', () => {
    sendFeedback(text, true);
    popup.remove();
  });
  
  document.getElementById('feedback-no').addEventListener('click', () => {
    sendFeedback(text, false);
    popup.remove();
  });
  
  // Auto-remove after 30 seconds if no interaction
  setTimeout(() => {
    if (document.getElementById('harassment-popup')) {
      popup.remove();
    }
  }, 30000);
}

// Function to send feedback to background script
function sendFeedback(text, isHarassment) {
  chrome.runtime.sendMessage({
    action: 'harassmentFeedback',
    text: text,
    isHarassment: isHarassment
  });
}

// Function to track high confidence detections
function trackHighConfidenceDetection() {
  const now = Date.now();
  
  // For testing: Set time window to 0 (from 15 minutes)
  // Remove detections older than 0 minutes
  recentDetections = recentDetections.filter(timestamp => {
    return now - timestamp < 10 * 60 * 1000; // Changed from 15 to 0
  });
  
  // Add current detection
  recentDetections.push(now);
  
  // For testing: Check if we have 1 or more detections (changed from 5 to 1)
  if (recentDetections.length >= 5) {
    chrome.runtime.sendMessage({
      action: 'excessiveHarassment'
    });
    
    // Reset the counter after reporting
    recentDetections = [];
  }
}

// Function to block page content
function blockPageContent() {
  // Check if block overlay already exists
  if (document.getElementById('harassment-block-overlay')) {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'harassment-block-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(220, 53, 69, 0.97)';
  overlay.style.backdropFilter = 'blur(10px)';
  overlay.style.zIndex = '2147483647'; // Maximum z-index
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.color = 'white';
  overlay.style.fontFamily = '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, sans-serif';
  overlay.style.padding = '20px';
  overlay.style.textAlign = 'center';
  
  overlay.innerHTML = `
    <div style="max-width: 600px; background-color: rgba(0,0,0,0.2); padding: 30px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
      <h2 style="margin-bottom: 20px; font-size: 28px; font-weight: 600;">⚠️ High Level of Harassment Detected</h2>
      <p style="margin-bottom: 30px; line-height: 1.6; font-size: 16px; opacity: 0.9;">
        This page contains an excessive amount of potentially harmful content. 
        We recommend taking a break from this conversation or content.
      </p>
      <div>
        <button id="continue-anyway" style="background-color: rgba(0,0,0,0.3); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-right: 15px; font-size: 15px; font-weight: 500; transition: background 0.2s;">Continue Anyway</button>
        <button id="go-back" style="background-color: rgba(255,255,255,0.25); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 500; transition: background 0.2s;">Go Back</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listeners with hover effects
  const continueBtn = document.getElementById('continue-anyway');
  continueBtn.addEventListener('mouseover', () => {
    continueBtn.style.backgroundColor = 'rgba(0,0,0,0.4)';
  });
  continueBtn.addEventListener('mouseout', () => {
    continueBtn.style.backgroundColor = 'rgba(0,0,0,0.3)';
  });
  continueBtn.addEventListener('click', () => {
    overlay.remove();
    // Reset the detection counter
    recentDetections = [];
  });
  
  const backBtn = document.getElementById('go-back');
  backBtn.addEventListener('mouseover', () => {
    backBtn.style.backgroundColor = 'rgba(255,255,255,0.35)';
  });
  backBtn.addEventListener('mouseout', () => {
    backBtn.style.backgroundColor = 'rgba(255,255,255,0.25)';
  });
  backBtn.addEventListener('click', () => {
    history.back();
  });
}

/******/ })()
;
//# sourceMappingURL=content.js.map
