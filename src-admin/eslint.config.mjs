import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: ['.__mf__temp/', 'admin/', '**/*.test.js', 'test/**/*.js', '*.config.mjs', 'build/'],
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-returns-description': 'off',
            'jsdoc/require-returns-check': 'off',
        },
    },
];
