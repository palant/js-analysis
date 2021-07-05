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
import generateVariableNames from "./lib/generateVariableNames.js";
import rewriteCode from "./lib/rewriteCode.js";
import deduceVariableNames from "./lib/deduceVariableNames.js";
import {parseModules} from "./lib/bundles.js";

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

let modules = parseModules(readScript(commander.script));
for (let {name, node, scope} of modules)
{
  name = name.replace(/\/$/, "/index.js");
  name = name.replace(/^\/+/, "");
  name = path.join(commander.targetDir, ...name.split("/"));
  if (!path.basename(name).includes("."))
    name += ".js";
  if (path.relative(commander.targetDir, name).startsWith(".." + path.sep))
    throw new Error(`Unexpected module output path outside of target directory: ${name}`);

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
