import { devvit } from '@devvit/start/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        svelte({ configFile: 'src/client/svelte.config.ts' }),
        tailwindcss(),
        devvit()
    ]
})
