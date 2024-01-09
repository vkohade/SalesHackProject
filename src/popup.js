import "./popup.css";

let span_company = document.getElementById("company");
let span_projectName = document.getElementById("projectName");
let ado_search = document.getElementById("search-in-ado");
let unify_search = document.getElementById("search-in-unify");
let kusto_search = document.getElementById("query-in-kusto");
let form_newTab = document.getElementById("newTab");
let button_settings = document.getElementById("settings");
let input_query = document.getElementById("query");
let flyoutMenu = document.getElementsByClassName("dropdown-content");
let flyoutMenuItems;

let kusto_suffix = "&endpoint=https://powerappsclientneu.northeurope.kusto.windows.net";
let kusto_prefix = "https://portal.microsoftgeneva.com/logs/kusto?database=0b14a44360bf4cae8e1e090ac91a04e5&query=";
let configData = {
  "SalesForecasting": "cluster('crmanacus.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | union cluster('crmanaweu.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | where TIMESTAMP > ago(1d) | where ActivityId == $(Guid) or  OrgId == $(Guid)",
  "Sales Forecasting Client Side" : "cluster('crmanacus.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | union cluster('crmanaweu.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | where TIMESTAMP > ago(1d) | where ActivityId == $(Guid) or  OrgId == $(Guid)"};

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
      //kusto_search.disabled = false;
    }

    span_company.textContent = companyName;
    span_projectName.textContent = projectName;
    form_newTab.checked = items.newTab;
    adoBaseUrl = `https://dev.azure.com/${companyName}/${projectName}`;
    YOUR_API_KEY = items.openAISettings.apiKey;
  }
);

var replacer = function(tpl, data) {
	var re = /\$\(([^\)]+)?\)/g, match;
  while(match = re.exec(tpl)) {
		tpl = tpl.replace(match[0], data[match[1]])
    re.lastIndex = 0;
  }
  return tpl;
}


// Create a new link for each kusto scenario and add it to the flyout menu
for (const [key, value] of Object.entries(configData)) {
  var link = document.createElement("div");
  link.className = "dropdown-items";
  link.id = key;
  link.innerHTML = key;
  flyoutMenu[0].appendChild(link);
}


flyoutMenuItems = document.getElementsByClassName("dropdown-items");


Array.from(flyoutMenuItems).forEach(element => {
  element.addEventListener('click', () => {
    let finalKustoQuery = kustoBaseUrl + configData[element.id] + kusto_suffix;
    console.log(finalKustoQuery);
    window.open(finalKustoQuery, '_blank');
  });
});



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
            //kusto_search.style.display = "block";

            for (const [key, value] of Object.entries(configData)) {
              configData[key] = replacer(value, { "Guid": `"${input_query.value}"` });
            }
            kustoBaseUrl = `${kusto_prefix}`; //${configData}${kusto_suffix}
          } else {
            unify_search.style.display = "none";
            //kusto_search.style.display = "none";
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