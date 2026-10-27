import {readCookies} from './account-server.mjs';
export function safeReturnPath(value){return /^\/(set|world|edit)\/$/.test(value||'')?value:'/';}
export async function authorizeTool(request,verify) {
 const access=readCookies(request).gt_access;
 try{if(access&&(await verify(access))?.id)return null;}catch{}
 return new Response(null,{status:303,headers:{location:'/?login=1&return='+encodeURIComponent(safeReturnPath(new URL(request.url).pathname)),'cache-control':'private, no-store'}});
}
