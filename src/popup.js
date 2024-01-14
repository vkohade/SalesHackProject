import './popup.css'
import { createParentUserStoryAndChildTask } from './ADOCreateWorkItem'
import {
  generateInsightsHTML,
  showLoader,
  hideLoader,
  showCreatedWorkItems,
  isInputTextGuid,
  replacer,
} from './utils'

import {
  askLlama2,
  getIntentFromTextAndUrl,
  getPromptFromIntent,
} from './getInisghts'

let span_company = document.getElementById('company')
let span_projectName = document.getElementById('projectName')
let form_newTab = document.getElementById('newTab')
let button_settings = document.getElementById('settings')
let input_query_element = document.getElementById('query')

//Buttons
let ado_search_button = document.getElementById('search-in-ado')
let unify_search_button = document.getElementById('search-in-unify')
let get_ai_insights_button = document.getElementById('get-ai-insights')
let ado_create_work_item_button = document.getElementById(
  'create-ado-work-item'
)
let engMs_search_button = document.getElementById('search-in-engms')
let kusto_search_button = document.getElementById('search_in_kusto')

//Dropdowns
let flyoutMenu = document.getElementsByClassName('dropdown-content')
let select_work_item_area_dropdown = document.getElementById(
  'select-work-item-area-dropdown'
)
let select_work_item_iteration_dropdown = document.getElementById(
  'select-work-item-iteration-dropdown'
)

//Content
let insightsContent = document.getElementById('ai-insights-results')
let createWorkItemContent = document.getElementById('create-work-item-results')

//Loader
let create_work_item_loader = document.getElementById('create-work-item-loader')

let llamaOutput = ''

let flyoutMenuItems
let kusto_suffix =
  '&endpoint=https://powerappsclientneu.northeurope.kusto.windows.net'
let kusto_prefix =
  'https://portal.microsoftgeneva.com/logs/kusto?database=0b14a44360bf4cae8e1e090ac91a04e5&query='
let adoBaseUrl
let kustoBaseUrl
let unifyBaseUrl = 'https://unify.services.dynamics.com/CRM/Org'
let configJson = {}
let tabUrl = ''

//Configure search options settings button click
button_settings.onclick = function () {
  chrome.runtime.openOptionsPage()
}

//Create in ADO button click
ado_search_button.onclick = function () {
  let search = input_query_element.value
  let fullADOUrl = adoBaseUrl + `/_search?text=${search}&type=workitem`
  createNewTab(fullADOUrl)
}

//Search in Unify button click
unify_search_button.onclick = function () {
  let search = input_query_element.value
  // Remove whitespace from search term
  search = search.replace(/\s/g, '')
  createNewTab(`${unifyBaseUrl}/${search}`)
}

//Search in Eng.ms button click
engMs_search_button.onclick = function () {
  let search = input_query_element.value
  createNewTab(
    `https://eng.ms/search?q=${search}&filter=%5B%7B%22name%22:%22ancestorMetadataIds%22,%22operator%22:%22CONTAINS%22,%22value%22:%5B%22ad8b876f-9485-443b-9afd-181bd928ec99%22%5D%7D%5D`
  )
}

//Get AI insights button click
get_ai_insights_button.onclick = function () {
  ado_create_work_item_button.disabled = true
  llamaOutput = ''
  select_work_item_area_dropdown.style.display = 'none'
  select_work_item_iteration_dropdown.style.display = 'none'
  createWorkItemContent.style.display = 'none'
  let intent = getIntentFromTextAndUrl(input_query_element.value, tabUrl)
  let promptDictionary = getPromptFromIntent(intent)
  insightsContent.style.display = 'block'
  insightsContent.textContent = 'Loading insights...'
  showLoader('get-AI-insights-loader') // Show loader while fetching insights
  askLlama2(promptDictionary, input_query_element.value).then(
    (llama2OutputString) => {
      llamaOutput = llama2OutputString
      console.log(llama2OutputString)
      if (intent == 'specReview') {
        document.getElementById('popup-body-id').style.width = '600px'
        llama2OutputString
          ? (insightsContent.innerHTML = generateInsightsHTML(
              JSON.parse(llama2OutputString)
            ))
          : (insightsContent.textContent = 'No insights found !')
      } else insightsContent.textContent = llama2OutputString
      hideLoader('get-AI-insights-loader') // Hide loader when insights are loaded
      ado_create_work_item_button.disabled =
        !(intent == 'specReview' &&
        llama2OutputString &&
        (areaDropdown.selectedIndex != -1&& areaDropdown.selectedIndex!=0) &&
        (iterationDropdown.selectedIndex != -1 && iterationDropdown.selectedIndex!=0))
      fetchAreaAndPopulateDropdown()
      fetchIterationAndPopulateDropdown()
      select_work_item_area_dropdown.style.display =
        intent == 'specReview' && llama2OutputString ? 'flex' : 'none'
      select_work_item_iteration_dropdown.style.display =
        intent == 'specReview' && llama2OutputString ? 'flex' : 'none'
    }
  )
}



