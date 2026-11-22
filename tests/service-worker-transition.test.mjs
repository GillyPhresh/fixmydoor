import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('service worker activation never reloads an in-progress booking or admin edit',async()=>{
 const events=new Map();let reloads=0;
 const window={location:{pathname:'/',reload(){reloads++;}},addEventListener(){}};
 const navigator={serviceWorker:{addEventListener(name,handler){events.set(name,handler);}}};
 const document={getElementById(){return null;},querySelector(){return null;}};
 vm.runInNewContext(await readFile('client/public/app-shell.js','utf8'),{window,navigator,document});
 events.get('controllerchange')?.();events.get('controllerchange')?.();
 assert.equal(reloads,0,'worker control changes must preserve unsaved form data');
});
