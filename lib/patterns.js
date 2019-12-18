/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import esprima from "esprima";
import estraverse from "estraverse";

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
    this.expectMultiLine = false;
  }

  modifier(name)
  {
    if (name == "multiLine")
      this.expectMultiLine = true;
    else
      throw new Error(`Unknown statement modifier ${name}`);
  }

  matches(node)
  {
    if (!node)
      return false;
    if (!/Statement$/.test(node.type) && node.type != "VariableDeclaration")
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
    this.allowDeclarations = false;
  }

  modifier(name)
  {
    if (name == "orDeclaration")
      this.allowDeclarations = true;
    else
      throw new Error(`Unknown expression modifier ${name}`);
  }

  matches(node)
  {
    if (!node)
      return false;
    if (this.allowDeclarations && node.type == "VariableDeclaration")
      return true;
    return /Expression$/.test(node.type) || node.type == "Identifier" || node.type == "Literal";
  }
}

export function compile(code)
{
  let pattern = esprima.parse(code);
  estraverse.replace(pattern, {
    leave(node)
    {
      if (node.type == "Identifier")
      {
        if (/^expression\d+$/.test(node.name))
          return new ExpressionPlaceholder(node.name);
        else if (/^statement\d+$/.test(node.name))
          return new StatementPlaceholder(node.name);
      }
      else if (node.type == "MemberExpression" && typeof node.object.modifier == "function" && node.property.type == "Identifier")
      {
        node.object.modifier(node.property.name);
        return node.object;
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "StatementPlaceholder")
        return node.expression;

      for (let key of Object.keys(node))
      {
        if (/^placeholder\d+$/.test(node[key]))
          node[key] = new GenericPlaceholder(node[key]);
      }
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
    if (placeholders.hasOwnProperty(pattern.name))
    {
      let existing = placeholders[pattern.name];
      if (existing && typeof existing == "object")
      {
        if (!matches(placeholders[pattern.name], node))
          return null;
      }
      else if (existing != node)
        return null;
    }
    placeholders[pattern.name] = node;
    return placeholders;
  }

  if (!node)
    return null;

  for (let key of Object.keys(pattern))
  {
    if (Array.isArray(pattern[key]) && Array.isArray(node[key]))
    {
      if (pattern[key].length != node[key].length)
        return null;
      for (let i = 0; i < pattern[key].length; i++)
        if (!matches(pattern[key][i], node[key][i], placeholders))
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
        result[key].push(fill(item, placeholders));
    }
    else if (pattern[key] && typeof pattern[key] == "object")
      result[key] = fill(pattern[key], placeholders);
    else
      result[key] = pattern[key];
  }
  return result;
}
