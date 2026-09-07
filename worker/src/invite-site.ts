export const claimPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0f2f57">
  <title>领取 AI 学术转换器邀请码</title>
  <style>
    :root{color-scheme:light;--ink:#10233e;--blue:#185da7;--blue-2:#0f427b;--paper:#fbfcfe;--line:#d8e2ef;--muted:#65758a;--ok:#087f5b;--danger:#b42318}
    *{box-sizing:border-box}body{margin:0;min-height:100svh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:radial-gradient(circle at 50% -10%,#dbeafe 0,transparent 42%),#eef3f9;display:grid;place-items:center;padding:24px 16px}
    main{width:min(100%,460px)}.brand{display:flex;align-items:center;gap:10px;margin:0 0 18px 4px;font-size:14px;font-weight:700;letter-spacing:.08em;color:var(--blue-2)}.mark{width:30px;height:30px;border-radius:9px;background:var(--blue-2);color:white;display:grid;place-items:center;font-family:Georgia,serif;font-size:18px}
    .card{position:relative;background:var(--paper);border:1px solid rgba(15,66,123,.16);border-radius:24px;box-shadow:0 22px 60px rgba(30,58,95,.16);overflow:hidden}.top{height:8px;background:linear-gradient(90deg,var(--blue-2),#2f7ec9)}.content{padding:30px 26px 28px}.eyebrow{margin:0 0 10px;color:var(--blue);font-size:13px;font-weight:800;letter-spacing:.16em}.title{font-family:Georgia,"Songti SC",serif;font-size:29px;line-height:1.25;margin:0 0 10px}.lead{font-size:16px;line-height:1.65;color:var(--muted);margin:0 0 26px}
    .ticket{border:1px solid var(--line);border-radius:16px;background:white;padding:18px;position:relative}.ticket:before,.ticket:after{content:"";position:absolute;top:50%;width:18px;height:18px;border-radius:50%;background:#eef3f9;transform:translateY(-50%)}.ticket:before{left:-10px}.ticket:after{right:-10px}.label{font-size:13px;color:var(--muted);margin-bottom:9px}.code{min-height:31px;font:700 20px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em;overflow-wrap:anywhere;color:var(--blue-2)}
    .status{min-height:48px;margin:15px 2px 4px;font-size:14px;line-height:1.6;color:var(--muted)}.status.ok{color:var(--ok)}.status.error{color:var(--danger)}button{width:100%;min-height:52px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:white;font-size:17px;font-weight:750;cursor:pointer;box-shadow:0 8px 20px rgba(24,93,167,.25);transition:.2s transform,.2s opacity}button:active{transform:scale(.985)}button:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}.link{display:block;text-align:center;margin-top:18px;color:var(--blue);font-size:15px;text-decoration:none}.note{text-align:center;color:var(--muted);font-size:12px;line-height:1.6;margin:18px 18px 0}
    .spinner{display:inline-block;width:14px;height:14px;border:2px solid #afc3da;border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px;margin-right:7px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:380px){.content{padding:25px 20px}.title{font-size:26px}.code{font-size:18px}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="mark">A</span> AI 学术输出格式转换器</div>
    <section class="card" aria-labelledby="page-title">
      <div class="top"></div>
      <div class="content">
        <p class="eyebrow">30 天使用资格</p>
        <h1 class="title" id="page-title">领取你的专属邀请码</h1>
        <p class="lead">每台设备领取一枚。邀请码已为你单独保留，可用于注册或账户续期。</p>
        <div class="ticket" aria-live="polite">
          <div class="label">邀请码</div>
          <div class="code" id="invite-code">正在安全分配…</div>
        </div>
        <div class="status" id="status"><span class="spinner"></span>正在从可用邀请码中分配</div>
        <button id="copy" type="button" disabled>复制邀请码</button>
        <a class="link" href="https://academicconverter.taylersy.com/">前往 AI 学术转换器 →</a>
      </div>
    </section>
    <p class="note">请妥善保存。邀请码一旦完成注册或续期即不可再次使用。</p>
  </main>
  <script>
    const tokenKey='yyz_invite_claim_token';
    const codeEl=document.getElementById('invite-code');
    const statusEl=document.getElementById('status');
    const copyBtn=document.getElementById('copy');
    let inviteCode='';
    function setStatus(message,type=''){statusEl.textContent=message;statusEl.className='status '+type}
    async function claim(){
      try{
        const claimToken=localStorage.getItem(tokenKey)||'';
        const response=await fetch('/api/invite/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claim_token:claimToken})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'领取失败，请稍后重试');
        if(data.claim_token)localStorage.setItem(tokenKey,data.claim_token);
        inviteCode=data.invite_code;codeEl.textContent=inviteCode;copyBtn.disabled=false;
        setStatus(data.redeemed?'这枚邀请码已经完成注册或续期。':'邀请码已为你保留，请复制后使用。',data.redeemed?'':'ok');
      }catch(error){codeEl.textContent='暂时无法领取';setStatus(error.message||'网络异常，请稍后重试','error')}
    }
    copyBtn.addEventListener('click',async()=>{
      if(!inviteCode)return;
      try{await navigator.clipboard.writeText(inviteCode)}catch{const input=document.createElement('textarea');input.value=inviteCode;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove()}
      copyBtn.textContent='已复制';setStatus('邀请码已复制到剪贴板。','ok');setTimeout(()=>copyBtn.textContent='再次复制',1800)
    });
    claim();
  </script>
</body>
</html>`

export const adminPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b1f35">
  <title>邀请码管理台</title>
  <style>
    :root{--navy:#0b1f35;--blue:#1f67ad;--paper:#f5f7fa;--surface:#fff;--line:#dbe3ed;--muted:#64748b;--green:#0b7a55;--amber:#a15c00;--red:#b42318}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--navy);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px}.shell{max-width:1180px;margin:auto;padding:28px 22px 60px}header{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:26px}.brand{display:flex;align-items:center;gap:12px}.mark{width:38px;height:38px;border-radius:11px;background:var(--navy);color:#fff;display:grid;place-items:center;font:20px Georgia,serif}.brand h1{font-size:22px;margin:0}.brand p{font-size:13px;color:var(--muted);margin:3px 0 0}.actions{display:flex;gap:10px;flex-wrap:wrap}button,.button{border:1px solid var(--line);background:white;color:var(--navy);border-radius:10px;min-height:42px;padding:0 15px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.primary{background:var(--blue);border-color:var(--blue);color:#fff}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}.stat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:19px}.stat .k{font-size:13px;color:var(--muted);margin-bottom:9px}.stat .v{font:700 30px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.stat.unissued .v{color:var(--green)}.stat.issued .v{color:var(--amber)}.stat.used .v{color:var(--blue)}
    .panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}.panel-head{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:16px}.panel-head h2{font-size:17px;margin:0}.search{width:min(100%,300px);height:42px;border:1px solid var(--line);border-radius:10px;padding:0 13px;font-size:14px}.table-wrap{overflow:auto;max-height:570px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:13px 18px;border-bottom:1px solid #edf1f5;font-size:14px}th{position:sticky;top:0;background:#f9fbfd;color:var(--muted);font-weight:700;z-index:1}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.badge{display:inline-flex;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:750}.badge.issued{background:#fff4de;color:#8a4e00}.badge.used{background:#e7f1ff;color:#185591}.empty{text-align:center;color:var(--muted);padding:50px 20px}.qr-panel{display:grid;grid-template-columns:160px 1fr;gap:20px;align-items:center;margin-bottom:22px;background:var(--navy);color:#fff;border-radius:18px;padding:18px 22px}.qr-panel img{width:150px;height:150px;background:#fff;border-radius:12px;padding:7px}.qr-panel h2{margin:0 0 8px;font-size:19px}.qr-panel p{color:#bdd0e4;line-height:1.55;margin:0 0 13px;font-size:14px}.qr-link{color:#fff;overflow-wrap:anywhere;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
    .gate{position:fixed;inset:0;background:rgba(4,17,31,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:10}.gate.hidden{display:none}.login{width:min(100%,390px);background:white;border-radius:20px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.3)}.login h2{margin:0 0 7px}.login p{margin:0 0 20px;color:var(--muted);line-height:1.55}.login input{width:100%;height:48px;border:1px solid var(--line);border-radius:11px;padding:0 13px;font-size:16px;margin-bottom:10px}.login button{width:100%;height:48px}.error{min-height:22px;color:var(--red);font-size:13px;margin-bottom:5px}.meta{font-size:13px;color:var(--muted);margin-top:12px;text-align:right}
    @media(max-width:760px){.stats{grid-template-columns:1fr 1fr}.qr-panel{grid-template-columns:110px 1fr}.qr-panel img{width:100px;height:100px}header{align-items:flex-start;flex-direction:column}.panel-head{align-items:stretch;flex-direction:column}.search{width:100%}}@media(max-width:430px){.shell{padding:20px 14px 40px}.stats{gap:9px}.stat{padding:15px}.stat .v{font-size:25px}.qr-panel{grid-template-columns:1fr;text-align:center}.qr-panel img{margin:auto}}
  </style>
</head>
<body>
  <div class="gate" id="gate">
    <form class="login" id="login-form">
      <h2>进入邀请码管理台</h2><p>输入管理员访问密钥。密钥仅保存在当前浏览器标签页。</p>
      <input id="token" type="password" autocomplete="current-password" placeholder="管理员访问密钥" required>
      <div class="error" id="login-error"></div><button class="primary" type="submit">验证并进入</button>
    </form>
  </div>
  <div class="shell">
    <header><div class="brand"><span class="mark">A</span><div><h1>邀请码管理台</h1><p>AI 学术输出格式转换器</p></div></div><div class="actions"><button id="refresh">刷新数据</button><button id="export">导出状态 CSV</button><button id="logout">退出</button></div></header>
    <section class="qr-panel"><img src="/invite/qr.svg" alt="用户领取邀请码二维码"><div><h2>用户领取二维码</h2><p>将此二维码发给用户。扫码后系统会自动分配并保留一枚尚未发放的邀请码。</p><a class="button" href="/invite/qr.svg" download="邀请码领取二维码.svg">下载二维码</a> <a class="qr-link" href="/invite" target="_blank">打开领取页</a></div></section>
    <section class="stats" aria-label="邀请码概览"><article class="stat"><div class="k">邀请码总数</div><div class="v" id="total">—</div></article><article class="stat unissued"><div class="k">尚未发放</div><div class="v" id="unissued">—</div></article><article class="stat issued"><div class="k">已发放未注册</div><div class="v" id="issued">—</div></article><article class="stat used"><div class="k">已注册使用</div><div class="v" id="used">—</div></article></section>
    <section class="panel"><div class="panel-head"><h2>发放记录</h2><input class="search" id="search" type="search" placeholder="搜索邀请码或用户名"></div><div class="table-wrap"><table><thead><tr><th>邀请码</th><th>状态</th><th>发放时间</th><th>注册用户</th><th>使用时间</th></tr></thead><tbody id="rows"></tbody></table><div class="empty" id="empty">尚无发放记录</div></div></section><div class="meta" id="updated"></div>
  </div>
  <script>
    const tokenKey='yyz_invite_admin_token';let claims=[];const gate=document.getElementById('gate');const errorEl=document.getElementById('login-error');
    function token(){return sessionStorage.getItem(tokenKey)||''}function authHeaders(){return{Authorization:'Bearer '+token()}}
    function fmt(value){if(!value)return'—';return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(value))}
    async function api(path){const response=await fetch(path,{headers:authHeaders(),cache:'no-store'});if(response.status===401){gate.classList.remove('hidden');throw new Error('访问密钥无效')}if(!response.ok)throw new Error('加载失败');return response}
    function renderRows(){const q=document.getElementById('search').value.trim().toLowerCase();const items=claims.filter(x=>!q||x.invite_code.toLowerCase().includes(q)||(x.username||'').toLowerCase().includes(q));const body=document.getElementById('rows');body.replaceChildren();for(const item of items){const row=document.createElement('tr');const cells=[item.invite_code,item.redeemed?'已注册':'待注册',fmt(item.claimed_at),item.username||'—',fmt(item.used_at)];cells.forEach((text,i)=>{const td=document.createElement('td');if(i===0)td.className='mono';if(i===1){const badge=document.createElement('span');badge.className='badge '+(item.redeemed?'used':'issued');badge.textContent=text;td.appendChild(badge)}else td.textContent=text;row.appendChild(td)});body.appendChild(row)}document.getElementById('empty').style.display=items.length?'none':'block'}
    async function load(){try{const [statsResponse,claimsResponse]=await Promise.all([api('/api/invite/admin/stats'),api('/api/invite/admin/claims')]);const stats=await statsResponse.json();claims=(await claimsResponse.json()).claims;document.getElementById('total').textContent=stats.total;document.getElementById('unissued').textContent=stats.unissued;document.getElementById('issued').textContent=stats.issued_unused;document.getElementById('used').textContent=stats.redeemed;document.getElementById('updated').textContent='最后更新：'+fmt(new Date().toISOString());renderRows();gate.classList.add('hidden');errorEl.textContent=''}catch(error){errorEl.textContent=error.message}}
    document.getElementById('login-form').addEventListener('submit',event=>{event.preventDefault();sessionStorage.setItem(tokenKey,document.getElementById('token').value.trim());load()});document.getElementById('refresh').addEventListener('click',load);document.getElementById('search').addEventListener('input',renderRows);document.getElementById('logout').addEventListener('click',()=>{sessionStorage.removeItem(tokenKey);gate.classList.remove('hidden')});document.getElementById('export').addEventListener('click',async()=>{try{const response=await api('/api/invite/admin/export');const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='invite-status-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url)}catch(error){alert(error.message)}});if(token())load();
  </script>
</body>
</html>`
