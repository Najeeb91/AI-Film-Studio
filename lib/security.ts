import crypto from 'crypto'

export function timingSafeEqualText(a:string,b:string){
  const aa=Buffer.from(a||''); const bb=Buffer.from(b||'')
  if(aa.length!==bb.length) return false
  return crypto.timingSafeEqual(aa,bb)
}

export function requireInternalSecret(req:Request, secret?:string){
  if(!secret) return {ok:true as const}
  const supplied=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || req.headers.get('x-internal-secret') || ''
  return {ok:timingSafeEqualText(supplied,secret)}
}

export function requestId(req:Request){
  return req.headers.get('x-request-id') || crypto.randomUUID()
}

export function jsonLimit(req:Request, maxBytes=1024*1024){
  const length=Number(req.headers.get('content-length')||0)
  return !length || length<=maxBytes
}
