/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import {traverse} from "estraverse";
import {generate as astToCode} from "astring";
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
    ecmaVersion: "latest",
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
  ensureParentDirExists(filepath);

  let stat = fs.statSync(filepath, {throwIfNoEntry: false});
  if (stat && stat.isDirectory())
  {
    saveScript(ast, path.join(filepath, "index.js"));
    return;
  }

  // Make sure to wrap any single-statement blocks in block statements, otherwise astring will put
  // everything in one line.
  function wrap(node)
  {
    if (!node || node.type == "BlockStatement")
      return node;
    else
    {
      return {
        type: "BlockStatement",
        body: [node],
      };
    }
  }

  traverse(ast, {
    enter(node)
    {
      if (node.type == "IfStatement")
      {
        node.consequent = wrap(node.consequent);
        node.alternate = wrap(node.alternate);
      }
      else if (["WithStatement", "WhileStatement", "DoWhileStatement", "ForStatement", "ForInStatement", "ForOfStatement"].includes(node.type))
        node.body = wrap(node.body);
    }
  });

  let code = astToCode(ast, {
    indent: "  ",
    comments: true
  });

  fs.writeFileSync(filepath, code, {encoding: "utf-8"});
}
