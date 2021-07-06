/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import * as patterns from "../lib/patterns.js";
import generateVariableNames from "../lib/generateVariableNames.js";
import {parseScript} from "../lib/io.js";

describe("generateVariableNames()", () =>
{
  it("should give each variable a unique name", () =>
  {
    let ast = parseScript(`
      a(0);
      var b = 5;
      function a(a)
      {
        function b() {}
        if (a)
        {
          let a = 2;
          return a;
        }
        else
        {
          let a = 3;
          return a;
        }
      }
      {
        let a = 4;
        a++;
      }
      a(b);
    `);
    generateVariableNames(ast);

    let placeholders = patterns.matches(`
      placeholder1(0);
      var placeholder2 = 5;
      function placeholder1(placeholder3)
      {
        function placeholder4() {}
        if (placeholder3)
        {
          let placeholder5 = 2;
          return placeholder5;
        }
        else
        {
          let placeholder6 = 3;
          return placeholder6;
        }
      }
      {
        let placeholder7 = 4;
        placeholder7++;
      }
      placeholder1(placeholder2);
    `, ast);

    expect(placeholders).to.be.not.null;

    // Top-level names should stay unchanged
    expect(placeholders.placeholder1).to.equal("a");
    expect(placeholders.placeholder2).to.equal("b");
    delete placeholders.placeholder1;
    delete placeholders.placeholder2;

    expect(new Set(Object.values(placeholders)).size).to.be.equal(Object.values(placeholders).length);
    for (let name of Object.values(placeholders))
      expect(name).to.have.lengthOf.at.least(4);
  });

  it("should not rename arguments variable", () =>
  {
    let ast = parseScript(`
      function a(b)
      {
        return arguments.length > 1 ? arguments[1] : b;
      }
      a(5);
    `);
    generateVariableNames(ast);

    let placeholders = patterns.matches(`
      function placeholder1(placeholder2)
      {
        return arguments.length > 1 ? arguments[1] : placeholder2;
      }
      placeholder1(5);
    `, ast);

    expect(placeholders).to.be.not.null;

    // Top-level names should stay unchanged
    expect(placeholders.placeholder1).to.equal("a");

    expect(placeholders.placeholder2).to.have.lengthOf.at.least(4);
  });
});
