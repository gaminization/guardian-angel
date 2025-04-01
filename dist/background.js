/******/ (() => { // webpackBootstrap
/*!**************************************!*\
  !*** ./src/background/background.js ***!
  \**************************************/
  try {
    // Initialize the local LLM service
    let llmServiceReady = false;
    let llmServiceUrl = 'http://localhost:8000/api/analyze';
    let feedbackQueue = []; // Queue for storing user feedback for model training
    
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
          console.log(`Keyword detected: "${keyword}" in text: "${text.substring(0, 50)}..."`);
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
    
    // Function to send feedback to the LLM service for training
    async function sendFeedbackToLLM(text, isHarassment) {
      if (!llmServiceReady) {
        // Queue feedback for later if service is not available
        feedbackQueue.push({ text, isHarassment });
        return;
      }
      
      try {
        const response = await fetch(`${llmServiceUrl}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            isHarassment: isHarassment
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Feedback sent successfully');
      } catch (error) {
        console.error('Error sending feedback:', error);
        // Queue feedback for later if sending fails
        feedbackQueue.push({ text, isHarassment });
        llmServiceReady = false;
      }
    }
    
    // Process queued feedback when service becomes available
    function processQueuedFeedback() {
      if (!llmServiceReady || feedbackQueue.length === 0) return;
      
      // Process up to 5 items at a time to avoid overwhelming the service
      const itemsToProcess = feedbackQueue.splice(0, 5);
      
      itemsToProcess.forEach(item => {
        sendFeedbackToLLM(item.text, item.isHarassment);
      });
    }
    
    // Periodically check if we can process queued feedback
    setInterval(processQueuedFeedback, 60000); // Check every minute
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Message received in background:', message);
      
      if (message.action === 'analyzeText') {
        // For better performance, first try keyword detection
        const keywordResult = analyzeWithKeywords(message.text, message.sensitivity);
        
        // If keyword detection found harassment, respond immediately
        if (keywordResult.isHarassment) {
          console.log('Harassment detected via keywords:', keywordResult);
          
          // Update detection count
          chrome.storage.local.get(['detectionCount'], (data) => {
            const newCount = (data.detectionCount || 0) + 1;
            chrome.storage.local.set({ detectionCount: newCount });
          });
          
          // Send immediate response to content script
          sendResponse(keywordResult);
          
          // Also send a direct message to ensure it's received
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'harassmentDetected',
            text: keywordResult.text,
            confidence: keywordResult.confidence
          });
          
          return true;
        }
        
        // If no harassment detected by keywords, try LLM if available
        if (llmServiceReady) {
          analyzeWithLocalLLM(message.text, message.sensitivity)
            .then(result => {
              if (result.isHarassment) {
                console.log('Harassment detected via LLM:', result);
                
                // Update detection count
                chrome.storage.local.get(['detectionCount'], (data) => {
                  const newCount = (data.detectionCount || 0) + 1;
                  chrome.storage.local.set({ detectionCount: newCount });
                });
                
                // Try to send response if still possible
                try {
                  sendResponse(result);
                } catch (error) {
                  console.error('Error sending response:', error);
                }
                
                // Also send a direct message to ensure it's received
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: 'harassmentDetected',
                  text: result.text,
                  confidence: result.confidence
                });
              } else {
                // No harassment detected
                try {
                  sendResponse(result);
                } catch (error) {
                  console.error('Error sending response:', error);
                }
              }
            })
            .catch(error => {
              console.error('Error in harassment analysis:', error);
              // Send the keyword result as fallback
              try {
                sendResponse(keywordResult);
              } catch (error) {
                console.error('Error sending fallback response:', error);
              }
            });
        } else {
          // LLM not available, just use keyword result
          sendResponse(keywordResult);
        }
        
        return true; // Indicates async response
      } else if (message.action === 'harassmentFeedback') {
        // Process user feedback
        sendFeedbackToLLM(message.text, message.isHarassment);
        
        // Update training data count
        chrome.storage.local.get(['trainingDataCount'], (data) => {
          const newCount = (data.trainingDataCount || 0) + 1;
          chrome.storage.local.set({ trainingDataCount: newCount });
        });
      } else if (message.action === 'excessiveHarassment') {
        console.log('Excessive harassment detected, blocking content');
        
        // Send message to content script to block the page
        chrome.tabs.sendMessage(sender.tab.id, {
          action: 'blockContent'
        });
        
        // Update excessive harassment count
        chrome.storage.local.get(['excessiveCount'], (data) => {
          const newCount = (data.excessiveCount || 0) + 1;
          chrome.storage.local.set({ excessiveCount: newCount });
        });
      }
      
      // Must return true for asynchronous response
      return true;
    });
    
    // Set default values when extension is installed
    chrome.runtime.onInstalled.addListener(() => {
      chrome.storage.local.set({
        enabled: true,
        sensitivity: 'medium',
        detectionCount: 0,
        trainingDataCount: 0,
        excessiveCount: 0
      });
      
      console.log('Harassment Shield extension installed successfully');
      
      // For testing: Force a test detection after 5 seconds
      setTimeout(() => {
        console.log('Sending test harassment detection');
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'harassmentDetected',
              text: 'This is a test harassment message for testing the popup UI',
              confidence: 0.85
            });
          }
        });
      }, 5000);
    });
    
    // Periodically check LLM service availability
    function checkLLMService() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      fetch(`${llmServiceUrl}/health`, { 
        method: 'GET',
        signal: controller.signal
      })
      .then(response => {
        clearTimeout(timeoutId);
        llmServiceReady = response.ok;
        console.log('LLM service status:', llmServiceReady ? 'available' : 'unavailable');
        if (llmServiceReady) {
          processQueuedFeedback();
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('LLM service check failed:', error);
        llmServiceReady = false;
      });
    }
    
    // Check service availability every 5 minutes
    setInterval(checkLLMService, 300000);
    // Initial check
    checkLLMService();
    
  }
  catch (error) {
      console.error('Background script initialization error:', error);
  }
  /******/ })()
  ;
  //# sourceMappingURL=background.js.map
  