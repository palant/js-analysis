/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import escope from "escope";
import estraverse from "estraverse";

import * as patterns from "./patterns.js";
import renameVariable, {chooseVariableName} from "./renameVariable.js";

const renamePatterns = [
  ["var placeholder1 = require('placeholder2');", varNameFromModulePath],
  ["var placeholder1 = _interopRequireDefault(require('placeholder2'));", varNameFromModulePath],
  ["var placeholder1 = require('placeholder2').placeholder3();", varNameFromModulePath],
  ["const placeholder1 = require('placeholder2');", varNameFromModulePath],
  ["const placeholder1 = _interopRequireDefault(require('placeholder2'));", varNameFromModulePath],
  ["const placeholder1 = require('placeholder2').placeholder3();", varNameFromModulePath],
  ["var placeholder1 = expression1.placeholder2;", varNameFromPropertyName],
  ["let placeholder1 = expression1.placeholder2;", varNameFromPropertyName],
  ["const placeholder1 = expression1.placeholder2;", varNameFromPropertyName],
  ["for (var placeholder1 = expression1; expression2_optional; expression3_optional) statement1;", ({placeholder1: oldName}) => [oldName, "index"]],
  ["for (let placeholder1 = expression1; expression2_optional; expression3_optional) statement1;", ({placeholder1: oldName}) => [oldName, "index"]],
  ["for (var placeholder1 in expression1) statement1;", ({placeholder1: oldName}) => [oldName, "key"]],
  ["for (let placeholder1 in expression1) statement1;", ({placeholder1: oldName}) => [oldName, "key"]],
  ["for (var placeholder1 of expression1) statement1;", ({placeholder1: oldName}) => [oldName, "item"]],
  ["for (let placeholder1 of expression1) statement1;", ({placeholder1: oldName}) => [oldName, "item"]]
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

function varNameFromPropertyName({placeholder1: oldName, placeholder2: propName})
{
  return [oldName, propName];
}

export default function deduceVariableNames(ast)
{
  let scopeManager = escope.analyze(ast, {ecmaVersion: 6});
  let scopes = [];

  estraverse.traverse(ast, {
    enter(node)
    {
      let scope = scopeManager.acquire(node);
      if (scope)
        scopes.push({node, scope});

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
        let scope = scopes[scopes.length - 1].scope;
        let variable = scope && scope.set.get(oldName);
        if (variable)
          renameVariable(variable, chooseVariableName(scope, newName));
      }
    },
    leave(node)
    {
      if (scopes.length && scopes[scopes.length - 1].node == node)
        scopes.pop();
    }
  });
}
