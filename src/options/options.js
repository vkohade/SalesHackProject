import "./options.css";

document.addEventListener("DOMContentLoaded", function () {
  // Load saved options
  chrome.storage.sync.get(
    { adoSettings: {}, kustoSettings: {}, newTab: true, openAISettings: {} },
    function (result) {
      document.getElementById("openInNewTab").checked = result.newTab || false;
      document.getElementById("companyName").value =
        result.adoSettings.company || "";
      document.getElementById("projectName").value =
        result.adoSettings.project || "";

      document.getElementById("configJson").value =
        result.kustoSettings.cluster || "";

      document.getElementById("openAIApiKey").value =
        result.openAISettings.apiKey || "";
    }
  );

  // Save options when the save button is clicked
  document.getElementById("saveButton").addEventListener("click", function () {
    const openInNewTab = document.getElementById("openInNewTab").checked;
    const companyName = document.getElementById("companyName").value;
    const projectName = document.getElementById("projectName").value;
    const configJson = document.getElementById("configJson").value;
    const openAIapiKey = document.getElementById("openAIApiKey").value;

    let options = {
      newTab: openInNewTab,
      adoSettings: {
        company: companyName,
        project: projectName,
      },
      kustoSettings: {
        configJson: configJson,
      },
      openAISettings: {
        apiKey: openAIapiKey,
      },
    };

    // Save options to Chrome storage
    chrome.storage.sync.set(options, function () {
      // Notify the user that the options were saved
      alert("Options saved!");
    });
  });
});

let showKeyToggle = document.getElementById("apiKeyShowToggle");

showKeyToggle.addEventListener("click", function () {
  let apiKey = document.getElementById("openAIApiKey");
  if (apiKey.type === "password") {
    apiKey.type = "text";
  } else {
    apiKey.type = "password";
  }
});
