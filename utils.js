/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import escodegen from "escodegen";
import escope from "escope";
import esprima from "esprima";
import estraverse from "estraverse";
import beautify from "js-beautify";
import phonetic from "phonetic";

const trivialStatements = new Set(["EmptyStatement", "BlockStatement", "ExpressionStatement", "ReturnStatement", "ThrowStatement"]);

const rewritePatterns = [
  [`!1`, `false`],
  [`!0`, `true`],
  [`void 0`, `undefined`],
  [`expression1 && expression2;`, `if (expression1) expression2;`],
  [`expression1 || expression2;`, `if (!expression1) expression2;`],
  [`expression1 ? expression2 : expression3;`, `if (expression1) expression2; else expression3;`],
  [`if (expression1) nonTrivialStatement1;`, `if (expression1) { nonTrivialStatement1; }`],
  [`while (expression1) nonTrivialStatement1;`, `while (expression1) { nonTrivialStatement1; }`],
  [`do nonTrivialStatement1; while (expression1);`, `do { nonTrivialStatement1; } while (expression1);`],
  [`for (expression1; expression2; expression3) nonTrivialStatement1;`, `for (expression1; expression2; expression3) { nonTrivialStatement1; }`],
  [`for (expression1 in expression2) nonTrivialStatement1;`, `for (expression1 in expression2) { nonTrivialStatement1; }`],
  [`for (expression1 of expression2) nonTrivialStatement1;`, `for (expression1 of expression2) { nonTrivialStatement1; }`],
  [`
    function placeholder1(placeholder2)
    {
      return placeholder2 && placeholder2.__esModule
        ? placeholder2
        : { default: placeholder2 };
    }
  `, `
    function _interopRequireDefault(obj)
    {
      return obj && obj.__esModule
        ? obj
        : { default: obj };
    }
  `]
].map(([pattern, replacement]) => [compilePattern(pattern), compilePattern(replacement)]);

function compilePattern(code)
{
  let pattern = esprima.parse(code);
  if (pattern.type == "Program" && pattern.body.length == 1)
    pattern = pattern.body[0];
  if (pattern.type == "ExpressionStatement" && !/;\s*$/.test(code))
    pattern = pattern.expression;
  return pattern;
}

function matchesPattern(node, pattern, placeholders = {})
{
  if (pattern.type == "Identifier" && /^expression\d+$/.test(pattern.name))
  {
    if (node && node.type != "VariableDeclaration" && !/Expression$/.test(node.type))
      return null;
    placeholders[pattern.name] = node;
    return placeholders;
  }
  else if (pattern.type == "ExpressionStatement" && pattern.expression.type == "Identifier" && /^nonTrivialStatement\d+$/.test(pattern.expression.name))
  {
    if (trivialStatements.has(node.type))
      return null;
    placeholders[pattern.name] = node;
    return placeholders;
  }

  for (let key of Object.keys(pattern))
  {
    if (!node.hasOwnProperty(key) || typeof pattern[key] != typeof node[key])
      return null;
    if (pattern[key] && typeof pattern[key] == "object")
    {
      if (Array.isArray(pattern[key]))
      {
        if (pattern[key].length != node[key].length)
          return null;
        for (let i = 0; i < pattern[key].length; i++)
          if (!matchesPattern(node[key][i], pattern[key][i], placeholders))
            return null;
      }
      else if (!matchesPattern(node[key], pattern[key], placeholders))
        return null;
    }
    else if (typeof pattern[key] == "string" && /^placeholder\d+$/.test(pattern[key]))
    {
      if (placeholders.hasOwnProperty(pattern[key]) && placeholders[pattern[key]] != node[key])
        return null;
      placeholders[pattern[key]] = node[key];
    }
    else if (pattern[key] != node[key])
      return null;
  }
  return placeholders;
}

