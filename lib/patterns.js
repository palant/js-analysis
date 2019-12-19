/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import esprima from "esprima";
import estraverse from "estraverse";
import assert from "assert";

const singleLineStatements = new Set(["EmptyStatement", "BlockStatement", "ExpressionStatement", "ReturnStatement", "ThrowStatement"]);

class GenericPlaceholder
{
  constructor(name)
  {
    this.type = "GenericPlaceholder";
    this.name = name;
  }

  matches(node)
  {
    return typeof node == "string";
  }
}

class StatementPlaceholder
{
  constructor(name)
  {
    this.type = "StatementPlaceholder";
    this.name = name;
    this.optional = false;
    this.repeatable = false;
    this.expectMultiLine = false;
    this.allowStatements = true;
    this.allowClassDeclarations = true;
    this.allowFunctionDeclarations = true;
    this.allowVariableDeclarations = true;
  }

  modifier(name)
  {
    if (name == "optional")
      this.optional = true;
    else if (name == "repeatable")
      this.repeatable = true;
    else if (name == "multiLine")
      this.expectMultiLine = true;
    else if (name == "strict")
    {
      this.allowStatements = true;
      this.allowClassDeclarations = this.allowFunctionDeclarations = this.allowVariableDeclarations = false;
    }
    else if (name == "declaration")
    {
      this.allowStatements = false;
      this.allowClassDeclarations = this.allowFunctionDeclarations = this.allowVariableDeclarations = true;
    }
    else if (name == "classDeclaration")
    {
      this.allowStatements = this.allowFunctionDeclarations = this.allowVariableDeclarations = false;
      this.allowClassDeclarations = true;
    }
    else if (name == "functionDeclaration")
    {
      this.allowStatements = this.allowClassDeclarations = this.allowVariableDeclarations = false;
      this.allowFunctionDeclarations = true;
    }
    else if (name == "variableDeclaration")
    {
      this.allowStatements = this.allowClassDeclarations = this.allowFunctionDeclarations = false;
      this.allowVariableDeclarations = true;
    }
    else
      throw new Error(`Unknown statement modifier ${name}`);
  }

  matches(node)
  {
    if (!node)
      return this.optional;
    if (!(this.allowStatements && (/Statement$/.test(node.type) || node.type == "Directive")) &&
        !(this.allowClassDeclarations && node.type == "ClassDeclaration") &&
        !(this.allowFunctionDeclarations && node.type == "FunctionDeclaration") &&
        !(this.allowVariableDeclarations && node.type == "VariableDeclaration"))
      return false;
    if (this.expectMultiLine && singleLineStatements.has(node.type))
      return false;
    return true;
  }
}

class ExpressionPlaceholder
{
  constructor(name)
  {
    this.type = "ExpressionPlaceholder";
    this.name = name;
    this.optional = false;
    this.repeatable = false;
    this.allowExpressions = true;
    this.allowIdentifiers = true;
    this.allowLiterals = true;
    this.allowDeclarations = false;
  }

  modifier(name)
  {
    if (name == "optional")
      this.optional = true;
    else if (name == "repeatable")
      this.repeatable = true;
    else if (name == "strict")
    {
      this.allowIdentifiers = this.allowLiterals = false;
      this.allowExpressions = true;
    }
    else if (name == "identifier")
    {
      this.allowExpressions = this.allowLiterals = false;
      this.allowIdentifiers = true;
    }
    else if (name == "literal")
    {
      this.allowExpressions = this.allowIdentifiers = false;
      this.allowLiterals = true;
    }
    else if (name == "orDeclaration")
      this.allowDeclarations = true;
    else
      throw new Error(`Unknown expression modifier ${name}`);
  }

  matches(node)
  {
    if (!node)
      return this.optional;
    return (this.allowExpressions && (/Expression$/.test(node.type) || node.type == "VariableDeclarator")) ||
           (this.allowIdentifiers && node.type == "Identifier") ||
           (this.allowLiterals && node.type == "Literal") ||
           (this.allowDeclarations && node.type == "VariableDeclaration");
  }
}

