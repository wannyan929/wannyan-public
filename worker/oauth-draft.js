// Cloudflare Worker for Decap CMS GitHub OAuth.
// DEPLOYMENT DRAFT: must be reviewed and tested before production use.
// Required Worker secrets: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, STATE_SECRET.
// GitHub OAuth callback: https://noisy-voice-54f9.ryo-f-0924.workers.dev/callback
const SITE = 'https://wannyan929.github.io';
const REPO = 'wannyan929/wannyan-public';
const ALLOWED_LOGIN = 'wannyan929';
const WORKER_ORIGIN = 'https://noisy-voice-54f9.ryo-f-0924.workers.dev';
const encoder = new TextEncoder();
function html(text, status=200) {
  return new Response(text, {status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
}
function error(message,status=400){return new Response(message,{status,headers:{'cache-control':'no-store','content-type':'text/plain; charset=utf-8'}})}
function hex(bytes){return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(message)))}
function safeEq(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function randomHex(){return hex(crypto.getRandomValues(new Uint8Array(32)))}
function cookie(request,name){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
function popupResult(payload){
  const json=JSON.stringify(payload).replace(/</g,'\\u003c');
  return html(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>認証結果</title><body><p>認証処理を完了しました。このウィンドウは閉じられます。</p><script>
  const payload=${json};
  if(window.opener){window.opener.postMessage('authorization:github:'+payload.status+':'+JSON.stringify(payload.data),${JSON.stringify(SITE)});}
  window.close();
  </script></body></html>`);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.origin!==WORKER_ORIGIN)return error('Invalid host',403);
    if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.STATE_SECRET||env.STATE_SECRET.length<32)return error('Worker secrets are not configured',503);
    if(url.pathname==='/health')return new Response('configured',{headers:{'cache-control':'no-store'}});
    if(url.pathname==='/auth' && request.method==='GET'){
      const state=randomHex(),ts=Date.now().toString(),payload=state+'.'+ts;
      const sig=await hmac(env.STATE_SECRET,payload);
      const redirect=new URL('https://github.com/login/oauth/authorize');
      redirect.searchParams.set('client_id',env.GITHUB_CLIENT_ID);
      redirect.searchParams.set('redirect_uri',WORKER_ORIGIN+'/callback');
      redirect.searchParams.set('scope','repo');
      redirect.searchParams.set('state',state);
      return new Response(null,{status:302,headers:{'location':redirect.toString(),'cache-control':'no-store','set-cookie':`cms_oauth=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`}});
    }
    if(url.pathname==='/callback' && request.method==='GET'){
      
      const raw=cookie(request,'cms_oauth'),parts=raw.split('.');
      if(parts.length!==3)return error('Missing OAuth state',403);
      const [state,ts,sig]=parts;
      if(!/^\\d{13}$/.test(ts)||Math.abs(Date.now()-Number(ts))>600000)return error('OAuth state expired',403);
      const expected=await hmac(env.STATE_SECRET,state+'.'+ts);
      if(!safeEq(expected,sig)||!safeEq(state,url.searchParams.get('state')||''))return error('OAuth state mismatch',403);
      if(url.searchParams.has('error'))return popupResult({status:'error',data:{message:'GitHub authorization was declined'}});
      const code=url.searchParams.get('code');
      if(!code)return error('Missing authorization code',400);
      const exchange=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'accept':'application/json','content-type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:WORKER_ORIGIN+'/callback'})});
      if(!exchange.ok)return error('Token exchange failed',502);
      const data=await exchange.json();
      if(!data.access_token)return error('GitHub did not return a token',403);
      const ghHeaders={'accept':'application/vnd.github+json','authorization':'Bearer '+data.access_token,'user-agent':'wannyan-cms-oauth'};
      const me=await fetch('https://api.github.com/user',{headers:ghHeaders});
      if(!me.ok)return error('GitHub user lookup failed',403);
      const user=await me.json();
      if(typeof user.login!=='string'||user.login.toLowerCase()!==ALLOWED_LOGIN)return error('This account is not approved',403);
      const permission=await fetch('https://api.github.com/repos/'+REPO+'/collaborators/'+encodeURIComponent(user.login)+'/permission',{headers:ghHeaders});
      if(!permission.ok)return error('Repository permission lookup failed',403);
      const access=await permission.json();
      if(!['admin','write','maintain'].includes(access.permission))return error('Repository write access required',403);
      // Intentionally fail closed. Decap's token handoff and origin validation
      // require integration testing before this Worker may be deployed.
      return popupResult({status:'error',data:{message:'Authentication backend is not yet enabled'}});

    }
    return error('Not found',404);
  }
};
