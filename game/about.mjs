import {h,button,panel} from './dom.mjs';
export function renderAbout(root,ctx){
 const flow=(title,steps)=>h('section',{class:'about-flow-section'},h('h2',{},title),h('ol',{class:'about-flow','aria-label':title},...steps.map(text=>h('li',{},text))));
 const view=panel('About Ambatopia',h('p',{class:'about-byline'},'Created by Thaney · Indonesia'),
  h('p',{},'Ambatopia adalah proyek fan-made Growtopia: sebuah set planner dan ruang creative online untuk mencoba pakaian, merancang world, berbagi ide, dan bersosialisasi.'),
  h('h2',{},'Dibangun melalui reverse engineering'),
  h('p',{},'Proyek ini mempelajari perilaku, alur antarmuka, format world, dan runtime simulator web publik Growtopia Simulator. Renderer dan aset simulator diadaptasi agar bekerja bersama sistem akun, penyimpanan, serta world online Ambatopia.'),
  h('p',{},'Ini adalah adaptasi fan-made independen, bukan kode server resmi Growtopia dan bukan layanan yang berafiliasi dengan Ubisoft. Tujuannya adalah menyediakan alat perencanaan set dan world yang lengkap, dengan mode creative untuk bermain bersama.'),
  flow('Alur bermain online',['Main menu','Login / Create account','Choose a world','Explore · Build · Chat','Saved to your account']),
  flow('Alur merancang',['Set: coba pakaian','World: lihat rancangan','Edit World: susun world','Save / Export']),
  h('h2',{},'Fitur & cara kerja'),h('ul',{},...[
   'Grow ID menjadi identitas permanen akun; nama tidak dapat diganti.',
   'Blok dan lock creative gratis. Lock menjaga izin membangun; kepemilikan tetap diperiksa oleh server.',
   'World bersama mendukung hingga 32 pemain. Gerakan, aksi, dan chat disinkronkan melalui layanan online.',
   'Chat mengikuti pemain dalam bentuk bubble. Riwayat chat world tersedia melalui panel tarik di atas layar.',
   'Set dan world disimpan ke akun secara otomatis. Preferensi tampilan dan suara disimpan pada perangkat.',
   'Ekspor gambar/video dan file world tersedia dari menu alat; format ekspor mengikuti kemampuan browser.'
  ].map(text=>h('li',{},text))),
  h('h2',{},'Credits'),h('dl',{class:'about-credits'},h('dt',{},'Creator & direction'),h('dd',{},'Thaney — Indonesia'),h('dt',{},'Simulator reference'),h('dd',{},h('a',{href:'https://growtopiasimulator.com',target:'_blank',rel:'noopener'},'Growtopia Simulator'),' — public simulator, renderer, tools, and asset formats studied for this adaptation.'),h('dt',{},'Original game & assets'),h('dd',{},'Growtopia and its original artwork, sounds and trademarks belong to their respective owners, including Ubisoft.'),h('dt',{},'Music & audio'),h('dd',{},'Growtopia OST – Theme, ambatukam choir, and click effects were supplied for this project; credit remains with the respective creators.'),h('dt',{},'Technology'),h('dd',{},'GSAP for animation, Supabase for account/world services, and Vercel for hosting.')),
  h('h2',{},'Batas proyek'),h('p',{},'Kualitas koneksi dan kemampuan perangkat memengaruhi pengalaman bermain. Beberapa aset membutuhkan unduhan saat pertama kali dibuka. Fitur pemulihan password belum tersedia; simpan kredensial akun dengan aman.'),button('Back',()=>ctx.navigate('menu')));
 view.classList.add('about-panel');root.replaceChildren(view);
}
