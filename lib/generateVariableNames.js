/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import escope from "escope";
import phonetic from "phonetic";

import renameVariable from "./renameVariable.js";

function generateName(variable, names)
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

function generateNamesInScope(scope, names = new Set())
{
  for (let variable of scope.variables)
    generateName(variable, names);

  for (let child of scope.childScopes)
    generateNamesInScope(child, names);
}

export default function generateVariableNames(ast, scope = escope.analyze(ast, {ecmaVersion: 6}).acquire(ast))
{
  generateNamesInScope(scope);
}
