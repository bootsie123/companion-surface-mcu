import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
	typescriptRules: {
		'no-control-regex': 'off',
		'@typescript-eslint/no-duplicate-enum-values': 'off',
	},
})
