/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import chai from "chai";

import deduceVariableNames from "../lib/deduceVariableNames.js";
import {parseScript} from "../lib/io.js";

const {expect} = chai;

describe("deduceVariableNames()", () =>
{
  it("should deduce module imports names", () =>
  {
    let ast = parseScript(`
      var a = require("core");
      var b = _interopRequireDefault(require("content/script-messenger"));
      const c = mangled("background/script-messenger");
      const d = require("singleton").getInstance();

      b.postMessage(a, c.postMessage);
      function test()
      {
        b.onMessage(a, c.onMessage);
      }
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(parseScript(`
      var core = require("core");
      var scriptMessenger = _interopRequireDefault(require("content/script-messenger"));
      const scriptMessenger2 = mangled("background/script-messenger");
      const singleton = require("singleton").getInstance();

      scriptMessenger.postMessage(core, scriptMessenger2.postMessage);
      function test()
      {
        scriptMessenger.onMessage(core, scriptMessenger2.onMessage);
      }
    `));
  });

  it("should deduce variable names from call parameters", () =>
  {
    let ast = parseScript(`
      var a = document.body.getAttribute("type");
      var b = document.createEvent("MouseEvent");

      document.forms[a].dispatchEvent(b);
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(parseScript(`
      var type = document.body.getAttribute("type");
      var MouseEvent = document.createEvent("MouseEvent");

      document.forms[type].dispatchEvent(MouseEvent);
    `));
  });

  it("should deduce variable names from property names", () =>
  {
    let ast = parseScript(`
      var a = b.c.eventName;
      let d = e.options;
      const f = g.callback;

      f(new Event(a, d));
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(parseScript(`
      var eventName = b.c.eventName;
      let options = e.options;
      const callback = g.callback;

      callback(new Event(eventName, options));
    `));
  });

  it("should deduce variable names from class names", () =>
  {
    let ast = parseScript(`
      var a = new WeakMap();
      let b = new DOMParser(c, d);
      const e = new Set([a, b]);
      var f = new BOGUS();

      e.set(f, b);
    `);
    deduceVariableNames(ast);
    expect(ast).to.be.deep.equal(parseScript(`
      var weakMap = new WeakMap();
      let domparser = new DOMParser(c, d);
      const set = new Set([weakMap, domparser]);
      var f = new BOGUS();

      set.set(f, domparser);
    `));
  });

  it("should rename loop variables", () =>
  {
    let ast = parseScript(`
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
    expect(ast).to.be.deep.equal(parseScript(`
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
