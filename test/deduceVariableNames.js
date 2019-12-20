/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import chai from "chai";
import esprima from "esprima";

import deduceVariableNames from "../lib/deduceVariableNames.js";

const {expect} = chai;

describe("deduceVariableNames()", () =>
{
  it("should deduce module imports names", () =>
  {
    let ast = esprima.parse(`
      var a = require("core");
      var b = _interopRequireDefault(require("content/script-messenger"));
      const c = require("background/script-messenger");
      const d = require("singleton").getInstance();
      var e = b.c.eventName;
      let f = d.type;

      b.postMessage(a, c.postMessage);
      function test()
      {
        b.onMessage(a, c.onMessage);
      }
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      var core = require("core");
      var scriptMessenger = _interopRequireDefault(require("content/script-messenger"));
      const scriptMessenger2 = require("background/script-messenger");
      const singleton = require("singleton").getInstance();
      var eventName = scriptMessenger.c.eventName;
      let type = singleton.type;

      scriptMessenger.postMessage(core, scriptMessenger2.postMessage);
      function test()
      {
        scriptMessenger.onMessage(core, scriptMessenger2.onMessage);
      }
    `));
  });

  it("should rename loop variables", () =>
  {
    let ast = esprima.parse(`
      for (let i = 0; i < arguments.length; i++)
        for (let j = 0; j < arguments[i].length; j++)
          console.log(arguments[i][j]);

      for (var k in obj)
      {
        result[k] = obj[k];
        delete obj[k];
      }

      for (var i of arr);
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      for (let index = 0; index < arguments.length; index++)
        for (let index2 = 0; index2 < arguments[index].length; index2++)
          console.log(arguments[index][index2]);

      for (var key in obj)
      {
        result[key] = obj[key];
        delete obj[key];
      }

      for (var item of arr);
    `));
  });
});
