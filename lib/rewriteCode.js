/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import escope from "escope";
import estraverse from "estraverse";

import * as patterns from "./patterns.js";
import {renameVariable} from "./renameVariables.js";

const rewritePatterns = [
  ["!1", "false"],
  ["!0", "true"],
  ["void 0", "undefined"],
  ["expression1 && expression2;", "if (expression1) expression2;"],
  ["expression1 || expression2;", "if (!expression1) expression2;"],
  ["expression1 ? expression2 : expression3;", "if (expression1) expression2; else expression3;"],
  ["return expression1 ? expression2 : expression3;", "if (expression1) return expression2; else return expression3;"],
  ["expression1, expression2;", "expression1; expression2;"],
  ["expression1, expression2, expression3.repeatable;", "expression1; expression2, expression3;"],
  ["return expression1, expression2;", "expression1; return expression2;"],
  ["return expression1, expression2, expression3.repeatable;", "expression1; return expression2, expression3;"],
  ["var expression1, expression2_repeatable;", "var expression1; var expression2;"],
  ["let expression1, expression2_repeatable;", "let expression1; let expression2;"],
  ["if (expression1) statement1.multiLine; else statement2.optional;", "if (expression1) { statement1; } else statement2;"],
  ["if (expression1) statement1; else statement2.multiLine;", "if (expression1) statement1; else { statement2; }"],
  ["while (expression1) statement1.multiLine;", "while (expression1) { statement1; }"],
  ["do statement1.multiLine; while (expression1);", "do { statement1; } while (expression1);"],
  ["for (expression1.orDeclaration; expression2; expression3) statement1.multiLine;", "for (expression1; expression2; expression3) { statement1; }"],
  ["for (expression1.orDeclaration in expression2) statement1.multiLine;", "for (expression1 in expression2) { statement1; }"],
  ["for (expression1.orDeclaration of expression2) statement1.multiLine;", "for (expression1 of expression2) { statement1; }"],
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
].map(([pattern, replacement]) => [patterns.compile(pattern), patterns.compile(replacement)]);

const renamePatterns = [
  ["var placeholder1 = require('placeholder2');", varNameFromModulePath],
  ["var placeholder1 = _interopRequireDefault(require('placeholder2'));", varNameFromModulePath],
  ["var placeholder1 = require('placeholder2').placeholder3();", varNameFromModulePath],
  ["const placeholder1 = require('placeholder2');", varNameFromModulePath],
  ["const placeholder1 = _interopRequireDefault(require('placeholder2'));", varNameFromModulePath],
  ["const placeholder1 = require('placeholder2').placeholder3();", varNameFromModulePath]
].map(([pattern, processor]) => [patterns.compile(pattern), processor]);

function varNameFromModulePath({placeholder1: oldName, placeholder2: modulePath})
{
  let match = /([^/]+)\/*$/.exec(modulePath);
  if (!match)
    return null;

  let name = match[1];
  name = name.replace(/\W+$/, "");
  if (name.length == 0)
    return null;

  name = name.replace(/\W+(\w)/g, (match, $1) => $1.toUpperCase());
  return [oldName, name];
}

function isInScope(scope, name)
{
  for (; scope; scope = scope.upper)
    if (scope.set.has(name))
      return true;
  return false;
}

function chooseVariableName(scope, name)
{
  let result = name;
  let i = 1;
  while (isInScope(scope, result))
    result = name + ++i;
  return result;
}

function rewriteNode(node, rewritePatterns, scopeManager)
{
  for (let i = 0; i < rewritePatterns.length; i++)
  {
    let [pattern, replacement] = rewritePatterns[i];
    let placeholders = patterns.matches(pattern, node);
    if (!placeholders)
      continue;

    // Avoid infinite loops: same pattern should not be considered on the next
    // pass for the same node.
    rewritePatterns.splice(i, 1);

    let result = patterns.fill(replacement, placeholders);
    if (node.type == "FunctionDeclaration" && result.type == "FunctionDeclaration")
    {
      let scope = scopeManager.acquire(node).upper;
      let variable = scope.set.get(node.id.name);
      result.id.name = chooseVariableName(scope, result.id.name);
      renameVariable(variable, result.id.name);
    }
    return result;
  }
  return undefined;
}

export default function rewriteCode(ast)
{
  let scopeManager = escope.analyze(ast, {ecmaVersion: 6});
  let scopedNodes = new Map();

  estraverse.replace(ast, {
    enter(node)
    {
      let newNode = undefined;
      let patterns = rewritePatterns.slice();
      // eslint-disable-next-line no-constant-condition
      while (true)
      {
        let result = rewriteNode(newNode || node, patterns, scopeManager);
        if (!result)
          break;
        newNode = result;
      }

      let scope = scopeManager.acquire(node);
      if (scope)
        scopedNodes.set(newNode || node, scope);

      return newNode;
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

  let scopes = [];
  estraverse.replace(ast, {
    enter(node)
    {
      if (scopedNodes.has(node))
        scopes.push(scopedNodes.get(node));
    },
    leave(node)
    {
      let renaming = null;
      for (let [pattern, processor] of renamePatterns)
      {
        let placeholders = patterns.matches(pattern, node);
        if (!placeholders)
          continue;
        renaming = processor(placeholders);
        if (renaming)
          break;
      }
      if (renaming)
      {
        let [oldName, newName] = renaming;
        let scope = scopes[scopes.length - 1];
        let variable = scope && scope.set.get(oldName);
        if (variable)
          renameVariable(variable, chooseVariableName(scope, newName));
      }

      if (scopedNodes.has(node))
        scopes.pop();
    }
  });
}
