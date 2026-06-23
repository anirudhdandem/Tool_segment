const body = JSON.stringify({ searchTerm: process.argv[2]||"DSA For Loans", city: process.argv[3]||"New-Delhi", maxResults: Number(process.argv[4]||20) });
const t0 = Date.now();
const res = await fetch("http://localhost:4000/api/research/search-complete", { method:"POST", headers:{"Content-Type":"application/json"}, body });
const reader = res.body.getReader(); const dec = new TextDecoder();
let buf = "";
const el = ()=>((Date.now()-t0)/1000).toFixed(1).padStart(5)+"s";
while (true) {
  const { value, done } = await reader.read(); if (done) break;
  buf += dec.decode(value, { stream:true });
  let i;
  while ((i = buf.indexOf("\n\n")) >= 0) {
    const block = buf.slice(0, i); buf = buf.slice(i+2);
    let event="message", data="";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event=line.slice(6).trim();
      else if (line.startsWith("data:")) data+=line.slice(5).trim();
    }
    if (!data) continue; const d = JSON.parse(data);
    if (event==="leads") console.log(`[${el()}] LEADS ${d.leads.length} (scraping=${d.scraping})`);
    else if (event==="enriched") { const l=d.lead;
      console.log(`[${el()}] ENRICHED ${d.done}/${d.total} ${(l.name||'').slice(0,24).padEnd(24)} ph:${(l.phone||'-').slice(0,15).padEnd(15)} web:${(l.website||'-').replace(/^https?:\/\//,'').slice(0,24).padEnd(24)} ${l.email||''}`); }
    else if (event==="done") console.log(`[${el()}] DONE total=${d.total}`);
    else if (event==="error") console.log(`[${el()}] ERROR ${d.message}`);
  }
}
