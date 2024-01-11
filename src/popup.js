import './popup.css'
import { promptData } from './data'

let span_company = document.getElementById('company')
let span_projectName = document.getElementById('projectName')
let ado_search = document.getElementById('search-in-ado')
let ado_create_work_item = document.getElementById('create-ado-work-item')
let unify_search = document.getElementById('search-in-unify')
let kusto_search = document.getElementById('query-in-kusto')
let form_newTab = document.getElementById('newTab')
let button_settings = document.getElementById('settings')
let input_query = document.getElementById('query')

let adoBaseUrl
let kustoBaseUrl
let unifyBaseUrl = 'https://unify.services.dynamics.com/CRM/Org'
let YOUR_API_KEY = ''

chrome.storage.sync.get(
  { adoSettings: {}, kustoSettings: {}, newTab: true, openAISettings: {} },
  function (items) {
    console.log(JSON.stringify(items))
    let companyName = items.adoSettings.company
    let projectName = items.adoSettings.project
    let clusterName = items.kustoSettings.cluster
    let databaseName = items.kustoSettings.database
    let tableName = items.kustoSettings.table
    // make sure they're both present
    if (
      !(companyName && companyName.length > 0) ||
      !(projectName && projectName.length > 0)
    ) {
      span_company.textContent = '[OPTIONS NOT SET]'
      ado_search.disabled = true
      ado_create_work_item = true
    }

    if (
      !(clusterName && clusterName.length > 0) ||
      !(databaseName && databaseName.length > 0) ||
      !(tableName && tableName.length > 0)
    ) {
      kusto_search.disabled = true
    }

    span_company.textContent = companyName
    span_projectName.textContent = projectName
    form_newTab.checked = items.newTab
    adoBaseUrl = `https://dev.azure.com/${companyName}/${projectName}`
    kustoBaseUrl = `https://dataexplorer.azure.com/clusters/${clusterName}}/databases/${databaseName}?query=`

    YOUR_API_KEY = items.openAISettings.apiKey
  }
)

// setup triggers
button_settings.onclick = function () {
  chrome.runtime.openOptionsPage()
}

ado_search.onclick = function () {
  let search = input_query.value

  let fullADOUrl = adoBaseUrl + `/_search?text=${search}&type=workitem`

  createNewTab(fullADOUrl)
}

async function createParentUserStoryAndChildTask(cookieString) {
  const uniqueWorkItemNameToWorkItemId = {}

  for (const data of promptData) {
    // Create the user story - Parent and extract work item id
    if (data.type_of_item == 'user story') {
      const userStoryPayload = [
        {
          op: 'add',
          path: '/fields/System.Title',
          from: null,
          value: data.title_of_item,
        },
        {
          op: 'add',
          path: '/fields/System.State',
          from: null,
          value: 'New',
        },
        {
          op: 'add',
          path: '/fields/System.Description',
          from: null,
          value: data.description_of_item,
        },
      ]

      const userStoryResponse = await makeAuthenticatedRequest(
        cookieString,
        userStoryPayload,
        'User%20Story'
      )

      uniqueWorkItemNameToWorkItemId[data.unique_key] = userStoryResponse.id
      await updateAssignedTo(cookieString,userStoryResponse.id)
    }
  }

  for (const data of promptData) {
    // Create the child task
    if (data.type_of_item === 'task' && data.parent_item_unique_key) {
      const parentUserStoryId =
        uniqueWorkItemNameToWorkItemId[data.parent_item_unique_key]

      if (parentUserStoryId) {
        // Create the task and link it to the parent user story
        const taskPayload = [
          {
            op: 'add',
            path: '/fields/System.Title',
            from: null,
            value: data.title_of_item,
          },
          {
            op: 'add',
            path: '/fields/System.State',
            from: null,
            value: 'New',
          },
          {
            op: 'add',
            path: '/fields/System.Description',
            from: null,
            value: data.description_of_item,
          },
          {
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: `https://dev.azure.com/dynamicscrm/OneCRM/${parentUserStoryId}`,
              attributes: {
                comment: 'Parent',
              },
            },
          },
        ]
        const taskResponse = await makeAuthenticatedRequest(
          cookieString,
          taskPayload,
          'Task'
        )

        await updateAssignedTo(cookieString,taskResponse.id)
      }
    }
  }
}

