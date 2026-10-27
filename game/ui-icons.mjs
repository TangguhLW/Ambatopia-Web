const paths={
 clothes:'M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z',
 block:'M3 7l9-5 9 5v11l-9 5-9-5zM3 7l9 5 9-5M12 12v11',
 lock:'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5zM12 14v3',
 punch:'M6 12V6a2 2 0 014 0V4a2 2 0 014 0v1a2 2 0 014 0v2a2 2 0 014 0v8l-4 6H9l-6-7a2 2 0 013-2z',
 wrench:'M15 3l4 4-8 8-3-3zM8 12l3 3-6 6-3-3zM19 7l3-3-2-2-3 3',
 more:'M4 12h.01M12 12h.01M20 12h.01',
 emote:'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM8 9h.01M16 9h.01M7 14c2 5 8 5 10 0',
 export:'M12 15V2M7 7l5-5 5 5M4 13v8h16v-8',
 save:'M4 3h13l4 4v14H3V3h1M7 3v6h10V3M7 21v-8h10v8',
 import:'M12 2v13M7 10l5 5 5-5M4 16v5h16v-5',
 respawn:'M4 9a8 8 0 111 9M4 3v6h6',
 exit:'M10 3H3v18h7M8 12h14M17 7l5 5-5 5',
 chat:'M3 3h18v13H9l-6 5zM7 7h10M7 11h7',
 send:'M3 3l19 9-19 9 4-9zM7 12h15',
 plus:'M15 9A6 6 0 113 9a6 6 0 0112 0zM14 14l7 7M6 9h6M9 6v6',
 minus:'M15 9A6 6 0 113 9a6 6 0 0112 0zM14 14l7 7M6 9h6'
};
export const iconMarkup=name=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="'+(paths[name]||paths.more)+'"/></svg>';
export function iconButton(node,name,label){node.innerHTML=iconMarkup(name);node.setAttribute('aria-label',label);node.title=label;node.classList.add('amb-icon-button');return node;}
