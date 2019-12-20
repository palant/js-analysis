/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

function isInScope(scope, name)
{
  for (; scope; scope = scope.upper)
    if (scope.set.has(name))
      return true;
  return false;
}

export function chooseVariableName(scope, name)
{
  let result = name;
  let i = 1;
  while (isInScope(scope, result))
    result = name + ++i;
  return result;
}

function renameInChild(scope, oldName, newName)
{
  if (scope.set.has(oldName))
    return;

  for (let reference of scope.through)
    if (reference.identifier.name == oldName)
      reference.identifier.name = newName;

  for (let child of scope.childScopes)
    renameInChild(child, oldName, newName);
}

export default function renameVariable(variable, newName)
{
  variable.scope.set.delete(variable.name);
  variable.keepName = true;
  for (let identifier of variable.identifiers)
    identifier.name = newName;
  for (let reference of variable.references)
    reference.identifier.name = newName;

  // Functions called before declaration will not be listed under variable.references
  for (let reference of variable.scope.references)
    if (reference.identifier.name == variable.name)
      reference.identifier.name = newName;

  for (let child of variable.scope.childScopes)
    renameInChild(child, variable.name, newName);

  variable.name = newName;
  variable.scope.set.set(variable.name, variable);
}
