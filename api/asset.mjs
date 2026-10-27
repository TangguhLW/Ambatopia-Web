import {fetchPublicAsset} from '../game/asset-server.mjs';
export default {async fetch(request){
 const url=new URL(request.url),path=url.searchParams.get('path');
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 try{const response=await fetchPublicAsset(path+(url.searchParams.has('v')?'?v='+url.searchParams.get('v'):''));return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;}
 catch{return new Response('Public asset unavailable',{status:502,headers:{'cache-control':'no-store'}});}
}};
