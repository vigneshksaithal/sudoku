import { mount } from 'svelte'
import '../app.css'
import App from '../App.svelte'
import { DIFFICULTY_STORAGE_KEY, parseDifficulty } from '../lib/constants'

const difficulty = parseDifficulty(localStorage.getItem(DIFFICULTY_STORAGE_KEY))

const appElement = document.getElementById('app')
if (!appElement) throw new Error('App element not found')

mount(App, { target: appElement, props: { difficulty } })
