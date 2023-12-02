/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import escope from "escope";

import renameVariable from "./renameVariable.js";

// List is from http://ogden.basic-english.org/words.html with some removals to avoid being mistaken for legit variable names
const nouns = "act addition adjustment agreement air amount amusement animal answer apparatus approval argument art attack attempt attention attraction authority back balance base behavior belief birth bit bite blood blow body brass bread breath brother building burn burst business butter care cause chalk chance change cloth coal color comfort committee comparison competition control cook copper copy cork cotton cough country cover crack credit crime crush cry current curve damage danger daughter day death debt decision degree design desire destruction detail development digestion direction discovery discussion disease disgust distance distribution division doubt drink driving dust earth edge education effect end example exchange existence expansion experience expert fact fall family father fear feeling fiction field fight fire flame flight flower fold food force form friend front fruit glass gold government grain grass grip growth guide harbor harmony hate hearing heat help history hole hope hour humor ice idea impulse increase industry ink insect instrument insurance interest invention iron jelly join journey judge jump kick kiss knowledge land language laugh law lead learning leather letter level lift light linen liquid look loss love machine man manager mark market mass meal measure meat meeting memory metal middle milk mind mine minute mist month morning mother motion mountain move music nation need night noise note observation offer oil opinion ornament owner page pain paint paper part paste payment peace person place plant play pleasure point poison polish porter position powder power price print process produce profit property prose protest pull punishment purpose push quality question rain range rate ray reaction reading reason record regret relation religion representative request respect rest reward rhythm rice river road roll room rub rule run salt sand scale science sea seat secretary selection self sense servant shade shake shame shock side sign silk silver sister size sky sleep slip slope smash smell smile smoke sneeze snow soap society son song sound soup space stage start statement steam steel step stitch stone stop story stretch structure substance sugar suggestion summer support surprise swim system talk taste tax teaching tendency test theory thing thought thunder time tin top touch trade transport trick trouble turn twist use value verse vessel view voice walk war wash waste water wave wax way weather week weight wind wine winter woman wood wool word work wound writing year angle ant apple arch arm army baby bag ball band basin basket bath bed bee bell berry bird blade board boat bone book boot bottle box boy brain brake branch brick bridge brush bucket bulb button cake camera card cart carriage cat chain cheese chest chin church circle clock cloud coat collar comb cord cow cup curtain cushion dog door drain drawer dress drop ear egg engine eye face farm feather finger fish flag floor fly foot fork fowl frame garden girl glove goat gun hair hammer hand hat head heart hook horn horse hospital house island jewel kettle key knee knife knot leaf leg library line lip lock map match monkey moon mouth muscle nail neck needle nerve net nose nut office orange oven parcel pen pencil picture pig pin pipe plane plate pocket pot potato prison pump rail rat receipt ring rod roof root sail school scissors screw seed sheep shelf ship shirt shoe skin skirt snake sock spade sponge spoon spring square stamp star station stem stick stocking stomach store street sun table tail throat thumb ticket toe tongue tooth town train tray tree trousers umbrella wall watch wheel whip whistle wing wire worm".split(" ");
const adjectives = "able acid angry automatic beautiful black boiling bright broken brown cheap chemical chief clean clear common complex conscious cut deep dependent early elastic electric equal fat fertile first fixed flat free frequent full general good great grey hanging happy hard healthy high hollow important kind like living long male married material medical military natural necessary new normal open parallel past physical political poor possible present private probable quick quiet ready red regular responsible right round same second separate serious sharp smooth sticky stiff straight strong sudden sweet tall thick tight tired true violent waiting warm wet wide wise yellow young awake bad bent bitter blue certain cold complete cruel dark dead dear delicate different dirty dry false feeble female foolish future green ill last late left loose loud low mixed narrow old opposite public rough sad safe secret short shut simple slow small soft solid special strange thin white wrong".split(" ");
const prime = 32059;

export function getName(state)
{
  state.seed = "seed" in state ? state.seed + 1 : 0;
  state.numAdjectives = "numAdjectives" in state ? state.numAdjectives : 1;
  state.space = "space" in state ? state.space : nouns.length * adjectives.length;

  if (state.seed >= state.space)
  {
    state.seed = 0;
    state.numAdjectives++;
    state.space *= adjectives.length;
  }

  let number = (state.seed * prime) % state.space;
  let result = [];
  for (let i = 0; i < state.numAdjectives; i++)
  {
    result.push(adjectives[number % adjectives.length]);
    number = Math.floor(number / adjectives.length);
  }

  result.push(nouns[number]);

  return "_" + result.join("_") + "_";
}

function generateName(variable, state)
{
  if (variable.keepName || variable.name == "arguments")
    return;

  renameVariable(variable, getName(state));
}

function generateNamesInScope(scope, state = {})
{
  if (scope.block.type != "Program")
    for (let variable of scope.variables)
      generateName(variable, state);

  for (let child of scope.childScopes)
    generateNamesInScope(child, state);
}

export default function generateVariableNames(ast, scope = escope.analyze(ast, {ecmaVersion: 2021, sourceType: "module"}).acquire(ast))
{
  generateNamesInScope(scope);
}
