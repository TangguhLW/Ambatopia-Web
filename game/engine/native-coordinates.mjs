export const isEditingTarget=target=>!!target&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
export const isGameUiTarget=target=>isEditingTarget(target)||!!target?.closest?.('button,summary,a,[role="button"],[role="checkbox"],dialog');
export function tileAt(point,view,rect,dpr=1){return {x:Math.floor(((point.x-rect.left)*dpr/view.k+view.ox)/32),y:Math.floor(((point.y-rect.top)*dpr/view.k+view.oy)/32)};}
export function avatarBox(player,view,geometry={CW:280,CH:224,OX:156,OY:172},dpr=1){
 const zoom=view.k/dpr,x=(player.x*32+10-view.ox)*zoom,y=(player.y*32+30-view.oy)*zoom;
 return {left:x-geometry.OX*zoom,top:y-geometry.OY*zoom,width:geometry.CW*zoom,height:geometry.CH*zoom,x,y,zoom};
}
