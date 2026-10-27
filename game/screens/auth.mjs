import {h,button,panel,statusNode,busy} from '../dom.mjs';
export function renderAuth(root,ctx,{bootstrap=false}={}) {
 let mode=bootstrap?'bootstrap':'login';const status=statusNode();
 const grow=h('input',{name:'growId',autocomplete:'username',required:true,minlength:3,maxlength:20,pattern:'[A-Za-z0-9_]{3,20}',value:bootstrap?'Thaney':''});
 if(bootstrap)grow.readOnly=true;
 const password=h('input',{name:'password',type:'password',required:true,minlength:10,maxlength:128,autocomplete:bootstrap?'new-password':'current-password'});
 const show=button('Show',()=>{password.type=password.type==='password'?'text':'password';show.textContent=password.type==='password'?'Show':'Hide';});show.setAttribute('aria-label','Show or hide password');
 const submit=h('button',{type:'submit',class:'primary'},bootstrap?'Create Thaney':'Login');
 const localSetup=bootstrap&&['localhost','127.0.0.1'].includes(location.hostname);
 const token=h('input',{name:'bootstrapToken',type:'password',autocomplete:'off',required:bootstrap&&!localSetup});
 const form=h('form',{},h('label',{},'Grow ID',grow),h('label',{},'Password',h('span',{class:'password-row'},password,show)),...(bootstrap&&!localSetup?[h('label',{},'One-time setup token',token)]:[]),status,submit);
 const tabs=h('div',{class:'tabs',role:'tablist','aria-label':'Account action'});
 const login=button('Login',()=>change('login')),signup=button('Create Account',()=>change('signup'));
 for(const item of [login,signup])item.setAttribute('role','tab');tabs.append(login,signup);
 const hint=h('p',{class:'hint'},'Your Grow ID cannot be changed. Keep your password safe; password recovery is not available yet.');
 form.addEventListener('submit',event=>{event.preventDefault();busy(submit,async()=>{
  status.textContent=mode==='login'?'Signing in…':'Creating your account…';
  await ctx.session.authenticate(mode,{growId:grow.value,password:password.value,...(bootstrap?{bootstrapToken:token.value}:{})});
  password.value='';token.value='';await ctx.start();
 },status);});
 function change(next){mode=next;login.setAttribute('aria-selected',next==='login');signup.setAttribute('aria-selected',next==='signup');submit.textContent=next==='login'?'Login':'Create Account';password.autocomplete=next==='login'?'current-password':'new-password';status.textContent='';}
 root.replaceChildren(panel(bootstrap?'Developer account setup':'Welcome back',...(bootstrap?[]:[tabs]),form,hint,button('Main Menu',()=>ctx.navigate('menu'),'quiet')));
 if(!bootstrap)change('login');queueMicrotask(()=>grow.focus());return {dispose(){password.value='';token.value='';}};
}
