import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createSkinShopController,mergeSkinAcquisitionOwnership,SKIN_SHOP_KEY} from '../src/skin-shop-controller.mjs';
import {createSkinAcquisitionState,importSkinAcquisitionStore,purchaseSkinAcquisition} from '../src/skin-acquisition.mjs';
import {createSkinLab} from '../src/skin-lab.mjs';
const json=n=>JSON.parse(readFileSync(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const config=json('skin-acquisition-study'),skins=json('skin-lab');
async function ledger(){const state=createSkinAcquisitionState(config);await importSkinAcquisitionStore(state,{origin:'explicit-research-input',id:'demo',mode:'event_reward',activityState:'Started',tokenType:'eventtok',initialTokens:20,event_reward:[{id:'skin-1',type:'decoration',score:5,rewards:['1']}]},config);await purchaseSkinAcquisition(state,{requestId:'r1',storeId:'demo',offerId:'skin-1'},config);return state;}
test('receipt replay bridges ownership once, preserves slot edits and refuses forged receipts',async()=>{
 const state=await ledger(),lab=createSkinLab(skins),snapshot=structuredClone(lab);
 const first=mergeSkinAcquisitionOwnership(lab,state,config,skins);assert.deepEqual(lab,snapshot);assert.deepEqual(first.acquired,['1']);assert.deepEqual(first.lab.owned,['1']);
 const again=mergeSkinAcquisitionOwnership(first.lab,state,config,skins);assert.deepEqual(again.acquired,[]);assert.deepEqual(again.lab,first.lab);
 const forged=structuredClone(state);forged.receipts[0].cost.Amount=0;assert.throws(()=>mergeSkinAcquisitionOwnership(lab,forged,config,skins));
 const ownedOnly=createSkinLab(skins);ownedOnly.owned=['2'];const mixed=mergeSkinAcquisitionOwnership(ownedOnly,state,config,skins);assert.deepEqual(mixed.lab.owned,['2','1']);assert.equal(state.receipts.length,1);
});
test('unreadable and incompatible stores are never overwritten or interpreted as ownership',()=>{
 let writes=0,calls=0;const controller=createSkinShopController({getData:()=>({skinAcquisitionStudy:config}),storage:{getItem(){throw Error('read');},setItem(){writes++;}},onAcquire(){calls++;}});
 assert.match(controller.renderPage(),/메모리에서만/);assert.equal(writes,0);assert.equal(controller.getState().receipts.length,0);
 const broken=createSkinShopController({getData:()=>({skinAcquisitionStudy:config}),storage:{getItem(){return '{broken';},setItem(){writes++;}},onAcquire(){throw Error('must not acquire');}});
 assert.match(broken.renderPage(),/원본을 보존/);assert.equal(writes,0);assert.equal(broken.getState(),null);
});
test('shop CAS refuses a different-tab save without exposing uncommitted acquisition',async()=>{
 const initial=createSkinAcquisitionState(config);await importSkinAcquisitionStore(initial,{origin:'explicit-research-input',id:'demo',mode:'event_reward',activityState:'Started',tokenType:'eventtok',initialTokens:20,event_reward:[{id:'skin-1',type:'decoration',score:5,rewards:['1']}]},config);
 let raw=JSON.stringify(initial),writes=0;const controller=createSkinShopController({getData:()=>({skinAcquisitionStudy:config}),storage:{getItem:k=>k===SKIN_SHOP_KEY?raw:null,setItem(k,v){writes++;raw=v;}},onAcquire(){}});
 const dom=new JSDOM('<main>'+controller.renderPage()+'</main>',{url:'https://example.test'}),root=dom.window.document.querySelector('main');controller.afterMount(root);raw='changed-in-another-tab';root.querySelector('[data-skin-acq-buy]').click();await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(writes,0);assert.equal(controller.getState().receipts.length,0);assert.match(root.querySelector('[data-skin-acq-status]').textContent,/저장 실패/);controller.cleanup();dom.window.close();
});