async function updateAssignedTo(cookieString, workItemId) {
  const fullADOUrl = `https://dev.azure.com/dynamicscrm/OneCRM/_apis/wit/workitems/${workItemId}?api-version=6.0`

  try {
    // Fetch the existing work item details
    const response = await fetch(fullADOUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieString,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const existingWorkItem = await response.json()

    const createdBy = existingWorkItem.fields['System.CreatedBy']

   
    existingWorkItem.fields['System.AssignedTo'] = createdBy

   
    const updatePayload = [
      {
        op: 'replace',
        path: '/fields/System.AssignedTo',
        value: createdBy,
      },
    ]

   
    const updateResponse = await fetch(fullADOUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json-patch+json',
        Cookie: cookieString,
      },
      body: JSON.stringify(updatePayload),
    })

    if (!updateResponse.ok) {
      throw new Error(`HTTP error! Status: ${updateResponse.status}`)
    }

    const updatedWorkItem = await updateResponse.json()
    console.log('Work item updated:', updatedWorkItem)

    return updatedWorkItem
  } catch (error) {
    console.error('Error updating work item:', error)
    throw error
  }
}

async function makeAuthenticatedRequest(cookieString, workItemPayload, type) {
  const fullADOUrl =
    'https://dev.azure.com/dynamicscrm/OneCRM/_apis/wit/workitems/$' +
    type +
    '?api-version=6.0'

  try {
    const response = await fetch(fullADOUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json',
        Cookie: cookieString,
      },
      body: JSON.stringify(workItemPayload),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()
    console.log('Work item created:', data)

    return data
  } catch (error) {
    console.error('Error creating work item:', error)
    throw error
  }
}

ado_create_work_item.onclick = async function () {
  try {
    console.log('chrome.cookies', chrome.cookies)
    const cookies = await chrome.cookies.getAll({
      url: 'https://dev.azure.com',
    })
    console.log('Cookies:', cookies)
    if (cookies && cookies.length > 0) {
      const cookieString = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ')
      createParentUserStoryAndChildTask(cookieString)
    } else {
      redirectToAzureDevOpsLogin()
    }
  } catch (error) {
    console.error('Error getting cookieString:', error)
  }
}

function redirectToAzureDevOpsLogin() {
  chrome.tabs.create({
    url: 'https://dev.azure.com/dynamicscrm',
  })
}

unify_search.onclick = function () {
  let search = input_query.value

  // Remove whitespace from search
  search = search.replace(/\s/g, '')

  createNewTab(`${unifyBaseUrl}/${search}`)
}

kusto_search.onclick = function () {
  let search = input_query.value

  // Remove whitespace from search
  search = search.replace(/\s/g, '')

  createNewTab(`${kustoBaseUrl}${search}`)
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }).then((resp) => {
    const [tab] = resp
    console.log(tab.url)
    if (tab.url.includes('chrome://')) {
      console.log('can`t run on start page')
      return
    }
    let result
    try {
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => getSelection().toString(),
        })
        .then((resp) => {
          ;[{ result }] = resp
          document.getElementById('query').value = result

          if (isSelectedTextGuid(result)) {
            unify_search.style.display = 'block'
            kusto_search.style.display = 'block'
          } else {
            unify_search.style.display = 'none'
            kusto_search.style.display = 'none'
          }
        })
      return
    } catch (e) {
      console.log(e)
      return
    }
  })
})

function isSelectedTextGuid(userSelection) {
  // Remove whitespaces from the selection first
  userSelection = userSelection.replace(/\s/g, '')

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    userSelection
  )
}

function askGPT() {
  const gptCall = fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${YOUR_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt:
        'I am a highly intelligent question answering bot. If you ask me a  Spain.\n\nQ: How many squigs are in a bonk?\nA: Unknown\n\nQ: Where is the Valley of Kings?\nA:',
      temperature: 0,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stop: ['\n'],
    }),
  })

  gptCall.then((response) => {
    console.log(response)
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
