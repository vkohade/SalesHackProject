import "./options.css";
import { kustoData } from './../kustoData';

document.addEventListener("DOMContentLoaded", function () {
  // Load saved options
  chrome.storage.sync.get(
    { adoSettings: {}, kustoSettings: {}, newTab: true, openAISettings: {} },
    function (result) {
      document.getElementById("openInNewTab").checked = result.newTab || false;
      document.getElementById("companyName").value =
        result.adoSettings.company || "dynamicscrm";
      document.getElementById("projectName").value =
        result.adoSettings.project || "OneCRM";

      document.getElementById('configJson').value =
        result.kustoSettings.configJson ||  JSON.stringify(kustoData)
    }
  );

  // Save options when the save button is clicked
  document.getElementById("saveButton").addEventListener("click", function () {
    const openInNewTab = document.getElementById("openInNewTab").checked;
    const companyName = document.getElementById("companyName").value;
    const projectName = document.getElementById("projectName").value;
    const configJson = document.getElementById("configJson").value;

    let options = {
      newTab: openInNewTab,
      adoSettings: {
        company: companyName,
        project: projectName,
      },
      kustoSettings: {
        configJson: configJson,
      },
    };

    // Save options to Chrome storage
    chrome.storage.sync.set(options, function () {
      // Notify the user that the options were saved
      alert("Options saved!");
    });
  });
});
