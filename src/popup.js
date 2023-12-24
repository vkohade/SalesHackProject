import "./popup.css";

let span_company = document.getElementById("company");
let span_projectName = document.getElementById("projectName");
let ado_search = document.getElementById("search-in-ado");
let unify_search = document.getElementById("search-in-unify");
let kusto_search = document.getElementById("query-in-kusto");
let form_newTab = document.getElementById("newTab");
let button_settings = document.getElementById("settings");
let input_query = document.getElementById("query");

let adoBaseUrl;
let kustoBaseUrl;
let unifyBaseUrl = "https://unify.services.dynamics.com/CRM/Org";
let YOUR_API_KEY = "";

chrome.storage.sync.get(
  { adoSettings: {}, kustoSettings: {}, newTab: true, openAISettings: {} },
  function (items) {
    console.log(JSON.stringify(items));
    let companyName = items.adoSettings.company;
    let projectName = items.adoSettings.project;
    let clusterName = items.kustoSettings.cluster;
    let databaseName = items.kustoSettings.database;
    let tableName = items.kustoSettings.table;
    // make sure they're both present
    if (
      !(companyName && companyName.length > 0) ||
      !(projectName && projectName.length > 0)
    ) {
      span_company.textContent = "[OPTIONS NOT SET]";
      ado_search.disabled = true;
    }

    if (
      !(clusterName && clusterName.length > 0) ||
      !(databaseName && databaseName.length > 0) ||
      !(tableName && tableName.length > 0)
    ) {
      kusto_search.disabled = true;
    }

    span_company.textContent = companyName;
    span_projectName.textContent = projectName;
    form_newTab.checked = items.newTab;
    adoBaseUrl = `https://dev.azure.com/${companyName}/${projectName}`;
    kustoBaseUrl = `https://dataexplorer.azure.com/clusters/${clusterName}}/databases/${databaseName}?query=`;

    YOUR_API_KEY = items.openAISettings.apiKey;
  }
);

// setup triggers
button_settings.onclick = function () {
  chrome.runtime.openOptionsPage();
};

ado_search.onclick = function () {
  let search = input_query.value;

  let fullADOUrl = adoBaseUrl + `/_search?text=${search}&type=workitem`;

  createNewTab(fullADOUrl);
};

unify_search.onclick = function () {
  let search = input_query.value;

  // Remove whitespace from search
  search = search.replace(/\s/g, "");

  createNewTab(`${unifyBaseUrl}/${search}`);
};

kusto_search.onclick = function () {
  let search = input_query.value;

  // Remove whitespace from search
  search = search.replace(/\s/g, "");

  createNewTab(`${kustoBaseUrl}${search}`)
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.tabs.query({ active: true, currentWindow: true }).then((resp) => {
    const [tab] = resp;
    let result;
    try {
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => getSelection().toString(),
        })
        .then((resp) => {
          [{ result }] = resp;
          document.getElementById("query").value = result;

          if (isSelectedTextGuid(result)) {
            unify_search.style.display = "block";
            kusto_search.style.display = "block";
          } else {
            unify_search.style.display = "none";
            kusto_search.style.display = "none";
          }
        });
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  });
});

function isSelectedTextGuid(userSelection) {
  // Remove whitespaces from the selection first
  userSelection = userSelection.replace(/\s/g, "");

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    userSelection
  );
}

function askGPT() {
  const gptCall = fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${YOUR_API_KEY}`,
    },
    body: JSON.stringify({
      "model": "text-davinci-003",
      "prompt": "I am a highly intelligent question answering bot. If you ask me a  Spain.\n\nQ: How many squigs are in a bonk?\nA: Unknown\n\nQ: Where is the Valley of Kings?\nA:",
      "temperature": 0,
      "max_tokens": 100,
      "top_p": 1,
      "frequency_penalty": 0.0,
      "presence_penalty": 0.0,
      "stop": ["\n"]
    }),
  });

  gptCall.then((response) => {
    console.log(response);
  });
}

function createNewTab(url) {
  let tabProperties = {
    url: url,
  };

  if (form_newTab.checked) {
    chrome.tabs.create(tabProperties); // auto-focuses as of Chrome 33
  } else {
    chrome.tabs.getCurrent((tab) => chrome.tabs.update(tabProperties));
  }
}