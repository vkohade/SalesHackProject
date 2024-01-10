import "./popup.css";

let span_company = document.getElementById("company");
let span_projectName = document.getElementById("projectName");
let ado_search = document.getElementById("search-in-ado");
let unify_search = document.getElementById("search-in-unify");
let kusto_search = document.getElementById("dropdown");
let form_newTab = document.getElementById("newTab");
let button_settings = document.getElementById("settings");
let input_query = document.getElementById("query");
let flyoutMenu = document.getElementsByClassName("dropdown-content");
let flyoutMenuItems;

let kusto_suffix =
  "&endpoint=https://powerappsclientneu.northeurope.kusto.windows.net";
let kusto_prefix =
  "https://portal.microsoftgeneva.com/logs/kusto?database=0b14a44360bf4cae8e1e090ac91a04e5&query=";
let adoBaseUrl;
let kustoBaseUrl;
let unifyBaseUrl = "https://unify.services.dynamics.com/CRM/Org";
let configJson = {};

chrome.storage.sync.get(
  { adoSettings: {}, kustoSettings: {}, newTab: true },
  function (items) {
    let companyName = items.adoSettings.company || "dynamicscrm";
    let projectName = items.adoSettings.project || "OneCRM";
    configJson = JSON.parse(items.kustoSettings.configJson);

    // make sure they're both present
    if (
      !(companyName && companyName.length > 0) ||
      !(projectName && projectName.length > 0)
    ) {
      span_company.textContent = "[OPTIONS NOT SET]";
      ado_search.disabled = true;
    }

    span_company.textContent = companyName;
    span_projectName.textContent = projectName;
    form_newTab.checked = items.newTab;
    adoBaseUrl = `https://dev.azure.com/${companyName}/${projectName}`;

    // Create a new link for each kusto scenario and add it to the flyout menu
    for (const [key, value] of Object.entries(configJson)) {
      var link = document.createElement("div");
      link.className = "dropdown-items";
      link.id = key;
      link.innerHTML = key;
      flyoutMenu[0].appendChild(link);
    }

    flyoutMenuItems = document.getElementsByClassName("dropdown-items");

    Array.from(flyoutMenuItems).forEach((element) => {
      element.addEventListener("click", () => {
        let finalKustoQuery =
          kustoBaseUrl + configJson[element.id] + kusto_suffix;
        console.log(finalKustoQuery);
        createNewTab(finalKustoQuery);
      });
    });
  }
);

var replacer = function (tpl, data) {
  var re = /\$\(([^\)]+)?\)/g,
    match;
  while ((match = re.exec(tpl))) {
    tpl = tpl.replace(match[0], data[match[1]]);
    re.lastIndex = 0;
  }
  return tpl;
};

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
    let selectedText = "";
    try {
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => getSelection().toString(),
        })
        .then((resp) => {
          console.log(resp);
          if (!resp || resp.length === 0) {
            document.getElementById("query").value = "Please select some text";
            return;
          } else {
            selectedText = resp[0].result;
          }
          if (selectedText.length === 0) {
            ado_search.disabled = true;
            unify_search.style.display = "none";
            kusto_search.style.display = "none";
          } else {
            document.getElementById("query").value = selectedText;

            if (isSelectedTextGuid(selectedText)) {
              unify_search.style.display = "block";
              kusto_search.style.display = "block";

              for (const [key, value] of Object.entries(configJson)) {
                configJson[key] = replacer(value, {
                  Guid: `"${input_query.value}"`,
                });
              }
              kustoBaseUrl = `${kusto_prefix}`; //${configData}${kusto_suffix}
            } else {
              unify_search.style.display = "none";
              kusto_search.style.display = "none";
            }

            let intent = getIntentFromTextAndUrl(selectedText, tab.url);
            let promptDictionary = getPromptFromIntent(intent);
            askLlama2(promptDictionary);
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

function askLlama2(promptDictionary) {
  const llmCall = fetch("https://www.llama2.ai/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `<s>[INST] <<SYS>>\n${promptDictionary.systemPrompt}\n<</SYS>>\n\n${promptDictionary.userPrePrompt}:${selectedText}[/INST]\n`,
      model: "meta/llama-2-70b-chat",
      systemPrompt: `${promptDictionary.systemPrompt}`,
      temperature: 0.75,
      topP: 0.9,
      maxTokens: 800,
      image: null,
      audio: null,
    }),
  });

  llmCall.then((response) => {
    if (response.ok) {
      response.text().then((text) => {
        console.log(text);
      });
    }
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

function getIntentFromTextAndUrl(selectedText, tabUrl) {
  let intent = "unknown";
  if (tabUrl.contains(".pdf")) {
    intent = "specReview";
  } else if (tabUrl.contains("portal.microsofticm.com")) {
    intent = "error";
  }

  return intent;
}

function getPromptFromIntent(intent) {
  switch (intent) {
    case "specReview":
      return {
        systemPrompt:
          "You are a Product Manager and your role is to create user stories for Azure Devops.",
        userPrePrompt:
          'Summarize the sentences to create a JSON list with the keys "unique_key", "title_of_item" and "description_of_item", "type_of_item", "parent_item_unique_key".The "type_of_item" can be either "user story" or "task". A task will have a parent user story',
      };
    case "error":
      return {
        systemPrompt:
          "You are a helpful chat assistant for dynamics 365 and your role is to help the user with the error message.",
        userPrePrompt:
          'Summarize the sentences to create a JSON list with the keys "unique_key", "title_of_item" and "description_of_item", "type_of_item", "parent_item_unique_key".The "type_of_item" can be either "user story" or "task". A task will have a parent user story',
      };
    case "unknown":
      return {
        systemPrompt:
          "You are a helpful chat assistant to help developers understand the code.",
        userPrePrompt:
          'Summarize the sentences to create a JSON list with the keys "unique_key", "title_of_item" and "description_of_item", "type_of_item", "parent_item_unique_key".The "type_of_item" can be either "user story" or "task". A task will have a parent user story',
      };
    default:
      return {};
  }
}
