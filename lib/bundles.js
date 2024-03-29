/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import escope from "escope";

import {parseScript} from "./io.js";
import * as patterns from "./patterns.js";
import renameVariable from "./renameVariable.js";

const identifierPattern = patterns.compile("expression1_identifier");
const literalPattern = patterns.compile("expression1_literal");

function* objectIterator(node)
{
  if (node.type == "ArrayExpression")
  {
    let placeholders = patterns.matches("[expression1_repeatable_optional]", node);
    let i = 0;
    for (let entry of placeholders.expression1)
    {
      let id = i++;
      if (entry)
        yield [id, entry];
    }
    return;
  }

  if (node.type != "ObjectExpression")
    throw new Error(`Object expected, got ${node.type}`);

  for (let property of node.properties)
  {
    let placeholders = patterns.matches(identifierPattern, property.key);
    if (placeholders)
      yield [placeholders.expression1.name, property.value];
    else
    {
      placeholders = patterns.matches(literalPattern, property.key);
      if (placeholders)
        yield [placeholders.expression1.value, property.value];
      else
        throw new Error("Literal or identifier property name expected");
    }
  }
}

function* nameIterator(moduleIds)
{
  for (let [id, module] of moduleIds.entries())
  {
    let [func, names] = module;
    if (!names)
      continue;

    for (let [key, value] of objectIterator(names))
    {
      let placeholders = patterns.matches(literalPattern, value);
      if (!placeholders)
        throw new Error("Expected module reference to be a literal expression");
      yield [id, key, placeholders.expression1.value];
    }
  }
}

