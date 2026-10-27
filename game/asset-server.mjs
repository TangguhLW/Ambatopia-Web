import {validatePath,ORIGIN} from '../mirror.mjs';
export async function fetchPublicAsset(path,fetchImpl=fetch) {
 validatePath(path);
 if(!/^\/(?:(?:set|world|edit)\/atlas\/|edit\/r\/)[A-Za-z0-9_./-]+(?:\?v=[a-fA-F0-9]{1,64})?$/.test(path))throw Error('Invalid public asset');
 const response=await fetchImpl(ORIGIN+path,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{accept:'*/*','user-agent':'GrowtopiaCreative/1.0 public asset proxy'}});
 if(!response.ok)throw Error('Public asset unavailable');
 if(Number(response.headers.get('content-length')||0)>32*1024*1024)throw Error('Public asset exceeds limit');
 let size=0;const body=response.body?.pipeThrough(new TransformStream({transform(chunk,controller){size+=chunk.byteLength;if(size>32*1024*1024)throw Error('Public asset exceeds limit');controller.enqueue(chunk);}}));
 return new Response(body,{headers:{'content-type':response.headers.get('content-type')||'application/octet-stream','cache-control':'public, max-age=3600, s-maxage=86400','x-content-type-options':'nosniff'}});
}
