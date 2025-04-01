try{

// Initialize the local LLM service
let llmServiceReady = false;
let llmServiceUrl = 'http://localhost:8000/api/analyze';

// Function to analyze text using a local LLM service
// Function to analyze text using a local LLM service
async function analyzeWithLocalLLM(text, sensitivity) {
    try {
      // Check if service is available
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(llmServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          sensitivity: sensitivity
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      llmServiceReady = true; // Mark service as ready if successful
      return {
        isHarassment: data.isHarassment,
        confidence: data.confidence || 0.5,
        text: text
      };
    } catch (error) {
      console.error('Error analyzing text with local LLM:', error);
      // If service is unavailable, mark it as not ready
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        llmServiceReady = false;
      }
      // Fallback to simple keyword detection
      return analyzeWithKeywords(text, sensitivity);
    }
  }
  

// Simple fallback keyword-based analysis
function analyzeWithKeywords(text, sensitivity) {
  const harassmentKeywords = {
    high: [
      'bitch', 'slut', 'whore', 'cunt', 'skank',
      'get back to the kitchen', 'make me a sandwich',
      'asking for it', 'should be raped'
    ],
    medium: [
      'dumb girl', 'stupid woman', 'females are', 'like a girl',
      'for a woman', 'emotional', 'hysteric', 'attention seeking'
    ],
    low: [
      'bossy', 'shrill', 'nagging', 'feminazi', 'man-hater'
    ]
  };
  
  // Normalize text for comparison
  const normalizedText = text.toLowerCase();
  
  // Check for keywords based on sensitivity
  let keywordsToCheck = [];
  if (sensitivity === 'high') {
    keywordsToCheck = harassmentKeywords.high;
  } else if (sensitivity === 'medium') {
    keywordsToCheck = [...harassmentKeywords.high, ...harassmentKeywords.medium];
  } else {
    keywordsToCheck = [...harassmentKeywords.high, ...harassmentKeywords.medium, ...harassmentKeywords.low];
  }
  
  // Check if any keywords are present
  for (const keyword of keywordsToCheck) {
    if (normalizedText.includes(keyword)) {
      return {
        isHarassment: true,
        confidence: 0.7,
        text: text
      };
    }
  }
  
  return {
    isHarassment: false,
    confidence: 0.3,
    text: text
  };
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    analyzeWithLocalLLM(message.text, message.sensitivity)
      .then(result => {
        if (result.isHarassment) {
          // Update detection count
          chrome.storage.local.get(['detectionCount'], (data) => {
            const newCount = (data.detectionCount || 0) + 1;
            chrome.storage.local.set({ detectionCount: newCount });
          });
          
          // Send alert to content script
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'harassmentDetected',
            text: result.text,
            confidence: result.confidence
          });
        }
      })
      .catch(error => console.error('Error in harassment analysis:', error));
  }
  
  // Must return true for asynchronous response
  return true;
});

// Set default values when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: true,
    sensitivity: 'medium',
    detectionCount: 0
  });
});
}
catch (error) {
    console.error('Background script initialization error:', error);
}