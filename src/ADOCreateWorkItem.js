export async function createParentUserStoryAndChildTask(
  adoBaseUrl,
  cookieString,
  promptData,
  selectedAreaPath,
  selectedIterationPath
) {
  const uniqueWorkItemNameToWorkItemId = {}
  let createdWorkItems = []
  for (const data of promptData) {
    // Create the user story - Parent and extract work item id
    if (data.type_of_item == 'userstory') {
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
        {
          op: 'add',
          path: '/fields/System.AreaPath',
          from: null,
          value: selectedAreaPath,
        },
        {
          op: 'add',
          path: '/fields/System.IterationPath',
          from: null,
          value: selectedIterationPath,
        },
      ]

      const userStoryResponse = await makeAuthenticatedRequest(
        adoBaseUrl,
        cookieString,
        userStoryPayload,
        'User%20Story'
      )

      uniqueWorkItemNameToWorkItemId[data.unique_key] = userStoryResponse.id

      await updateAssignedTo(adoBaseUrl, cookieString, userStoryResponse.id)
      
      createdWorkItems.push({
        id: userStoryResponse.id,
        title: data.title_of_item,
        type: 'userstory',
      })
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
            path: '/fields/System.AreaPath',
            from: null,
            value: selectedAreaPath,
          },
          {
            op: 'add',
            path: '/fields/System.IterationPath',
            from: null,
            value: selectedIterationPath,
          },
          {
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: adoBaseUrl + `/${parentUserStoryId}`,
              attributes: {
                comment: 'Parent',
              },
            },
          },
        ]
        const taskResponse = await makeAuthenticatedRequest(
          adoBaseUrl,
          cookieString,
          taskPayload,
          'Task'
        )

        await updateAssignedTo(adoBaseUrl, cookieString, taskResponse.id)

        createdWorkItems.push({
          id: taskResponse.id,
          title: data.title_of_item,
          type: 'task',
        })

       
      }
      
    }
    
  }
  return createdWorkItems
}

async function updateAssignedTo(adoBaseUrl, cookieString, workItemId) {
  const fullADOUrl =
    adoBaseUrl + `/_apis/wit/workitems/${workItemId}?api-version=6.0`

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

async function makeAuthenticatedRequest(
  adoBaseUrl,
  cookieString,
  workItemPayload,
  type
) {
  const fullADOUrl =
    adoBaseUrl + '/_apis/wit/workitems/$' + type + '?api-version=6.0'

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
