/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import Mocha from "mocha";

const mocha = new Mocha();

async function run()
{
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  let dir = path.join(__dirname, "test");
  let files = fs.readdirSync(dir);
  for (let file of files)
  {
    if (!file.endsWith(".js"))
      continue;

    let filepath = path.join(dir, file);
    mocha.suite.emit(
      "pre-require",
      global,
      filepath,
      mocha);
    try
    {
      mocha.suite.emit(
        "require",
        await import(filepath),
        filepath,
        mocha);
    }
    catch (e)
    {
      console.error(`Failed loading ${filepath}:`);
      console.error(e);
    }
    mocha.suite.emit(
      "post-require",
      global,
      filepath,
      mocha);
  }

  mocha.run(function(failures) {
    process.on("exit", function() {
      process.exit(failures > 0 ? 1 : 0);
    });
  });
}
run();