function isDeepEqual(val1, val2)
{
  try
  {
    assert.deepStrictEqual(val1, val2);
    return true;
  }
  catch (e)
  {
    return false;
  }
}

export function compile(code)
{
  let pattern = esprima.parse(code, {tolerant: true});
  delete pattern.errors;
  estraverse.replace(pattern, {
    leave(node)
    {
      if (node.type == "Identifier")
      {
        let match = /^((expression|statement)\d+)(?:_(\w+))?$/.exec(node.name);
        if (match)
        {
          let result = new (match[2] == "expression" ? ExpressionPlaceholder : StatementPlaceholder)(match[1]);
          if (match[3])
            for (let modifier of match[3].split("_"))
              result.modifier(modifier);
          return result;
        }
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "StatementPlaceholder")
        return node.expression;
      else if (node.type == "VariableDeclarator" && node.id.type == "ExpressionPlaceholder")
        return node.id;

      for (let key of Object.keys(node))
      {
        if (/^placeholder\d+$/.test(node[key]))
          node[key] = new GenericPlaceholder(node[key]);
      }
      return undefined;
    }
  });
  if (pattern.type == "Program" && pattern.body.length == 1)
    pattern = pattern.body[0];
  if (pattern.type == "ExpressionStatement" && !/;\s*$/.test(code))
    pattern = pattern.expression;
  return pattern;
}

export function matches(pattern, node, placeholders = {})
{
  if (typeof pattern == "string")
    pattern = compile(pattern);

  if (typeof pattern.matches == "function")
  {
    if (!pattern.matches(node))
      return null;
    if (placeholders.hasOwnProperty(pattern.name) && !isDeepEqual(placeholders[pattern.name], node))
      return null;
    placeholders[pattern.name] = node;
    return placeholders;
  }

  if (!node)
    return null;

  for (let key of Object.keys(pattern))
  {
    // Literals are matched by value, ignore raw which might be out of sync
    if (key == "raw" && pattern.type == "Literal")
      continue;

    if (Array.isArray(pattern[key]) && Array.isArray(node[key]))
    {
      let j = 0;
      for (let i = 0; i < pattern[key].length; i++, j++)
      {
        let currentPattern = pattern[key][i];
        if (currentPattern.repeatable)
        {
          let matches = [];
          while (j < node[key].length && currentPattern.matches(node[key][j]))
            matches.push(node[key][j++]);
          j--;

          if (matches.length == 0 && !currentPattern.optional)
            return null;

          if (placeholders.hasOwnProperty(currentPattern.name) && !isDeepEqual(placeholders[currentPattern.name], matches))
            return null;
          placeholders[currentPattern.name] = matches;
        }
        else if (!matches(pattern[key][i], node[key][j], placeholders))
          return null;
      }
      if (j != node[key].length)
        return null;
    }
    else if (pattern[key] && typeof pattern[key] == "object")
    {
      if (!matches(pattern[key], node[key], placeholders))
        return null;
    }
    else if (pattern[key] != node[key])
      return null;
  }
  return placeholders;
}

export function fill(pattern, placeholders)
{
  if (typeof pattern == "string")
    pattern = compile(pattern);

  if (typeof pattern.matches == "function")
  {
    if (!placeholders.hasOwnProperty(pattern.name))
      throw new Error(`No value given for placeholder ${pattern.name}`);
    return placeholders[pattern.name];
  }

  let result = {};
  for (let key of Object.keys(pattern))
  {
    if (Array.isArray(pattern[key]))
    {
      result[key] = [];
      for (let item of pattern[key])
      {
        let newItem = fill(item, placeholders);
        if (Array.isArray(newItem))
          result[key].push(...newItem);
        else
          result[key].push(newItem);
      }
    }
    else if (pattern[key] && typeof pattern[key] == "object")
    {
      result[key] = fill(pattern[key], placeholders);
    }
    else
      result[key] = pattern[key];
  }

  return result;
}
