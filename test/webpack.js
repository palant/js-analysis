/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {parseScript} from "../lib/io.js";
import {parseModules} from "../lib/webpack.js";

describe("parseModules()", () =>
{
  it("should recognize !function()()(...) format", () =>
  {
    let ast = parseScript(`
      !function(){
        function r(e,n,t){
          return x.exports;
        }
        return r;
      }()({
        1:[
          function(r, m, e)
          {
            e.test = function()
            {
              return r("test");
            };
          },
          {
            "test": 2
          }
        ],
        2: [
          function(r, m, e)
          {
            m.exports = 42;
          },
          {}
        ]
      }, {}, [1])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require("test");
      };
    `).body);

    expect(modules.has("/test")).to.be.true;
    expect(modules.get("/test").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize require = function()()(...) format", () =>
  {
    let ast = parseScript(`
      require = function(){
        function r(e,n,t){
          return x.exports;
        }
        return r;
      }()({
        1:[
          function(r, m, e)
          {
            e.test = function()
            {
              return r("test");
            };
          },
          {
            "test": 2
          }
        ],
        2: [
          function(r, m, e)
          {
            m.exports = 42;
          },
          {}
        ]
      }, {}, [1]);
      noop;`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require("test");
      };
    `).body);

    expect(modules.has("/test")).to.be.true;
    expect(modules.get("/test").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize (function())()(...) format", () =>
  {
    let ast = parseScript(`
      (function(){
        function r(e,n,t){
          return x.exports;
        }
        return r;
      })()({
        1:[
          function(r, m, e)
          {
            e.test = function()
            {
              return r("test");
            };
          },
          {
            "test": 2
          }
        ],
        2: [
          function(r, m, e)
          {
            m.exports = 42;
          },
          {}
        ]
      }, {}, [1])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require("test");
      };
    `).body);

    expect(modules.has("/test")).to.be.true;
    expect(modules.get("/test").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });
});
