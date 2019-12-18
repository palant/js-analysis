#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import path from "path";

import escope from "escope";

import {readScript, saveScript} from "./lib/io.js";
import * as patterns from "./lib/patterns.js";
import {renameVariable, beautifyVariables} from "./lib/renameVariables.js";
import rewriteCode from "./lib/rewriteCode.js";

if (process.argv.length != 4)
{
  console.error(`Usage: ${process.argv[1]} <script-file> <output-directory>`);
  process.exit(1);
}

const identifierPattern = patterns.compile(`expression1.identifier`);
const literalPattern = patterns.compile(`expression1.literal`);

function* objectIterator(node)
{
  if (node.type != "ObjectExpression")
    throw new Error(`Object expected, got ${type}`);

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
        throw new Error(`Literal or identifier property name expected`);
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
        throw new Error(`Expected module reference to be a literal expression`);
      yield [id, key, placeholders.expression1.value];
    }
  }
}

let ast = readScript(process.argv[2]);
let placeholders = patterns.matches(`
  !function()
  {
    statement1.repeatable.optional;
  }()(expression1, expression2, expression3);
  statement2.repeatable.optional;
`, ast);
if (!placeholders)
{
  placeholders = patterns.matches(`
    expression0 = function()
    {
      statement1.repeatable.optional;
    }()(expression1, expression2, expression3);
    statement2.repeatable.optional;
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
  let placeholders = patterns.matches(`[expression1, expression2]`, value);
  if (!placeholders)
    throw new Error("Module entry is not a two elements array");
  moduleIds.set(key, [placeholders.expression1, placeholders.expression2]);
}

let moduleNames = new Map();

placeholders = patterns.matches(`[expression1.literal.repeatable.optional]`, entry);
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

    name = moduleNames.get(parent).replace(/[^\/]+$/, "") + name;
    while (/\/\.\//.test(name))
      name = name.replace(/\/\.\//, "/");
    while (/[^\/]+\/\.\.\//.test(name))
      name = name.replace(/[^\/]+\/\.\.\//, "");
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

let targetDir = process.argv[3];
for (let [id, name] of moduleNames.entries())
{
  if (!moduleIds.has(id))
    continue;

  name = name.replace(/^\/+/, "");
  name = path.join(targetDir, ...name.split("/"));
  if (!path.basename(name).includes("."))
    name += ".js";
  if (path.relative(targetDir, name).startsWith(".." + path.sep))
    throw new Error(`Unexpected module output path outside of target directory: ${name}`);

  let [node] = moduleIds.get(id);
  let scopeManager = escope.analyze(node, {ecmaVersion: 6});
  let scope = scopeManager.acquire(node);
  let placeholders = patterns.matches(`
    (function(placeholder1, placeholder2, placeholder3)
    {
      statement1.repeatable.optional;
    })`, node);
  if (!placeholders)
    throw new Error("Module code doesn't have the expected format");
  renameVariable(scope.set.get(placeholders.placeholder1), "require");
  renameVariable(scope.set.get(placeholders.placeholder2), "module");
  renameVariable(scope.set.get(placeholders.placeholder3), "exports");

  node = node.body;
  if (node.type == "BlockStatement")
    node.type = "Program";
  beautifyVariables(node, scope);
  rewriteCode(node);
  saveScript(node, name);
}
