/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import {generate as astToCode} from "escodegen";
import {parse as codeToAst} from "acorn";

function ensureParentDirExists(filepath)
{
  let dir = path.dirname(filepath);
  if (!dir || dir == ".")
    return;

  ensureParentDirExists(dir);
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir);
}

function removeLocations(ast)
{
  if (!ast || typeof ast != "object")
    return;

  delete ast.start;
  delete ast.end;
  for (let key in ast)
    removeLocations(ast[key]);
}

export function parseScript(contents)
{
  let ast = codeToAst(contents, {
    ecmaVersion: 2021,
    sourceType: "module",
    allowReturnOutsideFunction: true
  });
  removeLocations(ast);
  return ast;
}

export function readScript(filepath)
{
  let contents = fs.readFileSync(filepath, {encoding: "utf-8"});
  return parseScript(contents);
}

export function saveScript(ast, filepath)
{
  let code = astToCode(ast, {
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
