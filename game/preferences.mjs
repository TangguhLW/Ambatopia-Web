export const preferenceDefaults={music:true,clicks:true,clouds:true,mascot:true,itemNames:true,compactItems:false,saveStatus:true,controlSize:'normal'};
export function preferenceStorage(){try{if(window.parent!==window&&window.parent.location.origin===location.origin)return window.parent.localStorage;}catch{}return localStorage;}
export function readPreferences(storage=preferenceStorage()){try{return {...preferenceDefaults,...JSON.parse(storage.getItem('ambatopia:preferences')||'{}')};}catch{return {...preferenceDefaults};}}
export function savePreference(key,value){const storage=preferenceStorage(),valueSet={...readPreferences(storage),[key]:value};storage.setItem('ambatopia:preferences',JSON.stringify(valueSet));window.dispatchEvent(new Event('ambatopia:preferences'));}
export function installPreferences(){
 const apply=()=>{const p=readPreferences(),html=document.documentElement;for(const key of ['clouds','mascot','itemNames','compactItems','saveStatus'])html.dataset[key]=String(p[key]);html.style.setProperty('--amb-control-size',({small:'56px',normal:'64px',large:'76px'})[p.controlSize]||'64px');};
 apply();window.addEventListener('storage',apply);window.addEventListener('ambatopia:preferences',apply);
}
