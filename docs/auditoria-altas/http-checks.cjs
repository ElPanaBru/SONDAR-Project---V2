// Only rejected unauthenticated requests and invalid registration input. No valid writes.
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'../..');
(async()=>{const results=[];const mounts={usuarios:'/api/usuarios',eventos:'/api/eventos',reels:'/api/reels',comunidades:'/api/comunidades',mensajes:'/api/mensajes',notificaciones:'/api/notificaciones'};
for(const [file,mount] of Object.entries(mounts)){
 const src=fs.readFileSync(path.join(root,'Backend/routes',file+'.js'),'utf8');
 for(const match of src.matchAll(/router\.(post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)){
  if(file==='usuarios'&&match[2]==='/crear-cuenta')continue;
  const endpoint=mount+match[2].replace(/:[a-zA-Z]+/g,'1');
  const r=await fetch('http://127.0.0.1:3000'+endpoint,{method:match[1].toUpperCase(),headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  results.push({method:match[1].toUpperCase(),route:mount+match[2],expected:401,status:r.status,pass:r.status===401});await r.text();
 }
}
for(const body of [{},{email:'audit@example.invalid',username:'audit',password:'x'},{email:'audit@example.invalid',username:'!',password:'Audit123!'}]){
 const r=await fetch('http://127.0.0.1:3000/api/usuarios/crear-cuenta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 results.push({route:'POST /api/usuarios/crear-cuenta',case:!body.email?'empty':body.password==='x'?'weak password':'invalid username',expected:400,status:r.status,pass:r.status===400});await r.text();
}
const invalid=await fetch('http://127.0.0.1:3000/api/eventos/crear',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer invalid-audit-token'},body:'{}',signal:AbortSignal.timeout(10000)});results.push({route:'POST /api/eventos/crear',case:'invalid token',expected:401,status:invalid.status,pass:invalid.status===401});await invalid.text();
fs.writeFileSync(path.join(__dirname,'http-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({total:results.length,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length}));process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e.message);process.exitCode=1});
