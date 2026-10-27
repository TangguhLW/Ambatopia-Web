export function createAutosave({collect,persist,status}) {
 let acknowledged=null,pending=null,stopped=false;
 return {
  flush(){
   if(stopped)return Promise.resolve();if(pending)return pending;
   pending=(async()=>{
    const data=collect(),serialized=JSON.stringify(data);if(serialized===acknowledged)return;
    status({state:'saving'});
    try{await persist(data);acknowledged=serialized;status({state:'saved',at:new Date().toISOString()});}
    catch{status({state:'error',message:'Not saved yet. Reconnecting…'});}
   })().finally(()=>{pending=null;});return pending;
  },
  stop(){stopped=true;}
 };
}
