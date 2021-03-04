/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {parseScript} from "../lib/io.js";
import {parseModules} from "../lib/bundles.js";

describe("bundles.parseModules()", () =>
{
  it("should recognize default Browserify format", () =>
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

  it("should recognize Browserify assigning to a global variable", () =>
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

  it("should recognize optimized Browserify format", () =>
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

  it("should recognize default Webpack 4 format", () =>
  {
    let ast = parseScript(`
      (function(modules){
        function __webpack_require(moduleId){
          return module.exports;
        }
        return __webpack_require__(__webpack_require__.s = 0);
      })([
        function(m, e, r)
        {
          e.test = function()
          {
            return r(1);
          };
        },
        function(m, e, r)
        {
          m.exports = 42;
        }
      ])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require(1);
      };
    `).body);

    expect(modules.has("/1")).to.be.true;
    expect(modules.get("/1").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize optimized Webpack 4 format", () =>
  {
    let ast = parseScript(`
      !function(modules){
        function __webpack_require(moduleId){
          return module.exports;
        }
        __webpack_require__.m=1,__webpack_require__.n=2,__webpack_require__(__webpack_require__.s = 0);
      }([
        function(m, e, r)
        {
          e.test = function()
          {
            return r(1);
          };
        },
        function(m, e, r)
        {
          m.exports = 42;
        }
      ])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require(1);
      };
    `).body);

    expect(modules.has("/1")).to.be.true;
    expect(modules.get("/1").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize JSONP chunk entry point", () =>
  {
    let ast = parseScript(`
      !function(modules){
        function __webpack_require(moduleId){
          return module.exports;
        }
        function init(){
          __webpack_require__(__webpack_require__.s = foo[0]);
        }
        bar.push([
          0,
          1,
          2
        ]);
        init();
      }([
        function(m, e, r)
        {
          e.test = function()
          {
            return r(1);
          };
        },
        function(m, e, r)
        {
          m.exports = 42;
        }
      ])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require(1);
      };
    `).body);

    expect(modules.has("/1")).to.be.true;
    expect(modules.get("/1").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize optimized JSONP chunk entry point", () =>
  {
    let ast = parseScript(`
      !function(modules){
        function __webpack_require(moduleId){
          return module.exports;
        }
        function init(){
          __webpack_require__(__webpack_require__.s = foo[0]);
        }
        bar.push([
          0,
          1,
          2
        ]), init();
      }([
        function(m, e, r)
        {
          e.test = function()
          {
            return r(1);
          };
        },
        function(m, e, r)
        {
          m.exports = 42;
        }
      ])`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/main")).to.be.true;
    expect(modules.get("/main").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require(1);
      };
    `).body);

    expect(modules.has("/1")).to.be.true;
    expect(modules.get("/1").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize JSONP chunks", () =>
  {
    let ast = parseScript(`
      (window.webpackJsonp = window.webpackJsonp || []).push([
        [123],
        [
          function(m, e, r)
          {
            e.test = function()
            {
              return r(2);
            };
          },
          ,
          function(m, e, r)
          {
            m.exports = 42;
          }
        ]
      ]);`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    expect(modules.has("/0")).to.be.true;
    expect(modules.get("/0").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require(2);
      };
    `).body);

    expect(modules.has("/2")).to.be.true;
    expect(modules.get("/2").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });

  it("should recognize JSONP chunks with additional parameter", () =>
  {
    let ast = parseScript(`
      (window.webpackJsonp = window.webpackJsonp || []).push([
        ["abc", "cda"],
        {
          "abc": function(m, e, r)
          {
            e.test = function()
            {
              return r("123");
            };
          },
          "123": function(m, e, r)
          {
            m.exports = 42;
          }
        },
        [["xyz", "zyx"]]
      ]);`);

    let modules = new Map();
    for (let {name, node, scope} of parseModules(ast))
      modules.set(name, node);

    expect(modules.size).to.equal(2);

    console.log(modules);
    expect(modules.has("/abc")).to.be.true;
    expect(modules.get("/abc").body).to.deep.equal(parseScript(`
      exports.test = function()
      {
        return require("123");
      };
    `).body);

    expect(modules.has("/123")).to.be.true;
    expect(modules.get("/123").body).to.deep.equal(parseScript(`
      module.exports = 42;
    `).body);
  });
});
