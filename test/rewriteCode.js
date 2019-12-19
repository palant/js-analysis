/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import chai from "chai";
import esprima from "esprima";

import rewriteCode from "../lib/rewriteCode.js";

const {expect} = chai;

describe("rewriteCode()", () =>
{
  it("should simplify representation of constants", () =>
  {
    let ast = esprima.parse(`
      function test()
      {
        var x = !1, y = void 0;
        if (x && !y)
          return !0;
        return void 0;
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      function test()
      {
        var x = false;
        var y = undefined;
        if (x && !y)
          return true;
        return undefined;
      }
    `));
  });

  it("should limit variable declarations to one variable per line", () =>
  {
    let ast = esprima.parse(`
      function test()
      {
        var x, y = 12, z, xyz = 3;
        let a = 4, b, c = "x", abc = Math.sqrt(x + y);
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      function test()
      {
        var x;
        var y = 12;
        var z;
        var xyz = 3;
        let a = 4;
        let b;
        let c = "x";
        let abc = Math.sqrt(x + y);
      }
    `));
  });

  it("should simplify control flow", () =>
  {
    let ast = esprima.parse(`
      exists(x) && doSomething(x),
      missing(y) ? doSomething(y) : doSomething(0),
      exists(z) || exists(y) && doSomething(x + y),
      x += y;
      function test(x, y)
      {
        return x++, y -= 2, x += y, x ? x + 1 : y - 2;
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      if (exists(x))
        doSomething(x);
      if (missing(y))
        doSomething(y);
      else
        doSomething(0);
      if (!exists(z))
        if (exists(y))
          doSomething(x + y);
      x += y;
      function test(x, y)
      {
        x++;
        y -= 2;
        x += y;
        if (x)
          return x + 1;
        else
          return y - 2;
      }
    `));
  });

  it("should put brackets around multiline statements", () =>
  {
    let ast = esprima.parse(`
      if (x)
        for (y in x)
          console.log(y);

      if (x)
        for (y in x)
          console.log(y);
      else
        console.log(x);

      if (!x)
        ;
      else
        for (y in x)
          console.log(y);

      if (!x)
        for (x in y)
          console.log(x);
      else
        for (y in x)
          console.log(y);

      while (x)
        if (x)
          x = x.next;

      do
        try
        {
          x = x.next;
        }
        catch(e)
        {
          x = null;
        }
      while (x);

      for (let i = 0; i < 12; i++)
        if (i < 6)
          console.log(i);

      for (let key in obj)
        while (true)
          hang();

      for (let item of arr)
        try
        {
          throw item;
        }
        finally
        {
          break;
        }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      if (x)
      {
        for (y in x)
          console.log(y);
      }

      if (x)
      {
        for (y in x)
          console.log(y);
      }
      else
        console.log(x);

      if (!x)
        ;
      else
      {
        for (y in x)
          console.log(y);
      }

      if (!x)
      {
        for (x in y)
          console.log(x);
      }
      else
      {
        for (y in x)
          console.log(y);
      }

      while (x)
      {
        if (x)
          x = x.next;
      }

      do
      {
        try
        {
          x = x.next;
        }
        catch(e)
        {
          x = null;
        }
      }
      while (x);

      for (let i = 0; i < 12; i++)
      {
        if (i < 6)
          console.log(i);
      }

      for (let key in obj)
      {
        while (true)
          hang();
      }

      for (let item of arr)
      {
        try
        {
          throw item;
        }
        finally
        {
          break;
        }
      }
    `));
  });

  it("should leave single-line statements unchanged", () =>
  {
    let ast = esprima.parse(`
      function test()
      {
        if (x)
          console.log(x);

        if (x)
          console.log(x);
        else
          console.log(y);

        while (x)
          x = x.next;

        do
        {
          x = x.next;
        }
        while (x);

        for (let i = 0; i < 12; i++);

        for (let key in obj)
          throw key;

        for (let item of arr)
          return item;
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      function test()
      {
        if (x)
          console.log(x);

        if (x)
          console.log(x);
        else
          console.log(y);

        while (x)
          x = x.next;

        do
        {
          x = x.next;
        }
        while (x);

        for (let i = 0; i < 12; i++);

        for (let key in obj)
          throw key;

        for (let item of arr)
          return item;
      }
    `));
  });

  it("should recognize known functions", () =>
  {
    let ast = esprima.parse(`
      var b = a(require("core"));
      var c = a(require("iterator"));
      function a(e){return e&&e.__esModule?e:{default:e}}
      var y = x(require("messenger"));
      function x(e){return e&&e.__esModule?e:{default:e}}
      function test()
      {
        function innerA(e){return e&&e.__esModule?e:{default:e}}
        var b = innerA(require("process"));
        var c = a(require("messenger"));
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      var core = _interopRequireDefault(require("core"));
      var iterator = _interopRequireDefault(require("iterator"));
      function _interopRequireDefault(obj)
      {
        if (obj && obj.__esModule)
          return obj;
        else
          return { default: obj };
      }
      var y = _interopRequireDefault2(require("messenger"));
      function _interopRequireDefault2(obj)
      {
        if (obj && obj.__esModule)
          return obj;
        else
          return { default: obj };
      }
      function test()
      {
        function _interopRequireDefault3(obj)
        {
          if (obj && obj.__esModule)
            return obj;
          else
            return { default: obj };
        }
        var b = _interopRequireDefault3(require("process"));
        var messenger = _interopRequireDefault(require("messenger"));
      }
    `));
  });

  it("should rename variables where appropriate", () =>
  {
    let ast = esprima.parse(`
      var a = require("core");
      var b = _interopRequireDefault(require("content/script-messenger"));
      const c = require("background/script-messenger");

      b.postMessage(a, c.postMessage);
      function test()
      {
        b.onMessage(a, c.onMessage);
      }
    `);
    rewriteCode(ast);
    expect(ast).to.be.deep.equal(esprima.parse(`
      var core = require("core");
      var scriptMessenger = _interopRequireDefault(require("content/script-messenger"));
      const scriptMessenger2 = require("background/script-messenger");

      scriptMessenger.postMessage(core, scriptMessenger2.postMessage);
      function test()
      {
        scriptMessenger.onMessage(core, scriptMessenger2.onMessage);
      }
    `));
  });
});
