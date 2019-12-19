/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import chai from "chai";
import esprima from "esprima";

import * as patterns from "../lib/patterns.js";

const {expect} = chai;

function parseStatement(code)
{
  return esprima.parse(code).body[0];
}

describe("patterns.compile()", () =>
{
  it("should return a statement for a single statement", () =>
  {
    expect(patterns.compile("var x = 2;").type).to.be.equal("VariableDeclaration");
  });

  it("should return a program for multiple statements", () =>
  {
    expect(patterns.compile("var x = 2;var y = 3;").type).to.be.equal("Program");
  });

  it("should return a statement for a complete expression statement", () =>
  {
    expect(patterns.compile("x = 2;").type).to.be.equal("ExpressionStatement");
  });

  it("should return an expression without semicolon after the expression", () =>
  {
    expect(patterns.compile("x = 2").type).to.be.equal("AssignmentExpression");
  });

  it("should recognize statement placeholders", () =>
  {
    expect(patterns.compile("statement12;").type).to.be.equal("StatementPlaceholder");
  });

  it("should process statement placeholder modifiers", () =>
  {
    expect(patterns.compile("statement12;").optional).to.be.false;
    expect(patterns.compile("statement12;").repeatable).to.be.false;
    expect(patterns.compile("statement12;").expectMultiLine).to.be.false;
    expect(patterns.compile("statement12_optional;").optional).to.be.true;
    expect(patterns.compile("statement12_repeatable;").repeatable).to.be.true;
    expect(patterns.compile("statement12_multiLine;").expectMultiLine).to.be.true;
  });

  it("should throw on unknown statement placeholder modifiers", () =>
  {
    expect(() => patterns.compile("statement12_unknown;")).to.throw();
  });

  it("should recognize expression placeholders", () =>
  {
    expect(patterns.compile("expression3").type).to.be.equal("ExpressionPlaceholder");
  });

  it("should process expression placeholder modifiers", () =>
  {
    expect(patterns.compile("expression3").optional).to.be.false;
    expect(patterns.compile("expression3").repeatable).to.be.false;
    expect(patterns.compile("expression3").allowDeclarations).to.be.false;
    expect(patterns.compile("expression3_optional").optional).to.be.true;
    expect(patterns.compile("expression3_repeatable").repeatable).to.be.true;
    expect(patterns.compile("expression3_orDeclaration").allowDeclarations).to.be.true;
  });

  it("should throw on unknown expression placeholder modifiers", () =>
  {
    expect(() => patterns.compile("expression3_unknown")).to.throw();
  });
});

