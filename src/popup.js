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
let aiInsightsButton = document.getElementById("get-ai-insights");
let insightsContent = document.getElementById("ai-insights-results");

let flyoutMenuItems;
let kusto_suffix =
  "&endpoint=https://powerappsclientneu.northeurope.kusto.windows.net";
let kusto_prefix =
  "https://portal.microsoftgeneva.com/logs/kusto?database=0b14a44360bf4cae8e1e090ac91a04e5&query=";
let adoBaseUrl;
let kustoBaseUrl;
let unifyBaseUrl = "https://unify.services.dynamics.com/CRM/Org";
let configJson = {};
let tabUrl = "";

//#region Event Handlers
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

input_query.oninput = inputQueryOnChangeHandler;

function inputQueryOnChangeHandler() {
  if (input_query.value.length === 0) {
    ado_search.disabled = true;
    unify_search.style.display = "none";
    kusto_search.style.display = "none";
    aiInsightsButton.style.display = "none";
  } else {
    ado_search.disabled = false;
    if (isInputTextGuid(input_query.value)) {
      unify_search.style.display = "block";
      kusto_search.style.display = "block";
      aiInsightsButton.style.display = "none";

      for (const [key, value] of Object.entries(configJson)) {
        configJson[key] = replacer(value, {
          Guid: `"${input_query.value}"`,
        });
      }
      kustoBaseUrl = `${kusto_prefix}`; //${configData}${kusto_suffix}
    } else {
      unify_search.style.display = "none";
      kusto_search.style.display = "none";
      aiInsightsButton.style.display = "block";
    }
  }
}

aiInsightsButton.onclick = function () {
  let intent = getIntentFromTextAndUrl(input_query.value, tabUrl);
  let promptDictionary = getPromptFromIntent(intent);
  insightsContent.textContent = "loading insights";
  askLlama2(promptDictionary, input_query.value).then((llama2OutputString) => {
    console.log(llama2OutputString);
    insightsContent.textContent = llama2OutputString;
  });
};

document.addEventListener("DOMContentLoaded", function () {
  setGlobalVariablesFromConfig();
  chrome.tabs.query({ active: true, currentWindow: true }).then((resp) => {
    const [tab] = resp;
    try {
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => getSelection().toString(),
        })
        .then((resp) => {
          if (!resp || resp.length !== 0) {
            input_query.value = resp[0].result;
            tabUrl = tab.url;
            inputQueryOnChangeHandler();
          }
        });
      return;
    } catch (e) {
      console.log(e);
      return;
    }
  });
});
//#endregion

//#region Utilities
function isInputTextGuid(userSelection) {
  // Remove whitespaces from the selection first
  userSelection = userSelection.replace(/\s/g, "");

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    userSelection
  );
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

var replacer = function (tpl, data) {
  var re = /\$\(([^\)]+)?\)/g,
    match;
  while ((match = re.exec(tpl))) {
    tpl = tpl.replace(match[0], data[match[1]]);
    re.lastIndex = 0;
  }
  return tpl;
};
//#endregion

//#region AI related functions
async function askLlama2(promptDictionary, inputText) {
  const llmCall = fetch("https://www.llama2.ai/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `<s>[INST] <<SYS>>\n${promptDictionary.userPrePrompt}\n<</SYS>>\n\n${inputText}[/INST]\n`,
      model: "meta/llama-2-70b-chat",
      systemPrompt: `${promptDictionary.systemPrompt}`,
      temperature: 0.75,
      topP: 0.9,
      maxTokens: 800,
      image: null,
      audio: null,
    }),
  });

  const response = await llmCall;
  if (response.ok) {
    const text = await response.text();
    if (text.includes("<result>")) {
      let jsonOutput = text.split("<result>")[1].split("</result>")[0];
      return jsonOutput;
    } else {
      return text;
    }
  }
}

function getIntentFromTextAndUrl(selectedText, tabUrl) {
  let intent = "unknown";
  if (tabUrl.includes(".pdf") || tabUrl.includes(".docx")) {
    intent = "specReview";
  } else if (tabUrl.includes("portal.microsofticm.com")) {
    intent = "debug";
  }

  return intent;
}

function getPromptFromIntent(intent) {
  switch (intent) {
    case "specReview":
      return {
        systemPrompt:
          "You are a JSON document generator assisting a product manager to create user stories and tasks from the spec review document",
        userPrePrompt:
          "Generate a JSON document from the input text representing an array of work items as user stories and tasks. Every item in the JSON array should have the following structure: 'unique_key' representing a unique number; 'title_of_item' having a string value respresenting a very short title for the work item; 'description_of_item' having a string value respresenting description of the work item; 'type_of_item' having a string value which can be either 'userstory' or 'task'; 'parent_item_unique_key' for linking tasks to a user story. Give parentId as -1 to user stories. The generated JSON should conform to this structure. Do not include any additional or invalid keys. Surround your JSON output with <result></result> tags.",
      };
    case "debug":
      return {
        systemPrompt:
          "You are an AI code and code error assistant that explains code and error messages and exceptions.",
        userPrePrompt:
          "Help me understand this text which is either an error or a code snippet. If the message is an error use the context of Dynamics 365, explain the error message and provide ways to resolve it. If the message is a code snippet, then explain the code. Be concise and straightforward in your answer. ",
      };
    case "unknown":
      return {
        systemPrompt:
          "You are an AI code and code error assistant that explains code and error messages and exceptions.",
        userPrePrompt:
          "Help me understand this text which is either an error or a code snippet. Auto detect the category and explain the details of this text. Be concise and straightforward in your answer.",
      };
    default:
      return {};
  }
}

//#endregion

function setGlobalVariablesFromConfig() {
  chrome.storage.sync
    .get({ adoSettings: {}, kustoSettings: {}, newTab: true })
    .then((items) => {
      let companyName = items.adoSettings.company || "dynamicscrm";
      let projectName = items.adoSettings.project || "OneCRM";

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

      if (
        items.kustoSettings.configJson !== undefined &&
        items.kustoSettings.configJson !== ""
      ) {
        configJson = JSON.parse(items.kustoSettings.configJson);

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
            createNewTab(finalKustoQuery);
          });
        });
      }
    });
}
