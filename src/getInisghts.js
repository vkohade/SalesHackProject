export async function askLlama2(promptDictionary, inputText) {
  const llmCall = fetch('https://www.llama2.ai/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: `<s>[INST] <<SYS>>\n${promptDictionary.userPrePrompt}\n<</SYS>>\n\n${inputText}[/INST]\n`,
      model: 'meta/llama-2-70b-chat',
      systemPrompt: `${promptDictionary.systemPrompt}`,
      temperature: 0.75,
      topP: 0.9,
      maxTokens: 800,
      image: null,
      audio: null,
    }),
  })

  const response = await llmCall
  if (response.ok) {
    const text = await response.text()
    if (text.includes('<result>')) {
      let jsonOutput = text.split('<result>')[1].split('</result>')[0]
      return jsonOutput
    } else {
      return text
    }
  }
}

export function getPromptFromIntent(intent) {
  switch (intent) {
    case 'specReview':
      return {
        systemPrompt:
          'You are a JSON document generator assisting a product manager to create user stories and tasks from the spec review document',
        userPrePrompt:
          "Generate a JSON document from the input text representing an array of work items as user stories and tasks. Every item in the JSON array should have the following structure: 'unique_key' representing a unique number; 'title_of_item' having a string value respresenting a very short title for the work item; 'description_of_item' having a string value respresenting description of the work item; 'type_of_item' having a string value which can be either 'userstory' or 'task'; 'parent_item_unique_key' for linking tasks to a user story. Give parentId as -1 to user stories. The generated JSON should conform to this structure. Do not include any additional or invalid keys. Surround your JSON output with <result></result> tags.",
      }
    case 'debug':
      return {
        systemPrompt:
          'You are an AI code and code error assistant that explains code and error messages and exceptions.',
        userPrePrompt:
          'Help me understand this text which is either an error or a code snippet. If the message is an error use the context of Dynamics 365, explain the error message and provide ways to resolve it. If the message is a code snippet, then explain the code. Be concise and straightforward in your answer. ',
      }
    case 'unknown':
      return {
        systemPrompt:
          'You are an AI code and code error assistant that explains code and error messages and exceptions.',
        userPrePrompt:
          'Help me understand this text which is either an error or a code snippet.explain the error message and provide ways to resolve it.Auto detect the category and explain the details of this text. Be concise and straightforward in your answer.',
      }
    default:
      return {}
  }
}

export function getIntentFromTextAndUrl(selectedText, tabUrl) {
  let intent = 'unknown'
  if (tabUrl.includes('.pdf') || tabUrl.includes('.docx')) {
    intent = 'specReview'
  } else if (tabUrl.includes('portal.microsofticm.com')) {
    intent = 'debug'
  }

  return intent
}
