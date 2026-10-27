// Online IDs are deliberately separate from simulator IDs; adapters map explicitly.
export const CATALOG=Object.freeze([
  {id:0,name:'Empty',layer:'foreground',solid:false,color:'transparent'},
  {id:1,name:'Dirt',layer:'foreground',solid:true,color:'#94643d'},
  {id:2,name:'Grass',layer:'foreground',solid:true,color:'#6fbd43'},
  {id:3,name:'Bedrock',layer:'foreground',solid:true,color:'#515c69',unbreakable:true},
  {id:4,name:'Rock',layer:'foreground',solid:true,color:'#8d95a0'},
  {id:5,name:'Wood',layer:'foreground',solid:true,color:'#bb8953'},
  {id:6,name:'Glass',layer:'foreground',solid:true,color:'#99def0'},
  {id:7,name:'Brick',layer:'foreground',solid:true,color:'#b95448'},
  {id:8,name:'Cave Background',layer:'background',solid:false,color:'#4d3d32'},
  {id:9,name:'Platform',layer:'foreground',solid:false,color:'#cba779'},
  {id:10,name:'World Lock',layer:'foreground',solid:true,color:'#f8d24b',lock:'world'},
  {id:11,name:'Diamond Lock',layer:'foreground',solid:true,color:'#88f5f0',lock:'diamond'},
  {id:12,name:'Small Lock',layer:'foreground',solid:true,color:'#e8ac66',lock:'small'},
  {id:13,name:'Big Lock',layer:'foreground',solid:true,color:'#c3cbd5',lock:'big'},
  {id:14,name:'Huge Lock',layer:'foreground',solid:true,color:'#e9d28d',lock:'huge'},
  {id:15,name:'White Door',layer:'foreground',solid:false,unbreakable:true,color:'#ffffff'},
  {id:16,name:'Lava',layer:'foreground',solid:false,hazard:true,color:'#ef7424'}
]);
export const ITEMS=new Map(CATALOG.map(item=>[item.id,item]));
export const LOCK_CAPS=Object.freeze({small:10,big:48,huge:200,world:6000,diamond:6000});
