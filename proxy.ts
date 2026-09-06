import {NextRequest,NextResponse} from 'next/server'

export function proxy(req:NextRequest){
  const response=NextResponse.next()
  const h=response.headers
  h.set('X-Content-Type-Options','nosniff')
  h.set('Referrer-Policy','strict-origin-when-cross-origin')
  h.set('X-Frame-Options','SAMEORIGIN')
  h.set('Permissions-Policy','camera=(), microphone=(), geolocation=()')
  h.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'")
  if(process.env.NODE_ENV==='production') h.set('Strict-Transport-Security','max-age=31536000; includeSubDomains')
  return response
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']}
