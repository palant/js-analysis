#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import path from "path";

import escope from "escope";

import {beautifyVariables, readScript, saveScript} from "./utils.js";

if (process.argv.length != 4)
{
  console.error(`Usage: ${process.argv[1]} <script-file> <output-directory>`);
  process.exit(1);
}

function expectType(ast, type, next, index)
{
  if (Array.isArray(type))
  {
    if (!type.includes(ast.type))
      throw new Error(`Expected one of ${type.join(", ")}, got ${ast.type}`);
  }
  else if (ast.type != type)
    throw new Error(`Expected ${type}, got ${ast.type}`);

  if (Array.isArray(next))
  {
    for (let entry of next)
    {
      if (entry in ast)
      {
        next = entry;
        break;
      }
    }
  }

  let result = ast[next];
  if (!result)
    throw new Error(`Expected ${type}.${next} to be set`);

  if (typeof index == "number")
  {
    if (Array.isArray(result))
    {
      if (index >= result.length)
        throw new Error(`Expected ${type}.${next} to have at least ${index + 1} entries, got ${result.length}`);
      result = result[index];
    }
    else
      throw new Error(`Expected ${type}.${next} to be an array`);
  }
  return result;
}

function* nameIterator(moduleIds)
{
  for (let [id, module] of moduleIds.entries())
  {
    let [func, names] = module;
    if (!names)
      continue;

    names = expectType(names, "ObjectExpression", "properties");
    for (let name of names)
    {
      let key = expectType(name, "Property", "key");
      key = expectType(key, ["Identifier", "Literal"], ["name", "value"]);

      let value = expectType(name, "Property", "value");
      value = expectType(value, "Literal", "value");
      yield [id, key, value];
    }
  }
}

function renameVariable(variable, newName)
{
  variable.name = newName;
  for (let identifier of variable.identifiers)
    identifier.name = newName;
  for (let reference of variable.references)
    reference.identifier.name = newName;
}

let ast = readScript(process.argv[2]);
ast = expectType(ast, "Program", "body", 0);
ast = expectType(ast, "ExpressionStatement", "expression");
ast = expectType(ast, ["UnaryExpression", "AssignmentExpression"], ["argument", "right"]);
let [modules, , entry] = expectType(ast, "CallExpression", "arguments");

modules = expectType(modules, "ObjectExpression", "properties");
let moduleIds = new Map();
for (let module of modules)
{
  let key = expectType(module, "Property", "key");
  key = expectType(key, ["Identifier", "Literal"], ["name", "value"]);

  let value = expectType(module, "Property", "value");
  value = expectType(value, "ArrayExpression", "elements");
  moduleIds.set(key, value);
}

let moduleNames = new Map();
entry = expectType(entry, "ArrayExpression", "elements");
if (entry.length == 1)
  moduleNames.set(expectType(entry[0], "Literal", "value"), "/main");

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

  let [ast] = moduleIds.get(id);
  let scopeManager = escope.analyze(ast);
  let scope = scopeManager.acquire(ast);
  if (scope.variables.length < 4 || scope.variables[0].name != "arguments")
    throw new Error("Unexpected module scope");
  renameVariable(scope.variables[1], "require");
  renameVariable(scope.variables[2], "module");
  renameVariable(scope.variables[3], "exports");

  ast = expectType(ast, "FunctionExpression", "body");
  if (ast.type == "BlockStatement")
    ast.type = "Program";
  beautifyVariables(ast, scope);
  saveScript(ast, name);
}