input_query_element.oninput = inputQueryOnChangeHandler

areaDropdown.addEventListener('change', function () {
  ado_create_work_item_button.disabled =
    areaDropdown.selectedIndex == 0 || iterationDropdown.selectedIndex == 0
})

iterationDropdown.addEventListener('change', function () {
  ado_create_work_item_button.disabled =
    areaDropdown.selectedIndex == 0 || iterationDropdown.selectedIndex == 0
})

//Create ADO work item button click
ado_create_work_item_button.onclick = async function () {
  const selectedAreaPathOption =
    areaDropdown.options[areaDropdown.selectedIndex]
  const adoProjectName =
    document.getElementById('projectName').value || 'OneCRM'
  const selectedChildAreaPath = selectedAreaPathOption.dataset.areaPath
  const selectedAreaPath = adoProjectName + '\\' + selectedChildAreaPath
  const selectedIterationPathOption =
    iterationDropdown.options[iterationDropdown.selectedIndex]
  const selectedChildIterationPath =
    selectedIterationPathOption.dataset.areaPath
  const selectedIterationPath =
    adoProjectName + '\\' + selectedChildIterationPath

  try {
    const cookies = await chrome.cookies.getAll({
      url: 'https://dev.azure.com',
    })
    if (cookies && cookies.length > 0) {
      select_work_item_area_dropdown.style.display = 'none'
      select_work_item_iteration_dropdown.style.display = 'none'
      insightsContent.style.display='none'
      ado_create_work_item_button.disabled=true
      createWorkItemContent.style.display = 'flex'
      createWorkItemContent.textContent = 'Creating work items...'

      showLoader('create-work-item-loader')
      const cookieString = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ')
      const createdWorkItems = await createParentUserStoryAndChildTask(
        adoBaseUrl,
        cookieString,
        JSON.parse(llamaOutput),
        selectedAreaPath,
        selectedIterationPath
      )
      await showCreatedWorkItems(adoBaseUrl, createdWorkItems)
      hideLoader('create-work-item-loader')
    } else {
      redirectToAzureDevOpsLogin()
    }
  } catch (error) {
    console.error('Error getting cookieString:', error)
  }
}

function inputQueryOnChangeHandler() {
  if (input_query_element.value.length === 0) {
    
    disableOnDOMContentLoad()
    setDisplayNoneOnDOMContentLoad()
  } else {
    if (isInputTextGuid(input_query_element.value)) {
      unify_search_button.disabled = false
      engMs_search_button.disabled = false
      kusto_search_button.disabled = false
      ado_search_button.disabled = false
      
      for (const [key, value] of Object.entries(configJson)) {
        configJson[key] = replacer(value, {
          Guid: `"${input_query_element.value}"`,
        })
      }
      kustoBaseUrl = `${kusto_prefix}` //${configData}${kusto_suffix}
    } else {
      ado_search_button.disabled = false
      unify_search_button.disabled = true
      get_ai_insights_button.disabled = false
      engMs_search_button.disabled = false
    }
  }
}

function redirectToAzureDevOpsLogin() {
  chrome.tabs.create({
    url: 'https://dev.azure.com/dynamicscrm',
  })
}

