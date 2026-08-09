import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function resolveGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'n/a'
  }
}

const gitCommit = resolveGitCommit()

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit),
  },
})

