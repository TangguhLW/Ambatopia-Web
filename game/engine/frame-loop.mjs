export function createFrameLoop(request,cancel,initiallyPaused=true){
 let paused=initiallyPaused,id=0;const jobs=new Map();
 const schedule=(key,job)=>{job.native=request(time=>{jobs.delete(key);job.callback(time);});};
 return {
  request(callback){const key=++id,job={callback,native:null};jobs.set(key,job);if(!paused)schedule(key,job);return key;},
  cancel(key){const job=jobs.get(key);if(job?.native!=null)cancel(job.native);jobs.delete(key);},
  pause(){if(paused)return;paused=true;for(const job of jobs.values()){if(job.native!=null)cancel(job.native);job.native=null;}},
  resume(){if(!paused)return;paused=false;for(const [key,job] of jobs)schedule(key,job);}
 };
}
