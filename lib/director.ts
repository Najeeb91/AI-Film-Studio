import {DirectorPlan} from './schemas'

export function fallbackPlan(prompt:string,durationMinutes:number,genre:string):DirectorPlan {
  const now=new Date().toISOString()
  const title=prompt.trim().replace(/\s+/g,' ').slice(0,72) || 'Untitled Film'
  const chapterCount=Math.max(3,Math.min(8,Math.ceil(durationMinutes/4)))
  const chapters=Array.from({length:chapterCount},(_,ci)=>({
    id:`ch-${ci+1}`,title:`Chapter ${ci+1}`,summary:`A cinematic chapter advancing the story of ${title}.`,
    scenes:Array.from({length:2},(_,si)=>({
      id:`ch-${ci+1}-sc-${si+1}`,title:`Scene ${ci+1}.${si+1}`,purpose:si===0?'Establish the world and stakes.':'Advance the story with a human moment.',location:si===0?'Primary location':'Secondary location',timeOfDay:si%2?'Golden hour':'Day',
      shots:[
        ['Establishing','Wide cinematic camera move',`Reveal the environment and establish scale for ${title}.`],
        ['Medium','Slow tracking shot',`Follow the subject as the story develops.`],
        ['Close-up','Gentle push-in',`Capture a natural human reaction with realistic motion.`],
        ['Detail','Macro/insert movement',`Show a meaningful object or environmental detail in motion.`]
      ].map((x,ji)=>({id:`ch-${ci+1}-sc-${si+1}-sh-${ji+1}`,type:x[0],duration:6,camera:x[1],action:x[2],prompt:`Actual AI-generated moving video footage, cinematic realism, ${x[2]} Consistent characters, location and lighting.`,status:'planned' as const}))
    }))
  }))
  return {id:crypto.randomUUID(),title,logline:`A ${durationMinutes}-minute ${genre.toLowerCase()} built from your idea: ${prompt.trim()}`,genre,durationMinutes,chapters,characters:[{id:'char-1',name:'Primary Subject',description:'Defined by the Director after understanding the story.',voice:'Natural documentary voice'}],locations:[{id:'loc-1',name:'Primary Location',description:'Defined from the story and visual world.'}],visualStyle:'Cinematic realism, natural motion, coherent lighting, filmic composition.',narrationStyle:'Natural, expressive, human-paced narration.',createdAt:now}
}

export async function generateDirectorPlan(prompt:string,durationMinutes:number,genre:string):Promise<DirectorPlan>{
  const key=process.env.AI_GATEWAY_API_KEY
  if(!key) return fallbackPlan(prompt,durationMinutes,genre)
  const system=`You are the AI Director of a serious AI Film Studio. Return ONLY valid JSON matching this schema: {id,title,logline,genre,durationMinutes,chapters:[{id,title,summary,scenes:[{id,title,purpose,location,timeOfDay,shots:[{id,type,duration,camera,action,prompt,status}]}]}],characters:[{id,name,description,voice}],locations:[{id,name,description}],visualStyle,narrationStyle,createdAt}. Build a practical production plan. Shots must describe ACTUAL MOVING VIDEO, never photo slideshows. Use 3-8 chapters, 2-4 scenes per chapter, 4-6 shots per scene. Keep shot duration between 4 and 10 seconds. status must be planned.`
  const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.AI_DIRECTOR_MODEL||'openai/gpt-5.5',messages:[{role:'system',content:system},{role:'user',content:`Create a film plan for: ${prompt}\nDuration: ${durationMinutes} minutes\nGenre: ${genre}`}],response_format:{type:'json_object'},max_tokens:18000})})
  if(!response.ok) throw new Error(`AI Director request failed (${response.status}).`)
  const data=await response.json(); const raw=data.choices?.[0]?.message?.content
  if(!raw) throw new Error('AI Director returned no plan.')
  const plan=JSON.parse(raw) as DirectorPlan
  return {...plan,id:plan.id||crypto.randomUUID(),durationMinutes:Math.min(60,Math.max(1,Number(plan.durationMinutes)||durationMinutes)),createdAt:plan.createdAt||new Date().toISOString()}
}
