import { mount } from 'svelte'
import '../app.css'
import App from '../App.svelte'
import { DIFFICULTY_STORAGE_KEY, parseDifficulty } from '../lib/constants'

const getStoredDifficulty = (): string | null => {
    try {
        return localStorage.getItem(DIFFICULTY_STORAGE_KEY)
    } catch {
        return null
    }
}

const difficulty = parseDifficulty(getStoredDifficulty())

const appElement = document.getElementById('app')
if (!appElement) throw new Error('App element not found')

mount(App, { target: appElement, props: { difficulty } })
