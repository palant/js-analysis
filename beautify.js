#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import commander from "commander";

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

commander.arguments("<script> [script...]");
commander.action((script, moreScripts) =>
{
  commander.scripts = [script].concat(moreScripts);
});
commander.option("-n, --no-mods", "Disable all modifications, reformat only");
commander.option("-c, --no-code", "Disable code rewriting");
commander.option("-v, --no-vars", "Disable variable name modification");
commander.parse(process.argv);

if (typeof commander.scripts == "undefined")
{
  commander.outputHelp();
  process.exit(1);
}

for (let script of commander.scripts)
  beautify(script, commander.opts());