function fetchIterationAndPopulateDropdown() {
  const adoOrganizationName = span_company.value || 'dynamicscrm'
  const adoOrganizationUrl = `https://dev.azure.com/${adoOrganizationName}`
  const adoProjectName =
    document.getElementById('projectName').value || 'OneCRM'

  const iterationDropdown = document.getElementById('iterationDropdown')

  // Fetch Areas from Azure DevOps
  fetch(
    `${adoOrganizationUrl}/${adoProjectName}/_apis/wit/classificationNodes/Iterations`
  )
    .then((response) => response.json())
    .then((data) => {
      return fetchAndPopulateDropdown(
        data._links.self.href + '?$depth=1&api-version=6.0',
        iterationDropdown
      )
    })
    .catch((error) => console.error('Error fetching Areas or Children:', error))

  // Helper function to fetch and populate dropdown options
  function fetchAndPopulateDropdown(url, dropdown) {
    return fetch(url)
      .then((response) => response.json())
      .then((data) => {
        populateDropdown(dropdown, data.children)
      })
  }
}

function fetchAreaAndPopulateDropdown() {
  const adoOrganizationName = span_company.value || 'dynamicscrm'
  const adoOrganizationUrl = `https://dev.azure.com/${adoOrganizationName}`
  const adoProjectName =
    document.getElementById('projectName').value || 'OneCRM'

  const areaDropdown = document.getElementById('areaDropdown')

  // Fetch Areas from Azure DevOps
  fetch(
    `${adoOrganizationUrl}/${adoProjectName}/_apis/wit/classificationNodes/Areas`
  )
    .then((response) => response.json())
    .then((data) => {
      return fetchAndPopulateDropdown(
        data._links.self.href + '?$depth=1&api-version=6.0',
        areaDropdown
      )
    })
    .catch((error) => console.error('Error fetching Areas or Children:', error))

  // Helper function to fetch and populate dropdown options
  function fetchAndPopulateDropdown(url, dropdown) {
    return fetch(url)
      .then((response) => response.json())
      .then((data) => {
        populateDropdown(dropdown, data.children)
      })
  }
}

// Helper function to populate dropdown options
function populateDropdown(dropdown, options) {
  // Clear existing options
  dropdown.innerHTML = ''

  // Add default option
  const defaultOption = document.createElement('option')
  defaultOption.value = ''
  defaultOption.textContent = 'Select...'
  dropdown.appendChild(defaultOption)

  // Add options from the data
  options.forEach((option) => {
    const newOption = document.createElement('option')
    newOption.value = option.url
    newOption.textContent = option.path
    newOption.dataset.areaPath = option.name
    dropdown.appendChild(newOption)
  })
}

function createNewTab(url) {
  let tabProperties = {
    url: url,
  }

  if (form_newTab.checked) {
    chrome.tabs.create(tabProperties) // auto-focuses as of Chrome 33
  } else {
    chrome.tabs.getCurrent((tab) => chrome.tabs.update(tabProperties))
  }
}

function disableOnDOMContentLoad() {
  ado_search_button.disabled = true
  unify_search_button.disabled = true

  engMs_search_button.disabled = true
  get_ai_insights_button.disabled = true
  ado_create_work_item_button.disabled = true
  kusto_search_button.disabled = true
  
}

function setDisplayNoneOnDOMContentLoad() {
  select_work_item_area_dropdown.style.display = 'none'
  select_work_item_iteration_dropdown.style.display = 'none'
  insightsContent.style.display = 'none'
  createWorkItemContent.style.display = 'none'
  create_work_item_loader.style.display = 'none'
  
}

function setGlobalVariablesFromConfig() {
  select_work_item_area_dropdown.style.display="none"
  select_work_item_iteration_dropdown.style.display='none'
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

function executeOnDOMContentLoad() {
  setGlobalVariablesFromConfig()
  disableOnDOMContentLoad()
  setDisplayNoneOnDOMContentLoad()
}

document.addEventListener('DOMContentLoaded', function () {
  llamaOutput = ''
  executeOnDOMContentLoad()

  chrome.tabs.query({ active: true, currentWindow: true }).then((resp) => {
    const [tab] = resp
    try {
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => getSelection().toString(),
        })
        .then((resp) => {
          if (!resp || resp.length !== 0) {
            input_query_element.value = resp[0].result
            tabUrl = tab.url
            inputQueryOnChangeHandler()
          }
        })
      return
    } catch (e) {
      console.log(e)
      return
    }
  })
})
