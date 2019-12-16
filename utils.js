/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";

import escodegen from "escodegen";
import escope from "escope";
import esprima from "esprima";
import phonetic from "phonetic";

function renameVariable(variable, names)
{
  if (variable.name.length >= 4)
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

  for (let identifier of variable.identifiers)
    identifier.name = name;
  for (let reference of variable.references)
    reference.identifier.name = name;

  names._seed = options.seed;
  names._syllables = options.syllables;
  names.add(name);
}

function renameScope(scope, names=new Set())
{
  for (let variable of scope.variables)
    renameVariable(variable, names);

  for (let child of scope.childScopes)
    renameScope(child, names);
}

export function beautifyVariables(ast, scopeManager=escope.analyze(ast))
{
  renameScope(scopeManager.acquire(ast));
}

export function readScript(filepath)
{
  let contents = fs.readFileSync(filepath, {encoding: "utf-8"});
  return esprima.parse(contents);
}

export function saveScript(ast, filepath)
{
  fs.writeFileSync(filepath, escodegen.generate(ast, {
    format: {
      indent: {
        style: "  "
      },
      quotes: "double"
    },
    comment: true
  }), {encoding: "utf-8"});
}