function fillPattern(pattern, placeholders)
{
  if (pattern.type == "Identifier" && /^expression\d+$/.test(pattern.name))
    return placeholders[pattern.name];
  else if (pattern.type == "ExpressionStatement" && pattern.expression.type == "Identifier" && /^nonTrivialStatement\d+$/.test(pattern.expression.name))
    return placeholders[pattern.name];

  let result = {};
  for (let key of Object.keys(pattern))
  {
    if (pattern[key] && typeof pattern[key] == "object")
    {
      if (Array.isArray(pattern[key]))
      {
        result[key] = [];
        for (let item of pattern[key])
          result[key].push(fillPattern(item, placeholders));
      }
      else
        result[key] = fillPattern(pattern[key], placeholders);
    }
    else if (typeof pattern[key] == "string" && /^placeholder\d+$/.test(pattern[key]))
      result[key] = placeholders[pattern[key]];
    else
      result[key] = pattern[key];
  }
  return result;
}

function beautifyVariable(variable, names)
{
  if (variable.keepName)
    return;

  let options = {
    seed: "_seed" in names ? names._seed + 1 : 0,
    syllables: "_syllables" in names ? names._syllables : 2,
    capFirst: false
  };

  let name;
  do
  {
    name = phonetic.generate(options);
    if (names.has(name))
      options.syllables++;
  } while (names.has(name));

  renameVariable(variable, name);

  names._seed = options.seed;
  names._syllables = options.syllables;
  names.add(name);
}

function beautifyScope(scope, names=new Set())
{
  for (let variable of scope.variables)
    beautifyVariable(variable, names);

  for (let child of scope.childScopes)
    beautifyScope(child, names);
}

function ensureParentDirExists(filepath)
{
  let dir = path.dirname(filepath);
  if (!dir || dir == ".")
    return;

  ensureParentDirExists(dir);
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir);
}

function ensureWrapping(node, prop)
{
  if (!node[prop])
    return;

  if (!trivialStatements.has(node[prop].type))
  {
    node[prop] = {
      type: "BlockStatement",
      body: [node[prop]]
    };
  }
}

export function renameVariable(variable, newName)
{
  variable.keepName = true;
  for (let identifier of variable.identifiers)
    identifier.name = newName;
  for (let reference of variable.references)
    reference.identifier.name = newName;

  // Functions called before declaration will not be listed under variable.references
  for (let reference of variable.scope.references)
    if (reference.identifier.name == variable.name)
      reference.identifier.name = newName;

  variable.name = newName;
}

export function beautifyVariables(ast, scope=escope.analyze(ast).acquire(ast))
{
  beautifyScope(scope);
}

export function rewriteCode(ast)
{
  let scopeManager = escope.analyze(ast);

  estraverse.replace(ast, {
    enter(node)
    {
      if (node.type == "ExpressionStatement" && node.expression.type == "SequenceExpression")
      {
        // a, b, c => a; b; c;
        return {
          type: "Program",
          body: node.expression.expressions.map(expression =>
          {
            return {
              type: "ExpressionStatement",
              expression
            }
          })
        };
      }
      else
      {
        for (let [pattern, replacement] of rewritePatterns)
        {
          let placeholders = matchesPattern(node, pattern);
          if (!placeholders)
            continue;

          let result = fillPattern(replacement, placeholders);
          if (node.type == "FunctionDeclaration" && result.type == "FunctionDeclaration")
          {
            let scope = scopeManager.acquire(node).upper;
            let variable = scope.set.get(node.id.name);
            let newName = result.id.name;
            let i = 1;
            while (scope.set.has(newName))
              newName = result.id.name + i;
            result.id.name = newName;
            renameVariable(variable, newName);
          }
          return result;
        }
      }
    },
    leave(node, parent)
    {
      if (node.type == "Program" && parent.type != "BlockStatement" && parent.type != "Program")
        node.type = "BlockStatement";
      if (node.type == "BlockStatement" || node.type == "Program")
      {
        for (let i = 0; i < node.body.length; i++)
        {
          if (node.body[i].type == "Program")
          {
            node.body.splice(i, 1, ...node.body[i].body);
            i--;
          }
        }
      }
    }
  });
}

export function readScript(filepath)
{
  let contents = fs.readFileSync(filepath, {encoding: "utf-8"});
  return esprima.parse(contents);
}

export function saveScript(ast, filepath)
{
  let code = escodegen.generate(ast, {
    format: {
      quotes: "double"
    },
    comment: true
  });
  code = beautify.js(code, {
    indent_size: 2,
    brace_style: "expand,preserve-inline"
  });

  ensureParentDirExists(filepath);
  fs.writeFileSync(filepath, code, {encoding: "utf-8"});
}
