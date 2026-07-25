// ═══ STONNI ATACADO — supabase.js ═══
// ── SUPABASE HELPERS ───────────────────────────────────────
async function getToken() {
  const s=(await window.sb.auth.getSession()).data.session;
  return s?.access_token||window.SUPA_KEY;
}
async function sbQ(table,params='') {
  const r=await fetch(`${window.SUPA_URL}/rest/v1/${table}?${params}&limit=9999`,{
    headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json'}
  });
  if(!r.ok){
    const txt=await r.text().catch(()=>'');
    console.error('sbQ',table,r.status,txt);
    if(table!=='atac_log_acoes') logAcao('ERRO_QUERY',{
      nivel:'ERROR',
      detalhe:{tabela:table,query:params.substring(0,200)},
      erro:`HTTP ${r.status} — ${txt.substring(0,300)}`
    });
    return[];
  }
  return r.json();
}
async function sbInsert(table,body) {
  const r = await fetch(`${window.SUPA_URL}/rest/v1/${table}`,{
    method:'POST',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)
  });
  if(!r.ok && table!=='atac_log_acoes'){
    const txt=await r.text().catch(()=>'');
    console.error('sbInsert',table,r.status,txt);
    logAcao('ERRO_INSERT',{
      nivel:'ERROR',
      detalhe:{tabela:table,dados:JSON.stringify(body).substring(0,200)},
      erro:`HTTP ${r.status} — ${txt.substring(0,300)}`
    });
  }
  return r;
}
async function sbUpdate(table,field,val,body) {
  const r = await fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`,{
    method:'PATCH',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)
  });
  if(!r.ok && table!=='atac_log_acoes'){
    const txt=await r.text().catch(()=>'');
    console.error('sbUpdate',table,r.status,txt);
    logAcao('ERRO_UPDATE',{
      nivel:'ERROR',
      detalhe:{tabela:table,campo:field,valor:String(val).substring(0,50)},
      erro:`HTTP ${r.status} — ${txt.substring(0,300)}`
    });
  }
  return r;
}
async function sbUpsert(table,body,conflict) {
  const r = await fetch(`${window.SUPA_URL}/rest/v1/${table}?on_conflict=${conflict}`,{
    method:'POST',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)
  });
  if(!r.ok && table!=='atac_log_acoes'){
    const txt=await r.text().catch(()=>'');
    console.error('sbUpsert',table,r.status,txt);
    logAcao('ERRO_UPSERT',{
      nivel:'ERROR',
      detalhe:{tabela:table,conflito:conflict,dados:JSON.stringify(body).substring(0,200)},
      erro:`HTTP ${r.status} — ${txt.substring(0,300)}`
    });
  }
  return r;
}
async function sbDel(table,field,val) {
  const r = await fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`,{
    method:'DELETE',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`}
  });
  if(!r.ok && table!=='atac_log_acoes'){
    const txt=await r.text().catch(()=>'');
    console.error('sbDel',table,r.status,txt);
    logAcao('ERRO_DELETE',{
      nivel:'ERROR',
      detalhe:{tabela:table,campo:field,valor:String(val).substring(0,50)},
      erro:`HTTP ${r.status} — ${txt.substring(0,300)}`
    });
  }
  return r;
}
