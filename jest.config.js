module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/nodes', '<rootDir>/tests'],
	testMatch: [
		'**/__tests__/**/*.ts',
		'**/?(*.)+(spec|test).ts'
	],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	collectCoverageFrom: [
		'nodes/**/*.ts',
		'!nodes/**/*.d.ts',
		'!nodes/**/index.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: [
		'text',
		'lcov',
		'html'
	],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/nodes/$1',
	},
	testTimeout: 30000,
	verbose: true,
}; 