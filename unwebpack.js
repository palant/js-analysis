#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import path from "path";

import commander from "commander";
import escope from "escope";

import {readScript, saveScript} from "./lib/io.js";
import * as patterns from "./lib/patterns.js";
import generateVariableNames from "./lib/generateVariableNames.js";
import renameVariable from "./lib/renameVariable.js";
import rewriteCode from "./lib/rewriteCode.js";
import deduceVariableNames from "./lib/deduceVariableNames.js";

const identifierPattern = patterns.compile("expression1_identifier");
const literalPattern = patterns.compile("expression1_literal");

function* objectIterator(node)
{
  if (node.type != "ObjectExpression")
    throw new Error(`Object expected, got ${node.type}`);

  for (let property of node.properties)
  {
    let placeholders = patterns.matches(identifierPattern, property.key);
    if (placeholders)
      yield [placeholders.expression1.name, property.value];
    else
    {
      placeholders = patterns.matches(literalPattern, property.key);
      if (placeholders)
        yield [placeholders.expression1.value, property.value];
      else
        throw new Error("Literal or identifier property name expected");
    }
  }
}

function* nameIterator(moduleIds)
{
  for (let [id, module] of moduleIds.entries())
  {
    let [func, names] = module;
    if (!names)
      continue;

    for (let [key, value] of objectIterator(names))
    {
      let placeholders = patterns.matches(literalPattern, value);
      if (!placeholders)
        throw new Error("Expected module reference to be a literal expression");
      yield [id, key, placeholders.expression1.value];
    }
  }
}

commander.arguments("<script> <target-dir>");
commander.action((script, targetDir) =>
{
  commander.script = script;
  commander.targetDir = targetDir;
});
commander.option("-n, --no-mods", "Disable all modifications, reformat only");
commander.option("-c, --no-code", "Disable code rewriting");
commander.option("-v, --no-vars", "Disable variable name modification");
commander.parse(process.argv);

if (typeof commander.script == "undefined" || typeof commander.targetDir == "undefined")
{
  commander.outputHelp();
  process.exit(1);
}

let ast = readScript(commander.script);
let placeholders = patterns.matches(`
  !function()
  {
    statement1_repeatable_optional;
  }()(expression1, expression2, expression3);
  statement2_repeatable_optional;
`, ast);
if (!placeholders)
{
  placeholders = patterns.matches(`
    expression0 = function()
    {
      statement1_repeatable_optional;
    }()(expression1, expression2, expression3);
    statement2_repeatable_optional;
  `, ast);
}
if (!placeholders)
{
  console.error("This file doesn't appear to have the expected format.");
  process.exit(1);
}
let {expression1: modules, expression3: entry} = placeholders;

let moduleIds = new Map();
for (let [key, value] of objectIterator(modules))
{
  let placeholders = patterns.matches("[expression1, expression2]", value);
  if (!placeholders)
    throw new Error("Module entry is not a two elements array");
  moduleIds.set(key, [placeholders.expression1, placeholders.expression2]);
}

let moduleNames = new Map();

placeholders = patterns.matches("[expression1_literal_repeatable_optional]", entry);
if (!placeholders)
  throw new Error("Entry points are not an array");
entry = placeholders.expression1;
if (entry.length == 1)
  moduleNames.set(entry[0].value, "/main");

let absoluteNames = new Set();
for (let [parent, name, id] of nameIterator(moduleIds))
{
  if (!name.startsWith("./") && !name.startsWith("../"))
  {
    moduleNames.set(id, "/" + name);
    absoluteNames.add(id);
  }
}

for (let id of moduleIds.keys())
{
  if (typeof id == "string" && !absoluteNames.has(id))
  {
    moduleNames.set(id, "/" + id);
    absoluteNames.add(id);
  }
}

let doNotWarn = new Set();
let seenChanges;
do
{
  seenChanges = false;
  for (let [parent, name, id] of nameIterator(moduleIds))
  {
    if (absoluteNames.has(id) || !moduleNames.has(parent))
      continue;

    name = moduleNames.get(parent).replace(/[^/]+$/, "") + name;
    while (/\/\.\//.test(name))
      name = name.replace(/\/\.\//, "/");
    while (/[^/]+\/\.\.\//.test(name))
      name = name.replace(/[^/]+\/\.\.\//, "");
    name = name.replace(/(?:\/\.\.)+\//, "/");
    name = name.replace(/\/+$/, "");

    if (moduleNames.has(id))
    {
      if (moduleNames.get(id) != name)
      {
        if (!doNotWarn.has(id))
          console.warn(`Got different names for module ${id} included from ${moduleNames.get(parent)}: ${name} and ${moduleNames.get(id)}`);
        doNotWarn.add(id);
      }
    }
    else
    {
      seenChanges = true;
      moduleNames.set(id, name);
    }
  }
} while (seenChanges);

for (let id of moduleIds.keys())
  if (!moduleNames.has(id))
    console.warn(`Got no name for module ${id}, ignoring the module`);

for (let [id, name] of moduleNames.entries())
{
  if (!moduleIds.has(id))
    continue;

  name = name.replace(/^\/+/, "");
  name = path.join(commander.targetDir, ...name.split("/"));
  if (!path.basename(name).includes("."))
    name += ".js";
  if (path.relative(commander.targetDir, name).startsWith(".." + path.sep))
    throw new Error(`Unexpected module output path outside of target directory: ${name}`);

  let [node] = moduleIds.get(id);
  let scopeManager = escope.analyze(node, {ecmaVersion: 6});
  let scope = scopeManager.acquire(node);
  let placeholders = patterns.matches(`
    (function(placeholder1, placeholder2, placeholder3)
    {
      statement1_repeatable_optional;
    })`, node);
  if (!placeholders)
    throw new Error("Module code doesn't have the expected format");
  renameVariable(scope.set.get(placeholders.placeholder1), "require");
  renameVariable(scope.set.get(placeholders.placeholder2), "module");
  renameVariable(scope.set.get(placeholders.placeholder3), "exports");

  node = node.body;
  if (node.type == "BlockStatement")
    node.type = "Program";
  if (commander.mods && commander.vars)
    generateVariableNames(node, scope);
  if (commander.mods && commander.code)
    rewriteCode(node);
  if (commander.mods && commander.vars)
    deduceVariableNames(node);
  saveScript(node, name);
}
