// RE evidence: pinned Set/World bundle; recovered GSAPI/GW lifecycle and renderer.
export const nativeHook=String.raw`window.AmbatopiaNative={
 version:'gs-native-1',world:window.GW,act:_0x7254f0,input:_0x2082e1,character:_0x2c5d85,
 renderAvatar:function(ctx,p){if(p){_0x48774c=1;_0x269da7=true;_0x4a54e4=p.time||0;this.pose(p);_0x7254f0.punch=p.punchAge==null?-1:p.punchAge;}return _0xa0d8bb(ctx,false);},
 prepareAvatar:function(){window.GW.on=false;window.GSOPT.god=true;_0x199ca2.on=false;_0x2c5d85.pm=new Set();},
 position:function(p){window.GW.tp(p.x-6/32,p.y-2/32);},
 revive:function(){window.GW.dying=false;_0x199ca2.on=false;_0x7254f0.punch=-1;},
 resetWorldEffects:function(){_0x167506.clear();_0x3a6ec6.length=0;_0x22bafa.msgs=[];_0x22bafa.key='';_0x22bafa.ver++;_0x22bafa.box=_0x22bafa.last=null;_0x22bafa.tb=false;var canvas=window.document?.getElementById('chatc');if(canvas)canvas.width=canvas.width;},
 syncOverlay:function(){var canvas=window.document.getElementById('wt');if(canvas&&(_0x22bafa.W!==canvas.width||_0x22bafa.H!==canvas.height)){_0x22bafa.W=canvas.width;_0x22bafa.H=canvas.height;_0x22bafa.key='';_0x22bafa.ver++;}},
 punch:function(tile){_0xfb53aa=tile?{x:tile.x*32-_0x2904b4.px,y:tile.y*32+48-_0x2904b4.gy}:null;return _0x2c85fc();},
 impact:function(tile,kind){_0x3a6ec6.push({x:tile.x*32+16,y:tile.y*32+16,rot:Math.random()*360,life:.5});window.GW.sfx(kind==='place'?'tile_created':kind==='break'?'tile_removed':'punch');},
 pose:function(p){var walk=p.animation==='walk';_0x2082e1.left=walk&&p.facing==='left';_0x2082e1.right=walk&&p.facing!=='left';_0x2082e1.jump=p.animation==='jump';_0x7254f0.air=p.animation==='jump'?'up':null;_0x7254f0.face=p.facing==='left'?-1:1;_0x7254f0.vx=walk?250*_0x7254f0.face:0;_0x7254f0.walk=walk?.1:0;_0x7254f0.wd=walk?(p.phase||0):0;_0x7254f0.x=0;_0x7254f0.h=0;_0x7254f0.armAir=p.animation==='jump'?150:0;},
 name:function(name,redraw){_0x2c5d85.name=String(name);if(redraw!==false)return _0x54c8b8();},
 appearance:function(){return {outfit:window.GW.outfit(),skin:(Array.isArray(_0x2c5d85.skin)?_0x2c5d85.skin:_0x1759a8[_0x2c5d85.skin]||_0x1759a8[3]).slice(0,3),hc:window.GSLOOK.get('hc'),ec:window.GSLOOK.get('ec'),lc:window.GSLOOK.get('lc')};},
 wear:function(appearance){if(appearance.outfit){_0x2c5d85.worn={};for(var id of appearance.outfit){var item=_0x4036e1.get(id);if(item)_0x2c5d85.worn[item.slot]=item;}}if(appearance.skin)_0x2c5d85.skin=appearance.skin;for(var key of ['hc','ec','lc'])if(Object.prototype.hasOwnProperty.call(appearance,key)){var color=appearance[key];_0x2c5d85[key]=/^#[0-9a-f]{6}$/i.test(color||'')?[1,3,5].map(function(i){return parseInt(color.slice(i,i+2),16);}):null;}return _0x38a70e();},
 geometry:{CW:280,CH:224,OX:156,OY:172}
},`;
