/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import escope from "escope";
import phonetic from "phonetic";

function beautifyVariable(variable, names)
{
  if (variable.keepName || variable.name == "arguments")
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
