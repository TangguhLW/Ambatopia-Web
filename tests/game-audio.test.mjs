import test from 'node:test';import assert from 'node:assert/strict';
import {createAudioController} from '../game/audio.mjs';
test('menu soundtrack waits for a gesture, loops, stops in world, and respects mute',()=>{
 const made=[];class FakeAudio{constructor(src){this.src=src;this.paused=true;made.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 let volume='70';const sound=createAudioController({AudioClass:FakeAudio,storage:{getItem:()=>volume}});
 assert.equal(sound.theme.paused,true);assert.equal(sound.theme.loop,true);
 sound.gesture();assert.equal(sound.theme.paused,false);sound.screen('play');assert.equal(sound.theme.paused,true);
 sound.screen('worlds');assert.equal(sound.theme.paused,true);assert.equal(sound.choir.paused,false);assert.equal(sound.choir.src,'/audio/choir.mp3');
 sound.visibility(true);assert.equal(sound.choir.paused,true);sound.visibility(false);assert.equal(sound.choir.paused,false);
 sound.screen('play');assert.equal(sound.choir.paused,true);sound.screen('menu');assert.equal(sound.theme.paused,false);
 volume='0';sound.volume();assert.equal(sound.theme.paused,true);assert.equal(sound.choir.paused,true);
 sound.click();assert.equal(made.find(a=>a.src==='/audio/click.wav').volume,0);
});
test('music and button sound preferences mute independently',()=>{
 const made=[];class FakeAudio{constructor(src){this.src=src;this.paused=true;made.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 let prefs={music:false,clicks:true};const storage={getItem:key=>key==='ambatopia:preferences'?JSON.stringify(prefs):'70'};
 const sound=createAudioController({AudioClass:FakeAudio,storage});sound.gesture();assert.equal(sound.theme.paused,true);
 sound.click();assert.equal(made.filter(a=>a.src==='/audio/click.wav'&&!a.paused).length,1);
 for(const item of made)item.pause();prefs={music:true,clicks:false};sound.volume();assert.equal(sound.theme.paused,false);
 sound.click();assert.equal(made.filter(a=>a.src==='/audio/click.wav'&&!a.paused).length,0);
});
