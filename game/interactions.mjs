export function tileIntent(mode,selected,tile){
 if(tile.action==='punch'||mode!=='build')return {action:'punch',x:tile.x,y:tile.y};
 if(!selected)throw Error('Select a block first');
 return {action:'place',x:tile.x,y:tile.y,id:selected};
}
export const bubbleDuration=text=>Math.min(14000,Math.max(3500,2500+Array.from(String(text)).length*55));
export function atWhiteDoor(snapshot,player){
 const x=Math.floor(player.x+10/32),y=Math.floor(player.y+15/32);
 return snapshot.foreground[y*snapshot.width+x]===15;
}
export function playerIntent(snapshot,player,mode,selected,tile){
 const intent=tileIntent(mode,selected,tile);
 return intent.action==='punch'&&atWhiteDoor(snapshot,player)?{action:'exit'}:intent;
}
