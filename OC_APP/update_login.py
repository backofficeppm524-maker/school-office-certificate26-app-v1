"""Run once next to index.html:  python update_login.py
Backs up to index.before-login.html, then replaces only the login screen."""
import re, shutil, sys
SRC='index.html'
html=open(SRC,encoding='utf-8').read()
shutil.copyfile(SRC,'index.before-login.html')

U='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'
L='<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
LOGIN='''<section id="master-login" class="login-screen ov2">
    <div class="ov2-window">
      <div class="ov2-bar">
        <b>Office Certificate &middot; Admin Console</b>
        <span class="ov2-live"><span class="ov2-dot"></span>System ready</span>
      </div>

      <div class="ov2-side">
        <div class="ov2-brand"><span class="ov2-mark">OC</span><div><strong>Office Certificate</strong><span>Unified Certificate System</span></div></div>
        <h1>Every certificate, one workspace.</h1>
        <div class="ov2-metrics">
          <div class="ov2-metric"><small>Status</small><b class="ok">Ready</b></div>
          <div class="ov2-metric"><small>Data storage</small><b>This computer</b></div>
          <div class="ov2-metric"><small>Print layout</small><b>A4</b></div>
          <div class="ov2-metric"><small id="ov2-date">Today</small><b id="ov2-time">--.-- --</b></div>
        </div>
        <div class="ov2-flow" aria-hidden="true">
          <div class="ov2-node"><i></i>Student<br>file</div><span class="ov2-link"></span>
          <div class="ov2-node"><i></i>Certificate</div><span class="ov2-link"></span>
          <div class="ov2-node"><i></i>Print</div>
        </div>
        <p class="ov2-tip" id="ov2-tip" aria-live="off"></p>
      </div>

      <div class="ov2-main">
        <div class="ov2-card">
          <h2>Sign in</h2>
          <p>Enter your admin details to open the dashboard.</p>
          <form class="login-form" onsubmit="handleMasterLogin(event)">
            <label class="ov2-field"><span class="ov2-lbl">Username</span>
              <span class="ov2-input">UICON<input type="text" id="master-username" required autocomplete="username"></span></label>
            <label class="ov2-field"><span class="ov2-lbl">Password</span>
              <span class="ov2-input ov2-pw">LICON<input type="password" id="master-password" required autocomplete="current-password"><button type="button" onclick="ovTogglePass(this)">Show</button></span></label>
            <div class="ov2-caps" id="ov2-caps">Caps Lock is on</div>
            <div class="ov2-row"><label><input type="checkbox" id="ov2-remember">Remember username</label></div>
            <button type="submit" class="ov2-submit">Sign in</button>
            <p id="login-error" class="login-error">Invalid Username or Password</p>
          </form>
          <p class="ov2-foot">Works offline &middot; Data stays on this computer</p>
        </div>
      </div>
    </div>
  </section>

  '''.replace('UICON',U).replace('LICON',L)

html,n=re.subn(r'<section id="master-login".*?(?=<div id="master-app")',lambda m:LOGIN,html,count=1,flags=re.S)
if n==0: print('Login section not found. index.html NOT changed.'); sys.exit(1)
if 'login-panel.css' not in html:
    html=html.replace('</head>','  <link rel="stylesheet" href="login-panel.css">\n  <script src="login-panel.js" defer></script>\n</head>',1)
open(SRC,'w',encoding='utf-8').write(html)
print('Done. Backup saved as index.before-login.html')
