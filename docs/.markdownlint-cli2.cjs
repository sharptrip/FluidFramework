/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

const { forEachLine, getLineMetadata } = require("markdownlint-rule-helpers");

const excludedTypography = [
    ["’", "'"],
    ["“", "\""],
    ["”", "\""],
    ["–", "-"],
];

const excludedWords = [
    "Azure Fluid Relay server",
    "Azure Fluid Relay Service",
    "Azure Relay Service",
    "FRS",
    "`Tinylicious`",
]

const clamp = (number, min, max) => {
    return Math.max(min, Math.min(number, max));
};

const extractContext = (line, column) => {
    const contextPadding = 10;
    return line.substr(clamp(column - contextPadding, 0, line.length - 1), contextPadding * 2);
}

module.exports = {
    "globs": [
        "**/*.md",
        "!content/docs/apis",
        "!_includes",
        "!node_modules",
    ],
    "customRules": [
        // "markdownlint-rule-emphasis-style",
        "markdownlint-rule-github-internal-links",
        {
            "names": ["ban-words"],
            "description": "Using a banned word",
            "tags": ["style"],
            "function": (params, onError) => {
                forEachLine(getLineMetadata(params), (line, lineIndex) => {
                    for (const word of excludedWords) {
                        const column = line.indexOf(word);
                        if (column >= 0) {
                            onError({
                                "lineNumber": lineIndex + 1,
                                "detail": `Found banned word "${word}" at column ${column}`,
                                "context": extractContext(line, column),
                                "range": [column + 1, 1],
                            });
                        }
                    }
                });
            }
        },
        {
            "names": ["proper-typography"],
            "description": "Using improper typography",
            "tags": ["style"],
            "function": (params, onError) => {
                forEachLine(getLineMetadata(params), (line, lineIndex) => {
                    for (const [character, replacement] of excludedTypography) {
                        const column = line.indexOf(character);
                        if (column >= 0) {
                            onError({
                                "lineNumber": lineIndex + 1,
                                "detail": `Found invalid character "${character}" at column ${column}`,
                                "context": extractContext(line, column),
                                "range": [column + 1, 1],
                                "fixInfo": {
                                    "lineNumber": lineIndex + 1,
                                    "editColumn": column + 1,
                                    "deleteCount": 1,
                                    "insertText": replacement,
                                },
                            });
                        }
                    }
                });
            }
        },
    ],
    "config": {
        // Tags (groups of rules) first
        "blank_lines": true, // MD012, MD022, MD031, MD032, MD047
        "blockquote": true, // MD027, MD028
        "bullet": true, // MD004, MD005, MD006, MD007, MD032
        "code": true, // MD014, MD031, MD038, MD040, MD046, MD048
        "emphasis": true, // MD036, MD037, MD049, MD050
        "hard-tab": true, // MD010
        "headings": true, // MD001, MD002, MD003, MD018, MD019, MD020, MD021, MD022, MD023, MD024, MD025, MD026, MD036, MD041, MD043
        "indentation": true, // MD005, MD006, MD007, MD027
        "links": true, // MD011, MD034, MD039, MD042
        "ol": true, // MD029, MD030, MD032
        "spaces": true, // MD018, MD019, MD020, MD021, MD023
        "ul": true, // MD004, MD005, MD006, MD007, MD030, MD032
        "whitespace": true, // MD009, MD010, MD012, MD027, MD028, MD030, MD037, MD038, MD039

        // Individual rules
        "first-heading-h1" : false, // MD002 - superseded by first-line-heading
        "first-line-heading": { // MD041
            "level": 1,
        },
        "github-internal-links": { // custom
            "verbose": false,
        },
        "hr-style": {
            "style": "---",
        },
        "line-length": false, // MD013
        "no-alt-text": true, // MD045
        "no-inline-html": false, //MD033
        "no-multiple-blanks": { // MD012
            "maximum": 2,
        },
        "proper-names": { // MD044
            "code_blocks": false,
            "names": [
                "Azure AD",
                "Azure Active Directory",
                "Azure Fluid Relay",
                "Fluid container",
                "Fluid containers",
                "Fluid Framework",
                "JavaScript",
                "JSON",
                "Microsoft",
                "npm",
                "Routerlicious",
                "Tinylicious",
                // Without the following entries, markdownlint incorrectly flags various correct usages of
                // microsoft/tinylicious.
                "@microsoft/",
                "tinylicious.md",
                "tinylicious-client",
            ]
        },
    }
};
