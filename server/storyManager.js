import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STORIES_FILE = path.join(__dirname, 'data', 'stories.json')

export function loadStories() {
  try {
    if (fs.existsSync(STORIES_FILE)) {
      const data = fs.readFileSync(STORIES_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Stories load error:', error)
  }
  return { stories: [] }
}

export function saveStories(storiesData) {
  try {
    fs.writeFileSync(STORIES_FILE, JSON.stringify(storiesData, null, 2), 'utf8')
  } catch (error) {
    console.error('Stories save error:', error)
    throw error
  }
}

export function getAllStories() {
  const data = loadStories()
  return data.stories || []
}

export function getStoryById(id) {
  const stories = getAllStories()
  return stories.find(story => story.id === id) || null
}

export function createStory(storyData) {
  const data = loadStories()

  const newStory = {
    id: `story-${Date.now()}`,
    title: storyData.title,
    level: storyData.level,
    text: storyData.text,
    createdAt: new Date().toISOString()
  }

  data.stories.push(newStory)
  saveStories(data)

  return newStory
}

export function updateStory(id, storyData) {
  const data = loadStories()
  const index = data.stories.findIndex(story => story.id === id)

  if (index === -1) {
    return null
  }

  data.stories[index] = {
    ...data.stories[index],
    title: storyData.title,
    level: storyData.level,
    text: storyData.text
  }

  saveStories(data)
  return data.stories[index]
}

export function deleteStory(id) {
  const data = loadStories()
  const index = data.stories.findIndex(story => story.id === id)

  if (index === -1) {
    return false
  }

  data.stories.splice(index, 1)
  saveStories(data)

  return true
}
