chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getSelectedText') {
      chrome.tabs.executeScript(
        {
          code: 'window.getSelection().toString();',
        },
        function(selection) {
          sendResponse({ selectedText: selection[0] });
        }
      );
      return true; // Indicates that the sendResponse callback will be called asynchronously
    }
  });
  