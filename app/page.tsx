'use client'
import {useEffect,useState} from 'react'
import {Clapperboard,Film,FolderOpen,Plus,Search,Settings2,Sparkles,Play,Clock3,ChevronRight,CheckCircle2,Mic2,Layers3, WandSparkles} from 'lucide-react'

const projects:any[]=[]
const pipeline=['Story & Script','Character / World Bible','Scene & Shot Plan','AI Video Generation','Natural Voice','Music & SFX','AI Edit','Quality Control','Final Render']
export default function Home(){
 const [active,setActive]=useState('Home'); const [projects,setProjects]=useState<any[]>([]); const [prompt,setPrompt]=useState(''); const [created,setCreated]=useState(false); const [loading,setLoading]=useState(false); const [plan,setPlan]=useState<any>(null); const [error,setError]=useState('')
 useEffect(()=>{fetch('/api/projects').then(r=>r.json()).then(d=>setProjects(d.projects||[])).catch(()=>{})},[])
 const createFilm=async()=>{ if(!prompt.trim()) return setError('Describe the film you want to create first.'); setLoading(true); setError(''); try{ const r=await fetch('/api/director',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,durationMinutes:10,genre:'Cinematic Documentary'})}); const d=await r.json(); if(!r.ok) throw new Error(d.error); setPlan(d.plan); const saved=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:d.plan.title,type:d.plan.genre,duration:`${d.plan.durationMinutes} min`,prompt,plan:d.plan})}); if(!saved.ok){ const saveError=await saved.json().catch(()=>({})); throw new Error(saveError.error||`Project save failed (${saved.status}).`); } const savedData=await saved.json(); setCreated(true); if(savedData.project?.id) window.location.href=`/projects/${savedData.project.id}` }catch(e:any){setError(e.message||'Something went wrong.')} finally{setLoading(false)} }
 return <main className="app">
  <aside className="sidebar">
   <div className="brand"><div className="brandmark"><Clapperboard size={20}/></div><div><b>AI Film Studio</b><span>Production Engine</span></div></div>
   <nav>{[['Home',Film],['Projects',FolderOpen],['Templates',Layers3]].map(([n,I]:any)=><button className={active===n?'nav active':'nav'} onClick={()=>setActive(n)} key={n}><I size={18}/>{n}</button>)}</nav>
   <div className="sidebottom"><button className="nav"><Settings2 size={18}/>Settings</button><div className="profile"><div className="avatar">N</div><div><b>Director</b><span>Personal workspace</span></div></div></div>
  </aside>
  <section className="content">
   <header><div><p className="eyebrow">DIRECTOR WORKSPACE · MOBILE READY</p><h1>Turn an idea into a film.</h1><p className="sub">Your AI production team handles the story, shots, moving footage, voice, sound, edit and final render.</p></div><button className="ghost"><Search size={17}/> Search</button></header>
   <div className="hero">
    <div className="heroicon"><Sparkles size={24}/></div>
    <div className="promptwrap"><label>What do you want to create?</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Create a 10-minute cinematic documentary about the rise and fall of an ancient civilization..." />
      <div className="promptrow"><div className="chips"><button>Historical</button><button>Documentary</button><button>16:9</button><button>Natural narration</button></div><button className="create" disabled={loading} onClick={createFilm}><WandSparkles size={17}/> {loading?'Building plan…':'Create Film'}</button></div>
    </div>
   </div>
   {error && <div className="created error"><CheckCircle2 size={19}/><div><b>Couldn’t create the plan.</b><span>{error}</span></div></div>}
   {created && <div className="created"><CheckCircle2 size={19}/><div><b>Production plan created.</b><span>AI Director is ready to turn your idea into chapters, scenes and shots.</span></div><ChevronRight size={18}/></div>}
   <section className="section"><div className="sectionhead"><div><h2>Production pipeline</h2><p>One project, from concept to final MP4.</p></div></div><div className="pipeline">{pipeline.map((p,i)=><div className="step" key={p}><div className="stepnum">{i+1}</div><span>{p}</span>{i<pipeline.length-1&&<ChevronRight className="arrow" size={15}/>}</div>)}</div></section>
   <section className="section"><div className="sectionhead"><div><h2>Recent projects</h2><p>Continue where you left off.</p></div><button className="textbtn">View all <ChevronRight size={15}/></button></div><div className="projects">{projects.length?projects.slice(0,6).map(p=><article className="project" key={p.id} onClick={()=>window.location.href=`/projects/${p.id}`}><div className="thumb"><Film size={25}/><span>{p.status}</span></div><div className="pbody"><div className="ptop"><div><h3>{p.title}</h3><p>{p.type}</p></div><button className="play"><Play size={15} fill="currentColor"/></button></div><div className="meta"><span><Clock3 size={14}/>{p.duration}</span><span>{p.progress||0}%</span></div><div className="progress"><i style={{width:`${p.progress||0}%`}}/></div></div></article>):<div className="emptyprojects">No films yet. Create your first film above.</div>}</div></section>
   {plan && <section className="section plan"><div className="sectionhead"><div><h2>{plan.title}</h2><p>{plan.logline}</p></div></div><div className="planstats"><span>{plan.chapters.length} chapters</span><span>{plan.chapters.reduce((n:any,c:any)=>n+c.scenes.length,0)} scenes</span><span>{plan.chapters.reduce((n:any,c:any)=>n+c.scenes.reduce((m:any,s:any)=>m+s.shots.length,0),0)} shots planned</span><span>Natural narration</span></div><div className="chapterlist">{plan.chapters.map((c:any)=><article key={c.id}><div><b>{c.title}</b><p>{c.summary}</p></div><span>{c.scenes.length} scenes</span></article>)}</div></section>}
   <section className="principles"><div><b>Built for real film production</b><span>Actual AI-generated moving footage — not photo slideshows.</span></div><div><Mic2 size={19}/><span>Natural-sounding voice is a first-class quality requirement.</span></div><div><CheckCircle2 size={19}/><span>Continuity and quality checks run before final render.</span></div></section>
  </section>
 </main>
}
