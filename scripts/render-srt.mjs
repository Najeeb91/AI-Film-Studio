#!/usr/bin/env node
import fs from 'node:fs/promises'
const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8'))
const out=process.argv[3]||'subtitles.srt'
const fmt=s=>{const ms=Math.round((s-Math.floor(s))*1000);const t=Math.floor(s);const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),sec=t%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`}
const body=(manifest.subtitles||[]).map((x,i)=>`${i+1}\n${fmt(x.start)} --> ${fmt(x.end)}\n${x.text}\n`).join('\n')
await fs.writeFile(out,body)
console.log(out)
