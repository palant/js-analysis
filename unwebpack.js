#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import path from "path";

import {program} from "commander";
import escope from "escope";

import {readScript, saveScript} from "./lib/io.js";
import generateVariableNames from "./lib/generateVariableNames.js";
import rewriteCode from "./lib/rewriteCode.js";
import deduceVariableNames from "./lib/deduceVariableNames.js";
import {parseModules} from "./lib/bundles.js";

program.arguments("<script> <target-dir>");
program.action((script, targetDir) =>
{
  program.script = script;
  program.targetDir = targetDir;
});
program.option("-n, --no-mods", "Disable all modifications, reformat only");
program.option("-c, --no-code", "Disable code rewriting");
program.option("-v, --no-vars", "Disable variable name modification");
program.parse(process.argv);

if (typeof program.script == "undefined" || typeof program.targetDir == "undefined")
{
  program.outputHelp();
  process.exit(1);
}

let modules = parseModules(readScript(program.script));
for (let {name, node, scope} of modules)
{
  name = name.replace(/\/$/, "/index.js");
  name = name.replace(/^\/+/, "");
  name = path.join(program.targetDir, ...name.split("/"));
  if (!path.basename(name).includes("."))
    name += ".js";
  if (path.relative(program.targetDir, name).startsWith(".." + path.sep))
    throw new Error(`Unexpected module output path outside of target directory: ${name}`);

  if (node.type == "BlockStatement")
    node.type = "Program";
  if (program.mods && program.vars)
    generateVariableNames(node, scope);
  if (program.mods && program.code)
    rewriteCode(node);
  if (program.mods && program.vars)
    deduceVariableNames(node);
  saveScript(node, name);
}
