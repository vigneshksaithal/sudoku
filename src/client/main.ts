import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const appElement = document.getElementById('app')
if (!appElement) {
  throw new Error('App element not found')
}

export const app = mount(App, {
  target: appElement
})