describe("pattern.matches()", () =>
{
  it("should accept identical code regardless of whitespace", () =>
  {
    expect(patterns.matches("function sum(a,b){return (a+b)}", parseStatement(`
      function sum(a, b)
      {
        return a + b;
      }
    `))).to.be.deep.equal({});
  });

  it("should accept generic placeholders in code", () =>
  {
    expect(patterns.matches("function placeholder1(placeholder2,placeholder3){return (placeholder2+placeholder3)}", parseStatement(`
      function sum(a, b)
      {
        return a + b;
      }
    `))).to.be.deep.equal({
      placeholder1: "sum",
      placeholder2: "a",
      placeholder3: "b"
    });
  });

  it("should reject generic placeholders being mixed up", () =>
  {
    expect(patterns.matches("function placeholder1(placeholder2,placeholder3){return (placeholder2+placeholder3)}", parseStatement(`
      function sum(a, b)
      {
        return b + a;
      }
    `))).to.be.null;
  });

  it("should accept statement placeholders in code", () =>
  {
    expect(patterns.matches("function sum(a,b){statement1;statement2;statement3;}", parseStatement(`
      function sum(a, b)
      {
        function inner(x)
        {
          return x;
        }
        var result = a + b;
        if (result)
          print(result);
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("function inner(x) {return x;}"),
      statement2: parseStatement("var result = a + b;"),
      statement3: parseStatement("if (result) print(result);")
    });

    expect(patterns.matches("function sum(a,b){statement1;statement1;}", parseStatement(`
      function sum(a, b)
      {
        var result = a + b;
        var result = a + b;
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("var result = a + b;")
    });
  });

  it("should reject statement placeholders being mixed up", () =>
  {
    expect(patterns.matches("function sum(a,b){statement1;statement1;}", parseStatement(`
      function sum(a, b)
      {
        var result = a + b;
        if (result)
          print(result);
      }
    `))).to.be.null;
  });

  it("should consider statement placeholder modifiers", () =>
  {
    expect(patterns.matches("if (x) statement1; else statement2;", parseStatement(`
      if (x)
        x = 2;
    `))).to.be.null;

    expect(patterns.matches("if (x) statement1; else statement2_optional;", parseStatement(`
      if (x)
        x = 2;
    `))).to.be.deep.equal({
      statement1: parseStatement("x = 2"),
      statement2: null
    });

    expect(patterns.matches("{ statement1; }", parseStatement(`
      {
        x = 2;
        y = 3;
        x += y;
      }
    `))).to.be.null;

    expect(patterns.matches("{ statement1_repeatable; }", parseStatement(`
      {
        x = 2;
        y = 3;
        x += y;
      }
    `))).to.be.deep.equal({
      statement1: [
        parseStatement("x = 2;"),
        parseStatement("y = 3;"),
        parseStatement("x += y;")
      ]
    });

    expect(patterns.matches("{ statement1; statement2; statement3; }", parseStatement(`
      {
        var x = 1;
        function test() {}
        x++;
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("var x = 1;"),
      statement2: parseStatement("function test() {}"),
      statement3: parseStatement("x++;")
    });

    expect(patterns.matches("{ statement1_variableDeclaration; statement2_functionDeclaration; statement3_classDeclaration; statement4_strict; }", parseStatement(`
      {
        var x = 1;
        function test() {}
        class y {}
        x++;
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("var x = 1;"),
      statement2: parseStatement("function test() {}"),
      statement3: parseStatement("class y {}"),
      statement4: parseStatement("x++;")
    });

    expect(patterns.matches("{ statement1_declaration; statement2_declaration; statement3_declaration; statement4_strict; }", parseStatement(`
      {
        var x = 1;
        function test() {}
        class y {}
        x++;
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("var x = 1;"),
      statement2: parseStatement("function test() {}"),
      statement3: parseStatement("class y {}"),
      statement4: parseStatement("x++;")
    });

    expect(patterns.matches("statement1_strict;", parseStatement(`
      var x = 1;
    `))).to.be.null;

    expect(patterns.matches("statement1_declaration;", parseStatement(`
      x++;
    `))).to.be.null;

    expect(patterns.matches("statement1_variableDeclaration;", parseStatement(`
      class y {}
    `))).to.be.null;

    expect(patterns.matches("statement1_functionDeclaration;", parseStatement(`
      var x = 1;
    `))).to.be.null;

    expect(patterns.matches("statement1_classDeclaration;", parseStatement(`
      function test() {}
    `))).to.be.null;

    expect(patterns.matches("{ statement1_repeatable; }", parseStatement(`
      {
      }
    `))).to.be.null;

    expect(patterns.matches("{ statement1_repeatable_optional; }", parseStatement(`
      {
      }
    `))).to.be.deep.equal({
      statement1: []
    });

    expect(patterns.matches("function sum(a,b){statement1_multiLine;}", parseStatement(`
      function sum(a, b)
      {
        a = a + b;
      }
    `))).to.be.null;

    expect(patterns.matches("function sum(a,b){statement1_multiLine;}", parseStatement(`
      function sum(a, b)
      {
        if (a)
          a = a + b;
      }
    `))).to.be.deep.equal({
      statement1: parseStatement("if (a) a = a + b;"),
    });
  });

  it("should accept expression placeholders in code", () =>
  {
    expect(patterns.matches("for (expression1 in expression2) print(expression1);", parseStatement(`
      for (x in y.prop[2])
        print(x);
    `))).to.be.deep.equal({
      expression1: parseStatement("x").expression,
      expression2: parseStatement("y.prop[2]").expression
    });
  });

  it("should reject expression placeholders being mixed up", () =>
  {
    expect(patterns.matches("for (expression1 in expression2) print(expression1);", parseStatement(`
      for (x in y.prop[2])
        print(y.prop[2]);
    `))).to.be.null;
  });

  it("should consider expression placeholder modifiers", () =>
  {
    expect(patterns.matches("function* test() {yield expression1;}", parseStatement(`
      function* test()
      {
        yield;
      }
    `))).to.be.null;

    expect(patterns.matches("function* test() {yield expression1_optional;}", parseStatement(`
      function* test()
      {
        yield;
      }
    `))).to.be.deep.equal({
      expression1: null
    });

    expect(patterns.matches("expression1, expression2", parseStatement(`
      x = 2, y = 3, x += y
    `).expression)).to.be.null;

    expect(patterns.matches("expression1, expression2_repeatable", parseStatement(`
      x = 2, y = 3, x += y
    `).expression)).to.be.deep.equal({
      expression1: parseStatement("x = 2").expression,
      expression2: [
        parseStatement("y = 3").expression,
        parseStatement("x += y").expression
      ]
    });

    expect(patterns.matches("expression1, expression2, expression3_repeatable", parseStatement(`
      x = 2, y = 3
    `).expression)).to.be.null;

    expect(patterns.matches("expression1, expression2, expression3_repeatable_optional", parseStatement(`
      x = 2, y = 3
    `).expression)).to.be.deep.equal({
      expression1: parseStatement("x = 2").expression,
      expression2: parseStatement("y = 3").expression,
      expression3: []
    });

    expect(patterns.matches("expression1, expression2, expression3", parseStatement(`
      x + 1, x, 1
    `).expression)).to.be.deep.equal({
      expression1: parseStatement("x + 1").expression,
      expression2: parseStatement("x").expression,
      expression3: parseStatement("1").expression
    });

    expect(patterns.matches("expression1_strict, expression2_identifier, expression3_literal", parseStatement(`
      x + 1, x, 1
    `).expression)).to.be.deep.equal({
      expression1: parseStatement("x + 1").expression,
      expression2: parseStatement("x").expression,
      expression3: parseStatement("1").expression
    });

    expect(patterns.matches("expression1_identifier", parseStatement(`
      x + 1
    `).expression)).to.be.deep.null;

    expect(patterns.matches("expression1_literal", parseStatement(`
      x
    `).expression)).to.be.deep.null;

    expect(patterns.matches("expression1_strict", parseStatement(`
      1
    `).expression)).to.be.deep.null;

    expect(patterns.matches("for (expression1 of expression2) print()", parseStatement(`
      for (let a of b)
        print();
    `))).to.be.null;

    expect(patterns.matches("for (expression1_orDeclaration of expression2) print()", parseStatement(`
      for (let a of b)
        print();
    `))).to.be.deep.equal({
      expression1: parseStatement("let a"),
      expression2: parseStatement("b").expression
    });
  });
});

describe("patterns.fill()", () =>
{
  it("should leave code without placeholders unchanged", () =>
  {
    expect(patterns.fill(`
      function sum(a, b)
      {
        return a + b;
      }
    `, {})).to.be.deep.equal(parseStatement(`
      function sum(a, b)
      {
        return a + b;
      }
    `));
  });

  it("should fill in placeholders of various types", () =>
  {
    expect(patterns.fill(`
      {
        function placeholder1(placeholder2, placeholder3)
        {
          statement1;
          if (expression1 && expression2)
            statement2;
          if (!expression2)
          {
            statement1;
            statement2;
          }
          return placeholder2 + placeholder3;
        }
        placeholder1(3, 4);
      }
    `, {
      placeholder1: "sum",
      placeholder2: "a",
      placeholder3: "b",
      expression1: parseStatement("Math.sqrt(a) > 2").expression,
      expression2: parseStatement("b < 0").expression,
      statement1: parseStatement("console.log(1)"),
      statement2: parseStatement("b = 12"),
    })).to.be.deep.equal(parseStatement(`
      {
        function sum(a, b)
        {
          console.log(1);
          if (Math.sqrt(a) > 2 && b < 0)
            b = 12;
          if (!(b < 0))
          {
            console.log(1);
            b = 12;
          }
          return a + b;
        }
        sum(3, 4);
      }
    `));
  });

  it("should throw when missing placeholder values", () =>
  {
    expect(() =>
    {
      patterns.fill(`
        function placeholder1(placeholder2, placeholder3)
        {
          return placeholder2 + placeholder3;
        }
      `, {
        placeholder2: "a",
        placeholder3: "b"
      });
    }).to.throw();

    expect(() =>
    {
      patterns.fill(`
        function test()
        {
          statement1;
          statement2;
        }
      `, {
        statement2: parseStatement("b = 12")
      });
    }).to.throw();

    expect(() =>
    {
      patterns.fill(`
        if (expression1)
          a = 2;
        else if (expression2)
          a = 3;
      `, {
        expression1: parseStatement("b > 2").expression
      });
    }).to.throw();
  });

  it("should fill in multiple statements or expressions when passed an array", () =>
  {
    expect(patterns.fill(`
      function test(expression1)
      {
        x, expression1;
        console.log(expression2, y);
        statement1;
      }
    `, {
      expression1: [
        parseStatement("a").expression,
        parseStatement("b").expression
      ],
      expression2: [],
      statement1: [
        parseStatement("x = 2"),
        parseStatement("y = 3")
      ]
    })).to.be.deep.equal(parseStatement(`
      function test(a, b)
      {
        x, a, b;
        console.log(y);
        x = 2;
        y = 3;
      }
    `));
  });
});
