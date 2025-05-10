import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...compat.extends('@rocketseat/eslint-config/node'),
  {
    ignores: ['dist', 'node_modules'],
    rules: {
      camelcase: 'off'
    }
  },
]

export default eslintConfig
