// ioBroker eslint configuration for js and ts files
import config from '@iobroker/eslint-config';
import pluginUnicorn from 'eslint-plugin-unicorn';

export default [
    ...config,
    {
        ignores: [
            '.dev-server/',
            '.vscode/',
            '*.test.js',
            'test/**/*.js',
            '*.config.mjs',
            'build',
            'admin/words.js',
            'admin/admin.d.ts',
            'admin/blockly.js',
            '**/adapter-config.d.ts',
            'tasks.ts',
            'admin',
            'src-admin',
            'src-www',
            'www',
            'agent',
        ],
    },
    {
        plugins: { unicorn: pluginUnicorn },
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/no-types': 'off',
            'require-await': 'off',
            '@typescript-eslint/require-await': 'off',
            'no-unused-vars': 'off',
            'unicorn/numeric-separators-style': [
                'warn',
                {
                    number: { minimumDigits: 5, groupLength: 3 },
                    hexadecimal: { minimumDigits: 0, groupLength: 2 },
                    binary: { minimumDigits: 0, groupLength: 4 },
                    octal: { minimumDigits: 0, groupLength: 3 },
                },
            ],
        },
    },
];
