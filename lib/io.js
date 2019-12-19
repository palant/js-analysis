/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import escodegen from "escodegen";
import esprima from "esprima";

function ensureParentDirExists(filepath)
{
  let dir = path.dirname(filepath);
  if (!dir || dir == ".")
    return;

  ensureParentDirExists(dir);
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir);
}

export function readScript(filepath)
{
  let contents = fs.readFileSync(filepath, {encoding: "utf-8"});
  return esprima.parse(contents);
}

export function saveScript(ast, filepath)
{
  let code = escodegen.generate(ast, {
    format: {
      indent: {
        style: "  "
      },
      quotes: "double",
      escapeless: true
    },
    comment: true
  });

  ensureParentDirExists(filepath);
  fs.writeFileSync(filepath, code, {encoding: "utf-8"});
}
