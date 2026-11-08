/* Office Certificate App - login panel live behaviour */
(function(){
  var tips=['Search any student quickly by EMIS number.',
            'Excel and CSV files are opened and saved on this computer.',
            'Certificates print on A4 exactly as shown in the preview.',
            'Use Conduct & Attendance to print both certificates on one page.'];
  function $(id){return document.getElementById(id);}
  function clock(){
    var n=new Date(),h=n.getHours(),m=n.getMinutes(),hh=h%12||12;
    var t=$('ov2-time'),d=$('ov2-date');
    if(t)t.textContent=(hh<10?'0':'')+hh+'.'+(m<10?'0':'')+m+' '+(h<12?'AM':'PM');
    if(d)d.textContent=n.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  }
  document.addEventListener('DOMContentLoaded',function(){
    clock();setInterval(clock,15000);
    var tip=$('ov2-tip'),i=0;
    if(tip){tip.textContent=tips[0];setInterval(function(){
      tip.classList.add('is-out');
      setTimeout(function(){i=(i+1)%tips.length;tip.textContent=tips[i];tip.classList.remove('is-out');},350);
    },5000);}
    var p=$('master-password'),caps=$('ov2-caps');
    if(p&&caps){
      var chk=function(e){caps.classList.toggle('on',!!(e.getModifierState&&e.getModifierState('CapsLock')));};
      p.addEventListener('keydown',chk);p.addEventListener('keyup',chk);
      p.addEventListener('blur',function(){caps.classList.remove('on');});
    }
    var u=$('master-username'),r=$('ov2-remember');
    try{
      var saved=localStorage.getItem('oc_username');
      if(saved&&u){u.value=saved;if(r)r.checked=true;if(p)p.focus();}
      var f=u&&u.form;
      if(f)f.addEventListener('submit',function(){
        try{if(r&&r.checked)localStorage.setItem('oc_username',u.value);else localStorage.removeItem('oc_username');}catch(e){}
      },true);
    }catch(e){}
  });
})();