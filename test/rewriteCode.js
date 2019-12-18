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
        var x = false, y = undefined;
        if (x && !y)
          return true;
        return undefined;
      }
    `));
  });

  it("should simplify control flow", () =>
  {
    let ast = esprima.parse(`
      exists(x) && doSomething(x),
      missing(y) ? doSomething(y) : doSomething(0),
      exists(z) || exists(y) && doSomething(x + y);
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
    `));
  });

  it("should put brackets around multiline statements", () =>
  {
    let ast = esprima.parse(`
      if (x)
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
});
