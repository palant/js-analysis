#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {program} from "commander";

import {readScript, saveScript} from "./lib/io.js";
import generateVariableNames from "./lib/generateVariableNames.js";
import rewriteCode from "./lib/rewriteCode.js";
import deduceVariableNames from "./lib/deduceVariableNames.js";

function beautify(script, options)
{
  let ast = readScript(script);
  if (options.mods && options.vars)
    generateVariableNames(ast);
  if (options.mods && options.code)
    rewriteCode(ast);
  if (options.mods && options.vars)
    deduceVariableNames(ast);
  saveScript(ast, script);
}

program.arguments("<script> [script...]");
program.action((script, moreScripts) =>
{
  program.scripts = [script].concat(moreScripts);
});
program.option("-n, --no-mods", "Disable all modifications, reformat only");
program.option("-c, --no-code", "Disable code rewriting");
program.option("-v, --no-vars", "Disable variable name modification");
program.parse(process.argv);

if (typeof program.scripts == "undefined")
{
  program.outputHelp();
  process.exit(1);
}

for (let script of program.scripts)
  beautify(script, program.opts());
