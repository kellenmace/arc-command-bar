# Overview

- Use snake_case for all variables, functions, methods, and properties.
- Name all classes using PascalCase (e.g. `class BlogPost {}`).
- Use hyphens between words in multi-word filenames (e.g. `magic-link.js`).
- Prefer function definitions over function expressions.
- Organize code using a top-down function call chain: define higher-level functions first, followed by the lower-level helper functions they call.
- Do not use JSDoc to document the functions you create or modify. If the purpose of a function can be easily understood by reading the code, then there is no need to add documentation. If the purpose of a function cannot be easily understood by reading the code, then add documentation using a few lines of inline comments (`//` syntax).
- Instead of `Array.from(arrayLike)`, use `[...arrayLike]` spread syntax.
- Do not declare multiple variables on the same line.
- Prefer whole words in variable and property names such as `response` rather than `res`.
- Only create classes when multiple instances of the class need to be created or there is another compelling reason to do so. Otherwise, prefer using simple functions.
- Use Boolean(value) instead of !!value when converting expressions to booleans for clarity and readability.
- Use async/await instead of Promises.

# Resources

You can use the Chrome DevTools MCP to evaluate and test the extension's appearance and functionality.
You can use the Context7 MCP to look up technical documentation, as needed.
