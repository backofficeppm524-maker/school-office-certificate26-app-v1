/* Office Certificate App - dashboard helpers (no changes to script.js needed) */
function ovLaunch(id){
  var btn=document.getElementById('nav-'+id);
  if(typeof switchModule==='function'&&btn){switchModule(id,btn);}
}
function ovTogglePass(btn){
  var f=document.getElementById('master-password');
  var show=f.type==='password';
  f.type=show?'text':'password';
  btn.textContent=show?'Hide':'Show';
}
(function(){
  function tick(){
    var now=new Date(),h=now.getHours();
    var g=document.getElementById('ov-greeting');
    var c=document.getElementById('ov-time');
    var d=document.getElementById('ov-date');
    if(g)g.textContent=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    if(c){
      var hh=h%12||12, mm=now.getMinutes();
      c.textContent=(hh<10?'0':'')+hh+'.'+(mm<10?'0':'')+mm+' '+(h<12?'AM':'PM');
    }
    if(d)d.textContent=now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
  document.addEventListener('DOMContentLoaded',function(){
    tick();setInterval(tick,15000);
    var u=document.getElementById('master-username');if(u)u.focus();
  });
})();