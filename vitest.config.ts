import { defineConfig } from 'vitest/config'

const SVELTE_STUB_ID = '\0svelte-stub'

export default defineConfig({
    plugins: [
        {
            name: 'svelte-stub',
            enforce: 'pre' as const,
            resolveId(id: string) {
                if (id.endsWith('.svelte')) return SVELTE_STUB_ID
                return undefined
            },
            load(id: string) {
                if (id === SVELTE_STUB_ID) return 'export default {}'
                return undefined
            },
        },
    ],
    test: {
        include: ['src/**/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        pool: 'forks',
        testTimeout: 20000,
    },
})
