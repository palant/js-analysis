/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import escodegen from "escodegen";
import escope from "escope";
import esprima from "esprima";
import estraverse from "estraverse";
import beautify from "js-beautify";
import phonetic from "phonetic";

const optionalBrackets = new Set(["IfStatement", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "WithStatement"]);
const trivialStatements = new Set(["EmptyStatement", "BlockStatement", "ExpressionStatement", "ReturnStatement", "ThrowStatement"]);

function renameVariable(variable, names)
{
  if (variable.keepName)
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

function ensureParentDirExists(filepath)
{
  let dir = path.dirname(filepath);
  if (!dir || dir == ".")
    return;

  ensureParentDirExists(dir);
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir);
}

function ensureWrapping(node, prop)
{
  if (!node[prop])
    return;

  if (!trivialStatements.has(node[prop].type))
  {
    node[prop] = {
      type: "BlockStatement",
      body: [node[prop]]
    };
  }
}

export function beautifyVariables(ast, scope=escope.analyze(ast).acquire(ast))
{
  renameScope(scope);
}

export function rewriteCode(ast)
{
  estraverse.replace(ast, {
    enter(node)
    {
      if (node.type == "UnaryExpression" && node.operator == "!" && node.argument.type == "Literal")
      {
        // !0 => true, !1 => false
        return {
          type: "Literal",
          value: !node.argument.value
        };
      }
      else if (node.type == "UnaryExpression" && node.operator == "void" && node.argument.type == "Literal")
      {
        // void 0 => undefined
        return {
          type: "Identifier",
          name: "undefined"
        };
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "ConditionalExpression")
      {
        // a ? b : c => if (a) b; else c;
        return {
          type: "IfStatement",
          test: node.expression.test,
          consequent: {
            type: "ExpressionStatement",
            expression: node.expression.consequent
          },
          alternate: {
            type: "ExpressionStatement",
            expression: node.expression.alternate
          }
        };
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "LogicalExpression" && node.expression.operator == "&&")
      {
        // a && b => if (a) b;
        return {
          type: "IfStatement",
          test: node.expression.left,
          consequent: {
            type: "ExpressionStatement",
            expression: node.expression.right
          }
        };
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "LogicalExpression" && node.expression.operator == "||")
      {
        // a || b => if (!a) b;
        return {
          type: "IfStatement",
          test: {
            type: "UnaryExpression",
            operator: "!",
            prefix: true,
            argument: node.expression.left
          },
          consequent: {
            type: "ExpressionStatement",
            expression: node.expression.right
          }
        };
      }
      else if (node.type == "ExpressionStatement" && node.expression.type == "SequenceExpression")
      {
        // a, b, c => a; b; c;
        return {
          type: "Program",
          body: node.expression.expressions.map(expression =>
          {
            return {
              type: "ExpressionStatement",
              expression
            }
          })
        };
      }
    },
    leave(node, parent)
    {
      if (node.type == "Program" && parent.type != "BlockStatement" && parent.type != "Program")
        node.type = "BlockStatement";
      if (node.type == "BlockStatement" || node.type == "Program")
      {
        for (let i = 0; i < node.body.length; i++)
        {
          if (node.body[i].type == "Program")
          {
            node.body.splice(i, 1, ...node.body[i].body);
            i--;
          }
        }
      }
      else if (optionalBrackets.has(node.type))
      {
        ensureWrapping(node, "body");
        ensureWrapping(node, "consequent");
        if (node.alternate && node.alternate.type != "IfStatement")
          ensureWrapping(node, "alternate");
      }
    }
  });
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
      quotes: "double"
    },
    comment: true
  });
  code = beautify.js(code, {
    indent_size: 2,
    brace_style: "expand,preserve-inline"
  });

  ensureParentDirExists(filepath);
  fs.writeFileSync(filepath, code, {encoding: "utf-8"});
}
