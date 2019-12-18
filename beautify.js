#!/usr/bin/env node

/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {readScript, saveScript} from "./lib/io.js";
import {beautifyVariables} from "./lib/renameVariables.js";
import rewriteCode from "./lib/rewriteCode.js";

function beautify(script)
{
  let ast = readScript(script);
  beautifyVariables(ast);
  rewriteCode(ast);
  saveScript(ast, script);
}

let scripts = process.argv.slice(2);
if (!scripts.length)
{
  console.error(`Usage: ${process.argv[1]} <script>...`);
  process.exit(1);
}
for (let script of scripts)
  beautify(script);
