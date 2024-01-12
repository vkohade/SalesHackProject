export function generateInsightsHTML(data) {
  let html = '<p>Following work items can be created :-</p>'
  html += '<table>'

  html += '<tr>'
  html += '<th>Title</th>'
  html += '<th>Description</th>'
  html += '<th>Type</th>'
  html += '</tr>'

  // Loop through each item in the insights data
  data.forEach((item) => {
    html += '<tr>'
    html += `<td><strong>${item.title_of_item}</strong></td>`
    html += `<td>${item.description_of_item}</td>`
    html += `<td>${item.type_of_item}</td>`
    html += '</tr>'
  })

  html += '</table>'

  return html
}

// Function to show the loader
export function showLoader(id) {
  document.getElementById(id).style.display = 'block'
}

// Function to hide the loader
export function hideLoader(id) {
  document.getElementById(id).style.display = 'none'
}

export async function showCreatedWorkItems(adoBaseUrl, createdWorkItems) {
  let container = document.getElementById('create-work-item-results')

  container.innerHTML = ''

   let message = document.createElement('p')
   message.textContent = 'Below are your created work items :-'
   container.appendChild(message)

  let list = document.createElement('ul')
  createdWorkItems.forEach((workItem) => {
    let listItem = document.createElement('li')
    listItem.style.paddingBottom = '8px'
    let link = document.createElement('a')
    link.href = `${adoBaseUrl}/_workitems/edit/${workItem.id}`
    link.textContent = `${workItem.type}: ${workItem.title}`

    listItem.appendChild(link)
    list.appendChild(listItem)
   
  })
   list.style.marginTop = '12px'
   container.appendChild(list)
}