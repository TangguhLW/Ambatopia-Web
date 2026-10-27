export function createEnginePool({create,park,pause,resume,destroy=frame=>frame.remove()}){
 let frame=null,owner=null;
 function clear(){if(frame)destroy(frame);frame=null;owner=null;}
 function prepare(id){if(!id){clear();return;}if(owner!==id)clear();if(!frame){owner=id;frame=create();park(frame);pause(frame);}return frame;}
 return {get owner(){return owner;},prepare,acquire(id){const value=prepare(id);if(!value)throw Error('LOGIN_REQUIRED');resume(value);return value;},release(value){if(value!==frame)return;pause(frame);park(frame);},discard(value){if(value===frame)clear();},clear};
}

export function browserEnginePool(){
 return createEnginePool({
  create(){const host=document.createElement('section');host.className='native-play engine-runtime';const frame=document.createElement('iframe');frame.className='native-simulator';frame.title='Ambatopia · original Set Designer engine';frame.dataset.engineActive='0';frame.src='/set/?online=1&warm=1';host.append(frame);document.body.append(host);return frame;},
  park(frame){const host=frame.parentElement;for(const node of [...host.children])if(node!==frame)node.remove();host.style.cssText='position:fixed;left:-10000px;top:0;width:100vw;height:100dvh;visibility:hidden;pointer-events:none;z-index:30';host.setAttribute('aria-hidden','true');},
  pause(frame){frame.dataset.engineActive='0';frame.contentWindow?.AmbatopiaFrameLoop?.pause();},
  resume(frame){frame.dataset.engineActive='1';const host=frame.parentElement;host.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;z-index:30';host.removeAttribute('aria-hidden');frame.contentWindow?.AmbatopiaFrameLoop?.resume();frame.contentWindow?.dispatchEvent(new Event('resize'));},
  destroy(frame){frame.contentWindow?.AmbatopiaFrameLoop?.pause();frame.parentElement.remove();}
 });
}