export function* parseModules(ast)
{
  const browserifyPatterns = [
    `
      (function()
      {
        statement1_repeatable_optional;
      })()(expression1, expression2, expression3);
      statement2_repeatable_optional;
    `,
    `
      expression0 = function()
      {
        statement1_repeatable_optional;
      }()(expression1, expression2, expression3);
      statement2_repeatable_optional;
    `,
    `
      !function()
      {
        statement1_repeatable_optional;
      }()(expression1, expression2, expression3);
      statement2_repeatable_optional;
    `,
    `
      expression00 = function placeholder0(expression0_repeatable)
      {
        statement1_repeatable_optional;
      }(expression1, expression2, expression3);
      statement2_repeatable_optional;
    `,
    `
      !function placeholder0(expression0_repeatable)
      {
        statement1_repeatable_optional;
      }(expression1, expression2, expression3);
      statement2_repeatable_optional;
    `,
    `
      !function(expression0_repeatable)
      {
        statement0_repeatable_optional;
      }(function()
      {
        var placeholder00;
        return function placeholder1(expression00_repeatable)
        {
          statement1_repeatable_optional;
        }(expression1, expression2, expression3)(expression4);
      });
      statement2_repeatable_optional;
    `
  ];

  const webpackPatterns = [
    // Up to Webpack 4
    `
      (function(expression0)
      {
        statement1_repeatable_optional;
      })(expression1);
      statement2_repeatable_optional;
    `,
    `
      !function(expression0)
      {
        statement1_repeatable_optional;
      }(expression1);
      statement2_repeatable_optional;
    `,
    // Exporting result
    `
      placeholder1.placeholder2 = function(expression0)
      {
        statement1_repeatable_optional;
      }(expression1);
      statement2_repeatable_optional;
    `,
    // Code splitting
    `
      (placeholder1.placeholder2 = placeholder1.placeholder2 || []).push([
        [expression0_literal_repeatable],
        expression1
      ]);
      statement2_repeatable_optional;
    `,
    `
      "use strict";
      (placeholder1.placeholder2 = placeholder1.placeholder2 || []).push([
        [expression0_literal_repeatable],
        expression1
      ]);
      statement2_repeatable_optional;
    `,
    `
      "use strict";
      (placeholder1.placeholder2 = placeholder1.placeholder2 || []).push([
        [expression0_literal_repeatable],
        expression1,
        expression2
      ]);
      statement2_repeatable_optional;
    `,
    `
      var placeholder1 = placeholder2(
        [expression0_literal_repeatable],
        expression1,
        expression2
      );
      statement2_repeatable_optional;
    `,
    // WebPack generating a universal module?
    `
      !function(expression0_repeatable)
      {
        statement0_repeatable_optional;
      }(placeholder00, function()
      {
        return function(expression00)
        {
          statement1_repeatable_optional;
        }(expression1).placeholder1;
      });
      statement2_repeatable_optional;
    `
  ];

  const webpackEntryPatterns = [
    "return placeholder1(placeholder1.s = expression1_literal);",
    "return placeholder1(placeholder1.s = expression1_literal), expression2_repeatable;",
    ["return expression0, expression1_repeatable;", "placeholder1(placeholder1.s = expression1_literal)"],
    "placeholder1(placeholder1.s = expression1_literal);",
    "placeholder1(placeholder1.s = expression1_literal), expression2_repeatable;",
    ["expression0, expression1_repeatable;", "placeholder1(placeholder1.s = expression1_literal)"],
    // JSONP chunks?
    "placeholder1.push([expression1_literal, expression2_literal_repeatable_optional]);",
    "placeholder1.push([expression1_literal, expression2_literal_repeatable_optional]), expression3_repeatable;"
  ];

  let type = null;
  let modules = null;
  let entry = [];

  {
    let placeholders;
    for (let pattern of browserifyPatterns)
    {
      placeholders = patterns.matches(pattern, ast);
      if (placeholders)
        break;
    }
    if (placeholders)
    {
      type = "browserify";
      modules = placeholders.expression1;

      placeholders = patterns.matches("[expression1_literal_repeatable_optional]", placeholders.expression3);
      if (!placeholders)
        throw new Error("Entry points are not an array");
      for (let moduleId of placeholders.expression1)
        entry.push(moduleId.value);
    }
  }

  if (!modules)
  {
    let placeholders;
    for (let pattern of webpackPatterns)
    {
      placeholders = patterns.matches(pattern, ast);
      if (placeholders)
        break;
    }
    if (placeholders)
    {
      type = "webpack";
      modules = placeholders.expression1;

      if (placeholders.statement1)
      {
        for (let statement of placeholders.statement1)
        {
          for (let pattern of webpackEntryPatterns)
          {
            if (Array.isArray(pattern))
            {
              placeholders = patterns.matches(pattern[0], statement);
              if (placeholders)
              {
                for (let expression of placeholders.expression1)
                {
                  placeholders = patterns.matches(pattern[1], expression);
                  if (placeholders)
                    break;
                }
              }
            }
            else
              placeholders = patterns.matches(pattern, statement);

            if (placeholders)
              entry.push(placeholders.expression1.value);
          }
        }
      }
    }
  }

  if (!type)
    throw new Error("The script is not in a known Webpack or Browserify format.");

  let moduleIds = new Map();
  for (let [key, value] of objectIterator(modules))
  {
    if (type == "browserify")
    {
      let placeholders = patterns.matches("[expression1, expression2]", value);
      if (!placeholders)
        throw new Error("Module entry is not a two elements array");
      moduleIds.set(key, [placeholders.expression1, placeholders.expression2]);
    }
    else
    {
      if (!patterns.matches("(function (expression1_repeatable_optional) {statement1_repeatable_optional;})", value))
        throw new Error("Module entry is not a function");
      moduleIds.set(key, value);
    }
  }

  let moduleNames = new Map();

  if (entry.length == 1)
    moduleNames.set(entry[0], "/main");
  else
  {
    for (let i = 0; i < entry.length; i++)
      moduleNames.set(entry[0], "/main" + (i + 1));
  }

  if (type == "browserify")
  {
    let absoluteNames = new Set();
    for (let [parent, name, id] of nameIterator(moduleIds))
    {
      if (!name.startsWith("./") && !name.startsWith("../"))
      {
        moduleNames.set(id, "/" + name + "/");
        absoluteNames.add(id);
      }
    }

    for (let id of moduleIds.keys())
    {
      if (typeof id == "string" && !absoluteNames.has(id))
      {
        moduleNames.set(id, "/" + id);
        absoluteNames.add(id);
      }
    }

    let doNotWarn = new Set();
    let seenChanges;
    do
    {
      seenChanges = false;
      for (let [parent, name, id] of nameIterator(moduleIds))
      {
        if (absoluteNames.has(id) || !moduleNames.has(parent))
          continue;

        if (name.endsWith("/"))
          name += "index";
        if (name.startsWith("./"))
          name = moduleNames.get(parent).replace(/[^/]+$/, "") + "/" + name;
        else
          name = moduleNames.get(parent) + "/" + name;
        name = name.replace(/\/+/g, "/");
        while (/\/\.\//.test(name))
          name = name.replace(/\/\.\//, "/");
        while (/[^/]+\/\.\.\//.test(name))
          name = name.replace(/[^/]+\/\.\.\//, "");
        name = name.replace(/(?:\/\.\.)+\//, "/");
        name = name.replace(/\/+$/, "");

        if (moduleNames.has(id))
        {
          if (moduleNames.get(id) != name)
          {
            if (!doNotWarn.has(id))
              console.warn(`Got different names for module ${id} included from ${moduleNames.get(parent)}: ${name} and ${moduleNames.get(id)}`);
            doNotWarn.add(id);
          }
        }
        else
        {
          seenChanges = true;
          moduleNames.set(id, name);
        }
      }
    } while (seenChanges);
  }

  for (let id of moduleIds.keys())
    if (!moduleNames.has(id))
      moduleNames.set(id, "/" + id);

  for (let [id, name] of moduleNames.entries())
  {
    if (!moduleIds.has(id))
      continue;

    let node = (type == "browserify" ? moduleIds.get(id)[0] : moduleIds.get(id));
    let placeholders = patterns.matches(`
      (function(expression1_repeatable_optional)
      {
        statement1_repeatable_optional;
      })`, node);
    if (!placeholders)
      throw new Error("Module code doesn't have the expected format");

    if (placeholders.statement1.length >= 1)
    {
      let placeholders2 = patterns.matches(`
        eval(expression1_literal);
      `, placeholders.statement1[placeholders.statement1.length - 1]);
      if (placeholders2 && typeof placeholders2.expression1.value == "string")
        node.body.body.splice(node.body.body.length - 1, 1, ...parseScript(placeholders2.expression1.value).body);
    }

    let scopeManager = escope.analyze(node, {ecmaVersion: 2021, sourceType: "module"});
    let scope = scopeManager.acquire(node);
    let paramOrder = type == "browserify" ? ["require", "module", "exports"] : ["module", "exports", "require"];
    let params = placeholders.expression1;
    for (let i = 0; i < paramOrder.length; i++)
      if (params.length > i)
        renameVariable(scope.set.get(params[i].name), paramOrder[i]);

    yield {name, node: node.body, scope};
  }
}
