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
      function a(a)
      {
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
      a(5);
    `);
    generateVariableNames(ast);

    let placeholders = patterns.matches(`
      placeholder1(0);
      function placeholder1(placeholder2)
      {
        if (placeholder2)
        {
          let placeholder3 = 2;
          return placeholder3;
        }
        else
        {
          let placeholder4 = 3;
          return placeholder4;
        }
      }
      {
        let placeholder5 = 4;
        placeholder5++;
      }
      placeholder1(5);
    `, ast);

    expect(placeholders).to.be.not.null;
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
    expect(placeholders.placeholder1).to.be.not.equal(placeholders.placeholder2);
    for (let name of Object.values(placeholders))
      expect(name).to.have.lengthOf.at.least(4);
  });
});
