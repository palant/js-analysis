#!/usr/bin/env node

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

function beautify(script)
{
  let contents = fs.readFileSync(script, {encoding: "utf-8"});
  let ast = esprima.parse(contents);
  let scopeManager = escope.analyze(ast);

  renameScope(scopeManager.acquire(ast));

  contents = escodegen.generate(ast, {
    format: {
      indent: {
        style: "  "
      },
      quotes: "double"
    },
    comment: true
  });
  fs.writeFileSync(script, contents, {encoding: "utf-8"});
}

let scripts = process.argv.slice(2);
if (!scripts.length)
{
  console.error(`Usage: ${process.argv[1]} <script>...`);
  process.exit(1);
}
for (let script of scripts)
  beautify(script);
