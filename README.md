# JS Analysis

**Warning**: This is a repository with quick-and-dirty code analysis tools which I use for my own research. The documentation is limited and support cannot be provided. Use at your own risk!

At least NodeJS 13 is required to run these scripts. Run `npm install` in this directory to install required dependencies.

## beautify.js

This tool will replace JavaScript files by well-formatted versions. It will also give every variable a unique name and undo a number of code modifications typically performed by code minifiers.

## unwebpack.js

This tool can unpack some types of Webpack bundles, placing individual JavaScript modules into a directory. The modules will be beautified the way `beautify.js` would do it.

## Code rewriting approach

These tools use [esprima](https://esprima.org/) to parse JavaScript into an Abstract Syntax Tree (AST). That tree is then modified based on various patterns and saved back as JavaScript code. Pattern processing functionality is implemented in `lib/patterns.js` library, the actual patterns applied can be found in `lib/rewriteCode.js`.

A pattern is a piece of valid JavaScript code. It can contain a number of placeholders that will be considered when the pattern is matched against the AST or used to generate a new AST segment. Placeholders with the same name a required to have the same value for the pattern to match, placeholders with different names can have different values.

### Patterns API

#### patterns.compile(code)

Pre-compiles a JavaScript pattern string into a pattern object that can be used with other API functions. This is recommended for performance reasons if a pattern is used multiple times.

#### patterns.matches(pattern, astNode)

Tests whether the given AST segment matches the pattern (specified as a string or a pre-compiled pattern object). If a match is found, returns an object mapping placeholder names to their values. Otherwise returns `null`.

#### patterns.fill(pattern, placeholders)

Generates an AST segment based on the pattern (specified as a string or a pre-compiled pattern object). The placeholders in the pattern are replaced by their values from the passed object ().

### Pattern syntax

#### Statement vs. expression vs. program patterns

A pattern containing a single JavaScript statement can be interpreted as either a statement or an expression pattern. The former will only match as a complete statement whereas the latter will also match expressions within a larger compound statement. `patterns.compile()` will interpret patterns terminated by a semicolon `;` as statement patterns, otherwise it will produce an expression pattern.

For example, the pattern `placeholder1 + placeholder2;` will match in the program `x + y;` but not `(x + y) * 2;` or `console.log(x + y);`. On the other hand, the pattern `placeholder1 + placeholder2` will find matches in all three programs.

Patterns consisting of multiple statements like `statement1; statement2;` compile into program patterns. These will typically only match at the top level of an AST tree, meaning that the program `var x = 1, y = 2; x += y;` will be a match, but `function test() { var x = 1, y = 2; return x + y; }` won't be.

#### Generic placeholders

Generic placeholders are very flexible, matching any string in the AST. In particular, they can used to denote function and variable names, or even string literal values. `placeholderNNN`, where `NNN` is some number, is considered a generic placeholder. An example pattern:

    function placeholder1(placeholder2)
    {
      if (placeholder2 <= 1)
        return 1;
      else
        return placeholder2 * placeholder1(placeholder2 - 1);
    }

This pattern will match the following function for example:

    function factorial(n)
    {
      if (n <= 1)
        return 1;
      else
        return n * factorial(n - 1);
    }

Calling `patterns.matches()` here will result in `{placeholder1: "factorial", placeholder2: "n"}` being returned.

#### Statement placeholders

Statement placeholders stand for a statement which by default also includes variable, function and class declarations. `statementNNN`, where `NNN` is some number, is considered to be a statement placeholder. An example pattern:

    if (x > 0)
      statement1;
    else
      statement2;

This pattern will match the following code for example:

    if (x > 0)
      return x;
    else
    {
      let y = getFallback(x);
      return y;
    }

Calling `patterns.matches()` here will result in `{statement1: [ReturnStatement], statement2: [BlockStatement]}` being returned.

#### Expression placeholders

Expression placeholders stand for an expression which by default also includes variable identifiers and literals. `expressionNNN`, where `NNN` is some number, is considered to be a expression placeholder. An example pattern:

    if (expression1 > 0)
      return expression1 + expression2;

This pattern will match the following code for example:

    if (x > 0)
      return x + Math.sqrt(x);

Calling `patterns.matches()` here will result in `{statement1: [Identifier], statement2: [CallExpression]}` being returned.

#### Placeholder modifiers

The behavior of statement and expression placeholders can be altered via a number of modifiers. For example, the pattern `statement1;` will match both statements and declarations (default behavior), yet `statement1.strict;` will only match statements.

*Note*: In some circumstances this syntax is invalid, e.g. in variable declarations. Alternatively, an underscore `_` can be used instead of the dot `.` to separate modifiers from the placeholder name, e.g. `statement1_strict_optional`.

The available modifiers are:

* `.optional` (*statements*, *expressions*): Allow `null` as placeholder value. This can be used for example with statement placeholders for example to denote that an `else` clause is optional or with expression placeholders to denote that a `return` statement doesn't have to return a value.
* `.repeatable` (*statements*, *expressions*): Allow the statement or expression placeholder to consume multiple entries of an array, e.g. for statements in a function body or expressions in a sequence operator. The result for the placeholder will be an array of values. When combined with `.optional` modifier, the result might also be an empty array, meaning that none of the statements/expressions could be consumed.
* `.strict` (*statements*, *expressions*): Enables strict matching. For statements this means that only statements and no declarations will be allowed. For expressions this means that only expressions and no identifiers or literals will be allowed.
* `.declaration` (*statements*): Allow only function, variable and class declarations but no statements.
* `.functionDeclaration` (*statements*): Allow only function declarations.
* `.variableDeclaration` (*statements*): Allow only variable declarations.
* `.classDeclaration` (*statements*): Allow only class declarations.
* `.multiLine` (*statements*): Allow only statements that would normally be written on multiple lines, e.g. an `if` statement or a function declaration.
* `.identifier` (*expressions*): Allow only identifiers.
* `.literal` (*expressions*): Allow only literals.
* `.orDeclaration` (*expressions*): Allow the expression to match variable declarations in addition to the expressions this placeholder would normally match. This is useful when matching `for` loops as the loop variable can be either an identifier or a variable declaration.
